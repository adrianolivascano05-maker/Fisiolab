// Tests con vídeo y marcas (saltos; también lo común a todos los tests: leer, guardar el vídeo, borrar, listar).
// Parte de la capa de datos (repo.ts la reúne): una función por operación, las pantallas nunca ven SQL.
import { computeJump, type JumpOutput, type JumpType, type MarkEvent, type MarkInput } from "../calc/results";
import type { RomType } from "../calc/rom";
import { type CodType, isCodType } from "../calc/cod";
import type { ExerciseId } from "../calc/strength";
import type { Db } from "./db";
import { inFocus } from "./episodes";
import type { Statement } from "./protocol";
import { newId, now } from "./ids";
import { saveTimedMarks } from "./timedTests";
import { saveRepMarks } from "./strengthTests";
import { getPatient } from "./patients";

export type VideoMeta = {
  fileName: string;
  /** fps de grabación (los de los cálculos). */
  captureFps: number;
  /** fps del archivo (los del reproductor). */
  containerFps: number;
  frameCount: number | null;
  durationS: number | null;
  fpsSource: "container" | "user";
};

export type Mark = { event: MarkEvent; frameIndex: number; timeS: number; seriesIndex: number };
/** `seriesIndex` 0 es el resultado del test; 1, 2… los de cada salto de una serie. */
export type Result = { metric: string; value: number; unit: string; seriesIndex: number };
export type Side = "left" | "right";
export type TestType = JumpType | RomType | "vbt" | "nordic" | "sprint_linear" | CodType | "running";

export type Test = {
  id: string;
  patientId: string;
  type: TestType;
  side: Side | null;
  performedAt: string;
  extraLoadKg: number;
  dropHeightCm: number | null;
  notes: string;
  /** Parámetros propios del test; en movilidad, `movement` y `method`. */
  details: Record<string, unknown>;
  video: VideoMeta | null;
  marks: Mark[];
  results: Result[];
};

export type NewJumpTest = { patientId: string; type: JumpType; extraLoadKg?: number; dropHeightCm?: number | null; side?: Side | null };

export async function createJumpTest(db: Db, input: NewJumpTest): Promise<string> {
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: `insert into tests (id, patient_id, category, type, side, performed_at, extra_load_kg, drop_height_cm, created_at, updated_at)
            values (?, ?, 'jump', ?, ?, ?, ?, ?, ?, ?)`,
      bind: [id, input.patientId, input.type, input.side ?? null, t, input.extraLoadKg ?? 0, input.dropHeightCm ?? null, t, t],
    },
  ]);
  return id;
}

export async function getTest(db: Db, id: string): Promise<Test | null> {
  const [row] = await db.query<{
    id: string;
    patient_id: string;
    type: TestType;
    side: Side | null;
    performed_at: string;
    extra_load_kg: number;
    drop_height_cm: number | null;
    details: string;
    notes: string;
  }>("select * from tests where id = ?", [id]);
  if (!row) return null;
  const [v] = await db.query<{
    file_name: string;
    fps: number;
    container_fps: number;
    frame_count: number | null;
    duration_s: number | null;
    fps_source: "container" | "user";
  }>("select * from videos where test_id = ?", [id]);
  const marks = await db.query<Mark>(
    "select event, frame_index as frameIndex, time_s as timeS, series_index as seriesIndex from marks where test_id = ? order by time_s",
    [id],
  );
  const results = await db.query<Result>(
    "select metric, value, unit, series_index as seriesIndex from results where test_id = ? order by series_index, rowid",
    [id],
  );
  return {
    id: row.id,
    patientId: row.patient_id,
    type: row.type,
    side: row.side,
    performedAt: row.performed_at,
    extraLoadKg: row.extra_load_kg,
    dropHeightCm: row.drop_height_cm,
    notes: row.notes,
    details: JSON.parse(row.details) as Record<string, unknown>,
    video: v
      ? {
          fileName: v.file_name,
          captureFps: v.fps,
          containerFps: v.container_fps,
          frameCount: v.frame_count,
          durationS: v.duration_s,
          fpsSource: v.fps_source,
        }
      : null,
    marks,
    results,
  };
}

export async function saveVideo(db: Db, testId: string, meta: VideoMeta): Promise<void> {
  await db.transaction([
    {
      sql: `insert into videos (id, test_id, file_name, fps, container_fps, frame_count, duration_s, fps_source, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict (test_id) do update set file_name = excluded.file_name, fps = excluded.fps,
              container_fps = excluded.container_fps, frame_count = excluded.frame_count,
              duration_s = excluded.duration_s, fps_source = excluded.fps_source`,
      bind: [newId(), testId, meta.fileName, meta.captureFps, meta.containerFps, meta.frameCount, meta.durationS, meta.fpsSource, now()],
    },
  ]);
}

/**
 * Guarda las marcas y recalcula los resultados en una sola transacción.
 * Devuelve lo calculado, con avisos y marcas que falten.
 */
export async function saveMarksAndCompute(db: Db, testId: string, marks: MarkInput[]): Promise<JumpOutput> {
  const test = await getTest(db, testId);
  if (!test) throw new Error("El test no existe.");
  if (!test.video) throw new Error("El test no tiene vídeo.");
  if (test.type === "vbt") return saveRepMarks(db, test, marks);
  if (test.type === "sprint_linear" || isCodType(test.type) || test.type === "running") return saveTimedMarks(db, test, marks);
  if (test.type.startsWith("rom_")) throw new Error("Este test no es de salto.");
  const patient = await getPatient(db, test.patientId);
  const out = computeJump({
    type: test.type as JumpType,
    captureFps: test.video.captureFps,
    marks,
    bodyMassKg: patient?.bodyMassKg ?? null,
    extraLoadKg: test.extraLoadKg,
    pushOffDistanceCm: patient?.pushOffDistanceCm ?? null,
    dropHeightCm: test.dropHeightCm,
  });
  const t = now();
  const statements: Statement[] = [
    { sql: "delete from marks where test_id = ?", bind: [testId] },
    { sql: "delete from results where test_id = ?", bind: [testId] },
  ];
  for (const m of marks) {
    statements.push({
      sql: "insert into marks (id, test_id, event, series_index, time_s, frame_index, created_at) values (?, ?, ?, ?, ?, ?, ?)",
      bind: [newId(), testId, m.event, m.seriesIndex, m.frame / test.video.captureFps, m.frame, t],
    });
  }
  for (const r of out.results) {
    statements.push({
      sql: "insert into results (id, test_id, metric, value, unit, series_index, created_at) values (?, ?, ?, ?, ?, ?, ?)",
      bind: [newId(), testId, r.metric, r.value, r.unit, r.seriesIndex ?? 0, t],
    });
  }
  statements.push({ sql: "update tests set updated_at = ? where id = ?", bind: [t, testId] });
  await db.transaction(statements);
  return out;
}

export async function deleteTest(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from tests where id = ?", bind: [id] }]);
}

export type TestSummary = {
  id: string;
  type: TestType;
  side: Side | null;
  performedAt: string;
  extraLoadKg: number;
  heightCm: number | null;
  rsi: number | null;
  distanceCm: number | null;
  /** Movilidad: movimiento del catálogo y ángulo medido. */
  movement: string | null;
  angleDeg: number | null;
  /** Fuerza: ejercicio y velocidad de la repetición más rápida. */
  exercise: ExerciseId | null;
  barVelocity: number | null;
  /** Sprint y cambio de dirección: tiempo total. Carrera: contacto medio. */
  timeS: number | null;
  contactMs: number | null;
};

/** Tests de un paciente, el más reciente primero, con su resultado principal. */
export async function listTests(db: Db, patientId: string): Promise<TestSummary[]> {
  return db.query<TestSummary>(
    `select t.id, t.type, t.side, t.performed_at as performedAt, t.extra_load_kg as extraLoadKg,
            (select value from results r where r.test_id = t.id and r.metric = 'jump_height_cm' and r.series_index = 0) as heightCm,
            (select value from results r where r.test_id = t.id and r.metric = 'rsi' and r.series_index = 0) as rsi,
            (select value from results r where r.test_id = t.id and r.metric = 'jump_distance_cm' and r.series_index = 0) as distanceCm,
            json_extract(t.details, '$.movement') as movement,
            (select value from results r where r.test_id = t.id and r.metric = 'angle_deg' and r.series_index = 0) as angleDeg,
            json_extract(t.details, '$.exercise') as exercise,
            (select value from results r where r.test_id = t.id and r.metric = 'bar_velocity_m_s' and r.series_index = 0) as barVelocity,
            (select value from results r where r.test_id = t.id and r.metric = 'time_s' and r.series_index = 0) as timeS,
            (select value from results r where r.test_id = t.id and r.metric = 'contact_time_ms' and r.series_index = 0) as contactMs
       from tests t
      where t.patient_id = ? and ${inFocus("t")}
      order by t.performed_at desc`,
    [patientId],
  );
}

export type HistoryPoint = { testId: string; performedAt: string; value: number };

/** Serie temporal de una métrica para un tipo de test (S22). */
export async function history(db: Db, patientId: string, type: JumpType, metric: string): Promise<HistoryPoint[]> {
  return db.query<HistoryPoint>(
    `select t.id as testId, t.performed_at as performedAt, r.value
       from tests t join results r on r.test_id = t.id
      where t.patient_id = ? and t.type = ? and r.metric = ? and r.series_index = 0
      order by t.performed_at`,
    [patientId, type, metric],
  );
}

/** Salto horizontal: se mide la distancia con cinta métrica, sin vídeo. */
export async function createHorizontalTest(db: Db, patientId: string, distanceCm: number): Promise<string> {
  if (!(distanceCm > 0 && distanceCm < 500)) throw new RangeError("La distancia debe estar entre 1 y 500 cm.");
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: `insert into tests (id, patient_id, category, type, performed_at, created_at, updated_at)
            values (?, ?, 'jump', 'horizontal', ?, ?, ?)`,
      bind: [id, patientId, t, t, t],
    },
    {
      sql: "insert into results (id, test_id, metric, value, unit, created_at) values (?, ?, 'jump_distance_cm', ?, 'cm', ?)",
      bind: [newId(), id, distanceCm, t],
    },
  ]);
  return id;
}
