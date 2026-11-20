// @ts-check

// ---------- Actividad: registro técnico y rechazos ----------
//
// Cada petición deja una línea en el registro de Cloudflare (Workers Logs, si quien gestiona el servidor lo enciende)
// con lo justo para ver un ataque o un fallo: el método, la ruta con los datos cambiados por su nombre
// («/v1/formularios/:id», nunca el id real, que abre el formulario), el código de respuesta y lo que tardó (la hora la
// pone Cloudflare). Nunca la dirección completa, la IP, el correo, el token ni el contenido.
//
// Y las respuestas 401, 403 y 429 (sesiones que no valen, permisos que no hay, demasiadas peticiones) se cuentan por
// hora en la tabla «alerts», para que el panel del proveedor enseñe las de las últimas 24 horas. Cada copia del
// servidor las junta en memoria y las escribe como mucho una vez por minuto: un ataque no multiplica las escrituras.

/** Las partes fijas de las rutas; lo demás (ids, correos, versiones, números) se cambia por «:id». */
const WORDS = new Set([
  "v1",
  "salud",
  "yo",
  "solicitud",
  "clinicas",
  "miembros",
  "copia",
  "info",
  "cambios",
  "subida",
  "fin",
  "recuperacion",
  "recuperar",
  "proveedor",
  "altas",
  "suspender",
  "contrato",
  "peticiones",
  "solicitudes",
  "formularios",
  "respuesta",
  "documentos",
  "guardar",
]);

/** La ruta sin datos: «/v1/clinicas/abc/formularios/xyz» → «/v1/clinicas/:id/formularios/:id». */
export function routePattern(/** @type {string} */ path) {
  return (
    path
      .replace(/\/+$/, "")
      .split("/")
      .map((s) => (s === "" || WORDS.has(s) ? s : ":id"))
      .join("/")
      .slice(0, 120) || "/"
  );
}

/**
 * La línea del registro de una petición (un JSON corto).
 * @param {string} method
 * @param {string} path
 * @param {number} status
 * @param {number} ms
 */
export function logRequest(method, path, status, ms) {
  const m = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(method) ? method : "OTRO";
  console.log(JSON.stringify({ m, r: routePattern(path), s: status, ms: Math.max(0, Math.round(ms)) }));
}

const COUNTED = [401, 403, 429];
/** Rechazos aún sin escribir: «<hora>|<código>» → cuántos. */
let pending = new Map();
let lastFlush = 0;
const FLUSH_MS = 60_000;

/** La hora en UTC, «2026-11-20T09». */
const hourOf = (/** @type {number} */ ms) => new Date(ms).toISOString().slice(0, 13);

/** Apunta un rechazo (solo 401, 403 y 429). */
export function noteStatus(/** @type {number} */ status, /** @type {number} */ now) {
  if (!COUNTED.includes(status)) return;
  const key = `${hourOf(now)}|${status}`;
  pending.set(key, (pending.get(key) ?? 0) + 1);
}

/**
 * Escribe los rechazos apuntados, como mucho una vez por minuto, y borra los de hace más de dos días. Si la tabla aún
 * no existe (falta ejecutar schema.sql) o la base falla, se pierden sin romper la petición.
 * @param {D1Database | undefined} db
 * @param {number} now
 */
export async function flushAlerts(db, now) {
  if (!db || !pending.size || now - lastFlush < FLUSH_MS) return;
  const rows = [...pending];
  pending = new Map();
  lastFlush = now;
  try {
    await db.batch([
      ...rows.map(([key, n]) => {
        const [hour, status] = key.split("|");
        return db.prepare("INSERT INTO alerts (hour, status, n) VALUES (?, ?, ?) ON CONFLICT (hour, status) DO UPDATE SET n = n + excluded.n").bind(hour, Number(status), n);
      }),
      db.prepare("DELETE FROM alerts WHERE hour < ?").bind(hourOf(now - 48 * 3_600_000)),
    ]);
  } catch {
    /* sin la tabla: se cuentan otra vez cuando exista */
  }
}

/**
 * Los rechazos de las últimas 24 horas (por código), para el panel del proveedor. Null si aún no hay tabla.
 * @param {D1Database} db
 * @param {number} now
 */
export async function recentAlerts(db, now) {
  const since = hourOf(now - 24 * 3_600_000);
  try {
    const { results = [] } = await db.prepare("SELECT status, sum(n) AS n FROM alerts WHERE hour > ? GROUP BY status").bind(since).all();
    const of = (/** @type {number} */ s) => Number(results.find((r) => Number(r.status) === s)?.n ?? 0);
    return { since: `${since}:00:00.000Z`, unauthorized: of(401), forbidden: of(403), tooMany: of(429) };
  } catch {
    return null;
  }
}

/** Solo para las pruebas. */
export function resetAlerts() {
  pending = new Map();
  lastFlush = 0;
}
