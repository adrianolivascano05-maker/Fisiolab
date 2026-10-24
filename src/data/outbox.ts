// Lo que ya ha salido de la bandeja de envíos (migración 026): para no mandarlo dos veces ni que lo mande otra
// persona del equipo. Las reglas y los mensajes, en src/schedule/outbox.ts.
import type { Db } from "./db";

export type OutboxStatus = "sent" | "skipped";
export type OutboxMark = { id: string; patientId: string; rule: string; status: OutboxStatus; at: string; by: string };

type Row = { id: string; patient_id: string; rule: string; status: OutboxStatus; at: string; by: string };

/** Las marcas de los últimos días (las más viejas ya no pueden volver a salir en la bandeja). */
export async function listOutboxMarks(db: Db, since: string): Promise<OutboxMark[]> {
  const rows = await db.query<Row>("select id, patient_id, rule, status, at, by from outbox where at >= ?", [since]);
  return rows.map((r) => ({ id: r.id, patientId: r.patient_id, rule: r.rule, status: r.status, at: r.at, by: r.by }));
}

/** Apunta que algo se ha enviado (o que se ha decidido no enviarlo). Si ya estaba, se queda lo último. */
export async function markOutbox(db: Db, m: { id: string; patientId: string; rule: string; status: OutboxStatus; by?: string }): Promise<void> {
  const t = new Date().toISOString();
  await db.transaction([
    {
      sql: `insert into outbox (id, patient_id, rule, status, at, by, updated_at) values (?, ?, ?, ?, ?, ?, ?)
              on conflict (id) do update set status = excluded.status, at = excluded.at, by = excluded.by, updated_at = excluded.updated_at`,
      bind: [m.id, m.patientId, m.rule, m.status, t, m.by ?? "", t],
    },
  ]);
}

