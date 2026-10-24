// Para facturar (24-10-2026). La app no hace facturas: cada clínica factura con su propio programa (el suyo, el de la
// gestoría o el de Hacienda), que es quien numera y cumple Verifactu. Aquí se reúnen los cobros con los datos del
// paciente que hacen falta para la factura y se sacan en un Excel para pasarlos a ese programa. La clínica puede
// apuntar en cada cobro el número que le dio su programa (billing.ts, setInvoiceRef): así sabe qué falta por facturar.
// Las facturas que se hicieron con la app antes de esa fecha siguen en src/data/invoices.ts, en solo lectura.
import { methodLabel, type Payment } from "./billing";
import type { Db } from "./db";
import { invoicesOfPayments } from "./invoices";
import { getSetting, setSetting } from "./repo";
import { dayDmy } from "../app/format";

/** Lo que va en el Excel sobre el IVA y la retención: lo decide la clínica con su asesoría. */
export type BillingDefaults = { vatRate: number; exemption: string; irpfRate: number };
/** El mismo ajuste que usaban las facturas de la app: quien ya lo tenía puesto no tiene que volver a hacerlo. */
const BILLING_DEFAULTS_KEY = "invoice_settings";
export const DEFAULT_EXEMPTION = "Operación exenta de IVA (artículo 20.Uno.3º de la Ley 37/1992, del IVA)";
export const DEFAULT_BILLING: BillingDefaults = { vatRate: 0, exemption: DEFAULT_EXEMPTION, irpfRate: 0 };

export async function getBillingDefaults(db: Db): Promise<BillingDefaults> {
  return { ...DEFAULT_BILLING, ...(await getSetting<Partial<BillingDefaults>>(db, BILLING_DEFAULTS_KEY)) };
}

export async function saveBillingDefaults(db: Db, s: BillingDefaults): Promise<void> {
  if (![0, 4, 10, 21].includes(s.vatRate)) throw new RangeError("Elige el tipo de IVA.");
  if (![0, 7, 15].includes(s.irpfRate)) throw new RangeError("Elige la retención.");
  await setSetting(db, BILLING_DEFAULTS_KEY, { vatRate: s.vatRate, exemption: s.exemption.trim(), irpfRate: s.irpfRate });
}

/** Un cobro con lo que pide una factura del paciente, y su número de factura si ya la tiene. */
export type ToBill = Payment & {
  name: string;
  dni: string;
  address: string;
  phone: string;
  email: string;
  /** El número de su factura: el que apuntó la clínica o, si se hizo con la app antes, el de esa factura. */
  invoice: string;
  /** La factura hecha con la app, si la tiene (para abrirla). */
  appInvoiceId: string | null;
};

type Row = {
  id: string;
  patient_id: string;
  amount_cents: number;
  method: Payment["method"];
  paid_on: string;
  concept: string;
  pack_id: string | null;
  invoice_ref: string;
  name: string;
  dni: string;
  address: string;
  phone: string;
  email: string;
};

/** Los cobros entre dos días (AAAA-MM-DD, el segundo sin incluir), por fecha. */
export async function toBillBetween(db: Db, from: string, to: string): Promise<ToBill[]> {
  const rows = await db.query<Row>(
    `select y.id, y.patient_id, y.amount_cents, y.method, y.paid_on, y.concept, y.pack_id, y.invoice_ref, p.name, p.dni, p.address, p.phone, p.email
       from payments y join patients p on p.id = y.patient_id
      where y.paid_on >= ? and y.paid_on < ? order by y.paid_on, y.created_at`,
    [from, to],
  );
  const made = await invoicesOfPayments(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => {
    const app = made.get(r.id) ?? null;
    return {
      id: r.id,
      patientId: r.patient_id,
      amountCents: r.amount_cents,
      method: r.method,
      paidOn: r.paid_on,
      concept: r.concept,
      packId: r.pack_id,
      invoiceRef: r.invoice_ref ?? "",
      name: r.name,
      dni: r.dni ?? "",
      address: r.address ?? "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      invoice: (r.invoice_ref ?? "").trim() || (app?.code ?? ""),
      appInvoiceId: app?.id ?? null,
    };
  });
}

/** El concepto de la factura: el que se escribió al cobrar o, si no hay, el genérico. */
export const conceptOf = (p: Pick<Payment, "concept">) => p.concept.trim() || "Sesión de fisioterapia";

/**
 * La hoja de Excel para el programa de facturación de la clínica: un cobro por fila, con el paciente y lo que la
 * clínica tiene puesto de IVA y retención. Los importes, como números (lo cobrado, tal cual).
 */
export function toBillSheet(rows: ToBill[], d: BillingDefaults) {
  return {
    name: "Para facturar",
    header: [
      "Fecha del cobro",
      "Paciente",
      "DNI/NIF",
      "Dirección",
      "Teléfono",
      "Correo",
      "Concepto",
      "Forma de pago",
      "Importe cobrado (€)",
      "IVA (%)",
      "Motivo de la exención",
      "Retención IRPF (%)",
      "Nº de factura",
      "Referencia del cobro",
    ],
    rows: rows.map((r) => [
      dayDmy(r.paidOn),
      r.name,
      r.dni.toUpperCase(),
      r.address,
      r.phone,
      r.email,
      conceptOf(r),
      methodLabel(r.method),
      r.amountCents / 100,
      d.vatRate,
      d.vatRate === 0 ? d.exemption : "",
      d.irpfRate,
      r.invoice,
      r.id,
    ]),
  };
}
