import { CalendarCheck, ChevronLeft, ChevronRight, Info, Plus, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { fmtDate, madridDay } from "../app/format";
import { useCloud } from "../cloud/CloudGate";
import { RecoveryReminder } from "../cloud/RecoveryParts";
import { LoadError, Loading, Page } from "../app/Page";
import { isIos, isStandalone } from "../app/pwa";
import { useAsync } from "../app/useAsync";
import { fmtVisit } from "../clinical/calendar";
import { useDataVersion } from "../app/dataVersion";
import { sexLabels } from "../clinical/pageKit";
import { getDb } from "../data/db";
import { activeFilters, findPatients, hasOwnPatients, LAST_VISITS, NO_FILTERS, PAGE_SIZE, pendingPatients, PENDINGS, type PatientFilters, type PatientHit } from "../data/patientSearch";
import { getSetting, QUICK_PATIENT, type Sex } from "../data/repo";
import { agenda, type AgendaItem } from "../data/appointments";
import { SEED_PREFIX } from "../data/seed";
import { useStaff } from "../schedule/useStaff";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { NumberField, SelectField } from "../ui/Field";
import { Group } from "../ui/Grouped";
import { PatientRow } from "../ui/ListItem";
import { Sheet } from "../ui/Sheet";

export { QUICK_PATIENT } from "../data/repo";

/** «10:00», en la hora de Madrid. */
const hourOf = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

/** «Hoy, 10:00», «Mañana, 9:30» o «lun, 26 oct, 10:00». */
function when(iso: string) {
  const hour = hourOf(iso);
  const day = madridDay(iso);
  return day === dayPlus(0) ? `Hoy, ${hour}` : day === dayPlus(1) ? `Mañana, ${hour}` : fmtVisit(iso);
}

/** Lo que más sirve de cada paciente en la lista: su próxima cita o la última vez que vino. */
function meta(p: PatientHit) {
  if (p.nextAt) return `Próxima cita: ${when(p.nextAt)}`;
  if (p.lastAt) return `Última visita: ${fmtDate(p.lastAt)}`;
  return "Sin visitas todavía";
}

/** Primera letra para las secciones (sin tildes; «#» si no es una letra). */
function letter(name: string) {
  const c = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().charAt(0).toUpperCase();
  return /[A-ZÑ]/.test(c) ? c : "#";
}

/** Lo buscado, los filtros, la letra y la página. */
type ListState = { search: string; filters: PatientFilters; letter: string | null; page: number };
/** Se recuerda mientras la app está abierta: al volver de una ficha, la lista sigue como estaba. */
let remembered: ListState = { search: "", filters: NO_FILTERS, letter: null, page: 0 };

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];

/**
 * El buscador y la lista. La base busca y filtra, y trae solo la página que se ve (50): con miles de pacientes no se
 * carga la lista entera. Sin buscar, todos de la A a la Z (como los contactos del móvil), por páginas.
 */
function usePatientList() {
  const [state, setState] = useState<ListState>(remembered);
  useEffect(() => {
    remembered = state;
  }, [state]);
  // Cambiar lo buscado o un filtro vuelve a la primera página.
  const update = (patch: Partial<ListState>) => setState((s) => ({ ...s, page: 0, ...patch }));
  // Buscar cuando se deja de escribir un momento, no en cada tecla.
  const [query, setQuery] = useState(state.search);
  useEffect(() => {
    const t = setTimeout(() => setQuery(state.search), 200);
    return () => clearTimeout(t);
  }, [state.search]);
  // Lo pendiente de cobrar o de firmar se calcula una vez (y al cambiar los datos), no en cada página.
  const pending = useAsync(async () => (state.filters.pending ? pendingPatients(getDb(), state.filters.pending) : null), [state.filters.pending]);
  const waiting = !!state.filters.pending && !pending.data;
  const found = useAsync(
    async () =>
      waiting ? undefined : findPatients(getDb(), { search: query, filters: state.filters, letter: state.letter, offset: state.page * PAGE_SIZE, pending: pending.data ?? undefined }),
    [query, state.filters, state.letter, state.page, pending.data, waiting],
  );
  // Una página que se ha quedado vacía (se han borrado pacientes): a la primera.
  const empty = !!found.data && found.data.rows.length === 0 && state.page > 0;
  useEffect(() => {
    if (empty) setState((s) => ({ ...s, page: 0 }));
  }, [empty]);
  // Si hay algún paciente (para la franja de hoy y la lista vacía) y alguno de verdad (para los avisos).
  const any = useAsync(async () => (await findPatients(getDb(), { limit: 0 })).total > 0, []);
  const own = useAsync(() => hasOwnPatients(getDb(), SEED_PREFIX, QUICK_PATIENT), []);
  const narrowed = !!query.trim() || activeFilters(state.filters) > 0 || state.letter !== null;
  return {
    ...state,
    query,
    narrowed,
    found,
    hasPatients: !!any.data,
    hasOwn: !!own.data,
    setSearch: (search: string) => update({ search }),
    setFilters: (filters: PatientFilters) => update({ filters }),
    setLetter: (letter: string | null) => update({ letter }),
    setPage: (page: number) => setState((s) => ({ ...s, page })),
  };
}

type PatientList = ReturnType<typeof usePatientList>;

function PatientSearch({ list, compact }: { list: PatientList; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const n = activeFilters(list.filters);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="patient-search" className="sr-only">
            Buscar paciente
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-muted" />
          <input
            id="patient-search"
            type="search"
            placeholder={compact ? "Buscar paciente" : "Nombre, tel. o DNI"}
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            className="h-11 w-full rounded-lg border border-transparent bg-surface pr-3 pl-10 text-base placeholder:text-text-muted focus:border-border-input"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={n ? `Filtros (${n} puestos)` : "Filtros"}
          className="tap inline-flex h-11 shrink-0 items-center gap-1 rounded-lg bg-surface px-3 font-semibold text-accent hover:bg-accent-soft"
        >
          <SlidersHorizontal aria-hidden="true" className="size-5" />
          <span className={compact ? "sr-only" : ""}>Filtros</span>
          {n > 0 && <span className="rounded-pill bg-accent px-2 text-sm text-on-accent">{n}</span>}
        </button>
      </div>
      <FilterChips list={list} />
      <FiltersSheet open={open} onClose={() => setOpen(false)} list={list} />
    </div>
  );
}

/** Los filtros puestos, cada uno con su cruz para quitarlo. */
function FilterChips({ list }: { list: PatientList }) {
  const staff = useStaff();
  const f = list.filters;
  const chips: { label: string; clear: Partial<PatientFilters> }[] = [];
  if (f.ageFrom !== null || f.ageTo !== null)
    chips.push({
      label: f.ageFrom !== null && f.ageTo !== null ? `De ${f.ageFrom} a ${f.ageTo} años` : f.ageFrom !== null ? `${f.ageFrom} años o más` : `${f.ageTo} años o menos`,
      clear: { ageFrom: null, ageTo: null },
    });
  if (f.sex) chips.push({ label: sexLabels[f.sex], clear: { sex: null } });
  if (f.physio) chips.push({ label: `Con ${staff.find((s) => s.email === f.physio)?.name ?? f.physio}`, clear: { physio: null } });
  if (f.upcoming) chips.push({ label: "Con cita próxima", clear: { upcoming: false } });
  if (f.lastVisit) chips.push({ label: `Vino: ${LAST_VISITS.find((v) => v.id === f.lastVisit)!.label.toLowerCase()}`, clear: { lastVisit: null } });
  if (f.pending) chips.push({ label: `Pendiente ${PENDINGS.find((v) => v.id === f.pending)!.label.toLowerCase()}`, clear: { pending: null } });
  if (!chips.length) return null;
  return (
    <ul aria-label="Filtros puestos" className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <li key={c.label}>
          <button
            type="button"
            onClick={() => list.setFilters({ ...f, ...c.clear })}
            aria-label={`Quitar el filtro: ${c.label}`}
            className="tap inline-flex max-w-full items-center gap-1 rounded-pill bg-accent-soft px-3 text-sm font-semibold text-accent"
          >
            <span className="truncate">{c.label}</span>
            <X aria-hidden="true" className="size-4 shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Los filtros: edad, sexo, fisio, cita próxima, cuándo vino por última vez y lo pendiente. Se aplican al momento. */
function FiltersSheet({ open, onClose, list }: { open: boolean; onClose: () => void; list: PatientList }) {
  const staff = useStaff();
  const f = list.filters;
  const set = (patch: Partial<PatientFilters>) => list.setFilters({ ...f, ...patch });
  const age = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.min(130, Math.round(Number(v)))));
  const total = list.found.data?.total;
  return (
    <Sheet open={open} onClose={onClose} title="Filtros">
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Edad desde" unit="años" inputMode="numeric" min={0} max={130} value={f.ageFrom ?? ""} onChange={(e) => set({ ageFrom: age(e.target.value) })} />
        <NumberField label="Edad hasta" unit="años" inputMode="numeric" min={0} max={130} value={f.ageTo ?? ""} onChange={(e) => set({ ageTo: age(e.target.value) })} />
      </div>
      <SelectField label="Sexo" value={f.sex ?? ""} onChange={(e) => set({ sex: (e.target.value || null) as Sex | null })}>
        <option value="">Cualquiera</option>
        {Object.entries(sexLabels).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </SelectField>
      {staff.length > 0 && (
        <SelectField label="Fisio" hint="Los que tiene asignados en su ficha; si no tienen a nadie, los que tienen alguna cita suya" value={f.physio ?? ""} onChange={(e) => set({ physio: e.target.value || null })}>
          <option value="">Cualquiera</option>
          {staff.map((s) => (
            <option key={s.email} value={s.email}>
              {s.name}
            </option>
          ))}
        </SelectField>
      )}
      <SelectField label="Última vez que vino" value={f.lastVisit ?? ""} onChange={(e) => set({ lastVisit: (e.target.value || null) as PatientFilters["lastVisit"] })}>
        <option value="">Cualquier día</option>
        {LAST_VISITS.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </SelectField>
      <SelectField label="Con algo pendiente" value={f.pending ?? ""} onChange={(e) => set({ pending: (e.target.value || null) as PatientFilters["pending"] })}>
        <option value="">No mirar</option>
        {PENDINGS.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </SelectField>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5" checked={f.upcoming} onChange={(e) => set({ upcoming: e.target.checked })} />
        <span>Con cita próxima</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onClose}>{total === undefined ? "Ver los pacientes" : total === 1 ? "Ver 1 paciente" : `Ver ${total} pacientes`}</Button>
        {activeFilters(f) > 0 && (
          <Button variant="secondary" onClick={() => list.setFilters(NO_FILTERS)}>
            Quitar los filtros
          </Button>
        )}
      </div>
    </Sheet>
  );
}

/** Ir a los que empiezan por una letra. */
function LetterPicker({ list }: { list: PatientList }) {
  return (
    <SelectField label="Empiezan por" value={list.letter ?? ""} onChange={(e) => list.setLetter(e.target.value || null)}>
      <option value="">Cualquier letra</option>
      {LETTERS.map((l) => (
        <option key={l} value={l}>
          {l === "#" ? "Otro signo o número" : l}
        </option>
      ))}
    </SelectField>
  );
}

/** «1–50 de 340» y las páginas anterior y siguiente. */
function Pager({ list, total }: { list: PatientList; total: number }) {
  if (total <= PAGE_SIZE) return null;
  const from = list.page * PAGE_SIZE + 1;
  const to = Math.min(total, from + PAGE_SIZE - 1);
  const go = (page: number) => {
    list.setPage(page);
    document.getElementById("patient-search")?.scrollIntoView({ block: "nearest" });
  };
  return (
    <nav aria-label="Páginas de pacientes" className="flex items-center justify-between gap-2">
      <Button variant="secondary" disabled={list.page === 0} icon={<ChevronLeft aria-hidden="true" className="size-5" />} onClick={() => go(list.page - 1)}>
        Anteriores
      </Button>
      <span className="text-center text-sm text-text-muted">
        {from}–{to} de {total}
      </span>
      <Button variant="secondary" disabled={to >= total} onClick={() => go(list.page + 1)}>
        Siguientes <ChevronRight aria-hidden="true" className="size-5" />
      </Button>
    </nav>
  );
}

function PatientRows({ list, currentId }: { list: PatientList; currentId?: string | null }) {
  const { query, found } = list;
  const rows = found.data?.rows;
  const byLetter = new Map<string, PatientHit[]>();
  for (const p of rows ?? []) byLetter.set(letter(p.name), [...(byLetter.get(letter(p.name)) ?? []), p]);
  const row = (p: PatientHit) => <PatientRow key={p.id} to={`/pacientes/${p.id}`} name={p.name} meta={meta(p)} active={p.id === currentId} />;
  if (found.error) return <LoadError error={found.error} />;
  if (!rows) return <Loading />;
  const total = found.data!.total;
  // Con muchos pacientes, ir por letras; también si ya se ha elegido una.
  const letters = list.letter !== null || (!list.narrowed && total > PAGE_SIZE) ? <LetterPicker list={list} /> : null;
  if (rows.length === 0) {
    return list.narrowed ? (
      <>
        {letters}
        <p className="py-6 text-center text-text-muted">
          {query.trim() ? `Ningún paciente coincide con «${query.trim()}»` : "Ningún paciente"}
          {activeFilters(list.filters) > 0 || list.letter ? " con estos filtros." : "."}
        </p>
      </>
    ) : (
      <EmptyState icon={Users} title="Todavía no hay pacientes">
        Pulsa «Nuevo» arriba para añadir el primero. Con el nombre basta. ¿Vienes de otro programa?{" "}
        <Link to="/ajustes/importar" className="font-semibold text-accent underline underline-offset-2">
          Trae tus pacientes desde Excel
        </Link>
        .
      </EmptyState>
    );
  }
  const pager = <Pager list={list} total={total} />;
  if (query.trim())
    return (
      <>
        {letters}
        <Group title={total === 1 ? "1 resultado" : `${total} resultados`}>{rows.map(row)}</Group>
        {pager}
      </>
    );
  return (
    <>
      {letters}
      {list.narrowed && <p className="text-sm text-text-muted">{total === 1 ? "1 paciente" : `${total} pacientes`}</p>}
      <div role="list" aria-label="Pacientes" className="flex flex-col gap-4">
        {[...byLetter].map(([l, patients]) => (
          <div role="listitem" key={l}>
            <Group title={l}>{patients.map(row)}</Group>
          </div>
        ))}
      </div>
      {pager}
    </>
  );
}

/** Los avisos (copia de seguridad, instalar en el iPhone, código de recuperación), al final de la lista en el móvil
 * y en el inicio del ordenador: no tapan nada, pero siguen a la vista hasta que se resuelven. */
export function PatientNotices({ hasRealPatients }: { hasRealPatients: boolean }) {
  const cloud = useCloud();
  const info = useAsync(() => getDb().info(), []);
  const lastBackup = useAsync(() => getSetting<string>(getDb(), "last_backup_at"), []);
  return (
    <div className="flex flex-col gap-2 empty:hidden">
      {info.data && !info.data.persistent && (
        <Alert tone="warning" title="Este navegador no guarda los datos">
          Todo se perderá al cerrar la pestaña. Abre la app en Safari o Chrome actualizados.
        </Alert>
      )}
      {/* A quien administra una clínica, hasta que guarde el código de recuperación. */}
      {cloud?.clinic && <RecoveryReminder />}
      {/* En iPhone, Safari puede borrar los datos de una web que no se abre en unos días; instalada, no. */}
      {isIos() && !isStandalone() && (
        <Notice to="/instalar" link="Cómo instalarla">
          Instala la app en este iPhone: si no, Safari puede borrar los pacientes tras unos días sin abrirla.
        </Notice>
      )}
      {/* Con la nube, la copia es automática: no hace falta recordar la de archivo. */}
      {!cloud && <BackupReminder hasRealPatients={hasRealPatients} lastBackup={lastBackup.loading ? undefined : (lastBackup.data ?? null)} />}
    </div>
  );
}

const newPatientLink = (
  <Link to="/pacientes/nuevo" aria-label="Nuevo paciente" className="tap inline-flex items-center justify-center gap-1 rounded-md px-1 font-semibold text-accent hover:bg-surface">
    <Plus aria-hidden="true" className="size-6" /> Nuevo
  </Link>
);

/** S01 Pacientes (el móvil): el buscador, una franja con las citas de hoy (lleva a Agenda › Hoy, donde está lo
 * pendiente) y la lista. Los avisos van al final. */
export function PatientsPage() {
  const list = usePatientList();
  const version = useDataVersion();
  // Las citas de hoy que siguen en pie (sin las anuladas), para la franja.
  const today = useAsync(
    async () => (await agenda(getDb(), `${dayPlus(-1)}T20:00:00Z`, `${dayPlus(1)}T04:00:00Z`)).filter((a) => madridDay(a.startsAt) === dayPlus(0) && a.status !== "cancelled"),
    [version],
  );
  return (
    <Page title="Pacientes" action={newPatientLink}>
      <PatientSearch list={list} />
      {!list.narrowed && list.hasPatients && today.data && <TodayStrip items={today.data} />}
      <PatientRows list={list} />
      {!list.narrowed && <PatientNotices hasRealPatients={list.hasOwn} />}
    </Page>
  );
}

/** El panel fijo del ordenador: «Pacientes», el buscador y la lista, con el paciente abierto marcado. */
export function PatientsPane({ currentId }: { currentId: string | null }) {
  const list = usePatientList();
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl">Pacientes</h2>
        {newPatientLink}
      </div>
      <PatientSearch list={list} compact />
      <PatientRows list={list} currentId={currentId} />
    </div>
  );
}

/** Hoy en una fila: cuántas citas y a quién, y un toque a Agenda › Hoy (allí, atender, cobrar y lo pendiente). */
function TodayStrip({ items }: { items: AgendaItem[] }) {
  const sorted = [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;
  const shown = sorted.slice(0, 3).map((a) => `${hourOf(a.startsAt)} ${first(a.name)}`);
  const more = sorted.length - shown.length;
  return (
    <Link
      to="/agenda?vista=hoy"
      className="flex min-h-14 items-center gap-3 rounded-lg bg-accent-soft px-3 py-2 hover:bg-surface"
    >
      <CalendarCheck aria-hidden="true" className="size-5 shrink-0 text-accent" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">Hoy · {sorted.length === 0 ? "sin citas" : sorted.length === 1 ? "1 cita" : `${sorted.length} citas`}</span>
        <span className="truncate text-sm text-text-muted">
          {sorted.length ? `${shown.join(" · ")}${more > 0 ? ` y ${more} más` : ""}` : "Lo pendiente de la clínica, en la agenda"}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
    </Link>
  );
}

/** Un aviso discreto al final de la lista, con su enlace. */
function Notice({ to, link, children }: { to: string; link: string; children: ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-lg border border-dashed border-border-input px-3 py-2 text-sm text-text-muted">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="flex flex-col items-start">
        <span>{children}</span>
        <Link to={to} className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-2">
          {link}
        </Link>
      </span>
    </p>
  );
}

/** AAAA-MM-DD de hoy más n días, en la hora de Madrid. Se suman días de calendario, no horas: la semana del cambio
 * de hora, sumar 7×24 h cerca de medianoche caía en el día anterior. */
const dayPlus = (n: number) => {
  const d = new Date(`${new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" })}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const BACKUP_EVERY_DAYS = 7;

/** Recordatorio semanal: los datos solo están en este dispositivo. */
function BackupReminder({ hasRealPatients, lastBackup }: { hasRealPatients: boolean; lastBackup: string | null | undefined }) {
  if (!hasRealPatients || lastBackup === undefined) return null;
  const days = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86_400_000) : null;
  if (days !== null && days < BACKUP_EVERY_DAYS) return null;
  return (
    <Notice to="/ajustes/datos" link="Hacer la copia">
      {days === null ? "Todavía no has hecho ninguna copia de seguridad." : `La última copia de seguridad fue hace ${days} días.`} Los datos solo están en este dispositivo.
    </Notice>
  );
}
