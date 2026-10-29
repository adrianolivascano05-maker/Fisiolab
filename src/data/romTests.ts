// Movilidad (S19): mediciones de rango articular.
// Parte de la capa de datos (repo.ts la reúne): una función por operación, las pantallas nunca ven SQL.
import { getMovement, type RomMethod, romTypeFor, summarize } from "../calc/rom";
import type { Db } from "./db";
import type { Statement } from "./protocol";
import { newId, now } from "./ids";
import type { Side } from "./tests";

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
