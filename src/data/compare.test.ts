import { describe, expect, it } from "vitest";
import { compareMetrics, ranking } from "./compare";
import { loadSeed } from "./seed";
import { createPatient, createTimedTest, saveTimes } from "./repo";
import { createTestDb } from "./testDb";

describe("comparar pacientes", () => {
  it("todas las medidas se pueden consultar con los datos de ejemplo", async () => {
    const db = await createTestDb();
    await loadSeed(db);
    for (const m of compareMetrics) await expect(ranking(db, m.id, "best")).resolves.toBeInstanceOf(Array);
    const cmj = await ranking(db, "cmj", "best");
    expect(cmj.map((r) => r.name)).toEqual(["Ejemplo · Marcos Vidal", "Ejemplo · Lucía Herrero", "Ejemplo · Irene Soto (sin masa)"]);
    expect(cmj[0]!.rank).toBe(1);
    expect(cmj[0]!.count).toBe(4);
    await expect(ranking(db, "nada", "best")).rejects.toThrow(/desconocida/);
  });

  it("mejor marca o última; menos es mejor en tiempos; empates", async () => {
    const db = await createTestDb();
    const person = { birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" };
    const a = await createPatient(db, { ...person, name: "Ana" });
    const b = await createPatient(db, { ...person, name: "Bea" });
    const c = await createPatient(db, { ...person, name: "Carla" });
    const sprint = async (pid: string, t10: number, when: string) => {
      const id = await createTimedTest(db, { patientId: pid, type: "sprint_linear", gates: [10, 20], method: "manual" });
      await saveTimes(db, id, [t10, t10 + 1.2]);
      await db.transaction([{ sql: "update tests set performed_at = ? where id = ?", bind: [when, id] }]);
    };
    await sprint(a, 1.9, "2026-01-01T10:00:00Z");
    await sprint(a, 2.0, "2026-02-01T10:00:00Z");
    await sprint(b, 1.95, "2026-01-15T10:00:00Z");
    await sprint(c, 1.95, "2026-01-20T10:00:00Z");
    const best = await ranking(db, "sprint10", "best");
    expect(best.map((r) => [r.name, r.value, r.rank])).toEqual([["Ana", 1.9, 1], ["Bea", 1.95, 2], ["Carla", 1.95, 2]]);
    const latest = await ranking(db, "sprint10", "latest");
    expect(latest.map((r) => [r.name, r.value])).toEqual([["Bea", 1.95], ["Carla", 1.95], ["Ana", 2.0]]);
    expect((await ranking(db, "sprint20", "best"))[0]!.value).toBeCloseTo(3.1, 10);
  });
});
