// @ts-check

import { MAX_PENDING_REQUESTS, SERVER_VERSION } from "./constants.js";
import { copyKey } from "./copy.js";
import { getHead } from "./copyStore.js";
import { deleteDocs, docKey } from "./documents.js";
import { HttpError, database, json, list, readJson } from "./util.js";

/** @typedef {import("./types.js").D1Database} D1Database */
/** @typedef {import("./types.js").Env} Env */
/** @typedef {import("./types.js").Identity} Identity */

// ---------- Clínicas y equipo ----------

/** La copia de una clínica se guarda en heads/parts con este «owner» (los de la copia personal son números). */
export const clinicOwner = (/** @type {string} */ id) => `clinic:${id}`;

/** @param {string} email */
export function normalEmail(email) {
  const e = email.trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(e)) throw new HttpError(400, "Ese correo no es válido.");
  return e;
}

/**
 * Si la cuenta puede crear clínicas (y usar la copia personal): su correo está en ALLOWED_EMAILS o el proveedor la
 * ha dado de alta desde su panel (tabla creators).
 * @param {Env} env
 * @param {D1Database} db
 * @param {{ email: string }} who
 */
export async function canCreate(env, db, who) {
  const email = who.email.trim().toLowerCase();
  if (inList(env.ALLOWED_EMAILS, email)) return true;
  return (await db.prepare("SELECT 1 AS ok FROM creators WHERE email = ?").bind(email).first()) !== null;
}

/**
 * Si el correo está en una lista de la configuración.
 * @param {string | undefined} value
 * @param {string} email
 */
export const inList = (value, email) =>
  list(value)
    .map((e) => e.toLowerCase())
    .includes(email);

/**
 * El estado de una clínica (suspendida, borrada), o null si nunca ha tenido ninguno.
 * @param {D1Database} db
 * @param {string} id
 */
export async function clinicStatus(db, id) {
  const row = await db.prepare("SELECT suspended_at, deleted_at FROM clinic_status WHERE clinic_id = ?").bind(id).first();
  return row ? { suspendedAt: row.suspended_at ? String(row.suspended_at) : null, deletedAt: row.deleted_at ? String(row.deleted_at) : null } : null;
}

/**
 * Borra para siempre las clínicas que llevan más de 30 días en la papelera.
 * @param {D1Database} db
 * @param {() => number} now
 * @param {R2Bucket} [docs]
 */
export async function purgeExpired(db, now, docs) {
  const { results = [] } = await db
    .prepare("SELECT clinic_id FROM clinic_status WHERE deleted_at IS NOT NULL AND purge_after < ?")
    .bind(new Date(now()).toISOString())
    .all();
  for (const r of results) await removeClinic(db, String(r.clinic_id), docs);
}

/**
 * Borra una clínica del todo: su copia (en D1 o en R2), su equipo, su clave de recuperación, sus documentos y su estado.
 * @param {D1Database} db
 * @param {string} id
 * @param {R2Bucket} [docs]
 */
async function removeClinic(db, id, docs) {
  const owner = clinicOwner(id);
  const { results: files = [] } = await db.prepare("SELECT id FROM documents WHERE clinic_id = ?").bind(id).all();
  const head = await getHead(db, owner);
  await deleteDocs(docs, [...files.map((r) => docKey(id, String(r.id))), ...(head?.parts === 0 ? [copyKey(owner, head.version)] : [])]);
  await db.batch([
    db.prepare("DELETE FROM documents WHERE clinic_id = ?").bind(id),
    db.prepare("DELETE FROM doc_requests WHERE form_id IN (SELECT id FROM patient_forms WHERE clinic_id = ?)").bind(id),
    db.prepare("DELETE FROM heads WHERE owner = ?").bind(owner),
    db.prepare("DELETE FROM parts WHERE owner = ?").bind(owner),
    db.prepare("DELETE FROM deltas WHERE owner = ?").bind(owner),
    db.prepare("DELETE FROM delta_base WHERE owner = ?").bind(owner),
    db.prepare("DELETE FROM members WHERE clinic_id = ?").bind(id),
    db.prepare("DELETE FROM recovery WHERE clinic_id = ?").bind(id),
    db.prepare("DELETE FROM patient_forms WHERE clinic_id = ?").bind(id),
    db.prepare("DELETE FROM clinic_status WHERE clinic_id = ?").bind(id),
    db.prepare("DELETE FROM clinics WHERE id = ?").bind(id),
  ]);
}

/**
 * El papel de un correo en una clínica, o null si no es del equipo (o la clínica no existe).
 * @param {D1Database} db
 * @param {string} id
 * @param {string} email
 * @returns {Promise<"admin" | "member" | null>}
 */
export async function roleIn(db, id, email) {
  const row = await db.prepare("SELECT role FROM members WHERE clinic_id = ? AND email = ?").bind(id, email.trim().toLowerCase()).first();
  return row ? (row.role === "admin" ? "admin" : "member") : null;
}

/**
 * Quién ha entrado: sus clínicas (las suspendidas, marcadas), las que borró y aún puede recuperar, si puede crear
 * clínicas y si gestiona el servidor.
 * @param {D1Database} db
 * @param {Env} env
 * @param {{ email: string }} who
 * @param {() => number} now
 */
export async function me(db, env, who, now) {
  await purgeExpired(db, now, env.DOCS);
  const email = who.email.trim().toLowerCase();
  const { results = [] } = await db
    .prepare(
      `SELECT c.id, c.name, m.role, s.suspended_at, s.deleted_at, s.purge_after FROM members m JOIN clinics c ON c.id = m.clinic_id
         LEFT JOIN clinic_status s ON s.clinic_id = c.id WHERE m.email = ? ORDER BY c.name COLLATE NOCASE, c.id`,
    )
    .bind(email)
    .all();
  const operator = inList(env.OPERATOR_EMAILS, email);
  const req = await db.prepare("SELECT clinic, status, created_at FROM access_requests WHERE email = ?").bind(email).first();
  const pending = operator ? await db.prepare("SELECT count(*) AS n FROM access_requests WHERE status = 'pending'").first() : null;
  return json(200, {
    email,
    canCreate: await canCreate(env, db, who),
    operator,
    request: req ? { clinic: String(req.clinic), status: String(req.status), createdAt: String(req.created_at) } : null,
    // A quien gestiona el servidor: lo que tiene pendiente en Cloudflare (la versión pegada y si hay almacén R2).
    ...(operator ? { pendingRequests: Number(pending?.n ?? 0), server: { version: SERVER_VERSION, docs: !!env.DOCS } } : {}),
    clinics: results
      .filter((r) => !r.deleted_at)
      .map((r) => ({ id: String(r.id), name: String(r.name), role: String(r.role), ...(r.suspended_at ? { suspended: true } : {}) })),
    deleted: results
      .filter((r) => r.deleted_at && r.role === "admin")
      .map((r) => ({ id: String(r.id), name: String(r.name), deletedAt: String(r.deleted_at), purgeAfter: String(r.purge_after) })),
  });
}

/**
 * Pedir permiso para dar de alta una clínica (POST) o retirar la petición (DELETE). Cualquier cuenta de Google que
 * entre puede pedirlo; lo decide el proveedor desde su panel. Una solicitud por correo; si se rechazó, no se puede
 * repetir hasta que el proveedor la borre.
 * @param {Request} request
 * @param {Env} env
 * @param {Identity} who
 * @param {() => number} now
 */
export async function accessRequest(request, env, who, now) {
  const db = database(env);
  const email = normalEmail(who.email);
  if (request.method === "DELETE") {
    await db.prepare("DELETE FROM access_requests WHERE email = ? AND status = 'pending'").bind(email).run();
    return new Response(null, { status: 204 });
  }
  if (await canCreate(env, db, who)) throw new HttpError(409, "Tu cuenta ya puede dar de alta su clínica.");
  const body = await readJson(request);
  const field = (/** @type {string} */ k, /** @type {number} */ max) => {
    const v = typeof body === "object" && body !== null && k in body ? /** @type {Record<string, unknown>} */ (body)[k] : "";
    return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
  };
  const clinic = field("clinic", 80);
  const note = field("note", 500);
  if (!clinic) throw new HttpError(400, "Escribe el nombre de la clínica.");
  const existing = await db.prepare("SELECT status FROM access_requests WHERE email = ?").bind(email).first();
  if (existing?.status === "rejected") throw new HttpError(409, "Tu solicitud no se ha aceptado. Si crees que es un error, habla con quien te ofreció la app.");
  if (!existing) {
    const pending = await db.prepare("SELECT count(*) AS n FROM access_requests WHERE status = 'pending'").first();
    if (Number(pending?.n) >= MAX_PENDING_REQUESTS) throw new HttpError(429, "Ahora mismo hay demasiadas solicitudes. Inténtalo más tarde.");
  }
  const at = new Date(now()).toISOString();
  await db
    .prepare(
      `INSERT INTO access_requests (email, clinic, note, status, created_at) VALUES (?, ?, ?, 'pending', ?)
       ON CONFLICT (email) DO UPDATE SET clinic = excluded.clinic, note = excluded.note`,
    )
    .bind(email, clinic, note, at)
    .run();
  const row = await db.prepare("SELECT created_at FROM access_requests WHERE email = ?").bind(email).first();
  return json(200, { clinic, status: "pending", createdAt: String(row?.created_at ?? at) });
}
