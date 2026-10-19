// Capa de datos: una función por operación (ver replica/architecture.md, sección API).
// Las pantallas solo hablan con estas funciones, nunca con SQL.
import { computeJump, type JumpOutput, type JumpType, type MarkEvent, type MarkInput } from "../calc/results";
import { fvProfile, type FvProfile, type Point } from "../calc/profile";
import { getMovement, methodLabels, movementLabel, romTypeFor, summarize, type RomMethod, type RomType } from "../calc/rom";
import { wellnessItems, type WellnessScores } from "../calc/wellness";
import { nordicTorque } from "../calc/nordic";
import { segments, sprintProfile, validSplits } from "../calc/sprint";
import { isCodType, type CodType } from "../calc/cod";
import { summarizeRunning } from "../calc/running";
import { getExercise, loadVelocityProfile, plausibleVbt, vbtResults, velocitiesFromMarks, type ExerciseId, type LoadVelocityProfile, type RepMark } from "../calc/strength";
import type { Db } from "./db";
import { parsePrivacy, type PatientPrivacy } from "./privacy";
import type { Statement } from "./protocol";

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ---------- Pacientes ----------

export type Sex = "female" | "male" | "other";

export type PatientInput = {
  name: string;
  birthDate: string | null;
  sex: Sex | null;
  bodyMassKg: number | null;
  heightCm: number | null;
  legLengthCm: number | null;
  pushOffDistanceCm: number | null;
  notes: string;
};

export type Patient = PatientInput & { id: string; createdAt: string; updatedAt: string; privacy: PatientPrivacy };

export type PatientSummary = {
  id: string;
  name: string;
  testCount: number;
  lastTestAt: string | null;
  lastTestType: string | null;
};

type PatientRow = {
  id: string;
  name: string;
  birth_date: string | null;
  sex: Sex | null;
  body_mass_kg: number | null;
  height_cm: number | null;
  leg_length_cm: number | null;
  pushoff_distance_cm: number | null;
  notes: string;
  privacy: string;
  created_at: string;
  updated_at: string;
};

function toPatient(r: PatientRow): Patient {
  return {
    id: r.id,
    name: r.name,
    birthDate: r.birth_date,
    sex: r.sex,
    bodyMassKg: r.body_mass_kg,
    heightCm: r.height_cm,
    legLengthCm: r.leg_length_cm,
    pushOffDistanceCm: r.pushoff_distance_cm,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    privacy: parsePrivacy(r.privacy),
  };
}

export async function listPatients(db: Db, search = ""): Promise<PatientSummary[]> {
  return db.query<PatientSummary>(
    `select p.id, p.name,
            (select count(*) from tests t where t.patient_id = p.id) as testCount,
            (select max(t.performed_at) from tests t where t.patient_id = p.id) as lastTestAt,
            (select t.type from tests t where t.patient_id = p.id order by t.performed_at desc limit 1) as lastTestType
       from patients p
      where ? = '' or p.name like '%' || ? || '%'
      order by p.name collate nocase`,
    [search.trim(), search.trim()],
  );
}

export async function getPatient(db: Db, id: string): Promise<Patient | null> {
  const rows = await db.query<PatientRow>("select * from patients where id = ?", [id]);
  return rows[0] ? toPatient(rows[0]) : null;
}

function patientBind(p: PatientInput) {
  return [p.name.trim(), p.birthDate, p.sex, p.bodyMassKg, p.heightCm, p.legLengthCm, p.pushOffDistanceCm, p.notes];
}

export async function createPatient(db: Db, input: PatientInput): Promise<string> {
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: `insert into patients (name, birth_date, sex, body_mass_kg, height_cm, leg_length_cm, pushoff_distance_cm, notes, id, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [...patientBind(input), id, t, t],
    },
  ]);
  return id;
}

export async function updatePatient(db: Db, id: string, input: PatientInput): Promise<void> {
  await db.transaction([
    {
      sql: `update patients set name = ?, birth_date = ?, sex = ?, body_mass_kg = ?, height_cm = ?, leg_length_cm = ?,
                   pushoff_distance_cm = ?, notes = ?, updated_at = ?
             where id = ?`,
      bind: [...patientBind(input), now(), id],
    },
  ]);
}

/** Borra el paciente y, en cascada, todos sus tests, marcas y resultados. */
export async function deletePatient(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from patients where id = ?", bind: [id] }]);
}

// ---------- Tests ----------

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
      where t.patient_id = ?
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

// ---------- Perfil fuerza-velocidad (S09) ----------

export type FvCandidate = {
  testId: string;
  type: "cmj" | "sj";
  performedAt: string;
  extraLoadKg: number;
  heightCm: number;
  /** Fuerza media por kg de masa corporal (N/kg) y velocidad media (m/s) del empuje. */
  force: number;
  velocity: number;
};

/** Saltos con fuerza y velocidad calculadas (hace falta masa y distancia de empuje). */
export async function fvCandidates(db: Db, patientId: string): Promise<FvCandidate[]> {
  const patient = await getPatient(db, patientId);
  if (!patient?.bodyMassKg) return [];
  const rows = await db.query<{ testId: string; type: "cmj" | "sj"; performedAt: string; extraLoadKg: number; heightCm: number; forceN: number; velocity: number }>(
    `select t.id as testId, t.type, t.performed_at as performedAt, t.extra_load_kg as extraLoadKg,
            h.value as heightCm, f.value as forceN, v.value as velocity
       from tests t
       join results h on h.test_id = t.id and h.metric = 'jump_height_cm' and h.series_index = 0
       join results f on f.test_id = t.id and f.metric = 'force_n' and f.series_index = 0
       join results v on v.test_id = t.id and v.metric = 'velocity_m_s' and v.series_index = 0
      where t.patient_id = ? and t.type in ('cmj', 'sj')
      order by t.performed_at desc`,
    [patientId],
  );
  return rows.map((r) => ({ ...r, force: r.forceN / patient.bodyMassKg! }));
}

export type SavedProfile = FvProfile & { id: string; type: "cmj" | "sj"; performedAt: string; testIds: string[] };

export async function saveFvProfile(db: Db, patientId: string, type: "cmj" | "sj", tests: FvCandidate[]): Promise<string> {
  const patient = await getPatient(db, patientId);
  const points: Point[] = tests.map((c) => ({ velocity: c.velocity, force: c.force }));
  const p = fvProfile(points, patient?.pushOffDistanceCm ? patient.pushOffDistanceCm / 100 : null);
  const id = newId();
  const t = now();
  const performedAt = tests.map((c) => c.performedAt).sort().at(-1)!;
  await db.transaction([
    {
      sql: `insert into profiles (id, patient_id, kind, performed_at, exercise, f0_n_kg, v0_m_s, pmax_w_kg, slope, optimal_slope,
                                  imbalance_pct, r_squared, created_at, updated_at)
            values (?, ?, 'force_velocity', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [id, patientId, performedAt, type, p.f0, p.v0, p.pmax, p.slope, p.optimalSlope, p.imbalancePct, Math.min(1, Math.max(0, p.r2)), t, t],
    },
    ...tests.map((c) => ({ sql: "insert into profile_tests (profile_id, test_id) values (?, ?)", bind: [id, c.testId] })),
  ]);
  return id;
}

export async function listFvProfiles(db: Db, patientId: string): Promise<SavedProfile[]> {
  const rows = await db.query<{
    id: string;
    exercise: "cmj" | "sj";
    performed_at: string;
    f0_n_kg: number;
    v0_m_s: number;
    pmax_w_kg: number;
    slope: number;
    optimal_slope: number | null;
    imbalance_pct: number | null;
    r_squared: number;
    test_ids: string;
  }>(
    `select p.*, (select group_concat(test_id) from profile_tests pt where pt.profile_id = p.id) as test_ids
       from profiles p where p.patient_id = ? and p.kind = 'force_velocity' order by p.performed_at desc, p.created_at desc`,
    [patientId],
  );
  return rows.map((r) => {
    const ratio = r.optimal_slope ? r.slope / r.optimal_slope : null;
    return {
      id: r.id,
      type: r.exercise,
      performedAt: r.performed_at,
      testIds: (r.test_ids ?? "").split(",").filter(Boolean),
      f0: r.f0_n_kg,
      v0: r.v0_m_s,
      pmax: r.pmax_w_kg,
      slope: r.slope,
      r2: r.r_squared,
      optimalSlope: r.optimal_slope,
      ratioPct: ratio === null ? null : ratio * 100,
      imbalancePct: r.imbalance_pct,
      orientation: r.imbalance_pct === null ? null : r.imbalance_pct < 10 ? "balanced" : ratio! < 1 ? "force_deficit" : "velocity_deficit",
    };
  });
}

export async function deleteFvProfile(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from profiles where id = ?", bind: [id] }]);
}

// ---------- Asimetría (S10) ----------

export type SideJump = { testId: string; side: Side; performedAt: string; heightCm: number };

/** Saltos unipodales con altura, del más reciente al más antiguo. */
export async function singleLegJumps(db: Db, patientId: string): Promise<SideJump[]> {
  return db.query<SideJump>(
    `select t.id as testId, t.side, t.performed_at as performedAt, r.value as heightCm
       from tests t join results r on r.test_id = t.id and r.metric = 'jump_height_cm' and r.series_index = 0
      where t.patient_id = ? and t.type = 'single_leg' and t.side is not null
      order by t.performed_at desc`,
    [patientId],
  );
}

// ---------- Movilidad (S19) ----------

export type NewRomTest = {
  patientId: string;
  movement: string;
  side: Side | null;
  method: RomMethod;
  /** Una o varias lecturas en grados; el resultado es su media. */
  readings: number[];
  /** Solo lunge: distancia del dedo gordo a la pared, en cm. */
  wallDistanceCm?: number | null;
};

export async function createRomTest(db: Db, input: NewRomTest): Promise<string> {
  const m = getMovement(input.movement);
  if (!m) throw new Error("Movimiento desconocido.");
  if (m.sided !== (input.side !== null)) throw new Error(m.sided ? "Indica el lado." : "Este movimiento no tiene lado.");
  if (input.readings.some((r) => !(r >= 0 && r <= 200))) throw new RangeError("Cada lectura debe estar entre 0 y 200°.");
  const wall = input.wallDistanceCm ?? null;
  if (wall !== null && !(wall >= 0 && wall <= 40)) throw new RangeError("La distancia a la pared debe estar entre 0 y 40 cm.");
  const { mean } = summarize(input.readings);
  const id = newId();
  const t = now();
  const result = (metric: string, value: number, unit: string, series: number): Statement => ({
    sql: "insert into results (id, test_id, metric, value, unit, series_index, created_at) values (?, ?, ?, ?, ?, ?, ?)",
    bind: [newId(), id, metric, value, unit, series, t],
  });
  await db.transaction([
    {
      sql: `insert into tests (id, patient_id, category, type, side, performed_at, details, created_at, updated_at)
            values (?, ?, 'rom', ?, ?, ?, ?, ?, ?)`,
      bind: [id, input.patientId, romTypeFor(m.joint), input.side, t, JSON.stringify({ movement: m.id, method: input.method }), t, t],
    },
    result("angle_deg", mean, "°", 0),
    ...(input.readings.length > 1 ? input.readings.map((r, i) => result("angle_deg", r, "°", i + 1)) : []),
    ...(wall !== null && m.id === "ankle_lunge" ? [result("wall_distance_cm", wall, "cm", 0)] : []),
  ]);
  return id;
}

export type RomEntry = {
  testId: string;
  movement: string;
  side: Side | null;
  method: RomMethod;
  performedAt: string;
  angleDeg: number;
  wallDistanceCm: number | null;
};

/** Mediciones de movilidad de un paciente (de un movimiento o de todos), la más reciente primero. */
export async function romEntries(db: Db, patientId: string, movement?: string): Promise<RomEntry[]> {
  return db.query<RomEntry>(
    `select t.id as testId, json_extract(t.details, '$.movement') as movement, t.side,
            json_extract(t.details, '$.method') as method, t.performed_at as performedAt, a.value as angleDeg,
            (select value from results w where w.test_id = t.id and w.metric = 'wall_distance_cm' and w.series_index = 0) as wallDistanceCm
       from tests t join results a on a.test_id = t.id and a.metric = 'angle_deg' and a.series_index = 0
      where t.patient_id = ? and t.category = 'rom' and (? is null or json_extract(t.details, '$.movement') = ?)
      order by t.performed_at desc`,
    [patientId, movement ?? null, movement ?? null],
  );
}

// ---------- Fuerza: velocidad de barra (S13) y perfil carga-velocidad (S14) ----------

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

function resultStatements(testId: string, rows: { metric: string; value: number; unit: string; seriesIndex: number }[]): Statement[] {
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
async function saveRepMarks(db: Db, test: Test, marks: MarkInput[]): Promise<JumpOutput> {
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

// ---------- Bienestar (S21) ----------

export type WellnessInput = WellnessScores & { pain: number | null; notes: string };
export type WellnessEntry = WellnessInput & { id: string; performedAt: string };

const madridDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

/** Un registro por día: si ya hay uno hoy, se actualiza. Devuelve su id. */
export async function saveWellness(db: Db, patientId: string, input: WellnessInput, at = new Date()): Promise<string> {
  for (const i of wellnessItems) {
    const v = input[i.id];
    if (!(Number.isInteger(v) && v >= 1 && v <= 5)) throw new RangeError(`Responde «${i.label}» (1-5).`);
  }
  if (input.pain !== null && !(Number.isInteger(input.pain) && input.pain >= 0 && input.pain <= 10)) throw new RangeError("El dolor va de 0 a 10.");
  const iso = at.toISOString();
  const today = (await listWellness(db, patientId)).find((e) => madridDay(e.performedAt) === madridDay(iso));
  const values = [input.sleep, input.fatigue, input.stress, input.soreness, input.mood, input.pain, input.notes.trim()];
  if (today) {
    await db.transaction([
      {
        sql: "update wellness set sleep = ?, fatigue = ?, stress = ?, soreness = ?, mood = ?, pain = ?, notes = ?, performed_at = ? where id = ?",
        bind: [...values, iso, today.id],
      },
    ]);
    return today.id;
  }
  const id = newId();
  await db.transaction([
    {
      sql: `insert into wellness (sleep, fatigue, stress, soreness, mood, pain, notes, id, patient_id, performed_at, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [...values, id, patientId, iso, now()],
    },
  ]);
  return id;
}

/** Registros de bienestar completos (con ánimo), el más reciente primero. */
export async function listWellness(db: Db, patientId: string): Promise<WellnessEntry[]> {
  return db.query<WellnessEntry>(
    `select id, performed_at as performedAt, sleep, fatigue, stress, soreness, mood, pain, notes
       from wellness where patient_id = ? and mood is not null order by performed_at desc`,
    [patientId],
  );
}

export async function deleteWellness(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from wellness where id = ?", bind: [id] }]);
}

// ---------- Nórdico de isquios (S20) ----------

export type NordicMethod = "video" | "manual";

export async function createNordicTest(db: Db, patientId: string, method: NordicMethod): Promise<string> {
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: `insert into tests (id, patient_id, category, type, performed_at, details, created_at, updated_at)
            values (?, ?, 'nordic', 'nordic', ?, ?, ?, ?)`,
      bind: [id, patientId, t, JSON.stringify({ method }), t, t],
    },
  ]);
  return id;
}

/**
 * Guarda el ángulo de rotura (respecto a la vertical) y, si el paciente tiene masa y estatura,
 * el momento estimado por pierna. Con vídeo, también el fotograma de la rotura.
 */
export async function saveNordicAngle(db: Db, testId: string, angleDeg: number, breakFrame: number | null = null): Promise<void> {
  if (!(angleDeg >= 0 && angleDeg <= 90)) throw new RangeError("El ángulo debe estar entre 0 y 90°.");
  const test = await getTest(db, testId);
  if (!test) throw new Error("El test no existe.");
  const patient = await getPatient(db, test.patientId);
  const rows = [{ metric: "angle_deg", value: angleDeg, unit: "°", seriesIndex: 0 }];
  if (patient?.bodyMassKg && patient.heightCm) {
    rows.push({ metric: "torque_nm", value: nordicTorque(patient.bodyMassKg, patient.heightCm, angleDeg).perLegNm, unit: "N·m", seriesIndex: 0 });
  }
  const t = now();
  const marks: Statement[] =
    breakFrame !== null && test.video
      ? [
          { sql: "delete from marks where test_id = ?", bind: [testId] },
          {
            sql: "insert into marks (id, test_id, event, series_index, time_s, frame_index, created_at) values (?, ?, 'break_point', 0, ?, ?, ?)",
            bind: [newId(), testId, breakFrame / test.video.captureFps, breakFrame, t],
          },
        ]
      : [];
  await db.transaction([...marks, ...resultStatements(testId, rows)]);
}

export type NordicEntry = { testId: string; performedAt: string; angleDeg: number; torqueNm: number | null };

export async function nordicEntries(db: Db, patientId: string): Promise<NordicEntry[]> {
  return db.query<NordicEntry>(
    `select t.id as testId, t.performed_at as performedAt, a.value as angleDeg,
            (select value from results r where r.test_id = t.id and r.metric = 'torque_nm' and r.series_index = 0) as torqueNm
       from tests t join results a on a.test_id = t.id and a.metric = 'angle_deg' and a.series_index = 0
      where t.patient_id = ? and t.type = 'nordic'
      order by t.performed_at desc`,
    [patientId],
  );
}

// ---------- Sprint, cambio de dirección (S15-S16) y carrera (S18) ----------

export type TimedMethod = "video" | "manual";
export type NewTimedTest = { patientId: string; type: "sprint_linear" | CodType; side?: Side | null; gates?: number[]; method: TimedMethod };

export async function createTimedTest(db: Db, input: NewTimedTest): Promise<string> {
  if (input.type === "sprint_linear" && !input.gates?.length) throw new Error("Indica las distancias de los pasos.");
  const id = newId();
  const t = now();
  const details = input.type === "sprint_linear" ? { gates: input.gates, method: input.method } : { method: input.method };
  await db.transaction([
    {
      sql: `insert into tests (id, patient_id, category, type, side, performed_at, details, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [id, input.patientId, input.type === "sprint_linear" ? "sprint" : "cod", input.type, input.side ?? null, t, JSON.stringify(details), t, t],
    },
  ]);
  return id;
}

export async function createRunningTest(db: Db, patientId: string, firstSide: Side, speedKmh: number | null): Promise<string> {
  if (speedKmh !== null && !(speedKmh > 0 && speedKmh <= 40)) throw new RangeError("La velocidad debe estar entre 1 y 40 km/h.");
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: `insert into tests (id, patient_id, category, type, performed_at, details, created_at, updated_at)
            values (?, ?, 'running', 'running', ?, ?, ?, ?)`,
      bind: [id, patientId, t, JSON.stringify({ firstSide, speedKmh, method: "video" }), t, t],
    },
  ]);
  return id;
}

type Row = { metric: string; value: number; unit: string; seriesIndex: number };

function sprintRows(gates: number[], times: number[]): Row[] {
  const splits = gates.map((d, i) => ({ distanceM: d, timeS: times[i]! }));
  if (!validSplits(splits)) throw new RangeError("Cada paso debe llegar después del anterior.");
  const rows: Row[] = times.map((t, i) => ({ metric: "split_time_s", value: t, unit: "s", seriesIndex: i + 1 }));
  rows.push({ metric: "time_s", value: times.at(-1)!, unit: "s", seriesIndex: 0 });
  rows.push({ metric: "max_velocity_m_s", value: Math.max(...segments(splits).map((s) => s.velocity)), unit: "m/s", seriesIndex: 0 });
  if (splits.length >= 3) {
    try {
      const p = sprintProfile(splits);
      rows.push(
        { metric: "f0_n_kg", value: p.f0, unit: "N/kg", seriesIndex: 0 },
        { metric: "v0_m_s", value: p.v0, unit: "m/s", seriesIndex: 0 },
        { metric: "pmax_w_kg", value: p.pmax, unit: "W/kg", seriesIndex: 0 },
        { metric: "tau_s", value: p.tau, unit: "s", seriesIndex: 0 },
      );
    } catch {
      // Tiempos que no encajan con el modelo: se guardan los pasos sin perfil.
    }
  }
  return rows;
}

function runningRows(contacts: number[], takeoffs: number[], details: Record<string, unknown>): Row[] {
  const speed = typeof details.speedKmh === "number" ? details.speedKmh : null;
  const r = summarizeRunning(contacts, takeoffs, details.firstSide === "right" ? "right" : "left", speed);
  const rows: Row[] = [];
  r.steps.forEach((s, i) => {
    rows.push({ metric: "contact_time_ms", value: s.contactS * 1000, unit: "ms", seriesIndex: i + 1 });
    if (s.flightS !== null) rows.push({ metric: "flight_time_ms", value: s.flightS * 1000, unit: "ms", seriesIndex: i + 1 });
  });
  rows.push({ metric: "contact_time_ms", value: r.contactS * 1000, unit: "ms", seriesIndex: 0 });
  if (r.flightS !== null) rows.push({ metric: "flight_time_ms", value: r.flightS * 1000, unit: "ms", seriesIndex: 0 });
  if (r.frequencySpm !== null) rows.push({ metric: "step_frequency_spm", value: r.frequencySpm, unit: "pasos/min", seriesIndex: 0 });
  if (r.dutyFactor !== null) rows.push({ metric: "duty_factor", value: r.dutyFactor, unit: "", seriesIndex: 0 });
  if (r.stepLengthM !== null) rows.push({ metric: "step_length_m", value: r.stepLengthM, unit: "m", seriesIndex: 0 });
  if (r.asymmetryPct !== null) rows.push({ metric: "asymmetry_pct", value: r.asymmetryPct, unit: "%", seriesIndex: 0 });
  return rows;
}

/** Marcas de sprint (salida y pasos), cambio de dirección (salida y llegada) o carrera (contactos y despegues). */
async function saveTimedMarks(db: Db, test: Test, marks: MarkInput[]): Promise<JumpOutput> {
  const fps = test.video!.captureFps;
  const sec = (f: number) => f / fps;
  const frames = (e: MarkEvent) => marks.filter((m) => m.event === e).sort((a, b) => a.seriesIndex - b.seriesIndex).map((m) => m.frame);
  let rows: Row[];
  if (test.type === "running") {
    rows = runningRows(frames("contact").map(sec), frames("takeoff").map(sec), test.details);
  } else {
    const start = frames("start")[0];
    if (start === undefined) return { results: [], warnings: [], missing: ["start"] };
    if (test.type === "sprint_linear") {
      const gates = (test.details.gates as number[]) ?? [];
      const splits = frames("split");
      if (splits.length < gates.length) return { results: [], warnings: [], missing: ["split"] };
      rows = sprintRows(gates, splits.map((f) => sec(f - start)));
    } else {
      const finish = frames("finish")[0];
      if (finish === undefined || finish <= start) return { results: [], warnings: [], missing: ["finish"] };
      rows = [{ metric: "time_s", value: sec(finish - start), unit: "s", seriesIndex: 0 }];
    }
  }
  const t = now();
  await db.transaction([
    { sql: "delete from marks where test_id = ?", bind: [test.id] },
    ...marks.map((m) => ({
      sql: "insert into marks (id, test_id, event, series_index, time_s, frame_index, created_at) values (?, ?, ?, ?, ?, ?, ?)",
      bind: [newId(), test.id, m.event, m.seriesIndex, sec(m.frame), m.frame, t],
    })),
    ...resultStatements(test.id, rows),
  ]);
  return { results: [], warnings: [], missing: [] };
}

/** Sin vídeo: tiempos de fotocélulas o cronómetro. Sprint: uno por paso, acumulados desde la salida. */
export async function saveTimes(db: Db, testId: string, times: number[]): Promise<void> {
  const test = await getTest(db, testId);
  if (!test) throw new Error("El test no existe.");
  if (times.some((t) => !(t > 0 && t < 120))) throw new RangeError("Cada tiempo debe estar entre 0 y 120 s.");
  let rows: Row[];
  if (test.type === "sprint_linear") {
    const gates = (test.details.gates as number[]) ?? [];
    if (times.length !== gates.length) throw new RangeError("Falta algún tiempo de paso.");
    rows = sprintRows(gates, times);
  } else if (isCodType(test.type)) {
    if (times.length !== 1) throw new RangeError("Escribe un tiempo.");
    rows = [{ metric: "time_s", value: times[0]!, unit: "s", seriesIndex: 0 }];
  } else throw new Error("Este test no se mide con tiempos.");
  await db.transaction(resultStatements(testId, rows));
}

export type TimedEntry = { testId: string; type: string; side: Side | null; performedAt: string; timeS: number };

/** Tiempos totales de un tipo de test (sprint o cambio de dirección), el más reciente primero. */
export async function timedEntries(db: Db, patientId: string, type: string): Promise<TimedEntry[]> {
  return db.query<TimedEntry>(
    `select t.id as testId, t.type, t.side, t.performed_at as performedAt, r.value as timeS
       from tests t join results r on r.test_id = t.id and r.metric = 'time_s' and r.series_index = 0
      where t.patient_id = ? and t.type = ?
      order by t.performed_at desc`,
    [patientId, type],
  );
}

/** Mejor tiempo en un paso de una distancia (p. ej. 10 m) en los sprints del paciente, con su fecha. */
export async function bestSprintSplit(db: Db, patientId: string, distanceM: number): Promise<{ timeS: number; performedAt: string } | null> {
  const [row] = await db.query<{ timeS: number; performedAt: string }>(
    `select r.value as timeS, t.performed_at as performedAt
       from tests t join results r on r.test_id = t.id and r.metric = 'split_time_s' and r.series_index > 0
      where t.patient_id = ? and t.type = 'sprint_linear'
        and json_extract(t.details, '$.gates[' || (r.series_index - 1) || ']') = ?
      order by r.value limit 1`,
    [patientId, distanceM],
  );
  return row ?? null;
}

// ---------- Ajustes ----------

export async function getSetting<T>(db: Db, key: string): Promise<T | null> {
  const [row] = await db.query<{ value: string }>("select value from settings where key = ?", [key]);
  return row ? (JSON.parse(row.value) as T) : null;
}

export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
  await db.transaction([
    {
      sql: "insert into settings (key, value) values (?, ?) on conflict (key) do update set value = excluded.value",
      bind: [key, JSON.stringify(value)],
    },
  ]);
}

// ---------- Exportación ----------

/**
 * Todos los resultados en CSV "largo" (una fila por métrica), pensado para Excel en español:
 * separador punto y coma, coma decimal y BOM para que respete las tildes.
 */
export async function exportCsv(db: Db): Promise<string> {
  const rows = await db.query<{
    patient: string;
    performed_at: string;
    type: string;
    extra_load_kg: number;
    drop_height_cm: number | null;
    capture_fps: number | null;
    metric: string;
    value: number;
    unit: string;
    side: string | null;
    series_index: number;
    movement: string | null;
    method: string | null;
    exercise: string | null;
    gates: string | null;
  }>(
    `select p.name as patient, t.performed_at, t.type, t.side, t.extra_load_kg, t.drop_height_cm, v.fps as capture_fps,
            json_extract(t.details, '$.movement') as movement, json_extract(t.details, '$.method') as method,
            json_extract(t.details, '$.exercise') as exercise, json_extract(t.details, '$.gates') as gates,
            r.metric, r.value, r.unit, r.series_index
       from results r
       join tests t on t.id = r.test_id
       join patients p on p.id = t.patient_id
       left join videos v on v.test_id = t.id
      order by p.name collate nocase, t.performed_at, r.series_index, r.rowid`,
  );
  const num = (n: number | null, digits = 4) =>
    n === null ? "" : String(Number(n.toFixed(digits))).replace(".", ",");
  const cell = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = ["paciente", "fecha", "test", "movimiento", "lado", "metodo", "carga_kg", "altura_caida_cm", "fps_grabacion", "intento", "metrica", "valor", "unidad"];
  const lines = rows.map((r) => {
    const movement = r.movement ? getMovement(r.movement) : undefined;
    const exercise = r.exercise ? getExercise(r.exercise) : undefined;
    const method = !r.method
      ? ""
      : r.type.startsWith("rom_")
        ? methodLabels[r.method as RomMethod]
        : r.method === "video"
          ? "Vídeo"
          : r.type === "vbt"
            ? "Encoder (a mano)"
            : r.type === "sprint_linear" || isCodType(r.type)
              ? "Fotocélulas o cronómetro"
              : "A mano";
    return [
      cell(r.patient),
      r.performed_at,
      r.type,
      movement
        ? cell(movementLabel(movement))
        : exercise
          ? cell(exercise.label)
          : r.gates
            ? `pasos ${(JSON.parse(r.gates) as number[]).join("-")} m`
            : "",
      r.side === "left" ? "izquierda" : r.side === "right" ? "derecha" : "",
      method ? cell(method) : "",
      num(r.extra_load_kg),
      num(r.drop_height_cm),
      num(r.capture_fps),
      r.series_index ? String(r.series_index) : "",
      r.metric,
      num(r.value),
      r.unit,
    ].join(";");
  });
  // Bienestar: una fila por respuesta, con el test «bienestar».
  const wellness = await db.query<{ patient: string; performed_at: string } & Record<"sleep" | "fatigue" | "stress" | "soreness" | "mood" | "pain", number | null>>(
    `select p.name as patient, w.performed_at, w.fatigue, w.sleep, w.soreness, w.stress, w.mood, w.pain
       from wellness w join patients p on p.id = w.patient_id
      order by p.name collate nocase, w.performed_at`,
  );
  const wellnessMetrics = [
    ["fatigue", "fatiga"],
    ["sleep", "sueno"],
    ["soreness", "dolor_muscular"],
    ["stress", "estres"],
    ["mood", "animo"],
    ["pain", "dolor_eva"],
  ] as const;
  for (const w of wellness) {
    for (const [col, metric] of wellnessMetrics) {
      if (w[col] === null) continue;
      lines.push([cell(w.patient), w.performed_at, "bienestar", "", "", "", "", "", "", "", metric, num(w[col]), col === "pain" ? "0-10" : "1-5"].join(";"));
    }
  }
  // Ficha clínica: el dolor de cada sesión y el resultado de cada test de exploración (1 positivo, 0 negativo).
  const sessions = await db.query<{ patient: string; performed_at: string; pain: number }>(
    `select p.name as patient, s.performed_at, s.pain from sessions s join patients p on p.id = s.patient_id
      where s.pain is not null order by p.name collate nocase, s.performed_at`,
  );
  for (const s of sessions) lines.push([cell(s.patient), s.performed_at, "sesion", "", "", "", "", "", "", "", "dolor_eva", num(s.pain), "0-10"].join(";"));
  const findings = await db.query<{ patient: string; performed_at: string; test_name: string; side: string | null; result: string }>(
    `select p.name as patient, f.performed_at, f.test_name, f.side, f.result from findings f join patients p on p.id = f.patient_id
      order by p.name collate nocase, f.performed_at`,
  );
  const sideText: Record<string, string> = { left: "izquierda", right: "derecha", both: "ambos" };
  const resultText: Record<string, [string, string]> = { positive: ["1", "positivo"], negative: ["0", "negativo"], inconclusive: ["", "dudoso"] };
  for (const f of findings) {
    const [value, word] = resultText[f.result]!;
    lines.push([cell(f.patient), f.performed_at, "exploracion", cell(f.test_name), f.side ? sideText[f.side] : "", "", "", "", "", "", "resultado", value, word].join(";"));
  }
  const questionnaires = await db.query<{ patient: string; performed_at: string; kind: string; score: number; details: string }>(
    `select p.name as patient, q.performed_at, q.kind, q.score, q.details from questionnaires q join patients p on p.id = q.patient_id
      order by p.name collate nocase, q.performed_at`,
  );
  for (const q of questionnaires) {
    const d = JSON.parse(q.details) as { subscale?: string; name?: string };
    const name = `${q.kind === "otro" ? (d.name ?? "otro") : q.kind}${d.subscale ? ` · ${d.subscale}` : ""}`;
    lines.push([cell(q.patient), q.performed_at, "cuestionario", cell(name), "", "", "", "", "", "", "puntuacion", num(q.score), ""].join(";"));
  }
  return "﻿" + [header.join(";"), ...lines].join("\r\n") + "\r\n";
}
