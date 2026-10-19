import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import {
  createJumpTest,
  createPatient,
  deletePatient,
  exportCsv,
  getTest,
  history,
  listPatients,
  listTests,
  saveMarksAndCompute,
  saveVideo,
  type PatientInput,
} from "./repo";
import { createTestDb } from "./testDb";
import { marksFromFrames } from "../calc/results";

const ana: PatientInput = {
  name: "Ana Martín",
  birthDate: "1995-04-02",
  sex: "female",
  bodyMassKg: 62,
  heightCm: 168,
  legLengthCm: 95,
  pushOffDistanceCm: 38,
  notes: "",
};
const video = { fileName: "cmj.mov", captureFps: 240, containerFps: 240, frameCount: 2400, durationS: 10, fpsSource: "container" as const };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("base de datos", () => {
  it("migra a la última versión", async () => {
    expect((await db.info()).schemaVersion).toBe(6);
  });

  it("flujo completo: paciente → CMJ → vídeo → marcas → resultados", async () => {
    const pid = await createPatient(db, ana);
    const tid = await createJumpTest(db, { patientId: pid, type: "cmj" });
    await saveVideo(db, tid, video);
    const out = await saveMarksAndCompute(db, tid, marksFromFrames({ takeoff: 100, landing: 220 }));
    expect(out.warnings).toEqual([]);

    const test = await getTest(db, tid);
    expect(test!.marks.map((m) => m.event).sort()).toEqual(["landing", "takeoff"]);
    const h = test!.results.find((r) => r.metric === "jump_height_cm")!;
    expect(h.value).toBeCloseTo(30.66, 2);
    expect(test!.results.some((r) => r.metric === "power_w")).toBe(true);

    const [summary] = await listPatients(db);
    expect(summary).toMatchObject({ name: "Ana Martín", testCount: 1, lastTestType: "cmj" });
    expect((await listTests(db, pid))[0]!.heightCm).toBeCloseTo(30.66, 2);
  });

  it("volver a marcar reemplaza marcas y resultados", async () => {
    const pid = await createPatient(db, ana);
    const tid = await createJumpTest(db, { patientId: pid, type: "cmj" });
    await saveVideo(db, tid, video);
    await saveMarksAndCompute(db, tid, marksFromFrames({ takeoff: 100, landing: 220 }));
    await saveMarksAndCompute(db, tid, marksFromFrames({ takeoff: 100, landing: 232 }));
    const test = await getTest(db, tid);
    expect(test!.marks).toHaveLength(2);
    expect(test!.results.filter((r) => r.metric === "jump_height_cm")).toHaveLength(1);
  });

  it("un DJ sin altura de caída se rechaza", async () => {
    const pid = await createPatient(db, ana);
    await expect(createJumpTest(db, { patientId: pid, type: "dj" })).rejects.toThrow(/CHECK/);
  });

  it("busca por nombre sin distinguir mayúsculas", async () => {
    await createPatient(db, ana);
    await createPatient(db, { ...ana, name: "Jorge Ruiz" });
    expect((await listPatients(db, "jor")).map((p) => p.name)).toEqual(["Jorge Ruiz"]);
  });

  it("borrar un paciente borra todo lo suyo", async () => {
    const pid = await createPatient(db, ana);
    const tid = await createJumpTest(db, { patientId: pid, type: "cmj" });
    await saveVideo(db, tid, video);
    await saveMarksAndCompute(db, tid, marksFromFrames({ takeoff: 100, landing: 220 }));
    await deletePatient(db, pid);
    for (const table of ["tests", "videos", "marks", "results"]) {
      const [row] = await db.query<{ n: number }>(`select count(*) as n from ${table}`);
      expect(row!.n, table).toBe(0);
    }
  });

  it("historia ordenada por fecha", async () => {
    const pid = await createPatient(db, ana);
    for (const landing of [220, 226]) {
      const tid = await createJumpTest(db, { patientId: pid, type: "cmj" });
      await saveVideo(db, tid, video);
      await saveMarksAndCompute(db, tid, marksFromFrames({ takeoff: 100, landing }));
    }
    const pts = await history(db, pid, "cmj", "jump_height_cm");
    expect(pts).toHaveLength(2);
    expect(pts[1]!.value).toBeGreaterThan(pts[0]!.value);
  });

  it("CSV para Excel en español", async () => {
    const pid = await createPatient(db, { ...ana, name: 'Ana "la rápida"; M.' });
    const tid = await createJumpTest(db, { patientId: pid, type: "cmj" });
    await saveVideo(db, tid, video);
    await saveMarksAndCompute(db, tid, marksFromFrames({ takeoff: 100, landing: 220 }));
    const csv = await exportCsv(db);
    expect(csv.startsWith("﻿paciente;fecha;test;")).toBe(true);
    expect(csv).toContain('"Ana ""la rápida""; M."');
    expect(csv).toContain(";;jump_height_cm;30,6563;cm");
  });

  it("copia de seguridad: exporta, importa y rechaza archivos que no son copias", async () => {
    await createPatient(db, ana);
    const backup = await db.exportBytes();
    await createPatient(db, { ...ana, name: "Jorge Ruiz" });
    await expect(db.importBytes(new TextEncoder().encode("no soy una base"))).rejects.toThrow(/no es una copia/);
    expect(await listPatients(db)).toHaveLength(2);
    await db.importBytes(backup);
    expect((await listPatients(db)).map((p) => p.name)).toEqual(["Ana Martín"]);
  });
});
