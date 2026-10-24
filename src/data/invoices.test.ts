// Las facturas hechas con la app antes del 24-10-2026, en solo lectura. La app ya no las emite: aquí se ponen en la
// base tal como las dejaba (con su huella encadenada) para comprobar que se leen, se revisan y no se pierden.
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import { checkInvoices, hashText, invoicesCsv, invoicesOfPayments, listInvoices, rectificationOf, sha256Hex, type Invoice } from "./invoices";
import { createTestDb } from "./testDb";

const EXEMPTION = "Operación exenta de IVA (artículo 20.Uno.3º de la Ley 37/1992, del IVA)";
const clinic = { name: "Fisiolab Centro", taxId: "B12345678", address: "Calle Mayor 1, Sevilla" };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

/** Una factura como las guardaba la app: número siguiente de su serie y huella encadenada con la anterior. */
async function seed(over: Partial<Invoice> & { series?: string } = {}): Promise<Invoice> {
  const series = over.series ?? "A2026";
  const prev = (await listInvoices(db)).filter((i) => i.series === series).at(-1);
  const number = (prev?.number ?? 0) + 1;
  const sign = over.kind === "rectificativa" ? -1 : 1;
  const base: Omit<Invoice, "hash"> = {
    id: crypto.randomUUID(),
    series,
    number,
    code: `${series}-${String(number).padStart(4, "0")}`,
    kind: "completa",
    issuedOn: "2026-10-20",
    operationOn: null,
    patientId: "p1",
    paymentId: null,
    rectifiesId: null,
    issuer: clinic,
    recipient: { name: "Ana Ruiz", taxId: "12345678Z", address: "" },
    lines: [{ concept: "Sesión de fisioterapia", qty: 1, unitCents: sign * 4500 }],
    baseCents: sign * 4500,
    vatRate: 0,
    vatCents: 0,
    irpfRate: 0,
    irpfCents: 0,
    totalCents: sign * 4500,
    exemption: EXEMPTION,
    reason: "",
    prevHash: prev?.hash ?? "",
    createdBy: "",
    createdAt: new Date(Date.UTC(2026, 9, 20, 10, number)).toISOString(),
    ...over,
  };
  const inv: Invoice = { ...base, hash: await sha256Hex(hashText(base)) };
  await db.transaction([
    {
      sql: `insert into invoices (id, series, number, code, kind, issued_on, operation_on, patient_id, payment_id, rectifies_id, issuer, recipient, lines,
              base_cents, vat_rate, vat_cents, irpf_rate, irpf_cents, total_cents, exemption, reason, prev_hash, hash, created_by, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [
        inv.id,
        inv.series,
        inv.number,
        inv.code,
        inv.kind,
        inv.issuedOn,
        inv.operationOn,
        inv.patientId,
        inv.paymentId,
        inv.rectifiesId,
        JSON.stringify(inv.issuer),
        JSON.stringify(inv.recipient),
        JSON.stringify(inv.lines),
        inv.baseCents,
        inv.vatRate,
        inv.vatCents,
        inv.irpfRate,
        inv.irpfCents,
        inv.totalCents,
        inv.exemption,
        inv.reason,
        inv.prevHash,
        inv.hash,
        inv.createdBy,
        inv.createdAt,
        inv.createdAt,
      ],
    },
  ]);
  return inv;
}

describe("facturas hechas con la app (solo lectura)", () => {
  it("se leen tal cual, por serie y número, y de un año", async () => {
    await seed();
    await seed({ issuedOn: "2026-10-21" });
    await seed({ series: "A2025", issuedOn: "2025-12-30" });
    expect((await listInvoices(db)).map((i) => i.code)).toEqual(["A2025-0001", "A2026-0001", "A2026-0002"]);
    expect((await listInvoices(db, 2026)).map((i) => i.code)).toEqual(["A2026-0001", "A2026-0002"]);
    expect((await listInvoices(db))[1]).toMatchObject({ issuer: clinic, recipient: { name: "Ana Ruiz" }, totalCents: 4500, exemption: EXEMPTION });
  });

  it("la cadena de huellas: en orden, avisa si alguien cambia una factura o si hay números repetidos", async () => {
    await seed();
    await seed();
    await seed();
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

  it("la factura de cada cobro es la que no se anuló; la rectificativa se encuentra desde la original", async () => {
    const a = await seed({ paymentId: "cobro-1" });
    const r = await seed({ series: "RA2026", kind: "rectificativa", rectifiesId: a.id, paymentId: "cobro-1", reason: "Rectifica la factura A2026-0001" });
    const b = await seed({ paymentId: "cobro-1" });
    const c = await seed({ paymentId: "cobro-2" });
    const made = await invoicesOfPayments(db, ["cobro-1", "cobro-2", "cobro-3"]);
    expect([...made].map(([k, v]) => [k, v.code])).toEqual([
      ["cobro-1", b.code],
      ["cobro-2", c.code],
    ]);
    expect((await rectificationOf(db, a.id))?.id).toBe(r.id);
    expect(await rectificationOf(db, b.id)).toBeNull();
  });

  it("restaurar una copia antigua no borra las facturas hechas después", async () => {
    await seed();
    const backup = await db.exportBytes();
    await seed({ issuedOn: "2026-10-21" });
    await db.importBytes(backup);
    expect((await listInvoices(db)).map((i) => i.code)).toEqual(["A2026-0001", "A2026-0002"]);
    expect(await checkInvoices(await listInvoices(db))).toEqual([]);
  });

  it("el libro de facturas para la gestoría: CSV para Excel con coma decimal", async () => {
    const f = await seed({
      recipient: { name: "Mutua; S.A.", taxId: "A11111111", address: "" },
      irpfRate: 15,
      irpfCents: 675,
      totalCents: 3825,
    });
    await seed({
      series: "RA2026",
      kind: "rectificativa",
      issuedOn: "2026-10-24",
      rectifiesId: f.id,
      reason: "Rectifica la factura A2026-0001: error en el destinatario",
    });
    const csv = invoicesCsv(await listInvoices(db, 2026));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split("\r\n");
    expect(lines[0]).toContain("Número;Tipo;Fecha de expedición");
    expect(lines[1]).toBe(`A2026-0001;Factura;20/10/2026;;"Mutua; S.A.";A11111111;45,00;0;0,00;15;6,75;38,25;${EXEMPTION};;`);
    expect(lines[2]).toMatch(/^RA2026-0001;Factura rectificativa;24\/10\/2026;.*;-45,00;.*;A2026-0001;Rectifica la factura A2026-0001/);
  });
});
