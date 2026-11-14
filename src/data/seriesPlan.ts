// Dar una serie de citas (una por semana) teniendo en cuenta su calendario (src/data/patientEvents.ts) y la agenda
// cerrada (src/data/closures.ts): las semanas en que está de viaje o la agenda está cerrada a esa hora (un festivo, unas
// vacaciones de la clínica o de su fisio) se saltan, y la serie sigue después hasta tener las que se pidieron. Se dice
// también qué días entrena, para elegir uno en que no. Sin base de datos: se prueba solo (seriesPlan.test.ts).
import { addDays, dayOf } from "../app/dates";
import type { Closure } from "./closures";
import type { Shift } from "./schedule";
import { eventsAtVisit, repeatText, weekdayName, type PatientEvent } from "./patientEvents";

/** Lo más que se alarga una serie por los viajes: medio año de semanas más. */
const EXTRA_WEEKS = 26;

export type SeriesPlan = {
  /** Las citas que se dan, una por semana a la misma hora local. */
  starts: string[];
  /** Las semanas que se saltan, con el viaje o el cierre que las tapa. */
  skipped: Skipped[];
};

/** Una semana que se salta: está de viaje (`event`) o la agenda está cerrada a esa hora (`closure`). */
export type Skipped = { startsAt: string } & ({ event: PatientEvent; closure?: undefined } | { closure: Pick<Closure, "startsAt" | "endsAt" | "note">; event?: undefined });

/** El primer cierre que pisa una cita de `minutes` minutos a las `startsAt` (los cierres ya son los de su fisio). */
export function closureAt<C extends Pick<Closure, "startsAt" | "endsAt">>(closures: readonly C[], startsAt: string, minutes: number): C | null {
  const start = Date.parse(startsAt);
  const end = start + minutes * 60_000;
  return closures.find((c) => Date.parse(c.startsAt) < end && Date.parse(c.endsAt) > start) ?? null;
}

/** La misma hora local `weeks` semanas después (aunque cambie el horario de verano), como `createWeekly`. */
const plusWeeks = (iso: string, weeks: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + 7 * weeks);
  return d.toISOString();
};

/** El lunes de la semana de un día (AAAA-MM-DD). */
const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));

/**
 * Si una cita de `minutes` minutos a las `startsAt` con `email` cae fuera de sus turnos (src/data/schedule.ts). Solo en
 * las semanas en que esa persona tiene algún turno puesto: una semana sin ninguno aún no está organizada y no se avisa.
 */
export function outsideShifts(shifts: readonly Pick<Shift, "staffEmail" | "startsAt" | "endsAt">[], email: string, startsAt: string, minutes: number): boolean {
  const week = mondayOf(dayOf(startsAt));
  const mine = shifts.filter((s) => s.staffEmail === email && mondayOf(dayOf(s.startsAt)) === week);
  if (!mine.length) return false;
  const start = Date.parse(startsAt);
  const end = start + minutes * 60_000;
  return !mine.some((s) => Date.parse(s.startsAt) <= start && Date.parse(s.endsAt) >= end);
}

/** Hasta dónde puede llegar una serie de `count` citas (para pedir los cierres de esas semanas). */
export const seriesReach = (startsAt: string, count: number, minutes: number) => new Date(Date.parse(plusWeeks(startsAt, count + EXTRA_WEEKS)) + minutes * 60_000).toISOString();

/**
 * Las `count` citas de una serie que empieza en `startsAt`, saltando las semanas en que está de viaje o la agenda está
 * cerrada a esa hora (`closures`: los de toda la clínica y los de con quién es la cita).
 */
export function planSeries(startsAt: string, count: number, minutes: number, events: PatientEvent[], closures: readonly Pick<Closure, "startsAt" | "endsAt" | "note">[] = []): SeriesPlan {
  const starts: string[] = [];
  const skipped: Skipped[] = [];
  for (let w = 0; starts.length < count && w < count + EXTRA_WEEKS; w++) {
    const at = plusWeeks(startsAt, w);
    const away = eventsAtVisit(events, at, minutes).find((o) => o.event.kind === "travel");
    const closed = away ? null : closureAt(closures, at, minutes);
    if (away) skipped.push({ startsAt: at, event: away.event });
    else if (closed) skipped.push({ startsAt: at, closure: closed });
    else starts.push(at);
  }
  return { starts, skipped };
}

/**
 * Sus entrenamientos de cada semana que siguen el día `day`: «martes y jueves a las 19:00», y los días en que no
 * entrena. Null si no tiene ninguno.
 */
export function trainingWeek(events: PatientEvent[], day: string): { text: string; free: string } | null {
  const active = events.filter((e) => e.kind === "training" && e.repeatDays.length && e.startsOn <= day && (!e.repeatUntil || e.repeatUntil >= day));
  if (!active.length) return null;
  // Por día de la semana, sus horas (las de todos sus entrenamientos de ese día).
  const byDay = new Map<number, Set<string>>();
  for (const e of active) for (const d of e.repeatDays) byDay.set(d, (byDay.get(d) ?? new Set()).add(e.time ?? ""));
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const times = new Set([...byDay.values()].flatMap((s) => [...s]));
  const text =
    times.size === 1
      ? `${repeatText(days)}${[...times][0] ? ` a las ${[...times][0]}` : ""}`
      : days.map((d) => `${weekdayName(d)}${[...byDay.get(d)!].filter(Boolean).length ? ` (${[...byDay.get(d)!].filter(Boolean).sort().join(", ")})` : ""}`).join(", ");
  const free = repeatText([1, 2, 3, 4, 5, 6, 7].filter((d) => !byDay.has(d)));
  return { text, free };
}
