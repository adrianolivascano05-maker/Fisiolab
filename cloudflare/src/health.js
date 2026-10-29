// @ts-check

import { SERVER_VERSION } from "./constants.js";
import { json, list } from "./util.js";

/** @typedef {import("./types.js").D1Database} D1Database */
/** @typedef {import("./types.js").Env} Env */

// ---------- Comprobación de la instalación ----------

/** @param {Env} env */
export async function health(env) {
  const problems = [];
  if (!env.DB) {
    problems.push("Falta el enlace «DB» con la base de datos D1 (Settings → Bindings).");
  } else {
    try {
      await env.DB.batch(["heads", "parts", "clinics", "members", "recovery", "creators", "clinic_status", "deltas", "delta_base", "access_requests", "patient_forms", "documents", "doc_requests"].map((t) => /** @type {D1Database} */ (env.DB).prepare(`SELECT 1 FROM ${t} LIMIT 0`)));
    } catch {
      problems.push("La base de datos no tiene las tablas: ejecuta schema.sql en su consola.");
    }
  }
  if (!(env.GOOGLE_CLIENT_ID ?? "").trim()) problems.push("Falta la variable GOOGLE_CLIENT_ID.");
  if (!list(env.ALLOWED_EMAILS).length) problems.push("Falta la variable ALLOWED_EMAILS: sin correos nadie puede crear una clínica.");
  if (!list(env.ALLOWED_ORIGINS).length) problems.push("Falta la variable ALLOWED_ORIGINS: la app no podrá conectarse.");
  if (problems.length) return json(500, { ok: false, error: problems.join(" "), version: SERVER_VERSION });
  return json(200, { ok: true, version: SERVER_VERSION });
}
