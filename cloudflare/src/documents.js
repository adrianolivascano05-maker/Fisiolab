// @ts-check

import { clinicStatus } from "./clinics.js";
import { DOCS_CAP_GB, DOC_ID, DOC_MAGIC, MAX_DOC_BYTES, WARN_SHARE } from "./constants.js";
import { HttpError, database, json, readBytes } from "./util.js";

/** @typedef {import("./types.js").D1Database} D1Database */
/** @typedef {import("./types.js").Env} Env */

// ---------- Documentos (R2) ----------

export const noDocs = () =>
  new HttpError(501, "El servidor de la clínica aún no tiene el almacén de documentos (R2): quien lo gestiona tiene que activarlo (cloudflare/README.md, «Documentos»).");

const full = (/** @type {number} */ cap) =>
  new HttpError(507, `El almacén de documentos está lleno (${cap / 1e9} GB, el tope que ha puesto quien gestiona el servidor): borra los documentos que ya no hagan falta.`);

/**
 * El tope del almacén (DOCS_CAP_GB, o 10 GB) y desde cuándo se avisa (al 70 %).
 * @param {Env} env
 */
function docsLimits(env) {
  const gb = Number(env.DOCS_CAP_GB);
  const cap = Math.round((Number.isFinite(gb) && gb > 0 ? gb : DOCS_CAP_GB) * 1e9);
  return { cap, warnAt: Math.round(cap * WARN_SHARE) };
}

/** Dónde está un documento en R2. */
export const docKey = (/** @type {string} */ clinicId, /** @type {string} */ id) => `${clinicId}/${id}`;

/**
 * Borra de R2, de mil en mil (lo que admite cada orden). Sin almacén no hay nada que borrar.
 * @param {R2Bucket | undefined} docs
 * @param {string[]} keys
 */
export async function deleteDocs(docs, keys) {
  if (!docs) return;
  for (let i = 0; i < keys.length; i += 1000) await docs.delete(keys.slice(i, i + 1000));
}

/**
 * Borra documentos de R2 y de la tabla.
 * @param {D1Database} db
 * @param {R2Bucket | undefined} docs
 * @param {{ clinicId: string, id: string }[]} items
 */
export async function forgetDocs(db, docs, items) {
  if (!items.length) return;
  await deleteDocs(docs, items.map((d) => docKey(d.clinicId, d.id)));
  await db.batch(items.map((d) => db.prepare("DELETE FROM documents WHERE clinic_id = ? AND id = ?").bind(d.clinicId, d.id)));
}

/**
 * Lo que ocupa todo el almacén: los documentos y las copias de las clínicas que están en R2. El tope es de todo (el
 * nivel gratuito de R2 es de la cuenta).
 */
async function storedBytes(/** @type {D1Database} */ db) {
  const row = await db
    .prepare("SELECT (SELECT coalesce(sum(size), 0) FROM documents) + (SELECT coalesce(sum(size), 0) FROM heads WHERE parts = 0) AS bytes")
    .first();
  return Number(row?.bytes ?? 0);
}

/**
 * Los bytes de un documento que se sube: cifrado por la app y de 5 MB como mucho. Se leen por trozos y se corta en
 * cuanto pasa del máximo, aunque no diga cuánto ocupa.
 * @param {Request} request
 */
async function readDoc(request) {
  const bytes = await readBytes(request, MAX_DOC_BYTES, () => new HttpError(413, "El documento pasa de 5 MB, el máximo."));
  if (bytes.byteLength <= DOC_MAGIC.length + 12 || !DOC_MAGIC.every((b, i) => bytes[i] === b)) throw new HttpError(415, "Solo se guardan documentos cifrados.");
  return bytes;
}

/**
 * Cuánto ocupan los documentos de la clínica y el almacén entero, para que la app lo enseñe y avise antes del tope.
 * @param {D1Database} db
 * @param {Env} env
 * @param {string} clinicId
 */
export async function docsUsage(db, env, clinicId) {
  if (!env.DOCS) return json(200, { enabled: false });
  const mine = await db.prepare("SELECT count(*) AS n, coalesce(sum(size), 0) AS bytes FROM documents WHERE clinic_id = ? AND form_id IS NULL").bind(clinicId).first();
  return json(200, {
    enabled: true,
    count: Number(mine?.n ?? 0),
    used: Number(mine?.bytes ?? 0),
    total: await storedBytes(db),
    ...docsLimits(env),
    maxBytes: 5 * 1024 * 1024,
  });
}

/**
 * Un documento de la clínica: subirlo (PUT), bajarlo (GET), borrarlo (DELETE) o quedarse con uno que subió un paciente
 * (POST …/guardar: si no, se borra al recoger o anular su formulario).
 * @param {Request} request
 * @param {D1Database} db
 * @param {Env} env
 * @param {string} clinicId
 * @param {string} docId
 * @param {boolean} keep
 * @param {() => number} now
 */
export async function clinicDoc(request, db, env, clinicId, docId, keep, now) {
  if (!DOC_ID.test(docId)) throw new HttpError(400, "El documento no tiene un id válido.");
  const docs = env.DOCS;
  if (!docs) throw noDocs();
  const row = await db.prepare("SELECT size, form_id FROM documents WHERE clinic_id = ? AND id = ?").bind(clinicId, docId).first();
  if (keep) {
    if (!row) throw new HttpError(404, "Ese documento ya no está en el servidor.");
    await db.prepare("UPDATE documents SET form_id = NULL WHERE clinic_id = ? AND id = ?").bind(clinicId, docId).run();
    return json(200, { id: docId });
  }
  if (request.method === "DELETE") {
    await forgetDocs(db, docs, [{ clinicId, id: docId }]);
    return new Response(null, { status: 204 });
  }
  if (request.method === "GET") {
    const object = row ? await docs.get(docKey(clinicId, docId)) : null;
    if (!object) throw new HttpError(404, "Ese documento no está en el servidor.");
    return new Response(object.body, { status: 200, headers: { "Content-Type": "application/octet-stream" } });
  }
  // PUT: los de la clínica (los de un paciente llegan por su enlace). Si ya está (otro intento tras un corte), no se
  // vuelve a guardar: cada documento tiene su id al azar y nunca cambia.
  if (docId.includes(".")) throw new HttpError(400, "Ese id es el de un documento que sube un paciente.");
  const bytes = await readDoc(request);
  if (row) return json(200, { id: docId, size: Number(row.size) });
  const { cap } = docsLimits(env);
  if ((await storedBytes(db)) + bytes.byteLength > cap) throw full(cap);
  await docs.put(docKey(clinicId, docId), bytes);
  await db
    .prepare("INSERT INTO documents (clinic_id, id, form_id, size, created_at) VALUES (?, ?, NULL, ?, ?) ON CONFLICT (clinic_id, id) DO NOTHING")
    .bind(clinicId, docId, bytes.byteLength, new Date(now()).toISOString())
    .run();
  return json(201, { id: docId, size: bytes.byteLength });
}

/**
 * El paciente sube su documento n con el enlace (sin sesión), cifrado con la clave del enlace. Mientras no envía el
 * formulario puede cambiarlo (se sustituye); después, ya no.
 * @param {Request} request
 * @param {Env} env
 * @param {string} formId
 * @param {number} n
 * @param {() => number} now
 */
export async function publicFormDoc(request, env, formId, n, now) {
  const db = database(env);
  const gone = () => new HttpError(404, "Este enlace ya no vale: ha caducado o la clínica lo ha anulado. Pide otro a tu fisioterapeuta.");
  const row = await db
    .prepare("SELECT f.clinic_id, f.expires_at, f.answered_at, r.max_docs FROM patient_forms f LEFT JOIN doc_requests r ON r.form_id = f.id WHERE f.id = ?")
    .bind(formId)
    .first();
  if (!row || (row.answered_at === null && Date.parse(String(row.expires_at)) < now())) throw gone();
  if (row.answered_at !== null) throw new HttpError(409, "Ya enviaste tus documentos. Si te falta alguno, díselo a tu fisioterapeuta.");
  const clinicId = String(row.clinic_id);
  const status = await clinicStatus(db, clinicId);
  if (status?.deletedAt) throw gone();
  if (status?.suspendedAt) throw new HttpError(423, "Ahora mismo la clínica no puede recibir documentos. Inténtalo más tarde o díselo a tu fisioterapeuta.");
  if (!(n <= Number(row.max_docs ?? 0))) throw new HttpError(400, "Este enlace no admite más documentos.");
  if (!env.DOCS) throw noDocs();
  const bytes = await readDoc(request);
  const id = `${formId}.${n}`;
  const before = await db.prepare("SELECT size FROM documents WHERE clinic_id = ? AND id = ?").bind(clinicId, id).first();
  if ((await storedBytes(db)) - Number(before?.size ?? 0) + bytes.byteLength > docsLimits(env).cap) {
    throw new HttpError(507, "Ahora mismo la clínica no puede recibir más documentos. Díselo a tu fisioterapeuta.");
  }
  await env.DOCS.put(docKey(clinicId, id), bytes);
  await db
    .prepare(
      `INSERT INTO documents (clinic_id, id, form_id, size, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (clinic_id, id) DO UPDATE SET size = excluded.size, created_at = excluded.created_at`,
    )
    .bind(clinicId, id, formId, bytes.byteLength, new Date(now()).toISOString())
    .run();
  return json(200, { ok: true });
}
