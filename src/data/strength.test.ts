import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import {
  createPatient,
  createVbtTest,
  exportCsv,
  getMvt,
  getTest,
  lastRomCm,
  listLoadVelocityProfiles,
  listTests,
  saveLoadVelocityProfile,
  saveMarksAndCompute,
  saveVbtVelocities,
  saveVideo,
  setMvt,
  vbtSets,
} from "./repo";
import { loadSeed } from "./seed";
import { createTestDb } from "./testDb";

const person = { name: "Pablo Ruiz", birthDate: null, sex: "male" as const, bodyMassKg: 80, heightCm: 180, legLengthCm: 100, pushOffDistanceCm: 40, notes: "" };
const video = { fileName: "s.mp4", captureFps: 240, containerFps: 240, frameCount: 3000, durationS: 12.5, fpsSource: "container" as const };

let db: Db;
let pid: string;
beforeEach(async () => {
  db = await createTestDb();
  pid = await createPatient(db, person);
});

describe("velocidad de barra", () => {
  it("por vídeo: recorrido / tiempo de cada subida, la más rápida y la pérdida de velocidad", async () => {
    const tid = await createVbtTest(db, { patientId: pid, exercise: "squat", loadKg: 60, romCm: 50, method: "video" });
    await saveVideo(db, tid, video);
    // 50 cm en 120, 150 y 200 fotogramas a 240 fps → 1,00, 0,80 y 0,60 m/s
    await saveMarksAndCompute(db, tid, [
      { event: "bar_start", frame: 100, seriesIndex: 0 },
      { event: "bar_end", frame: 220, seriesIndex: 0 },
      { event: "bar_start", frame: 600, seriesIndex: 1 },
      { event: "bar_end", frame: 750, seriesIndex: 1 },
      { event: "bar_start", frame: 1100, seriesIndex: 2 },
      { event: "bar_end", frame: 1300, seriesIndex: 2 },
    ]);
    const t = await getTest(db, tid);
    const v = (i: number) => t!.results.find((r) => r.metric === "bar_velocity_m_s" && r.seriesIndex === i)!.value;
    expect([v(1), v(2), v(3)].map((x) => Number(x.toFixed(6)))).toEqual([1, 0.8, 0.6]);
    expect(v(0)).toBeCloseTo(1, 10);
    expect(t!.results.find((r) => r.metric === "velocity_loss_pct")?.value).toBeCloseTo(40, 10);
    expect(t!.marks).toHaveLength(6);
    expect((await listTests(db, pid))[0]).toMatchObject({ type: "vbt", exercise: "squat", extraLoadKg: 60, barVelocity: 1 });
    expect(await lastRomCm(db, pid, "squat")).toBe(50);
    expect(await lastRomCm(db, pid, "bench_press")).toBeNull();
  });

  it("con encoder: velocidades escritas, sin vídeo", async () => {
    const tid = await createVbtTest(db, { patientId: pid, exercise: "bench_press", loadKg: 40, romCm: null, method: "manual" });
    await saveVbtVelocities(db, tid, [0.9]);
    const t = await getTest(db, tid);
    expect(t!.results).toEqual([
      { metric: "bar_velocity_m_s", value: 0.9, unit: "m/s", seriesIndex: 0 },
      { metric: "bar_velocity_m_s", value: 0.9, unit: "m/s", seriesIndex: 1 },
    ]);
    await expect(saveVbtVelocities(db, tid, [0])).rejects.toThrow(RangeError);
    await expect(saveVbtVelocities(db, tid, [])).rejects.toThrow(RangeError);
  });

  it("valida carga y recorrido", async () => {
    await expect(createVbtTest(db, { patientId: pid, exercise: "squat", loadKg: -1, romCm: 50, method: "video" })).rejects.toThrow(/carga/);
    await expect(createVbtTest(db, { patientId: pid, exercise: "squat", loadKg: 60, romCm: null, method: "video" })).rejects.toThrow(/recorrido/);
  });

  it("perfil carga-velocidad con los datos de ejemplo: 1RM ≈ 104,5 kg", async () => {
    await loadSeed(db);
    const [marcos] = await db.query<{ id: string }>("select id from patients where name like '%Marcos%'");
    const sets = await vbtSets(db, marcos!.id, "squat");
    expect(sets.map((s) => s.loadKg).sort((a, b) => a - b)).toEqual([40, 60, 80, 100]);
    expect(await getMvt(db, "squat")).toBe(0.3);
    const id = await saveLoadVelocityProfile(db, marcos!.id, "squat", sets, 0.3);
    const [p] = await listLoadVelocityProfiles(db, marcos!.id, "squat");
    expect(p!.id).toBe(id);
    expect(p!.oneRmKg).toBeCloseTo(104.5, 0);
    expect(p!.testIds).toHaveLength(4);
    await setMvt(db, "squat", 0.32);
    expect(await getMvt(db, "squat")).toBe(0.32);
    await expect(setMvt(db, "squat", 2)).rejects.toThrow(RangeError);
  });

  it("CSV: ejercicio en «movimiento» y el método", async () => {
    const tid = await createVbtTest(db, { patientId: pid, exercise: "deadlift", loadKg: 100, romCm: null, method: "manual" });
    await saveVbtVelocities(db, tid, [0.5, 0.45]);
    const csv = await exportCsv(db);
    expect(csv).toMatch(/;vbt;Peso muerto;;Encoder \(a mano\);100;;;2;bar_velocity_m_s;0,45;m\/s\r\n/);
    expect(csv).toMatch(/;vbt;Peso muerto;;Encoder \(a mano\);100;;;;velocity_loss_pct;10;%\r\n/);
  });
});
