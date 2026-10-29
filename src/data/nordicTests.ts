// Nórdico de isquios (S20).
// Parte de la capa de datos (repo.ts la reúne): una función por operación, las pantallas nunca ven SQL.
import { nordicTorque } from "../calc/nordic";
import type { Db } from "./db";
import type { Statement } from "./protocol";
import { newId, now } from "./ids";
import { getTest } from "./tests";
import { resultStatements } from "./strengthTests";
import { getPatient } from "./patients";

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
