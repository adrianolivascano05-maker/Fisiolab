// Datos de ejemplo para probar la app sin pacientes reales. Todos llevan el prefijo «Ejemplo ·»
// y se pueden borrar de una vez desde Ajustes.
import type { Db } from "./db";
import { heightFromProfile } from "../calc/profile";
import { marksFromFrames, type MarkInput } from "../calc/results";
import {
  createHorizontalTest,
  createJumpTest,
  createPatient,
  createRomTest,
  createVbtTest,
  saveMarksAndCompute,
  saveVbtVelocities,
  saveVideo,
  type NewRomTest,
} from "./repo";

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
      await saveMarksAndCompute(db, tid, marksFromFrames({ takeoff: 400, landing: 400 + flight }));
      const when = new Date(Date.now() - (p.flights.length - i) * 7 * day).toISOString();
      await db.transaction([{ sql: "update tests set performed_at = ? where id = ?", bind: [when, tid] }]);
    }
    if (p.bodyMassKg) {
      const tid = await createJumpTest(db, { patientId: pid, type: "dj", dropHeightCm: 30 });
      await saveVideo(db, tid, video);
      await saveMarksAndCompute(db, tid, marksFromFrames({ contact: 352, takeoff: 400, landing: 400 + p.flights.at(-1)! - 6 }));
    }
    if (p.name.startsWith("Marcos")) {
      await loadPhase2(db, pid, p.bodyMassKg!, p.pushOffDistanceCm! / 100);
      await loadRom(db, pid);
      await loadStrength(db, pid);
    }
  }
}

/** Fase 2: SJ con cargas (perfil F-V), unipodales (asimetría), un 10/5 y un salto horizontal. */
async function loadPhase2(db: Db, pid: string, bodyKg: number, hpo: number) {
  const jump = async (type: Parameters<typeof createJumpTest>[1]["type"], marks: MarkInput[], extra: Partial<Parameters<typeof createJumpTest>[1]> = {}) => {
    const tid = await createJumpTest(db, { patientId: pid, type, ...extra });
    await saveVideo(db, tid, video);
    await saveMarksAndCompute(db, tid, marks);
  };
  const framesFor = (heightM: number) => Math.round(Math.sqrt((8 * heightM) / 9.81) * 240);
  // Perfil «real» F0 30 N/kg, V0 3,4 m/s: algo orientado a la velocidad (déficit de fuerza).
  for (const load of [0, 20, 40, 60]) {
    const k = bodyKg / (bodyKg + load);
    const h = heightFromProfile(30 * k, (-30 / 3.4) * k, hpo);
    await jump("sj", marksFromFrames({ takeoff: 400, landing: 400 + framesFor(h) }), { extraLoadKg: load });
  }
  await jump("single_leg", marksFromFrames({ takeoff: 400, landing: 400 + framesFor(0.162) }), { side: "left" });
  await jump("single_leg", marksFromFrames({ takeoff: 400, landing: 400 + framesFor(0.181) }), { side: "right" });
  const rj: MarkInput[] = [];
  let f = 300;
  const flights = [118, 112, 110, 114, 108, 111, 106, 109, 104, 102];
  const contacts = [0, 46, 44, 50, 42, 45, 52, 47, 49, 55];
  flights.forEach((fl, i) => {
    f += contacts[i]!;
    rj.push({ event: "takeoff", frame: f, seriesIndex: i }, { event: "landing", frame: f + fl, seriesIndex: i });
    f += fl;
  });
  await jump("rj_10_5", rj);
  await createHorizontalTest(db, pid, 238);
}

/** Movilidad: un lunge con el tobillo derecho más limitado que mejora en un mes, cadera y hombro. */
async function loadRom(db: Db, pid: string) {
  const day = 24 * 3600 * 1000;
  const rom = async (input: Omit<NewRomTest, "patientId">, daysAgo: number) => {
    const tid = await createRomTest(db, { patientId: pid, ...input });
    const when = new Date(Date.now() - daysAgo * day).toISOString();
    await db.transaction([{ sql: "update tests set performed_at = ? where id = ?", bind: [when, tid] }]);
  };
  await rom({ movement: "ankle_lunge", side: "left", method: "sensor", readings: [39, 40, 38], wallDistanceCm: 11 }, 35);
  await rom({ movement: "ankle_lunge", side: "right", method: "sensor", readings: [29, 31, 30], wallDistanceCm: 7 }, 35);
  await rom({ movement: "ankle_lunge", side: "left", method: "sensor", readings: [40, 41, 40], wallDistanceCm: 11.5 }, 3);
  await rom({ movement: "ankle_lunge", side: "right", method: "sensor", readings: [35, 36, 34], wallDistanceCm: 9.5 }, 3);
  await rom({ movement: "hip_internal_rotation", side: "left", method: "manual", readings: [34] }, 3);
  await rom({ movement: "hip_internal_rotation", side: "right", method: "manual", readings: [27] }, 3);
  await rom({ movement: "shoulder_flexion", side: "right", method: "photo", readings: [168] }, 3);
}

/** Fuerza: sentadilla con 4 cargas en la recta v = 1,45 − 0,011 · carga (1RM ≈ 104,5 kg a 0,30 m/s). */
async function loadStrength(db: Db, pid: string) {
  for (const [loadKg, reps] of [
    [40, [0.99, 1.01, 0.98, 0.95, 0.92]],
    [80, [0.57, 0.56, 0.52]],
    [100, [0.35, 0.33]],
  ] as const) {
    const tid = await createVbtTest(db, { patientId: pid, exercise: "squat", loadKg, romCm: null, method: "manual" });
    await saveVbtVelocities(db, tid, [...reps]);
  }
  // 60 kg marcada en vídeo: recorrido 55 cm a 240 fps; subidas de 167, 171, 178 y 189 fotogramas.
  const tid = await createVbtTest(db, { patientId: pid, exercise: "squat", loadKg: 60, romCm: 55, method: "video" });
  await saveVideo(db, tid, { fileName: "sentadilla-60.mp4", captureFps: 240, containerFps: 240, frameCount: 4000, durationS: 16.7, fpsSource: "container" });
  const marks: MarkInput[] = [];
  let f = 200;
  [167, 171, 178, 189].forEach((up, i) => {
    marks.push({ event: "bar_start", frame: f, seriesIndex: i }, { event: "bar_end", frame: f + up, seriesIndex: i });
    f += up + 500;
  });
  await saveMarksAndCompute(db, tid, marks);
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
