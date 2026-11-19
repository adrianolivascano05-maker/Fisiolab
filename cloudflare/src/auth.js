// @ts-check

import { CACHE_ENTRIES, CACHE_SECONDS } from "./constants.js";
import { HttpError } from "./util.js";
import { ACCOUNT_PER_MINUTE, BAD_TOKENS_PER_MINUTE, blocked, clientIp, hit } from "./ratelimit.js";

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
    // Quien manda sesiones falsas sin parar desde una IP: al pasar el tope ya no se pregunta a Google (429).
    const ip = clientIp(request);
    if (blocked("token", ip, BAD_TOKENS_PER_MINUTE, now)) hit("token", ip, BAD_TOKENS_PER_MINUTE, now);
    const bad = () => {
      hit("token", ip, BAD_TOKENS_PER_MINUTE, now);
      return new HttpError(401, "La sesión de Google no es válida o ha caducado. Vuelve a entrar con tu cuenta.");
    };
    /** @type {Identity} */
    let id;
    try {
      id = await deps.verifyToken(token, env);
    } catch (err) {
      if (err instanceof HttpError && err.status !== 401) throw err;
      throw bad();
    }
    if (!id || typeof id.sub !== "string" || !id.sub || typeof id.email !== "string") throw bad();
    expiresIn = Math.min(Number.isFinite(id.expiresIn) ? Number(id.expiresIn) : CACHE_SECONDS, CACHE_SECONDS);
    who = { sub: id.sub, email: id.email, until: now + expiresIn * 1000 };
  }
  if (expiresIn !== undefined && expiresIn > 0) remember(key, who, now);
  // Una sesión que hace peticiones sin parar (una app rota o una sesión robada) no se come las consultas de los demás.
  hit("account", who.sub, ACCOUNT_PER_MINUTE, now);
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
 * Hasta este día se aceptan también los tokens de acceso de Google (los que mandaba la app hasta noviembre de 2026),
 * para que nadie se quede fuera mientras su app se actualiza sola. Después, solo el token de identidad.
 */
export const ACCESS_TOKENS_UNTIL = Date.parse("2027-01-15T00:00:00Z");

/**
 * Comprueba la sesión de Google: que sea de esta app (GOOGLE_CLIENT_ID, exacto) y que el correo esté verificado. Lo
 * que puede hacer esa cuenta se mira después, en cada ruta.
 *
 * Lo normal es un token de identidad de Google (un JWT firmado por Google, que la app pide con un «nonce» suyo): se
 * comprueba aquí mismo la firma con las claves públicas de Google, quién lo emite, para qué app es (aud) y que no
 * haya caducado, sin preguntar a Google por cada sesión. Mientras dure el paso (ACCESS_TOKENS_UNTIL), un token de
 * acceso se comprueba como antes, con Google, pero solo si es de esta app (aud, no azp).
 * @param {string} token
 * @param {Env} env
 * @returns {Promise<Identity>}
 */
export async function verifyGoogleToken(token, env) {
  const clientId = (env.GOOGLE_CLIENT_ID ?? "").trim();
  if (!clientId) throw invalidSession();
  if (looksLikeJwt(token)) return verifyIdToken(token, clientId, Date.now());
  if (Date.now() >= ACCESS_TOKENS_UNTIL) throw invalidSession();
  return verifyAccessToken(token, clientId);
}

/** Tres partes y la primera es una cabecera JSON: un JWT (un token de acceso de Google nunca lo es). */
function looksLikeJwt(/** @type {string} */ token) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    return typeof JSON.parse(new TextDecoder().decode(b64url(/** @type {string} */ (parts[0])))) === "object";
  } catch {
    return false;
  }
}

const invalidSession = () => new HttpError(401, "La sesión de Google no es válida o ha caducado. Vuelve a entrar con tu cuenta.");
const googleUnavailable = () => new HttpError(503, "No se ha podido comprobar la sesión con Google. Inténtalo de nuevo en unos minutos.");

/**
 * Pregunta a Google por un token de acceso (el paso de transición).
 * @param {string} token
 * @param {string} clientId
 * @returns {Promise<Identity>}
 */
async function verifyAccessToken(token, clientId) {
  /** @type {Response} */
  let res;
  try {
    // Si Google tarda, mejor un 503 a los 8 segundos que dejar la petición colgada.
    res = await fetch("https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" + encodeURIComponent(token), { signal: AbortSignal.timeout(8000) });
  } catch {
    throw googleUnavailable();
  }
  if (res.status >= 500) throw googleUnavailable();
  if (!res.ok) throw invalidSession();
  /** @type {Record<string, unknown>} */
  let info;
  try {
    info = await res.json();
  } catch {
    throw googleUnavailable();
  }
  // Solo «aud»: un token pedido por otra app («azp» de esta) no vale.
  const verified = info.email_verified === true || info.email_verified === "true";
  if (info.aud !== clientId || !verified || typeof info.sub !== "string" || !info.sub || typeof info.email !== "string") throw invalidSession();
  const expiresIn = Number(info.expires_in);
  return { sub: info.sub, email: info.email, expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined };
}

// ---------- Token de identidad (JWT de Google) ----------

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
/** Margen para relojes un poco desajustados. */
const SKEW_SECONDS = 60;

/** Las claves públicas de Google, por «kid», y hasta cuándo valen (ms). Se piden otra vez al caducar o si llega un kid nuevo. */
let jwks = { keys: /** @type {Map<string, CryptoKey>} */ (new Map()), until: 0, fetchedAt: 0 };

/** Solo para las pruebas. */
export function resetGoogleKeys() {
  jwks = { keys: new Map(), until: 0, fetchedAt: 0 };
}

/**
 * @param {string} part
 * @returns {Uint8Array<ArrayBuffer>}
 */
function b64url(part) {
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((part.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * @param {string} kid
 * @param {number} now ms
 * @returns {Promise<CryptoKey | undefined>}
 */
async function googleKey(kid, now) {
  const fresh = jwks.until > now;
  if (fresh && jwks.keys.has(kid)) return jwks.keys.get(kid);
  // Un kid que no está: Google ha cambiado sus claves. Se vuelve a pedir, pero como mucho una vez por minuto (que
  // tokens con kids inventados no hagan preguntar a Google sin parar).
  if (fresh && now - jwks.fetchedAt < 60_000) return undefined;
  /** @type {Response} */
  let res;
  try {
    res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw googleUnavailable();
  }
  if (!res.ok) throw googleUnavailable();
  /** @type {{ keys?: JsonWebKey[] }} */
  let body;
  try {
    body = await res.json();
  } catch {
    throw googleUnavailable();
  }
  /** @type {Map<string, CryptoKey>} */
  const keys = new Map();
  for (const k of body.keys ?? []) {
    const id = /** @type {{ kid?: unknown }} */ (k).kid;
    if (k.kty !== "RSA" || typeof id !== "string") continue;
    try {
      keys.set(id, await crypto.subtle.importKey("jwk", { kty: "RSA", n: k.n, e: k.e }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
    } catch {
      /* una clave rara: fuera */
    }
  }
  if (!keys.size) throw googleUnavailable();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("Cache-Control") ?? "")?.[1] ?? 3600);
  jwks = { keys, until: now + Math.min(Math.max(maxAge, 60), 86_400) * 1000, fetchedAt: now };
  return keys.get(kid);
}

/**
 * @param {string} token
 * @param {string} clientId
 * @param {number} now ms
 * @returns {Promise<Identity>}
 */
async function verifyIdToken(token, clientId, now) {
  const [h, p, s] = /** @type {[string, string, string]} */ (token.split("."));
  /** @type {Record<string, unknown>} */
  let header;
  /** @type {Record<string, unknown>} */
  let claims;
  /** @type {Uint8Array<ArrayBuffer>} */
  let signature;
  try {
    header = JSON.parse(new TextDecoder().decode(b64url(h)));
    claims = JSON.parse(new TextDecoder().decode(b64url(p)));
    signature = b64url(s);
  } catch {
    throw invalidSession();
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw invalidSession();
  const key = await googleKey(header.kid, now);
  if (!key) throw invalidSession();
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw invalidSession();
  const t = Math.floor(now / 1000);
  const exp = Number(claims.exp);
  const verified = claims.email_verified === true || claims.email_verified === "true";
  if (
    !ISSUERS.includes(/** @type {string} */ (claims.iss)) ||
    claims.aud !== clientId ||
    !Number.isFinite(exp) ||
    exp + SKEW_SECONDS <= t ||
    Number(claims.iat) > t + SKEW_SECONDS ||
    !verified ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    typeof claims.email !== "string"
  )
    throw invalidSession();
  return { sub: claims.sub, email: claims.email, expiresIn: Math.max(exp - t, 0) };
}

/** @param {string} text */
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
