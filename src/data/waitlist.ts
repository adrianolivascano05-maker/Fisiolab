// Lista de espera (migración 020): pacientes que quieren un hueco antes (o cualquiera), con cuándo les viene bien y,
// en un equipo, con quién. Al anular o borrar una cita, la agenda enseña a quién ofrecérselo, con el mensaje listo
// para WhatsApp o correo (src/schedule/WaitlistPage.tsx). Quien ya tiene su hueco se quita de la lista.
import type { Db } from "./db";

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export type WaitInput = { note: string; assignedTo: string | null };
export type WaitItem = WaitInput & {
  id: string;
  patientId: string;
  name: string;
  phone: string;
  email: string;
  /** Permiso para WhatsApp o correo (src/data/privacy.ts); null si no consta. */
  contact: boolean | null;
  createdAt: string;
  /** Su próxima cita pendiente, si tiene (para ver si adelantarla). */
  nextAt: string | null;
};

type Row = { id: string; patient_id: string; note: string; assigned_to: string | null; created_at: string; name: string; phone: string | null; email: string | null; privacy: string | null; next_at: string | null };

const contactOf = (privacy: string | null): boolean | null => {
  try {
    const v = (JSON.parse(privacy || "{}") as { consents?: { contact?: boolean } }).consents?.contact;
    return typeof v === "boolean" ? v : null;
  } catch {
    return null;
  }
};

/** La lista, los que más llevan esperando primero. Con `forWhom`, los que esperan a esa persona o a cualquiera. */
export async function listWaitlist(db: Db, forWhom?: string | null): Promise<WaitItem[]> {
  const rows = await db.query<Row>(
    `select w.*, p.name, p.phone, p.email, p.privacy,
            (select min(a.starts_at) from appointments a where a.patient_id = w.patient_id and a.status = 'scheduled' and a.starts_at > ?) as next_at
       from waitlist w join patients p on p.id = w.patient_id
      ${forWhom ? "where w.assigned_to is null or w.assigned_to = ?" : ""}
      order by w.created_at`,
    forWhom ? [now(), forWhom] : [now()],
  );
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    note: r.note,
    assignedTo: r.assigned_to,
    createdAt: r.created_at,
    name: r.name,
    phone: r.phone ?? "",
    email: r.email ?? "",
    contact: contactOf(r.privacy),
    nextAt: r.next_at,
  }));
}

export async function addToWaitlist(db: Db, patientId: string, w: WaitInput): Promise<string> {
  const [dup] = await db.query<{ id: string }>("select id from waitlist where patient_id = ?", [patientId]);
  if (dup) throw new RangeError("Ya está en la lista de espera.");
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: "insert into waitlist (id, patient_id, note, assigned_to, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
      bind: [id, patientId, w.note.trim(), w.assignedTo, t, t],
    },
  ]);
  return id;
}

export async function removeFromWaitlist(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from waitlist where id = ?", bind: [id] }]);
}

/** Quita al paciente de la lista (al darle cita desde ella). */
export async function removePatientFromWaitlist(db: Db, patientId: string): Promise<void> {
  await db.transaction([{ sql: "delete from waitlist where patient_id = ?", bind: [patientId] }]);
}

export async function waitlistCount(db: Db): Promise<number> {
  return Number((await db.query<{ n: number }>("select count(*) as n from waitlist"))[0]?.n ?? 0);
}
