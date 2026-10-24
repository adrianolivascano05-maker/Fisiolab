// Citas (migración 013): la agenda del día, la próxima cita de cada paciente y lo que va a Google Calendar. La cita
// que se da al guardar una sesión lleva el id de esa sesión (src/data/clinical.ts, saveSession); las demás se dan
// desde la ficha. Al apuntar una sesión, las citas pendientes de ese día pasan a atendidas. En una clínica, cada cita
// lleva quién la dio (migración 014) y con quién es (migración 015, el horario): va al Google Calendar de esa persona.
import { madridDay } from "../app/format";
import type { Db } from "./db";
import { member, memberEmail } from "./member";

export type AppointmentStatus = "scheduled" | "done" | "no_show" | "cancelled";
/** `assignedTo`: con quién es (correo del equipo de la clínica); null, con quien la dio o sin clínica. */
export type Appointment = {
  id: string;
  patientId: string;
  startsAt: string;
  minutes: number;
  status: AppointmentStatus;
  assignedTo: string | null;
  /** Cuándo se le recordó y cuándo confirmó que viene (migración 018). Se borran al mover la cita. */
  remindedAt?: string | null;
  confirmedAt?: string | null;
};
/** Una cita con el nombre de su paciente, para la agenda. */
export type AgendaItem = Appointment & { name: string };

export const STATUS_LABELS: Record<AppointmentStatus, string> = { scheduled: "Pendiente", done: "Atendida", no_show: "No vino", cancelled: "Anulada" };

type Row = {
  id: string;
  patient_id: string;
  starts_at: string;
  minutes: number;
  status: AppointmentStatus;
  assigned_to: string | null;
  reminded_at?: string | null;
  confirmed_at?: string | null;
  name?: string;
};
const toAppointment = (r: Row): Appointment => ({
  id: r.id,
  patientId: r.patient_id,
  startsAt: r.starts_at,
  minutes: r.minutes,
  status: r.status,
  assignedTo: r.assigned_to,
  remindedAt: r.reminded_at ?? null,
  confirmedAt: r.confirmed_at ?? null,
});
const now = () => new Date().toISOString();

export function checkAppointment(startsAt: string, minutes: number) {
  if (Number.isNaN(Date.parse(startsAt))) throw new RangeError("Pon el día y la hora de la cita.");
  if (!(Number.isInteger(minutes) && minutes >= 5 && minutes <= 480)) throw new RangeError("Elige cuánto dura la cita.");
}

/** Da una cita sin sesión (en una clínica, por defecto con quien la da). Devuelve su id. */
export async function createAppointment(db: Db, patientId: string, input: { startsAt: string; minutes: number; assignedTo?: string | null }): Promise<string> {
  checkAppointment(input.startsAt, input.minutes);
  const id = crypto.randomUUID();
  const t = now();
  await db.transaction([
    {
      sql: "insert into appointments (id, patient_id, starts_at, minutes, status, created_by, assigned_to, created_at, updated_at) values (?, ?, ?, ?, 'scheduled', ?, ?, ?, ?)",
      bind: [id, patientId, new Date(input.startsAt).toISOString(), input.minutes, member(), input.assignedTo === undefined ? memberEmail() : input.assignedTo, t, t],
    },
  ]);
  return id;
}

/** Cambia el día, la duración, el estado o con quién es. Cambiar el día la deja otra vez pendiente. */
export async function updateAppointment(
  db: Db,
  id: string,
  change: { startsAt?: string; minutes?: number; status?: AppointmentStatus; assignedTo?: string | null },
): Promise<void> {
  const current = await getAppointment(db, id);
  if (!current) throw new RangeError("Esta cita ya no existe.");
  const startsAt = change.startsAt !== undefined ? new Date(change.startsAt).toISOString() : current.startsAt;
  const minutes = change.minutes ?? current.minutes;
  checkAppointment(startsAt, minutes);
  const moved = startsAt !== current.startsAt;
  const status = change.status ?? (moved ? "scheduled" : current.status);
  const assignedTo = change.assignedTo === undefined ? current.assignedTo : change.assignedTo;
  // Otro día u otra hora: el recordatorio y la confirmación eran de la cita de antes.
  const reset = moved ? ", reminded_at = null, confirmed_at = null" : "";
  await db.transaction([
    {
      sql: `update appointments set starts_at = ?, minutes = ?, status = ?, assigned_to = ?, updated_at = ?${reset} where id = ?`,
      bind: [startsAt, minutes, status, assignedTo, now(), id],
    },
  ]);
}

/** Se le ha recordado la cita (por WhatsApp o correo). */
export async function markReminded(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "update appointments set reminded_at = ?, updated_at = ? where id = ?", bind: [now(), now(), id] }]);
}

/** El paciente ha confirmado que viene (o se deshace). */
export async function markConfirmed(db: Db, id: string, confirmed: boolean): Promise<void> {
  await db.transaction([{ sql: "update appointments set confirmed_at = ?, updated_at = ? where id = ?", bind: [confirmed ? now() : null, now(), id] }]);
}

/** Una cita para recordar: con el teléfono, el correo y el permiso de contacto del paciente. */
export type ReminderItem = AgendaItem & { phone: string; email: string; contact: boolean | null };

/** Las citas pendientes entre dos instantes, con lo necesario para recordárselas al paciente. */
export async function remindersBetween(db: Db, from: string, to: string): Promise<ReminderItem[]> {
  const rows = await db.query<Row & { phone: string; email: string; privacy: string }>(
    `select a.*, p.name, p.phone, p.email, p.privacy from appointments a join patients p on p.id = a.patient_id
      where a.starts_at >= ? and a.starts_at < ? and a.status = 'scheduled' order by a.starts_at, p.name collate nocase`,
    [from, to],
  );
  return rows.map((r) => {
    let contact: boolean | null = null;
    try {
      const v = (JSON.parse(r.privacy || "{}") as { consents?: { contact?: boolean } }).consents?.contact;
      contact = typeof v === "boolean" ? v : null;
    } catch {
      /* sin datos de privacidad */
    }
    return { ...toAppointment(r), name: r.name!, phone: r.phone ?? "", email: r.email ?? "", contact };
  });
}

export async function deleteAppointment(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from appointments where id = ?", bind: [id] }]);
}

export async function getAppointment(db: Db, id: string): Promise<Appointment | null> {
  const [row] = await db.query<Row>("select * from appointments where id = ?", [id]);
  return row ? toAppointment(row) : null;
}

/** Las citas que empiezan entre dos instantes (todas, también las anuladas), con el nombre del paciente. */
export async function agenda(db: Db, from: string, to: string): Promise<AgendaItem[]> {
  const rows = await db.query<Row>(
    `select a.*, p.name from appointments a join patients p on p.id = a.patient_id
      where a.starts_at >= ? and a.starts_at < ? order by a.starts_at, p.name collate nocase`,
    [from, to],
  );
  return rows.map((r) => ({ ...toAppointment(r), name: r.name! }));
}

/**
 * Las citas pendientes que se pisan con una de `minutes` minutos a las `startsAt`. `assignedTo`: solo las de esa persona
 * de la clínica (undefined: todas, sin equipo; null: sin asignar, no se comprueba). `except`: la propia cita, al cambiarla.
 */
export async function clashes(db: Db, startsAt: string, minutes: number, assignedTo?: string | null, except?: string): Promise<AgendaItem[]> {
  if (assignedTo === null) return [];
  const start = Date.parse(startsAt);
  const end = start + minutes * 60_000;
  const near = await agenda(db, new Date(start - 8 * 3_600_000).toISOString(), new Date(end).toISOString());
  return near.filter(
    (a) =>
      a.id !== except &&
      a.status === "scheduled" &&
      (assignedTo === undefined || a.assignedTo === assignedTo) &&
      Date.parse(a.startsAt) < end &&
      Date.parse(a.startsAt) + a.minutes * 60_000 > start,
  );
}

/** Da `count` citas, una por semana a la misma hora, empezando en `startsAt` (una serie de sesiones). Sus ids. */
export async function createWeekly(db: Db, patientId: string, input: { startsAt: string; minutes: number; assignedTo?: string | null }, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(input.startsAt);
    d.setDate(d.getDate() + 7 * i); // misma hora local aunque cambie el horario de verano
    ids.push(await createAppointment(db, patientId, { ...input, startsAt: d.toISOString() }));
  }
  return ids;
}

/** Una persona de la clínica: su `sub` de Google y su correo. */
export type Worker = { sub: string; email: string | null };

/**
 * Las citas pendientes que aún no han llegado (para el calendario y «Próximas citas»). `by`: solo las de esa persona
 * de la clínica, las de su Google Calendar: las que son con ella y las que dio sin decir con quién.
 */
export async function upcomingAppointments(db: Db, at = new Date(), by: Worker | null = null): Promise<AgendaItem[]> {
  const rows = await db.query<Row>(
    `select a.*, p.name from appointments a join patients p on p.id = a.patient_id
      where a.status = 'scheduled' and a.starts_at > ?
        and (? is null or a.assigned_to = ? or (a.assigned_to is null and a.created_by = ?))
      order by a.starts_at`,
    [at.toISOString(), by?.sub ?? null, by?.email ?? null, by?.sub ?? null],
  );
  return rows.map((r) => ({ ...toAppointment(r), name: r.name! }));
}

/** La próxima cita pendiente de un paciente. */
export async function nextAppointmentOf(db: Db, patientId: string, at = new Date()): Promise<Appointment | null> {
  const [row] = await db.query<Row>("select * from appointments where patient_id = ? and status = 'scheduled' and starts_at > ? order by starts_at limit 1", [
    patientId,
    at.toISOString(),
  ]);
  return row ? toAppointment(row) : null;
}

/**
 * Lo que hay que hacer con las citas al guardar una sesión: la siguiente cita que se pone en ella (con el id de la
 * sesión; si no cambia, no se toca) o, si se quita, borrarla mientras siga pendiente.
 */
export function sessionAppointmentSql(sessionId: string, patientId: string, nextAt: string | null, minutes: number | null, t: string) {
  if (nextAt === null) return [{ sql: "delete from appointments where id = ? and status = 'scheduled'", bind: [sessionId] }];
  return [
    {
      sql: `insert into appointments (id, patient_id, starts_at, minutes, status, created_by, assigned_to, created_at, updated_at) values (?, ?, ?, ?, 'scheduled', ?, ?, ?, ?)
            on conflict (id) do update set starts_at = excluded.starts_at, minutes = excluded.minutes, status = 'scheduled', updated_at = excluded.updated_at,
              -- Otra hora: el recordatorio y la confirmación eran de la de antes (como al moverla en la agenda).
              reminded_at = case when appointments.starts_at <> excluded.starts_at then null else appointments.reminded_at end,
              confirmed_at = case when appointments.starts_at <> excluded.starts_at then null else appointments.confirmed_at end
            where appointments.starts_at <> excluded.starts_at or appointments.minutes <> excluded.minutes`,
      bind: [sessionId, patientId, nextAt, minutes, member(), memberEmail(), t, t],
    },
  ];
}

/**
 * La última visita que ya ha empezado, para el justificante: su cita (atendida o aún sin marcar) o, si es más reciente,
 * su última sesión apuntada (45 minutos). null si no ha venido nunca.
 */
export async function lastVisitOf(db: Db, patientId: string, at = new Date()): Promise<{ startsAt: string; minutes: number; appointmentId: string | null } | null> {
  const now = at.toISOString();
  const [a] = await db.query<Row>("select * from appointments where patient_id = ? and status in ('done', 'scheduled') and starts_at <= ? order by starts_at desc limit 1", [patientId, now]);
  const [s] = await db.query<{ performed_at: string }>("select performed_at from sessions where patient_id = ? and performed_at <= ? order by performed_at desc limit 1", [patientId, now]);
  // Una sesión de otro día, más reciente que la última cita: esa es la visita.
  if (s && (!a || (madridDay(s.performed_at) > madridDay(a.starts_at) && s.performed_at > a.starts_at))) return { startsAt: s.performed_at, minutes: 45, appointmentId: null };
  return a ? { startsAt: a.starts_at, minutes: a.minutes, appointmentId: a.id } : null;
}

/** Al apuntar una sesión: sus citas pendientes de ese mismo día (en Madrid) pasan a atendidas. */
export async function markAttended(db: Db, patientId: string, performedAt: string, except: string): Promise<void> {
  const day = madridDay(performedAt);
  const rows = await db.query<Row>("select * from appointments where patient_id = ? and status = 'scheduled' and id <> ?", [patientId, except]);
  const ids = rows.filter((r) => madridDay(r.starts_at) === day).map((r) => r.id);
  if (!ids.length) return;
  const t = now();
  await db.transaction(ids.map((id) => ({ sql: "update appointments set status = 'done', updated_at = ? where id = ?", bind: [t, id] })));
}
