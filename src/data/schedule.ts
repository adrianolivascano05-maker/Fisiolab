// Horario de la clínica (migración 015, src/schedule): el equipo con su nombre y color, los turnos de cada persona y
// lo que hace falta para ver de un vistazo quién trabaja cuándo y con quién es cada cita. Se sincroniza como el resto
// de la base: cada compañero lo ve en sus dispositivos.
import type { Db } from "./db";

export type Staff = { email: string; name: string; color: number };
export type Shift = { id: string; staffEmail: string; startsAt: string; endsAt: string; note: string };

/** Colores del equipo en el horario: distintos entre sí y legibles en claro y en oscuro (solo marcas, nunca texto). */
const STAFF_COLORS = ["#2563eb", "#d97706", "#059669", "#db2777", "#7c3aed", "#0891b2", "#65a30d", "#dc2626"];
export const staffColor = (s: Pick<Staff, "color"> | undefined) => STAFF_COLORS[(s?.color ?? 0) % STAFF_COLORS.length]!;

const now = () => new Date().toISOString();
const clean = (email: string) => email.trim().toLowerCase();
/** El nombre que se pone a alguien de quien solo se sabe el correo: lo de antes de la arroba. */
const nameFromEmail = (email: string) => clean(email).split("@")[0]!;

export async function listStaff(db: Db): Promise<Staff[]> {
  return db.query<Staff>("select email, name, color from staff order by name collate nocase, email");
}

/**
 * Que alguien del equipo esté en el horario. Si ya está, no se toca, salvo `own`: quien entra pone su nombre de
 * Google si el que había era solo el de su correo.
 */
export async function ensureStaff(db: Db, email: string, name: string, own = false): Promise<void> {
  const e = clean(email);
  const [row] = await db.query<{ name: string }>("select name from staff where email = ?", [e]);
  const wanted = name.trim() || nameFromEmail(e);
  if (row) {
    if (own && row.name === nameFromEmail(e) && wanted !== row.name) await renameStaff(db, e, wanted);
    return;
  }
  const [{ n }] = (await db.query<{ n: number }>("select count(*) as n from staff")) as [{ n: number }];
  await db.transaction([{ sql: "insert into staff (email, name, color, updated_at) values (?, ?, ?, ?)", bind: [e, wanted, n % STAFF_COLORS.length, now()] }]);
}

async function renameStaff(db: Db, email: string, name: string): Promise<void> {
  if (!name.trim()) throw new RangeError("Escribe el nombre.");
  await db.transaction([{ sql: "update staff set name = ?, updated_at = ? where email = ?", bind: [name.trim(), now(), clean(email)] }]);
}

/**
 * Alguien deja el equipo: sale del horario, se borran sus turnos desde `from` y sus citas pendientes desde entonces
 * quedan sin asignar, para dárselas a otra persona. Lo pasado se queda como estaba.
 */
export async function removeStaff(db: Db, email: string, from = new Date()): Promise<void> {
  const e = clean(email);
  const at = from.toISOString();
  await db.transaction([
    { sql: "delete from staff where email = ?", bind: [e] },
    { sql: "delete from shifts where staff_email = ? and starts_at >= ?", bind: [e, at] },
    {
      sql: "update appointments set assigned_to = null, updated_at = ? where assigned_to = ? and status = 'scheduled' and starts_at >= ?",
      bind: [now(), e, at],
    },
  ]);
}

type ShiftRow = { id: string; staff_email: string; starts_at: string; ends_at: string; note: string };
const toShift = (r: ShiftRow): Shift => ({ id: r.id, staffEmail: r.staff_email, startsAt: r.starts_at, endsAt: r.ends_at, note: r.note });

/** Los turnos que se solapan con [from, to), por orden. */
export async function shiftsBetween(db: Db, from: string, to: string): Promise<Shift[]> {
  const rows = await db.query<ShiftRow>("select * from shifts where starts_at < ? and ends_at > ? order by starts_at, staff_email", [to, from]);
  return rows.map(toShift);
}

export type ShiftInput = { staffEmail: string; startsAt: string; endsAt: string; note: string };

function checkShift(s: ShiftInput) {
  if (!s.staffEmail.trim()) throw new RangeError("Elige de quién es el turno.");
  const start = Date.parse(s.startsAt);
  const end = Date.parse(s.endsAt);
  if (Number.isNaN(start) || Number.isNaN(end)) throw new RangeError("Pon el día y las horas del turno.");
  if (end <= start) throw new RangeError("La hora de salida tiene que ser después de la de entrada.");
  if (end - start > 16 * 3600_000) throw new RangeError("Un turno no puede pasar de 16 horas.");
}

/** El mismo instante, `weeks` semanas después, a la misma hora del reloj (también si por medio cambia la hora). */
export function plusWeeks(iso: string, weeks: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString();
}

/** Pone un turno y, con `repeatWeeks`, el mismo en las semanas siguientes. Devuelve los ids. */
export async function createShift(db: Db, input: ShiftInput, repeatWeeks = 0): Promise<string[]> {
  checkShift(input);
  const t = now();
  const ids: string[] = [];
  const statements = [];
  for (let w = 0; w <= Math.max(0, Math.min(52, Math.floor(repeatWeeks))); w++) {
    const id = crypto.randomUUID();
    ids.push(id);
    statements.push({
      sql: "insert into shifts (id, staff_email, starts_at, ends_at, note, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
      bind: [id, clean(input.staffEmail), plusWeeks(new Date(input.startsAt).toISOString(), w), plusWeeks(new Date(input.endsAt).toISOString(), w), input.note.trim(), t, t],
    });
  }
  await db.transaction(statements);
  return ids;
}

export async function updateShift(db: Db, id: string, input: ShiftInput): Promise<void> {
  checkShift(input);
  await db.transaction([
    {
      sql: "update shifts set staff_email = ?, starts_at = ?, ends_at = ?, note = ?, updated_at = ? where id = ?",
      bind: [clean(input.staffEmail), new Date(input.startsAt).toISOString(), new Date(input.endsAt).toISOString(), input.note.trim(), now(), id],
    },
  ]);
}

export async function deleteShift(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from shifts where id = ?", bind: [id] }]);
}

/**
 * Copia los turnos de la semana que empieza en `from` a la semana siguiente (los dos, instantes ISO del lunes a las
 * 0:00). Los que ya estén (misma persona y misma hora) no se repiten. Devuelve cuántos ha puesto.
 */
export async function copyWeekForward(db: Db, from: string): Promise<number> {
  const to = plusWeeks(from, 1);
  const source = await shiftsBetween(db, from, to);
  const existing = await shiftsBetween(db, to, plusWeeks(from, 2));
  const taken = new Set(existing.map((s) => `${s.staffEmail}|${s.startsAt}`));
  const t = now();
  const statements = source
    .filter((s) => s.startsAt >= from)
    .map((s) => ({ ...s, startsAt: plusWeeks(s.startsAt, 1), endsAt: plusWeeks(s.endsAt, 1) }))
    .filter((s) => !taken.has(`${s.staffEmail}|${s.startsAt}`))
    .map((s) => ({
      sql: "insert into shifts (id, staff_email, starts_at, ends_at, note, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
      bind: [crypto.randomUUID(), s.staffEmail, s.startsAt, s.endsAt, s.note, t, t],
    }));
  if (statements.length) await db.transaction(statements);
  return statements.length;
}

/** Si una cita (de `startsAt` y `minutes`) cae dentro de algún turno de esa persona. */
export function withinShift(shifts: Shift[], email: string, startsAt: string, minutes: number): boolean {
  const start = Date.parse(startsAt);
  const end = start + minutes * 60_000;
  return shifts.some((s) => s.staffEmail === email && Date.parse(s.startsAt) <= start && Date.parse(s.endsAt) >= end);
}
