// @ts-check
// Servidor de datos de Cénit en Cloudflare (Workers + D1). Guarda la copia CIFRADA de la base de cada
// fisioterapeuta; Google solo sirve para saber quién es. Cómo instalarlo: README.md de esta carpeta.
//
// La copia viaja y se guarda como texto base64 (la app la codifica y la decodifica): así el servidor nunca
// convierte bytes, que en D1 cuesta mucho tiempo de proceso.
//
// Se pega tal cual en el editor del panel de Cloudflare: JavaScript sin dependencias ni compilación.
//
// Rutas:
//   OPTIONS *              permiso CORS para la app (preflight)
//   GET    /v1/salud       { ok: true } sin sesión: para comprobar la instalación
//   GET    /v1/copia/info  { version, size, updatedAt }; size, en bytes aproximados
//                          (si aún no hay copia: { version: null, size: 0, updatedAt: null })
//   GET    /v1/copia       la copia en base64 (text/plain), con ETag: "<versión>" (404 si no hay)
//   PUT    /v1/copia       guarda una copia en base64: If-None-Match: * (crear) o If-Match: <versión> (sustituir)
//   DELETE /v1/copia       borra la copia (204, también si no había)
//
// Enlace a la base D1: DB. Variables: GOOGLE_CLIENT_ID, ALLOWED_EMAILS, ALLOWED_ORIGINS.
// Nunca se escribe en el registro el contenido de una petición ni el token.

/**
 * @typedef {object} D1Result
 * @property {Record<string, unknown>[]} [results]
 * @property {{ changes?: number }} [meta]
 */
/**
 * @typedef {{
 *   bind(...values: unknown[]): D1Statement,
 *   run(): Promise<D1Result>,
 *   all(): Promise<D1Result>,
 *   first(): Promise<Record<string, unknown> | null>,
 * }} D1Statement
 */
/** @typedef {{ prepare(sql: string): D1Statement, batch(statements: D1Statement[]): Promise<D1Result[]> }} D1Database */
/**
 * @typedef {object} Env
 * @property {D1Database} DB
 * @property {string} [GOOGLE_CLIENT_ID] el ID de cliente de Google de la app
 * @property {string} [ALLOWED_EMAILS] correos que pueden entrar, separados por comas o espacios (vacío: nadie)
 * @property {string} [ALLOWED_ORIGINS] direcciones de la app, separadas por comas
 */
/**
 * Quién ha entrado. `expiresIn`: segundos que le quedan al token (para no guardarlo más tiempo).
 * @typedef {{ sub: string, email: string, expiresIn?: number }} Identity
 */
/**
 * Lo que las pruebas pueden cambiar. `verifyToken` rechaza si el token no vale (401); por defecto pregunta a Google.
 * @typedef {object} Deps
 * @property {(token: string, env: Env) => Promise<Identity>} [verifyToken]
 * @property {() => number} [now] milisegundos, como Date.now
 */
/**
 * La copia vigente de una cuenta. `chars`: caracteres de su texto base64 (la columna `size`).
 * @typedef {{ version: string, parts: number, chars: number, updatedAt: string }} Head
 */

/** Las copias cifradas por la app (src/cloud/crypt.ts) empiezan por «CENITENC1»: en base64, así. */
const MAGIC = "Q0VOSVRFTkMx";
/** Caracteres por trozo (1 MB, todo ASCII): D1 no admite filas de más de 2 MB. */
const PART_CHARS = 1_000_000;
/** Tamaño máximo de una copia: 50 MB, en caracteres de base64. */
const MAX_CHARS = Math.ceil((50 * 1024 * 1024) / 3) * 4;
/** Trozos por viaje a D1, al escribir y al leer. */
const PARTS_PER_TRIP = 4;
/** Tokens comprobados que se recuerdan, y durante cuánto como mucho (segundos). */
const CACHE_ENTRIES = 200;
const CACHE_SECONDS = 300;

class HttpError extends Error {
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

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @param {unknown} _ctx
   */
  fetch(request, env, _ctx) {
    return handle(request, env);
  },
};

/**
 * Atiende una petición. Las pruebas pasan `deps` para no llamar a Google.
 * @param {Request} request
 * @param {Env} env
 * @param {Deps} [deps]
 * @returns {Promise<Response>}
 */
export async function handle(request, env, deps = {}) {
  const now = deps.now ?? Date.now;
  const verifyToken = deps.verifyToken ?? verifyGoogleToken;
  const cors = corsHeaders(request, env);
  /** @type {Response} */
  let response;
  try {
    response = await route(request, env, { verifyToken, now }, cors !== null);
  } catch (err) {
    if (err instanceof HttpError) {
      response = json(err.status, { error: err.message, ...err.extra });
    } else {
      // Solo el tipo y el mensaje del error: nunca el contenido de la petición ni el token.
      console.error("Error interno:", err instanceof Error ? `${err.name}: ${err.message.slice(0, 200)}` : "desconocido");
      response = json(500, { error: "Error interno del servidor. Inténtalo de nuevo en unos minutos." });
    }
  }
  response.headers.set("Cache-Control", "no-store");
  if (cors) for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
  return response;
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {{ verifyToken: NonNullable<Deps["verifyToken"]>, now: () => number }} deps
 * @param {boolean} originAllowed
 * @returns {Promise<Response>}
 */
async function route(request, env, deps, originAllowed) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  const method = request.method;

  if (method === "OPTIONS") {
    if (!originAllowed) throw new HttpError(403, "Esta dirección no tiene permiso para usar el servidor (ALLOWED_ORIGINS).");
    return new Response(null, { status: 204 });
  }
  if (path === "/v1/salud" && method === "GET") return health(env);

  const copyRoute = path === "/v1/copia" && ["GET", "PUT", "DELETE"].includes(method);
  const infoRoute = path === "/v1/copia/info" && method === "GET";
  if (!copyRoute && !infoRoute) throw new HttpError(404, "Esta dirección no existe.");

  const { sub } = await authenticate(request, env, deps);
  if (!env.DB) throw new HttpError(500, "Falta el enlace «DB» con la base de datos D1.");
  const db = env.DB;

  if (infoRoute) {
    const head = await getHead(db, sub);
    return json(200, head ? { version: head.version, size: approxBytes(head.chars), updatedAt: head.updatedAt } : { version: null, size: 0, updatedAt: null });
  }
  if (method === "GET") {
    const copy = await readCopy(db, sub);
    if (!copy) throw new HttpError(404, "Aún no hay ninguna copia guardada.");
    return new Response(copy.text, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", ETag: `"${copy.head.version}"` },
    });
  }
  if (method === "PUT") return writeCopy(request, db, sub, deps.now);

  // DELETE: la copia vigente y cualquier trozo que quede de esta cuenta.
  await db.batch([
    db.prepare("DELETE FROM heads WHERE owner = ?").bind(sub),
    db.prepare("DELETE FROM parts WHERE owner = ?").bind(sub),
  ]);
  return new Response(null, { status: 204 });
}

// ---------- Comprobación de la instalación ----------

/** @param {Env} env */
async function health(env) {
  const problems = [];
  if (!env.DB) {
    problems.push("Falta el enlace «DB» con la base de datos D1 (Settings → Bindings).");
  } else {
    try {
      await env.DB.batch([env.DB.prepare("SELECT 1 FROM heads LIMIT 0"), env.DB.prepare("SELECT 1 FROM parts LIMIT 0")]);
    } catch {
      problems.push("La base de datos no tiene las tablas: ejecuta schema.sql en su consola.");
    }
  }
  if (!(env.GOOGLE_CLIENT_ID ?? "").trim()) problems.push("Falta la variable GOOGLE_CLIENT_ID.");
  if (!list(env.ALLOWED_EMAILS).length) problems.push("Falta la variable ALLOWED_EMAILS: sin correos no puede entrar nadie.");
  if (!list(env.ALLOWED_ORIGINS).length) problems.push("Falta la variable ALLOWED_ORIGINS: la app no podrá conectarse.");
  if (problems.length) return json(500, { ok: false, error: problems.join(" ") });
  return json(200, { ok: true });
}

// ---------- Sesión de Google ----------

/**
 * Tokens ya comprobados: SHA-256 del token → quién es y hasta cuándo vale (ms). Nunca el token en sí.
 * @type {Map<string, { sub: string, email: string, until: number }>}
 */
const tokenCache = new Map();

/**
 * Quién hace la petición: 401 sin token o con uno que no vale, 403 si su correo no está en ALLOWED_EMAILS.
 * @param {Request} request
 * @param {Env} env
 * @param {{ verifyToken: NonNullable<Deps["verifyToken"]>, now: () => number }} deps
 */
async function authenticate(request, env, deps) {
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

  // Se mira también con el token recordado: la lista manda siempre.
  const allowed = list(env.ALLOWED_EMAILS).map((e) => e.toLowerCase());
  if (!allowed.includes(who.email.trim().toLowerCase())) {
    throw new HttpError(403, "Esta cuenta de Google no tiene permiso para usar el servidor de la clínica.");
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
 * La lista de correos se mira después, en authenticate.
 * @param {string} token
 * @param {Env} env
 * @returns {Promise<Identity>}
 */
async function verifyGoogleToken(token, env) {
  const invalid = () => new HttpError(401, "La sesión de Google no es válida o ha caducado. Vuelve a entrar con tu cuenta.");
  const unavailable = () => new HttpError(503, "No se ha podido comprobar la sesión con Google. Inténtalo de nuevo en unos minutos.");
  /** @type {Response} */
  let res;
  try {
    res = await fetch("https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" + encodeURIComponent(token));
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

// ---------- La copia en D1 ----------

/**
 * @param {D1Database} db
 * @param {string} owner
 * @returns {Promise<Head | null>}
 */
async function getHead(db, owner) {
  const row = await db.prepare("SELECT version, parts, size, updated_at FROM heads WHERE owner = ?").bind(owner).first();
  if (!row) return null;
  return { version: String(row.version), parts: Number(row.parts), chars: Number(row.size), updatedAt: String(row.updated_at) };
}

/**
 * La copia vigente, o null si no hay. Si a mitad de la lectura otra subida la sustituye (faltan trozos),
 * se vuelve a empezar una vez; si sigue igual, 503 para que la app lo intente más tarde.
 * @param {D1Database} db
 * @param {string} owner
 */
async function readCopy(db, owner) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const head = await getHead(db, owner);
    if (!head) return null;
    const text = await readParts(db, owner, head);
    if (text !== null) return { head, text };
  }
  throw new HttpError(503, "La copia se está cambiando en este momento. Inténtalo de nuevo en unos segundos.");
}

/**
 * Los trozos de una versión, por orden, unidos en un solo texto; null si falta alguno.
 * @param {D1Database} db
 * @param {string} owner
 * @param {Head} head
 * @returns {Promise<string | null>}
 */
async function readParts(db, owner, head) {
  /** @type {string[]} */
  const texts = [];
  let chars = 0;
  const select = db.prepare("SELECT idx, data FROM parts WHERE owner = ? AND version = ? AND idx >= ? AND idx < ? ORDER BY idx");
  for (let from = 0; from < head.parts; from += PARTS_PER_TRIP) {
    const to = Math.min(from + PARTS_PER_TRIP, head.parts);
    const { results = [] } = await select.bind(owner, head.version, from, to).all();
    if (results.length !== to - from) return null;
    for (let i = 0; i < results.length; i++) {
      const row = /** @type {Record<string, unknown>} */ (results[i]);
      if (Number(row.idx) !== from + i || typeof row.data !== "string") return null;
      texts.push(row.data);
      chars += row.data.length;
    }
  }
  return chars === head.chars ? texts.join("") : null;
}

/**
 * Guarda una copia nueva. Los trozos van con una versión nueva y la copia vigente solo cambia al final, con una
 * escritura condicionada a la versión que dice el dispositivo: así nunca se pisa lo que subió otro.
 * @param {Request} request
 * @param {D1Database} db
 * @param {string} owner
 * @param {() => number} now
 */
async function writeCopy(request, db, owner, now) {
  const ifMatch = request.headers.get("If-Match");
  const expected = ifMatch === null ? null : parseEtag(ifMatch);
  const create = ifMatch === null && (request.headers.get("If-None-Match") ?? "").trim() === "*";
  if (expected === null && !create) {
    throw new HttpError(428, "Falta la condición de la subida: If-None-Match: * para crear la copia o If-Match con su versión para sustituirla.");
  }
  const tooBig = () => new HttpError(413, "La copia pasa de 50 MB, el máximo que guarda este servidor.");
  if (Number(request.headers.get("Content-Length")) > MAX_CHARS) throw tooBig();
  const text = await request.text();
  if (text.length > MAX_CHARS) throw tooBig();
  if (!(text.length > MAGIC.length && text.startsWith(MAGIC))) throw new HttpError(415, "Solo se guardan copias cifradas.");

  // Si la condición ya no se cumple, se dice antes de escribir nada.
  const current = await getHead(db, owner);
  if (create ? current !== null : current?.version !== expected) throw conflict(current);

  const version = crypto.randomUUID();
  const chars = text.length;
  const parts = Math.ceil(chars / PART_CHARS);
  const updatedAt = new Date(now()).toISOString();
  try {
    await insertParts(db, owner, version, text, "INSERT");
  } catch (err) {
    await deleteVersion(db, owner, version).catch(() => {});
    throw err;
  }

  const headWrite = create
    ? db
        .prepare("INSERT INTO heads (owner, version, parts, size, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner) DO NOTHING")
        .bind(owner, version, parts, chars, updatedAt)
    : db
        .prepare("UPDATE heads SET version = ?, parts = ?, size = ?, updated_at = ? WHERE owner = ? AND version = ?")
        .bind(version, parts, chars, updatedAt, owner, expected);
  const result = await headWrite.run();
  if (result.meta?.changes !== 1) {
    // Otra subida ha llegado antes: fuera los trozos de esta.
    await deleteVersion(db, owner, version);
    throw conflict(await getHead(db, owner));
  }

  // Fuera los trozos de las demás versiones (la anterior y los restos de subidas cortadas), pero solo si esta
  // sigue siendo la vigente: si otra subida ya la ha sustituido, no se toca lo suyo.
  await db
    .prepare("DELETE FROM parts WHERE owner = ? AND version <> ? AND EXISTS (SELECT 1 FROM heads WHERE owner = ? AND version = ?)")
    .bind(owner, version, owner, version)
    .run();
  // Si otra subida casi simultánea ha borrado trozos de esta, se vuelven a poner (la copia vigente nunca queda coja).
  const kept = await db.prepare("SELECT count(*) AS n FROM parts WHERE owner = ? AND version = ?").bind(owner, version).first();
  if (Number(kept?.n) !== parts) await insertParts(db, owner, version, text, "INSERT OR REPLACE");

  return json(200, { version, size: approxBytes(chars), updatedAt }, { ETag: `"${version}"` });
}

/**
 * Escribe los trozos de una versión, varios por viaje (cada viaje es una transacción).
 * @param {D1Database} db
 * @param {string} owner
 * @param {string} version
 * @param {string} text la copia en base64
 * @param {"INSERT" | "INSERT OR REPLACE"} verb
 */
async function insertParts(db, owner, version, text, verb) {
  const insert = db.prepare(`${verb} INTO parts (owner, version, idx, data) VALUES (?, ?, ?, ?)`);
  const parts = Math.ceil(text.length / PART_CHARS);
  for (let from = 0; from < parts; from += PARTS_PER_TRIP) {
    const trip = [];
    for (let i = from; i < Math.min(from + PARTS_PER_TRIP, parts); i++) {
      trip.push(insert.bind(owner, version, i, text.slice(i * PART_CHARS, (i + 1) * PART_CHARS)));
    }
    await db.batch(trip);
  }
}

/**
 * @param {D1Database} db
 * @param {string} owner
 * @param {string} version
 */
async function deleteVersion(db, owner, version) {
  await db.prepare("DELETE FROM parts WHERE owner = ? AND version = ?").bind(owner, version).run();
}

/** @param {Head | null} current */
function conflict(current) {
  return new HttpError(412, "La copia del servidor ha cambiado: hay que bajarla y juntarla antes de subir esta.", {
    version: current ? current.version : null,
  });
}

// ---------- Utilidades ----------

/**
 * Bytes (aproximados: sin descontar el relleno «=») de una copia de `chars` caracteres de base64.
 * @param {number} chars
 */
function approxBytes(chars) {
  return Math.floor((chars * 3) / 4);
}

/**
 * La versión de una cabecera If-Match, con comillas o sin ellas.
 * @param {string} value
 * @returns {string | null}
 */
function parseEtag(value) {
  const v = value.trim().replace(/^W\//, "").replace(/^"(.*)"$/, "$1").trim();
  return v === "" ? null : v;
}

/**
 * Una lista de la configuración, separada por comas o espacios.
 * @param {string | undefined} value
 */
function list(value) {
  return (value ?? "").split(/[\s,;]+/).filter(Boolean);
}

/**
 * Cabeceras CORS si la petición viene de una dirección de ALLOWED_ORIGINS; null si no.
 * @param {Request} request
 * @param {Env} env
 * @returns {Record<string, string> | null}
 */
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = list(env.ALLOWED_ORIGINS).map((o) => o.replace(/\/+$/, "").toLowerCase());
  if (!allowed.includes(origin.toLowerCase())) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, If-Match, If-None-Match",
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Expose-Headers": "ETag",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * @param {number} status
 * @param {unknown} data
 * @param {Record<string, string>} [headers]
 */
function json(status, data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
