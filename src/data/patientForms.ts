// Formularios enviados al paciente (migración 024): su parte de la anamnesis o un cuestionario, que rellena desde su
// móvil con un enlace (src/clinical/patientForms.ts y src/patientForm). Aquí, lo que la clínica sabe de cada envío:
// a quién, qué, la clave del enlace, hasta cuándo vale y, al recoger las respuestas, qué contestó.
import type { Db } from "./db";

const now = () => new Date().toISOString();

/** «anamnesis» o el id del cuestionario (src/clinical/questionnaires.ts). */
export type SentForm = {
  id: string;
  patientId: string;
  /** El motivo de consulta al que va (src/data/episodes.ts); el id del paciente si es el primero. */
  episodeId: string;
  kind: string;
  /** La clave con la que se cifra (va en el enlace, después de «#»). */
  key: string;
  sentAt: string;
  expiresAt: string;
  answeredAt: string | null;
  importedAt: string | null;
  cancelledAt: string | null;
  /** Lo que contestó, tal cual. */
  answers: Record<string, unknown> | null;
  /** Campos de la anamnesis que no se pusieron porque ya había algo escrito. */
  skipped: string[];
  meta: FormMeta | null;
};

/**
 * Qué se mandó (migración 036): las preguntas de la anamnesis que vio el paciente y, a un paciente nuevo, la versión y
 * el texto de la información y de la casilla de contacto. Los envíos de antes no lo tienen (null).
 */
export type FormMeta = { fields?: string[]; intake?: { version: string; contactText: string } };

export type FormStatus = "pending" | "done" | "expired" | "cancelled";

/** En qué está: pendiente, rellenado (y ya en la ficha), caducado sin responder o anulado. */
export function formStatus(f: SentForm, at = now()): FormStatus {
  if (f.cancelledAt) return "cancelled";
  if (f.importedAt) return "done";
  if (f.expiresAt < at) return "expired";
  return "pending";
}

type Row = {
  id: string;
  patient_id: string;
  episode_id: string;
  kind: string;
  form_key: string;
  sent_at: string;
  expires_at: string;
  answered_at: string | null;
  imported_at: string | null;
  cancelled_at: string | null;
  answers: string | null;
  skipped: string;
  meta: string | null;
};

const toForm = (r: Row): SentForm => ({
  id: r.id,
  patientId: r.patient_id,
  episodeId: r.episode_id,
  kind: r.kind,
  key: r.form_key,
  sentAt: r.sent_at,
  expiresAt: r.expires_at,
  answeredAt: r.answered_at,
  importedAt: r.imported_at,
  cancelledAt: r.cancelled_at,
  answers: r.answers ? (JSON.parse(r.answers) as Record<string, unknown>) : null,
  skipped: JSON.parse(r.skipped || "[]") as string[],
  meta: r.meta ? (JSON.parse(r.meta) as FormMeta) : null,
});

export async function addSentForm(db: Db, f: Pick<SentForm, "id" | "patientId" | "episodeId" | "kind" | "key" | "expiresAt"> & { meta?: FormMeta | null }): Promise<void> {
  const t = now();
  await db.transaction([
    {
      sql: "insert into patient_forms (id, patient_id, episode_id, kind, form_key, sent_at, expires_at, updated_at, meta) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      bind: [f.id, f.patientId, f.episodeId, f.kind, f.key, t, f.expiresAt, t, f.meta ? JSON.stringify(f.meta) : null],
    },
  ]);
}

export async function getSentForm(db: Db, id: string): Promise<SentForm | null> {
  const [row] = await db.query<Row>("select * from patient_forms where id = ?", [id]);
  return row ? toForm(row) : null;
}

/** Los formularios enviados a un paciente, el último primero. */
export async function listSentForms(db: Db, patientId: string): Promise<SentForm[]> {
  return (await db.query<Row>("select * from patient_forms where patient_id = ? order by sent_at desc", [patientId])).map(toForm);
}

/** Respuestas recogidas y puestas en la ficha. */
export async function markImported(db: Db, id: string, input: { answeredAt: string; answers: Record<string, unknown>; skipped: string[] }): Promise<void> {
  const t = now();
  await db.transaction([
    {
      sql: "update patient_forms set answered_at = ?, imported_at = ?, answers = ?, skipped = ?, updated_at = ? where id = ?",
      bind: [input.answeredAt, t, JSON.stringify(input.answers), JSON.stringify(input.skipped), t, id],
    },
  ]);
}

/** Anulado: el enlace ya no vale (también se borra del servidor). */
/** Los enlaces pendientes de toda la clínica (sin contestar, sin caducar, sin anular), con el nombre del paciente. */
export async function listPendingForms(db: Db): Promise<(SentForm & { patientName: string })[]> {
  const rows = await db.query<Row & { patient_name: string }>(
    "select f.*, p.name as patient_name from patient_forms f join patients p on p.id = f.patient_id where f.cancelled_at is null and f.imported_at is null and f.expires_at >= ? order by f.sent_at desc",
    [now()],
  );
  return rows.map((r) => ({ ...toForm(r), patientName: r.patient_name }));
}

export async function cancelSentForm(db: Db, id: string): Promise<void> {
  const t = now();
  await db.transaction([{ sql: "update patient_forms set cancelled_at = ?, updated_at = ? where id = ? and imported_at is null", bind: [t, t, id] }]);
}
