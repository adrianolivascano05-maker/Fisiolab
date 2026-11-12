// El calendario de cada paciente (migración 039): lo suyo fuera de la clínica que conviene tener a la vista junto a sus
// citas: una operación, sus entrenamientos o partidos, una consulta o una prueba médica, un viaje. No ocupan la agenda
// de la clínica, no se recuerdan por WhatsApp y no cuentan para los cobros ni las estadísticas.
//
// Los días van como AAAA-MM-DD (el día en Madrid, src/app/dates.ts), no como instante: un cambio de hora no los mueve.
// Un evento puede ser de un día, durar varios (`endsOn`) o repetirse cada semana unos días (`repeatDays`, hasta
// `repeatUntil` o sin fin). Las repeticiones no se guardan una a una: se calculan para los días que se ven
// (`occurrencesIn`), así una serie de entrenamientos sin fin es una sola fila.
import { addDays, dayOf, TZ } from "../app/dates";
import type { Db } from "./db";

export type EventKind = "surgery" | "medical" | "test" | "training" | "competition" | "travel" | "other";

/** Los tipos, en el orden en que se eligen. `hint`: un ejemplo para el nombre. */
export const EVENT_KINDS: { id: EventKind; label: string; hint: string }[] = [
  { id: "surgery", label: "Operación", hint: "Por ejemplo: ligamento cruzado, rodilla derecha" },
  { id: "medical", label: "Consulta médica", hint: "Por ejemplo: revisión con el traumatólogo" },
  { id: "test", label: "Prueba médica", hint: "Por ejemplo: resonancia de rodilla" },
  { id: "training", label: "Entrenamiento", hint: "Por ejemplo: entrenamiento con su equipo" },
  { id: "competition", label: "Competición", hint: "Por ejemplo: partido de liga, media maratón" },
  { id: "travel", label: "Viaje o vacaciones", hint: "Por ejemplo: vacaciones en el pueblo" },
  { id: "other", label: "Otro", hint: "Lo que quieras tener a la vista" },
];
const KINDS = new Set<string>(EVENT_KINDS.map((k) => k.id));
export const kindLabel = (k: EventKind) => EVENT_KINDS.find((x) => x.id === k)?.label ?? "Otro";

export type PatientEvent = {
  id: string;
  patientId: string;
  kind: EventKind;
  /** Lo que es, en sus palabras («Ligamento cruzado»). Vacío: se ve el tipo. */
  title: string;
  /** El día (o el primero de la serie o del periodo), AAAA-MM-DD. */
  startsOn: string;
  /** El último día, si dura varios. */
  endsOn: string | null;
  /** «HH:MM» en Madrid; sin hora, es de todo el día. */
  time: string | null;
  /** Cuánto dura, si tiene hora. */
  minutes: number | null;
  /** Días de la semana en que se repite (1 lunes … 7 domingo). Vacío: no se repite. */
  repeatDays: number[];
  /** El último día de la repetición (incluido). Sin él, sin fin. */
  repeatUntil: string | null;
  /** Días sueltos en que no toca, aunque se repita («este jueves no entrena»; migración 040). */
  skipDays: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};
export type EventInput = Pick<PatientEvent, "kind" | "title" | "startsOn" | "endsOn" | "time" | "minutes" | "repeatDays" | "repeatUntil" | "notes"> & {
  skipDays?: string[];
};

export const EVENT_LIMITS = { title: 120, notes: 2000, spanDays: 366, minutes: [5, 1440] as const, skipDays: 400 };
/** Cuánto dura un evento con hora si no se dice. */
export const DEFAULT_EVENT_MINUTES = 60;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** ¿Es un día de verdad (no «2026-02-30»)? */
export const isDay = (v: unknown): v is string => typeof v === "string" && DAY.test(v) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
/** Días entre dos fechas AAAA-MM-DD (`b` - `a`). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
/** Día de la semana de un día: 1 lunes … 7 domingo. */
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay() || 7;

/** Comprueba y deja limpio lo que se va a guardar. Los mensajes son para quien rellena la hoja. */
export function checkEvent(input: EventInput): EventInput & { skipDays: string[] } {
  if (!KINDS.has(input.kind)) throw new RangeError("Elige qué es.");
  if (!isDay(input.startsOn)) throw new RangeError("Pon el día.");
  const title = (input.title ?? "").trim();
  if (title.length > EVENT_LIMITS.title) throw new RangeError(`El nombre, como mucho ${EVENT_LIMITS.title} letras.`);
  const notes = (input.notes ?? "").trim();
  if (notes.length > EVENT_LIMITS.notes) throw new RangeError(`La nota, como mucho ${EVENT_LIMITS.notes} letras.`);
  const repeatDays = [...new Set((input.repeatDays ?? []).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b);
  let endsOn: string | null = input.endsOn || null;
  if (endsOn !== null) {
    if (!isDay(endsOn)) throw new RangeError("Revisa hasta qué día dura.");
    if (endsOn < input.startsOn) throw new RangeError("El último día no puede ser antes del primero.");
    if (daysBetween(input.startsOn, endsOn) > EVENT_LIMITS.spanDays) throw new RangeError("Como mucho un año seguido.");
    if (endsOn === input.startsOn) endsOn = null;
  }
  if (endsOn !== null && repeatDays.length) throw new RangeError("Si se repite cada semana, cada vez es de un día: quita el último día.");
  let repeatUntil: string | null = repeatDays.length ? input.repeatUntil || null : null;
  if (repeatUntil !== null) {
    if (!isDay(repeatUntil)) throw new RangeError("Revisa hasta cuándo se repite.");
    if (repeatUntil < input.startsOn) throw new RangeError("La repetición no puede acabar antes de empezar.");
  }
  const time = input.time || null;
  if (time !== null && !TIME.test(time)) throw new RangeError("Revisa la hora.");
  let minutes: number | null = null;
  if (time !== null) {
    minutes = input.minutes ?? DEFAULT_EVENT_MINUTES;
    if (!(Number.isInteger(minutes) && minutes >= EVENT_LIMITS.minutes[0] && minutes <= EVENT_LIMITS.minutes[1])) throw new RangeError("Revisa cuánto dura.");
  }
  // Los días que no, solo en lo que se repite: días de verdad, sin repetir y en orden.
  const skipDays = repeatDays.length ? [...new Set((input.skipDays ?? []).filter(isDay))].sort() : [];
  if (skipDays.length > EVENT_LIMITS.skipDays) throw new RangeError("Demasiados días sueltos: mejor cambia la serie.");
  return { kind: input.kind, title, startsOn: input.startsOn, endsOn, time, minutes, repeatDays, repeatUntil, notes, skipDays };
}

// ---------- Guardar y leer ----------

type Row = {
  id: string;
  patient_id: string;
  kind: string;
  title: string;
  starts_on: string;
  ends_on: string | null;
  time: string | null;
  minutes: number | null;
  repeat_days: string;
  repeat_until: string | null;
  notes: string;
  skip_days?: string;
  created_at: string;
  updated_at: string;
};
const toEvent = (r: Row): PatientEvent => ({
  id: r.id,
  patientId: r.patient_id,
  // Un tipo que esta versión no conoce (de una más nueva): se ve como «Otro».
  kind: KINDS.has(r.kind) ? (r.kind as EventKind) : "other",
  title: r.title ?? "",
  startsOn: r.starts_on,
  endsOn: r.ends_on ?? null,
  time: r.time ?? null,
  minutes: r.minutes ?? null,
  repeatDays: (r.repeat_days ?? "")
    .split(",")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7),
  repeatUntil: r.repeat_until ?? null,
  skipDays: (r.skip_days ?? "").split(",").filter(isDay),
  notes: r.notes ?? "",
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function listPatientEvents(db: Db, patientId: string): Promise<PatientEvent[]> {
  const rows = await db.query<Row>("select * from patient_events where patient_id = ? order by starts_on, coalesce(time, ''), created_at", [patientId]);
  return rows.map(toEvent);
}

export async function getPatientEvent(db: Db, id: string): Promise<PatientEvent | null> {
  const [row] = await db.query<Row>("select * from patient_events where id = ?", [id]);
  return row ? toEvent(row) : null;
}

/** Guarda un evento nuevo (sin `id`) o los cambios de uno. Devuelve su id. */
export async function savePatientEvent(db: Db, patientId: string, input: EventInput, id?: string): Promise<string> {
  const e = checkEvent(input);
  const t = new Date().toISOString();
  const values = [e.kind, e.title, e.startsOn, e.endsOn, e.time, e.minutes, e.repeatDays.join(","), e.repeatUntil, e.notes, e.skipDays.join(",")];
  if (id) {
    if (!(await getPatientEvent(db, id))) throw new RangeError("Este evento ya no existe.");
    await db.transaction([
      {
        sql: "update patient_events set kind = ?, title = ?, starts_on = ?, ends_on = ?, time = ?, minutes = ?, repeat_days = ?, repeat_until = ?, notes = ?, skip_days = ?, updated_at = ? where id = ?",
        bind: [...values, t, id],
      },
    ]);
    return id;
  }
  const newId = crypto.randomUUID();
  await db.transaction([
    {
      sql: `insert into patient_events (id, patient_id, kind, title, starts_on, ends_on, time, minutes, repeat_days, repeat_until, notes, skip_days, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [newId, patientId, ...values, t, t],
    },
  ]);
  return newId;
}

/** Los eventos de varios pacientes de una vez (la lista de hoy de la agenda): por paciente. */
export async function eventsOfPatients(db: Db, patientIds: string[]): Promise<Map<string, PatientEvent[]>> {
  const out = new Map<string, PatientEvent[]>();
  if (!patientIds.length) return out;
  const rows = await db.query<Row>("select * from patient_events where patient_id in (select value from json_each(?)) order by starts_on, coalesce(time, ''), created_at", [
    JSON.stringify(patientIds),
  ]);
  for (const r of rows) {
    const e = toEvent(r);
    const list = out.get(e.patientId);
    if (list) list.push(e);
    else out.set(e.patientId, [e]);
  }
  return out;
}

/** Lo que se guarda para cambiarlo (todo lo que se escribe en la hoja). */
export const inputOf = (e: PatientEvent): EventInput => ({
  kind: e.kind,
  title: e.title,
  startsOn: e.startsOn,
  endsOn: e.endsOn,
  time: e.time,
  minutes: e.minutes,
  repeatDays: e.repeatDays,
  repeatUntil: e.repeatUntil,
  notes: e.notes,
  skipDays: e.skipDays,
});
/** La serie sin ese día («este jueves no»). */
export const withoutDay = (e: PatientEvent, day: string): EventInput => ({ ...inputOf(e), skipDays: [...e.skipDays, day] });
/** La serie con ese día otra vez. */
export const withDay = (e: PatientEvent, day: string): EventInput => ({ ...inputOf(e), skipDays: e.skipDays.filter((d) => d !== day) });
/** La serie hasta el día antes de `day` («desde este día ya no»). Null si ese día es el primero: no quedaría nada. */
export function endedBefore(e: PatientEvent, day: string): EventInput | null {
  const until = addDays(day, -1);
  if (until < e.startsOn) return null;
  return { ...inputOf(e), repeatUntil: e.repeatUntil && e.repeatUntil < until ? e.repeatUntil : until, skipDays: e.skipDays.filter((d) => d <= until) };
}

export async function deletePatientEvent(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from patient_events where id = ?", bind: [id] }]);
}

// ---------- Los días de cada evento ----------

/** Un día de un evento. `first`/`last`: si es el primero o el último de un evento de varios días. */
export type Occurrence = { event: PatientEvent; day: string; first: boolean; last: boolean };

/** Lo más que se calcula de una vez (un año y un mes): basta para cualquier mes o lista que se vea. */
const MAX_RANGE = 400;

/** Los días de los eventos entre `from` y `to` (incluidos), ordenados por día y hora. */
export function occurrencesIn(events: PatientEvent[], from: string, to: string): Occurrence[] {
  if (to < from) return [];
  const end = daysBetween(from, to) > MAX_RANGE ? addDays(from, MAX_RANGE) : to;
  const out: Occurrence[] = [];
  for (const event of events) {
    if (event.repeatDays.length) {
      const last = event.repeatUntil && event.repeatUntil < end ? event.repeatUntil : end;
      for (let d = event.startsOn > from ? event.startsOn : from; d <= last; d = addDays(d, 1))
        if (event.repeatDays.includes(weekdayOf(d)) && !event.skipDays.includes(d)) out.push({ event, day: d, first: true, last: true });
      continue;
    }
    const lastDay = event.endsOn ?? event.startsOn;
    if (lastDay < from || event.startsOn > end) continue;
    for (let d = event.startsOn > from ? event.startsOn : from; d <= lastDay && d <= end; d = addDays(d, 1))
      out.push({ event, day: d, first: d === event.startsOn, last: d === lastDay });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || (a.event.time ?? "").localeCompare(b.event.time ?? "") || a.event.createdAt.localeCompare(b.event.createdAt));
}

/** «HH:MM» de un instante en Madrid. */
export const timeOf = (at: string | Date) => new Date(at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ });
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Los eventos de un paciente que coinciden con una cita (`startsAt`, `minutes`): los de ese día sin hora y los que se
 * pisan con ella. Los entrenamientos sin hora no avisan (serían casi todos los días); con hora, solo si se pisan.
 */
export function eventsAtVisit(events: PatientEvent[], startsAt: string, minutes: number): Occurrence[] {
  const day = dayOf(startsAt);
  const start = minutesOf(timeOf(startsAt));
  const end = start + minutes;
  return occurrencesIn(events, day, day).filter(({ event }) => {
    if (event.time === null) return event.kind !== "training";
    const s = minutesOf(event.time);
    return s < end && s + (event.minutes ?? DEFAULT_EVENT_MINUTES) > start;
  });
}

// ---------- En palabras ----------

const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const WEEKDAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
export const weekdayName = (d: number) => WEEKDAYS[d - 1] ?? "";
const list = (items: string[]) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`);
/** «12 nov 2026». */
export const dayShort = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** «martes 12 de noviembre». */
export const dayLong = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** «martes y jueves» (los días en que se repite). */
export const repeatText = (days: number[]) => list(days.map(weekdayName));

/** Un evento tal como está guardado (la exportación lee las tablas en crudo): el mismo que da la app al leerlo. */
export const eventFromRow = (r: Record<string, unknown>): PatientEvent => toEvent(r as Row);

/** El nombre que se ve: el suyo o, sin él, el tipo. */
export const eventName = (e: PatientEvent) => e.title || kindLabel(e.kind);

/** «Todo el día» o «10:30 · 90 min». */
export function eventTime(e: Pick<PatientEvent, "time" | "minutes">): string {
  if (!e.time) return "Todo el día";
  return `${e.time} · ${e.minutes ?? DEFAULT_EVENT_MINUTES} min`;
}

/** Cuándo es, más allá del día: «Del 1 al 15 ago 2026» o «Cada martes y jueves desde el 4 nov 2026, sin fin». */
export function eventSpan(e: PatientEvent): string {
  if (e.repeatDays.length) {
    const days = repeatText(e.repeatDays);
    return `Cada ${days} desde el ${dayShort(e.startsOn)}${e.repeatUntil ? ` hasta el ${dayShort(e.repeatUntil)}` : ", sin fecha de fin"}`;
  }
  if (e.endsOn) return `Del ${dayShort(e.startsOn)} al ${dayShort(e.endsOn)}`;
  return dayShort(e.startsOn);
}

/** «hoy», «ayer», «hace 9 días», «hace 6 semanas y 2 días». */
export function agoText(days: number): string {
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 14) return `hace ${days} días`;
  const w = Math.floor(days / 7);
  const r = days % 7;
  return `hace ${w} semanas${r ? ` y ${r === 1 ? "1 día" : `${r} días`}` : ""}`;
}
/** «hoy», «mañana», «en 12 días». */
export const inText = (days: number) => (days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`);

/** Lo que conviene ver en su ficha: una cosa con su texto y su día. */
export type EventNote = { event: PatientEvent; day: string; text: string };

/** Lo que se cuenta: la última operación (si fue hace menos de un año) y lo próximo importante de los dos meses que vienen. */
const SOON = 60;
const RECENT = 365;
const AHEAD: EventKind[] = ["surgery", "competition", "medical", "test", "travel"];

/**
 * Para el resumen de la ficha: cuánto hace de su última operación y lo próximo (operación, competición, consulta o
 * prueba médica, viaje) en los dos meses que vienen, como mucho dos. Solo días y semanas: la app no interpreta nada.
 */
export function eventNotes(events: PatientEvent[], today: string, opts: { brief?: boolean } = {}): EventNote[] {
  const out: EventNote[] = [];
  // Corto (la lista de hoy, la sesión): sin la fecha entre paréntesis.
  const on = (day: string) => (opts.brief ? "" : ` (${dayShort(day)})`);
  const past = events
    .filter((e) => e.kind === "surgery" && !e.repeatDays.length && e.startsOn <= today && daysBetween(e.startsOn, today) <= RECENT)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0];
  if (past) out.push({ event: past, day: past.startsOn, text: `${eventName(past)}: ${agoText(daysBetween(past.startsOn, today))}${on(past.startsOn)}` });
  // Un viaje en curso: hasta cuándo.
  const away = events.find((e) => e.kind === "travel" && e.endsOn && e.startsOn <= today && e.endsOn >= today);
  if (away) out.push({ event: away, day: today, text: `${eventName(away)}: hasta el ${dayShort(away.endsOn!)}` });
  const seen = new Set(out.map((n) => n.event.id));
  const next = occurrencesIn(
    events.filter((e) => AHEAD.includes(e.kind) && !seen.has(e.id)),
    today,
    addDays(today, SOON),
  ).filter((o, i, all) => o.first && all.findIndex((x) => x.event.id === o.event.id) === i);
  for (const o of next.slice(0, 2)) out.push({ event: o.event, day: o.day, text: `${eventName(o.event)}: ${inText(daysBetween(today, o.day))}${on(o.day)}` });
  return out;
}

/**
 * Cuánto había pasado de su última operación (de menos de un año) el día `day`: para cada sesión. Solo cuenta días;
 * no dice en qué fase está ni qué toca.
 */
export function sinceSurgery(events: PatientEvent[], day: string): { event: PatientEvent; days: number } | null {
  const op = events
    .filter((e) => e.kind === "surgery" && !e.repeatDays.length && e.startsOn <= day && daysBetween(e.startsOn, day) <= RECENT)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0];
  return op ? { event: op, days: daysBetween(op.startsOn, day) } : null;
}
/** «el día de la operación», «3 días tras la operación», «4 semanas y 2 días tras la operación». */
export function afterSurgeryText(days: number): string {
  if (days === 0) return "el día de la operación";
  if (days < 14) return `${days === 1 ? "1 día" : `${days} días`} tras la operación`;
  const w = Math.floor(days / 7);
  const r = days % 7;
  return `${w} semanas${r ? ` y ${r === 1 ? "1 día" : `${r} días`}` : ""} tras la operación`;
}
