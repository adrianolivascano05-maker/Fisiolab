// @ts-check

import { authenticate } from "./auth.js";
import { inList, normalEmail, purgeExpired, roleIn } from "./clinics.js";
import { D1_CAP_MB, DAILY_REQUESTS, MAX_MEMBERS, SERVER_VERSION, WARN_SHARE } from "./constants.js";
import { HttpError, database, json, notFound, readJson } from "./util.js";

/** @typedef {import("./types.js").D1Database} D1Database */
/** @typedef {import("./types.js").Env} Env */
/** @typedef {import("./types.js").Deps} Deps */

// ---------- Panel del proveedor ----------

/**
 * Lo que ve y hace quien gestiona el servidor (OPERATOR_EMAILS). Nunca toca la copia de una clínica: solo sus datos
 * de servicio (nombre, equipo, tamaño, fechas y estado).
 * @param {Request} request
 * @param {Env} env
 * @param {{ verifyToken: NonNullable<Deps["verifyToken"]>, now: () => number, fetch?: typeof fetch }} deps
 * @param {string} rest
 */
export async function operatorRoute(request, env, deps, rest) {
  const method = request.method;
  const alta = /^\/altas\/([^/]+)$/.exec(rest);
  const clinicAction = /^\/clinicas\/([A-Za-z0-9-]{1,64})\/(suspender|recuperar)$/.exec(rest);
  const answer = /^\/solicitudes\/([^/]+)$/.exec(rest);
  const known =
    (answer !== null && ["POST", "DELETE"].includes(method)) ||
    (rest === "" && method === "GET") ||
    (rest === "/contrato" && method === "GET") ||
    (rest === "/peticiones" && method === "GET") ||
    (alta !== null && ["PUT", "DELETE"].includes(method)) ||
    (clinicAction !== null && method === "POST");
  if (!known) throw notFound();
  const who = await authenticate(request, env, deps);
  const email = who.email.trim().toLowerCase();
  if (!inList(env.OPERATOR_EMAILS, email)) throw new HttpError(403, "Solo quien gestiona el servidor puede verlo.");
  const db = database(env);

  if (rest === "/contrato") return json(200, { html: CONTRACT_HTML });
  if (rest === "/peticiones") return json(200, await requestUsage(env, deps));
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

  await purgeExpired(db, deps.now, env.DOCS);
  const { results: clinics = [] } = await db
    .prepare(
      `SELECT c.id, c.name, c.created_by, c.created_at,
              (SELECT count(*) FROM members m WHERE m.clinic_id = c.id) AS members,
              (SELECT group_concat(m.email, ', ') FROM members m WHERE m.clinic_id = c.id AND m.role = 'admin') AS admins,
              (CASE WHEN h.parts = 0 THEN h.size ELSE h.size * 3 / 4 END)
                + coalesce((SELECT sum(length(d.data)) FROM deltas d WHERE d.owner = h.owner), 0) * 3 / 4 AS size,
              (SELECT coalesce(sum(f.size), 0) FROM documents f WHERE f.clinic_id = c.id) AS docs,
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
  // all() y no first(): D1 dice en meta.size_after cuánto ocupa la base entera (para avisar antes de su límite).
  const { results: [stored] = [], meta } = await db
    .prepare("SELECT (SELECT coalesce(sum(size), 0) FROM documents) AS docs, (SELECT coalesce(sum(size), 0) FROM heads WHERE parts = 0) AS copies")
    .all();
  const dbCap = Math.round((Number(env.D1_CAP_MB) > 0 ? Number(env.D1_CAP_MB) : D1_CAP_MB) * 1e6);
  return json(200, {
    version: SERVER_VERSION,
    documents: { enabled: !!env.DOCS, total: Number(stored?.docs ?? 0) + Number(stored?.copies ?? 0), copies: Number(stored?.copies ?? 0), ...docsLimits(env) },
    database: { bytes: typeof meta?.size_after === "number" ? meta.size_after : null, cap: dbCap, warnAt: Math.round(dbCap * WARN_SHARE) },
    clinics: clinics.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      createdBy: String(r.created_by),
      createdAt: String(r.created_at),
      members: Number(r.members),
      admins: str(r.admins)?.split(", ") ?? [],
      size: Number(r.size ?? 0),
      docs: Number(r.docs ?? 0),
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
export function clinicName(body) {
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
export async function createClinic(request, db, who, now) {
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
export async function putMember(request, db, id, email, who, now) {
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
export async function removeMember(db, id, email) {
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
 * Las peticiones de hoy de toda la cuenta, según las estadísticas de Cloudflare (su API GraphQL, con un token de solo
 * lectura). Contarlas aquí costaría una escritura por petición. Si falta el token o la API falla, lo dice sin
 * romper el panel. El token nunca sale en la respuesta.
 * @param {Env} env
 * @param {{ now: () => number, fetch?: typeof fetch }} deps
 */
async function requestUsage(env, deps) {
  const n = Number(env.DAILY_REQUESTS);
  const limit = env.DAILY_REQUESTS !== undefined && env.DAILY_REQUESTS !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n) : DAILY_REQUESTS;
  const base = { limit, warnAt: Math.round(limit * WARN_SHARE) };
  const account = (env.CF_ACCOUNT_ID ?? "").trim();
  const token = (env.CF_API_TOKEN ?? "").trim();
  if (!account || !token) return { configured: false, ...base };
  const now = new Date(deps.now());
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const query = `query ($account: string, $start: string, $end: string) {
    viewer { accounts(filter: { accountTag: $account }) {
      workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: $start, datetime_leq: $end }) {
        sum { requests errors }
        dimensions { scriptName }
      }
    } }
  }`;
  const failed = (/** @type {string} */ error) => ({ configured: true, today: null, errors: null, since, ...base, error });
  try {
    const res = await (deps.fetch ?? fetch)("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { account, start: since, end: now.toISOString() } }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403) return failed("Cloudflare no acepta el token CF_API_TOKEN: revisa que tenga el permiso «Account Analytics: Read».");
    if (!res.ok) return failed(`Cloudflare no ha respondido bien (${res.status}). Inténtalo más tarde.`);
    const body = /** @type {any} */ (await res.json());
    if (body?.errors?.length) return failed(`Cloudflare dice: ${String(body.errors[0]?.message ?? "error").slice(0, 200)}`);
    const accounts = body?.data?.viewer?.accounts;
    if (!Array.isArray(accounts) || !accounts.length) return failed("Cloudflare no encuentra esa cuenta: revisa CF_ACCOUNT_ID.");
    /** @type {{ sum?: { requests?: number, errors?: number } }[]} */
    const rows = accounts[0]?.workersInvocationsAdaptive ?? [];
    const sum = (/** @type {"requests" | "errors"} */ k) => rows.reduce((t, r) => t + Number(r?.sum?.[k] ?? 0), 0);
    return { configured: true, today: sum("requests"), errors: sum("errors"), since, ...base };
  } catch {
    return failed("No se ha podido preguntar a Cloudflare. Inténtalo más tarde.");
  }
}
