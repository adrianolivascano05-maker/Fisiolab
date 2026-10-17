import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import { bestSprintSplit, createPatient, createRunningTest, createTimedTest, exportCsv, getTest, listTests, saveMarksAndCompute, saveTimes, saveVideo, timedEntries } from "./repo";
import { createTestDb } from "./testDb";

const person = { name: "Saúl Rey", birthDate: null, sex: "male" as const, bodyMassKg: 75, heightCm: 178, legLengthCm: null, pushOffDistanceCm: null, notes: "" };
const video = { fileName: "v.mp4", captureFps: 120, containerFps: 120, frameCount: 2000, durationS: 16.7, fpsSource: "container" as const };

let db: Db;
let pid: string;
beforeEach(async () => {
  db = await createTestDb();
  pid = await createPatient(db, person);
});

const value = (t: Awaited<ReturnType<typeof getTest>>, metric: string, i = 0) => t!.results.find((r) => r.metric === metric && r.seriesIndex === i)?.value;

describe("sprint", () => {
  it("por vídeo: salida y pasos → tiempos, velocidad máxima y perfil", async () => {
    const tid = await createTimedTest(db, { patientId: pid, type: "sprint_linear", gates: [5, 10, 20, 30], method: "video" });
    await saveVideo(db, tid, video);
    // A 120 fps: 1,20 s, 1,90 s, 3,10 s y 4,24 s desde la salida (fotograma 60).
    await saveMarksAndCompute(db, tid, [
      { event: "start", frame: 60, seriesIndex: 0 },
      { event: "split", frame: 60 + 144, seriesIndex: 0 },
      { event: "split", frame: 60 + 228, seriesIndex: 1 },
      { event: "split", frame: 60 + 372, seriesIndex: 2 },
      { event: "split", frame: 60 + 509, seriesIndex: 3 },
    ]);
    const t = await getTest(db, tid);
    expect(value(t, "split_time_s", 2)).toBeCloseTo(1.9, 10);
    expect(value(t, "time_s")).toBeCloseTo(509 / 120, 10);
    expect(value(t, "max_velocity_m_s")).toBeCloseTo(10 / (137 / 120), 6);
    expect(value(t, "f0_n_kg")).toBeGreaterThan(4);
    expect(value(t, "v0_m_s")).toBeGreaterThan(8);
    expect(t!.marks).toHaveLength(5);
    expect(await bestSprintSplit(db, pid, 10)).toMatchObject({ timeS: 1.9 });
    expect(await bestSprintSplit(db, pid, 15)).toBeNull();
    expect((await listTests(db, pid))[0]).toMatchObject({ type: "sprint_linear", timeS: 509 / 120 });
  });

  it("con fotocélulas; tiempos que no crecen se rechazan", async () => {
    const tid = await createTimedTest(db, { patientId: pid, type: "sprint_linear", gates: [10, 20], method: "manual" });
    await expect(saveTimes(db, tid, [2, 1.5])).rejects.toThrow(/después/);
    await expect(saveTimes(db, tid, [2])).rejects.toThrow(/Falta/);
    await saveTimes(db, tid, [1.9, 3.1]);
    const t = await getTest(db, tid);
    expect(value(t, "f0_n_kg")).toBeUndefined(); // 2 pasos: sin perfil
    expect(value(t, "time_s")).toBe(3.1);
    await expect(createTimedTest(db, { patientId: pid, type: "sprint_linear", method: "manual" })).rejects.toThrow(/distancias/);
  });
});

describe("cambio de dirección", () => {
  it("por vídeo y a mano, con el lado del giro y el CSV", async () => {
    const tid = await createTimedTest(db, { patientId: pid, type: "cod_505", side: "left", method: "video" });
    await saveVideo(db, tid, video);
    await saveMarksAndCompute(db, tid, [
      { event: "start", frame: 30, seriesIndex: 0 },
      { event: "finish", frame: 330, seriesIndex: 0 },
    ]);
    expect(value(await getTest(db, tid), "time_s")).toBeCloseTo(2.5, 10);
    const m = await createTimedTest(db, { patientId: pid, type: "cod_505", side: "right", method: "manual" });
    await saveTimes(db, m, [2.41]);
    expect((await timedEntries(db, pid, "cod_505")).map((e) => e.side).sort()).toEqual(["left", "right"]);
    const csv = await exportCsv(db);
    expect(csv).toMatch(/;cod_505;;derecha;Fotocélulas o cronómetro;0;;;;time_s;2,41;s\r\n/);
    expect(csv).toMatch(/;cod_505;;izquierda;Vídeo;0;;120;;time_s;2,5;s\r\n/);
  });
});

describe("carrera", () => {
  it("contactos y despegues → medias por paso, frecuencia y asimetría", async () => {
    const tid = await createRunningTest(db, pid, "right", 10.8);
    await saveVideo(db, tid, video);
    // A 120 fps: pasos de 42 fotogramas (0,35 s); contacto 24 (derecho) y 26 (izquierdo).
    const marks = [];
    for (let i = 0; i < 6; i++) {
      const c = 10 + i * 42;
      marks.push({ event: "contact" as const, frame: c, seriesIndex: i }, { event: "takeoff" as const, frame: c + (i % 2 === 0 ? 24 : 26), seriesIndex: i });
    }
    await saveMarksAndCompute(db, tid, marks);
    const t = await getTest(db, tid);
    expect(value(t, "contact_time_ms")).toBeCloseTo(((24 + 26) / 2 / 120) * 1000, 6);
    expect(value(t, "step_frequency_spm")).toBeCloseTo(60 / 0.35, 6);
    expect(value(t, "step_length_m")).toBeCloseTo(3 * 0.35, 6);
    expect(value(t, "asymmetry_pct")).toBeCloseTo((2 / 26) * 100, 6);
    expect(value(t, "contact_time_ms", 2)).toBeCloseTo((26 / 120) * 1000, 6);
    await expect(createRunningTest(db, pid, "left", 50)).rejects.toThrow(RangeError);
  });
});

describe("CSV del sprint", () => {
  it("lleva las distancias de los pasos", async () => {
    const db2 = await createTestDb();
    const p = await createPatient(db2, person);
    const tid = await createTimedTest(db2, { patientId: p, type: "sprint_linear", gates: [10, 20], method: "manual" });
    await saveTimes(db2, tid, [1.9, 3.1]);
    expect(await exportCsv(db2)).toMatch(/;sprint_linear;pasos 10-20 m;;Fotocélulas o cronómetro;0;;;2;split_time_s;3,1;s\r\n/);
  });
});
