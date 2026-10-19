// Motivos de consulta (migración 010): cada vez que un paciente viene por un problema distinto, su anamnesis y sus
// registros van aparte. El primer motivo tiene el id del paciente; los registros nuevos se apuntan solos al motivo
// que se está viendo (un disparador de la migración). Las listas de la ficha enseñan solo los del motivo elegido.
import type { Answers } from "./clinical";
import type { Db } from "./db";

export const ALL = "all";

export type Episode = {
  id: string;
  patientId: string;
  /** Vacío si no se le ha puesto nombre: se enseña el motivo de su anamnesis. */
  title: string;
  startedAt: string;
  closedAt: string | null;
  /** El primero: su anamnesis es la de la tabla anamnesis. */
  first: boolean;
  /** El motivo principal escrito en su anamnesis. */
  reason: string | null;
};

type Row = { id: string; patient_id: string; title: string; started_at: string; closed_at: string | null; reason: string | null };
const now = () => new Date().toISOString();

/**
 * Condición SQL: la fila (con `patient_id` y `episode_id`, bajo el alias dado) es del motivo que se está viendo, o se
 * están viendo todos. Nulo en `episode_id` es el primer motivo.
 */
export const inFocus = (t: string) =>
  `coalesce((select f.episode_id from episode_focus f where f.patient_id = ${t}.patient_id), '${ALL}') in ('${ALL}', coalesce(${t}.episode_id, ${t}.patient_id))`;

/** Los motivos del paciente, el primero delante y los demás por fecha. Siempre hay al menos el primero. */
export async function listEpisodes(db: Db, patientId: string): Promise<Episode[]> {
  const [rows, [patient]] = await Promise.all([
    db.query<Row>(
      "select id, patient_id, title, started_at, closed_at, json_extract(answers, '$.motivo') as reason from episodes where patient_id = ? order by started_at, created_at",
      [patientId],
    ),
    db.query<{ created_at: string; reason: string | null }>(
      "select created_at, (select json_extract(answers, '$.motivo') from anamnesis where patient_id = p.id) as reason from patients p where id = ?",
      [patientId],
    ),
  ]);
  const toEpisode = (r: Row): Episode => ({ id: r.id, patientId: r.patient_id, title: r.title, startedAt: r.started_at, closedAt: r.closed_at, first: r.id === patientId, reason: r.reason });
  const first = rows.find((r) => r.id === patientId);
  return [
    first
      ? { ...toEpisode(first), reason: patient?.reason ?? null }
      : { id: patientId, patientId, title: "", startedAt: patient?.created_at ?? now(), closedAt: null, first: true, reason: patient?.reason ?? null },
    ...rows.filter((r) => r.id !== patientId).map(toEpisode),
  ];
}

/** Nombre para enseñar: el que se le puso, o el principio del motivo de su anamnesis. */
export function episodeLabel(e: Episode): string {
  if (e.title) return e.title;
  const r = e.reason?.trim().split("\n")[0];
  if (r) return r.length > 40 ? `${r.slice(0, 39)}…` : r;
  return e.first ? "Primera consulta" : "Motivo sin nombre";
}

/** El motivo que se está viendo, o ALL. Si el elegido ya no existe (borrado en otro dispositivo), todos. */
export async function getFocus(db: Db, patientId: string): Promise<string> {
  const [row] = await db.query<{ episode_id: string }>(
    `select episode_id from episode_focus f
      where patient_id = ?1 and (episode_id in (?1, '${ALL}') or exists (select 1 from episodes e where e.id = f.episode_id))`,
    [patientId],
  );
  return row?.episode_id ?? ALL;
}

export async function setFocus(db: Db, patientId: string, episodeId: string): Promise<void> {
  await db.transaction([
    {
      sql: "insert into episode_focus (patient_id, episode_id) values (?, ?) on conflict (patient_id) do update set episode_id = excluded.episode_id",
      bind: [patientId, episodeId],
    },
  ]);
}

/** El motivo al que va lo nuevo: el que se ve o, viendo todos, el último abierto (el primero si no hay otro). */
export async function currentEpisode(db: Db, patientId: string): Promise<string> {
  const focus = await getFocus(db, patientId);
  if (focus !== ALL) return focus;
  const [row] = await db.query<{ id: string }>("select id from episodes where patient_id = ? and closed_at is null order by started_at desc, created_at desc limit 1", [patientId]);
  return row?.id ?? patientId;
}

/** Un motivo nuevo, con su anamnesis (vacía o con los datos personales de la anterior). Pasa a ser el que se ve. */
export async function createEpisode(db: Db, patientId: string, input: { title: string; startedAt: string; answers: Answers }): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new RangeError("Escribe por qué viene.");
  if (Number.isNaN(Date.parse(input.startedAt))) throw new RangeError("Pon la fecha.");
  const id = crypto.randomUUID();
  const t = now();
  await db.transaction([
    {
      sql: "insert into episodes (id, patient_id, title, started_at, answers, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
      bind: [id, patientId, title, input.startedAt, JSON.stringify(input.answers), t, t],
    },
    {
      sql: "insert into episode_focus (patient_id, episode_id) values (?, ?) on conflict (patient_id) do update set episode_id = excluded.episode_id",
      bind: [patientId, id],
    },
  ]);
  return id;
}

/** Cambia el nombre o lo da por terminado (closedAt) o lo reabre (null). Al primero se le crea su fila. */
export async function updateEpisode(db: Db, patientId: string, id: string, change: { title?: string; closedAt?: string | null }): Promise<void> {
  const [ep] = (await listEpisodes(db, patientId)).filter((e) => e.id === id);
  if (!ep) throw new RangeError("Este motivo ya no existe.");
  const title = change.title !== undefined ? change.title.trim() : ep.title;
  const closedAt = change.closedAt !== undefined ? change.closedAt : ep.closedAt;
  const t = now();
  await db.transaction([
    {
      sql: `insert into episodes (id, patient_id, title, started_at, closed_at, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)
            on conflict (id) do update set title = excluded.title, closed_at = excluded.closed_at, updated_at = excluded.updated_at`,
      bind: [id, patientId, title, ep.startedAt, closedAt, t, t],
    },
  ]);
}

/** Borra un motivo (no el primero) con todo lo suyo: anamnesis, sesiones, exploración, cuestionarios y mediciones. */
export async function deleteEpisode(db: Db, patientId: string, id: string): Promise<void> {
  if (id === patientId) throw new RangeError("El primer motivo no se puede borrar.");
  await db.transaction([
    ...["sessions", "findings", "questionnaires", "tests"].map((t) => ({ sql: `delete from ${t} where patient_id = ? and episode_id = ?`, bind: [patientId, id] })),
    { sql: "delete from episodes where id = ? and patient_id = ?", bind: [id, patientId] },
    { sql: "update episode_focus set episode_id = ? where patient_id = ? and episode_id = ?", bind: [ALL, patientId, id] },
  ]);
}

/** Cuántos registros tiene cada motivo (para avisar antes de borrar y para la lista). */
export async function episodeCounts(db: Db, patientId: string): Promise<Record<string, number>> {
  const rows = await db.query<{ ep: string; n: number }>(
    `select coalesce(episode_id, patient_id) as ep, count(*) as n from (
       select patient_id, episode_id from sessions where patient_id = ?1
       union all select patient_id, episode_id from findings where patient_id = ?1
       union all select patient_id, episode_id from questionnaires where patient_id = ?1
       union all select patient_id, episode_id from tests where patient_id = ?1)
     group by ep`,
    [patientId],
  );
  return Object.fromEntries(rows.map((r) => [r.ep, r.n]));
}

/** Anamnesis de un motivo que no es el primero. */
export async function getEpisodeAnswers(db: Db, id: string): Promise<{ answers: Answers; createdAt: string; updatedAt: string } | null> {
  const [row] = await db.query<{ answers: string; created_at: string; updated_at: string }>("select answers, created_at, updated_at from episodes where id = ?", [id]);
  return row ? { answers: JSON.parse(row.answers) as Answers, createdAt: row.created_at, updatedAt: row.updated_at } : null;
}

export async function saveEpisodeAnswers(db: Db, id: string, answers: Answers): Promise<void> {
  await db.transaction([{ sql: "update episodes set answers = ?, updated_at = ? where id = ?", bind: [JSON.stringify(answers), now(), id] }]);
}
