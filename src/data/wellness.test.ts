import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import { createPatient, deletePatient, deleteWellness, exportCsv, listWellness, saveWellness } from "./repo";
import { createTestDb } from "./testDb";

const person = { name: "Nuria Paz", birthDate: null, sex: "female" as const, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" };
const answers = { fatigue: 4, sleep: 3, soreness: 2, stress: 5, mood: 4, pain: 3, notes: " rodilla " };

let db: Db;
let pid: string;
beforeEach(async () => {
  db = await createTestDb();
  pid = await createPatient(db, person);
});

describe("bienestar", () => {
  it("un registro por día: el segundo del mismo día lo actualiza", async () => {
    const a = await saveWellness(db, pid, answers, new Date("2026-10-15T08:00:00Z"));
    const b = await saveWellness(db, pid, { ...answers, sleep: 5 }, new Date("2026-10-15T19:00:00Z"));
    const c = await saveWellness(db, pid, answers, new Date("2026-10-16T08:00:00Z"));
    expect(b).toBe(a);
    expect(c).not.toBe(a);
    const list = await listWellness(db, pid);
    expect(list.map((e) => [e.id, e.sleep])).toEqual([[c, 3], [a, 5]]);
    expect(list[0]).toMatchObject({ pain: 3, notes: "rodilla", mood: 4 });
    await deleteWellness(db, c);
    expect(await listWellness(db, pid)).toHaveLength(1);
  });

  it("valida las respuestas", async () => {
    await expect(saveWellness(db, pid, { ...answers, mood: 0 })).rejects.toThrow(/Ánimo/);
    await expect(saveWellness(db, pid, { ...answers, sleep: 2.5 })).rejects.toThrow(/sueño/);
    await expect(saveWellness(db, pid, { ...answers, pain: 11 })).rejects.toThrow(/0 a 10/);
    await saveWellness(db, pid, { ...answers, pain: null });
    expect((await listWellness(db, pid))[0]!.pain).toBeNull();
  });

  it("CSV y borrado en cascada", async () => {
    await saveWellness(db, pid, answers, new Date("2026-10-15T08:00:00Z"));
    const csv = await exportCsv(db);
    expect(csv).toContain("Nuria Paz;2026-10-15T08:00:00.000Z;bienestar;;;;;;;;fatiga;4;1-5\r\n");
    expect(csv).toContain(";bienestar;;;;;;;;dolor_eva;3;0-10\r\n");
    await deletePatient(db, pid);
    expect(await db.query("select * from wellness")).toEqual([]);
  });
});
