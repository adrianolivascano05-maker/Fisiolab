import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import {
  checkInvoices,
  codeOf,
  DEFAULT_EXEMPTION,
  getInvoice,
  invoiceProblem,
  invoicesCsv,
  invoicesOfPayments,
  issueInvoice,
  listInvoices,
  rectifyInvoice,
  setSeriesLetter,
  totalsOf,
  type InvoiceInput,
} from "./invoices";
import { createTestDb } from "./testDb";

const clinic = { name: "Fisiolab Centro", taxId: "B12345678", address: "Calle Mayor 1, Sevilla" };
const input = (over: Partial<InvoiceInput> = {}): InvoiceInput => ({
  kind: "completa",
  issuedOn: "2026-10-20",
  operationOn: null,
  patientId: "p1",
  paymentId: null,
  recipient: { name: "Ana Ruiz", taxId: "12345678z", address: "" },
  lines: [{ concept: "Sesión de fisioterapia", qty: 1, unitCents: 4500 }],
  vatRate: 0,
  exemption: DEFAULT_EXEMPTION,
  irpfRate: 0,
  ...over,
});
const TODAY = "2026-10-24";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("facturas", () => {
  it("cuentas: base, IVA, retención y total, en céntimos y redondeados", () => {
    expect(totalsOf([{ concept: "a", qty: 3, unitCents: 4000 }], 0, 0)).toEqual({ baseCents: 12000, vatCents: 0, irpfCents: 0, totalCents: 12000 });
    expect(totalsOf([{ concept: "a", qty: 1, unitCents: 3333 }], 21, 15)).toEqual({ baseCents: 3333, vatCents: 700, irpfCents: 500, totalCents: 3533 });
    expect(totalsOf([{ concept: "a", qty: 1, unitCents: -3333 }], 21, 0)).toEqual({ baseCents: -3333, vatCents: -700, irpfCents: 0, totalCents: -4033 });
    expect(codeOf("A2026", 7)).toBe("A2026-0007");
  });

  it("antes de emitir: datos de la clínica, fecha, destinatario, líneas, exención y el tope de la simplificada", () => {
    expect(invoiceProblem(input(), { ...clinic, taxId: "" }, TODAY)).toMatch(/NIF de la clínica/);
    expect(invoiceProblem(input({ issuedOn: "2026-10-25" }), clinic, TODAY)).toMatch(/aún no ha llegado/);
    expect(invoiceProblem(input({ recipient: { name: " ", taxId: "", address: "" } }), clinic, TODAY)).toMatch(/a quién/);
    expect(invoiceProblem(input({ kind: "simplificada", recipient: { name: "", taxId: "", address: "" } }), clinic, TODAY)).toBeNull();
    expect(invoiceProblem(input({ lines: [] }), clinic, TODAY)).toMatch(/lo que se factura/);
    expect(invoiceProblem(input({ lines: [{ concept: "x", qty: 0, unitCents: 100 }] }), clinic, TODAY)).toMatch(/unidades/);
    expect(invoiceProblem(input({ exemption: "" }), clinic, TODAY)).toMatch(/exención/);
    expect(invoiceProblem(input({ vatRate: 21, exemption: "" }), clinic, TODAY)).toBeNull();
    expect(invoiceProblem(input({ kind: "simplificada", lines: [{ concept: "Bono", qty: 1, unitCents: 40_001 }] }), clinic, TODAY)).toMatch(/400 €/);
  });

  it("numeración correlativa por serie y año, cada persona con su letra; la fecha no puede ir hacia atrás", async () => {
    const a1 = await issueInvoice(db, input(), clinic, "", TODAY);
    const a2 = await issueInvoice(db, input({ issuedOn: "2026-10-21" }), clinic, "", TODAY);
    expect([a1.code, a2.code]).toEqual(["A2026-0001", "A2026-0002"]);
    expect(a1.recipient.taxId).toBe("12345678Z");
    // Otra persona de la clínica: su propia serie, desde el 1.
    const b1 = await issueInvoice(db, input(), clinic, "laura@clinica.test", TODAY);
    expect(b1.code).toBe("B2026-0001");
    // No se puede emitir con fecha anterior a la última de su serie.
    await expect(issueInvoice(db, input({ issuedOn: "2026-10-19" }), clinic, "", TODAY)).rejects.toThrow(/anterior a la de la última factura de la serie A2026/);
    // Año nuevo, número 1 otra vez.
    const next = await issueInvoice(db, input({ issuedOn: "2027-01-02" }), clinic, "", "2027-01-02");
    expect(next.code).toBe("A2027-0001");
    // La letra se puede cambiar si nadie más la usa.
    await expect(setSeriesLetter(db, "laura@clinica.test", "A")).rejects.toThrow(/otra persona/);
    await expect(setSeriesLetter(db, "laura@clinica.test", "R")).rejects.toThrow(/rectificativas/);
    await setSeriesLetter(db, "laura@clinica.test", "LG");
    expect((await issueInvoice(db, input({ issuedOn: "2026-10-22" }), clinic, "laura@clinica.test", TODAY)).code).toBe("LG2026-0001");
  });

  it("un cobro solo tiene una factura; se guarda tal cual estaba la clínica al emitirla", async () => {
    const f = await issueInvoice(db, input({ paymentId: "cobro-1" }), clinic, "", TODAY);
    await expect(issueInvoice(db, input({ paymentId: "cobro-1" }), clinic, "", TODAY)).rejects.toThrow(/ya tiene su factura/);
    expect((await invoicesOfPayments(db, ["cobro-1", "otro"])).get("cobro-1")!.code).toBe(f.code);
    expect((await getInvoice(db, f.id))!.issuer).toEqual(clinic);
    // Anulada con una rectificativa, el cobro puede tener otra factura (la buena).
    await rectifyInvoice(db, f.id, "datos mal", clinic, "", TODAY);
    expect((await invoicesOfPayments(db, ["cobro-1"])).has("cobro-1")).toBe(false);
    const again = await issueInvoice(db, input({ paymentId: "cobro-1" }), clinic, "", TODAY);
    expect(again.code).toBe("A2026-0002");
  });

  it("rectificativa: en su propia serie, en negativo, con el motivo; solo una por factura", async () => {
    const f = await issueInvoice(db, input({ vatRate: 21, exemption: "", lines: [{ concept: "Masaje deportivo", qty: 2, unitCents: 3000 }] }), clinic, "", TODAY);
    const r = await rectifyInvoice(db, f.id, "el paciente no vino a la segunda", clinic, "", TODAY);
    expect(r).toEqual(
      expect.objectContaining({
        code: "RA2026-0001",
        kind: "rectificativa",
        rectifiesId: f.id,
        baseCents: -6000,
        vatCents: -1260,
        totalCents: -7260,
        reason: "Rectifica la factura A2026-0001 del 20/10/2026: el paciente no vino a la segunda",
      }),
    );
    await expect(rectifyInvoice(db, f.id, "otra vez", clinic, "", TODAY)).rejects.toThrow(/ya tiene su rectificativa/);
    await expect(rectifyInvoice(db, r.id, "x", clinic, "", TODAY)).rejects.toThrow(/no se rectifica/);
    await expect(rectifyInvoice(db, (await issueInvoice(db, input(), clinic, "", TODAY)).id, " ", clinic, "", TODAY)).rejects.toThrow(/motivo/);
  });

  it("la cadena de huellas: en orden, avisa si alguien cambia una factura o si hay números repetidos", async () => {
    await issueInvoice(db, input(), clinic, "", TODAY);
    await issueInvoice(db, input(), clinic, "", TODAY);
    await issueInvoice(db, input(), clinic, "", TODAY);
    expect(await checkInvoices(await listInvoices(db))).toEqual([]);
    // Alguien cambia el importe de la segunda directamente en la base.
    await db.transaction([{ sql: "update invoices set total_cents = 100 where code = 'A2026-0002'", bind: [] }]);
    expect(await checkInvoices(await listInvoices(db))).toEqual([{ code: "A2026-0002", problem: expect.stringMatching(/ha cambiado después de emitirse/) }]);
    // Dos dispositivos con la misma serie sin conexión: el mismo número dos veces.
    const all = await listInvoices(db);
    const dup = { ...all[2]!, id: "otra", createdAt: "2099-01-01T00:00:00.000Z" };
    const problems = await checkInvoices([...all, dup]);
    expect(problems.some((p) => /Número repetido/.test(p.problem))).toBe(true);
  });

  it("el libro de facturas para la gestoría: CSV para Excel con coma decimal", async () => {
    const f = await issueInvoice(db, input({ recipient: { name: "Mutua; S.A.", taxId: "A11111111", address: "" }, irpfRate: 15 }), clinic, "", TODAY);
    await rectifyInvoice(db, f.id, "error en el destinatario", clinic, "", TODAY);
    const csv = invoicesCsv(await listInvoices(db, 2026));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split("\r\n");
    expect(lines[0]).toContain("Número;Tipo;Fecha de expedición");
    expect(lines[1]).toBe(`A2026-0001;Factura;20/10/2026;;"Mutua; S.A.";A11111111;45,00;0;0,00;15;6,75;38,25;${DEFAULT_EXEMPTION};;`);
    expect(lines[2]).toMatch(/^RA2026-0001;Factura rectificativa;24\/10\/2026;.*;-45,00;.*;A2026-0001;Rectifica la factura A2026-0001/);
  });
});
