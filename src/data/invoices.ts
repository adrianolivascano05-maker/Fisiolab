// Facturas hechas con la app (migración 028), en SOLO LECTURA. Desde el 24-10-2026 la app no hace facturas: cada
// clínica factura con su propio programa a partir de los cobros (src/data/toBill.ts). Las que se hicieron antes se
// quedan tal cual: se pueden ver, imprimir, guardar en PDF y sacar en su libro, y nunca se borran (tampoco al borrar
// el paciente ni al restaurar una copia antigua, src/data/engine.ts).
// Se numeraban dentro de cada serie («A2026», «B2026»…; las rectificativas, «RA2026») y cada una guarda los datos del
// emisor y del destinatario tal como estaban y una huella SHA-256 encadenada con la anterior de su serie: si alguien
// cambia una factura en la base, la cadena deja de cuadrar y la lista lo avisa. No es Verifactu.
// Las cantidades van en céntimos.
import type { Db } from "./db";

export type InvoiceKind = "completa" | "simplificada" | "rectificativa";
export const KIND_LABELS: Record<InvoiceKind, string> = { completa: "Factura", simplificada: "Factura simplificada", rectificativa: "Factura rectificativa" };
/** Quien emite o recibe la factura: nombre o razón social, NIF (o DNI/NIE) y domicilio. */
export type Party = { name: string; taxId: string; address: string };
/** Una línea: concepto, unidades y precio de cada una (sin IVA). En una rectificativa, en negativo. */
export type InvoiceLine = { concept: string; qty: number; unitCents: number };

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

/** La factura que vale de cada cobro: la que no se anuló con una rectificativa. */
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
      if (prev && prev.number === i.number) out.push({ code: i.code, problem: `Número repetido en la serie ${series}: hay dos facturas ${i.code}. Revísalo con tu gestoría.` });
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
