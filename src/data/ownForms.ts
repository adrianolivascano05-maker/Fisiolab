// Cuestionarios propios de la clínica: cómo se guardan (docs/cuestionarios-propios.md). El mismo modelo que las
// plantillas de anamnesis (src/data/anamnesisTemplates.ts), en ajustes que se sincronizan fila entera, sin migración:
// - `own_q:<uuid>`: el puntero, con la versión de ahora entera, su huella, si está archivado, quién y cuándo.
// - `own_q_v:<uuid>:<huella>`: cada versión guardada, inmutable. Lo ya respondido se queda con la suya.
// - `own_q_notice`: quién vio el aviso de derechos de autor y cuándo.
// Se guarda con el botón «Guardar» del editor: cada guardado es una versión. No se borran: se archivan.
import { checkOwnForm, OWN_PREFIX, type OwnFormSpec } from "../clinical/forms/own";
import type { Db } from "./db";
import { getSetting, setSetting } from "./settings";

const POINTER = (uuid: string) => `own_q:${uuid}`;
const SNAPSHOT = (uuid: string, hash: string) => `own_q_v:${uuid}:${hash}`;
const NOTICE = "own_q_notice";
export const isOwnFormKey = (key: string) => key.startsWith("own_q:") || key.startsWith("own_q_v:") || key === NOTICE;
const uuidOf = (id: string) => id.slice(OWN_PREFIX.length);

/** El puntero: la versión de ahora, si está archivado y quién lo cambió por última vez. */
export type OwnFormDoc = { spec: OwnFormSpec; archived?: boolean; by?: string; at: string; createdAt: string };

/** La huella de una versión: sha256 de su contenido (sin la huella), 12 cifras hexadecimales. */
export async function ownHash(spec: OwnFormSpec): Promise<string> {
  const { hash: _ignored, ...content } = spec;
  void _ignored;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(content))));
  return Array.from(digest.subarray(0, 6), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const newOwnFormId = () => `${OWN_PREFIX}${crypto.randomUUID()}`;
export const newItemId = () => `q_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

/** Todos los cuestionarios propios (también los archivados), por nombre. */
export async function listOwnForms(db: Db): Promise<OwnFormDoc[]> {
  const rows = await db.query<{ value: string }>("select value from settings where key like 'own\\_q:%' escape '\\'");
  return rows
    .map((r) => JSON.parse(r.value) as OwnFormDoc)
    .filter((d) => d?.spec?.id)
    .sort((a, b) => a.spec.name.localeCompare(b.spec.name, "es"));
}

export async function getOwnForm(db: Db, id: string): Promise<OwnFormDoc | null> {
  return getSetting<OwnFormDoc>(db, POINTER(uuidOf(id)));
}

/** Una versión concreta («id» y «huella»), o null. */
export async function getOwnSnapshot(db: Db, id: string, hash: string): Promise<OwnFormSpec | null> {
  if (!/^[0-9a-f]{12}$/.test(hash)) return null;
  return getSetting<OwnFormSpec>(db, SNAPSHOT(uuidOf(id), hash));
}

/** Todas las versiones guardadas (para la exportación y para leer lo ya respondido). */
export async function listOwnSnapshots(db: Db): Promise<OwnFormSpec[]> {
  const rows = await db.query<{ value: string }>("select value from settings where key like 'own\\_q\\_v:%' escape '\\'");
  return rows.map((r) => JSON.parse(r.value) as OwnFormSpec);
}

/**
 * Guarda una versión: la comprueba, le pone su huella, escribe la instantánea (si esa versión no estaba) y el puntero
 * con quién y cuándo. Devuelve el puntero nuevo. Lo ya respondido se queda con la versión con la que se hizo.
 */
export async function saveOwnForm(db: Db, spec: OwnFormSpec, by: string | null, opts: { archived?: boolean; clinic?: string } = {}): Promise<OwnFormDoc> {
  const prev = await getSetting<OwnFormDoc>(db, POINTER(uuidOf(spec.id)));
  // La nota para el profesional lleva el nombre de la clínica y la fecha en que se escribió (o se cambió).
  const noteSame = !!prev?.spec.note && prev.spec.note === spec.note?.trim();
  const stamp = spec.note?.trim()
    ? noteSame
      ? { noteClinic: prev!.spec.noteClinic, noteAt: prev!.spec.noteAt }
      : { noteClinic: opts.clinic?.trim() || spec.noteClinic, noteAt: new Date().toISOString().slice(0, 10) }
    : { noteClinic: undefined, noteAt: undefined };
  const clean = checkOwnForm({ ...spec, ...stamp, hash: undefined });
  const hash = await ownHash(clean);
  const versioned: OwnFormSpec = { ...clean, hash };
  const uuid = uuidOf(clean.id);
  if (!(await getSetting(db, SNAPSHOT(uuid, hash)))) await setSetting(db, SNAPSHOT(uuid, hash), versioned);
  const before = prev;
  const now = new Date().toISOString();
  const archived = opts.archived ?? before?.archived;
  const doc: OwnFormDoc = { spec: versioned, ...(archived ? { archived: true } : {}), ...(by ? { by } : {}), at: now, createdAt: before?.createdAt ?? now };
  await setSetting(db, POINTER(uuid), doc);
  return doc;
}

/** Archivar o volver a usar: deja de salir en «Pasar» y «Enviar», pero lo respondido se sigue viendo. */
export async function archiveOwnForm(db: Db, id: string, archived: boolean, by: string | null): Promise<void> {
  const doc = await getOwnForm(db, id);
  if (!doc) return;
  await setSetting(db, POINTER(uuidOf(id)), { ...doc, archived: archived || undefined, ...(by ? { by } : {}), at: new Date().toISOString() });
}

/** Una copia con otro id y «(copia)» en el nombre. */
export async function duplicateOwnForm(db: Db, id: string, by: string | null): Promise<OwnFormDoc | null> {
  const doc = await getOwnForm(db, id);
  if (!doc) return null;
  return saveOwnForm(db, { ...doc.spec, id: newOwnFormId(), name: `${doc.spec.name} (copia)`.slice(0, 120), hash: undefined }, by, { archived: false });
}

/** Cambiar el nombre: una versión nueva (lo respondido antes se sigue viendo con el nombre que tenía). */
export async function renameOwnForm(db: Db, id: string, name: string, by: string | null): Promise<OwnFormDoc | null> {
  const doc = await getOwnForm(db, id);
  if (!doc) return null;
  return saveOwnForm(db, { ...doc.spec, name }, by);
}

/** Quién vio el aviso de derechos de autor y cuándo (al crear el primero). */
export type OwnNotice = { by: string | null; at: string };
export const getOwnNotice = (db: Db) => getSetting<OwnNotice>(db, NOTICE);
export async function markOwnNotice(db: Db, by: string | null): Promise<void> {
  if (!(await getOwnNotice(db))) await setSetting(db, NOTICE, { by, at: new Date().toISOString() } satisfies OwnNotice);
}
