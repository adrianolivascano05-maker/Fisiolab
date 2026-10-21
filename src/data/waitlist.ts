// Lista de espera (migración 020): pacientes que quieren un hueco antes (o cualquiera), con cuándo les viene bien y,
// en un equipo, con quién. Al anular o borrar una cita, la agenda enseña a quién ofrecérselo, con el mensaje listo
// para WhatsApp o correo (src/schedule/WaitlistPage.tsx). Quien ya tiene su hueco se quita de la lista.
import type { Db } from "./db";

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/** Por la mañana (antes de las 14:00), por la tarde, o cualquiera (""). */
export type PreferTime = "" | "manana" | "tarde";
export type WaitInput = { note: string; assignedTo: string | null; preferTime?: PreferTime; preferDays?: number[] };
export const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
export const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
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
  nextId: string | null;
  preferTime: PreferTime;
  /** Días de la semana que le vienen bien (1 lunes … 7 domingo); vacío: cualquiera. */
  preferDays: number[];
  /** Cuándo se le ofreció el último hueco. */
  offeredAt: string | null;
};

type Row = {
  id: string;
  patient_id: string;
  note: string;
  assigned_to: string | null;
  created_at: string;
  prefer_time: PreferTime;
  prefer_days: string;
  offered_at: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  privacy: string | null;
  next_at: string | null;
  next_id: string | null;
};
const days = (v: string) => v.split(",").map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);

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
            (select a.starts_at from appointments a where a.patient_id = w.patient_id and a.status = 'scheduled' and a.starts_at > ?1 order by a.starts_at limit 1) as next_at,
            (select a.id from appointments a where a.patient_id = w.patient_id and a.status = 'scheduled' and a.starts_at > ?1 order by a.starts_at limit 1) as next_id
       from waitlist w join patients p on p.id = w.patient_id
      ${forWhom ? "where w.assigned_to is null or w.assigned_to = ?2" : ""}
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
    nextId: r.next_id,
    preferTime: r.prefer_time ?? "",
    preferDays: days(r.prefer_days ?? ""),
    offeredAt: r.offered_at,
  }));
}

export async function addToWaitlist(db: Db, patientId: string, w: WaitInput): Promise<string> {
  const [dup] = await db.query<{ id: string }>("select id from waitlist where patient_id = ?", [patientId]);
  if (dup) throw new RangeError("Ya está en la lista de espera.");
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: "insert into waitlist (id, patient_id, note, assigned_to, prefer_time, prefer_days, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
      bind: [id, patientId, w.note.trim(), w.assignedTo, w.preferTime ?? "", daysText(w.preferDays), t, t],
    },
  ]);
  return id;
}

const daysText = (d: number[] | undefined) => [...new Set(d ?? [])].filter((x) => x >= 1 && x <= 7).sort().join(",");

/** Cambiar cuándo le viene bien o con quién. */
export async function updateWaitlist(db: Db, id: string, w: WaitInput): Promise<void> {
  await db.transaction([
    {
      sql: "update waitlist set note = ?, assigned_to = ?, prefer_time = ?, prefer_days = ?, updated_at = ? where id = ?",
      bind: [w.note.trim(), w.assignedTo, w.preferTime ?? "", daysText(w.preferDays), now(), id],
    },
  ]);
}

/** Se le ha ofrecido un hueco (por WhatsApp o correo). */
export async function markOffered(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "update waitlist set offered_at = ?, updated_at = ? where id = ?", bind: [now(), now(), id] }]);
}

/** El día de la semana (1 lunes … 7 domingo) y la franja de un instante, en la hora de Madrid. */
export function slotOf(iso: string): { day: number; time: "manana" | "tarde" } {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Europe/Madrid" });
  const hour = Number(d.toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Madrid" }).slice(0, 2));
  return { day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday) + 1, time: hour < 14 ? "manana" : "tarde" };
}

/** ¿Le encaja un hueco que empieza en ese instante? */
export function fits(w: Pick<WaitItem, "preferTime" | "preferDays">, iso: string): boolean {
  const s = slotOf(iso);
  return (!w.preferTime || w.preferTime === s.time) && (!w.preferDays.length || w.preferDays.includes(s.day));
}

/** «Mañanas, lunes y miércoles» (o «Cualquier día y hora»). */
export function preferText(w: Pick<WaitItem, "preferTime" | "preferDays">): string {
  const time = w.preferTime === "manana" ? "Mañanas" : w.preferTime === "tarde" ? "Tardes" : "";
  const names = w.preferDays.map((d) => WEEKDAY_NAMES[d - 1]!);
  const daysPart = names.length ? (names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`) : "";
  if (!time && !daysPart) return "Cualquier día y hora";
  return [time, time ? daysPart : daysPart.charAt(0).toUpperCase() + daysPart.slice(1)].filter(Boolean).join(", ");
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
