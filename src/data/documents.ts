// Archivos del paciente (migración 032): informes y pruebas en PDF que añade la clínica o sube el paciente con su
// enlace. Aquí solo lo que se sabe de cada uno (nombre, tamaño, de dónde viene y su clave); el archivo va cifrado en
// el almacén de documentos del servidor (src/documents) y, en el dispositivo que lo añadió, hasta que se sube.
import type { Db } from "./db";

const now = () => new Date().toISOString();

/** Lo más que puede ocupar un archivo (el PDF ya hecho), igual que en el servidor. */
export const MAX_DOC_BYTES = 5 * 1024 * 1024;

export type DocSource = "clinic" | "patient";

export type PatientDocument = {
  id: string;
  patientId: string;
  /** El motivo de consulta en el que se añadió (src/data/episodes.ts); el id del paciente si es el primero. */
  episodeId: string;
  name: string;
  mime: string;
  /** Bytes del archivo (sin cifrar). */
  size: number;
  /** La clave con la que va cifrado (src/documents/docCrypto.ts). */
  key: string;
  source: DocSource;
  /** El enlace con el que lo subió el paciente. */
  formId: string | null;
  createdAt: string;
  /** null: aún no está en el servidor (lo tiene el dispositivo que lo añadió). */
  uploadedAt: string | null;
};

type Row = {
  id: string;
  patient_id: string;
  episode_id: string;
  name: string;
  mime: string;
  size: number;
  doc_key: string;
  source: DocSource;
  form_id: string | null;
  created_at: string;
  uploaded_at: string | null;
};

const toDoc = (r: Row): PatientDocument => ({
  id: r.id,
  patientId: r.patient_id,
  episodeId: r.episode_id,
  name: r.name,
  mime: r.mime,
  size: Number(r.size),
  key: r.doc_key,
  source: r.source,
  formId: r.form_id,
  createdAt: r.created_at,
  uploadedAt: r.uploaded_at,
});

/** Los archivos de un paciente, el último primero. */
export async function listDocuments(db: Db, patientId: string): Promise<PatientDocument[]> {
  return (await db.query<Row>("select * from documents where patient_id = ? order by created_at desc, name", [patientId])).map(toDoc);
}

export async function getDocument(db: Db, id: string): Promise<PatientDocument | null> {
  const [row] = await db.query<Row>("select * from documents where id = ?", [id]);
  return row ? toDoc(row) : null;
}

/** Cuántos archivos tiene cada paciente (para la ficha y la lista). */
export async function countDocuments(db: Db, patientId: string): Promise<number> {
  const [row] = await db.query<{ n: number }>("select count(*) as n from documents where patient_id = ?", [patientId]);
  return Number(row?.n ?? 0);
}

export type NewDocument = Pick<PatientDocument, "patientId" | "episodeId" | "name" | "mime" | "size" | "key"> & {
  id?: string;
  source?: DocSource;
  formId?: string | null;
  /** Si ya está en el servidor (los que sube el paciente llegan ya allí). */
  uploadedAt?: string | null;
  createdAt?: string;
};

/** Apunta un archivo. Devuelve su id (al azar, salvo los del paciente, que traen el suyo). */
export async function addDocument(db: Db, d: NewDocument): Promise<string> {
  const id = d.id ?? crypto.randomUUID();
  const t = now();
  await db.transaction([
    {
      sql: `insert into documents (id, patient_id, episode_id, name, mime, size, doc_key, source, form_id, created_at, uploaded_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [id, d.patientId, d.episodeId, cleanName(d.name), d.mime, d.size, d.key, d.source ?? "clinic", d.formId ?? null, d.createdAt ?? t, d.uploadedAt ?? null, t],
    },
  ]);
  return id;
}

/** El nombre que se ve: sin saltos de línea ni espacios de más, y no vacío. */
export function cleanName(name: string): string {
  const n = name.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return n || "Documento";
}

export async function renameDocument(db: Db, id: string, name: string): Promise<void> {
  await db.transaction([{ sql: "update documents set name = ?, updated_at = ? where id = ?", bind: [cleanName(name), now(), id] }]);
}

/** Ya está en el servidor. */
export async function markUploaded(db: Db, id: string): Promise<void> {
  const t = now();
  await db.transaction([{ sql: "update documents set uploaded_at = ?, updated_at = ? where id = ? and uploaded_at is null", bind: [t, t, id] }]);
}

/** Los que aún no están en el servidor (de este dispositivo o de otro que aún no los ha subido). */
export async function pendingUploads(db: Db): Promise<PatientDocument[]> {
  return (await db.query<Row>("select * from documents where uploaded_at is null order by created_at")).map(toDoc);
}

/** Borra un archivo: se apunta para borrarlo también del servidor (src/documents/docSync.ts; al borrar el paciente,
 * deletePatient hace lo mismo con todos los suyos). */
export async function deleteDocument(db: Db, id: string): Promise<void> {
  const t = now();
  await db.transaction([
    { sql: "insert or ignore into document_trash (id, at) select id, ? from documents where id = ?", bind: [t, id] },
    { sql: "delete from documents where id = ?", bind: [id] },
  ]);
}

/** Lo que este dispositivo tiene que borrar del servidor. */
export async function trashedDocuments(db: Db): Promise<string[]> {
  return (await db.query<{ id: string }>("select id from document_trash order by at")).map((r) => r.id);
}

export async function forgetTrashed(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from document_trash where id = ?", bind: [id] }]);
}

/** «1,2 MB», «340 kB». */
export function sizeText(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1000)).toLocaleString("es-ES")} kB`;
}
