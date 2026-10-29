// Bonos y cobros (migración 019). Un bono son sesiones pagadas por adelantado: las sesiones del paciente a partir del
// día de compra lo van gastando, de la más antigua a la más reciente, hasta que se acaba o caduca. Las sesiones que no
// caen en ningún bono son sueltas y valen el precio de Ajustes → Precios y cobros, solo desde el día en que se puso
// (así no aparecen deudas de antes). Lo pendiente es lo que vale lo hecho menos lo cobrado. Las cantidades van en
// céntimos. No son facturas.
import { dataVersion } from "../app/dataVersion";
import { dayOf as madridDay } from "../app/dates";
import type { Db } from "./db";
import { getSetting, setSetting } from "./repo";

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type Method = "efectivo" | "tarjeta" | "bizum" | "transferencia" | "otro";
export const METHODS: { id: Method; label: string }[] = [
  { id: "efectivo", label: "Efectivo" },
  { id: "tarjeta", label: "Tarjeta" },
  { id: "bizum", label: "Bizum" },
  { id: "transferencia", label: "Transferencia" },
  { id: "otro", label: "Otro" },
];
export const methodLabel = (m: string) => METHODS.find((x) => x.id === m)?.label ?? m;

// ---------- Dinero ----------

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
/** 4050 → «40,50 €». */
export const euros = (cents: number) => money.format(cents / 100);

/** «40», «40,5», «40,50 €», «1.234,56», «40.5» o «,50» → céntimos; null si no es una cantidad. */
export function parseEuros(text: string): number | null {
  let t = text.replace(/[€\s]/g, "");
  if (!t) return null;
  // Con coma, la coma es el decimal y los puntos son de miles; sin coma, un punto con 1 o 2 cifras detrás es decimal.
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (!/^\d*\.\d{1,2}$/.test(t)) t = t.replace(/\./g, "");
  if (t.startsWith(".")) t = `0${t}`;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

// ---------- Precios ----------

const PRICING_KEY = "billing_pricing";
/** Un precio de la sesión suelta desde un día (AAAA-MM-DD); null: desde ese día las sueltas no cuentan. */
export type PricePeriod = { since: string; cents: number | null };
/**
 * El precio de ahora, el primer día con precio y la historia de precios. Cambiar el precio no cambia lo de antes: cada
 * sesión suelta vale el precio del día en que se hizo.
 */
export type Pricing = { sessionCents: number | null; since: string | null; periods: PricePeriod[] };
/** Lo guardado: la historia (`periods`) o, de la primera versión, un solo precio con su día. */
type StoredPricing = { periods?: PricePeriod[]; sessionCents?: number | null; since?: string | null };

export function pricingOf(stored: StoredPricing | null): Pricing {
  const periods = [...(stored?.periods ?? (stored?.since && stored.sessionCents != null ? [{ since: stored.since, cents: stored.sessionCents }] : []))].sort((a, b) =>
    a.since.localeCompare(b.since),
  );
  return { sessionCents: periods.at(-1)?.cents ?? null, since: periods.find((p) => p.cents !== null)?.since ?? null, periods };
}

/** Lo que vale una sesión suelta de ese día (null: no cuenta para cobrar). */
function priceOn(p: Pricing, day: string): number | null {
  let price: number | null = null;
  for (const x of p.periods) if (x.since <= day) price = x.cents;
  return price;
}

export async function getPricing(db: Db): Promise<Pricing> {
  return pricingOf(await getSetting<StoredPricing>(db, PRICING_KEY));
}

/** El precio de la sesión suelta desde `day` (hoy); null, sin precio desde ese día. Lo de antes se queda como estaba. */
export async function setSessionPrice(db: Db, cents: number | null, day: string): Promise<void> {
  if (cents !== null && !(Number.isInteger(cents) && cents >= 0)) throw new RangeError("El precio no es válido.");
  if (!DAY.test(day)) throw new RangeError("La fecha no es válida.");
  const now = await getPricing(db);
  const before = now.periods.filter((x) => x.since < day);
  // Igual que el que ya valía: nada que cambiar. Sin precio nunca: tampoco.
  if ((before.at(-1)?.cents ?? null) === cents) {
    if (before.length !== now.periods.length) await setSetting(db, PRICING_KEY, { periods: before });
    return;
  }
  await setSetting(db, PRICING_KEY, { periods: [...before, { since: day, cents }] });
}

/** Los bonos que vende la clínica, para venderlos con un toque. `months`: caducan a los N meses de la compra. */
export type PackPreset = { id: string; title: string; sessions: number; priceCents: number | null; months: number | null };
const PACK_PRESETS_KEY = "billing_pack_presets";

export async function getPackPresets(db: Db): Promise<PackPreset[]> {
  return (await getSetting<PackPreset[]>(db, PACK_PRESETS_KEY)) ?? [];
}

export async function setPackPresets(db: Db, presets: PackPreset[]): Promise<void> {
  for (const p of presets) {
    if (!p.title.trim()) throw new RangeError("Ponle un nombre al bono.");
    if (!(Number.isInteger(p.sessions) && p.sessions >= 1 && p.sessions <= 200)) throw new RangeError("Un bono tiene de 1 a 200 sesiones.");
    if (p.priceCents !== null && !(Number.isInteger(p.priceCents) && p.priceCents >= 0)) throw new RangeError("El precio no es válido.");
    if (p.months !== null && !(Number.isInteger(p.months) && p.months >= 1 && p.months <= 60)) throw new RangeError("La caducidad va de 1 a 60 meses.");
  }
  await setSetting(db, PACK_PRESETS_KEY, presets.map((p) => ({ ...p, title: p.title.trim() })));
}

/** El día en que caduca un bono comprado `day` que dura `months` meses (el día anterior del mismo día del mes). */
export function expiryOf(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  // Sin pasarse de mes: un bono del 31 de enero a un mes caduca el 28 o 29 de febrero.
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  const end = new Date(Date.UTC(y, m - 1 + months, Math.min(d, last)));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

// ---------- Bonos ----------

export type PackInput = { title: string; sessions: number; priceCents: number | null; boughtOn: string; expiresOn: string | null; note: string };
export type Pack = PackInput & { id: string; patientId: string };
type PackRow = { id: string; patient_id: string; title: string; sessions: number; price_cents: number | null; bought_on: string; expires_on: string | null; note: string };
const toPack = (r: PackRow): Pack => ({
  id: r.id,
  patientId: r.patient_id,
  title: r.title,
  sessions: r.sessions,
  priceCents: r.price_cents,
  boughtOn: r.bought_on,
  expiresOn: r.expires_on,
  note: r.note,
});

function checkPack(p: PackInput) {
  if (!p.title.trim()) throw new RangeError("Ponle un nombre al bono.");
  if (!(Number.isInteger(p.sessions) && p.sessions >= 1 && p.sessions <= 200)) throw new RangeError("Un bono tiene de 1 a 200 sesiones.");
  if (p.priceCents !== null && !(Number.isInteger(p.priceCents) && p.priceCents >= 0)) throw new RangeError("El precio no es válido.");
  if (!DAY.test(p.boughtOn)) throw new RangeError("Pon el día de compra.");
  if (p.expiresOn !== null && (!DAY.test(p.expiresOn) || p.expiresOn < p.boughtOn)) throw new RangeError("La caducidad tiene que ser después de la compra.");
}

/** Da de alta el bono; con `paid`, apunta también su cobro (el precio entero, ese día). Devuelve su id. */
export async function createPack(db: Db, patientId: string, p: PackInput, paid?: Method | null): Promise<string> {
  checkPack(p);
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: `insert into packs (id, patient_id, title, sessions, price_cents, bought_on, expires_on, note, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [id, patientId, p.title.trim(), p.sessions, p.priceCents, p.boughtOn, p.expiresOn, p.note.trim(), t, t],
    },
    ...(paid && p.priceCents
      ? [
          {
            sql: `insert into payments (id, patient_id, amount_cents, method, paid_on, concept, pack_id, created_at, updated_at)
                  values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            bind: [newId(), patientId, p.priceCents, paid, p.boughtOn, p.title.trim(), id, t, t],
          },
        ]
      : []),
  ]);
  return id;
}

export async function updatePack(db: Db, id: string, p: PackInput): Promise<void> {
  checkPack(p);
  if (!(await db.query("select 1 from packs where id = ?", [id])).length) throw new RangeError("Este bono ya no existe: se ha borrado en otro dispositivo.");
  await db.transaction([
    {
      sql: "update packs set title = ?, sessions = ?, price_cents = ?, bought_on = ?, expires_on = ?, note = ?, updated_at = ? where id = ?",
      bind: [p.title.trim(), p.sessions, p.priceCents, p.boughtOn, p.expiresOn, p.note.trim(), now(), id],
    },
  ]);
}

/** Borra el bono; sus cobros se quedan (el dinero se recibió), sin bono. */
export async function deletePack(db: Db, id: string): Promise<void> {
  await db.transaction([
    { sql: "update payments set pack_id = null, updated_at = ? where pack_id = ?", bind: [now(), id] },
    { sql: "delete from packs where id = ?", bind: [id] },
  ]);
}

// ---------- Cobros ----------

export type PaymentInput = { amountCents: number; method: Method; paidOn: string; concept: string; packId?: string | null };
/** `invoiceRef`: el número de la factura que le hizo la clínica con su programa de facturación (vacío: sin facturar). */
export type Payment = Required<PaymentInput> & { id: string; patientId: string; invoiceRef: string };
type PaymentRow = { id: string; patient_id: string; amount_cents: number; method: Method; paid_on: string; concept: string; pack_id: string | null; invoice_ref?: string };
const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  patientId: r.patient_id,
  amountCents: r.amount_cents,
  method: r.method,
  paidOn: r.paid_on,
  concept: r.concept,
  packId: r.pack_id,
  invoiceRef: r.invoice_ref ?? "",
});

export async function addPayment(db: Db, patientId: string, p: PaymentInput): Promise<string> {
  if (!(Number.isInteger(p.amountCents) && p.amountCents > 0)) throw new RangeError("Pon cuánto se ha cobrado.");
  if (!METHODS.some((m) => m.id === p.method)) throw new RangeError("Elige cómo se ha pagado.");
  if (!DAY.test(p.paidOn)) throw new RangeError("Pon el día del cobro.");
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: `insert into payments (id, patient_id, amount_cents, method, paid_on, concept, pack_id, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [id, patientId, p.amountCents, p.method, p.paidOn, p.concept.trim(), p.packId ?? null, t, t],
    },
  ]);
  return id;
}

/** Apunta (o borra, con «») el número de la factura que la clínica hizo de este cobro con su programa. */
export async function setInvoiceRef(db: Db, id: string, ref: string): Promise<void> {
  const clean = ref.replace(/\s+/g, " ").trim();
  if (clean.length > 60) throw new RangeError("El número de factura es demasiado largo.");
  await db.transaction([{ sql: "update payments set invoice_ref = ?, updated_at = ? where id = ?", bind: [clean, now(), id] }]);
}

export async function deletePayment(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from payments where id = ?", bind: [id] }]);
}

// ---------- La cuenta del paciente ----------

export type PackState = Pack & { used: number; left: number; expired: boolean };
export type Account = {
  packs: PackState[];
  payments: Payment[];
  /** Sesiones sin bono que cuentan para cobrar (desde el día del precio) y lo que valen. */
  loose: { count: number; cents: number };
  /** De cada sesión, el bono que la paga (null: suelta; sin entrada: de antes del precio y sin bono). */
  bySession: Map<string, string | null>;
  chargedCents: number;
  paidCents: number;
  /** Lo que falta por cobrar (negativo: ha pagado de más, a cuenta). */
  balanceCents: number;
};

/** Reparte las sesiones (con su instante) entre los bonos y las sueltas. Puro: sin base de datos. */
export function allocate(packs: Pack[], sessions: { id: string; performedAt: string }[], pricing: Pricing, today: string) {
  // Entre los bonos que pueden pagar una sesión, primero el que antes caduca (para no perder sesiones pagadas) y, si no
  // caducan, el más antiguo.
  const ordered = [...packs].sort(
    (a, b) => (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999") || a.boughtOn.localeCompare(b.boughtOn) || a.id.localeCompare(b.id),
  );
  const used = new Map(ordered.map((p) => [p.id, 0]));
  const bySession = new Map<string, string | null>();
  let loose = 0;
  let looseCents = 0;
  for (const s of [...sessions].sort((a, b) => a.performedAt.localeCompare(b.performedAt) || a.id.localeCompare(b.id))) {
    const day = madridDay(s.performedAt);
    const pack = ordered.find((p) => p.boughtOn <= day && (p.expiresOn === null || day <= p.expiresOn) && used.get(p.id)! < p.sessions);
    const price = pack ? null : priceOn(pricing, day);
    if (pack) {
      used.set(pack.id, used.get(pack.id)! + 1);
      bySession.set(s.id, pack.id);
    } else if (price !== null) {
      loose++;
      looseCents += price;
      bySession.set(s.id, null);
    }
  }
  const states: PackState[] = [...ordered].sort((a, b) => a.boughtOn.localeCompare(b.boughtOn) || a.id.localeCompare(b.id)).map((p) => {
    const u = used.get(p.id)!;
    return { ...p, used: u, left: p.sessions - u, expired: p.expiresOn !== null && p.expiresOn < today };
  });
  return { packs: states, bySession, loose: { count: loose, cents: looseCents } };
}

async function listPacks(db: Db, patientId: string): Promise<Pack[]> {
  return (await db.query<PackRow>("select * from packs where patient_id = ? order by bought_on, id", [patientId])).map(toPack);
}

async function listPayments(db: Db, patientId: string): Promise<Payment[]> {
  return (await db.query<PaymentRow>("select * from payments where patient_id = ? order by paid_on desc, created_at desc", [patientId])).map(toPayment);
}

export async function patientAccount(db: Db, patientId: string, today: string): Promise<Account> {
  const [packs, payments, sessions, pricing] = await Promise.all([
    listPacks(db, patientId),
    listPayments(db, patientId),
    db.query<{ id: string; performed_at: string }>("select id, performed_at from sessions where patient_id = ?", [patientId]),
    getPricing(db),
  ]);
  const a = allocate(packs, sessions.map((s) => ({ id: s.id, performedAt: s.performed_at })), pricing, today);
  const chargedCents = a.packs.reduce((n, p) => n + (p.priceCents ?? 0), 0) + a.loose.cents;
  const paidCents = payments.reduce((n, p) => n + p.amountCents, 0);
  return { ...a, payments, chargedCents, paidCents, balanceCents: chargedCents - paidCents };
}

/** Qué pasa con una sesión nueva en ese instante: la gasta un bono (y cuántas le quedan después), es suelta (y lo que vale) o no cuenta. */
export type SessionCharge = { kind: "pack"; title: string; leftAfter: number; sessions: number } | { kind: "loose"; cents: number } | { kind: "none" };

export async function nextSessionCharge(db: Db, patientId: string, performedAt: string, today: string): Promise<SessionCharge> {
  const [packs, sessions, pricing] = await Promise.all([
    listPacks(db, patientId),
    db.query<{ id: string; performed_at: string }>("select id, performed_at from sessions where patient_id = ?", [patientId]),
    getPricing(db),
  ]);
  const NEW = "\u0000nueva";
  const a = allocate(packs, [...sessions.map((s) => ({ id: s.id, performedAt: s.performed_at })), { id: NEW, performedAt }], pricing, today);
  const by = a.bySession.get(NEW);
  if (by === undefined) return { kind: "none" };
  if (by === null) return { kind: "loose", cents: priceOn(pricing, madridDay(performedAt)) ?? 0 };
  const p = a.packs.find((x) => x.id === by)!;
  return { kind: "pack", title: p.title, leftAfter: p.left, sessions: p.sessions };
}

export function chargeText(c: SessionCharge): string | null {
  if (c.kind === "pack") return c.leftAfter === 0 ? `Es la última sesión de «${c.title}»` : `Del «${c.title}»: después de esta, quedan ${c.leftAfter} de ${c.sessions}`;
  if (c.kind === "loose") return `Sesión suelta: ${euros(c.cents)}`;
  return null;
}

export async function getPayment(db: Db, id: string): Promise<Payment | null> {
  const [r] = await db.query<PaymentRow>("select * from payments where id = ?", [id]);
  return r ? toPayment(r) : null;
}

// ---------- Cantidades en letra (para el recibo) ----------

const UNITS = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const HUNDREDS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function below1000(n: number): string {
  if (n === 100) return "cien";
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 30 ? UNITS[r]! : `${TENS[Math.floor(r / 10)]}${r % 10 ? ` y ${UNITS[r % 10]}` : ""}`;
  return [HUNDREDS[h], rest].filter(Boolean).join(" ");
}

/** Un número entero en letra (hasta 999 999 999), con «un» delante de un sustantivo masculino: «veintiún», «un mil» no. */
export function numberInWords(n: number): string {
  if (n === 0) return "cero";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? "un millón" : `${apocope(below1000(millions))} millones`);
  if (thousands) parts.push(thousands === 1 ? "mil" : `${apocope(below1000(thousands))} mil`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}
/** «veintiuno» → «veintiún», «uno» → «un» delante de «mil», «millones» o «euros». */
const apocope = (t: string) => t.replace(/veintiuno$/, "veintiún").replace(/(^| )uno$/, "$1un");

/** 4050 → «cuarenta euros con cincuenta céntimos». */
export function eurosInWords(cents: number): string {
  const e = Math.floor(cents / 100);
  const c = cents % 100;
  const euroPart = e === 1 ? "un euro" : `${apocope(numberInWords(e))} euros`;
  if (!c) return euroPart;
  return `${euroPart} con ${c === 1 ? "un céntimo" : `${apocope(numberInWords(c))} céntimos`}`;
}

/** Para la ficha: el bono que se está gastando (o el último) y lo pendiente, en una línea. */
export function accountLine(a: Account): string | null {
  const parts: string[] = [];
  const open = a.packs.find((p) => p.left > 0 && !p.expired) ?? a.packs.at(-1);
  if (open) parts.push(open.left > 0 && !open.expired ? `${open.title}: quedan ${open.left} de ${open.sessions}` : `${open.title}: ${open.expired && open.left > 0 ? "caducado" : "gastado"}`);
  if (a.balanceCents > 0) parts.push(`pendiente ${euros(a.balanceCents)}`);
  else if (a.balanceCents < 0) parts.push(`a cuenta ${euros(-a.balanceCents)}`);
  return parts.length ? parts.join(" · ") : null;
}

// ---------- La clínica ----------

export type Debtor = { patientId: string; name: string; balanceCents: number; lastPaidOn: string | null };

/**
 * Pacientes con algo pendiente de cobrar, de más a menos. Todo de una vez, no paciente a paciente, y solo de los
 * pacientes que tienen algún cobro, bono o sesión (los demás no pueden deber nada). Agenda › Hoy y el filtro de
 * Pacientes lo piden a la vez con cada cambio: el mismo resultado sirve durante un segundo (y mientras no cambie nada).
 */
export async function pendingAccounts(db: Db, today: string): Promise<Debtor[]> {
  const version = dataVersion();
  const now = Date.now();
  if (pendingCache && pendingCache.db === db && pendingCache.today === today && pendingCache.version === version && now - pendingCache.at < PENDING_CACHE_MS) return pendingCache.value;
  const value = computePendingAccounts(db, today);
  pendingCache = { db, today, version, at: now, value };
  value.catch(() => {
    if (pendingCache?.value === value) pendingCache = null;
  });
  return value;
}
const PENDING_CACHE_MS = 1000;
let pendingCache: { db: Db; today: string; version: number; at: number; value: Promise<Debtor[]> } | null = null;

async function computePendingAccounts(db: Db, today: string): Promise<Debtor[]> {
  const [pricing, packs, payments, sessions, patients] = await Promise.all([
    getPricing(db),
    db.query<PackRow>("select * from packs"),
    db.query<PaymentRow>("select * from payments order by paid_on desc"),
    db.query<{ id: string; patient_id: string; performed_at: string }>("select id, patient_id, performed_at from sessions"),
    db.query<{ id: string; name: string }>(
      "select id, name from patients where id in (select patient_id from sessions union select patient_id from payments union select patient_id from packs)",
    ),
  ]);
  const group = <T extends { patient_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.patient_id, [...(m.get(r.patient_id) ?? []), r]);
    return m;
  };
  const [packsOf, paymentsOf, sessionsOf] = [group(packs), group(payments), group(sessions)];
  const out: Debtor[] = [];
  for (const p of patients) {
    const mine = packsOf.get(p.id) ?? [];
    const paid = paymentsOf.get(p.id) ?? [];
    const a = allocate(mine.map(toPack), (sessionsOf.get(p.id) ?? []).map((s) => ({ id: s.id, performedAt: s.performed_at })), pricing, today);
    const balance = a.packs.reduce((n, k) => n + (k.priceCents ?? 0), 0) + a.loose.cents - paid.reduce((n, y) => n + y.amount_cents, 0);
    if (balance > 0) out.push({ patientId: p.id, name: p.name, balanceCents: balance, lastPaidOn: paid[0]?.paid_on ?? null });
  }
  return out.sort((a, b) => b.balanceCents - a.balanceCents || a.name.localeCompare(b.name, "es"));
}

/** Lo cobrado entre dos días (AAAA-MM-DD, el segundo sin incluir): el total y por forma de pago. */
export async function collectedBetween(db: Db, from: string, to: string): Promise<{ totalCents: number; count: number; byMethod: { method: Method; cents: number }[] }> {
  const rows = await db.query<{ method: Method; cents: number; n: number }>(
    "select method, sum(amount_cents) as cents, count(*) as n from payments where paid_on >= ? and paid_on < ? group by method",
    [from, to],
  );
  const byMethod = METHODS.map((m) => ({ method: m.id, cents: Number(rows.find((r) => r.method === m.id)?.cents ?? 0) })).filter((m) => m.cents > 0);
  return { totalCents: byMethod.reduce((n, m) => n + m.cents, 0), count: rows.reduce((n, r) => n + Number(r.n), 0), byMethod };
}
