// @ts-check

// ---------- Tope de peticiones por dirección IP ----------
//
// Lo que se abre sin sesión (los formularios de los pacientes y /v1/salud) y las sesiones de Google que no valen
// llevan un tope por IP y por minuto. Se cuenta en la memoria de cada copia del servidor que tenga Cloudflare en
// marcha (no es un contador global): frena a quien repite peticiones sin parar desde una dirección, ahorra las
// consultas a la base y a Google, y no necesita nada que configurar. Lo que no puede hacer es evitar que esas
// peticiones cuenten en el límite diario del plan gratuito: para eso hace falta una regla de límite de Cloudflare
// delante del servidor, con un dominio propio (docs/pasos-pendientes.md).

import { HttpError } from "./util.js";

/** Peticiones sin sesión por IP y minuto. Un paciente que rellena un formulario y sube 10 archivos hace unas 15. */
export const PUBLIC_PER_MINUTE = 60;
/** Sesiones de Google que no valen, por IP y minuto, antes de dejar de preguntar a Google. */
export const BAD_TOKENS_PER_MINUTE = 10;
/** Direcciones recordadas como mucho (la memoria de cada copia del servidor es pequeña). */
const MAX_KEYS = 5000;

/** @type {Map<string, { start: number, n: number }>} */
const windows = new Map();

/** La IP de quien llama, según Cloudflare. Sin ella (las pruebas), una sola clave. */
export const clientIp = (/** @type {Request} */ request) => request.headers.get("CF-Connecting-IP") ?? "local";

/**
 * Cuenta una petición de `kind` desde `ip` y lanza 429 si pasa de `limit` en el último minuto.
 * @param {string} kind
 * @param {string} ip
 * @param {number} limit
 * @param {number} now ms
 */
export function hit(kind, ip, limit, now) {
  const key = `${kind}|${ip}`;
  let w = windows.get(key);
  if (!w || now - w.start >= 60_000) {
    if (!w && windows.size >= MAX_KEYS) {
      for (const [k, v] of windows) if (now - v.start >= 60_000) windows.delete(k);
      for (const k of windows.keys()) {
        if (windows.size < MAX_KEYS) break;
        windows.delete(k);
      }
    }
    w = { start: now, n: 0 };
    windows.set(key, w);
  }
  w.n += 1;
  if (w.n > limit) throw new HttpError(429, "Demasiadas peticiones seguidas desde esta conexión. Espera un minuto y vuelve a intentarlo.");
}

/** Sin pasar el tope: ¿ya está bloqueada esta IP para `kind`? (para no gastar otra consulta a Google). */
export function blocked(/** @type {string} */ kind, /** @type {string} */ ip, /** @type {number} */ limit, /** @type {number} */ now) {
  const w = windows.get(`${kind}|${ip}`);
  return !!w && now - w.start < 60_000 && w.n >= limit;
}

/** Solo para las pruebas: empezar de cero. */
export function resetRateLimits() {
  windows.clear();
}
