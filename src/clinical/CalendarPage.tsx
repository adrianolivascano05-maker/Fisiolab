// Ficha › Calendario: lo de este paciente en un mes. Sus citas (todas: pendientes, atendidas, «No vino», anuladas), las
// sesiones apuntadas en días sin cita, la reevaluación prevista y sus eventos (una operación, sus entrenamientos, un
// partido, una prueba médica, un viaje: src/data/patientEvents.ts). Se filtra por «Citas» o «Eventos»; al tocar un día
// se ve lo de ese día y se le puede dar cita o apuntar algo. El mes, el día y el filtro van en la dirección
// (?mes=2026-11&dia=2026-11-12&ver=citas): al volver de una sesión, se sigue donde se estaba.
import { CalendarCheck, CalendarPlus, ChevronLeft, ChevronRight, ClipboardCheck, Mail, MessageCircle, NotebookPen, Plus, Printer, Repeat, Send } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { addDays, todayDay } from "../app/dates";
import { useAsync } from "../app/useAsync";
import { appointmentsOf, STATUS_LABELS, type Appointment } from "../data/appointments";
import { sessionDays } from "../data/clinical";
import { getDb } from "../data/db";
import {
  AWAY_KINDS,
  dayLong,
  eventName,
  eventSpan,
  eventTime,
  isDay,
  kindLabel,
  listPatientEvents,
  visitsInEvents,
  WEEKDAY_SHORT,
  weekdayName,
  type Occurrence,
  type PatientEvent,
} from "../data/patientEvents";
import { getPatient } from "../data/repo";
import { getClinic, mayMessage } from "../data/privacy";
import { firstName, loadMessages, messageSubject, messageText, withSignature } from "../messages/templates";
import { ContactNote } from "../privacy/ContactNote";
import { mailtoUrl, waPhone, whatsappUrl } from "../schedule/reminders";
import { upcomingLines, upcomingOf } from "../schedule/upcoming";
import { fmtVisit } from "./calendar";
import { staffName, useStaff } from "../schedule/useStaff";
import { useLeaveWaitlist } from "../schedule/LeaveWaitlist";
import { Alert } from "../ui/Alert";
import { Button, IconButton } from "../ui/Button";
import { cx } from "../ui/cx";
import { AppointmentSheet } from "./AppointmentSheet";
import { KIND_ICON } from "./eventIcons";
import { EventSheet, VisitList } from "./EventSheet";
import { Guard, localInput } from "./pageKit";
import { PatientShell } from "./PatientShell";
import {
  addMonths,
  calendarItems,
  chipsOf,
  countText,
  FAMILIES,
  familyOf,
  monthCounts,
  isMonth,
  leadingBlanks,
  monthAgenda,
  monthDays,
  monthTitle,
  seriesIn,
  spanStep,
  type CalFilter,
  type CalItem,
  type ChipTone,
} from "./patientCalendar";
import { closuresBetween } from "../data/closures";
import { loadPatientPlans, phaseOnDay } from "../data/cycles";
import { phaseChip, phaseSolid } from "./cycles/phaseColors";
import { atMinutes } from "../schedule/layout";

// Cada cosa del mes, con su color y su palabra (docs/rediseno-sencilla.md, «Colores»): la cita pendiente, en el verde
// de lo que se toca; lo ya hecho, en gris; a la que no vino y lo médico, en rojo; viajes, deporte y otros, cada uno el suyo.
const CHIP: Record<ChipTone, string> = {
  visit: "bg-accent text-on-accent",
  done: "bg-done-soft text-done",
  missed: "border border-danger text-danger",
  review: "bg-warning-soft text-warning",
  medical: "bg-kind-medical-soft text-kind-medical",
  travel: "bg-kind-travel-soft text-kind-travel",
  sport: "bg-kind-sport-soft text-kind-sport",
  other: "bg-kind-other-soft text-kind-other",
};
/** Los filtros del mes: en la dirección, `ver=…` (los de antes, «citas» y «eventos», siguen valiendo). */
const PARAM: Record<CalFilter, string | null> = { all: null, visits: "citas", events: "eventos", medical: "medico", travel: "viajes", sport: "deporte", other: "otros" };
const FILTER_OF = Object.fromEntries(Object.entries(PARAM).filter(([, v]) => v).map(([k, v]) => [v, k])) as Record<string, CalFilter>;
const iconLink = "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-accent hover:bg-surface";
/** «Una cita cae durante su viaje», «2 citas caen el día de su operación»… */
const awayTitle = (away: { hits: Occurrence[] }[]) => {
  const kinds = new Set(away.flatMap((x) => x.hits.map((h) => h.event.kind)));
  const when = kinds.has("travel") && kinds.has("surgery") ? "durante un viaje o el día de su operación" : kinds.has("travel") ? "durante su viaje" : "el día de su operación";
  return `${away.length === 1 ? "Una cita cae" : `${away.length} citas caen`} ${when}`;
};
/** «Viaje a Roma» o «Viaje a Roma y Operación» (lo que pisa una cita, sin repetir). */
const hitNames = (hits: Occurrence[]) => {
  const names = [...new Set(hits.map((h) => eventName(h.event)))];
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
};

export function CalendarPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const today = todayDay();
  const month = isMonth(params.get("mes")) ? params.get("mes")! : today.slice(0, 7);
  const dia = params.get("dia");
  const selected = isDay(dia) && dia.startsWith(month) ? dia : null;
  const filter: CalFilter = FILTER_OF[params.get("ver") ?? ""] ?? "all";
  const staff = useStaff();
  const leave = useLeaveWaitlist();
  /** La hoja abierta: una cita (la que se toca o una nueva para un día) o un evento (el que se toca o uno nuevo). */
  const [visit, setVisit] = useState<{ appointment: Appointment | null; start?: string } | null>(null);
  const [event, setEvent] = useState<{ event: PatientEvent | null; day: string | null } | null>(null);
  /** Deslizar el dedo sobre el mes: a la izquierda, el siguiente; a la derecha, el anterior. */
  const touch = useRef<{ x: number; y: number } | null>(null);
  const { pathname, search } = useLocation();

  const data = useAsync(
    async () => {
      const db = getDb();
      const [patient, appointments, events, sessions, clinic, messages, plans] = await Promise.all([
        getPatient(db, id),
        appointmentsOf(db, id),
        listPatientEvents(db, id),
        sessionDays(db, id),
        getClinic(db),
        loadMessages(db),
        loadPatientPlans(db, id),
      ]);
      // Los días con la agenda cerrada para todos (un festivo, unas vacaciones de la clínica), para rayarlos en el mes.
      const first = `${month}-01`;
      const closures = (await closuresBetween(db, atMinutes(first, 0), atMinutes(addDays(first, 31), 0))).filter((c) => c.staffEmail === "");
      return { patient, appointments, events, sessions, review: sessions[0]?.reviewOn ?? null, clinic, messages, closures, plans };
    },
    [id, month],
    { tables: ["patients", "appointments", "sessions", "events", "settings", "schedule"] },
  );
  if (!data.data) return <Guard state={data} title="Calendario" back={`/pacientes/${id}`} />;
  const { patient, events, clinic, messages } = data.data;
  // «Sus próximas citas»: la lista para mandársela (solo con el permiso de contacto firmado, como todo lo demás).
  const upcoming = upcomingOf(data.data.appointments);
  const contact = patient?.privacy.consents?.contact;
  const phone = patient ? waPhone(patient.phone) : null;
  const sendText = patient
    ? withSignature(
        [
          messageText("citas", messages, { nombre: firstName(patient.name), clinica: clinic.name }, { signature: false }),
          ...upcomingLines(data.data.appointments, (email) => (staff.length && email ? staffName(staff, email) : null)),
        ].join("\n"),
        messages,
      )
    : "";

  // Sus citas pendientes que caen en algo suyo (apuntado después de darlas, o por él desde su móvil): cada una lo dice
  // en su fila, y las de un viaje o una operación (no podrá venir), además, arriba, a un toque para cambiarlas.
  const inside = visitsInEvents(data.data.appointments, events);
  const hitsOf = new Map(inside.map((x) => [x.appointment.id, x.hits]));
  const away = inside.filter((x) => x.hits.some((h) => AWAY_KINDS.includes(h.event.kind)));
  const days = monthDays(month);
  const byDay = calendarItems(data.data, days[0]!, days.at(-1)!, filter);
  // Su plan por ciclos (src/data/cycles.ts): cada día, la fase en la que cae, con el color de esa fase.
  const phaseOf = (day: string) => phaseOnDay(data.data!.plans, day);
  const planLink = (episode: string) => `/pacientes/${id}/ciclos?motivo=${encodeURIComponent(episode)}&volver=${encodeURIComponent(pathname + search)}`;
  const monthPhases = [...new Map(days.map(phaseOf).filter((x) => x !== null).map((x) => [`${x.episode}:${x.index}`, x])).values()];
  const selectedPhase = selected ? phaseOf(selected) : null;
  const go = (next: { mes?: string; dia?: string | null; ver?: CalFilter }) => {
    const p = new URLSearchParams(params);
    const m = next.mes ?? month;
    if (m === today.slice(0, 7)) p.delete("mes");
    else p.set("mes", m);
    const d = next.dia === undefined ? selected : next.dia;
    if (d) p.set("dia", d);
    else p.delete("dia");
    const v = PARAM[next.ver ?? filter];
    if (v) p.set("ver", v);
    else p.delete("ver");
    setParams(p, { replace: true, state: window.history.state?.usr });
  };
  const weeks: (string | null)[][] = [];
  const cells = [...Array<null>(leadingBlanks(month)).fill(null), ...days];
  for (let i = 0; i < cells.length; i += 7) weeks.push([...cells.slice(i, i + 7), ...Array<null>(Math.max(0, i + 7 - cells.length)).fill(null)]);
  // Los filtros llevan su número: cuántas citas y cuántas cosas de cada familia hay este mes.
  const counts = monthCounts(data.data, month);
  const showsVisits = filter === "all" || filter === "visits";
  // Un día está cerrado si un cierre de toda la clínica lo cubre entero.
  const closedNote = (day: string) => {
    const from = Date.parse(atMinutes(day, 0));
    const c = data.data!.closures.find((x) => Date.parse(x.startsAt) <= from && Date.parse(x.endsAt) >= from + 23 * 3_600_000);
    return c ? c.note || "Agenda cerrada" : null;
  };
  // «Dar cita» propone su hora de siempre: la de su última cita (si no, las 10:00).
  const lastVisit = [...data.data.appointments].reverse().find((a) => a.status !== "cancelled");
  const usualTime = lastVisit ? localInput(lastVisit.startsAt).slice(11, 16) : "10:00";
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      touch.current = t ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const t = e.changedTouches[0];
      const from = touch.current;
      touch.current = null;
      if (!t || !from) return;
      const dx = t.clientX - from.x;
      if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(t.clientY - from.y)) go({ mes: addMonths(month, dx < 0 ? 1 : -1), dia: null });
    },
  };
  // En la lista del mes, lo que se repite cada semana va una vez, arriba; día a día solo lo demás.
  const series = filter === "visits" ? [] : seriesIn(filter === "all" || filter === "events" ? events : events.filter((e) => familyOf(e.kind) === filter), month);
  const monthList = monthAgenda(byDay);
  // Tocar un evento de un día: su hoja sabe qué día es (para «este día no» en lo que se repite).
  const row = (item: CalItem, i: number, whole = false) => (
    <ItemRow
      key={i}
      item={item}
      whole={whole}
      patientId={id}
      staff={staff}
      hits={item.type === "visit" ? hitsOf.get(item.appointment.id) : undefined}
      onVisit={(a) => setVisit({ appointment: a })}
      onEvent={(e) => setEvent({ event: e, day: whole ? null : item.day })}
    />
  );

  return (
    <PatientShell patient={patient} id={id}>
      {/* En ancho (el ordenador a pantalla completa), el mes a la izquierda y la lista a la derecha; con la lista de
          pacientes al lado no caben las dos: una debajo de la otra, como en el móvil. */}
      <div className="flex flex-col gap-4 @3xl:grid @3xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] @3xl:items-start @3xl:gap-x-6">
        <section aria-labelledby="h-calendario" className="flex flex-col gap-3">
          {/* «Apuntar evento» va con el día: al elegir uno, «Apuntar evento este día»; sin día, debajo del mes. */}
          <h2 id="h-calendario" className="text-xl">
            Calendario
          </h2>
          {/* Arriba, en una línea: su próxima cita, cuántas le quedan y cómo dárselas (WhatsApp, correo o en papel). */}
          {upcoming.length > 0 && patient && (
            <div className="card-edge flex flex-col gap-1 rounded-lg border bg-bg px-3 py-1.5 shadow-card">
              <div className="flex items-center gap-1">
                <p className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{upcoming.length === 1 ? "1 cita pendiente" : `${upcoming.length} citas pendientes`}</span> · la próxima, {fmtVisit(upcoming[0]!.startsAt)}
                </p>
                {mayMessage(contact) && phone && (
                  <a href={whatsappUrl(phone, sendText)} target="_blank" rel="noopener noreferrer" aria-label="Sus próximas citas por WhatsApp" title="Sus próximas citas por WhatsApp" className={iconLink}>
                    <MessageCircle aria-hidden="true" className="size-5" />
                  </a>
                )}
                {mayMessage(contact) && patient.email && (
                  <a href={mailtoUrl(patient.email, messageSubject("citas", messages, { clinica: clinic.name }), sendText)} aria-label="Por correo" title="Sus próximas citas por correo" className={iconLink}>
                    <Mail aria-hidden="true" className="size-5" />
                  </a>
                )}
                {/* En papel, para dársela en la consulta: no hace falta el permiso de contacto. */}
                <Link to={`/pacientes/${id}/proximas-citas`} aria-label="Hoja para imprimir" title="Hoja para imprimir" className={iconLink}>
                  <Printer aria-hidden="true" className="size-5" />
                </Link>
              </div>
              <ContactNote contact={contact} patientId={id} extra="Díselas en la consulta" />
            </div>
          )}
          <div className="flex items-center gap-1">
            <IconButton label="Mes anterior" onClick={() => go({ mes: addMonths(month, -1), dia: null })}>
              <ChevronLeft aria-hidden="true" className="size-5" />
            </IconButton>
            <h3 className="min-w-0 flex-1 text-center text-base" aria-live="polite">
              {monthTitle(month)}
            </h3>
            <IconButton label="Mes siguiente" onClick={() => go({ mes: addMonths(month, 1), dia: null })}>
              <ChevronRight aria-hidden="true" className="size-5" />
            </IconButton>
            <Button size="sm" variant="secondary" disabled={selected === today} onClick={() => go({ mes: today.slice(0, 7), dia: today })}>
              Hoy
            </Button>
          </div>
          <table data-swipe className="w-full table-fixed border-separate border-spacing-[2px]" {...swipe}>
            <caption className="sr-only">
              {monthTitle(month)}. Toca un día para ver lo que tiene. Desliza el dedo para cambiar de mes.
            </caption>
            <thead>
              <tr>
                {WEEKDAY_SHORT.map((d, i) => (
                  <th key={d} scope="col" abbr={weekdayName(i + 1)} className="pb-1 text-xs font-semibold text-text-muted">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, wi) => (
                <tr key={wi}>
                  {w.map((day, di) => (
                    <td key={day ?? `x${di}`} className="p-0">
                      {day && (
                        <DayButton
                          day={day}
                          today={day === today}
                          selected={day === selected}
                          past={day < today}
                          items={byDay.get(day)}
                          closed={closedNote(day)}
                          phase={phaseOf(day)}
                          onClick={() => go({ dia: day === selected ? null : day })}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!selected && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm text-text-muted">Toca un día para dar cita o apuntar un evento.</p>
              <Button size="sm" variant="secondary" icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => setEvent({ event: null, day: null })}>
                Apuntar evento
              </Button>
            </div>
          )}
          {/* Los colores del mes son también el filtro, cada uno con su número. */}
          <div role="group" aria-label="Qué se ve" className="flex flex-wrap gap-2">
            {(
              [
                { id: "all", label: "Todo", n: null, tone: null },
                { id: "visits", label: "Citas", n: counts.visits, tone: "visit" },
                ...FAMILIES.filter((f) => counts[f.id] > 0 || filter === f.id).map((f) => ({ id: f.id, label: f.label, n: counts[f.id], tone: f.id })),
              ] as { id: CalFilter; label: string; n: number | null; tone: ChipTone | null }[]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => go({ ver: filter === f.id ? "all" : f.id })}
                className={cx(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold",
                  f.tone ? CHIP[f.tone] : "border border-border bg-bg text-text",
                  filter === f.id ? "ring-2 ring-text ring-offset-2 ring-offset-canvas" : filter !== "all" && "opacity-60",
                )}
              >
                {f.label}
                {f.n !== null && <span className="nums">{f.n}</span>}
              </button>
            ))}
          </div>
          {/* La franja de color bajo cada día: en qué fase de su plan por ciclos cae. Toca una para ver el plan. */}
          {monthPhases.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold text-text-muted">Plan por ciclos (franja bajo cada día)</p>
              <div className="flex flex-wrap gap-2">
                {monthPhases.map((x) => (
                  <Link key={`${x.episode}:${x.index}`} to={planLink(x.episode)} className={cx("inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-3 text-sm font-semibold", phaseChip(x.index))}>
                    <span aria-hidden="true" className={cx("h-1 w-4 rounded-pill", phaseSolid(x.index))} />
                    {x.index + 1} · {x.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="h-lista" className="flex flex-col gap-3">
          {showsVisits && away.length > 0 && (
            <div className="flex flex-col gap-2">
              <Alert tone="warning" title={awayTitle(away)}>
                {away.length === 1 ? "Tócala para cambiarla o anularla." : "Toca cada una para cambiarla o anularla."}
              </Alert>
              <VisitList appointments={away.map((x) => x.appointment)} detail={(a) => hitNames(hitsOf.get(a.id) ?? [])} onVisit={(a) => setVisit({ appointment: a })} />
            </div>
          )}
          {selected ? (
            <>
              <h3 id="h-lista" className="text-base first-letter:uppercase">
                {dayLong(selected)}
                {selected === today && <span className="ml-2 rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">Hoy</span>}
              </h3>
              {selectedPhase && (
                <Link to={planLink(selectedPhase.episode)} className={cx("inline-flex min-h-11 items-center self-start rounded-pill border px-3 text-sm", phaseChip(selectedPhase.index))}>
                  <span className="font-semibold">
                    Fase {selectedPhase.index + 1} · {selectedPhase.name}
                  </span>
                  &nbsp;· semana {selectedPhase.week + 1} de {selectedPhase.weeks}
                </Link>
              )}
              {(byDay.get(selected) ?? []).length === 0 ? (
                <p className="text-sm text-text-muted">{filter === "visits" ? "Ninguna cita este día." : filter === "events" ? "Ningún evento este día." : "Nada este día."}</p>
              ) : (
                <ul className="flex flex-col gap-2">{byDay.get(selected)!.map((it, i) => <li key={i}>{row(it, i)}</li>)}</ul>
              )}
              {/* Lo de ese día: darle cita (si no ha pasado) y apuntar un evento suyo (también en un día ya pasado: una
                  operación o un viaje que ya ocurrió). */}
              {selected >= today && (
                <Button
                  variant="secondary"
                  icon={<CalendarPlus aria-hidden="true" className="size-5" />}
                  onClick={() => setVisit({ appointment: null, start: new Date(`${selected}T${usualTime}`).toISOString() })}
                >
                  Dar cita a las {usualTime}
                </Button>
              )}
              <Button variant="secondary" icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => setEvent({ event: null, day: selected })}>
                Apuntar evento este día
              </Button>
              <Button variant="ghost" onClick={() => go({ dia: null })}>
                Ver todo {monthTitle(month).replace(/ de \d+$/, "").toLowerCase()}
              </Button>
            </>
          ) : (
            <>
              <h3 id="h-lista" className="text-base">
                En {monthTitle(month).replace(/ de \d+$/, "").toLowerCase()}
              </h3>
              {series.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold text-text-muted">Cada semana</h4>
                  <ul className="flex flex-col gap-2">
                    {series.map((e) => (
                      <li key={e.id}>
                        <EventButton event={e} detail={`${eventSpan(e)} · ${eventTime(e)}`} onClick={() => setEvent({ event: e, day: null })} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {monthList.map(([day, items]) => (
                <div key={day} className="flex flex-col gap-2">
                  <h4 className={cx("text-sm font-semibold first-letter:uppercase", day === today ? "text-accent" : "text-text-muted")}>
                    {dayLong(day)}
                    {day === today ? " · hoy" : ""}
                  </h4>
                  <ul className="flex flex-col gap-2">{items.map((it, i) => <li key={i}>{row(it, i, true)}</li>)}</ul>
                </div>
              ))}
              {series.length === 0 && monthList.length === 0 && (
                <p className="text-sm text-text-muted">
                  {filter === "visits" ? "Ninguna cita este mes." : filter === "events" ? "Ningún evento este mes." : "Nada este mes."} Toca un día para darle cita o apuntar algo suyo: una
                  operación, sus entrenamientos, un partido, una prueba médica, un viaje.
                </p>
              )}
            </>
          )}
          {/* Que lo apunte desde su móvil (Formularios › «Su calendario»). */}
          <Link
            to={`/pacientes/${id}/formularios?enviar=calendario`}
            className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-accent underline underline-offset-2"
          >
            <Send aria-hidden="true" className="size-4" /> Que lo apunte desde su móvil
          </Link>
        </section>
      </div>
      {patient && (
        <AppointmentSheet
          open={!!visit}
          onClose={() => setVisit(null)}
          patientId={id}
          patientName={patient.name}
          appointment={visit?.appointment ?? null}
          start={visit?.start}
          onCreated={(pid) => void leave.ask(pid)}
        />
      )}
      {leave.sheet}
      <EventSheet open={!!event} onClose={() => setEvent(null)} patientId={id} event={event?.event ?? null} day={event?.day} />
    </PatientShell>
  );
}

function DayButton({
  day,
  today,
  selected,
  past,
  items,
  closed,
  phase,
  onClick,
}: {
  day: string;
  today: boolean;
  selected: boolean;
  past: boolean;
  items?: CalItem[];
  /** El motivo, si ese día la agenda está cerrada para todos (sale rayado). */
  closed: string | null;
  /** La fase de su plan por ciclos en la que cae (franja de su color abajo). */
  phase?: { index: number; name: string } | null;
  onClick: () => void;
}) {
  const { chips, more } = chipsOf(items, day);
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-current={today ? "date" : undefined}
      onClick={onClick}
      className={cx(
        "relative flex h-16 w-full min-w-0 flex-col items-stretch justify-start gap-0.5 overflow-hidden rounded-md px-px pt-1 text-sm",
        closed ? "bg-[repeating-linear-gradient(135deg,var(--color-surface)_0_4px,transparent_4px_8px)]" : "bg-bg",
        // El dorado es «hoy»; el día elegido, un marco del color de lo que se toca.
        selected ? "ring-2 ring-accent ring-inset" : today ? "ring-2 ring-highlight ring-inset" : "hover:bg-surface",
      )}
    >
      {/* Para el lector de pantalla, el día entero en palabras; lo que se ve (número y etiquetas) es solo para la vista. */}
      <span className="sr-only">{`${dayLong(day)}${today ? ", hoy" : ""}${closed ? `, agenda cerrada (${closed})` : ""}${phase ? `, fase ${phase.index + 1} (${phase.name})` : ""}: ${countText(items)}`}</span>
      <span aria-hidden="true" className={cx("nums text-center leading-none", today ? "font-bold" : past && "text-text-muted")}>
        {Number(day.slice(8))}
      </span>
      {/* Como mucho dos etiquetas, cada una con su color y su palabra; lo de varios días sigue como franja sin texto. */}
      {chips.map((c, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cx("block h-3.5 overflow-hidden rounded-sm px-0.5 text-center text-[0.625rem] leading-[0.875rem] font-semibold whitespace-nowrap", CHIP[c.tone], !c.text && "-mx-px rounded-none")}
        >
          {c.text}
        </span>
      ))}
      {phase && <span aria-hidden="true" className={cx("absolute inset-x-0 bottom-0 h-1", phaseSolid(phase.index))} />}
      {more > 0 && (
        <span aria-hidden="true" className="absolute right-0.5 top-0.5 text-[0.625rem] leading-none font-semibold text-text-muted">
          +{more}
        </span>
      )}
    </button>
  );
}

const rowClass = "card-edge flex min-h-12 w-full items-center gap-3 rounded-lg border bg-bg px-3 py-2 text-left shadow-card hover:border-accent";

function EventButton({ event, detail, onClick }: { event: PatientEvent; detail: string; onClick: () => void }) {
  const Icon = KIND_ICON[event.kind];
  return (
    <button type="button" aria-haspopup="dialog" onClick={onClick} className={rowClass}>
      <Icon aria-hidden="true" className="size-5 shrink-0 text-tingle" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold break-words">{eventName(event)}</span>
        <span className="text-sm text-text-muted">
          {event.title ? `${kindLabel(event.kind)} · ` : ""}
          {detail}
        </span>
        {event.notes && <span className="line-clamp-2 text-sm text-text-muted">{event.notes}</span>}
      </span>
      {event.repeatDays.length > 0 && (
        <>
          <Repeat aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
          <span className="sr-only">Se repite cada semana</span>
        </>
      )}
    </button>
  );
}

function ItemRow({
  item,
  whole,
  patientId,
  staff,
  hits,
  onVisit,
  onEvent,
}: {
  item: CalItem;
  /** En la lista del mes: un evento de varios días va una vez, con sus días («Del 26 al 29 nov»). */
  whole?: boolean;
  patientId: string;
  staff: ReturnType<typeof useStaff>;
  /** Una cita pendiente que cae en algo suyo: lo que pisa. */
  hits?: Occurrence[];
  onVisit: (a: Appointment) => void;
  onEvent: (e: PatientEvent) => void;
}) {
  if (item.type === "event") {
    const o = item.occurrence;
    const detail = whole && o.event.endsOn ? `${eventSpan(o.event)} · ${eventTime(o.event)}` : [eventTime(o.event), spanStep(o)].filter(Boolean).join(" · ");
    return <EventButton event={o.event} detail={detail} onClick={() => onEvent(o.event)} />;
  }
  if (item.type === "visit") {
    const a = item.appointment;
    const off = a.status === "cancelled";
    return (
      <button type="button" aria-haspopup="dialog" onClick={() => onVisit(a)} className={rowClass}>
        <CalendarCheck aria-hidden="true" className="size-5 shrink-0 text-accent" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cx("font-semibold", off && "text-text-muted line-through")}>
            Cita a las {item.time}
            {staff.length > 0 && a.assignedTo ? ` con ${staffName(staff, a.assignedTo)}` : ""}
          </span>
          <span className="text-sm text-text-muted">
            {a.minutes} min · {STATUS_LABELS[a.status]}
          </span>
          {hits && hits.length > 0 && <span className="text-sm font-semibold text-warning">Cae en: {hitNames(hits)}</span>}
        </span>
      </button>
    );
  }
  if (item.type === "session")
    return (
      <Link to={`/pacientes/${patientId}/sesiones/${item.sessionId}`} className={rowClass}>
        <NotebookPen aria-hidden="true" className="size-5 shrink-0 text-accent" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">Sesión a las {item.time}</span>
          <span className="text-sm text-text-muted">Apuntada sin cita</span>
        </span>
      </Link>
    );
  return (
    <Link to={`/pacientes/${patientId}/valoracion`} className={rowClass}>
      <ClipboardCheck aria-hidden="true" className="size-5 shrink-0 text-warning" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">Reevaluación prevista</span>
        <span className="text-sm text-text-muted">La que se dejó puesta en la última sesión</span>
      </span>
    </Link>
  );
}
