// Capa de datos: una función por operación (ver replica/architecture.md, sección API).
// Las pantallas solo hablan con estas funciones, nunca con SQL.
import { computeJump, type JumpOutput, type JumpType, type MarkEvent } from "../calc/results";
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

export type Mark = { event: MarkEvent; frameIndex: number; timeS: number };
export type Result = { metric: string; value: number; unit: string };

export type Test = {
  id: string;
  patientId: string;
  type: JumpType;
  performedAt: string;
  extraLoadKg: number;
  dropHeightCm: number | null;
  notes: string;
  video: VideoMeta | null;
  marks: Mark[];
  results: Result[];
};

export type NewJumpTest = { patientId: string; type: JumpType; extraLoadKg?: number; dropHeightCm?: number | null };

export async function createJumpTest(db: Db, input: NewJumpTest): Promise<string> {
  const id = newId();
  const t = now();
  await db.transaction([
    {
      sql: `insert into tests (id, patient_id, category, type, performed_at, extra_load_kg, drop_height_cm, created_at, updated_at)
            values (?, ?, 'jump', ?, ?, ?, ?, ?, ?)`,
      bind: [id, input.patientId, input.type, t, input.extraLoadKg ?? 0, input.dropHeightCm ?? null, t, t],
    },
  ]);
  return id;
}

export async function getTest(db: Db, id: string): Promise<Test | null> {
  const [row] = await db.query<{
    id: string;
    patient_id: string;
    type: JumpType;
    performed_at: string;
    extra_load_kg: number;
    drop_height_cm: number | null;
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
    "select event, frame_index as frameIndex, time_s as timeS from marks where test_id = ? order by time_s",
    [id],
  );
  const results = await db.query<Result>("select metric, value, unit from results where test_id = ? order by rowid", [id]);
  return {
    id: row.id,
    patientId: row.patient_id,
    type: row.type,
    performedAt: row.performed_at,
    extraLoadKg: row.extra_load_kg,
    dropHeightCm: row.drop_height_cm,
    notes: row.notes,
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
export async function saveMarksAndCompute(db: Db, testId: string, frames: Partial<Record<MarkEvent, number>>): Promise<JumpOutput> {
  const test = await getTest(db, testId);
  if (!test) throw new Error("El test no existe.");
  if (!test.video) throw new Error("El test no tiene vídeo.");
  const patient = await getPatient(db, test.patientId);
  const out = computeJump({
    type: test.type,
    captureFps: test.video.captureFps,
    frames,
    bodyMassKg: patient?.bodyMassKg ?? null,
    extraLoadKg: test.extraLoadKg,
    pushOffDistanceCm: patient?.pushOffDistanceCm ?? null,
  });
  const t = now();
  const statements: Statement[] = [
    { sql: "delete from marks where test_id = ?", bind: [testId] },
    { sql: "delete from results where test_id = ?", bind: [testId] },
  ];
  for (const [event, frame] of Object.entries(frames)) {
    if (frame === undefined) continue;
    statements.push({
      sql: "insert into marks (id, test_id, event, time_s, frame_index, created_at) values (?, ?, ?, ?, ?, ?)",
      bind: [newId(), testId, event, frame / test.video.captureFps, frame, t],
    });
  }
  for (const r of out.results) {
    statements.push({
      sql: "insert into results (id, test_id, metric, value, unit, created_at) values (?, ?, ?, ?, ?, ?)",
      bind: [newId(), testId, r.metric, r.value, r.unit, t],
    });
  }
  statements.push({ sql: "update tests set updated_at = ? where id = ?", bind: [t, testId] });
  await db.transaction(statements);
  return out;
}

export async function deleteTest(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from tests where id = ?", bind: [id] }]);
}

export type TestSummary = { id: string; type: JumpType; performedAt: string; heightCm: number | null; rsi: number | null };

/** Tests de un paciente, el más reciente primero, con su resultado principal. */
export async function listTests(db: Db, patientId: string): Promise<TestSummary[]> {
  return db.query<TestSummary>(
    `select t.id, t.type, t.performed_at as performedAt,
            (select value from results r where r.test_id = t.id and r.metric = 'jump_height_cm') as heightCm,
            (select value from results r where r.test_id = t.id and r.metric = 'rsi') as rsi
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
      where t.patient_id = ? and t.type = ? and r.metric = ?
      order by t.performed_at`,
    [patientId, type, metric],
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
  }>(
    `select p.name as patient, t.performed_at, t.type, t.extra_load_kg, t.drop_height_cm, v.fps as capture_fps,
            r.metric, r.value, r.unit
       from results r
       join tests t on t.id = r.test_id
       join patients p on p.id = t.patient_id
       left join videos v on v.test_id = t.id
      order by p.name collate nocase, t.performed_at, r.rowid`,
  );
  const num = (n: number | null, digits = 4) =>
    n === null ? "" : String(Number(n.toFixed(digits))).replace(".", ",");
  const cell = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = ["paciente", "fecha", "test", "carga_kg", "altura_caida_cm", "fps_grabacion", "metrica", "valor", "unidad"];
  const lines = rows.map((r) =>
    [
      cell(r.patient),
      r.performed_at,
      r.type,
      num(r.extra_load_kg),
      num(r.drop_height_cm),
      num(r.capture_fps),
      r.metric,
      num(r.value),
      r.unit,
    ].join(";"),
  );
  return "﻿" + [header.join(";"), ...lines].join("\r\n") + "\r\n";
}
