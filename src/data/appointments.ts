// Citas (migración 013): la agenda del día, la próxima cita de cada paciente y lo que va a Google Calendar. La cita
// que se da al guardar una sesión lleva el id de esa sesión (src/data/clinical.ts, saveSession); las demás se dan
// desde la ficha. Al apuntar una sesión, las citas pendientes de ese día pasan a atendidas.
import { madridDay } from "../app/format";
import type { Db } from "./db";

export type AppointmentStatus = "scheduled" | "done" | "no_show" | "cancelled";
export type Appointment = { id: string; patientId: string; startsAt: string; minutes: number; status: AppointmentStatus };
/** Una cita con el nombre de su paciente, para la agenda. */
export type AgendaItem = Appointment & { name: string };

export const STATUS_LABELS: Record<AppointmentStatus, string> = { scheduled: "Pendiente", done: "Atendida", no_show: "No vino", cancelled: "Anulada" };

type Row = { id: string; patient_id: string; starts_at: string; minutes: number; status: AppointmentStatus; name?: string };
const toAppointment = (r: Row): Appointment => ({ id: r.id, patientId: r.patient_id, startsAt: r.starts_at, minutes: r.minutes, status: r.status });
const now = () => new Date().toISOString();

export function checkAppointment(startsAt: string, minutes: number) {
  if (Number.isNaN(Date.parse(startsAt))) throw new RangeError("Pon el día y la hora de la cita.");
  if (!(Number.isInteger(minutes) && minutes >= 5 && minutes <= 480)) throw new RangeError("Elige cuánto dura la cita.");
}

/** Da una cita sin sesión. Devuelve su id. */
export async function createAppointment(db: Db, patientId: string, input: { startsAt: string; minutes: number }): Promise<string> {
  checkAppointment(input.startsAt, input.minutes);
  const id = crypto.randomUUID();
  const t = now();
  await db.transaction([
    {
      sql: "insert into appointments (id, patient_id, starts_at, minutes, status, created_at, updated_at) values (?, ?, ?, ?, 'scheduled', ?, ?)",
      bind: [id, patientId, new Date(input.startsAt).toISOString(), input.minutes, t, t],
    },
  ]);
  return id;
}

/** Cambia el día, la duración o el estado. Cambiar el día la deja otra vez pendiente. */
export async function updateAppointment(db: Db, id: string, change: { startsAt?: string; minutes?: number; status?: AppointmentStatus }): Promise<void> {
  const current = await getAppointment(db, id);
  if (!current) throw new RangeError("Esta cita ya no existe.");
  const startsAt = change.startsAt !== undefined ? new Date(change.startsAt).toISOString() : current.startsAt;
  const minutes = change.minutes ?? current.minutes;
  checkAppointment(startsAt, minutes);
  const moved = startsAt !== current.startsAt;
  const status = change.status ?? (moved ? "scheduled" : current.status);
  await db.transaction([
    { sql: "update appointments set starts_at = ?, minutes = ?, status = ?, updated_at = ? where id = ?", bind: [startsAt, minutes, status, now(), id] },
  ]);
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

/** Las citas pendientes que aún no han llegado (para el calendario y «Próximas citas»). */
export async function upcomingAppointments(db: Db, at = new Date()): Promise<AgendaItem[]> {
  const rows = await db.query<Row>(
    `select a.*, p.name from appointments a join patients p on p.id = a.patient_id
      where a.status = 'scheduled' and a.starts_at > ? order by a.starts_at`,
    [at.toISOString()],
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
      sql: `insert into appointments (id, patient_id, starts_at, minutes, status, created_at, updated_at) values (?, ?, ?, ?, 'scheduled', ?, ?)
            on conflict (id) do update set starts_at = excluded.starts_at, minutes = excluded.minutes, status = 'scheduled', updated_at = excluded.updated_at
            where appointments.starts_at <> excluded.starts_at or appointments.minutes <> excluded.minutes`,
      bind: [sessionId, patientId, nextAt, minutes, t, t],
    },
  ];
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
