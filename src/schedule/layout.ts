// Cuentas de la agenda (AgendaGrid.tsx): qué columnas hay, dónde cae cada cita y cómo se reparten las que se solapan.
// Todo en la hora del dispositivo, como los campos de fecha y hora de la app.
import { localInput } from "../clinical/pageKit";

/** Altura de una hora en la rejilla, en píxeles. */
export const HOUR_PX = 56;
/** Al arrastrar, las citas encajan cada 15 minutos. */
const SNAP_MIN = 15;

/** AAAA-MM-DD del instante, en la hora del dispositivo. */
export const dayOf = (iso: string) => localInput(iso).slice(0, 10);
/** Minutos desde las 0:00 del día del instante. */
export function minutesOf(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
/** El instante de un día a una hora (minutos desde las 0:00). */
export function atMinutes(day: string, minutes: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return new Date(`${day}T${hh}:${mm}`).toISOString();
}
export const snap = (minutes: number, step = SNAP_MIN) => Math.round(minutes / step) * step;

/**
 * Una columna de la agenda: un día y, si va por personas, de quién es (correo; null, «sin asignar»; undefined, de
 * todos o de quien se esté viendo).
 */
export type Column = { key: string; day: string; person?: string | null };

export function dayColumns(days: string[], person?: string | null): Column[] {
  return days.map((day) => ({ key: day, day, person }));
}
export function personColumns(day: string, people: (string | null)[]): Column[] {
  return people.map((person) => ({ key: `${day}|${person ?? "-"}`, day, person }));
}

/** Si algo de `email` va en la columna. */
export const inColumn = (c: Column, day: string, email: string | null) => c.day === day && (c.person === undefined || c.person === email);

/** Las horas que se ven: de 7 a 21 como mínimo, más si hay algo antes o después. */
export function hourRange(items: { start: number; end: number }[]): { from: number; to: number } {
  let from = 7;
  let to = 21;
  for (const i of items) {
    from = Math.min(from, Math.floor(i.start / 60));
    to = Math.max(to, Math.ceil(i.end / 60));
  }
  return { from: Math.max(0, from), to: Math.min(24, to) };
}

export type Placed<T> = { item: T; start: number; end: number; lane: number; lanes: number };

/**
 * Reparte en carriles lo que se solapa, como Google Calendar: cada grupo de cosas que se pisan comparte el ancho de
 * la columna a partes iguales.
 */
export function placeInLanes<T>(items: T[], range: (t: T) => { start: number; end: number }): Placed<T>[] {
  const sorted = items.map((item) => ({ item, ...range(item), lane: 0, lanes: 1 })).sort((a, b) => a.start - b.start || b.end - a.end);
  let group: Placed<T>[] = [];
  let groupEnd = -1;
  const laneEnds: number[] = [];
  const close = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const p of group) p.lanes = lanes;
    group = [];
    laneEnds.length = 0;
  };
  for (const p of sorted) {
    if (p.start >= groupEnd && group.length) close();
    let lane = laneEnds.findIndex((end) => end <= p.start);
    if (lane < 0) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = p.end;
    p.lane = lane;
    group.push(p);
    groupEnd = Math.max(groupEnd, p.end);
  }
  close();
  return sorted;
}
