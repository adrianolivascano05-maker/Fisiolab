import { beforeEach, describe, expect, it } from "vitest";
import { accountLine, addPayment, allocate, collectedBetween, createPack, deletePack, euros, parseEuros, patientAccount, pendingAccounts, setPricing, type Pack } from "./billing";
import { saveSession } from "./clinical";
import type { Db } from "./db";
import { createPatient, deletePatient } from "./repo";
import { createTestDb } from "./testDb";

const patient = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const session = (performedAt: string) => ({ performedAt, pain: null, subjective: "", objective: "", treatment: "Terapia manual", plan: "", reviewOn: null, nextAt: null, nextMinutes: null });
const pack = (over: Partial<Pack> = {}) => ({ title: "Bono 5 sesiones", sessions: 5, priceCents: 17500, boughtOn: "2026-10-01", expiresOn: null, note: "", ...over });

let db: Db;
let ana: string;
beforeEach(async () => {
  db = await createTestDb();
  ana = await createPatient(db, patient("Ana Ruiz"));
});

describe("dinero", () => {
  it("lee cantidades como se escriben en España", () => {
    expect(parseEuros("40")).toBe(4000);
    expect(parseEuros("40,5")).toBe(4050);
    expect(parseEuros("40,50 €")).toBe(4050);
    expect(parseEuros("1.234,56")).toBe(123456);
    expect(parseEuros("1.234")).toBe(123400);
    expect(parseEuros("40.5")).toBe(4050);
    expect(parseEuros("")).toBeNull();
    expect(parseEuros("cuarenta")).toBeNull();
    expect(parseEuros("40,555")).toBeNull();
    expect(euros(4050).replace(/\s/g, " ")).toBe("40,50 €");
  });
});

describe("bonos", () => {
  it("las sesiones desde la compra gastan el bono, la más antigua primero; si caduca o se acaba, son sueltas", () => {
    const packs: Pack[] = [
      { ...pack({ sessions: 2, boughtOn: "2026-10-05" }), id: "b", patientId: "p" },
      { ...pack({ sessions: 1, boughtOn: "2026-10-01", expiresOn: "2026-10-02" }), id: "a", patientId: "p" },
    ];
    const s = (id: string, day: string) => ({ id, performedAt: `${day}T09:00:00.000Z` });
    const r = allocate(packs, [s("s4", "2026-10-07"), s("s1", "2026-09-30"), s("s2", "2026-10-02"), s("s3", "2026-10-03"), s("s5", "2026-10-08"), s("s6", "2026-10-09")], { sessionCents: 4000, since: "2026-10-01" }, "2026-10-10");
    expect(Object.fromEntries(r.bySession)).toEqual({ s2: "a", s3: null, s4: "b", s5: "b", s6: null });
    expect(r.loose).toEqual({ count: 2, cents: 8000 });
    expect(r.packs.map((p) => [p.id, p.used, p.left, p.expired])).toEqual([
      ["a", 1, 0, true],
      ["b", 2, 0, false],
    ]);
  });

  it("sin precio de sesión, las sueltas no cuentan", () => {
    const r = allocate([], [{ id: "s", performedAt: "2026-10-02T09:00:00.000Z" }], { sessionCents: null, since: null }, "2026-10-10");
    expect(r.loose).toEqual({ count: 0, cents: 0 });
    expect(r.bySession.size).toBe(0);
  });

  it("la cuenta: bono cobrado al venderlo, sesiones que lo gastan, sueltas desde el precio y cobros", async () => {
    await setPricing(db, { sessionCents: 4000, since: "2026-10-01" });
    await saveSession(db, ana, session("2026-09-20T09:00:00.000Z")); // antes del precio: no cuenta
    await createPack(db, ana, pack({ sessions: 2 }), "bizum");
    await saveSession(db, ana, session("2026-10-02T09:00:00.000Z"));
    await saveSession(db, ana, session("2026-10-03T09:00:00.000Z"));
    await saveSession(db, ana, session("2026-10-04T09:00:00.000Z")); // suelta
    let a = await patientAccount(db, ana, "2026-10-05");
    expect(a.packs[0]).toMatchObject({ used: 2, left: 0 });
    expect(a.loose).toEqual({ count: 1, cents: 4000 });
    expect(a.chargedCents).toBe(21500);
    expect(a.paidCents).toBe(17500);
    expect(a.balanceCents).toBe(4000);
    expect(a.payments[0]).toMatchObject({ method: "bizum", amountCents: 17500, paidOn: "2026-10-01", concept: "Bono 5 sesiones" });
    expect(accountLine(a)?.replace(/\s/g, " ")).toBe("Bono 5 sesiones: gastado · pendiente 40,00 €");

    await addPayment(db, ana, { amountCents: 5000, method: "efectivo", paidOn: "2026-10-04", concept: "Sesión" });
    a = await patientAccount(db, ana, "2026-10-05");
    expect(a.balanceCents).toBe(-1000);
    expect(accountLine(a)?.replace(/\s/g, " ")).toBe("Bono 5 sesiones: gastado · a cuenta 10,00 €");
  });

  it("no deja guardar bonos o cobros sin sentido", async () => {
    await expect(createPack(db, ana, pack({ sessions: 0 }))).rejects.toThrow(/1 a 200/);
    await expect(createPack(db, ana, pack({ title: " " }))).rejects.toThrow(/nombre/);
    await expect(createPack(db, ana, pack({ expiresOn: "2026-09-01" }))).rejects.toThrow(/caducidad/);
    await expect(addPayment(db, ana, { amountCents: 0, method: "efectivo", paidOn: "2026-10-01", concept: "" })).rejects.toThrow(/cuánto/);
  });

  it("borrar un bono deja sus cobros; borrar el paciente se lo lleva todo", async () => {
    const id = await createPack(db, ana, pack(), "tarjeta");
    await deletePack(db, id);
    const a = await patientAccount(db, ana, "2026-10-05");
    expect(a.packs).toEqual([]);
    expect(a.payments[0]).toMatchObject({ packId: null, amountCents: 17500 });
    await deletePatient(db, ana);
    expect(await db.query("select * from payments")).toEqual([]);
  });
});

describe("la clínica", () => {
  it("quién debe y lo cobrado por forma de pago", async () => {
    await setPricing(db, { sessionCents: 4000, since: "2026-10-01" });
    const bea = await createPatient(db, patient("Bea Gil"));
    await createPatient(db, patient("Carla Sanz")); // sin nada
    await createPack(db, ana, pack(), null); // sin cobrar
    await saveSession(db, bea, session("2026-10-02T09:00:00.000Z"));
    await saveSession(db, bea, session("2026-10-03T09:00:00.000Z"));
    await addPayment(db, bea, { amountCents: 4000, method: "bizum", paidOn: "2026-10-03", concept: "" });
    await addPayment(db, ana, { amountCents: 2500, method: "efectivo", paidOn: "2026-11-01", concept: "" });
    const debtors = await pendingAccounts(db, "2026-11-02");
    expect(debtors.map((d) => [d.name, d.balanceCents])).toEqual([
      ["Ana Ruiz", 15000],
      ["Bea Gil", 4000],
    ]);
    expect(await collectedBetween(db, "2026-10-01", "2026-11-01")).toEqual({ totalCents: 4000, count: 1, byMethod: [{ method: "bizum", cents: 4000 }] });
    expect((await collectedBetween(db, "2026-10-01", "2026-12-01")).totalCents).toBe(6500);
  });
});
