// Ficha › Calendario: lo de este paciente en un mes. Sus citas (todas: pendientes, atendidas, «No vino», anuladas), las
// sesiones apuntadas en días sin cita, la reevaluación prevista y sus eventos (una operación, sus entrenamientos, un
// partido, una prueba médica, un viaje: src/data/patientEvents.ts). Se filtra por «Citas» o «Eventos»; al tocar un día
// se ve lo de ese día y se le puede dar cita o apuntar algo. El mes, el día y el filtro van en la dirección
// (?mes=2026-11&dia=2026-11-12&ver=citas): al volver de una sesión, se sigue donde se estaba.
import { CalendarCheck, CalendarPlus, ChevronLeft, ChevronRight, ClipboardCheck, NotebookPen, Plus, Repeat } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { todayDay } from "../app/dates";
import { useAsync } from "../app/useAsync";
import { appointmentsOf, STATUS_LABELS, type Appointment } from "../data/appointments";
import { sessionDays } from "../data/clinical";
import { getDb } from "../data/db";
import { dayLong, eventName, eventSpan, eventTime, isDay, kindLabel, listPatientEvents, WEEKDAY_SHORT, weekdayName, type PatientEvent } from "../data/patientEvents";
import { getPatient } from "../data/repo";
import { staffName, useStaff } from "../schedule/useStaff";
import { useLeaveWaitlist } from "../schedule/LeaveWaitlist";
import { Button, IconButton } from "../ui/Button";
import { cx } from "../ui/cx";
import { AppointmentSheet } from "./AppointmentSheet";
import { KIND_ICON } from "./eventIcons";
import { EventSheet } from "./EventSheet";
import { Guard, localInput } from "./pageKit";
import { PatientShell } from "./PatientShell";
import {
  addMonths,
  barOf,
  calendarItems,
  countText,
  dotsOf,
  FILTERS,
  isMonth,
  leadingBlanks,
  monthAgenda,
  monthDays,
  monthTitle,
  seriesIn,
  spanStep,
  type CalFilter,
  type CalItem,
  type Dot,
} from "./patientCalendar";

// Lo de cada semana, un punto hueco (suave): lo importante, relleno, destaca. Lo de varios días, una franja.
const DOT: Record<Dot, string> = { visit: "bg-accent", event: "bg-tingle", routine: "border border-tingle", review: "bg-warning" };
const DOT_LABEL: Record<Dot, string> = { visit: "Citas", event: "Eventos", routine: "Cada semana", review: "Reevaluación" };
const PARAM: Record<CalFilter, string | null> = { all: null, visits: "citas", events: "eventos" };

export function CalendarPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const today = todayDay();
  const month = isMonth(params.get("mes")) ? params.get("mes")! : today.slice(0, 7);
  const dia = params.get("dia");
  const selected = isDay(dia) && dia.startsWith(month) ? dia : null;
  const filter: CalFilter = params.get("ver") === "citas" ? "visits" : params.get("ver") === "eventos" ? "events" : "all";
  const staff = useStaff();
  const leave = useLeaveWaitlist();
  /** La hoja abierta: una cita (la que se toca o una nueva para un día) o un evento (el que se toca o uno nuevo). */
  const [visit, setVisit] = useState<{ appointment: Appointment | null; start?: string } | null>(null);
  const [event, setEvent] = useState<{ event: PatientEvent | null; day: string | null } | null>(null);
  /** Deslizar el dedo sobre el mes: a la izquierda, el siguiente; a la derecha, el anterior. */
  const touch = useRef<{ x: number; y: number } | null>(null);

  const data = useAsync(
    async () => {
      const db = getDb();
      const [patient, appointments, events, sessions] = await Promise.all([getPatient(db, id), appointmentsOf(db, id), listPatientEvents(db, id), sessionDays(db, id)]);
      return { patient, appointments, events, sessions, review: sessions[0]?.reviewOn ?? null };
    },
    [id],
    { tables: ["patients", "appointments", "sessions", "events"] },
  );
  if (!data.data) return <Guard state={data} title="Calendario" back={`/pacientes/${id}`} />;
  const { patient, events } = data.data;

  const days = monthDays(month);
  const byDay = calendarItems(data.data, days[0]!, days.at(-1)!, filter);
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
  // La leyenda, solo de lo que hay este mes.
  const present = new Set([...byDay.values()].flatMap((items) => dotsOf(items)));
  const legend = (["visit", "event", "routine", "review"] as Dot[]).filter((d) => present.has(d));
  const hasBars = [...byDay.entries()].some(([day, items]) => barOf(items, day, month));
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
  const series = filter === "visits" ? [] : seriesIn(events, month);
  const monthList = monthAgenda(byDay);
  // Tocar un evento de un día: su hoja sabe qué día es (para «este día no» en lo que se repite).
  const row = (item: CalItem, i: number, whole = false) => (
    <ItemRow
      key={i}
      item={item}
      whole={whole}
      patientId={id}
      staff={staff}
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
          <div className="flex items-center justify-between gap-3">
            <h2 id="h-calendario" className="text-xl">
              Calendario
            </h2>
            <Button size="sm" icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => setEvent({ event: null, day: selected })}>
              Apuntar evento
            </Button>
          </div>
          <div role="group" aria-label="Qué se ve" className="flex gap-1 rounded-lg border border-border bg-surface p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => go({ ver: f.id })}
                className={cx("min-h-11 flex-1 rounded-md px-2 text-sm font-semibold", filter === f.id ? "bg-accent text-on-accent" : "text-text hover:bg-bg")}
              >
                {f.label}
              </button>
            ))}
          </div>
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
          <table className="w-full table-fixed border-separate border-spacing-[2px]" {...swipe}>
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
                          bar={barOf(byDay.get(day), day, month)}
                          onClick={() => go({ dia: day === selected ? null : day })}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {(legend.length > 0 || hasBars) && (
            <ul aria-label="Leyenda" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
              {legend.map((d) => (
                <li key={d} className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className={cx("size-2 rounded-full", DOT[d])} />
                  {DOT_LABEL[d]}
                </li>
              ))}
              {hasBars && (
                <li className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-1 w-4 rounded-pill bg-tingle/60" />
                  Varios días
                </li>
              )}
            </ul>
          )}
        </section>

        <section aria-labelledby="h-lista" className="flex flex-col gap-3">
          {selected ? (
            <>
              <h3 id="h-lista" className="text-base first-letter:uppercase">
                {dayLong(selected)}
                {selected === today && <span className="ml-2 rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">Hoy</span>}
              </h3>
              {(byDay.get(selected) ?? []).length === 0 ? (
                <p className="text-sm text-text-muted">{filter === "visits" ? "Ninguna cita este día." : filter === "events" ? "Ningún evento este día." : "Nada este día."}</p>
              ) : (
                <ul className="flex flex-col gap-2">{byDay.get(selected)!.map((it, i) => <li key={i}>{row(it, i)}</li>)}</ul>
              )}
              {/* Apuntar algo ese día: con «Apuntar evento», arriba (ya usa el día elegido). Aquí, la cita. */}
              {selected >= today && (
                <Button
                  variant="secondary"
                  icon={<CalendarPlus aria-hidden="true" className="size-5" />}
                  onClick={() => setVisit({ appointment: null, start: new Date(`${selected}T${usualTime}`).toISOString() })}
                >
                  Dar cita a las {usualTime}
                </Button>
              )}
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
  bar,
  onClick,
}: {
  day: string;
  today: boolean;
  selected: boolean;
  past: boolean;
  items?: CalItem[];
  bar: { start: boolean; end: boolean } | null;
  onClick: () => void;
}) {
  const dots = dotsOf(items);
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-current={today ? "date" : undefined}
      aria-label={`${dayLong(day)}${today ? ", hoy" : ""}: ${countText(items)}`}
      onClick={onClick}
      className={cx(
        "relative flex h-12 w-full min-w-0 flex-col items-center justify-start gap-1 rounded-md pt-1.5 text-sm",
        selected ? "bg-accent text-on-accent" : today ? "bg-accent-soft font-bold text-accent" : "hover:bg-surface",
        !selected && !today && past && "text-text-muted",
      )}
    >
      <span aria-hidden="true" className="nums leading-none">
        {Number(day.slice(8))}
      </span>
      <span aria-hidden="true" className="flex h-1.5 gap-0.5">
        {dots.map((d) => (
          <span key={d} className={cx("size-1.5 rounded-full", selected ? (d === "routine" ? "border border-on-accent" : "bg-on-accent") : DOT[d])} />
        ))}
      </span>
      {/* Varios días (un viaje): una franja abajo que pasa de un día al siguiente. */}
      {bar && (
        <span
          aria-hidden="true"
          className={cx(
            "absolute bottom-1 h-1",
            selected ? "bg-on-accent/70" : "bg-tingle/60",
            bar.start ? "left-1.5 rounded-l-pill" : "-left-px",
            bar.end ? "right-1.5 rounded-r-pill" : "-right-px",
          )}
        />
      )}
    </button>
  );
}

const rowClass = "flex min-h-12 w-full items-center gap-3 rounded-md border border-border bg-bg px-3 py-2 text-left hover:border-accent";

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
  onVisit,
  onEvent,
}: {
  item: CalItem;
  /** En la lista del mes: un evento de varios días va una vez, con sus días («Del 26 al 29 nov»). */
  whole?: boolean;
  patientId: string;
  staff: ReturnType<typeof useStaff>;
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
