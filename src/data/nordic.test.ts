import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import { createNordicTest, createPatient, exportCsv, getTest, listTests, nordicEntries, saveNordicAngle, saveVideo, updatePatient } from "./repo";
import { createTestDb } from "./testDb";

const person = { name: "Iker Sanz", birthDate: null, sex: "male" as const, bodyMassKg: 80, heightCm: 180, legLengthCm: null, pushOffDistanceCm: null, notes: "" };

let db: Db;
let pid: string;
beforeEach(async () => {
  db = await createTestDb();
  pid = await createPatient(db, person);
});

describe("nórdico", () => {
  it("por vídeo: guarda el ángulo, el momento por pierna y el fotograma de la rotura", async () => {
    const tid = await createNordicTest(db, pid, "video");
    await saveVideo(db, tid, { fileName: "n.mp4", captureFps: 60, containerFps: 60, frameCount: 600, durationS: 10, fpsSource: "container" });
    await saveNordicAngle(db, tid, 60, 312);
    const t = await getTest(db, tid);
    expect(t!.type).toBe("nordic");
    expect(t!.results.find((r) => r.metric === "angle_deg")?.value).toBe(60);
    expect(t!.results.find((r) => r.metric === "torque_nm")?.value).toBeCloseTo(172.9, 1);
    expect(t!.marks).toEqual([{ event: "break_point", frameIndex: 312, timeS: 5.2, seriesIndex: 0 }]);
    expect((await listTests(db, pid))[0]).toMatchObject({ type: "nordic", angleDeg: 60 });
    const csv = await exportCsv(db);
    expect(csv).toMatch(/;nordic;;;Vídeo;0;;60;;torque_nm;172,93\d*;N·m\r\n/);
  });

  it("a mano y sin estatura: solo el ángulo; valida el rango", async () => {
    await updatePatient(db, pid, { ...person, heightCm: null });
    const tid = await createNordicTest(db, pid, "manual");
    await saveNordicAngle(db, tid, 45);
    expect((await getTest(db, tid))!.results.map((r) => r.metric)).toEqual(["angle_deg"]);
    await expect(saveNordicAngle(db, tid, 120)).rejects.toThrow(RangeError);
    expect((await nordicEntries(db, pid))[0]).toMatchObject({ angleDeg: 45, torqueNm: null });
  });
});
