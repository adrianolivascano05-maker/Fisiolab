// @ts-check

import { clinicStatus, normalEmail } from "./clinics.js";
import { DOC_PURGE_BATCH, FORM_ID, KEEP_ANSWERS_DAYS, MAX_ANSWER_CHARS, MAX_DOCS_PER_FORM, MAX_FORM_CHARS, MAX_FORM_DAYS, MAX_OPEN_FORMS } from "./constants.js";
import { forgetDocs, noDocs } from "./documents.js";
import { HttpError, isBase64, json, notFound, readBigJson } from "./util.js";

/** @typedef {import("./types.js").D1Database} D1Database */

// ---------- Formularios para el paciente ----------

/** Cuándo se limpiaron los formularios por última vez en esta instancia del servidor (ms), y cada cuánto como mucho. */
let lastFormsPurge = -Infinity;

const PURGE_EVERY_MS = 10 * 60_000;

/**
 * Borra los formularios caducados sin responder, los ya recogidos al caducar y las respuestas que nadie ha recogido en
 * 60 días; con ellos, los documentos que subieron los pacientes y nadie ha guardado.
 * @param {D1Database} db
 * @param {() => number} now
 * @param {R2Bucket} [docs]
 */
async function purgeForms(db, now, docs) {
  const at = now();
  // Cada dispositivo pregunta cada minuto: con limpiar como mucho cada 10 minutos basta (lo caducado no se puede
  // abrir de todos modos, publicForm lo mira).
  if (Math.abs(at - lastFormsPurge) < PURGE_EVERY_MS) return;
  lastFormsPurge = at;
  await db
    .prepare("DELETE FROM patient_forms WHERE ((answered_at IS NULL OR response IS NULL) AND expires_at < ?) OR (answered_at IS NOT NULL AND answered_at < ?)")
    .bind(new Date(at).toISOString(), new Date(at - KEEP_ANSWERS_DAYS * 86_400_000).toISOString())
    .run();
  // Una tanda cada vez: si quedan más, se borran en la pasada siguiente.
  const { results = [] } = await db
    .prepare("SELECT clinic_id, id FROM documents WHERE form_id IS NOT NULL AND form_id NOT IN (SELECT id FROM patient_forms) LIMIT ?")
    .bind(DOC_PURGE_BATCH)
    .all();
  await forgetDocs(db, docs, results.map((r) => ({ clinicId: String(r.clinic_id), id: String(r.id) })));
  await db.prepare("DELETE FROM doc_requests WHERE form_id NOT IN (SELECT id FROM patient_forms)").run();
}

/**
 * El equipo deja un formulario, recoge las respuestas o lo borra.
 * @param {Request} request
 * @param {D1Database} db
 * @param {R2Bucket | undefined} docs
 * @param {string} clinicId
 * @param {string | null} formId
 * @param {{ email: string }} who
 * @param {() => number} now
 */
export async function clinicForms(request, db, docs, clinicId, formId, who, now) {
  if (formId) {
    // Recogido: se borra lo cifrado, pero se recuerda que se respondió (si el paciente vuelve a abrir el enlace, lo ve).
    // Anulado sin responder: se borra entero. Los documentos que subió y la clínica no ha guardado, fuera.
    const { results = [] } = await db.prepare("SELECT id FROM documents WHERE clinic_id = ? AND form_id = ?").bind(clinicId, formId).all();
    await forgetDocs(db, docs, results.map((r) => ({ clinicId, id: String(r.id) })));
    await db.batch([
      db.prepare("UPDATE patient_forms SET request = '', response = NULL WHERE clinic_id = ? AND id = ? AND answered_at IS NOT NULL").bind(clinicId, formId),
      db.prepare("DELETE FROM patient_forms WHERE clinic_id = ? AND id = ? AND answered_at IS NULL").bind(clinicId, formId),
      db.prepare("DELETE FROM doc_requests WHERE form_id = ?").bind(formId),
    ]);
    return new Response(null, { status: 204 });
  }
  await purgeForms(db, now, docs);
  if (request.method === "GET") {
    const { results = [] } = await db
      .prepare("SELECT id, response, answered_at FROM patient_forms WHERE clinic_id = ? AND response IS NOT NULL ORDER BY answered_at LIMIT 50")
      .bind(clinicId)
      .all();
    return json(200, { forms: results.map((r) => ({ id: String(r.id), response: String(r.response), answeredAt: String(r.answered_at) })) });
  }
  const body = await readBigJson(request, MAX_FORM_CHARS);
  const id = typeof body.id === "string" ? body.id : "";
  if (!FORM_ID.test(id)) throw new HttpError(400, "El formulario no tiene un id válido.");
  if (!isBase64(body.request, MAX_FORM_CHARS)) throw new HttpError(400, "Falta el formulario cifrado, o es demasiado grande.");
  const expires = typeof body.expiresAt === "string" ? Date.parse(body.expiresAt) : NaN;
  if (!(expires > now() && expires <= now() + MAX_FORM_DAYS * 86_400_000)) throw new HttpError(400, `El enlace tiene que caducar en ${MAX_FORM_DAYS} días como mucho.`);
  // Si pide documentos al paciente, cuántos como mucho (y solo si el servidor tiene dónde guardarlos).
  const maxDocs = body.maxDocs === undefined ? 0 : Number(body.maxDocs);
  if (!Number.isInteger(maxDocs) || maxDocs < 0 || maxDocs > MAX_DOCS_PER_FORM) throw new HttpError(400, `Un enlace puede pedir ${MAX_DOCS_PER_FORM} documentos como mucho.`);
  if (maxDocs && !docs) throw noDocs();
  const open = await db.prepare("SELECT COUNT(*) AS n FROM patient_forms WHERE clinic_id = ? AND (answered_at IS NULL OR response IS NOT NULL)").bind(clinicId).first();
  if (Number(open?.n) >= MAX_OPEN_FORMS) throw new HttpError(429, "La clínica tiene demasiados formularios sin recoger. Abre la app para recoger las respuestas.");
  // Comprobar y guardar en una sola orden: si dos dispositivos mandan el mismo formulario a la vez, el segundo
  // recibe 409 (no un error interno).
  const { meta } = await db
    .prepare("INSERT INTO patient_forms (id, clinic_id, created_by, created_at, expires_at, request) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING")
    .bind(id, clinicId, normalEmail(who.email), new Date(now()).toISOString(), new Date(expires).toISOString(), body.request)
    .run();
  if (!meta?.changes) throw new HttpError(409, "Ese formulario ya existe.");
  if (maxDocs) await db.prepare("INSERT OR REPLACE INTO doc_requests (form_id, max_docs) VALUES (?, ?)").bind(id, maxDocs).run();
  return json(201, { id });
}

/**
 * El paciente abre su formulario (GET) o manda sus respuestas (POST …/respuesta), sin sesión: el id largo y al azar
 * hace de llave, y lo que hay dentro solo se lee con la clave del enlace.
 * @param {Request} request
 * @param {D1Database} db
 * @param {string} id
 * @param {boolean} answer
 * @param {() => number} now
 */
export async function publicForm(request, db, id, answer, now) {
  if (request.method !== (answer ? "POST" : "GET")) throw notFound();
  // Sin limpiar aquí: lo hace el equipo al recoger (una petición sin sesión no debe poder hacer trabajar a la base).
  const gone = () => new HttpError(404, "Este enlace ya no vale: ha caducado o la clínica lo ha anulado. Pide otro a tu fisioterapeuta.");
  const row = await db.prepare("SELECT clinic_id, expires_at, request, answered_at FROM patient_forms WHERE id = ?").bind(id).first();
  if (!row || (row.answered_at === null && Date.parse(String(row.expires_at)) < now())) throw gone();
  const status = await clinicStatus(db, String(row.clinic_id));
  if (status?.deletedAt) throw gone();
  if (!answer) return json(200, { request: String(row.request), expiresAt: String(row.expires_at), answered: row.answered_at !== null });
  if (row.answered_at !== null) throw new HttpError(409, "Este formulario ya se envió. Si quieres cambiar algo, díselo a tu fisioterapeuta.");
  if (Date.parse(String(row.expires_at)) < now()) throw gone();
  if (status?.suspendedAt) throw new HttpError(423, "Ahora mismo la clínica no puede recibir formularios. Inténtalo más tarde o díselo a tu fisioterapeuta.");
  const body = await readBigJson(request, MAX_ANSWER_CHARS);
  if (!isBase64(body.response, MAX_ANSWER_CHARS)) throw new HttpError(400, "Faltan las respuestas, o son demasiado largas.");
  const { meta } = await db
    .prepare("UPDATE patient_forms SET response = ?, answered_at = ? WHERE id = ? AND answered_at IS NULL")
    .bind(body.response, new Date(now()).toISOString(), id)
    .run();
  if (!meta?.changes) throw new HttpError(409, "Este formulario ya se envió. Si quieres cambiar algo, díselo a tu fisioterapeuta.");
  return json(200, { ok: true });
}
