// Bienestar (S21): un registro por día.
// Parte de la capa de datos (repo.ts la reúne): una función por operación, las pantallas nunca ven SQL.
import { wellnessItems, type WellnessScores } from "../calc/wellness";
import { dayOf as madridDay } from "../app/dates";
import type { Db } from "./db";
import { newId, now } from "./ids";

export type WellnessInput = WellnessScores & { pain: number | null; notes: string };
export type WellnessEntry = WellnessInput & { id: string; performedAt: string };


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
