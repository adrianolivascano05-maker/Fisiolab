import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import {
  createJumpTest,
  createPatient,
  deletePatient,
  exportCsv,
  getPatient,
  getTest,
  history,
  listPatients,
  listTests,
  saveMarksAndCompute,
  saveVideo,
  type PatientInput,
} from "./repo";
import { saveAnamnesis } from "./clinical";
import { createTestDb } from "./testDb";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { dbFromHandler } from "./db";
import { Engine } from "./engine";
import { migrations } from "./migrations";
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
    expect((await db.info()).schemaVersion).toBe(24);
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

  it("busca sin tildes y también por teléfono, motivo y diagnóstico", async () => {
    const lucia = await createPatient(db, { ...ana, name: "Lucía Pérez", phone: "612 34 56 78" });
    await createPatient(db, { ...ana, name: "Jorge Ruiz" });
    await saveAnamnesis(db, lucia, { motivo: "Dolor de hombro al nadar", diagnostico_funcional: "Tendinopatía del supraespinoso" });
    const names = async (q: string) => (await listPatients(db, q)).map((p) => p.name);
    expect(await names("lucia perez")).toEqual(["Lucía Pérez"]);
    expect(await names("612345")).toEqual(["Lucía Pérez"]);
    expect(await names("hombro")).toEqual(["Lucía Pérez"]);
    expect(await names("tendinopatia")).toEqual(["Lucía Pérez"]);
    expect(await names("rodilla")).toEqual([]);
    expect(await names("")).toHaveLength(2);
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

describe("migración 012: el contacto pasa de la anamnesis a la ficha", () => {
  it("copia teléfono, email y dirección al paciente y los quita de las anamnesis", async () => {
    const sqlite3 = await sqlite3InitModule();
    const storage = { persistent: false, open: () => new sqlite3.oo1.DB("/migrate-v11.sqlite3", "c") };
    const before = dbFromHandler((req) => new Engine(sqlite3, storage, migrations.filter((m) => m.version < 12)).handle(req));
    await before.transaction([
      { sql: "insert into patients (id, name, notes, created_at, updated_at) values ('p1', 'Ana', '', '2026-01-01', '2026-01-01'), ('p2', 'Luis', '', '2026-01-01', '2026-01-01')" },
      { sql: `insert into anamnesis (patient_id, answers, created_at, updated_at) values ('p1', '{"telefono":" 600 11 22 33 ","email":"ana@x.es","motivo":"Hombro"}', '2026-01-01', '2026-01-01')` },
      { sql: `insert into episodes (id, patient_id, title, started_at, answers, created_at, updated_at) values ('e1', 'p2', 'Rodilla', '2026-02-01', '{"direccion":"Calle Mayor 1"}', '2026-02-01', '2026-02-01')` },
    ]);
    const after = dbFromHandler((req) => new Engine(sqlite3, storage, migrations).handle(req));
    const p1 = (await getPatient(after, "p1"))!;
    expect([p1.phone, p1.email, p1.address]).toEqual(["600 11 22 33", "ana@x.es", ""]);
    expect((await getPatient(after, "p2"))!.address).toBe("Calle Mayor 1");
    const [a] = await after.query<{ answers: string }>("select answers from anamnesis where patient_id = 'p1'");
    expect(JSON.parse(a!.answers)).toEqual({ motivo: "Hombro" });
    const [e] = await after.query<{ answers: string }>("select answers from episodes where id = 'e1'");
    expect(JSON.parse(e!.answers)).toEqual({});
  });
});
