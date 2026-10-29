// @ts-check
// Servidor de datos de OmniClin en Cloudflare (Workers + D1). Guarda la copia CIFRADA de la base de cada clínica;
// Google solo sirve para saber quién es. Cómo instalarlo: README.md de esta carpeta.
//
// Clínicas: quien está en ALLOWED_EMAILS puede crear una clínica y queda como su administrador; el administrador
// añade a su equipo por correo (sin tocar Cloudflare). Todos los de una clínica comparten su copia, que va cifrada
// con la contraseña de la clínica: el servidor (y quien lo gestiona) solo ve nombres de clínica, correos y bytes
// ilegibles, nunca un paciente.
//
// La copia viaja y se guarda como texto base64 (la app la codifica y la decodifica): así el servidor nunca
// convierte bytes, que en D1 cuesta mucho tiempo de proceso. Si hay almacén R2 (DOCS), la de cada clínica va allí en
// bytes, subida por trozos de 8 MiB y bajada de un tirón sin pasar por la memoria del servidor: así no hay tope de
// 50 MB ni hace falta juntarla aquí (ver «Copia en R2», abajo).
//
// Se pega tal cual en el editor del panel de Cloudflare: JavaScript sin dependencias ni compilación.
//
// Rutas:
//   OPTIONS *              permiso CORS para la app (preflight)
//   GET    /v1/salud       { ok: true, version } sin sesión: para comprobar la instalación (y qué versión está pegada)
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
//   GET    /v1/clinicas/:id/copia/info?v=2     además { epoch, base, last, deltas, deltaSize, forms } (forms: respuestas
//                                              de pacientes por recoger, para no tener que preguntarlo aparte)
//   PUT    /v1/clinicas/:id/copia?v=2&seq=N    la copia entera, que ya lleva los cambios hasta N (se borran)
//   GET    /v1/clinicas/:id/copia/cambios?v=2&desde=N  { epoch, base, deltas: [{ seq, data }], more }
//   POST   /v1/clinicas/:id/copia/cambios?v=2  un lote de cambios cifrado, en base64 → { seq }
//   Copia en R2 (la app nueva añade además &trozos=1; ver abajo):
//   GET    /v1/clinicas/:id/copia/info         además { pieces }: si se puede subir a R2 (hay almacén DOCS)
//   GET    /v1/clinicas/:id/copia              si está en R2, los bytes (application/octet-stream), con su ETag
//   POST   /v1/clinicas/:id/copia/subida       empieza a subir una copia (If-None-Match o If-Match, como el PUT)
//                                              → { version, upload, partBytes }
//   PUT    /v1/clinicas/:id/copia/subida/:versión/:n?id=…   el trozo n (1, 2…), de partBytes justos menos el
//                                              último → { part, etag }
//   POST   /v1/clinicas/:id/copia/subida/:versión/fin?id=…&seq=N   { parts: [{ part, etag }], size } → la junta (si
//                                              ocupa size bytes) y pasa a ser
//                                              la vigente (con la misma condición): { version, size, updatedAt,
//                                              epoch, base }
//   DELETE /v1/clinicas/:id/copia/subida/:versión?id=…      deja la subida (R2 borra solo las que nadie acaba a
//                                              los 7 días)
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
//   GET    /v1/proveedor/peticiones            { configured, today, errors, since, limit, warnAt, error? }: las
//                                              peticiones de hoy de toda la cuenta (estadísticas de Cloudflare)
//   POST   /v1/proveedor/solicitudes/:correo   { accept } → acepta (puede dar de alta su clínica) o rechaza una solicitud
//   DELETE /v1/proveedor/solicitudes/:correo   la borra (podrá volver a pedirlo)
//   Formularios para el paciente (anamnesis o cuestionarios que rellena desde su móvil con un enlace):
//   POST   /v1/clinicas/:id/formularios        { id, request, expiresAt } → deja el formulario cifrado (equipo)
//   GET    /v1/clinicas/:id/formularios        { forms: [{ id, response, answeredAt }] }: los ya respondidos (equipo)
//   DELETE /v1/clinicas/:id/formularios/:fid   recogido (se borran las respuestas y el formulario; queda que ya se
//                                              respondió) o anulado (se borra entero) (equipo; 204 aunque no estuviera)
//   GET    /v1/formularios/:fid                { request, expiresAt, answered } SIN sesión: lo abre el paciente
//   POST   /v1/formularios/:fid/respuesta      { response } SIN sesión: sus respuestas, cifradas, una sola vez
//   Documentos (los informes en PDF de cada paciente), cifrados en el dispositivo y guardados en R2 (si hay enlace DOCS):
//   GET    /v1/clinicas/:id/documentos         { enabled, count, used, total, cap, warnAt, maxBytes } (equipo):
//                                              lo que ocupan los de la clínica y el almacén entero (el tope es de todo)
//   PUT    /v1/clinicas/:id/documentos/:did    guarda un documento cifrado (bytes; equipo); si ya está, no lo repite
//   GET    /v1/clinicas/:id/documentos/:did    lo baja (bytes; equipo; también suspendida)
//   DELETE /v1/clinicas/:id/documentos/:did    lo borra (equipo; 204 aunque no estuviera)
//   POST   /v1/clinicas/:id/documentos/:did/guardar  se queda con uno que subió un paciente (si no, se borra al
//                                              recoger o anular su formulario)
//   PUT    /v1/formularios/:fid/documentos/:n  SIN sesión: el documento n (1, 2…) del paciente, cifrado con la clave
//                                              del enlace; solo en los formularios que piden documentos (maxDocs)
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
// Copia en R2: con almacén R2, la app nueva sube la copia entera de la clínica allí, por trozos («copias/clinic:<id>/
// <versión>»), y en heads se apunta con parts = 0 y su tamaño en bytes. Desde entonces, las versiones de la app que no
// saben leerla (sin &trozos=1) reciben 426 en las rutas de la copia. Sin almacén, todo sigue en D1 como antes. La
// copia cuenta para lo que ocupa el almacén, pero nunca se rechaza por el tope: los documentos sí.
//
// Enlace a la base D1: DB. Enlace a R2 (opcional): DOCS, el almacén de los documentos y de las copias; sin él, la app
// no ofrece documentos. Variables: GOOGLE_CLIENT_ID, ALLOWED_EMAILS, ALLOWED_ORIGINS, OPERATOR_EMAILS (quien gestiona
// el servidor: ve el panel del proveedor), DOCS_CAP_GB (opcional: el tope del almacén en GB; 10 si no está) y D1_CAP_MB
// (opcional: lo que puede ocupar la base, para avisar en el panel; 500 si no está, lo del plan gratuito). Para ver en
// el panel las peticiones de hoy: CF_ACCOUNT_ID (el ID de la cuenta) y el secreto CF_API_TOKEN (un token de Cloudflare
// de solo lectura, «Account Analytics: Read»); DAILY_REQUESTS (opcional: 100 000 si no está; 0 en el plan de pago,
// que no tiene límite al día).
// Nunca se escribe en el registro el contenido de una petición ni el token.

import { authenticate, verifyGoogleToken } from "./auth.js";
import { accessRequest, canCreate, clinicOwner, me, normalEmail } from "./clinics.js";
import { DELETE_GRACE_DAYS } from "./constants.js";
import { clinicCopy, copyMethod, copyRoute } from "./copy.js";
import { clinicDoc, docsUsage, publicFormDoc } from "./documents.js";
import { clinicForms, publicForm } from "./forms.js";
import { health } from "./health.js";
import { clinicName, createClinic, operatorRoute, putMember, removeMember } from "./provider.js";
import { HttpError, corsHeaders, database, json, notFound, readJson } from "./util.js";

/** @typedef {import("./types.js").Env} Env */
/** @typedef {import("./types.js").Deps} Deps */

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
    response = await route(request, env, { verifyToken, now, fetch: deps.fetch }, cors !== null);
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
  // El navegador no adivina el tipo: lo que dice ser texto o JSON no se ejecuta nunca como otra cosa.
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (cors) for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
  return response;
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {{ verifyToken: NonNullable<Deps["verifyToken"]>, now: () => number, fetch?: typeof fetch }} deps
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
  const pubDoc = /^\/v1\/formularios\/([A-Za-z0-9_-]{22,64})\/documentos\/([1-9]|10)$/.exec(path);
  if (pubDoc) {
    if (method !== "PUT") throw notFound();
    return publicFormDoc(request, env, /** @type {string} */ (pubDoc[1]), Number(pubDoc[2]), deps.now);
  }

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
  const doc = /^\/documentos\/([^/]+?)(\/guardar)?$/.exec(rest);
  const upload = /^\/copia\/subida(?:\/([0-9a-f-]{36})(?:\/([1-9]\d{0,4}|fin))?)?$/.exec(rest);
  const known =
    (rest === "" && ["PATCH", "DELETE"].includes(method)) ||
    (rest === "/miembros" && method === "GET") ||
    (member !== null && ["PUT", "DELETE"].includes(method)) ||
    (rest === "/recuperacion" && ["GET", "PUT"].includes(method)) ||
    (rest === "/recuperar" && method === "POST") ||
    copyMethod(rest, method) ||
    (rest === "/copia/cambios" && ["GET", "POST"].includes(method)) ||
    (upload !== null && method === (!upload[1] || upload[2] === "fin" ? "POST" : upload[2] ? "PUT" : "DELETE")) ||
    (rest === "/formularios" && ["GET", "POST"].includes(method)) ||
    (form !== null && method === "DELETE") ||
    (rest === "/documentos" && method === "GET") ||
    (doc !== null && !doc[2] && ["GET", "PUT", "DELETE"].includes(method)) ||
    (doc !== null && !!doc[2] && method === "POST");
  if (!known) throw notFound();

  const who = await authenticate(request, env, deps);
  const db = database(env);
  // Quien no es del equipo no sabe ni si la clínica existe.
  // El papel y el estado de la clínica, en un solo viaje a la base (esta ruta la usa cada dispositivo cada minuto).
  const row = await db
    .prepare("SELECT m.role, s.suspended_at, s.deleted_at FROM members m LEFT JOIN clinic_status s ON s.clinic_id = m.clinic_id WHERE m.clinic_id = ? AND m.email = ?")
    .bind(id, who.email.trim().toLowerCase())
    .first();
  if (!row) throw new HttpError(403, "Tu cuenta no forma parte de esta clínica.");
  const role = row.role === "admin" ? "admin" : "member";
  const admin = () => {
    if (role !== "admin") throw new HttpError(403, "Solo quien administra la clínica puede hacerlo.");
  };
  const status = { suspendedAt: row.suspended_at ? String(row.suspended_at) : null, deletedAt: row.deleted_at ? String(row.deleted_at) : null };
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
  if (rest === "/formularios" || form) return clinicForms(request, db, env.DOCS, id, form?.[1] ?? null, who, deps.now);
  if (rest === "/documentos") return docsUsage(db, env, id);
  if (doc) return clinicDoc(request, db, env, id, /** @type {string} */ (doc[1]), !!doc[2], deps.now);
  // La copia de la clínica: todo el equipo la baja y la sube; borrarla, solo quien administra.
  if (rest === "/copia" && method === "DELETE") admin();
  return clinicCopy(request, db, env.DOCS, clinicOwner(id), rest, deps.now);
}
