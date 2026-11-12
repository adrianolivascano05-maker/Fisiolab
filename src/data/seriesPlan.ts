// Dar una serie de citas (una por semana) teniendo en cuenta su calendario (src/data/patientEvents.ts): las semanas en
// que está de viaje se saltan (y la serie sigue después, hasta tener las que se pidieron), y se dice qué días entrena,
// para elegir uno en que no. Sin base de datos: se prueba solo (seriesPlan.test.ts).
import { eventsAtVisit, repeatText, weekdayName, type PatientEvent } from "./patientEvents";

/** Lo más que se alarga una serie por los viajes: medio año de semanas más. */
const EXTRA_WEEKS = 26;

export type SeriesPlan = {
  /** Las citas que se dan, una por semana a la misma hora local. */
  starts: string[];
  /** Las semanas que se saltan, con el viaje que las tapa. */
  skipped: { startsAt: string; event: PatientEvent }[];
};

/** La misma hora local `weeks` semanas después (aunque cambie el horario de verano), como `createWeekly`. */
const plusWeeks = (iso: string, weeks: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + 7 * weeks);
  return d.toISOString();
};

/** Las `count` citas de una serie que empieza en `startsAt`, saltando las semanas en que está de viaje. */
export function planSeries(startsAt: string, count: number, minutes: number, events: PatientEvent[]): SeriesPlan {
  const starts: string[] = [];
  const skipped: SeriesPlan["skipped"] = [];
  for (let w = 0; starts.length < count && w < count + EXTRA_WEEKS; w++) {
    const at = plusWeeks(startsAt, w);
    const away = eventsAtVisit(events, at, minutes).find((o) => o.event.kind === "travel");
    if (away) skipped.push({ startsAt: at, event: away.event });
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
