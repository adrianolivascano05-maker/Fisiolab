import { describe, expect, it } from "vitest";
import { marksFromFrames } from "../calc/results";
import { createJumpTest, createPatient, deletePatient, saveMarksAndCompute, saveVideo } from "./repo";
import { createTestDb } from "./testDb";
import { addPair, candidates, countPairs, deletePair, getDelta, listPairs, pairsCsv, primaryValue, replaceAiPair, setDelta } from "./validation";

const video = { fileName: "cmj.mov", captureFps: 240, containerFps: 240, frameCount: 2400, durationS: 10, fpsSource: "container" as const };
const patient = { name: "Val", birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" };

describe("validación", () => {
  it("guarda pares, propone resultados de Impulso y sobrevive al borrado del paciente", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient);
    const tid = await createJumpTest(db, { patientId: pid, type: "cmj" });
    await saveVideo(db, tid, video);
    await saveMarksAndCompute(db, tid, marksFromFrames({ takeoff: 100, landing: 220 }));

    const [c] = await candidates(db, "jump_height");
    expect(c).toMatchObject({ testId: tid, patientName: "Val", type: "cmj" });
    expect(c!.value).toBeCloseTo(30.66, 2);

    await addPair(db, { kind: "jump_height", comparison: "reference", referenceLabel: "Plataforma de fuerza", impulsoValue: c!.value, referenceValue: 29.8, patientId: pid, testId: tid, notes: "" });
    await replaceAiPair(db, { kind: "jump_height", comparison: "ai", referenceLabel: "Marcas finales", impulsoValue: 30, referenceValue: 30.66, patientId: pid, testId: tid, notes: "" });
    await replaceAiPair(db, { kind: "jump_height", comparison: "ai", referenceLabel: "Marcas finales", impulsoValue: 30.2, referenceValue: 30.66, patientId: pid, testId: tid, notes: "" });
    expect(await countPairs(db)).toEqual({ "jump_height:reference": 1, "jump_height:ai": 1 });
    expect((await listPairs(db, "jump_height", "ai"))[0]!.impulsoValue).toBe(30.2);

    const csv = pairsCsv(await listPairs(db, "jump_height", "reference"), "cm");
    expect(csv).toContain("impulso_cm;referencia_cm;diferencia_cm");
    expect(csv).toContain(";Plataforma de fuerza;Val;30,6563;29,8;0,8562;");

    // Borrar al paciente no borra la validación (es de la app, no del paciente), solo quita el enlace.
    await deletePatient(db, pid);
    const [kept] = await listPairs(db, "jump_height", "reference");
    expect(kept).toMatchObject({ patientId: null, testId: null, patientName: null });
    await deletePair(db, kept!.id);
    expect(await listPairs(db, "jump_height", "reference")).toEqual([]);
  });

  it("diferencia clínica editable", async () => {
    const db = await createTestDb();
    expect(await getDelta(db, "jump_height")).toBe(2);
    await setDelta(db, "jump_height", 1.5);
    expect(await getDelta(db, "jump_height")).toBe(1.5);
    await expect(setDelta(db, "jump_height", 0)).rejects.toThrow();
  });

  it("valor principal con otras marcas, sin guardar", () => {
    expect(primaryValue("cmj", marksFromFrames({ takeoff: 100, landing: 220 }), 240, {}, null)!.value).toBeCloseTo(30.66, 2);
    const reps = [
      { event: "bar_start" as const, frame: 0, seriesIndex: 0 },
      { event: "bar_end" as const, frame: 60, seriesIndex: 0 },
      { event: "bar_start" as const, frame: 100, seriesIndex: 1 },
      { event: "bar_end" as const, frame: 130, seriesIndex: 1 },
    ];
    expect(primaryValue("vbt", reps, 60, { romCm: 50 }, null)).toEqual({ kind: "bar_velocity", value: 1 });
    expect(primaryValue("vbt", reps, 60, {}, null)).toBeNull();
    expect(primaryValue("rj_10_5", [], 240, {}, null)).toBeNull();
  });
});
