import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import { createJumpTest, createPatient, createRomTest, exportCsv, getTest, listTests, romEntries, saveMarksAndCompute, saveVideo } from "./repo";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { dbFromHandler } from "./db";
import { Engine } from "./engine";
import { migrations } from "./migrations";
import { createTestDb } from "./testDb";
import { marksFromFrames } from "../calc/results";

const person = { name: "Rosa Gil", birthDate: null, sex: "female" as const, bodyMassKg: 60, heightCm: 165, legLengthCm: 90, pushOffDistanceCm: 35, notes: "" };

let db: Db;
let pid: string;
beforeEach(async () => {
  db = await createTestDb();
  pid = await createPatient(db, person);
});

describe("movilidad", () => {
  it("guarda la media de las lecturas, cada lectura y la distancia a la pared", async () => {
    const id = await createRomTest(db, { patientId: pid, movement: "ankle_lunge", side: "left", method: "sensor", readings: [40, 42, 44], wallDistanceCm: 11 });
    const t = await getTest(db, id);
    expect(t?.type).toBe("rom_ankle");
    expect(t?.details).toEqual({ movement: "ankle_lunge", method: "sensor" });
    const angle = t!.results.filter((r) => r.metric === "angle_deg");
    expect(angle.map((r) => [r.seriesIndex, r.value])).toEqual([[0, 42], [1, 40], [2, 42], [3, 44]]);
    expect(t!.results.find((r) => r.metric === "wall_distance_cm")?.value).toBe(11);
    const [summary] = await listTests(db, pid);
    expect(summary).toMatchObject({ type: "rom_ankle", movement: "ankle_lunge", angleDeg: 42, side: "left" });
  });

  it("una sola lectura no repite la serie; la distancia solo vale para el lunge", async () => {
    const id = await createRomTest(db, { patientId: pid, movement: "hip_flexion", side: "right", method: "manual", readings: [118], wallDistanceCm: 9 });
    const t = await getTest(db, id);
    expect(t!.results).toEqual([{ metric: "angle_deg", value: 118, unit: "°", seriesIndex: 0 }]);
  });

  it("valida el lado, el movimiento y los rangos", async () => {
    const base = { patientId: pid, method: "manual" as const, readings: [30] };
    await expect(createRomTest(db, { ...base, movement: "ankle_lunge", side: null })).rejects.toThrow(/lado/);
    await expect(createRomTest(db, { ...base, movement: "neck_flexion", side: "left" })).rejects.toThrow(/no tiene lado/);
    await expect(createRomTest(db, { ...base, movement: "knee_magic", side: null })).rejects.toThrow(/desconocido/);
    await expect(createRomTest(db, { ...base, movement: "neck_flexion", side: null, readings: [-3] })).rejects.toThrow(RangeError);
    await expect(createRomTest(db, { ...base, movement: "neck_flexion", side: null, readings: [] })).rejects.toThrow(RangeError);
  });

  it("lista por movimiento, la más reciente primero", async () => {
    const a = await createRomTest(db, { patientId: pid, movement: "neck_rotation", side: "left", method: "sensor", readings: [70] });
    await createRomTest(db, { patientId: pid, movement: "neck_flexion", side: null, method: "sensor", readings: [50] });
    const b = await createRomTest(db, { patientId: pid, movement: "neck_rotation", side: "right", method: "photo", readings: [64] });
    await db.transaction([{ sql: "update tests set performed_at = '2026-01-01T10:00:00.000Z' where id = ?", bind: [a] }]);
    const rot = await romEntries(db, pid, "neck_rotation");
    expect(rot.map((r) => [r.testId, r.side, r.method, r.angleDeg])).toEqual([[b, "right", "photo", 64], [a, "left", "sensor", 70]]);
    expect(await romEntries(db, pid)).toHaveLength(3);
  });

  it("el CSV lleva el movimiento y el método", async () => {
    await createRomTest(db, { patientId: pid, movement: "shoulder_external_rotation", side: "right", method: "manual", readings: [95] });
    const csv = await exportCsv(db);
    expect(csv).toContain("paciente;fecha;test;movimiento;lado;metodo;carga_kg;altura_caida_cm;fps_grabacion;intento;metrica;valor;unidad");
    expect(csv).toMatch(/;rom_shoulder;Hombro · rotación externa;derecha;Goniómetro \(a mano\);0;;;;angle_deg;95;°\r\n/);
  });
});

describe("migración 2", () => {
  it("conserva los resultados de una base de la versión 1", async () => {
    const sqlite3 = await sqlite3InitModule();
    const file = "/migrate-v1.sqlite3";
    const storage = { persistent: false, open: () => new sqlite3.oo1.DB(file, "c") };
    const e1 = new Engine(sqlite3, storage, migrations.slice(0, 1));
    const v1 = dbFromHandler((req) => e1.handle(req));
    // El paciente, a mano: la versión 1 aún no tiene las columnas de contacto (migración 12).
    const id = "p-v1";
    await v1.transaction([{ sql: "insert into patients (id, name, notes, created_at, updated_at) values (?, 'Versión uno', '', ?, ?)", bind: [id, "2026-01-01", "2026-01-01"] }]);
    const tid = await createJumpTest(v1, { patientId: id, type: "cmj" });
    await saveVideo(v1, tid, { fileName: "a.mov", captureFps: 240, containerFps: 240, frameCount: 100, durationS: 1, fpsSource: "container" });
    await saveMarksAndCompute(v1, tid, marksFromFrames({ takeoff: 100, landing: 220 }));
    expect((await v1.info()).schemaVersion).toBe(1);

    const e2 = new Engine(sqlite3, storage, migrations);
    const v2 = dbFromHandler((req) => e2.handle(req));
    expect((await v2.info()).schemaVersion).toBe(migrations.at(-1)!.version);
    const t = await getTest(v2, tid);
    expect(t!.results.find((r) => r.metric === "jump_height_cm")?.value).toBeCloseTo(30.66, 2);
    await createRomTest(v2, { patientId: id, movement: "ankle_lunge", side: "left", method: "manual", readings: [35], wallDistanceCm: 8 });
    // La cascada sigue funcionando sobre la tabla nueva.
    await v2.transaction([{ sql: "delete from patients where id = ?", bind: [id] }]);
    expect(await v2.query("select * from results")).toEqual([]);
  });
});
