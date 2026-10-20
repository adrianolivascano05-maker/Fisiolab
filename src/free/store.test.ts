import { describe, expect, it } from "vitest";
import { createPatient, deletePatient } from "../data/repo";
import { createTestDb } from "../data/testDb";
import { deleteMeasurement, getMeasurement, listMeasurements, reportCsv, saveMeasurement } from "./store";
import type { BiomechanicalMeasurement } from "./types";

describe("guardado de la medición libre", () => {
  it("guarda, lista, borra, se sincroniza y desaparece con el paciente", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, { name: "Libre", birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
    const m: BiomechanicalMeasurement = {
      id: "m1",
      patientId: pid,
      createdAt: "2026-10-17T10:00:00.000Z",
      anatomicalPlane: "frontal",
      referenceType: "axial_body",
      referenceVector: { startJoint: "mid_shoulder", endJoint: "mid_hip" },
      movementVector: { startJoint: "r_shoulder", endJoint: "r_elbow" },
      initialAngleDegrees: 5,
      maxAngleDegrees: 92.5,
      deltaAngleDegrees: 87.5,
      keyframes: [
        { frameNumber: 0, timestampSeconds: 0, angleDegrees: 5 },
        { frameNumber: 30, timestampSeconds: 1, angleDegrees: 92.5 },
      ],
      video: { fileName: "a.mp4", fps: 30 },
    };
    await saveMeasurement(db, m);
    await saveMeasurement(db, { ...m, id: "m2", createdAt: "2026-10-18T10:00:00.000Z" });
    expect((await listMeasurements(db, pid)).map((x) => x.id)).toEqual(["m2", "m1"]);
    expect(await getMeasurement(db, "m1")).toEqual(m);
    await deleteMeasurement(db, "m2");
    expect(await listMeasurements(db, pid)).toHaveLength(1);
    const csv = reportCsv(m, "Libre", (id) => id);
    expect(csv).toContain("plano;frontal\r\n");
    expect(csv).toContain("amplitud_grados;87,5\r\n");
    expect(csv).toContain("30;1,000;92,5\r\n");
    // Cada medición deja su cambio para la copia de la nube.
    expect(await db.query("select op from sync_changes where tbl = 'free_measurements' and pk = 'm1'")).toEqual([{ op: "upsert" }]);
    await deletePatient(db, pid);
    expect(await db.query("select * from free_measurements")).toEqual([]);
  });
});
