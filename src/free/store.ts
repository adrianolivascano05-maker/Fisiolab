// Guardado de las mediciones libres en su propia tabla, que crea el módulo la primera vez.
// No forma parte de las migraciones de la app: si se quita el módulo, la tabla queda sin uso
// (o se borra con `drop table free_measurements`) y nada más cambia.
import type { Db } from "../data/db";
import type { BiomechanicalMeasurement } from "./types";

const ensured = new WeakSet<Db>();

async function ensureTable(db: Db) {
  if (ensured.has(db)) return;
  await db.transaction([
    {
      sql: `create table if not exists free_measurements (
              id         text primary key,
              patient_id text not null references patients (id) on delete cascade,
              created_at text not null,
              data       text not null check (json_valid(data))
            )`,
    },
    { sql: "create index if not exists free_measurements_patient on free_measurements (patient_id, created_at)" },
  ]);
  ensured.add(db);
}

export async function saveMeasurement(db: Db, m: BiomechanicalMeasurement): Promise<void> {
  await ensureTable(db);
  await db.transaction([
    {
      sql: "insert into free_measurements (id, patient_id, created_at, data) values (?, ?, ?, ?)",
      bind: [m.id, m.patientId, m.createdAt, JSON.stringify(m)],
    },
  ]);
}

export async function listMeasurements(db: Db, patientId: string): Promise<BiomechanicalMeasurement[]> {
  await ensureTable(db);
  const rows = await db.query<{ data: string }>("select data from free_measurements where patient_id = ? order by created_at desc", [patientId]);
  return rows.map((r) => JSON.parse(r.data) as BiomechanicalMeasurement);
}

export async function getMeasurement(db: Db, id: string): Promise<BiomechanicalMeasurement | null> {
  await ensureTable(db);
  const [row] = await db.query<{ data: string }>("select data from free_measurements where id = ?", [id]);
  return row ? (JSON.parse(row.data) as BiomechanicalMeasurement) : null;
}

export async function deleteMeasurement(db: Db, id: string): Promise<void> {
  await ensureTable(db);
  await db.transaction([{ sql: "delete from free_measurements where id = ?", bind: [id] }]);
}

/** Informe en CSV para Excel (punto y coma, coma decimal y BOM), como el resto de la app. */
export function reportCsv(m: BiomechanicalMeasurement, patientName: string, labels: (id: string) => string): string {
  const n = (x: number, d = 2) => x.toFixed(d).replace(".", ",");
  const plane = { sagittal: "sagital", frontal: "frontal", transverse: "transversal", screen: "pantalla (2D)" }[m.anatomicalPlane];
  const ref = m.referenceType === "plumb_line" ? "plomada" : `${labels(m.referenceVector.startJoint)} → ${labels(m.referenceVector.endJoint)}`;
  const head = [
    `paciente;${patientName.replace(/;/g, ",")}`,
    `fecha;${m.createdAt}`,
    `video;${m.video?.fileName ?? ""};fps;${m.video?.fps ?? ""}`,
    `plano;${plane}`,
    `referencia;${ref}`,
    `segmento;${labels(m.movementVector.startJoint)} → ${labels(m.movementVector.endJoint)}`,
    `angulo_inicial_grados;${n(m.initialAngleDegrees, 1)}`,
    `angulo_maximo_grados;${n(m.maxAngleDegrees, 1)}`,
    `amplitud_grados;${n(m.deltaAngleDegrees, 1)}`,
    "",
    "fotograma;tiempo_s;angulo_grados",
  ];
  const rows = m.keyframes.map((k) => `${k.frameNumber};${n(k.timestampSeconds, 3)};${n(k.angleDegrees, 1)}`);
  return "﻿" + [...head, ...rows].join("\r\n") + "\r\n";
}
