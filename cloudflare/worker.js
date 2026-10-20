// @ts-check
// Servidor de datos de Cénit en Cloudflare (Workers + D1). Guarda la copia CIFRADA de la base de cada clínica;
// Google solo sirve para saber quién es. Cómo instalarlo: README.md de esta carpeta.
//
// Clínicas: quien está en ALLOWED_EMAILS puede crear una clínica y queda como su administrador; el administrador
// añade a su equipo por correo (sin tocar Cloudflare). Todos los de una clínica comparten su copia, que va cifrada
// con la contraseña de la clínica: el servidor (y quien lo gestiona) solo ve nombres de clínica, correos y bytes
// ilegibles, nunca un paciente.
//
// La copia viaja y se guarda como texto base64 (la app la codifica y la decodifica): así el servidor nunca
// convierte bytes, que en D1 cuesta mucho tiempo de proceso.
//
// Se pega tal cual en el editor del panel de Cloudflare: JavaScript sin dependencias ni compilación.
//
// Rutas:
//   OPTIONS *              permiso CORS para la app (preflight)
//   GET    /v1/salud       { ok: true } sin sesión: para comprobar la instalación
//   GET    /v1/yo          { email, canCreate, clinics: [{ id, name, role }] }: las clínicas de quien entra
//   POST   /v1/clinicas    { name } → crea una clínica (solo ALLOWED_EMAILS); quien la crea, administrador
//   PATCH  /v1/clinicas/:id                    { name } → cambia el nombre (administrador)
//   DELETE /v1/clinicas/:id                    borra la clínica, su equipo y su copia (administrador)
//   GET    /v1/clinicas/:id/miembros           { members: [{ email, role, addedAt }] } (cualquiera del equipo)
//   PUT    /v1/clinicas/:id/miembros/:correo   { role: "admin" | "member" } → añade o cambia (administrador)
//   DELETE /v1/clinicas/:id/miembros/:correo   quita a alguien (administrador, o uno mismo para salir)
//   GET    /v1/clinicas/:id/copia/info         { version, size, updatedAt }; size, en bytes aproximados
//                                              (si aún no hay copia: { version: null, size: 0, updatedAt: null })
//   GET    /v1/clinicas/:id/copia              la copia en base64 (text/plain), con ETag: "<versión>" (404 si no hay)
//   PUT    /v1/clinicas/:id/copia              guarda una copia en base64: If-None-Match: * (crear) o
//                                              If-Match: <versión> (sustituir)
//   DELETE /v1/clinicas/:id/copia              borra la copia (administrador; 204, también si no había)
//   GET    /v1/clinicas/:id/recuperacion       { blob, updatedAt } (administrador): la clave de la copia cerrada con el
//                                              código de recuperación de la clínica (sin el código no sirve de nada)
//   PUT    /v1/clinicas/:id/recuperacion       { blob } → la guarda (administrador)
//   /v1/copia y /v1/copia/info                 lo mismo con la copia personal de cada cuenta de ALLOWED_EMAILS
//                                              (versiones anteriores de la app, sin clínicas)
// Una clínica tiene siempre al menos un administrador: no se puede quitar ni bajar al último.
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
 * @property {string} [ALLOWED_EMAILS] correos que pueden crear clínicas, separados por comas o espacios (vacío: nadie)
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
/** Personas como mucho en el equipo de una clínica. */
const MAX_MEMBERS = 100;
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

  // La copia personal (versiones anteriores de la app): solo las cuentas de ALLOWED_EMAILS.
  if (path === "/v1/copia" || path === "/v1/copia/info") {
    if (!copyMethod(path.slice(3), method)) throw notFound();
    const who = await authenticate(request, env, deps);
    if (!canCreate(env, who)) throw new HttpError(403, "Esta cuenta de Google no tiene permiso para usar el servidor de la clínica.");
    return copyRoute(request, database(env), who.sub, path.endsWith("/info"), deps.now);
  }

  if (path === "/v1/yo" && method === "GET") return me(database(env), env, await authenticate(request, env, deps));
  if (path === "/v1/clinicas" && method === "POST") {
    const who = await authenticate(request, env, deps);
    if (!canCreate(env, who)) throw new HttpError(403, "Tu cuenta no puede crear clínicas en este servidor: pide que te den de alta.");
    return createClinic(request, database(env), who, deps.now);
  }

  const m = /^\/v1\/clinicas\/([A-Za-z0-9-]{1,64})(\/.*)?$/.exec(path);
  if (!m) throw notFound();
  const id = /** @type {string} */ (m[1]);
  const rest = m[2] ?? "";
  const member = /^\/miembros\/([^/]+)$/.exec(rest);
  const known =
    (rest === "" && ["PATCH", "DELETE"].includes(method)) ||
    (rest === "/miembros" && method === "GET") ||
    (member !== null && ["PUT", "DELETE"].includes(method)) ||
    (rest === "/recuperacion" && ["GET", "PUT"].includes(method)) ||
    copyMethod(rest, method);
  if (!known) throw notFound();

  const who = await authenticate(request, env, deps);
  const db = database(env);
  // Quien no es del equipo no sabe ni si la clínica existe.
  const role = await roleIn(db, id, who.email);
  if (!role) throw new HttpError(403, "Tu cuenta no forma parte de esta clínica.");
  const admin = () => {
    if (role !== "admin") throw new HttpError(403, "Solo quien administra la clínica puede hacerlo.");
  };

  if (rest === "" && method === "PATCH") {
    admin();
    const name = clinicName(await readJson(request));
    await db.prepare("UPDATE clinics SET name = ? WHERE id = ?").bind(name, id).run();
    return json(200, { id, name, role });
  }
  if (rest === "" && method === "DELETE") {
    admin();
    const owner = clinicOwner(id);
    await db.batch([
      db.prepare("DELETE FROM heads WHERE owner = ?").bind(owner),
      db.prepare("DELETE FROM parts WHERE owner = ?").bind(owner),
      db.prepare("DELETE FROM members WHERE clinic_id = ?").bind(id),
      db.prepare("DELETE FROM recovery WHERE clinic_id = ?").bind(id),
      db.prepare("DELETE FROM clinics WHERE id = ?").bind(id),
    ]);
    return new Response(null, { status: 204 });
  }
  if (rest === "/recuperacion") {
    admin();
    if (method === "GET") {
      const row = await db.prepare("SELECT blob, updated_at FROM recovery WHERE clinic_id = ?").bind(id).first();
      return json(200, { blob: row ? String(row.blob) : null, updatedAt: row ? String(row.updated_at) : null });
    }
    const body = await readJson(request);
    const blob = typeof body === "object" && body !== null && "blob" in body && typeof body.blob === "string" ? body.blob : "";
    if (!blob || blob.length > 4000) throw new HttpError(400, "Falta la clave de recuperación.");
    const at = new Date(deps.now()).toISOString();
    await db
      .prepare("INSERT INTO recovery (clinic_id, blob, updated_at) VALUES (?, ?, ?) ON CONFLICT (clinic_id) DO UPDATE SET blob = excluded.blob, updated_at = excluded.updated_at")
      .bind(id, blob, at)
      .run();
    return json(200, { updatedAt: at });
  }
  if (rest === "/miembros") {
    const { results = [] } = await db
      .prepare("SELECT email, role, added_at FROM members WHERE clinic_id = ? ORDER BY role = 'admin' DESC, email")
      .bind(id)
      .all();
    return json(200, { members: results.map((r) => ({ email: String(r.email), role: String(r.role), addedAt: String(r.added_at) })) });
  }
  if (member) {
    let email;
    try {
      email = normalEmail(decodeURIComponent(/** @type {string} */ (member[1])));
    } catch {
      throw new HttpError(400, "Ese correo no es válido.");
    }
    if (method === "PUT") {
      admin();
      return putMember(request, db, id, email, who, deps.now);
    }
    if (email !== normalEmail(who.email)) admin();
    return removeMember(db, id, email);
  }
  // La copia de la clínica: todo el equipo la baja y la sube; borrarla, solo quien administra.
  if (method === "DELETE") admin();
  return copyRoute(request, db, clinicOwner(id), rest.endsWith("/info"), deps.now);
}

/** Las rutas de una copia: «/copia» con GET, PUT o DELETE y «/copia/info» con GET. */
const copyMethod = (/** @type {string} */ p, /** @type {string} */ method) =>
  (p === "/copia" && ["GET", "PUT", "DELETE"].includes(method)) || (p === "/copia/info" && method === "GET");

const notFound = () => new HttpError(404, "Esta dirección no existe.");

/** @param {Env} env */
function database(env) {
  if (!env.DB) throw new HttpError(500, "Falta el enlace «DB» con la base de datos D1.");
  return env.DB;
}

/**
 * Leer, guardar o borrar una copia (la de una clínica o la personal).
 * @param {Request} request
 * @param {D1Database} db
 * @param {string} owner
 * @param {boolean} info solo cuánto ocupa y su versión
 * @param {() => number} now
 */
async function copyRoute(request, db, owner, info, now) {
  if (info) {
    const head = await getHead(db, owner);
    return json(200, head ? { version: head.version, size: approxBytes(head.chars), updatedAt: head.updatedAt } : { version: null, size: 0, updatedAt: null });
  }
  if (request.method === "GET") {
    const copy = await readCopy(db, owner);
    if (!copy) throw new HttpError(404, "Aún no hay ninguna copia guardada.");
    return new Response(copy.text, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", ETag: `"${copy.head.version}"` },
    });
  }
  if (request.method === "PUT") return writeCopy(request, db, owner, now);

  // DELETE: la copia vigente y cualquier trozo que quede.
  await db.batch([db.prepare("DELETE FROM heads WHERE owner = ?").bind(owner), db.prepare("DELETE FROM parts WHERE owner = ?").bind(owner)]);
  return new Response(null, { status: 204 });
}

// ---------- Clínicas y equipo ----------

/** La copia de una clínica se guarda en heads/parts con este «owner» (los de la copia personal son números). */
const clinicOwner = (/** @type {string} */ id) => `clinic:${id}`;

/** @param {string} email */
function normalEmail(email) {
  const e = email.trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(e)) throw new HttpError(400, "Ese correo no es válido.");
  return e;
}

/**
 * Si la cuenta puede crear clínicas (y usar la copia personal): su correo está en ALLOWED_EMAILS.
 * @param {Env} env
 * @param {{ email: string }} who
 */
function canCreate(env, who) {
  return list(env.ALLOWED_EMAILS)
    .map((e) => e.toLowerCase())
    .includes(who.email.trim().toLowerCase());
}

/**
 * El papel de un correo en una clínica, o null si no es del equipo (o la clínica no existe).
 * @param {D1Database} db
 * @param {string} id
 * @param {string} email
 * @returns {Promise<"admin" | "member" | null>}
 */
async function roleIn(db, id, email) {
  const row = await db.prepare("SELECT role FROM members WHERE clinic_id = ? AND email = ?").bind(id, email.trim().toLowerCase()).first();
  return row ? (row.role === "admin" ? "admin" : "member") : null;
}

/**
 * @param {D1Database} db
 * @param {Env} env
 * @param {{ email: string }} who
 */
async function me(db, env, who) {
  const email = who.email.trim().toLowerCase();
  const { results = [] } = await db
    .prepare("SELECT c.id, c.name, m.role FROM members m JOIN clinics c ON c.id = m.clinic_id WHERE m.email = ? ORDER BY c.name COLLATE NOCASE, c.id")
    .bind(email)
    .all();
  return json(200, {
    email,
    canCreate: canCreate(env, who),
    clinics: results.map((r) => ({ id: String(r.id), name: String(r.name), role: String(r.role) })),
  });
}

/** @param {unknown} body */
function clinicName(body) {
  const name = typeof body === "object" && body !== null && "name" in body && typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 80) throw new HttpError(400, "El nombre de la clínica tiene que tener entre 1 y 80 caracteres.");
  return name;
}

/**
 * @param {Request} request
 * @param {D1Database} db
 * @param {{ email: string }} who
 * @param {() => number} now
 */
async function createClinic(request, db, who, now) {
  const name = clinicName(await readJson(request));
  const id = crypto.randomUUID();
  const email = who.email.trim().toLowerCase();
  const at = new Date(now()).toISOString();
  await db.batch([
    db.prepare("INSERT INTO clinics (id, name, created_by, created_at) VALUES (?, ?, ?, ?)").bind(id, name, email, at),
    db.prepare("INSERT INTO members (clinic_id, email, role, added_by, added_at) VALUES (?, ?, 'admin', ?, ?)").bind(id, email, email, at),
  ]);
  return json(201, { id, name, role: "admin" });
}

/**
 * Añade a alguien al equipo o le cambia el papel. Al último administrador no se le puede quitar.
 * @param {Request} request
 * @param {D1Database} db
 * @param {string} id
 * @param {string} email
 * @param {{ email: string }} who
 * @param {() => number} now
 */
async function putMember(request, db, id, email, who, now) {
  const body = await readJson(request);
  const role = typeof body === "object" && body !== null && "role" in body ? body.role : undefined;
  if (role !== "admin" && role !== "member") throw new HttpError(400, "El papel tiene que ser «admin» o «member».");
  const current = await roleIn(db, id, email);
  if (!current) {
    const row = await db.prepare("SELECT count(*) AS n FROM members WHERE clinic_id = ?").bind(id).first();
    if (Number(row?.n) >= MAX_MEMBERS) throw new HttpError(409, `El equipo ya tiene ${MAX_MEMBERS} personas, el máximo.`);
  }
  const at = new Date(now()).toISOString();
  const result = await db
    .prepare(
      `INSERT INTO members (clinic_id, email, role, added_by, added_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (clinic_id, email) DO UPDATE SET role = excluded.role
       WHERE excluded.role = 'admin' OR members.role <> 'admin'
          OR (SELECT count(*) FROM members WHERE clinic_id = excluded.clinic_id AND role = 'admin') > 1`,
    )
    .bind(id, email, role, who.email.trim().toLowerCase(), at)
    .run();
  if (current === "admin" && role === "member" && result.meta?.changes !== 1) throw lastAdmin();
  const row = await db.prepare("SELECT email, role, added_at FROM members WHERE clinic_id = ? AND email = ?").bind(id, email).first();
  return json(200, { email, role: String(row?.role), addedAt: String(row?.added_at) });
}

/**
 * @param {D1Database} db
 * @param {string} id
 * @param {string} email
 */
async function removeMember(db, id, email) {
  const current = await roleIn(db, id, email);
  if (!current) return new Response(null, { status: 204 });
  const result = await db
    .prepare(
      `DELETE FROM members WHERE clinic_id = ? AND email = ?
         AND (role <> 'admin' OR (SELECT count(*) FROM members WHERE clinic_id = ? AND role = 'admin') > 1)`,
    )
    .bind(id, email, id)
    .run();
  if (result.meta?.changes !== 1) throw lastAdmin();
  return new Response(null, { status: 204 });
}

const lastAdmin = () => new HttpError(409, "La clínica tiene que tener al menos un administrador: nombra antes a otro.");

/**
 * El cuerpo JSON de una petición (pequeño: un nombre, un papel).
 * @param {Request} request
 * @returns {Promise<unknown>}
 */
async function readJson(request) {
  if (Number(request.headers.get("Content-Length")) > 10_000) throw new HttpError(413, "La petición es demasiado grande.");
  const text = await request.text();
  if (text.length > 10_000) throw new HttpError(413, "La petición es demasiado grande.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "La petición no es JSON válido.");
  }
}

// ---------- Comprobación de la instalación ----------

/** @param {Env} env */
async function health(env) {
  const problems = [];
  if (!env.DB) {
    problems.push("Falta el enlace «DB» con la base de datos D1 (Settings → Bindings).");
  } else {
    try {
      await env.DB.batch(["heads", "parts", "clinics", "members", "recovery"].map((t) => /** @type {D1Database} */ (env.DB).prepare(`SELECT 1 FROM ${t} LIMIT 0`)));
    } catch {
      problems.push("La base de datos no tiene las tablas: ejecuta schema.sql en su consola.");
    }
  }
  if (!(env.GOOGLE_CLIENT_ID ?? "").trim()) problems.push("Falta la variable GOOGLE_CLIENT_ID.");
  if (!list(env.ALLOWED_EMAILS).length) problems.push("Falta la variable ALLOWED_EMAILS: sin correos nadie puede crear una clínica.");
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
 * Quién hace la petición: 401 sin token o con uno que no vale. Lo que puede hacer lo decide cada ruta (ALLOWED_EMAILS
 * para crear clínicas, el equipo de cada clínica para su copia).
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
function json(status, data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
