// Facturas (migración 028). Se numeran de forma correlativa dentro de cada serie: una serie por profesional (o por
// dispositivo, sin clínica) y año, «A2026», «B2026»…, y las rectificativas en la suya, «RA2026». Así dos personas de la
// clínica nunca se quitan un número aunque trabajen sin conexión a la vez. Una factura emitida no se cambia ni se
// borra: si hay un error, se emite una rectificativa que la anula y, si hace falta, otra nueva bien hecha.
// Cada factura guarda los datos del emisor y del destinatario tal como estaban, y una huella SHA-256 de su contenido
// encadenada con la anterior de su serie: si alguien cambia una factura en la base, la cadena deja de cuadrar.
// Esto NO es Verifactu (el registro con el formato de la AEAT, su código QR y el envío): está preparado para
// adaptarlo cuando sea obligatorio, con una asesoría. Las cantidades van en céntimos.
import type { Db } from "./db";
import { getSetting, setSetting } from "./repo";

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type InvoiceKind = "completa" | "simplificada" | "rectificativa";
export const KIND_LABELS: Record<InvoiceKind, string> = { completa: "Factura", simplificada: "Factura simplificada", rectificativa: "Factura rectificativa" };
/** Quien emite o recibe la factura: nombre o razón social, NIF (o DNI/NIE) y domicilio. */
export type Party = { name: string; taxId: string; address: string };
/** Una línea: concepto, unidades y precio de cada una (sin IVA). En una rectificativa, en negativo. */
export type InvoiceLine = { concept: string; qty: number; unitCents: number };

/** Lo que se escribe al hacer una factura. */
export type InvoiceInput = {
  kind: "completa" | "simplificada";
  issuedOn: string;
  /** El día del servicio, si no es el de la factura. */
  operationOn: string | null;
  patientId: string | null;
  paymentId: string | null;
  recipient: Party;
  lines: InvoiceLine[];
  /** Tipo de IVA en %. 0: exenta (con `exemption`, el motivo). */
  vatRate: number;
  exemption: string;
  /** Retención de IRPF en % (a empresas o mutuas, si procede). */
  irpfRate: number;
};

export type Invoice = {
  id: string;
  series: string;
  number: number;
  code: string;
  kind: InvoiceKind;
  issuedOn: string;
  operationOn: string | null;
  patientId: string | null;
  paymentId: string | null;
  rectifiesId: string | null;
  issuer: Party;
  recipient: Party;
  lines: InvoiceLine[];
  baseCents: number;
  vatRate: number;
  vatCents: number;
  irpfRate: number;
  irpfCents: number;
  totalCents: number;
  exemption: string;
  reason: string;
  prevHash: string;
  hash: string;
  createdBy: string;
  createdAt: string;
};

// ---------- Ajustes ----------

/** Lo que propone la app al hacer una factura (para toda la clínica). Revisar con la asesoría. */
export type InvoiceSettings = { vatRate: number; exemption: string; irpfRate: number };
export const INVOICE_SETTINGS_KEY = "invoice_settings";
/** El motivo de exención que se propone. Que la fisioterapia esté exenta depende del caso: lo confirma la asesoría. */
export const DEFAULT_EXEMPTION = "Operación exenta de IVA (artículo 20.Uno.3º de la Ley 37/1992, del IVA)";
export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = { vatRate: 0, exemption: DEFAULT_EXEMPTION, irpfRate: 0 };

export async function getInvoiceSettings(db: Db): Promise<InvoiceSettings> {
  return { ...DEFAULT_INVOICE_SETTINGS, ...(await getSetting<Partial<InvoiceSettings>>(db, INVOICE_SETTINGS_KEY)) };
}
export async function saveInvoiceSettings(db: Db, s: InvoiceSettings): Promise<void> {
  if (!(s.vatRate >= 0 && s.vatRate <= 100) || !(s.irpfRate >= 0 && s.irpfRate <= 100)) throw new RangeError("El porcentaje no es válido.");
  await setSetting(db, INVOICE_SETTINGS_KEY, { ...s, exemption: s.exemption.trim() });
}

/**
 * La serie de cada dispositivo: una letra (A, B, C…) que se asigna sola la primera vez que factura y se guarda en su
 * propio ajuste («invoice_series:<dispositivo>»), sincronizado. Así dos dispositivos (aunque sean de la misma persona)
 * nunca se quitan un número, ni aunque trabajen sin conexión a la vez. (La primera versión guardaba una letra por
 * persona en «invoice_series»: se respeta para no cambiar la serie de quien ya facturaba.)
 */
export const SERIES_MAP_KEY = "invoice_series";
const SERIES_PREFIX = "invoice_series:";
const LETTERS = /^[A-Z]{1,3}$/;

/** Este dispositivo, como lo conoce la sincronización. */
async function deviceOf(db: Db): Promise<string> {
  return (await db.query<{ device: string }>("select device from sync_state"))[0]?.device ?? "local";
}

/** Las letras de cada dispositivo (y las de la primera versión, por persona, con «persona:» delante). */
export async function getSeriesMap(db: Db): Promise<Record<string, string>> {
  const rows = await db.query<{ key: string; value: string }>("select key, value from settings where key like ?", [`${SERIES_PREFIX}%`]);
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key.slice(SERIES_PREFIX.length)] = JSON.parse(r.value) as string;
  for (const [who, l] of Object.entries((await getSetting<Record<string, string>>(db, SERIES_MAP_KEY)) ?? {})) out[`persona:${who}`] = l;
  return out;
}

/**
 * Dos dispositivos que cogieron la misma letra a la vez (los dos sin conexión): se la queda el de nombre menor y el
 * otro coge otra en su próxima factura. Lo ya emitido se queda como está (si se repitió algún número, lo avisa la lista).
 */
const twinOf = (map: Record<string, string>, device: string, letter: string) => Object.entries(map).some(([k, l]) => l === letter && !k.startsWith("persona:") && k < device);

/** La letra de este dispositivo, si ya tiene (y no se la tiene que dejar a otro). */
export async function mySeriesLetter(db: Db): Promise<string | null> {
  const device = await deviceOf(db);
  const mine = await getSetting<string>(db, `${SERIES_PREFIX}${device}`);
  return mine && !twinOf(await getSeriesMap(db), device, mine) ? mine : null;
}

/** Las letras que ya usa alguien: las de otros dispositivos y las que salen en las facturas. */
async function usedLetters(db: Db, except: string): Promise<Set<string>> {
  const map = await getSeriesMap(db);
  return new Set([
    ...Object.entries(map)
      .filter(([k]) => k !== except)
      .map(([, l]) => l),
    ...(await db.query<{ series: string }>("select distinct series from invoices")).map((r) => r.series.replace(/^R/, "").replace(/\d{4}$/, "")),
  ]);
}

/**
 * La letra de serie de este dispositivo: la suya o, la primera vez (o si otro dispositivo cogió la misma a la vez), la
 * de la primera versión de `who` si nadie la ha cogido aún, o la primera libre. Se guarda para siempre.
 */
export async function seriesLetterOf(db: Db, who: string): Promise<string> {
  const device = await deviceOf(db);
  const mine = await getSetting<string>(db, `${SERIES_PREFIX}${device}`);
  const map = await getSeriesMap(db);
  if (mine && !twinOf(map, device, mine)) return mine;
  const claimed = new Set(Object.entries(map).filter(([k]) => !k.startsWith("persona:")).map(([, l]) => l));
  const legacy = map[`persona:${who}`];
  const used = await usedLetters(db, device);
  const letter = legacy && !claimed.has(legacy) ? legacy : ([..."ABCDEFGHIJKLMNOPQSTUVWXYZ"].find((l) => !used.has(l)) ?? "Z");
  await setSetting(db, `${SERIES_PREFIX}${device}`, letter);
  return letter;
}

/** Cambiar la letra de este dispositivo (solo a una que no use nadie más). */
export async function setSeriesLetter(db: Db, letter: string): Promise<void> {
  const l = letter.trim().toUpperCase();
  if (!LETTERS.test(l) || l.startsWith("R")) throw new RangeError("La serie son de 1 a 3 letras sin tilde, y no puede empezar por R (es la de las rectificativas).");
  const device = await deviceOf(db);
  if ((await getSetting<string>(db, `${SERIES_PREFIX}${device}`)) === l) return;
  if ((await usedLetters(db, device)).has(l)) throw new RangeError("Esa serie ya la usa otro dispositivo o ya tiene facturas.");
  await setSetting(db, `${SERIES_PREFIX}${device}`, l);
}

// ---------- Cuentas ----------

/** Redondeo al céntimo, igual en positivo que en negativo (la rectificativa es la factura en negativo, al céntimo). */
const round = (x: number) => Math.sign(x) * Math.round(Math.abs(x) + 1e-9) || 0;

/** Base, IVA, retención y total de unas líneas. */
export function totalsOf(lines: InvoiceLine[], vatRate: number, irpfRate: number) {
  const baseCents = lines.reduce((sum, l) => sum + l.qty * l.unitCents, 0);
  const vatCents = round((baseCents * vatRate) / 100);
  const irpfCents = round((baseCents * irpfRate) / 100);
  return { baseCents, vatCents, irpfCents, totalCents: baseCents + vatCents - irpfCents };
}

/** «A2026-0007». */
export const codeOf = (series: string, number: number) => `${series}-${String(number).padStart(4, "0")}`;

/** El texto con que se calcula la huella: todo lo que dice la factura, en un orden fijo, y la huella anterior. */
export function hashText(i: Omit<Invoice, "id" | "hash" | "createdBy" | "createdAt" | "patientId" | "paymentId">): string {
  return JSON.stringify([
    i.code,
    i.series,
    i.number,
    i.kind,
    i.issuedOn,
    i.operationOn,
    i.rectifiesId,
    [i.issuer.name, i.issuer.taxId, i.issuer.address],
    [i.recipient.name, i.recipient.taxId, i.recipient.address],
    i.lines.map((l) => [l.concept, l.qty, l.unitCents]),
    i.baseCents,
    i.vatRate,
    i.vatCents,
    i.irpfRate,
    i.irpfCents,
    i.totalCents,
    i.exemption,
    i.reason,
    i.prevHash,
  ]);
}

export async function sha256Hex(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Leer ----------

type Row = {
  id: string;
  series: string;
  number: number;
  code: string;
  kind: InvoiceKind;
  issued_on: string;
  operation_on: string | null;
  patient_id: string | null;
  payment_id: string | null;
  rectifies_id: string | null;
  issuer: string;
  recipient: string;
  lines: string;
  base_cents: number;
  vat_rate: number;
  vat_cents: number;
  irpf_rate: number;
  irpf_cents: number;
  total_cents: number;
  exemption: string;
  reason: string;
  prev_hash: string;
  hash: string;
  created_by: string;
  created_at: string;
};

const fromRow = (r: Row): Invoice => ({
  id: r.id,
  series: r.series,
  number: r.number,
  code: r.code,
  kind: r.kind,
  issuedOn: r.issued_on,
  operationOn: r.operation_on,
  patientId: r.patient_id,
  paymentId: r.payment_id,
  rectifiesId: r.rectifies_id,
  issuer: JSON.parse(r.issuer) as Party,
  recipient: JSON.parse(r.recipient) as Party,
  lines: JSON.parse(r.lines) as InvoiceLine[],
  baseCents: r.base_cents,
  vatRate: r.vat_rate,
  vatCents: r.vat_cents,
  irpfRate: r.irpf_rate,
  irpfCents: r.irpf_cents,
  totalCents: r.total_cents,
  exemption: r.exemption,
  reason: r.reason,
  prevHash: r.prev_hash,
  hash: r.hash,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

export async function getInvoice(db: Db, id: string): Promise<Invoice | null> {
  const [r] = await db.query<Row>("select * from invoices where id = ?", [id]);
  return r ? fromRow(r) : null;
}

/** Las facturas de un año (o todas), por serie y número. */
export async function listInvoices(db: Db, year?: number): Promise<Invoice[]> {
  const rows = year
    ? await db.query<Row>("select * from invoices where issued_on >= ? and issued_on < ? order by series, number", [`${year}-01-01`, `${year + 1}-01-01`])
    : await db.query<Row>("select * from invoices order by series, number");
  return rows.map(fromRow);
}

export async function invoicesOfPatient(db: Db, patientId: string): Promise<Invoice[]> {
  return (await db.query<Row>("select * from invoices where patient_id = ? order by issued_on, series, number", [patientId])).map(fromRow);
}

/** La factura que vale de cada cobro: la que no se ha anulado con una rectificativa (anulada, se puede hacer otra). */
export async function invoicesOfPayments(db: Db, paymentIds: string[]): Promise<Map<string, Invoice>> {
  const out = new Map<string, Invoice>();
  if (!paymentIds.length) return out;
  const rows = await db.query<Row>(
    `select * from invoices i where payment_id in (${paymentIds.map(() => "?").join(",")}) and kind != 'rectificativa'
        and not exists (select 1 from invoices r where r.rectifies_id = i.id) order by created_at`,
    paymentIds,
  );
  for (const r of rows) out.set(r.payment_id!, fromRow(r));
  return out;
}

/** La rectificativa de una factura, si la tiene. */
export async function rectificationOf(db: Db, id: string): Promise<Invoice | null> {
  const [r] = await db.query<Row>("select * from invoices where rectifies_id = ? order by created_at limit 1", [id]);
  return r ? fromRow(r) : null;
}

// ---------- Emitir ----------

/** Lo último de una serie: su número, su fecha y su huella. */
async function lastOf(db: Db, series: string) {
  const [r] = await db.query<{ number: number; issued_on: string; hash: string }>("select number, issued_on, hash from invoices where series = ? order by number desc limit 1", [series]);
  return r ?? null;
}

const SIMPLIFIED_MAX_CENTS = 40_000;

/** Comprueba lo escrito antes de emitir. Devuelve el texto del problema o null. */
export function invoiceProblem(input: InvoiceInput, issuer: Party, today: string): string | null {
  if (!issuer.name.trim() || !issuer.taxId.trim()) return "Faltan el nombre o el NIF de la clínica: rellénalos en Ajustes › Clínica y protección de datos.";
  if (!DAY.test(input.issuedOn)) return "Falta la fecha de la factura.";
  if (input.issuedOn > today) return "La fecha de la factura no puede ser de un día que aún no ha llegado.";
  if (input.operationOn && !DAY.test(input.operationOn)) return "La fecha del servicio no es válida.";
  if (input.kind === "completa" && !input.recipient.name.trim()) return "Falta el nombre de a quién se hace la factura.";
  if (!input.lines.length) return "Falta lo que se factura.";
  for (const l of input.lines) {
    if (!l.concept.trim()) return "Cada línea necesita su concepto.";
    if (!(Number.isInteger(l.qty) && l.qty >= 1)) return "Las unidades tienen que ser un número entero de 1 o más.";
    if (!(Number.isInteger(l.unitCents) && l.unitCents > 0)) return "Cada línea necesita su precio.";
  }
  if (!(input.vatRate >= 0 && input.vatRate <= 100) || !(input.irpfRate >= 0 && input.irpfRate <= 100)) return "El porcentaje no es válido.";
  if (input.vatRate === 0 && !input.exemption.trim()) return "Sin IVA, escribe el motivo de la exención.";
  const t = totalsOf(input.lines, input.vatRate, input.irpfRate);
  if (input.kind === "simplificada" && t.baseCents + t.vatCents > SIMPLIFIED_MAX_CENTS) return "Una factura simplificada no puede pasar de 400 € (IVA incluido): hazla completa.";
  return null;
}

async function insert(db: Db, inv: Omit<Invoice, "hash" | "prevHash" | "number" | "code">): Promise<Invoice> {
  const last = await lastOf(db, inv.series);
  if (last && inv.issuedOn < last.issued_on) throw new RangeError(`La fecha no puede ser anterior a la de la última factura de la serie ${inv.series} (${last.issued_on.split("-").reverse().join("/")}).`);
  const number = (last?.number ?? 0) + 1;
  const code = codeOf(inv.series, number);
  const prevHash = last?.hash ?? "";
  const full: Invoice = { ...inv, number, code, prevHash, hash: "" };
  full.hash = await sha256Hex(hashText(full));
  const t = nowIso();
  await db.transaction([
    {
      sql: `insert into invoices (id, series, number, code, kind, issued_on, operation_on, patient_id, payment_id, rectifies_id, issuer, recipient, lines,
              base_cents, vat_rate, vat_cents, irpf_rate, irpf_cents, total_cents, exemption, reason, prev_hash, hash, created_by, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [
        full.id,
        full.series,
        full.number,
        full.code,
        full.kind,
        full.issuedOn,
        full.operationOn,
        full.patientId,
        full.paymentId,
        full.rectifiesId,
        JSON.stringify(full.issuer),
        JSON.stringify(full.recipient),
        JSON.stringify(full.lines),
        full.baseCents,
        full.vatRate,
        full.vatCents,
        full.irpfRate,
        full.irpfCents,
        full.totalCents,
        full.exemption,
        full.reason,
        full.prevHash,
        full.hash,
        full.createdBy,
        t,
        t,
      ],
    },
  ]);
  return { ...full, createdAt: t };
}

const clean = (p: Party): Party => ({ name: p.name.trim(), taxId: p.taxId.trim().toUpperCase(), address: p.address.trim() });

/** Emite una factura con el siguiente número de la serie de `who` en ese año. */
export async function issueInvoice(db: Db, input: InvoiceInput, issuer: Party, who: string, today: string): Promise<Invoice> {
  const problem = invoiceProblem(input, issuer, today);
  if (problem) throw new RangeError(problem);
  if (input.paymentId && (await invoicesOfPayments(db, [input.paymentId])).has(input.paymentId)) throw new RangeError("Ese cobro ya tiene su factura.");
  const letter = await seriesLetterOf(db, who);
  const lines = input.lines.map((l) => ({ concept: l.concept.trim(), qty: l.qty, unitCents: l.unitCents }));
  return insert(db, {
    id: newId(),
    series: `${letter}${input.issuedOn.slice(0, 4)}`,
    kind: input.kind,
    issuedOn: input.issuedOn,
    operationOn: input.operationOn && input.operationOn !== input.issuedOn ? input.operationOn : null,
    patientId: input.patientId,
    paymentId: input.paymentId,
    rectifiesId: null,
    issuer: clean(issuer),
    recipient: clean(input.recipient),
    lines,
    ...totalsOf(lines, input.vatRate, input.irpfRate),
    vatRate: input.vatRate,
    irpfRate: input.irpfRate,
    exemption: input.vatRate === 0 ? input.exemption.trim() : "",
    reason: "",
    createdBy: who,
    createdAt: "",
  });
}

/**
 * Anula una factura con una rectificativa: las mismas líneas en negativo, en la serie de rectificativas de quien la
 * hace, con el motivo. Si había que cambiar algo, después se hace una factura nueva bien hecha.
 */
export async function rectifyInvoice(db: Db, id: string, reason: string, issuer: Party, who: string, today: string): Promise<Invoice> {
  const original = await getInvoice(db, id);
  if (!original) throw new RangeError("Esta factura no existe.");
  if (original.kind === "rectificativa") throw new RangeError("Una rectificativa no se rectifica: si hace falta, haz una factura nueva.");
  if (await rectificationOf(db, id)) throw new RangeError("Esta factura ya tiene su rectificativa.");
  if (!reason.trim()) throw new RangeError("Escribe el motivo de la rectificación.");
  if (!issuer.name.trim() || !issuer.taxId.trim()) throw new RangeError("Faltan el nombre o el NIF de la clínica: rellénalos en Ajustes › Clínica y protección de datos.");
  const letter = await seriesLetterOf(db, who);
  const lines = original.lines.map((l) => ({ ...l, unitCents: -l.unitCents }));
  return insert(db, {
    id: newId(),
    series: `R${letter}${today.slice(0, 4)}`,
    kind: "rectificativa",
    issuedOn: today,
    operationOn: null,
    patientId: original.patientId,
    paymentId: original.paymentId,
    rectifiesId: original.id,
    issuer: clean(issuer),
    recipient: original.recipient,
    lines,
    ...totalsOf(lines, original.vatRate, original.irpfRate),
    vatRate: original.vatRate,
    irpfRate: original.irpfRate,
    exemption: original.exemption,
    reason: `Rectifica la factura ${original.code} del ${original.issuedOn.split("-").reverse().join("/")}: ${reason.trim()}`,
    createdBy: who,
    createdAt: "",
  });
}

// ---------- Comprobar ----------

export type ChainProblem = { code: string; problem: string };

/**
 * Repasa todas las facturas: números repetidos o saltados dentro de una serie, huellas que no cuadran con lo que dice
 * la factura o con la anterior. Vacío: todo en orden.
 */
export async function checkInvoices(invoices: Invoice[]): Promise<ChainProblem[]> {
  const out: ChainProblem[] = [];
  const bySeries = new Map<string, Invoice[]>();
  for (const i of invoices) bySeries.set(i.series, [...(bySeries.get(i.series) ?? []), i]);
  for (const [series, list] of bySeries) {
    list.sort((a, b) => a.number - b.number || a.createdAt.localeCompare(b.createdAt));
    let prev: Invoice | null = null;
    for (const i of list) {
      if (prev && prev.number === i.number) out.push({ code: i.code, problem: `Número repetido en la serie ${series}: hay dos facturas ${i.code}. Anula una con una rectificativa y vuelve a hacerla.` });
      else if (i.number !== (prev ? prev.number + 1 : 1)) out.push({ code: i.code, problem: `Falta algún número antes de ${i.code} en la serie ${series}.` });
      if ((await sha256Hex(hashText(i))) !== i.hash) out.push({ code: i.code, problem: `${i.code} ha cambiado después de emitirse: su contenido no cuadra con su huella.` });
      else if (prev && prev.number !== i.number && i.prevHash !== prev.hash) out.push({ code: i.code, problem: `${i.code} no sigue a ${prev.code}: la cadena de huellas está rota.` });
      prev = i;
    }
  }
  return out;
}

// ---------- Libro de facturas ----------

const eurosCell = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const cell = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const ddmmyyyy = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");

/** El libro de facturas emitidas en CSV para Excel (punto y coma, coma decimal y BOM), para la gestoría. */
export function invoicesCsv(invoices: Invoice[]): string {
  const byId = new Map(invoices.map((i) => [i.id, i]));
  const header = [
    "Número",
    "Tipo",
    "Fecha de expedición",
    "Fecha de la operación",
    "Destinatario",
    "NIF del destinatario",
    "Base imponible (€)",
    "Tipo de IVA (%)",
    "Cuota de IVA (€)",
    "Retención IRPF (%)",
    "Retención IRPF (€)",
    "Total (€)",
    "Exención",
    "Rectifica a",
    "Motivo",
  ];
  const rows = [...invoices]
    .sort((a, b) => a.issuedOn.localeCompare(b.issuedOn) || a.series.localeCompare(b.series) || a.number - b.number)
    .map((i) => [
      i.code,
      KIND_LABELS[i.kind],
      ddmmyyyy(i.issuedOn),
      ddmmyyyy(i.operationOn),
      i.recipient.name,
      i.recipient.taxId,
      eurosCell(i.baseCents),
      String(i.vatRate).replace(".", ","),
      eurosCell(i.vatCents),
      String(i.irpfRate).replace(".", ","),
      eurosCell(i.irpfCents),
      eurosCell(i.totalCents),
      i.exemption,
      i.rectifiesId ? (byId.get(i.rectifiesId)?.code ?? "") : "",
      i.reason,
    ]);
  return `﻿${[header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n")}\r\n`;
}
