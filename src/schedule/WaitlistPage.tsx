// Agenda → Lista de espera (src/data/waitlist.ts): quién quiere un hueco antes, cuándo le viene bien (mañanas,
// tardes o unas horas concretas, qué días), desde qué día puede, si es preferente y, en un equipo, con quién. Se
// ordena (por tiempo de espera, prioridad, cita, ofrecido o nombre) y se filtra por todo eso a la vez; el orden y los
// filtros van en la dirección (?orden=…&franja=…&dias=…), así que se conservan al volver. Desde una cita anulada o
// borrada se llega con el hueco libre (?hueco=…&min=…&con=…): primero salen a quienes les encaja; a cada uno se le
// ofrece por WhatsApp o correo, con el mensaje listo (queda apuntado), y se le da la cita con un toque. Con «Tengo un
// hueco libre» se pone uno a mano. Sin hueco, cada paciente tiene su WhatsApp (el mensaje «Lista de espera» de Ajustes),
// «Dar cita» (y después se pregunta si sale de la lista) y su ficha, que vuelve aquí con los filtros. Desde la ficha se
// llega con ?paciente=… para apuntarlo.
import { ContactNote } from "../privacy/ContactNote";
import { useTeamMode } from "../cloud/teamMode";
import { CalendarClock, CalendarPlus, Mail, MessageCircle, Pencil, Plus, Search, SlidersHorizontal, Trash, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { madridDay } from "../app/format";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { AppointmentSheet } from "../clinical/AppointmentSheet";
import { PatientPicker } from "../clinical/PatientPicker";
import { localInput } from "../clinical/pageKit";
import { clashes, createAppointment, updateAppointment } from "../data/appointments";
import { getDb } from "../data/db";
import { getClinic, mayMessage } from "../data/privacy";
import { getPatient } from "../data/repo";
import type { Staff } from "../data/schedule";
import {
  activeFilters,
  addToWaitlist,
  filterWaitlist,
  fits,
  listWaitlist,
  markOffered,
  minText,
  preferText,
  removeFromWaitlist,
  sortWaitlist,
  updateWaitlist,
  WAIT_SORTS,
  WEEKDAY_NAMES,
  WEEKDAYS,
  type PreferTime,
  type WaitFilters,
  type WaitInput,
  type WaitItem,
  type WaitSort,
} from "../data/waitlist";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { firstName, loadMessages, messageSubject, messageText } from "../messages/templates";
import { useLeaveWaitlist } from "./LeaveWaitlist";
import { appointmentVars, dayText, hourText, mailtoUrl, offerText, waPhone, whatsappUrl } from "./reminders";
import { staffName, useStaff } from "./useStaff";

const waiting = (iso: string) => {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days < 1 ? "Esperando desde hoy" : days === 1 ? "Esperando desde ayer" : `Esperando desde hace ${days} días`;
};
const link = "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold";
const longDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" });

const WAITED: [number, string][] = [
  [7, "Más de una semana"],
  [14, "Más de dos semanas"],
  [30, "Más de un mes"],
];

/** El orden y los filtros, leídos de la dirección. */
function readView(p: URLSearchParams): { sort: WaitSort; filters: WaitFilters } {
  const sort = WAIT_SORTS.some((x) => x.id === p.get("orden")) ? (p.get("orden") as WaitSort) : "espera";
  const pick = <T extends string>(key: string, ok: readonly T[]) => (ok.includes(p.get(key) as T) ? (p.get(key) as T) : null);
  return {
    sort,
    filters: {
      q: p.get("q") ?? "",
      band: pick("franja", ["manana", "tarde"] as const),
      days: (p.get("dias") ?? "").split(",").map(Number).filter((d) => d >= 1 && d <= 7),
      who: p.get("fisio") || null,
      priority: p.get("pref") === "1",
      offered: pick("ofrecido", ["si", "no"] as const),
      cita: pick("cita", ["si", "no"] as const),
      ready: p.get("ya") === "1",
      minDays: WAITED.some(([d]) => d === Number(p.get("espera"))) ? Number(p.get("espera")) : null,
    },
  };
}

export function WaitlistPage() {
  const { team } = useTeamMode();
  const location = useLocation();
  /** Dar cita a alguien de la lista (sin un hueco concreto) y, después, preguntar si sale de ella. */
  const [booking, setBooking] = useState<WaitItem | null>(null);
  const leave = useLeaveWaitlist();
  /** «Tengo un hueco libre»: ponerlo a mano para ver a quién le encaja. */
  const [settingSlot, setSettingSlot] = useState(false);
  const staff = useStaff();
  const toast = useToast();
  const navigate = useNavigate();
  const version = useDataVersion();
  const [params, setParams] = useSearchParams();
  const slot = params.get("hueco");
  const slotMinutes = Number(params.get("min")) || 45;
  const slotWho = params.get("con") || null;
  const free = slot && !Number.isNaN(Date.parse(slot)) && Date.parse(slot) > Date.now() ? slot : null;
  const forPatient = params.get("paciente");
  const data = useAsync(async () => {
    const db = getDb();
    const [items, clinic, patient, messages] = await Promise.all([listWaitlist(db, free && team ? slotWho : undefined), getClinic(db), forPatient ? getPatient(db, forPatient) : null, loadMessages(db)]);
    return { items, clinic: clinic.name, patient, messages, today: madridDay(new Date().toISOString()) };
  }, [version, free, slotWho, team, forPatient]);
  /** Añadir (sin `item`) o cambiar una entrada. */
  const [form, setForm] = useState<{ item?: WaitItem } | null>(null);
  const [filtering, setFiltering] = useState(false);
  const { sort, filters } = readView(params);
  /** Cambia (o quita, con null) varios datos de la dirección sin tocar los demás. */
  const setView = (change: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(change)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );
  const clearFilters = () => setView({ q: null, franja: null, dias: null, fisio: null, pref: null, ofrecido: null, cita: null, ya: null, espera: null });

  const [giving, setGiving] = useState<string | null>(null);
  /** Ya tiene una cita más tarde: ¿se anula al darle este hueco? */
  const [asking, setAsking] = useState<WaitItem | null>(null);

  async function give(w: WaitItem, cancelOld?: boolean) {
    if (giving) return;
    if (cancelOld === undefined && w.nextId && w.nextAt && w.nextAt > free!) return setAsking(w);
    setAsking(null);
    setGiving(w.id);
    try {
      const db = getDb();
      // Otro dispositivo (o un toque doble) puede haberlo dado ya.
      const taken = await clashes(db, free!, slotMinutes, team ? slotWho : undefined);
      if (taken.length) {
        toast(`Ese hueco ya está ocupado: ${taken.map((t) => t.name).join(", ")}`, "danger");
        return;
      }
      await createAppointment(db, w.patientId, { startsAt: free!, minutes: slotMinutes, ...(team ? { assignedTo: slotWho } : {}) });
      if (cancelOld && w.nextId) await updateAppointment(db, w.nextId, { status: "cancelled" });
      await removeFromWaitlist(db, w.id);
      bumpData();
      toast(`Cita dada a ${w.name}: ${dayText(free!)}, ${hourText(free!)}${cancelOld ? " (anulada la de después)" : ""}`, "success");
      // Sin volver a este hueco con «atrás»: ya no está libre.
      navigate(`/agenda?dia=${madridDay(free!)}`, { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    } finally {
      setGiving(null);
    }
  }
  async function offered(w: WaitItem) {
    await markOffered(getDb(), w.id);
    bumpData();
  }

  // Todos (sin quien dejó el hueco), filtrados y en el orden elegido; con un hueco libre, primero a quienes les encaja.
  const all = (data.data?.items ?? []).filter((w) => !free || w.patientId !== params.get("sin"));
  const sorted = sortWaitlist(filterWaitlist(all, filters), sort);
  const items = free ? [...sorted].sort((a, b) => Number(fits(b, free, slotMinutes)) - Number(fits(a, free, slotMinutes))) : sorted;
  const nFilters = activeFilters(filters);
  const chips = filterChips(filters, team ? staff : [], setView);
  const patient = data.data?.patient;
  const already = patient ? all.find((w) => w.patientId === patient.id) : undefined;
  const opening = !!patient && !already && !form;

  return (
    <Page title="Lista de espera" backTo="/agenda">
      {free ? (
        <div className="flex flex-col gap-2">
          <Alert tone="info" title={`Hueco libre: ${dayText(free)}, a las ${hourText(free)}`}>
            {team && slotWho ? `Con ${staffName(staff, slotWho)}. ` : ""}Primero salen a quienes les encaja. Ofrécelo; si dice que sí, dale la cita aquí.
          </Alert>
          <Button variant="secondary" size="sm" className="self-start" icon={<X aria-hidden="true" className="size-4" />} onClick={() => setView({ hueco: null, min: null, con: null, sin: null })}>
            Ver la lista sin este hueco
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-muted">
            Apunta a quien quiere venir antes o espera un hueco, con cuándo le viene bien. Cuando se anule una cita, la app te enseñará esta lista para ofrecérselo.
          </p>
          {data.data && data.data.items.length > 0 && (
            <Button variant="secondary" className="self-start" icon={<CalendarClock aria-hidden="true" className="size-5" />} onClick={() => setSettingSlot(true)}>
              Tengo un hueco libre
            </Button>
          )}
        </div>
      )}

      {data.data && all.length === 0 && <p className="text-sm text-text-muted">No hay nadie esperando.</p>}
      {all.length > 0 && (
        <section aria-label="Ordenar y filtrar" className="flex flex-col gap-2">
          <div className="relative">
            <label htmlFor="waitlist-search" className="sr-only">
              Buscar en la lista de espera
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-muted" />
            <input
              id="waitlist-search"
              type="search"
              placeholder="Buscar por nombre, nota o teléfono"
              value={filters.q ?? ""}
              onChange={(e) => setView({ q: e.target.value })}
              className="h-11 w-full rounded-lg border border-transparent bg-surface pr-3 pl-10 text-base placeholder:text-text-muted focus:border-border-input"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <SelectField label="Ordenar por" value={sort} onChange={(e) => setView({ orden: e.target.value === "espera" ? null : e.target.value })}>
                {WAIT_SORTS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <Button variant="secondary" icon={<SlidersHorizontal aria-hidden="true" className="size-5" />} onClick={() => setFiltering(true)}>
              {nFilters ? `Filtros (${nFilters})` : "Filtros"}
            </Button>
          </div>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtros puestos">
              {chips.map((c) => (
                <button key={c.label} type="button" aria-label={`Quitar el filtro: ${c.label}`} onClick={c.clear} className="inline-flex min-h-11 items-center gap-1 rounded-pill border border-accent bg-accent-soft px-3 text-sm font-semibold text-accent">
                  {c.label} <X aria-hidden="true" className="size-4" />
                </button>
              ))}
              <button type="button" onClick={clearFilters} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-accent underline underline-offset-2">
                Quitar todos
              </button>
            </div>
          )}
          <p className="text-sm text-text-muted" aria-live="polite">
            {items.length === all.length ? `${all.length === 1 ? "1 paciente" : `${all.length} pacientes`} esperando` : `${items.length} de ${all.length} pacientes`}
          </p>
          {items.length === 0 && (
            <p className="text-sm">
              Nadie cumple estos filtros.{" "}
              <button type="button" onClick={clearFilters} className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-2">
                Quitar los filtros
              </button>
            </p>
          )}
        </section>
      )}
      <ul aria-label="Lista de espera" className="flex flex-col gap-2">
        {items.map((w) => {
          const phone = waPhone(w.phone);
          const vars = { name: w.name, startsAt: free ?? "", clinic: data.data!.clinic, professional: team && slotWho ? staffName(staff, slotWho) : null };
          const text = free ? offerText(vars, data.data!.messages) : "";
          // Sin un hueco concreto: el mensaje «Lista de espera» de la clínica, para contarle el que tengas.
          const general = free ? "" : messageText("espera", data.data!.messages, { nombre: firstName(w.name), clinica: data.data!.clinic });
          const ok = free ? fits(w, free, slotMinutes) : null;
          const later = w.availableFrom && w.availableFrom > data.data!.today ? w.availableFrom : null;
          return (
            <li key={w.id}>
              <Card role="group" aria-label={w.name} className={cx("flex flex-col gap-2", ok === false && "opacity-80")}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold">{w.name}</p>
                  <p className="text-sm text-text-muted">{waiting(w.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {w.priority && <span className="rounded-full bg-warning-soft px-2 py-0.5 font-semibold">Preferente</span>}
                  <span className="rounded-full bg-surface px-2 py-0.5">{preferText(w)}</span>
                  {later && <span className="rounded-full bg-surface px-2 py-0.5">Puede desde el {longDay(later)}</span>}
                  {ok === true && <span className="rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">Le encaja este hueco</span>}
                  {ok === false && <span className="rounded-full bg-warning-soft px-2 py-0.5">No es su horario</span>}
                  {w.offeredAt && <span className="rounded-full bg-accent-soft px-2 py-0.5">Ofrecido el {dayText(w.offeredAt)}, {hourText(w.offeredAt)}</span>}
                </div>
                {w.note && <p className="text-sm">{w.note}</p>}
                <p className="text-sm text-text-muted">
                  {[team && (w.assignedTo ? `Con ${staffName(staff, w.assignedTo)}` : "Con cualquiera"), w.nextAt ? `Su próxima cita: ${dayText(w.nextAt)}, ${hourText(w.nextAt)}` : "Sin cita pendiente"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {free ? (
                  <div className="flex flex-wrap gap-2">
                    {mayMessage(w.contact) && phone && (
                      <a
                        href={whatsappUrl(phone, text)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cx(link, "bg-accent text-on-accent hover:bg-accent-hover")}
                        onClick={() => void offered(w)}
                      >
                        <MessageCircle aria-hidden="true" className="size-5" /> Ofrecer por WhatsApp
                      </a>
                    )}
                    {mayMessage(w.contact) && w.email && (
                      <a href={mailtoUrl(w.email, messageSubject("hueco", data.data!.messages, appointmentVars(vars)), text)} className={cx(link, "border border-border bg-bg hover:bg-surface")} onClick={() => void offered(w)}>
                        <Mail aria-hidden="true" className="size-5" /> Correo
                      </a>
                    )}
                    {mayMessage(w.contact) ? (
                      !phone && !w.email && <p className="text-sm text-text-muted">Llámale{w.phone ? `: ${w.phone}` : ""}.</p>
                    ) : (
                      <ContactNote contact={w.contact} patientId={w.patientId} extra={`Llámale${w.phone ? `: ${w.phone}` : ""}`} className="w-full" />
                    )}
                    <Button variant="secondary" loading={giving === w.id} icon={<CalendarPlus aria-hidden="true" className="size-5" />} onClick={() => void give(w)}>
                      Darle la cita
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {mayMessage(w.contact) && phone && (
                      <a href={whatsappUrl(phone, general)} target="_blank" rel="noopener noreferrer" className={cx(link, "bg-accent text-on-accent hover:bg-accent-hover")} onClick={() => void offered(w)}>
                        <MessageCircle aria-hidden="true" className="size-5" /> WhatsApp
                      </a>
                    )}
                    {mayMessage(w.contact) && w.email && (
                      <a href={mailtoUrl(w.email, messageSubject("espera", data.data!.messages, { nombre: firstName(w.name), clinica: data.data!.clinic }), general)} className={cx(link, "border border-border bg-bg hover:bg-surface")} onClick={() => void offered(w)}>
                        <Mail aria-hidden="true" className="size-5" /> Correo
                      </a>
                    )}
                    {mayMessage(w.contact) ? (
                      !phone && !w.email && <p className="text-sm text-text-muted">Llámale{w.phone ? `: ${w.phone}` : ""}.</p>
                    ) : (
                      <ContactNote contact={w.contact} patientId={w.patientId} extra={`Llámale${w.phone ? `: ${w.phone}` : ""}`} className="w-full" />
                    )}
                    <Button variant="secondary" icon={<CalendarPlus aria-hidden="true" className="size-5" />} onClick={() => setBooking(w)}>
                      Dar cita
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  <Link
                    to={`/pacientes/${w.patientId}`}
                    state={{ from: `${location.pathname}${location.search}` }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-1 text-sm font-semibold text-accent hover:bg-accent-soft"
                  >
                    <UserRound aria-hidden="true" className="size-4" /> Ver ficha
                  </Link>
                  <Button size="sm" variant="ghost" icon={<Pencil aria-hidden="true" className="size-4" />} onClick={() => setForm({ item: w })}>
                    Cambiar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash aria-hidden="true" className="size-4" />}
                    onClick={async () => {
                      await removeFromWaitlist(getDb(), w.id);
                      bumpData();
                      toast(`${w.name}: fuera de la lista`, "success");
                    }}
                  >
                    Quitar de la lista
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <Button variant={free ? "secondary" : "primary"} icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => setForm({})}>
        Añadir a la lista
      </Button>

      <Sheet open={!!asking} onClose={() => setAsking(null)} title={asking ? `${asking.name} ya tiene cita` : ""}>
        {asking && (
          <>
            <p>
              Tiene cita el {dayText(asking.nextAt!)}, a las {hourText(asking.nextAt!)}. Al darle el hueco del {dayText(free!)}, a las {hourText(free!)}, ¿qué hacemos con esa?
            </p>
            <Button block onClick={() => void give(asking, true)}>
              Anularla (adelanta su cita)
            </Button>
            <Button variant="secondary" block onClick={() => void give(asking, false)}>
              Mantener las dos
            </Button>
          </>
        )}
      </Sheet>
      <Sheet
        open={!!form || opening}
        onClose={() => {
          setForm(null);
          if (forPatient) setView({ paciente: null });
        }}
        title={form?.item ? `Lista de espera: ${form.item.name}` : "Añadir a la lista de espera"}
      >
        {(form || opening) && (
          <WaitForm
            team={team}
            staff={staff}
            item={form?.item}
            patient={!form?.item && patient ? { id: patient.id, name: patient.name } : null}
            onSave={async (patientId, input) => {
              if (form?.item) await updateWaitlist(getDb(), form.item.id, input);
              else await addToWaitlist(getDb(), patientId, input);
              setForm(null);
              if (forPatient) setView({ paciente: null });
              bumpData();
              toast(form?.item ? "Cambiado" : "Añadido a la lista de espera", "success");
            }}
          />
        )}
      </Sheet>
      <AppointmentSheet
        open={!!booking}
        onClose={() => setBooking(null)}
        patientId={booking?.patientId}
        patientName={booking?.name}
        appointment={null}
        person={team && booking?.assignedTo ? booking.assignedTo : undefined}
        onCreated={(id) => void leave.ask(id)}
      />
      {leave.sheet}
      <Sheet open={settingSlot} onClose={() => setSettingSlot(false)} title="Tengo un hueco libre">
        {settingSlot && (
          <SlotForm
            team={team}
            staff={staff}
            onSet={(iso, minutes, who) => {
              setSettingSlot(false);
              setView({ hueco: iso, min: String(minutes), con: who, sin: null });
            }}
          />
        )}
      </Sheet>
      <Sheet open={filtering} onClose={() => setFiltering(false)} title="Filtrar la lista de espera">
        <FilterForm filters={filters} team={team} staff={staff} setView={setView} />
        <Button block onClick={() => setFiltering(false)}>
          {items.length === 1 ? "Ver 1 paciente" : `Ver ${items.length} pacientes`}
        </Button>
        {nFilters > 0 && (
          <Button variant="secondary" block onClick={clearFilters}>
            Quitar los filtros
          </Button>
        )}
      </Sheet>
    </Page>
  );
}

type SetView = (change: Record<string, string | null>) => void;

/** Un hueco puesto a mano: día y hora, cuánto dura y, en un equipo, con quién. */
function SlotForm({ team, staff, onSet }: { team: boolean; staff: Staff[]; onSet: (iso: string, minutes: number, who: string | null) => void }) {
  // Por defecto, la próxima hora en punto.
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return localInput(d.toISOString());
  });
  const [minutes, setMinutes] = useState("45");
  const [who, setWho] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const t = Date.parse(when);
        if (Number.isNaN(t)) return setError("Pon el día y la hora del hueco.");
        if (t <= Date.now()) return setError("El hueco tiene que ser más adelante que ahora.");
        onSet(new Date(when).toISOString(), Number(minutes), team && who ? who : null);
      }}
    >
      <p className="text-sm text-text-muted">Primero saldrán a quienes les encaja ese día y a esa hora, con el WhatsApp listo para ofrecérselo.</p>
      <TextField label="Día y hora" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      <SelectField label="Cuánto dura" value={minutes} onChange={(e) => setMinutes(e.target.value)}>
        {["30", "45", "60", "90"].map((m) => (
          <option key={m} value={m}>
            {m} minutos
          </option>
        ))}
      </SelectField>
      {team && (
        <SelectField label="Con quién" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Con cualquiera</option>
          {staff.map((x) => (
            <option key={x.email} value={x.email}>
              {x.name}
            </option>
          ))}
        </SelectField>
      )}
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" block>
        Ver a quién le encaja
      </Button>
    </form>
  );
}

/** Lo filtrado, en palabras, cada uno con cómo quitarlo. */
function filterChips(f: WaitFilters, staff: Staff[], setView: SetView): { label: string; clear: () => void }[] {
  const out: { label: string; clear: () => void }[] = [];
  if (f.q?.trim()) out.push({ label: `«${f.q.trim()}»`, clear: () => setView({ q: null }) });
  if (f.band) out.push({ label: f.band === "manana" ? "Mañanas" : "Tardes", clear: () => setView({ franja: null }) });
  if (f.days?.length) {
    const names = f.days.map((d) => WEEKDAY_NAMES[d - 1]!);
    const text = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} o ${names.at(-1)}`;
    out.push({ label: text.charAt(0).toUpperCase() + text.slice(1), clear: () => setView({ dias: null }) });
  }
  if (f.who) out.push({ label: `Puede con ${staffName(staff, f.who)}`, clear: () => setView({ fisio: null }) });
  if (f.priority) out.push({ label: "Preferentes", clear: () => setView({ pref: null }) });
  if (f.ready) out.push({ label: "Ya pueden venir", clear: () => setView({ ya: null }) });
  if (f.offered) out.push({ label: f.offered === "no" ? "Sin ofrecer" : "Ya ofrecido", clear: () => setView({ ofrecido: null }) });
  if (f.cita) out.push({ label: f.cita === "no" ? "Sin cita" : "Con cita", clear: () => setView({ cita: null }) });
  if (f.minDays) out.push({ label: `${WAITED.find(([d]) => d === f.minDays)?.[1] ?? ""} esperando`, clear: () => setView({ espera: null }) });
  return out;
}

/** Una fila de opciones que se marcan con un toque (una sola, o varias con `multi`). */
function Choices<T extends string>({ legend, hint, options, value, onChange, name }: { legend: string; hint?: string; options: [T, string][]; value: T; onChange: (v: T) => void; name: string }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="pb-1 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, label]) => (
          <label key={v} className="relative">
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} className="peer sr-only" />
            <span className={chip(value === v)}>{label}</span>
          </label>
        ))}
      </div>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </fieldset>
  );
}

/** La hoja de filtros: cada cambio se ve al momento en la lista (y en la dirección). */
function FilterForm({ filters: f, team, staff, setView }: { filters: WaitFilters; team: boolean; staff: { email: string; name: string }[]; setView: SetView }) {
  const days = f.days ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Choices
        legend="Franja"
        name="filtro-franja"
        hint="Quien puede a cualquier hora sale en las dos."
        options={[["", "Cualquiera"], ["manana", "Mañanas"], ["tarde", "Tardes"]]}
        value={f.band ?? ""}
        onChange={(v) => setView({ franja: v || null })}
      />
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="pb-1 text-sm font-semibold">Días</legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Días que puede">
          {WEEKDAYS.map((d, i) => (
            <label key={d} className="relative">
              <input
                type="checkbox"
                aria-label={`Puede el ${WEEKDAY_NAMES[i]}`}
                checked={days.includes(i + 1)}
                onChange={() => {
                  const next = days.includes(i + 1) ? days.filter((x) => x !== i + 1) : [...days, i + 1].sort();
                  setView({ dias: next.length ? next.join(",") : null });
                }}
                className="peer sr-only"
              />
              <span aria-hidden="true" className={chip(days.includes(i + 1))}>
                {d}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-text-muted">Con varios días, los que pueden alguno de ellos. Quien puede cualquier día sale siempre.</p>
      </fieldset>
      {team && (
        <SelectField label="Puede con" hint="Los que esperan a esa persona y los que van con cualquiera." value={f.who ?? ""} onChange={(e) => setView({ fisio: e.target.value || null })}>
          <option value="">Todo el equipo</option>
          {staff.map((s) => (
            <option key={s.email} value={s.email}>
              {s.name}
            </option>
          ))}
        </SelectField>
      )}
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="pb-1 text-sm font-semibold">Solo</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["pref", "Preferentes", f.priority],
              ["ya", "Ya pueden venir", f.ready],
            ] as const
          ).map(([key, label, on]) => (
            <label key={key} className="relative">
              <input type="checkbox" checked={!!on} onChange={() => setView({ [key]: on ? null : "1" })} className="peer sr-only" />
              <span className={chip(!!on)}>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Choices
        legend="Ofrecido"
        name="filtro-ofrecido"
        options={[["", "Todos"], ["no", "Sin ofrecer"], ["si", "Ya ofrecido"]]}
        value={f.offered ?? ""}
        onChange={(v) => setView({ ofrecido: v || null })}
      />
      <Choices
        legend="Cita"
        name="filtro-cita"
        hint="Con cita: quieren adelantarla."
        options={[["", "Todos"], ["no", "Sin cita"], ["si", "Con cita"]]}
        value={f.cita ?? ""}
        onChange={(v) => setView({ cita: v || null })}
      />
      <Choices
        legend="Lleva esperando"
        name="filtro-espera"
        options={[["", "Cualquier tiempo"], ...WAITED.map(([d, label]): [string, string] => [String(d), label])]}
        value={f.minDays ? String(f.minDays) : ""}
        onChange={(v) => setView({ espera: v || null })}
      />
    </div>
  );
}

const chip = (on: boolean) =>
  cx(
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill border px-3 text-sm",
    on ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border-input bg-bg",
    "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
  );

function WaitForm({
  team,
  staff,
  item,
  patient,
  onSave,
}: {
  team: boolean;
  staff: { email: string; name: string }[];
  item?: WaitItem;
  patient: { id: string; name: string } | null;
  onSave: (patientId: string, input: WaitInput) => Promise<void>;
}) {
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(item ? { id: item.patientId, name: item.name } : patient);
  const [note, setNote] = useState(item?.note ?? "");
  const [who, setWho] = useState(item?.assignedTo ?? "");
  const ranged = item?.fromMin != null && item?.toMin != null;
  /** La franja, o «horas» con unas horas concretas. */
  const [time, setTime] = useState<PreferTime | "horas">(ranged ? "horas" : (item?.preferTime ?? ""));
  const [from, setFrom] = useState(ranged ? minText(item.fromMin!) : "16:00");
  const [to, setTo] = useState(ranged ? minText(item.toMin!) : "20:00");
  const [days, setDays] = useState<number[]>(item?.preferDays ?? []);
  const [since, setSince] = useState(item?.availableFrom ?? "");
  const [priority, setPriority] = useState(item?.priority ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!picked) return setError("Elige el paciente.");
        setBusy(true);
        setError(null);
        try {
          const minutes = (hhmm: string) => (/^\d{2}:\d{2}$/.test(hhmm) ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) : null);
          const hours = time === "horas" ? { fromMin: minutes(from), toMin: minutes(to) === 0 ? 1440 : minutes(to) } : { fromMin: null, toMin: null };
          if (time === "horas" && (hours.fromMin === null || hours.toMin === null)) throw new RangeError("Pon desde qué hora y hasta qué hora le viene bien.");
          await onSave(picked.id, {
            note,
            assignedTo: who || null,
            preferTime: time === "horas" ? "" : time,
            preferDays: days,
            priority,
            availableFrom: since || null,
            ...hours,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {item ? null : (
        <PatientPicker
          picked={picked}
          onPick={(p) => {
            setPicked(p);
            setError(null);
          }}
        />
      )}
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="pb-1 text-sm font-semibold">Cuándo le viene bien</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["", "Cualquier hora"],
              ["manana", "Mañanas"],
              ["tarde", "Tardes"],
              ["horas", "Horas concretas"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="relative">
              <input type="radio" name="franja" checked={time === v} onChange={() => setTime(v)} className="peer sr-only" />
              <span className={chip(time === v)}>{label}</span>
            </label>
          ))}
        </div>
        {time === "horas" && (
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Desde" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
            <TextField label="Hasta" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Días">
          {WEEKDAYS.map((d, i) => (
            <label key={d} className="relative">
              <input
                type="checkbox"
                aria-label={WEEKDAY_NAMES[i]}
                checked={days.includes(i + 1)}
                onChange={() => setDays(days.includes(i + 1) ? days.filter((x) => x !== i + 1) : [...days, i + 1])}
                className="peer sr-only"
              />
              <span aria-hidden="true" className={chip(days.includes(i + 1))}>
                {d}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-text-muted">Sin días marcados: cualquier día. Mañanas, hasta las 14:00.</p>
      </fieldset>
      <TextField label="Puede a partir del (opcional)" type="date" value={since} onChange={(e) => setSince(e.target.value)} hint="Si ahora no puede venir: un viaje, una operación… Hasta ese día no le encaja ningún hueco." />
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" checked={priority} onChange={(e) => setPriority(e.target.checked)} className="mt-1 size-5 shrink-0 accent-accent" />
        <span>
          <span className="font-semibold">Preferente</span>
          <span className="block text-sm text-text-muted">Pasa delante al ordenar por prioridad: dolor agudo, postoperatorio…</span>
        </span>
      </label>
      <TextField label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Quiere adelantar su cita, solo a partir de las 18:00…" />
      {team && (
        <SelectField label="Con quién" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Con cualquiera</option>
          {staff.map((s) => (
            <option key={s.email} value={s.email}>
              {s.name}
            </option>
          ))}
        </SelectField>
      )}
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" block loading={busy}>
        {item ? "Guardar" : "Añadir a la lista"}
      </Button>
    </form>
  );
}
