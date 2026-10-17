// Datos de ejemplo para probar la app sin pacientes reales. Todos llevan el prefijo «Ejemplo ·»
// y se pueden borrar de una vez desde Ajustes.
import type { Db } from "./db";
import { createJumpTest, createPatient, saveMarksAndCompute, saveVideo } from "./repo";

export const SEED_PREFIX = "Ejemplo · ";

const video = { fileName: "ejemplo.mov", captureFps: 240, containerFps: 240, frameCount: 2400, durationS: 10, fpsSource: "container" as const };

export async function loadSeed(db: Db): Promise<void> {
  const people = [
    { name: "Lucía Herrero", sex: "female" as const, bodyMassKg: 58, heightCm: 165, legLengthCm: 92, pushOffDistanceCm: 36, flights: [112, 114, 117, 119, 121] },
    { name: "Marcos Vidal", sex: "male" as const, bodyMassKg: 81, heightCm: 182, legLengthCm: 104, pushOffDistanceCm: 41, flights: [126, 129, 128, 133] },
    { name: "Irene Soto (sin masa)", sex: "female" as const, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, flights: [101] },
  ];
  const day = 24 * 3600 * 1000;
  for (const p of people) {
    const pid = await createPatient(db, { ...p, name: SEED_PREFIX + p.name, birthDate: null, notes: "Datos de ejemplo" });
    for (const [i, flight] of p.flights.entries()) {
      const tid = await createJumpTest(db, { patientId: pid, type: "cmj" });
      await saveVideo(db, tid, video);
      await saveMarksAndCompute(db, tid, { takeoff: 400, landing: 400 + flight });
      const when = new Date(Date.now() - (p.flights.length - i) * 7 * day).toISOString();
      await db.transaction([{ sql: "update tests set performed_at = ? where id = ?", bind: [when, tid] }]);
    }
    if (p.bodyMassKg) {
      const tid = await createJumpTest(db, { patientId: pid, type: "dj", dropHeightCm: 30 });
      await saveVideo(db, tid, video);
      await saveMarksAndCompute(db, tid, { contact: 352, takeoff: 400, landing: 400 + p.flights.at(-1)! - 6 });
    }
  }
}

export async function removeSeed(db: Db): Promise<number> {
  const [row] = await db.query<{ n: number }>("select count(*) as n from patients where name like ? || '%'", [SEED_PREFIX]);
  await db.transaction([{ sql: "delete from patients where name like ? || '%'", bind: [SEED_PREFIX] }]);
  return row?.n ?? 0;
}

export async function hasSeed(db: Db): Promise<boolean> {
  const [row] = await db.query<{ n: number }>("select count(*) as n from patients where name like ? || '%'", [SEED_PREFIX]);
  return (row?.n ?? 0) > 0;
}
