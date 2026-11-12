// Lo que se ve en el calendario de un paciente (CalendarPage.tsx), día a día: sus citas (todas, también las atendidas y
// las anuladas), las sesiones apuntadas en un día sin cita, la reevaluación prevista y sus eventos (src/data/
// patientEvents.ts). Sin base de datos ni pantalla: se prueba sola (patientCalendar.test.ts).
import { addDays, dayOf } from "../app/dates";
import type { Appointment } from "../data/appointments";
import { daysBetween, occurrencesIn, timeOf, weekdayOf, type Occurrence, type PatientEvent } from "../data/patientEvents";

/** Qué se ve: todo, solo lo de la clínica (citas, sesiones y reevaluación) o solo lo suyo (sus eventos). */
export type CalFilter = "all" | "visits" | "events";
export const FILTERS: { id: CalFilter; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "visits", label: "Citas" },
  { id: "events", label: "Eventos" },
];

export type CalItem =
  | { type: "visit"; day: string; time: string; appointment: Appointment }
  | { type: "session"; day: string; time: string; sessionId: string }
  | { type: "review"; day: string; time: null }
  | { type: "event"; day: string; time: string | null; occurrence: Occurrence };

export type CalSource = {
  appointments: Appointment[];
  events: PatientEvent[];
  /** Las sesiones apuntadas (para los días en que vino sin cita: una sesión de antes, una importada). */
  sessions: { id: string; performedAt: string }[];
  /** El día de la próxima reevaluación (la de su última sesión), si lo hay. */
  review: string | null;
};

const ORDER = { review: 0, visit: 1, session: 2, event: 3 } as const;

/** Lo de cada día entre `from` y `to` (incluidos): primero lo de todo el día, luego por hora. */
export function calendarItems(src: CalSource, from: string, to: string, filter: CalFilter = "all"): Map<string, CalItem[]> {
  const items: CalItem[] = [];
  const inRange = (day: string) => day >= from && day <= to;
  if (filter !== "events") {
    const visitDays = new Set<string>();
    for (const a of src.appointments) {
      const day = dayOf(a.startsAt);
      if (a.status !== "cancelled") visitDays.add(day);
      if (inRange(day)) items.push({ type: "visit", day, time: timeOf(a.startsAt), appointment: a });
    }
    for (const s of src.sessions) {
      const day = dayOf(s.performedAt);
      if (inRange(day) && !visitDays.has(day)) items.push({ type: "session", day, time: timeOf(s.performedAt), sessionId: s.id });
    }
    if (src.review && inRange(src.review)) items.push({ type: "review", day: src.review, time: null });
  }
  if (filter !== "visits") for (const o of occurrencesIn(src.events, from, to)) items.push({ type: "event", day: o.day, time: o.event.time, occurrence: o });
  items.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? "").localeCompare(b.time ?? "") || ORDER[a.type] - ORDER[b.type]);
  const byDay = new Map<string, CalItem[]>();
  for (const it of items) {
    const list = byDay.get(it.day);
    if (list) list.push(it);
    else byDay.set(it.day, [it]);
  }
  return byDay;
}

/**
 * Los puntos de un día en el mes: uno por cada clase de cosa que tiene (no uno por cosa). Lo de cada semana (sus
 * entrenamientos) lleva un punto suave, para que lo importante (una operación, un partido, una prueba) destaque; lo de
 * varios días (un viaje) no lleva punto: va como una franja (`barOf`).
 */
export type Dot = "visit" | "event" | "routine" | "review";
export function dotsOf(items: CalItem[] = []): Dot[] {
  const has = (t: CalItem["type"][]) => items.some((i) => t.includes(i.type));
  const events = items.filter((i): i is Extract<CalItem, { type: "event" }> => i.type === "event").map((i) => i.occurrence.event);
  return [
    has(["visit", "session"]) && "visit",
    events.some((e) => !e.repeatDays.length && !e.endsOn) && "event",
    events.some((e) => e.repeatDays.length > 0) && "routine",
    has(["review"]) && "review",
  ].filter((d): d is Dot => !!d);
}

/**
 * La franja de un día en el mes, si está dentro de algo de varios días (un viaje): si empieza o acaba ahí (también al
 * empezar o acabar la semana o el mes, para que la franja no se salga de la fila). Null si no hay.
 */
export function barOf(items: CalItem[] = [], day: string, month: string): { start: boolean; end: boolean } | null {
  const spans = items.filter((i): i is Extract<CalItem, { type: "event" }> => i.type === "event" && !!i.occurrence.event.endsOn);
  if (!spans.length) return null;
  const days = monthDays(month);
  const wd = weekdayOf(day);
  return {
    start: spans.some((i) => i.occurrence.first) || wd === 1 || day === days[0],
    end: spans.some((i) => i.occurrence.last) || wd === 7 || day === days.at(-1),
  };
}

/** Cuántas cosas tiene un día, en palabras (para el lector de pantalla del día en el mes): «1 cita y 2 eventos». */
export function countText(items: CalItem[] = []): string {
  const n = (t: CalItem["type"]) => items.filter((i) => i.type === t).length;
  const parts = [
    [n("visit"), "cita", "citas"],
    [n("session"), "sesión", "sesiones"],
    [n("event"), "evento", "eventos"],
    [n("review"), "reevaluación", "reevaluaciones"],
  ]
    .filter(([c]) => (c as number) > 0)
    .map(([c, one, many]) => `${c} ${c === 1 ? one : many}`);
  if (parts.length === 0) return "nada";
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
}

// ---------- El mes ----------

/** «2026-11» → los días del mes, AAAA-MM-DD. */
export function monthDays(month: string): string[] {
  const first = `${month}-01`;
  const days: string[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) days.push(d);
  return days;
}
/** Huecos antes del día 1 en una semana que empieza en lunes. */
export const leadingBlanks = (month: string) => weekdayOf(`${month}-01`) - 1;
/** El mes de antes o de después («2026-12» + 1 → «2027-01»). */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
/** «Noviembre de 2026». */
export function monthTitle(month: string): string {
  const t = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
/** ¿Es un mes «AAAA-MM» de verdad? (lo que llega en la dirección). */
export const isMonth = (v: string | null): v is string => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Las series semanales que tienen algún día en el mes: en la lista del mes van juntas, una vez, y no día a día. */
export function seriesIn(events: PatientEvent[], month: string): PatientEvent[] {
  const days = monthDays(month);
  const from = days[0]!;
  const to = days.at(-1)!;
  return events.filter((e) => e.repeatDays.length > 0 && occurrencesIn([e], from, to).length > 0);
}

/**
 * La lista del mes, día a día, sin repetir: lo que se repite cada semana no va (va una vez, arriba: `seriesIn`) y un
 * evento de varios días (un viaje) va solo en su primer día del mes, no en cada uno.
 */
export function monthAgenda(byDay: Map<string, CalItem[]>): [string, CalItem[]][] {
  const seen = new Set<string>();
  const out: [string, CalItem[]][] = [];
  for (const [day, items] of byDay) {
    const kept = items.filter((i) => {
      if (i.type !== "event") return true;
      const e = i.occurrence.event;
      if (e.repeatDays.length) return false;
      if (!e.endsOn) return true;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
    if (kept.length) out.push([day, kept]);
  }
  return out;
}

/** «Día 2 de 5» de un evento de varios días; nada si es de uno. */
export function spanStep(o: Occurrence): string | null {
  if (!o.event.endsOn) return null;
  return `Día ${daysBetween(o.event.startsOn, o.day) + 1} de ${daysBetween(o.event.startsOn, o.event.endsOn) + 1}`;
}
