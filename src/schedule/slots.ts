// Huecos para dar una cita (AppointmentForm.tsx): las horas libres de un día y tres propuestas para los próximos días.
// Libre quiere decir: dentro del turno de con quién es (o, sin turnos esa semana, de lunes a viernes de 9 a 20), sin
// otra cita a esa hora, con la agenda abierta y sin nada en el calendario del paciente (viaje, operación, prueba,
// competición o un entrenamiento a esa hora). Sin base de datos ni pantalla: se prueba sola (slots.test.ts).
import { addDays, dayOf } from "../app/dates";
import type { Appointment } from "../data/appointments";
import type { Closure } from "../data/closures";
import { eventsAtVisit, type PatientEvent } from "../data/patientEvents";
import type { Shift } from "../data/schedule";

/** Sin turnos puestos esa semana: el horario que se supone, de lunes a viernes. */
export const DEFAULT_HOURS = { from: 9, to: 20 };
/** Las horas se proponen de media en media hora. */
const STEP = 30;

export type SlotInput = {
  now: Date;
  /** Lo que dura la cita. */
  minutes: number;
  /** Las citas que ocupan (las de con quién es, en una clínica; todas, si no hay equipo). Las anuladas no cuentan. */
  busy: readonly Pick<Appointment, "startsAt" | "minutes" | "status">[];
  /** La agenda cerrada (de toda la clínica y de con quién es). */
  closures: readonly Pick<Closure, "startsAt" | "endsAt">[];
  /** Los turnos de con quién es; vacío si no hay equipo o no se ha elegido a nadie. */
  shifts: readonly Pick<Shift, "startsAt" | "endsAt">[];
  /** El calendario del paciente. */
  events: PatientEvent[];
};

const ms = (iso: string) => Date.parse(iso);
/** El lunes de la semana de un día (AAAA-MM-DD). */
const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
/** Un instante a esa hora local de ese día. */
const at = (day: string, hour: number, minute = 0) => new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`).getTime();

/** Las horas libres de un día (instantes ISO), de media en media hora, de la más temprana a la más tardía. */
export function freeStarts(input: SlotInput, day: string): string[] {
  const { now, minutes, busy, closures, shifts, events } = input;
  const span = minutes * 60_000;
  // Dentro de los turnos de ese día; si esa semana no hay ninguno puesto, el horario supuesto (y nunca en fin de semana).
  const week = mondayOf(day);
  const weekHasShifts = shifts.some((s) => mondayOf(dayOf(s.startsAt)) === week);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const windows = weekHasShifts
    ? shifts.filter((s) => dayOf(s.startsAt) === day).map((s) => ({ from: ms(s.startsAt), to: ms(s.endsAt) }))
    : weekday === 0 || weekday === 6
      ? []
      : [{ from: at(day, DEFAULT_HOURS.from), to: at(day, DEFAULT_HOURS.to) }];
  const taken = busy.filter((a) => a.status !== "cancelled").map((a) => ({ from: ms(a.startsAt), to: ms(a.startsAt) + a.minutes * 60_000 }));
  const shut = closures.map((c) => ({ from: ms(c.startsAt), to: ms(c.endsAt) }));
  // Desde dentro de una hora, como pronto.
  const earliest = now.getTime() + 60 * 60_000;
  const out: string[] = [];
  for (const w of windows.sort((a, b) => a.from - b.from)) {
    // A la media hora en punto (hora local) dentro del turno.
    const first = Math.ceil(w.from / (STEP * 60_000)) * STEP * 60_000;
    for (let t = first; t + span <= w.to; t += STEP * 60_000) {
      if (t < earliest) continue;
      if ([...taken, ...shut].some((b) => b.from < t + span && b.to > t)) continue;
      const iso = new Date(t).toISOString();
      if (eventsAtVisit(events, iso, minutes).length) continue;
      if (!out.includes(iso)) out.push(iso);
    }
  }
  return out.sort();
}

/** Día de la semana y hora local («2 10:00») de una cita. */
const slotKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDay()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Su hora de siempre: el día de la semana y la hora que más se repiten en sus citas (al menos dos veces); null si no la hay. */
export function usualSlot(past: readonly Pick<Appointment, "startsAt" | "status">[]): string | null {
  const counts = new Map<string, number>();
  for (const a of past) if (a.status !== "cancelled") counts.set(slotKey(a.startsAt), (counts.get(slotKey(a.startsAt)) ?? 0) + 1);
  const [best] = [...counts].sort((a, b) => b[1] - a[1]);
  return best && best[1] >= 2 ? best[0] : null;
}

export type Slot = { startsAt: string; usual: boolean };

/**
 * Hasta `count` huecos propuestos en los próximos `days` días: primero su hora de siempre (si está libre) y, después,
 * los más cercanos, cada uno de un día distinto para que haya dónde elegir.
 */
export function proposeSlots(input: SlotInput & { past?: readonly Pick<Appointment, "startsAt" | "status">[]; days?: number; count?: number }): Slot[] {
  const { days = 21, count = 3 } = input;
  const today = dayOf(input.now);
  const byDay: [string, string[]][] = [];
  for (let i = 0; i <= days; i++) {
    const day = addDays(today, i);
    const free = freeStarts(input, day);
    if (free.length) byDay.push([day, free]);
  }
  const out: Slot[] = [];
  const usual = usualSlot(input.past ?? []);
  if (usual) {
    const hit = byDay.flatMap(([, free]) => free).find((iso) => slotKey(iso) === usual);
    if (hit) out.push({ startsAt: hit, usual: true });
  }
  for (const [day, free] of byDay) {
    if (out.length >= count) break;
    if (out.some((s) => dayOf(s.startsAt) === day)) continue;
    out.push({ startsAt: free[0]!, usual: false });
  }
  return out.sort((a, b) => Number(b.usual) - Number(a.usual) || a.startsAt.localeCompare(b.startsAt));
}
