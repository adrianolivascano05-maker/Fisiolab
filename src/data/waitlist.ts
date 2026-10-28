// Lista de espera (migraciones 020, 022 y 031): pacientes que quieren un hueco antes (o cualquiera), con cuándo les
// viene bien (mañanas o tardes, o unas horas concretas, y qué días), desde qué día pueden, si son preferentes y, en un
// equipo, con quién. Se ordena y se filtra por todo eso a la vez (filterWaitlist, sortWaitlist). Al anular o borrar
// una cita, la agenda enseña a quién ofrecérselo, con el mensaje listo para WhatsApp o correo
// (src/schedule/WaitlistPage.tsx). Quien ya tiene su hueco se quita de la lista.
import { dayOf } from "../app/dates";
import type { Db } from "./db";

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/** Por la mañana (antes de las 14:00), por la tarde, o cualquiera (""). */
export type PreferTime = "" | "manana" | "tarde";
export type WaitInput = {
  note: string;
  assignedTo: string | null;
  preferTime?: PreferTime;
  preferDays?: number[];
  /** Preferente: pasa delante al ordenar por prioridad (dolor agudo, postoperatorio…). */
  priority?: boolean;
  /** Puede venir a partir de este día (AAAA-MM-DD); null, ya. */
  availableFrom?: string | null;
  /** Horas concretas (minutos desde las 0:00): de `fromMin` a `toMin`. Con ellas, la franja no cuenta. */
  fromMin?: number | null;
  toMin?: number | null;
};
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
  priority: boolean;
  availableFrom: string | null;
  fromMin: number | null;
  toMin: number | null;
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
  priority: number | null;
  available_from: string | null;
  from_min: number | null;
  to_min: number | null;
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
    priority: r.priority === 1,
    availableFrom: r.available_from ?? null,
    fromMin: r.from_min ?? null,
    toMin: r.to_min ?? null,
  }));
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Lo que se guarda, comprobado: unas horas van enteras (desde y hasta) y la de salida, después. */
function clean(w: WaitInput) {
  const range = w.fromMin != null || w.toMin != null;
  if (range) {
    if (w.fromMin == null || w.toMin == null) throw new RangeError("Pon desde qué hora y hasta qué hora le viene bien.");
    if (!(Number.isInteger(w.fromMin) && Number.isInteger(w.toMin) && w.fromMin >= 0 && w.toMin <= 1440 && w.toMin > w.fromMin))
      throw new RangeError("La hora de «hasta» tiene que ser después de la de «desde».");
  }
  if (w.availableFrom && !DAY.test(w.availableFrom)) throw new RangeError("La fecha de «puede a partir del» no es válida.");
  return [
    w.note.trim(),
    w.assignedTo,
    range ? "" : (w.preferTime ?? ""),
    daysText(w.preferDays),
    w.priority ? 1 : 0,
    w.availableFrom || null,
    range ? w.fromMin! : null,
    range ? w.toMin! : null,
  ];
}

export async function addToWaitlist(db: Db, patientId: string, w: WaitInput): Promise<string> {
  const [dup] = await db.query<{ id: string }>("select id from waitlist where patient_id = ?", [patientId]);
  if (dup) throw new RangeError("Ya está en la lista de espera.");
  const values = clean(w);
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: `insert into waitlist (id, patient_id, note, assigned_to, prefer_time, prefer_days, priority, available_from, from_min, to_min, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [id, patientId, ...values, t, t],
    },
  ]);
  return id;
}

const daysText = (d: number[] | undefined) => [...new Set(d ?? [])].filter((x) => x >= 1 && x <= 7).sort().join(",");

/** Cambiar cuándo le viene bien, desde cuándo puede, si es preferente o con quién. */
export async function updateWaitlist(db: Db, id: string, w: WaitInput): Promise<void> {
  const values = clean(w);
  await db.transaction([
    {
      sql: "update waitlist set note = ?, assigned_to = ?, prefer_time = ?, prefer_days = ?, priority = ?, available_from = ?, from_min = ?, to_min = ?, updated_at = ? where id = ?",
      bind: [...values, now(), id],
    },
  ]);
}

/** Se le ha ofrecido un hueco (por WhatsApp o correo). */
export async function markOffered(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "update waitlist set offered_at = ?, updated_at = ? where id = ?", bind: [now(), now(), id] }]);
}

/** Las mañanas, hasta las 14:00. */
const AFTERNOON = 14 * 60;

/** El día (AAAA-MM-DD y de la semana, 1 lunes … 7 domingo), la franja y los minutos desde las 0:00 de un instante, en la hora de Madrid. */
export function slotOf(iso: string): { date: string; day: number; time: "manana" | "tarde"; min: number } {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Europe/Madrid" });
  const [hh, mm] = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Madrid" }).split(":").map(Number) as [number, number];
  const min = (hh % 24) * 60 + mm;
  return {
    date: dayOf(d),
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday) + 1,
    time: min < AFTERNOON ? "manana" : "tarde",
    min,
  };
}

type When = Pick<WaitItem, "preferTime" | "preferDays"> & Partial<Pick<WaitItem, "availableFrom" | "fromMin" | "toMin">>;

/** ¿Le encaja un hueco que empieza en ese instante (y dura `minutes`)? Su día, su franja u horas, y si ya puede. */
export function fits(w: When, iso: string, minutes = 0): boolean {
  const s = slotOf(iso);
  if (w.availableFrom && s.date < w.availableFrom) return false;
  if (w.preferDays.length && !w.preferDays.includes(s.day)) return false;
  if (w.fromMin != null && w.toMin != null) return s.min >= w.fromMin && s.min + minutes <= w.toMin;
  return !w.preferTime || w.preferTime === s.time;
}

/** Si le vienen bien las mañanas y si las tardes (con unas horas concretas, según en qué franja caigan). */
export function bandsOf(w: When): { manana: boolean; tarde: boolean } {
  if (w.fromMin != null && w.toMin != null) return { manana: w.fromMin < AFTERNOON, tarde: w.toMin > AFTERNOON };
  return { manana: w.preferTime !== "tarde", tarde: w.preferTime !== "manana" };
}

/** «18:30» de los minutos desde las 0:00. */
export const minText = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** «Mañanas, lunes y miércoles», «De 18:00 a 20:00, martes» (o «Cualquier día y hora»). */
export function preferText(w: When): string {
  const time =
    w.fromMin != null && w.toMin != null ? `De ${minText(w.fromMin)} a ${minText(w.toMin)}` : w.preferTime === "manana" ? "Mañanas" : w.preferTime === "tarde" ? "Tardes" : "";
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

// ---------- Ordenar y filtrar ----------

export type WaitSort = "espera" | "recientes" | "prioridad" | "cita" | "ofrecido" | "nombre";
export const WAIT_SORTS: { id: WaitSort; label: string }[] = [
  { id: "espera", label: "Más tiempo esperando" },
  { id: "recientes", label: "Menos tiempo esperando" },
  { id: "prioridad", label: "Preferentes primero" },
  { id: "cita", label: "Sin cita primero, después la más lejana" },
  { id: "ofrecido", label: "Sin ofrecer primero" },
  { id: "nombre", label: "Nombre (A-Z)" },
];

/**
 * Filtros que se combinan (todos a la vez). `band`: le vienen bien las mañanas o las tardes (quien puede a cualquier
 * hora, también). `days`: puede alguno de esos días. `who`: puede con esa persona (la suya o con cualquiera). `ready`:
 * ya puede venir (sin «puede a partir del» o con el día ya llegado). `minDays`: lleva esperando al menos esos días.
 */
export type WaitFilters = {
  q?: string;
  band?: "manana" | "tarde" | null;
  days?: number[];
  who?: string | null;
  priority?: boolean;
  offered?: "si" | "no" | null;
  cita?: "si" | "no" | null;
  ready?: boolean;
  minDays?: number | null;
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
/** Días enteros que lleva esperando. */
export const waitingDays = (createdAt: string, now = new Date()) => Math.max(0, Math.floor((now.getTime() - Date.parse(createdAt)) / 86_400_000));

export function filterWaitlist(items: WaitItem[], f: WaitFilters, now = new Date()): WaitItem[] {
  const today = dayOf(now);
  const q = fold(f.q?.trim() ?? "");
  const digits = q.replace(/\D/g, "");
  return items.filter((w) => {
    if (q && !fold(`${w.name} ${w.note}`).includes(q) && !(digits.length >= 3 && w.phone.replace(/\D/g, "").includes(digits))) return false;
    if (f.band && !bandsOf(w)[f.band]) return false;
    if (f.days?.length && w.preferDays.length && !w.preferDays.some((d) => f.days!.includes(d))) return false;
    if (f.who && w.assignedTo && w.assignedTo !== f.who) return false;
    if (f.priority && !w.priority) return false;
    if (f.offered === "si" && !w.offeredAt) return false;
    if (f.offered === "no" && w.offeredAt) return false;
    if (f.cita === "si" && !w.nextAt) return false;
    if (f.cita === "no" && w.nextAt) return false;
    if (f.ready && w.availableFrom && w.availableFrom > today) return false;
    if (f.minDays && waitingDays(w.createdAt, now) < f.minDays) return false;
    return true;
  });
}

/** Ordena la lista; a igualdad, quien más lleva esperando primero. */
export function sortWaitlist(items: WaitItem[], sort: WaitSort): WaitItem[] {
  const oldest = (a: WaitItem, b: WaitItem) => a.createdAt.localeCompare(b.createdAt);
  const by: Record<WaitSort, (a: WaitItem, b: WaitItem) => number> = {
    espera: oldest,
    recientes: (a, b) => b.createdAt.localeCompare(a.createdAt),
    prioridad: (a, b) => Number(b.priority) - Number(a.priority) || oldest(a, b),
    // Sin cita, primero (no tiene nada); después, a quien más le queda para su cita (más gana adelantándola).
    cita: (a, b) => (a.nextAt === null ? 0 : 1) - (b.nextAt === null ? 0 : 1) || (b.nextAt ?? "").localeCompare(a.nextAt ?? "") || oldest(a, b),
    // Sin ofrecer, primero; después, a quien hace más que se le ofreció.
    ofrecido: (a, b) => (a.offeredAt ? 1 : 0) - (b.offeredAt ? 1 : 0) || (a.offeredAt ?? "").localeCompare(b.offeredAt ?? "") || oldest(a, b),
    nombre: (a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }) || oldest(a, b),
  };
  return [...items].sort(by[sort]);
}

/** Cuántos filtros hay puestos (para el botón «Filtros»). */
export function activeFilters(f: WaitFilters): number {
  return [f.q?.trim(), f.band, f.days?.length, f.who, f.priority, f.offered, f.cita, f.ready, f.minDays].filter(Boolean).length;
}
