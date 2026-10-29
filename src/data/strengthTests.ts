// Fuerza: velocidad de barra (S13) y perfil carga-velocidad (S14).
// Parte de la capa de datos (repo.ts la reúne): una función por operación, las pantallas nunca ven SQL.
import type { JumpOutput, MarkInput } from "../calc/results";
import { type ExerciseId, getExercise, type LoadVelocityProfile, loadVelocityProfile, plausibleVbt, type RepMark, vbtResults, velocitiesFromMarks } from "../calc/strength";
import type { Db } from "./db";
import type { Statement } from "./protocol";
import { newId, now } from "./ids";
import { getSetting, setSetting } from "./settings";
import type { Test } from "./tests";

export type VbtMethod = "video" | "manual";
export type NewVbtTest = { patientId: string; exercise: ExerciseId; loadKg: number; romCm: number | null; method: VbtMethod };

export async function createVbtTest(db: Db, input: NewVbtTest): Promise<string> {
  if (!getExercise(input.exercise)) throw new Error("Ejercicio desconocido.");
  if (!(input.loadKg >= plausibleVbt.loadKg.min && input.loadKg <= plausibleVbt.loadKg.max)) throw new RangeError("La carga debe estar entre 0 y 500 kg.");
  if (input.method === "video" && !(input.romCm !== null && input.romCm >= plausibleVbt.romCm.min && input.romCm <= plausibleVbt.romCm.max)) {
    throw new RangeError("El recorrido de la barra debe estar entre 5 y 150 cm.");
  }
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: `insert into tests (id, patient_id, category, type, performed_at, extra_load_kg, details, created_at, updated_at)
            values (?, ?, 'strength', 'vbt', ?, ?, ?, ?, ?)`,
      bind: [id, input.patientId, t, input.loadKg, JSON.stringify({ exercise: input.exercise, romCm: input.romCm, method: input.method }), t, t],
    },
  ]);
  return id;
}

export function resultStatements(testId: string, rows: { metric: string; value: number; unit: string; seriesIndex: number }[]): Statement[] {
  const t = now();
  return [
    { sql: "delete from results where test_id = ?", bind: [testId] },
    ...rows.map((r) => ({
      sql: "insert into results (id, test_id, metric, value, unit, series_index, created_at) values (?, ?, ?, ?, ?, ?, ?)",
      bind: [newId(), testId, r.metric, r.value, r.unit, r.seriesIndex, t],
    })),
    { sql: "update tests set updated_at = ? where id = ?", bind: [t, testId] },
  ];
}

/** Repeticiones marcadas en el vídeo: inicio y fin de cada subida. */
export async function saveRepMarks(db: Db, test: Test, marks: MarkInput[]): Promise<JumpOutput> {
  const romCm = Number(test.details.romCm);
  if (!(romCm > 0)) throw new Error("Falta el recorrido de la barra.");
  const reps = velocitiesFromMarks(marks as RepMark[], romCm / 100, test.video!.captureFps);
  if (reps.length === 0) return { results: [], warnings: [], missing: ["bar_start", "bar_end"] };
  const rows = vbtResults(reps);
  const t = now();
  await db.transaction([
    { sql: "delete from marks where test_id = ?", bind: [test.id] },
    ...marks.map((m) => ({
      sql: "insert into marks (id, test_id, event, series_index, time_s, frame_index, created_at) values (?, ?, ?, ?, ?, ?, ?)",
      bind: [newId(), test.id, m.event, m.seriesIndex, m.frame / test.video!.captureFps, m.frame, t],
    })),
    ...resultStatements(test.id, rows),
  ]);
  const warnings = reps.some((v) => v < plausibleVbt.velocityMS.min || v > plausibleVbt.velocityMS.max)
    ? ["Velocidad poco habitual: revisa el recorrido, las marcas y los fps de grabación."]
    : [];
  return { results: [], warnings, missing: [] };
}

/** Sin vídeo: velocidades de cada repetición leídas de un encoder u otra app. */
export async function saveVbtVelocities(db: Db, testId: string, reps: number[]): Promise<void> {
  if (reps.length === 0) throw new RangeError("Escribe al menos una repetición.");
  if (reps.some((v) => !(v > 0 && v <= 3))) throw new RangeError("Cada velocidad debe estar entre 0,01 y 3 m/s.");
  await db.transaction(resultStatements(testId, vbtResults(reps)));
}

/** Último recorrido usado por el paciente en ese ejercicio, para no volver a medirlo. */
export async function lastRomCm(db: Db, patientId: string, exercise: ExerciseId): Promise<number | null> {
  const [row] = await db.query<{ rom: number | null }>(
    `select json_extract(details, '$.romCm') as rom from tests
      where patient_id = ? and type = 'vbt' and json_extract(details, '$.exercise') = ? and json_extract(details, '$.romCm') is not null
      order by performed_at desc limit 1`,
    [patientId, exercise],
  );
  return row?.rom ?? null;
}

export type VbtSet = { testId: string; exercise: ExerciseId; performedAt: string; loadKg: number; best: number };

/** Series con velocidad calculada, la más reciente primero. */
export async function vbtSets(db: Db, patientId: string, exercise?: ExerciseId): Promise<VbtSet[]> {
  return db.query<VbtSet>(
    `select t.id as testId, json_extract(t.details, '$.exercise') as exercise, t.performed_at as performedAt,
            t.extra_load_kg as loadKg, r.value as best
       from tests t join results r on r.test_id = t.id and r.metric = 'bar_velocity_m_s' and r.series_index = 0
      where t.patient_id = ? and t.type = 'vbt' and (? is null or json_extract(t.details, '$.exercise') = ?)
      order by substr(t.performed_at, 1, 10) desc, t.extra_load_kg, t.performed_at desc`,
    [patientId, exercise ?? null, exercise ?? null],
  );
}

/** Umbral de velocidad del 1RM: el ajustado por el usuario o el de referencia del ejercicio. */
export async function getMvt(db: Db, exercise: ExerciseId): Promise<number> {
  return (await getSetting<number>(db, `mvt.${exercise}`)) ?? getExercise(exercise)!.mvt;
}

export async function setMvt(db: Db, exercise: ExerciseId, mvt: number): Promise<void> {
  if (!(mvt >= 0.05 && mvt <= 1)) throw new RangeError("El umbral debe estar entre 0,05 y 1 m/s.");
  await setSetting(db, `mvt.${exercise}`, mvt);
}

export type SavedLoadVelocity = LoadVelocityProfile & { id: string; exercise: ExerciseId; performedAt: string; testIds: string[] };

export async function saveLoadVelocityProfile(db: Db, patientId: string, exercise: ExerciseId, sets: VbtSet[], mvt: number): Promise<string> {
  const p = loadVelocityProfile(sets.map((s) => ({ loadKg: s.loadKg, velocity: s.best })), mvt);
  const id = newId();
  const t = now();
  const performedAt = sets.map((s) => s.performedAt).sort().at(-1)!;
  await db.transaction([
    {
      sql: `insert into profiles (id, patient_id, kind, performed_at, exercise, v0_m_s, slope, min_velocity_threshold_m_s, one_rm_kg,
                                  r_squared, created_at, updated_at)
            values (?, ?, 'load_velocity', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [id, patientId, performedAt, exercise, p.intercept, p.slope, mvt, p.oneRmKg, Math.min(1, Math.max(0, p.r2)), t, t],
    },
    ...sets.map((s) => ({ sql: "insert into profile_tests (profile_id, test_id) values (?, ?)", bind: [id, s.testId] })),
  ]);
  return id;
}

export async function listLoadVelocityProfiles(db: Db, patientId: string, exercise?: ExerciseId): Promise<SavedLoadVelocity[]> {
  const rows = await db.query<{
    id: string;
    exercise: ExerciseId;
    performed_at: string;
    v0_m_s: number;
    slope: number;
    min_velocity_threshold_m_s: number;
    one_rm_kg: number;
    r_squared: number;
    test_ids: string | null;
  }>(
    `select p.*, (select group_concat(test_id) from profile_tests pt where pt.profile_id = p.id) as test_ids
       from profiles p where p.patient_id = ? and p.kind = 'load_velocity' and (? is null or p.exercise = ?)
      order by p.performed_at desc, p.created_at desc`,
    [patientId, exercise ?? null, exercise ?? null],
  );
  return rows.map((r) => ({
    id: r.id,
    exercise: r.exercise,
    performedAt: r.performed_at,
    testIds: (r.test_ids ?? "").split(",").filter(Boolean),
    intercept: r.v0_m_s,
    slope: r.slope,
    r2: r.r_squared,
    mvt: r.min_velocity_threshold_m_s,
    oneRmKg: r.one_rm_kg,
    l0Kg: -r.v0_m_s / r.slope,
  }));
}
