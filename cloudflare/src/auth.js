// @ts-check

import { CACHE_ENTRIES, CACHE_SECONDS } from "./constants.js";
import { HttpError } from "./util.js";

/** @typedef {import("./types.js").Env} Env */
/** @typedef {import("./types.js").Identity} Identity */
/** @typedef {import("./types.js").Deps} Deps */

// ---------- Sesión de Google ----------

/**
 * Tokens ya comprobados: SHA-256 del token → quién es y hasta cuándo vale (ms). Nunca el token en sí.
 * @type {Map<string, { sub: string, email: string, until: number }>}
 */
const tokenCache = new Map();

/**
 * Quién hace la petición: 401 sin token o con uno que no vale. Lo que puede hacer lo decide cada ruta (ALLOWED_EMAILS
 * para crear clínicas, el equipo de cada clínica para su copia).
 * @param {Request} request
 * @param {Env} env
 * @param {{ verifyToken: NonNullable<Deps["verifyToken"]>, now: () => number, fetch?: typeof fetch }} deps
 */
export async function authenticate(request, env, deps) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get("Authorization") ?? "");
  if (!match?.[1]) throw new HttpError(401, "Falta la sesión de Google. Vuelve a entrar con tu cuenta.");
  const token = match[1];
  const key = await sha256Hex(token);
  const now = deps.now();

  let who = tokenCache.get(key);
  if (who && who.until <= now) {
    tokenCache.delete(key);
    who = undefined;
  }
  /** @type {number | undefined} segundos que se recuerda un token recién comprobado */
  let expiresIn;
  if (!who) {
    /** @type {Identity} */
    let id;
    try {
      id = await deps.verifyToken(token, env);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(401, "La sesión de Google no es válida o ha caducado. Vuelve a entrar con tu cuenta.");
    }
    if (!id || typeof id.sub !== "string" || !id.sub || typeof id.email !== "string") {
      throw new HttpError(401, "La sesión de Google no es válida o ha caducado. Vuelve a entrar con tu cuenta.");
    }
    expiresIn = Math.min(Number.isFinite(id.expiresIn) ? Number(id.expiresIn) : CACHE_SECONDS, CACHE_SECONDS);
    who = { sub: id.sub, email: id.email, until: now + expiresIn * 1000 };
  }
  if (expiresIn !== undefined && expiresIn > 0) remember(key, who, now);
  return who;
}

/**
 * @param {string} key
 * @param {{ sub: string, email: string, until: number }} value
 * @param {number} now
 */
function remember(key, value, now) {
  if (tokenCache.size >= CACHE_ENTRIES) {
    for (const [k, v] of tokenCache) if (v.until <= now) tokenCache.delete(k);
    // Si siguen sin caber, fuera los más antiguos (un Map recorre en orden de llegada).
    for (const k of tokenCache.keys()) {
      if (tokenCache.size < CACHE_ENTRIES) break;
      tokenCache.delete(k);
    }
  }
  tokenCache.set(key, value);
}

/**
 * Comprueba con Google un token de acceso: que sea de esta app (GOOGLE_CLIENT_ID) y que el correo esté verificado.
 * Lo que puede hacer esa cuenta se mira después, en cada ruta.
 * @param {string} token
 * @param {Env} env
 * @returns {Promise<Identity>}
 */
export async function verifyGoogleToken(token, env) {
  const invalid = () => new HttpError(401, "La sesión de Google no es válida o ha caducado. Vuelve a entrar con tu cuenta.");
  const unavailable = () => new HttpError(503, "No se ha podido comprobar la sesión con Google. Inténtalo de nuevo en unos minutos.");
  /** @type {Response} */
  let res;
  try {
    // Si Google tarda, mejor un 503 a los 8 segundos que dejar la petición colgada.
    res = await fetch("https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" + encodeURIComponent(token), { signal: AbortSignal.timeout(8000) });
  } catch {
    throw unavailable();
  }
  if (res.status >= 500) throw unavailable();
  if (!res.ok) throw invalid();
  /** @type {Record<string, unknown>} */
  let info;
  try {
    info = await res.json();
  } catch {
    throw unavailable();
  }
  const clientId = (env.GOOGLE_CLIENT_ID ?? "").trim();
  const forThisApp = clientId !== "" && (info.aud === clientId || info.azp === clientId);
  const verified = info.email_verified === true || info.email_verified === "true";
  if (!forThisApp || !verified || typeof info.sub !== "string" || !info.sub || typeof info.email !== "string") throw invalid();
  const expiresIn = Number(info.expires_in);
  return { sub: info.sub, email: info.email, expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined };
}

/** @param {string} text */
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
