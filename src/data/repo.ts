// Capa de datos: una función por operación (ver replica/architecture.md, sección API).
// Las pantallas solo hablan con estas funciones, nunca con SQL.
import { computeJump, type JumpOutput, type JumpType, type MarkEvent, type MarkInput } from "../calc/results";
import { fvProfile, type FvProfile, type Point } from "../calc/profile";
import { getMovement, methodLabels, movementLabel, romTypeFor, summarize, type RomMethod, type RomType } from "../calc/rom";
import type { Db } from "./db";
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

export type Patient = PatientInput & { id: string; createdAt: string; updatedAt: string };

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
export type TestType = JumpType | RomType;

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
};

/** Tests de un paciente, el más reciente primero, con su resultado principal. */
export async function listTests(db: Db, patientId: string): Promise<TestSummary[]> {
  return db.query<TestSummary>(
    `select t.id, t.type, t.side, t.performed_at as performedAt, t.extra_load_kg as extraLoadKg,
            (select value from results r where r.test_id = t.id and r.metric = 'jump_height_cm' and r.series_index = 0) as heightCm,
            (select value from results r where r.test_id = t.id and r.metric = 'rsi' and r.series_index = 0) as rsi,
            (select value from results r where r.test_id = t.id and r.metric = 'jump_distance_cm' and r.series_index = 0) as distanceCm,
            json_extract(t.details, '$.movement') as movement,
            (select value from results r where r.test_id = t.id and r.metric = 'angle_deg' and r.series_index = 0) as angleDeg
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
    method: RomMethod | null;
  }>(
    `select p.name as patient, t.performed_at, t.type, t.side, t.extra_load_kg, t.drop_height_cm, v.fps as capture_fps,
            json_extract(t.details, '$.movement') as movement, json_extract(t.details, '$.method') as method,
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
    return [
      cell(r.patient),
      r.performed_at,
      r.type,
      movement ? cell(movementLabel(movement)) : "",
      r.side === "left" ? "izquierda" : r.side === "right" ? "derecha" : "",
      r.method ? cell(methodLabels[r.method]) : "",
      num(r.extra_load_kg),
      num(r.drop_height_cm),
      num(r.capture_fps),
      r.series_index ? String(r.series_index) : "",
      r.metric,
      num(r.value),
      r.unit,
    ].join(";");
  });
  return "﻿" + [header.join(";"), ...lines].join("\r\n") + "\r\n";
}
