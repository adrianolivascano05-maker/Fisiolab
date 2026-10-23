import { CalendarCheck, ChevronRight, Info, Plus, Search, Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { fmtDate, madridDay } from "../app/format";
import { useCloud } from "../cloud/CloudGate";
import { RecoveryReminder } from "../cloud/RecoveryParts";
import { LoadError, Loading, Page } from "../app/Page";
import { isIos, isStandalone } from "../app/pwa";
import { useAsync } from "../app/useAsync";
import { fmtVisit } from "../clinical/calendar";
import { useDataVersion } from "../app/dataVersion";
import { getDb } from "../data/db";
import { getSetting, listPatients, matchesPatient, QUICK_PATIENT, type PatientSummary } from "../data/repo";
import { agenda, type AgendaItem } from "../data/appointments";
import { SEED_PREFIX } from "../data/seed";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";
import { Group } from "../ui/Grouped";
import { PatientRow } from "../ui/ListItem";

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
function meta(p: PatientSummary) {
  if (p.nextAt) return `Próxima cita: ${when(p.nextAt)}`;
  if (p.lastAt) return `Última visita: ${fmtDate(p.lastAt)}`;
  return "Sin visitas todavía";
}

/** Primera letra para las secciones (sin tildes; «#» si no es una letra). */
function letter(name: string) {
  const c = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().charAt(0).toUpperCase();
  return /[A-ZÑ]/.test(c) ? c : "#";
}

/** El buscador y la lista (por letras, como los contactos del móvil; buscando, los resultados). */
function usePatientList() {
  const [search, setSearch] = useState("");
  const version = useDataVersion();
  // La lista se carga una vez (y cuando cambian los datos) y se filtra aquí: buscar no consulta la base en cada tecla.
  const all = useAsync(() => listPatients(getDb()), [version]);
  const found = useMemo(() => all.data?.filter((p) => matchesPatient(p, search)), [all.data, search]);
  const own = all.data?.filter((p) => !p.name.startsWith(SEED_PREFIX) && p.name !== QUICK_PATIENT) ?? [];
  return { search, setSearch, all, found, own, hasPatients: (all.data?.length ?? 0) > 0 };
}

type PatientList = ReturnType<typeof usePatientList>;

function PatientSearch({ list, compact }: { list: PatientList; compact?: boolean }) {
  return (
    <div className="relative">
      <label htmlFor="patient-search" className="sr-only">
        Buscar paciente
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-muted" />
      <input
        id="patient-search"
        type="search"
        placeholder={compact ? "Buscar paciente" : "Buscar por nombre, teléfono o motivo"}
        value={list.search}
        onChange={(e) => list.setSearch(e.target.value)}
        className="h-11 w-full rounded-lg border border-transparent bg-surface pr-3 pl-10 text-base placeholder:text-text-muted focus:border-border-input"
      />
    </div>
  );
}

function PatientRows({ list, currentId }: { list: PatientList; currentId?: string | null }) {
  const { search, all, found } = list;
  const byLetter = new Map<string, PatientSummary[]>();
  for (const p of found ?? []) byLetter.set(letter(p.name), [...(byLetter.get(letter(p.name)) ?? []), p]);
  const row = (p: PatientSummary) => <PatientRow key={p.id} to={`/pacientes/${p.id}`} name={p.name} meta={meta(p)} active={p.id === currentId} />;
  if (all.error) return <LoadError error={all.error} />;
  if (!found) return <Loading />;
  if (found.length === 0) {
    return search ? (
      <p className="py-6 text-center text-text-muted">Ningún paciente coincide con «{search}».</p>
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
  if (search) return <Group title="Resultados">{found.map(row)}</Group>;
  return (
    <div role="list" aria-label="Pacientes" className="flex flex-col gap-4">
      {[...byLetter].map(([l, patients]) => (
        <div role="listitem" key={l}>
          <Group title={l}>{patients.map(row)}</Group>
        </div>
      ))}
    </div>
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
      {!list.search && list.hasPatients && today.data && <TodayStrip items={today.data} />}
      <PatientRows list={list} />
      {!list.search && <PatientNotices hasRealPatients={list.own.length > 0} />}
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
