import { beforeEach, describe, expect, it } from "vitest";
import { heightFromProfile } from "../calc/profile";
import { marksFromFrames, type MarkInput } from "../calc/results";
import type { Db } from "./db";
import {
  createHorizontalTest,
  createJumpTest,
  createPatient,
  deleteFvProfile,
  exportCsv,
  fvCandidates,
  getTest,
  history,
  listFvProfiles,
  listTests,
  saveFvProfile,
  saveMarksAndCompute,
  saveVideo,
  singleLegJumps,
} from "./repo";
import { createTestDb } from "./testDb";

const video = { fileName: "v.mov", captureFps: 240, containerFps: 240, frameCount: 4000, durationS: 16, fpsSource: "container" as const };
const patient = { name: "Marcos", birthDate: null, sex: null, bodyMassKg: 70, heightCm: 180, legLengthCm: 100, pushOffDistanceCm: 40, notes: "" };

let db: Db;
let pid: string;
beforeEach(async () => {
  db = await createTestDb();
  pid = await createPatient(db, patient);
});

async function jump(type: Parameters<typeof createJumpTest>[1]["type"], marks: MarkInput[], extra: Partial<Parameters<typeof createJumpTest>[1]> = {}) {
  const tid = await createJumpTest(db, { patientId: pid, type, ...extra });
  await saveVideo(db, tid, video);
  await saveMarksAndCompute(db, tid, marks);
  return tid;
}

describe("fase 2: datos", () => {
  it("10/5: resultados por salto y resumen; la evolución solo usa el resumen", async () => {
    const marks: MarkInput[] = [];
    let f = 100;
    const contacts = [40, 48, 60, 36, 50, 44];
    for (let i = 0; i < 7; i++) {
      if (i > 0) f += contacts[i - 1]!;
      marks.push({ event: "takeoff", frame: f, seriesIndex: i }, { event: "landing", frame: f + 120, seriesIndex: i });
      f += 120;
    }
    const tid = await jump("rj_10_5", marks);
    const t = (await getTest(db, tid))!;
    expect(t.marks).toHaveLength(14);
    expect(t.results.filter((r) => r.metric === "rsi" && r.seriesIndex > 0)).toHaveLength(6);
    const summary = t.results.find((r) => r.metric === "rsi" && r.seriesIndex === 0)!;
    expect(summary.value).toBeGreaterThan(1.3);
    expect((await listTests(db, pid))[0]!.rsi).toBeCloseTo(summary.value, 9);
    expect(await history(db, pid, "rj_10_5", "rsi")).toHaveLength(1);
    expect(await exportCsv(db)).toMatch(/;rj_10_5;;0;;240;3;rsi;/);
  });

  it("horizontal: sin vídeo, distancia directa", async () => {
    await createHorizontalTest(db, pid, 212);
    const [t] = await listTests(db, pid);
    expect(t).toMatchObject({ type: "horizontal", distanceCm: 212, heightCm: null });
    await expect(createHorizontalTest(db, pid, 0)).rejects.toThrow(/distancia/);
  });

  it("unipodal: lado guardado y listado para la asimetría", async () => {
    await jump("single_leg", marksFromFrames({ takeoff: 100, landing: 196 }), { side: "left" });
    await jump("single_leg", marksFromFrames({ takeoff: 100, landing: 204 }), { side: "right" });
    const legs = await singleLegJumps(db, pid);
    expect(legs.map((l) => l.side).sort()).toEqual(["left", "right"]);
  });

  it("perfil F-V: candidatos con F y v, guardar, listar y borrar", async () => {
    // Saltos SJ generados con un perfil conocido (F0 32 N/kg, V0 3,2 m/s) con 0, 20 y 40 kg.
    for (const load of [0, 20, 40]) {
      const k = 70 / (70 + load);
      const h = heightFromProfile(32 * k, (-32 / 3.2) * k, 0.4);
      const frames = Math.round(Math.sqrt((8 * h) / 9.81) * 240);
      await jump("sj", marksFromFrames({ takeoff: 100, landing: 100 + frames }), { extraLoadKg: load });
    }
    const cands = await fvCandidates(db, pid);
    expect(cands).toHaveLength(3);
    const id = await saveFvProfile(db, pid, "sj", cands);
    const [p] = await listFvProfiles(db, pid);
    expect(p!.id).toBe(id);
    expect(p!.f0).toBeCloseTo(32, 0); // el redondeo a fotogramas enteros mueve algo el resultado
    expect(p!.v0).toBeCloseTo(3.2, 0);
    expect(p!.testIds).toHaveLength(3);
    expect(p!.optimalSlope).toBeLessThan(0);
    await deleteFvProfile(db, id);
    expect(await listFvProfiles(db, pid)).toHaveLength(0);
  });

  it("DJ: rigidez y DRI guardados", async () => {
    const tid = await jump("dj", marksFromFrames({ contact: 52, takeoff: 100, landing: 220 }), { dropHeightCm: 30 });
    const metrics = (await getTest(db, tid))!.results.map((r) => r.metric);
    expect(metrics).toEqual(expect.arrayContaining(["stiffness_kn_m", "dri", "rsi"]));
  });
});
