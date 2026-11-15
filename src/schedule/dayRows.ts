// El día de la Agenda como lista (DayList.tsx, en el móvil): las citas por orden, los huecos libres entre ellas y los
// ratos con la agenda cerrada. Sin horas vacías. Sin base de datos ni pantalla: se prueba sola (dayRows.test.ts).
import { dayOf } from "../app/dates";
import type { AgendaItem } from "../data/appointments";
import type { Closure } from "../data/closures";
import type { Shift } from "../data/schedule";

/** El hueco más corto que se enseña como libre. */
export const MIN_GAP = 30;

export type DayRow =
  | { type: "visit"; at: number; item: AgendaItem }
  | { type: "free"; at: number; until: number; minutes: number }
  | { type: "closed"; at: number; until: number; closure: Closure };

const ms = (iso: string) => Date.parse(iso);

/**
 * Las filas de un día: las citas sin anular, los cierres que lo tocan y los huecos libres de al menos media hora.
 * Los huecos salen entre una cita y la siguiente y, si ese día hay turnos (`shifts`), también desde que empieza el
 * turno y hasta que acaba; sin turnos, antes de la primera cita y después de la última no se sabe el horario y no se
 * inventa. Un rato cerrado no cuenta como libre.
 */
export function dayRows(day: string, items: AgendaItem[], closures: Closure[], shifts: Pick<Shift, "startsAt" | "endsAt">[] = []): DayRow[] {
  const visits = items.filter((a) => a.status !== "cancelled" && dayOf(a.startsAt) === day).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const dayStart = ms(new Date(`${day}T00:00`).toISOString());
  const dayEnd = dayStart + 24 * 3_600_000;
  const closed = closures
    .filter((k) => ms(k.startsAt) < dayEnd && ms(k.endsAt) > dayStart)
    .map((k) => ({ at: Math.max(ms(k.startsAt), dayStart), until: Math.min(ms(k.endsAt), dayEnd), closure: k }))
    .sort((a, b) => a.at - b.at);
  // Lo ocupado (citas y cierres), para sacar los huecos.
  const busy = [...visits.map((a) => ({ at: ms(a.startsAt), until: ms(a.startsAt) + a.minutes * 60_000 })), ...closed.map((k) => ({ at: k.at, until: k.until }))].sort((a, b) => a.at - b.at);
  const todays = shifts.filter((s) => ms(s.startsAt) < dayEnd && ms(s.endsAt) > dayStart);
  const windows = todays.length
    ? todays.map((s) => ({ at: Math.max(ms(s.startsAt), dayStart), until: Math.min(ms(s.endsAt), dayEnd) })).sort((a, b) => a.at - b.at)
    : visits.length
      ? [{ at: ms(visits[0]!.startsAt), until: Math.max(...visits.map((a) => ms(a.startsAt) + a.minutes * 60_000)) }]
      : [];
  const free: DayRow[] = [];
  for (const w of windows) {
    let cursor = w.at;
    for (const b of busy) {
      if (b.until <= cursor || b.at >= w.until) continue;
      if (b.at - cursor >= MIN_GAP * 60_000) free.push({ type: "free", at: cursor, until: b.at, minutes: Math.round((b.at - cursor) / 60_000) });
      cursor = Math.max(cursor, b.until);
    }
    if (w.until - cursor >= MIN_GAP * 60_000) free.push({ type: "free", at: cursor, until: w.until, minutes: Math.round((w.until - cursor) / 60_000) });
  }
  const rows: DayRow[] = [...visits.map((item): DayRow => ({ type: "visit", at: ms(item.startsAt), item })), ...closed.map((k): DayRow => ({ type: "closed", ...k })), ...free];
  const order = { closed: 0, visit: 1, free: 2 };
  return rows.sort((a, b) => a.at - b.at || order[a.type] - order[b.type]);
}

/** «45 min», «1 h», «1 h 30 min». */
export function spanText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Cuántas citas sin anular hay cada día (para la tira de la semana). */
export function countByDay(items: AgendaItem[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of items) if (a.status !== "cancelled") out.set(dayOf(a.startsAt), (out.get(dayOf(a.startsAt)) ?? 0) + 1);
  return out;
}
