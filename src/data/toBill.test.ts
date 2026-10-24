import { beforeEach, describe, expect, it } from "vitest";
import { addPayment, setInvoiceRef } from "./billing";
import type { Db } from "./db";
import { createPatient } from "./repo";
import { createTestDb } from "./testDb";
import { conceptOf, DEFAULT_BILLING, DEFAULT_EXEMPTION, getBillingDefaults, saveBillingDefaults, toBillBetween, toBillSheet } from "./toBill";

const patient = (name: string, more: Record<string, string> = {}) => ({
  name,
  birthDate: null,
  sex: null,
  bodyMassKg: null,
  heightCm: null,
  legLengthCm: null,
  pushOffDistanceCm: null,
  notes: "",
  ...more,
});

let db: Db;
let ana: string;
let luis: string;
beforeEach(async () => {
  db = await createTestDb();
  ana = await createPatient(db, patient("Ana Ruiz", { dni: "12345678z", address: "Calle Sol 2, Sevilla", phone: "611222333", email: "ana@ejemplo.es" }));
  luis = await createPatient(db, patient("Luis Pérez"));
});

describe("para facturar", () => {
  it("los cobros del mes con lo que pide la factura del paciente; los del mes siguiente, no", async () => {
    const a = await addPayment(db, ana, { amountCents: 4000, method: "tarjeta", paidOn: "2026-10-05", concept: "Sesión" });
    await addPayment(db, luis, { amountCents: 17500, method: "bizum", paidOn: "2026-10-20", concept: "" });
    await addPayment(db, ana, { amountCents: 2000, method: "efectivo", paidOn: "2026-11-01", concept: "" });
    const rows = await toBillBetween(db, "2026-10-01", "2026-11-01");
    expect(rows.map((r) => [r.name, r.amountCents, r.method])).toEqual([
      ["Ana Ruiz", 4000, "tarjeta"],
      ["Luis Pérez", 17500, "bizum"],
    ]);
    expect(rows[0]).toMatchObject({ id: a, dni: "12345678Z", address: "Calle Sol 2, Sevilla", phone: "611222333", email: "ana@ejemplo.es", invoice: "", appInvoiceId: null });
    expect(rows[1]).toMatchObject({ dni: "", address: "", invoice: "" });
    expect(conceptOf(rows[1]!)).toBe("Sesión de fisioterapia");
  });

  it("el número de la factura hecha fuera se apunta en el cobro, se cambia y se quita; y se sincroniza", async () => {
    const a = await addPayment(db, ana, { amountCents: 4000, method: "tarjeta", paidOn: "2026-10-05", concept: "" });
    const before = (await db.query<{ changes: number }>("select changes from sync_state"))[0]!.changes;
    await setInvoiceRef(db, a, "  2026/ 015 ");
    expect((await toBillBetween(db, "2026-10-01", "2026-11-01"))[0]).toMatchObject({ invoiceRef: "2026/ 015", invoice: "2026/ 015" });
    expect((await db.query<{ changes: number }>("select changes from sync_state"))[0]!.changes).toBeGreaterThan(before);
    await setInvoiceRef(db, a, "");
    expect((await toBillBetween(db, "2026-10-01", "2026-11-01"))[0]!.invoice).toBe("");
    await expect(setInvoiceRef(db, a, "x".repeat(61))).rejects.toThrow(/demasiado largo/);
  });

  it("si el cobro ya tenía una factura hecha con la app, sale su número", async () => {
    const a = await addPayment(db, ana, { amountCents: 4000, method: "tarjeta", paidOn: "2026-10-05", concept: "" });
    await db.transaction([
      {
        sql: `insert into invoices (id, series, number, code, kind, issued_on, payment_id, issuer, recipient, lines, base_cents, total_cents, hash, created_at, updated_at)
              values ('f1', 'A2026', 1, 'A2026-0001', 'completa', '2026-10-05', ?, '{}', '{}', '[]', 4000, 4000, 'h', '2026-10-05T10:00:00Z', '2026-10-05T10:00:00Z')`,
        bind: [a],
      },
    ]);
    expect((await toBillBetween(db, "2026-10-01", "2026-11-01"))[0]).toMatchObject({ invoice: "A2026-0001", appInvoiceId: "f1" });
  });

  it("la hoja de Excel: una fila por cobro, con el IVA y la retención que tiene puestos la clínica", async () => {
    const a = await addPayment(db, ana, { amountCents: 4050, method: "tarjeta", paidOn: "2026-10-05", concept: "Bono 5 sesiones" });
    await setInvoiceRef(db, a, "F-7");
    const sheet = toBillSheet(await toBillBetween(db, "2026-10-01", "2026-11-01"), DEFAULT_BILLING);
    expect(sheet.header).toEqual([
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
    ]);
    expect(sheet.rows).toEqual([
      ["05/10/2026", "Ana Ruiz", "12345678Z", "Calle Sol 2, Sevilla", "611222333", "ana@ejemplo.es", "Bono 5 sesiones", "Tarjeta", 40.5, 0, DEFAULT_EXEMPTION, 0, "F-7", a],
    ]);
    // Con IVA, sin motivo de exención.
    expect(toBillSheet(await toBillBetween(db, "2026-10-01", "2026-11-01"), { vatRate: 21, exemption: DEFAULT_EXEMPTION, irpfRate: 15 }).rows[0]!.slice(9, 12)).toEqual([21, "", 15]);
  });

  it("lo que va sobre el IVA: por defecto exenta; se guarda para toda la clínica", async () => {
    expect(await getBillingDefaults(db)).toEqual(DEFAULT_BILLING);
    await saveBillingDefaults(db, { vatRate: 21, exemption: " ", irpfRate: 15 });
    expect(await getBillingDefaults(db)).toEqual({ vatRate: 21, exemption: "", irpfRate: 15 });
    await expect(saveBillingDefaults(db, { vatRate: 3, exemption: "", irpfRate: 0 })).rejects.toThrow(/IVA/);
  });
});
