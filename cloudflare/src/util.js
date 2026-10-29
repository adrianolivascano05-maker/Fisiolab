// @ts-check

/** @typedef {import("./types.js").Env} Env */

// ---------- Utilidades ----------

export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {Record<string, unknown>} [extra] más campos para la respuesta
   */
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const notFound = () => new HttpError(404, "Esta dirección no existe.");

/** @param {Env} env */
export function database(env) {
  if (!env.DB) throw new HttpError(500, "Falta el enlace «DB» con la base de datos D1.");
  return env.DB;
}

/**
 * El cuerpo JSON de una petición (pequeño: un nombre, un papel).
 * @param {Request} request
 * @returns {Promise<unknown>}
 */
export async function readJson(request) {
  if (Number(request.headers.get("Content-Length")) > 10_000) throw new HttpError(413, "La petición es demasiado grande.");
  const text = await request.text();
  if (text.length > 10_000) throw new HttpError(413, "La petición es demasiado grande.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "La petición no es JSON válido.");
  }
}

/**
 * El cuerpo JSON de una petición, hasta `max` caracteres.
 * @param {Request} request
 * @param {number} max
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readBigJson(request, max) {
  const tooBig = () => new HttpError(413, "La petición es demasiado grande.");
  if (Number(request.headers.get("Content-Length")) > max + 1000) throw tooBig();
  const text = await request.text();
  if (text.length > max + 1000) throw tooBig();
  try {
    const body = JSON.parse(text);
    if (typeof body === "object" && body !== null) return body;
  } catch {
    /* abajo */
  }
  throw new HttpError(400, "La petición no es JSON válido.");
}

/**
 * Los bytes de una petición, de `max` como mucho: se leen por trozos y se corta en cuanto pasa, aunque no diga cuánto
 * ocupa.
 * @param {Request} request
 * @param {number} max
 * @param {() => HttpError} tooBig
 */
export async function readBytes(request, max, tooBig) {
  if (Number(request.headers.get("Content-Length")) > max) throw tooBig();
  /** @type {Uint8Array[]} */
  const chunks = [];
  let size = 0;
  const reader = request.body?.getReader();
  for (;;) {
    const part = reader ? await reader.read() : { done: true, value: undefined };
    if (part.done || !part.value) break;
    size += part.value.byteLength;
    if (size > max) {
      await reader?.cancel();
      throw tooBig();
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return bytes;
}

/** Texto base64 (lo cifrado), de 1 a `max` caracteres. */
export const isBase64 = (/** @type {unknown} */ v, /** @type {number} */ max) => typeof v === "string" && v.length > 0 && v.length <= max && /^[A-Za-z0-9+/]+={0,2}$/.test(v);

/**
 * Bytes (aproximados: sin descontar el relleno «=») de una copia de `chars` caracteres de base64.
 * @param {number} chars
 */
export function approxBytes(chars) {
  return Math.floor((chars * 3) / 4);
}

/**
 * La versión de una cabecera If-Match, con comillas o sin ellas.
 * @param {string} value
 * @returns {string | null}
 */
export function parseEtag(value) {
  const v = value.trim().replace(/^W\//, "").replace(/^"(.*)"$/, "$1").trim();
  return v === "" ? null : v;
}

/**
 * Una lista de la configuración, separada por comas o espacios.
 * @param {string | undefined} value
 */
export function list(value) {
  return (value ?? "").split(/[\s,;]+/).filter(Boolean);
}

/**
 * Cabeceras CORS si la petición viene de una dirección de ALLOWED_ORIGINS; null si no.
 * @param {Request} request
 * @param {Env} env
 * @returns {Record<string, string> | null}
 */
export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = list(env.ALLOWED_ORIGINS).map((o) => o.replace(/\/+$/, "").toLowerCase());
  if (!allowed.includes(origin.toLowerCase())) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, If-Match, If-None-Match",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Expose-Headers": "ETag",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * @param {number} status
 * @param {unknown} data
 * @param {Record<string, string>} [headers]
 */
export function json(status, data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
