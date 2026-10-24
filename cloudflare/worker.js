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
//   POST   /v1/solicitud   { clinic, note } → pide permiso para dar de alta una clínica (cualquier cuenta de Google)
//   DELETE /v1/solicitud   retira la solicitud pendiente
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
//   Sincronización por cambios (la app nueva añade ?v=2 a las rutas de la copia; ver abajo):
//   GET    /v1/clinicas/:id/copia/info?v=2     además { epoch, base, last, deltas, deltaSize }
//   PUT    /v1/clinicas/:id/copia?v=2&seq=N    la copia entera, que ya lleva los cambios hasta N (se borran)
//   GET    /v1/clinicas/:id/copia/cambios?v=2&desde=N  { epoch, base, deltas: [{ seq, data }], more }
//   POST   /v1/clinicas/:id/copia/cambios?v=2  un lote de cambios cifrado, en base64 → { seq }
//   GET    /v1/clinicas/:id/recuperacion       { blob, updatedAt } (administrador): la clave de la copia cerrada con el
//                                              código de recuperación de la clínica (sin el código no sirve de nada)
//   PUT    /v1/clinicas/:id/recuperacion       { blob } → la guarda (administrador)
//   POST   /v1/clinicas/:id/recuperar          deshace el borrado de la clínica en los 30 días siguientes (administrador)
//   GET    /v1/proveedor                       quien gestiona el servidor (OPERATOR_EMAILS): las clínicas (nombre,
//                                              equipo, tamaño, último uso, estado), las altas y las bajas; nunca pacientes
//   PUT    /v1/proveedor/altas/:correo         da de alta a quien puede crear clínicas (además de ALLOWED_EMAILS)
//   DELETE /v1/proveedor/altas/:correo         se la quita (las clínicas que ya creó siguen)
//   POST   /v1/proveedor/clinicas/:id/suspender  { suspended } → suspende (no se sube nada; se puede bajar) o reactiva
//   POST   /v1/proveedor/clinicas/:id/recuperar  deshace el borrado de una clínica en sus 30 días
//   GET    /v1/proveedor/contrato              { html }: el borrador del contrato de encargado del tratamiento
//   POST   /v1/proveedor/solicitudes/:correo   { accept } → acepta (puede dar de alta su clínica) o rechaza una solicitud
//   DELETE /v1/proveedor/solicitudes/:correo   la borra (podrá volver a pedirlo)
//   Formularios para el paciente (anamnesis o cuestionarios que rellena desde su móvil con un enlace):
//   POST   /v1/clinicas/:id/formularios        { id, request, expiresAt } → deja el formulario cifrado (equipo)
//   GET    /v1/clinicas/:id/formularios        { forms: [{ id, response, answeredAt }] }: los ya respondidos (equipo)
//   DELETE /v1/clinicas/:id/formularios/:fid   recogido (se borran las respuestas y el formulario; queda que ya se
//                                              respondió) o anulado (se borra entero) (equipo; 204 aunque no estuviera)
//   GET    /v1/formularios/:fid                { request, expiresAt, answered } SIN sesión: lo abre el paciente
//   POST   /v1/formularios/:fid/respuesta      { response } SIN sesión: sus respuestas, cifradas, una sola vez
//   /v1/copia y /v1/copia/info                 lo mismo con la copia personal de cada cuenta de ALLOWED_EMAILS
//                                              (versiones anteriores de la app, sin clínicas)
// Una clínica tiene siempre al menos un administrador: no se puede quitar ni bajar al último.
// Borrar una clínica (DELETE /v1/clinicas/:id, con la declaración de quien la borra) la deja 30 días en la papelera:
// nadie puede usarla, pero se puede recuperar entera; después se borra para siempre (al pasar por /v1/yo o por el
// panel del proveedor). Una clínica suspendida no puede subir nada, pero sí bajar su copia.
//
// Sincronización por cambios: en vez de subir y bajar la copia entera en cada cambio, cada dispositivo sube solo lo
// que ha cambiado (un lote cifrado con número correlativo) y baja lo de los demás. La primera vez que una versión
// nueva de la app sincroniza una clínica, la pasa a este modo (sube la copia con ?v=2&seq=0); desde entonces las
// versiones anteriores de la app reciben 426 («actualiza la app») en las rutas de la copia.
//
// Enlace a la base D1: DB. Variables: GOOGLE_CLIENT_ID, ALLOWED_EMAILS, ALLOWED_ORIGINS y OPERATOR_EMAILS (quien
// gestiona el servidor: ve el panel del proveedor).
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
 * @property {string} [OPERATOR_EMAILS] correos de quien gestiona el servidor (el panel del proveedor)
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
/** Lotes de cambios por respuesta, y caracteres como mucho (se piden los siguientes con «more»). */
const DELTAS_PER_TRIP = 100;
const DELTA_TRIP_CHARS = 3_000_000;
/** Días que una clínica borrada se puede recuperar antes de borrarse para siempre. */
const DELETE_GRACE_DAYS = 30;
/** Solicitudes de acceso pendientes como mucho (para que nadie llene la base pidiendo sin parar). */
const MAX_PENDING_REQUESTS = 200;
/** Personas como mucho en el equipo de una clínica. */
const MAX_MEMBERS = 100;

// Formularios para el paciente: la app los cifra con una clave que va solo en el enlace (después de «#», que el
// navegador no manda al servidor), así que aquí no hay más que bytes ilegibles. El id lo pone la app al azar.
const FORM_ID = /^[A-Za-z0-9_-]{22,64}$/;
/** Caracteres del formulario cifrado y de las respuestas cifradas (base64). */
const MAX_FORM_CHARS = 200_000;
const MAX_ANSWER_CHARS = 400_000;
/** Un enlace vale como mucho estos días; las respuestas que nadie recoge se borran a los 60. */
const MAX_FORM_DAYS = 30;
const KEEP_ANSWERS_DAYS = 60;
/** Formularios sin recoger a la vez en una clínica. */
const MAX_OPEN_FORMS = 500;
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

  // Lo que abre el paciente con su enlace: sin sesión (no tiene cuenta), con el id del formulario.
  const pub = /^\/v1\/formularios\/([A-Za-z0-9_-]{22,64})(\/respuesta)?$/.exec(path);
  if (pub) return publicForm(request, database(env), /** @type {string} */ (pub[1]), pub[2] !== undefined, deps.now);

  // La copia personal (versiones anteriores de la app): solo las cuentas de ALLOWED_EMAILS.
  if (path === "/v1/copia" || path === "/v1/copia/info") {
    if (!copyMethod(path.slice(3), method)) throw notFound();
    const who = await authenticate(request, env, deps);
    if (!(await canCreate(env, database(env), who))) throw new HttpError(403, "Esta cuenta de Google no tiene permiso para usar el servidor de la clínica.");
    return copyRoute(request, database(env), who.sub, path.endsWith("/info"), deps.now);
  }

  if (path === "/v1/yo" && method === "GET") return me(database(env), env, await authenticate(request, env, deps), deps.now);
  if (path === "/v1/solicitud" && ["POST", "DELETE"].includes(method)) return accessRequest(request, env, await authenticate(request, env, deps), deps.now);
  if (path === "/v1/proveedor" || path.startsWith("/v1/proveedor/")) return operatorRoute(request, env, deps, path.slice("/v1/proveedor".length));
  if (path === "/v1/clinicas" && method === "POST") {
    const who = await authenticate(request, env, deps);
    if (!(await canCreate(env, database(env), who))) throw new HttpError(403, "Tu cuenta no puede crear clínicas en este servidor: pide que te den de alta.");
    return createClinic(request, database(env), who, deps.now);
  }

  const m = /^\/v1\/clinicas\/([A-Za-z0-9-]{1,64})(\/.*)?$/.exec(path);
  if (!m) throw notFound();
  const id = /** @type {string} */ (m[1]);
  const rest = m[2] ?? "";
  const member = /^\/miembros\/([^/]+)$/.exec(rest);
  const form = /^\/formularios\/([A-Za-z0-9_-]{22,64})$/.exec(rest);
  const known =
    (rest === "" && ["PATCH", "DELETE"].includes(method)) ||
    (rest === "/miembros" && method === "GET") ||
    (member !== null && ["PUT", "DELETE"].includes(method)) ||
    (rest === "/recuperacion" && ["GET", "PUT"].includes(method)) ||
    (rest === "/recuperar" && method === "POST") ||
    copyMethod(rest, method) ||
    (rest === "/copia/cambios" && ["GET", "POST"].includes(method)) ||
    (rest === "/formularios" && ["GET", "POST"].includes(method)) ||
    (form !== null && method === "DELETE");
  if (!known) throw notFound();

  const who = await authenticate(request, env, deps);
  const db = database(env);
  // Quien no es del equipo no sabe ni si la clínica existe.
  const role = await roleIn(db, id, who.email);
  if (!role) throw new HttpError(403, "Tu cuenta no forma parte de esta clínica.");
  const admin = () => {
    if (role !== "admin") throw new HttpError(403, "Solo quien administra la clínica puede hacerlo.");
  };
  const status = await clinicStatus(db, id);
  if (rest === "/recuperar") {
    admin();
    if (!status?.deletedAt) return json(200, { restored: false });
    await db.prepare("UPDATE clinic_status SET deleted_at = NULL, deleted_by = NULL, declaration = NULL, purge_after = NULL WHERE clinic_id = ?").bind(id).run();
    return json(200, { restored: true });
  }
  if (status?.deletedAt) throw new HttpError(410, "Esta clínica está borrada. Quien la administraba puede recuperarla durante 30 días.");
  // Suspendida: se puede mirar y bajar la copia (la clínica tiene que poder conservar sus historias), pero no cambiar nada.
  const writes = method !== "GET";
  if (status?.suspendedAt && writes && rest !== "") {
    throw new HttpError(423, "La clínica está suspendida: no se guardan cambios en el servidor. Habla con quien os da la app.");
  }

  if (rest === "" && method === "PATCH") {
    admin();
    const name = clinicName(await readJson(request));
    await db.prepare("UPDATE clinics SET name = ? WHERE id = ?").bind(name, id).run();
    return json(200, { id, name, role });
  }
  if (rest === "" && method === "DELETE") {
    admin();
    // A la papelera, con la declaración de quien la borra; se borra del todo a los 30 días.
    const body = await readJson(request);
    const declaration = typeof body === "object" && body !== null && "declaration" in body && typeof body.declaration === "string" ? body.declaration.trim() : "";
    if (declaration.length < 20 || declaration.length > 4000) throw new HttpError(400, "Falta la declaración de quien borra la clínica.");
    const at = new Date(deps.now());
    const purge = new Date(at.getTime() + DELETE_GRACE_DAYS * 86_400_000);
    await db
      .prepare(
        `INSERT INTO clinic_status (clinic_id, deleted_at, deleted_by, declaration, purge_after) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (clinic_id) DO UPDATE SET deleted_at = excluded.deleted_at, deleted_by = excluded.deleted_by,
           declaration = excluded.declaration, purge_after = excluded.purge_after`,
      )
      .bind(id, at.toISOString(), who.email.trim().toLowerCase(), declaration, purge.toISOString())
      .run();
    return json(200, { purgeAfter: purge.toISOString() });
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
  if (rest === "/formularios" || form) return clinicForms(request, db, id, form?.[1] ?? null, who, deps.now);
  // La copia de la clínica: todo el equipo la baja y la sube; borrarla, solo quien administra.
  if (method === "DELETE") admin();
  return clinicCopy(request, db, clinicOwner(id), rest, deps.now);
}

/**
 * @typedef {{ epoch: string, seq: number }} Base
 * La sincronización por cambios de una copia: desde qué cambio la copia entera ya lo lleva todo (seq) y su época.
 */

/**
 * @param {D1Database} db
 * @param {string} owner
 * @returns {Promise<Base | null>}
 */
async function getBase(db, owner) {
  const row = await db.prepare("SELECT epoch, seq FROM delta_base WHERE owner = ?").bind(owner).first();
  return row ? { epoch: String(row.epoch), seq: Number(row.seq) } : null;
}

const OLD_APP =
  "Esta clínica usa ya la sincronización nueva: actualiza la app en este dispositivo (ciérrala del todo y vuelve a abrirla). Lo que tengas sin subir se sube al actualizar.";

/**
 * La copia de una clínica, con la sincronización por cambios (?v=2) o como en las versiones anteriores de la app.
 * @param {Request} request
 * @param {D1Database} db
 * @param {string} owner
 * @param {string} rest «/copia», «/copia/info» o «/copia/cambios»
 * @param {() => number} now
 */
async function clinicCopy(request, db, owner, rest, now) {
  const params = new URL(request.url).searchParams;
  const v2 = params.get("v") === "2";
  const base = await getBase(db, owner);
  // Una versión anterior de la app no sabe de los cambios: si sube o baja la copia entera, se pierde lo de los demás.
  if (base && !v2) throw new HttpError(426, OLD_APP);
  if (!v2) {
    if (rest === "/copia/cambios") throw notFound();
    return copyRoute(request, db, owner, rest.endsWith("/info"), now);
  }

  if (rest === "/copia/info") {
    const head = await getHead(db, owner);
    const stats = await db.prepare("SELECT count(*) AS n, coalesce(sum(length(data)), 0) AS chars, max(seq) AS last FROM deltas WHERE owner = ?").bind(owner).first();
    return json(200, {
      version: head?.version ?? null,
      size: head ? approxBytes(head.chars) : 0,
      updatedAt: head?.updatedAt ?? null,
      epoch: base?.epoch ?? null,
      base: base?.seq ?? null,
      last: Math.max(Number(stats?.last ?? 0), base?.seq ?? 0),
      deltas: Number(stats?.n ?? 0),
      deltaSize: approxBytes(Number(stats?.chars ?? 0)),
    });
  }

  if (rest === "/copia/cambios") {
    if (!base) throw new HttpError(409, "Esta clínica aún no usa la sincronización por cambios: sube primero la copia entera.");
    if (request.method === "POST") {
      const text = await request.text();
      if (text.length > PART_CHARS) throw new HttpError(413, "El lote de cambios es demasiado grande: la app tiene que partirlo.");
      if (!(text.length > MAGIC.length && text.startsWith(MAGIC))) throw new HttpError(415, "Solo se guardan copias cifradas.");
      // El número siguiente al último que hay (o al de la copia entera, si ya se borraron los anteriores).
      const row = await db
        .prepare(
          `INSERT INTO deltas (owner, seq, data, created_at)
           VALUES (?, max(coalesce((SELECT max(seq) FROM deltas WHERE owner = ?), 0), coalesce((SELECT seq FROM delta_base WHERE owner = ?), 0)) + 1, ?, ?)
           RETURNING seq`,
        )
        .bind(owner, owner, owner, text, new Date(now()).toISOString())
        .first();
      return json(200, { seq: Number(row?.seq) });
    }
    const since = Number(params.get("desde") ?? "0");
    if (!Number.isSafeInteger(since) || since < 0) throw new HttpError(400, "«desde» tiene que ser un número.");
    // Si la copia entera ya lleva lo que pide (y lo anterior se ha borrado), tiene que bajarse la copia.
    if (since < base.seq) return json(200, { epoch: base.epoch, base: base.seq, deltas: [], more: false });
    const { results = [] } = await db
      .prepare("SELECT seq, data FROM deltas WHERE owner = ? AND seq > ? ORDER BY seq LIMIT ?")
      .bind(owner, since, DELTAS_PER_TRIP)
      .all();
    const deltas = [];
    let chars = 0;
    for (const r of results) {
      const data = String(r.data);
      if (deltas.length && chars + data.length > DELTA_TRIP_CHARS) break;
      deltas.push({ seq: Number(r.seq), data });
      chars += data.length;
    }
    return json(200, { epoch: base.epoch, base: base.seq, deltas, more: deltas.length < results.length || results.length === DELTAS_PER_TRIP });
  }

  if (request.method === "PUT") {
    const seq = Number(params.get("seq"));
    if (!params.has("seq") || !Number.isSafeInteger(seq) || seq < 0) throw new HttpError(400, "Falta «seq»: hasta qué cambio lleva esta copia.");
    const res = await writeCopy(request, db, owner, now);
    // La copia ya lleva los cambios hasta «seq»: esos sobran. La primera vez, la clínica pasa a este modo.
    await db.batch([
      db
        .prepare("INSERT INTO delta_base (owner, epoch, seq) VALUES (?, ?, ?) ON CONFLICT (owner) DO UPDATE SET seq = max(seq, excluded.seq)")
        .bind(owner, crypto.randomUUID(), seq),
      db.prepare("DELETE FROM deltas WHERE owner = ? AND seq <= (SELECT seq FROM delta_base WHERE owner = ?)").bind(owner, owner),
    ]);
    const after = await getBase(db, owner);
    const body = /** @type {Record<string, unknown>} */ (await res.json());
    return json(200, { ...body, epoch: after?.epoch ?? null, base: after?.seq ?? seq }, { ETag: res.headers.get("ETag") ?? "" });
  }
  if (request.method === "DELETE") {
    // Sin copia no hay base: la próxima subida empieza otra época, y los dispositivos vuelven a empezar.
    await db.batch([db.prepare("DELETE FROM deltas WHERE owner = ?").bind(owner), db.prepare("DELETE FROM delta_base WHERE owner = ?").bind(owner)]);
  }
  return copyRoute(request, db, owner, false, now);
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
 * Si la cuenta puede crear clínicas (y usar la copia personal): su correo está en ALLOWED_EMAILS o el proveedor la
 * ha dado de alta desde su panel (tabla creators).
 * @param {Env} env
 * @param {D1Database} db
 * @param {{ email: string }} who
 */
async function canCreate(env, db, who) {
  const email = who.email.trim().toLowerCase();
  if (inList(env.ALLOWED_EMAILS, email)) return true;
  return (await db.prepare("SELECT 1 AS ok FROM creators WHERE email = ?").bind(email).first()) !== null;
}

/**
 * Si el correo está en una lista de la configuración.
 * @param {string | undefined} value
 * @param {string} email
 */
const inList = (value, email) =>
  list(value)
    .map((e) => e.toLowerCase())
    .includes(email);

/**
 * El estado de una clínica (suspendida, borrada), o null si nunca ha tenido ninguno.
 * @param {D1Database} db
 * @param {string} id
 */
async function clinicStatus(db, id) {
  const row = await db.prepare("SELECT suspended_at, deleted_at FROM clinic_status WHERE clinic_id = ?").bind(id).first();
  return row ? { suspendedAt: row.suspended_at ? String(row.suspended_at) : null, deletedAt: row.deleted_at ? String(row.deleted_at) : null } : null;
}

/**
 * Borra para siempre las clínicas que llevan más de 30 días en la papelera.
 * @param {D1Database} db
 * @param {() => number} now
 */
async function purgeExpired(db, now) {
  const { results = [] } = await db
    .prepare("SELECT clinic_id FROM clinic_status WHERE deleted_at IS NOT NULL AND purge_after < ?")
    .bind(new Date(now()).toISOString())
    .all();
  for (const r of results) await removeClinic(db, String(r.clinic_id));
}

/**
 * Borra una clínica del todo: su copia, su equipo, su clave de recuperación y su estado.
 * @param {D1Database} db
 * @param {string} id
 */
async function removeClinic(db, id) {
  const owner = clinicOwner(id);
  await db.batch([
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
async function roleIn(db, id, email) {
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
async function me(db, env, who, now) {
  await purgeExpired(db, now);
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
    ...(operator ? { pendingRequests: Number(pending?.n ?? 0) } : {}),
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
async function accessRequest(request, env, who, now) {
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

// ---------- Panel del proveedor ----------

/**
 * Lo que ve y hace quien gestiona el servidor (OPERATOR_EMAILS). Nunca toca la copia de una clínica: solo sus datos
 * de servicio (nombre, equipo, tamaño, fechas y estado).
 * @param {Request} request
 * @param {Env} env
 * @param {{ verifyToken: NonNullable<Deps["verifyToken"]>, now: () => number }} deps
 * @param {string} rest
 */
async function operatorRoute(request, env, deps, rest) {
  const method = request.method;
  const alta = /^\/altas\/([^/]+)$/.exec(rest);
  const clinicAction = /^\/clinicas\/([A-Za-z0-9-]{1,64})\/(suspender|recuperar)$/.exec(rest);
  const answer = /^\/solicitudes\/([^/]+)$/.exec(rest);
  const known =
    (answer !== null && ["POST", "DELETE"].includes(method)) ||
    (rest === "" && method === "GET") ||
    (rest === "/contrato" && method === "GET") ||
    (alta !== null && ["PUT", "DELETE"].includes(method)) ||
    (clinicAction !== null && method === "POST");
  if (!known) throw notFound();
  const who = await authenticate(request, env, deps);
  const email = who.email.trim().toLowerCase();
  if (!inList(env.OPERATOR_EMAILS, email)) throw new HttpError(403, "Solo quien gestiona el servidor puede verlo.");
  const db = database(env);

  if (rest === "/contrato") return json(200, { html: CONTRACT_HTML });
  if (answer) {
    let target;
    try {
      target = normalEmail(decodeURIComponent(/** @type {string} */ (answer[1])));
    } catch {
      throw new HttpError(400, "Ese correo no es válido.");
    }
    if (method === "DELETE") {
      await db.prepare("DELETE FROM access_requests WHERE email = ?").bind(target).run();
      return new Response(null, { status: 204 });
    }
    const body = await readJson(request);
    const accept = typeof body === "object" && body !== null && "accept" in body && body.accept === true;
    const at = new Date(deps.now()).toISOString();
    const exists = await db.prepare("SELECT 1 AS ok FROM access_requests WHERE email = ?").bind(target).first();
    if (!exists) throw new HttpError(404, "Esa solicitud ya no está.");
    if (accept) {
      await db.batch([
        db.prepare("INSERT INTO creators (email, added_by, added_at) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING").bind(target, email, at),
        db.prepare("DELETE FROM access_requests WHERE email = ?").bind(target),
      ]);
    } else {
      await db.prepare("UPDATE access_requests SET status = 'rejected', answered_at = ? WHERE email = ?").bind(at, target).run();
    }
    return json(200, { accepted: accept });
  }
  if (alta) {
    let target;
    try {
      target = normalEmail(decodeURIComponent(/** @type {string} */ (alta[1])));
    } catch {
      throw new HttpError(400, "Ese correo no es válido.");
    }
    if (method === "PUT") {
      // Si lo había pedido, su solicitud ya está atendida.
      await db.batch([
        db.prepare("INSERT INTO creators (email, added_by, added_at) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING").bind(target, email, new Date(deps.now()).toISOString()),
        db.prepare("DELETE FROM access_requests WHERE email = ?").bind(target),
      ]);
    } else {
      await db.prepare("DELETE FROM creators WHERE email = ?").bind(target).run();
    }
    return new Response(null, { status: 204 });
  }
  if (clinicAction) {
    const id = /** @type {string} */ (clinicAction[1]);
    const exists = await db.prepare("SELECT 1 AS ok FROM clinics WHERE id = ?").bind(id).first();
    if (!exists) throw new HttpError(404, "Esa clínica no existe.");
    if (clinicAction[2] === "recuperar") {
      await db.prepare("UPDATE clinic_status SET deleted_at = NULL, deleted_by = NULL, declaration = NULL, purge_after = NULL WHERE clinic_id = ?").bind(id).run();
      return json(200, { restored: true });
    }
    const body = await readJson(request);
    const suspended = typeof body === "object" && body !== null && "suspended" in body && body.suspended === true;
    await db
      .prepare("INSERT INTO clinic_status (clinic_id, suspended_at) VALUES (?, ?) ON CONFLICT (clinic_id) DO UPDATE SET suspended_at = excluded.suspended_at")
      .bind(id, suspended ? new Date(deps.now()).toISOString() : null)
      .run();
    return json(200, { suspended });
  }

  await purgeExpired(db, deps.now);
  const { results: clinics = [] } = await db
    .prepare(
      `SELECT c.id, c.name, c.created_by, c.created_at,
              (SELECT count(*) FROM members m WHERE m.clinic_id = c.id) AS members,
              (SELECT group_concat(m.email, ', ') FROM members m WHERE m.clinic_id = c.id AND m.role = 'admin') AS admins,
              h.size + coalesce((SELECT sum(length(d.data)) FROM deltas d WHERE d.owner = h.owner), 0) AS size,
              max(h.updated_at, coalesce((SELECT max(d.created_at) FROM deltas d WHERE d.owner = h.owner), '')) AS updated_at, s.suspended_at, s.deleted_at, s.deleted_by, s.declaration, s.purge_after
         FROM clinics c LEFT JOIN heads h ON h.owner = 'clinic:' || c.id LEFT JOIN clinic_status s ON s.clinic_id = c.id
        ORDER BY c.name COLLATE NOCASE`,
    )
    .all();
  const { results: creators = [] } = await db.prepare("SELECT email, added_by, added_at FROM creators ORDER BY email").all();
  const { results: requests = [] } = await db
    .prepare("SELECT email, clinic, note, status, created_at, answered_at FROM access_requests ORDER BY status = 'pending' DESC, created_at")
    .all();
  const str = (/** @type {unknown} */ v) => (v === null || v === undefined ? null : String(v));
  return json(200, {
    clinics: clinics.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      createdBy: String(r.created_by),
      createdAt: String(r.created_at),
      members: Number(r.members),
      admins: str(r.admins)?.split(", ") ?? [],
      size: r.size === null || r.size === undefined ? 0 : approxBytes(Number(r.size)),
      lastSync: str(r.updated_at),
      suspendedAt: str(r.suspended_at),
      deletedAt: str(r.deleted_at),
      deletedBy: str(r.deleted_by),
      declaration: str(r.declaration),
      purgeAfter: str(r.purge_after),
    })),
    requests: requests.map((r) => ({
      email: String(r.email),
      clinic: String(r.clinic),
      note: String(r.note),
      status: String(r.status),
      createdAt: String(r.created_at),
      answeredAt: str(r.answered_at),
    })),
    creators: [
      ...list(env.ALLOWED_EMAILS).map((e) => ({ email: e.toLowerCase(), source: "variable" })),
      ...creators.map((r) => ({ email: String(r.email), source: "panel", addedBy: String(r.added_by), addedAt: String(r.added_at) })),
    ],
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

// ---------- Formularios para el paciente ----------

/**
 * El cuerpo JSON de una petición, hasta `max` caracteres.
 * @param {Request} request
 * @param {number} max
 * @returns {Promise<Record<string, unknown>>}
 */
async function readBigJson(request, max) {
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

/** Texto base64 (lo cifrado), de 1 a `max` caracteres. */
const isBase64 = (/** @type {unknown} */ v, /** @type {number} */ max) => typeof v === "string" && v.length > 0 && v.length <= max && /^[A-Za-z0-9+/]+={0,2}$/.test(v);

/**
 * Borra los formularios caducados sin responder, los ya recogidos al caducar y las respuestas que nadie ha recogido en
 * 60 días.
 * @param {D1Database} db
 * @param {() => number} now
 */
async function purgeForms(db, now) {
  const at = now();
  await db
    .prepare("DELETE FROM patient_forms WHERE ((answered_at IS NULL OR response IS NULL) AND expires_at < ?) OR (answered_at IS NOT NULL AND answered_at < ?)")
    .bind(new Date(at).toISOString(), new Date(at - KEEP_ANSWERS_DAYS * 86_400_000).toISOString())
    .run();
}

/**
 * El equipo deja un formulario, recoge las respuestas o lo borra.
 * @param {Request} request
 * @param {D1Database} db
 * @param {string} clinicId
 * @param {string | null} formId
 * @param {{ email: string }} who
 * @param {() => number} now
 */
async function clinicForms(request, db, clinicId, formId, who, now) {
  if (formId) {
    // Recogido: se borra lo cifrado, pero se recuerda que se respondió (si el paciente vuelve a abrir el enlace, lo ve).
    // Anulado sin responder: se borra entero.
    await db.batch([
      db.prepare("UPDATE patient_forms SET request = '', response = NULL WHERE clinic_id = ? AND id = ? AND answered_at IS NOT NULL").bind(clinicId, formId),
      db.prepare("DELETE FROM patient_forms WHERE clinic_id = ? AND id = ? AND answered_at IS NULL").bind(clinicId, formId),
    ]);
    return new Response(null, { status: 204 });
  }
  await purgeForms(db, now);
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
  const open = await db.prepare("SELECT COUNT(*) AS n FROM patient_forms WHERE clinic_id = ? AND (answered_at IS NULL OR response IS NOT NULL)").bind(clinicId).first();
  if (Number(open?.n) >= MAX_OPEN_FORMS) throw new HttpError(429, "La clínica tiene demasiados formularios sin recoger. Abre la app para recoger las respuestas.");
  const exists = await db.prepare("SELECT 1 FROM patient_forms WHERE id = ?").bind(id).first();
  if (exists) throw new HttpError(409, "Ese formulario ya existe.");
  await db
    .prepare("INSERT INTO patient_forms (id, clinic_id, created_by, created_at, expires_at, request) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, clinicId, normalEmail(who.email), new Date(now()).toISOString(), new Date(expires).toISOString(), body.request)
    .run();
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
async function publicForm(request, db, id, answer, now) {
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

// ---------- Comprobación de la instalación ----------

/** @param {Env} env */
async function health(env) {
  const problems = [];
  if (!env.DB) {
    problems.push("Falta el enlace «DB» con la base de datos D1 (Settings → Bindings).");
  } else {
    try {
      await env.DB.batch(["heads", "parts", "clinics", "members", "recovery", "creators", "clinic_status", "deltas", "delta_base", "access_requests", "patient_forms"].map((t) => /** @type {D1Database} */ (env.DB).prepare(`SELECT 1 FROM ${t} LIMIT 0`)));
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

// ---------- Borrador del contrato de encargado del tratamiento ----------
// Solo lo ve quien gestiona el servidor (GET /v1/proveedor/contrato). Es un BORRADOR para revisar con un abogado o un
// delegado de protección de datos: no se ha comprobado que cumpla la normativa.

const CONTRACT_HTML = `
<p><strong>BORRADOR para revisar con un profesional (abogado o delegado de protección de datos). No firmar sin revisarlo.</strong></p>
<h2>Contrato de encargo del tratamiento de datos personales (artículo 28 del RGPD)</h2>
<p>En [LOCALIDAD], a [FECHA].</p>
<h3>Reunidos</h3>
<p><strong>De una parte</strong>, [NOMBRE O RAZÓN SOCIAL DE LA CLÍNICA], con NIF [NIF], domicilio en [DIRECCIÓN] y representada por [NOMBRE Y CARGO], en adelante <em>el Responsable</em>.</p>
<p><strong>De otra parte</strong>, [NOMBRE DEL PROVEEDOR], con NIF [NIF], domicilio en [DIRECCIÓN] y correo de contacto [CORREO], en adelante <em>el Encargado</em>, que presta el servicio de la aplicación Cénit · Fisiolab.</p>
<p>Ambas partes se reconocen capacidad para firmar este contrato y acuerdan las siguientes cláusulas.</p>
<h3>1. Objeto</h3>
<p>El Encargado presta al Responsable el servicio de la aplicación Cénit · Fisiolab: una herramienta de registro y organización de la actividad de fisioterapia (fichas de pacientes, anamnesis, sesiones, mediciones, agenda y turnos del equipo). Para ello guarda en un servidor una copia cifrada de los datos de la clínica, que se sincroniza entre los dispositivos de su equipo. La aplicación registra y organiza; las decisiones clínicas son siempre del profesional.</p>
<h3>2. Duración</h3>
<p>Este contrato dura lo mismo que la prestación del servicio. Al terminar se aplica la cláusula 10.</p>
<h3>3. Naturaleza, finalidad y datos tratados</h3>
<ul>
<li><strong>Finalidad:</strong> guardar y sincronizar la copia de los datos de la clínica y gestionar el acceso de su equipo.</li>
<li><strong>Interesados:</strong> pacientes de la clínica y profesionales de su equipo.</li>
<li><strong>Datos:</strong> identificativos y de contacto de los pacientes; datos de salud (categoría especial, artículo 9 del RGPD): historia clínica, anamnesis, exploración, sesiones, mediciones y cuestionarios; del equipo, nombre y correo electrónico.</li>
<li><strong>Tratamientos:</strong> conservación y transmisión de una copia cifrada; gestión de cuentas de acceso (correos del equipo).</li>
</ul>
<h3>4. Cifrado y acceso a los datos</h3>
<p>La copia de los datos se cifra en los dispositivos de la clínica (AES-256) con una contraseña que solo conoce la clínica, antes de llegar al servidor. El Encargado no conoce esa contraseña ni la del código de recuperación y no puede leer los datos de los pacientes. El Encargado sí trata, para prestar el servicio, el nombre de la clínica, los correos de su equipo, el tamaño de la copia y las fechas de uso. Si la clínica usa los formularios para el paciente, el servidor guarda además, hasta que la clínica los recoge, lo que envía el paciente, cifrado en su navegador para la clínica (el Encargado no puede leerlo). La clínica custodia su contraseña y su código de recuperación: si los pierde, el Encargado no puede recuperar los datos.</p>
<h3>5. Obligaciones del Encargado</h3>
<ol>
<li>Tratar los datos solo para prestar el servicio y siguiendo las instrucciones documentadas del Responsable, incluidas las de este contrato.</li>
<li>Garantizar que las personas autorizadas a tratar los datos se han comprometido a respetar su confidencialidad.</li>
<li>Aplicar las medidas de seguridad del artículo 32 del RGPD descritas en el anexo.</li>
<li>No recurrir a otro encargado sin autorización del Responsable. El Responsable autoriza a los subencargados del anexo; el Encargado avisará de cualquier cambio con al menos 30 días de antelación para que el Responsable pueda oponerse.</li>
<li>Asistir al Responsable, en lo que le sea posible, para responder a las solicitudes de ejercicio de derechos de los interesados.</li>
<li>Notificar al Responsable, sin dilación indebida y a más tardar en 48 horas desde que tenga conocimiento, cualquier violación de la seguridad que afecte a los datos, con la información necesaria para que el Responsable cumpla los artículos 33 y 34 del RGPD.</li>
<li>Poner a disposición del Responsable la información necesaria para demostrar el cumplimiento de este contrato y permitir las auditorías razonables que este solicite.</li>
<li>Llevar el registro de actividades de tratamiento como encargado (artículo 30.2 del RGPD).</li>
</ol>
<h3>6. Obligaciones del Responsable</h3>
<ol>
<li>Ser el responsable del tratamiento: informar a los pacientes, recabar los consentimientos que procedan y atender sus derechos.</li>
<li>Elegir y custodiar la contraseña de cifrado y el código de recuperación, y dar acceso solo a su equipo.</li>
<li>Conservar las historias clínicas el plazo que marca la ley (como mínimo cinco años desde el alta de cada proceso asistencial, Ley 41/2002) y guardar copias de seguridad.</li>
<li>Velar por que su equipo cumpla la normativa y su deber de confidencialidad, y mantener protegidos sus dispositivos.</li>
</ol>
<h3>7. Subencargados</h3>
<p>Se autorizan los subencargados del anexo. El Encargado les impone por contrato las mismas obligaciones de protección de datos.</p>
<h3>8. Transferencias internacionales</h3>
<p>La copia cifrada se guarda en una base de datos de Cloudflare con jurisdicción en la Unión Europea. El inicio de sesión con Google puede implicar transferencias a Estados Unidos, amparadas en el Marco de Privacidad de Datos UE-EE. UU. o en cláusulas contractuales tipo, según el contrato de Google.</p>
<h3>9. Suspensión del servicio</h3>
<p>Si el servicio se suspende (por ejemplo, por impago), el Responsable puede seguir descargando su copia, pero no guardar cambios en el servidor, hasta su reactivación o la terminación del contrato.</p>
<h3>10. Fin de la prestación</h3>
<p>Al terminar el servicio, el Responsable descarga su copia de seguridad y la conserva bajo su responsabilidad. Cuando el Responsable borra su clínica, declara conservar esa copia y el servidor guarda constancia de quién lo hizo, cuándo y con qué declaración. Los datos quedan 30 días en la papelera, durante los cuales el Responsable puede recuperarlos; después el Encargado los suprime de su servidor, salvo obligación legal de conservarlos.</p>
<h3>11. Responsabilidad</h3>
<p>Cada parte responde de sus incumplimientos conforme al artículo 82 del RGPD. [LIMITACIONES DE RESPONSABILIDAD, A REVISAR]</p>
<h3>12. Ley aplicable</h3>
<p>Este contrato se rige por la ley española y el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD). [JURISDICCIÓN]</p>
<h3>Anexo I. Medidas de seguridad</h3>
<ul>
<li>Cifrado de la copia en el dispositivo (AES-256-GCM, clave derivada con PBKDF2-SHA-256 de 600 000 iteraciones) antes de enviarla; el servidor rechaza copias sin cifrar.</li>
<li>Acceso al servidor solo con sesión de Google verificada y solo para el equipo de cada clínica; los permisos del equipo los gestiona su administrador.</li>
<li>Conexiones cifradas (HTTPS). Registros de peticiones desactivados; nunca se registran el contenido ni los tokens.</li>
<li>Control de versiones de la copia para que un dispositivo no pise los cambios de otro.</li>
<li>En los dispositivos: PIN de la aplicación obligatorio en las clínicas y bloqueo por inactividad.</li>
</ul>
<h3>Anexo II. Subencargados autorizados</h3>
<ul>
<li>Cloudflare, Inc. (y sus filiales): alojamiento del servidor y de la base de datos (jurisdicción UE). Contrato: Cloudflare Customer DPA.</li>
<li>Google LLC / Google Ireland Ltd.: inicio de sesión con cuenta de Google y, si la clínica lo activa, Google Calendar y Google Drive de cada profesional.</li>
<li>GitHub, Inc.: publicación de la aplicación web (no trata datos de pacientes).</li>
</ul>
<p>Firmado por ambas partes:</p>
<p>El Responsable: ______________________ &nbsp;&nbsp;&nbsp; El Encargado: ______________________</p>
`;
