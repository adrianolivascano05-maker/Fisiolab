// Bonos y cobros (migración 019). Un bono son sesiones pagadas por adelantado: las sesiones del paciente a partir del
// día de compra lo van gastando, de la más antigua a la más reciente, hasta que se acaba o caduca. Las sesiones que no
// caen en ningún bono son sueltas y valen el precio de Ajustes → Precios y cobros, solo desde el día en que se puso
// (así no aparecen deudas de antes). Lo pendiente es lo que vale lo hecho menos lo cobrado. Las cantidades van en
// céntimos. No son facturas.
import type { Db } from "./db";
import { getSetting, setSetting } from "./repo";

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const madridDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
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

/** «40», «40,5», «40,50 €», «1.234,56» o «40.5» → céntimos; null si no es una cantidad. */
export function parseEuros(text: string): number | null {
  let t = text.replace(/[€\s]/g, "");
  if (!t) return null;
  // Con coma, la coma es el decimal y los puntos son de miles; sin coma, un punto con 1 o 2 cifras detrás es decimal.
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

// ---------- Precios ----------

export const PRICING_KEY = "billing_pricing";
/** El precio de la sesión suelta y desde qué día cuenta (AAAA-MM-DD). */
export type Pricing = { sessionCents: number | null; since: string | null };

export async function getPricing(db: Db): Promise<Pricing> {
  return (await getSetting<Pricing>(db, PRICING_KEY)) ?? { sessionCents: null, since: null };
}

export async function setPricing(db: Db, p: Pricing): Promise<void> {
  if (p.sessionCents !== null && !(Number.isInteger(p.sessionCents) && p.sessionCents >= 0)) throw new RangeError("El precio no es válido.");
  if (p.since !== null && !DAY.test(p.since)) throw new RangeError("La fecha no es válida.");
  await setSetting(db, PRICING_KEY, p);
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
export type Payment = Required<PaymentInput> & { id: string; patientId: string };
type PaymentRow = { id: string; patient_id: string; amount_cents: number; method: Method; paid_on: string; concept: string; pack_id: string | null };
const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  patientId: r.patient_id,
  amountCents: r.amount_cents,
  method: r.method,
  paidOn: r.paid_on,
  concept: r.concept,
  packId: r.pack_id,
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
  const ordered = [...packs].sort((a, b) => a.boughtOn.localeCompare(b.boughtOn) || a.id.localeCompare(b.id));
  const used = new Map(ordered.map((p) => [p.id, 0]));
  const bySession = new Map<string, string | null>();
  let loose = 0;
  for (const s of [...sessions].sort((a, b) => a.performedAt.localeCompare(b.performedAt))) {
    const day = madridDay(s.performedAt);
    const pack = ordered.find((p) => p.boughtOn <= day && (p.expiresOn === null || day <= p.expiresOn) && used.get(p.id)! < p.sessions);
    if (pack) {
      used.set(pack.id, used.get(pack.id)! + 1);
      bySession.set(s.id, pack.id);
    } else if (pricing.sessionCents !== null && pricing.since !== null && day >= pricing.since) {
      loose++;
      bySession.set(s.id, null);
    }
  }
  const states: PackState[] = ordered.map((p) => {
    const u = used.get(p.id)!;
    return { ...p, used: u, left: p.sessions - u, expired: p.expiresOn !== null && p.expiresOn < today };
  });
  return { packs: states, bySession, loose: { count: loose, cents: loose * (pricing.sessionCents ?? 0) } };
}

export async function listPacks(db: Db, patientId: string): Promise<Pack[]> {
  return (await db.query<PackRow>("select * from packs where patient_id = ? order by bought_on, id", [patientId])).map(toPack);
}

export async function listPayments(db: Db, patientId: string): Promise<Payment[]> {
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

/** Pacientes con algo pendiente de cobrar, de más a menos. Todo de una vez, no paciente a paciente. */
export async function pendingAccounts(db: Db, today: string): Promise<Debtor[]> {
  const [pricing, packs, payments, sessions, patients] = await Promise.all([
    getPricing(db),
    db.query<PackRow>("select * from packs"),
    db.query<PaymentRow>("select * from payments order by paid_on desc"),
    db.query<{ id: string; patient_id: string; performed_at: string }>("select id, patient_id, performed_at from sessions"),
    db.query<{ id: string; name: string }>("select id, name from patients"),
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
