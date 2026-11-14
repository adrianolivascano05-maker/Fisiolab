// Agenda cerrada (migración 029): ratos sin citas, de una persona o de toda la clínica (staffEmail vacío), que salen
// rayados en la agenda. Una tarde, un día o unas vacaciones; también los festivos. Cada fisio cierra la suya y
// quien administra la clínica, la de cualquiera o la de todos. Las citas que ya hay en esos ratos no se tocan.
import type { Db } from "./db";

export type Closure = { id: string; staffEmail: string; startsAt: string; endsAt: string; note: string; createdBy: string };
export type ClosureInput = { staffEmail: string; startsAt: string; endsAt: string; note: string };

const now = () => new Date().toISOString();
const clean = (email: string) => email.trim().toLowerCase();

type Row = { id: string; staff_email: string; starts_at: string; ends_at: string; note: string; created_by: string };
const toClosure = (r: Row): Closure => ({ id: r.id, staffEmail: r.staff_email, startsAt: r.starts_at, endsAt: r.ends_at, note: r.note, createdBy: r.created_by });

export function checkClosure(c: ClosureInput) {
  const start = Date.parse(c.startsAt);
  const end = Date.parse(c.endsAt);
  if (Number.isNaN(start) || Number.isNaN(end)) throw new RangeError("Pon desde cuándo y hasta cuándo.");
  if (end <= start) throw new RangeError("El final tiene que ser después del principio.");
  if (end - start > 400 * 86_400_000) throw new RangeError("Como mucho, un año seguido.");
}

/** Los cierres que se solapan con [from, to), por orden. */
export async function closuresBetween(db: Db, from: string, to: string): Promise<Closure[]> {
  const rows = await db.query<Row>("select * from closures where starts_at < ? and ends_at > ? order by starts_at, staff_email", [to, from]);
  return rows.map(toClosure);
}

export async function createClosure(db: Db, c: ClosureInput, by: string): Promise<string> {
  checkClosure(c);
  const id = crypto.randomUUID();
  const t = now();
  await db.transaction([
    {
      sql: "insert into closures (id, staff_email, starts_at, ends_at, note, created_by, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
      bind: [id, clean(c.staffEmail), c.startsAt, c.endsAt, c.note.trim().slice(0, 120), clean(by), t, t],
    },
  ]);
  return id;
}

export async function updateClosure(db: Db, id: string, c: ClosureInput): Promise<void> {
  checkClosure(c);
  await db.transaction([
    {
      sql: "update closures set staff_email = ?, starts_at = ?, ends_at = ?, note = ?, updated_at = ? where id = ?",
      bind: [clean(c.staffEmail), c.startsAt, c.endsAt, c.note.trim().slice(0, 120), now(), id],
    },
  ]);
}

export async function deleteClosure(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from closures where id = ?", bind: [id] }]);
}

const TZ = "Europe/Madrid";
const clock = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayOfIso = (iso: string | number) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ });
const dayText = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Cuándo está cerrada: «el vie, 25 dic», «del jue, 24 dic al sáb, 26 dic» o «el vie, 25 dic de 15:00 a 21:00». */
export function closureSpan(c: Pick<Closure, "startsAt" | "endsAt">): string {
  const d0 = dayOfIso(c.startsAt);
  const wholeDays = clock(c.startsAt) === "00:00" && clock(c.endsAt) === "00:00";
  const d1 = dayOfIso(wholeDays ? Date.parse(c.endsAt) - 60_000 : c.endsAt);
  if (wholeDays) return d0 === d1 ? `el ${dayText(d0)}` : `del ${dayText(d0)} al ${dayText(d1)}`;
  if (d0 === d1) return `el ${dayText(d0)} de ${clock(c.startsAt)} a ${clock(c.endsAt)}`;
  return `del ${dayText(d0)}, ${clock(c.startsAt)}, al ${dayText(d1)}, ${clock(c.endsAt)}`;
}

/** Si un cierre afecta a una persona: el suyo o el de toda la clínica. */
export const closesFor = (c: Pick<Closure, "staffEmail">, email: string | null) => c.staffEmail === "" || (!!email && c.staffEmail === clean(email));

/** Cuántas citas pendientes hay dentro de un cierre (para avisar: no se anulan solas). */
export async function appointmentsInside(db: Db, c: ClosureInput): Promise<number> {
  const rows = await db.query<{ assigned_to: string | null }>(
    "select assigned_to from appointments where status = 'scheduled' and starts_at < ? and datetime(starts_at, '+' || minutes || ' minutes') > datetime(?)",
    [c.endsAt, c.startsAt],
  );
  return rows.filter((r) => closesFor({ staffEmail: clean(c.staffEmail) }, r.assigned_to)).length;
}
