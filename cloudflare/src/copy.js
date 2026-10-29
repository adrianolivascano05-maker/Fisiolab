// @ts-check

import { COPY_MAGIC, COPY_PART_BYTES, DELTAS_PER_TRIP, DELTA_TRIP_CHARS, MAGIC, MAX_COPY_BYTES, PART_CHARS } from "./constants.js";
import { conflict, getHead, precondition, readCopy, writeCopy } from "./copyStore.js";
import { HttpError, approxBytes, json, notFound, readBytes, readJson } from "./util.js";

/** @typedef {import("./types.js").D1Database} D1Database */
/** @typedef {import("./types.js").Head} Head */
/** @typedef {import("./types.js").Base} Base */

// ---------- La copia de una clínica: rutas, trozos en R2 y cambios ----------

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
 * @param {R2Bucket | undefined} docs el almacén R2, si lo hay: allí va la copia de la app nueva (&trozos=1)
 * @param {string} owner
 * @param {string} rest «/copia», «/copia/info», «/copia/cambios» o «/copia/subida…»
 * @param {() => number} now
 */
export async function clinicCopy(request, db, docs, owner, rest, now) {
  const params = new URL(request.url).searchParams;
  const v2 = params.get("v") === "2";
  // La app que sabe leer la copia en R2. Las anteriores no: si la copia está allí, tienen que actualizarse.
  const pieces = v2 && params.get("trozos") === "1";
  const base = await getBase(db, owner);
  // Una versión anterior de la app no sabe de los cambios: si sube o baja la copia entera, se pierde lo de los demás.
  if (base && !v2) throw new HttpError(426, OLD_APP);
  if (!v2) {
    if (rest === "/copia/cambios" || upload(rest)) throw notFound();
    return copyRoute(request, db, owner, rest.endsWith("/info"), now);
  }
  if (!pieces) {
    if (upload(rest)) throw notFound();
    if ((await getHead(db, owner))?.parts === 0) throw new HttpError(426, OLD_APP);
  }
  if (upload(rest)) return copyUpload(request, db, docs, owner, rest, params, now);

  if (rest === "/copia/info") {
    const head = await getHead(db, owner);
    // Y cuántas respuestas de pacientes esperan: así la app no tiene que preguntarlo aparte cada minuto.
    const stats = await db
      .prepare(
        `SELECT count(*) AS n, coalesce(sum(length(data)), 0) AS chars, max(seq) AS last,
                (SELECT count(*) FROM patient_forms WHERE clinic_id = ? AND response IS NOT NULL) AS forms
           FROM deltas WHERE owner = ?`,
      )
      .bind(owner.slice("clinic:".length), owner)
      .first();
    return json(200, {
      version: head?.version ?? null,
      size: head ? headBytes(head) : 0,
      updatedAt: head?.updatedAt ?? null,
      ...(pieces ? { pieces: !!docs } : {}),
      epoch: base?.epoch ?? null,
      base: base?.seq ?? null,
      last: Math.max(Number(stats?.last ?? 0), base?.seq ?? 0),
      deltas: Number(stats?.n ?? 0),
      deltaSize: approxBytes(Number(stats?.chars ?? 0)),
      forms: Number(stats?.forms ?? 0),
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
    // Primero solo cuánto ocupa cada lote (uno más de los que caben, para saber si quedan), y después se leen solo los
    // que caben en este viaje: así nunca se cargan en memoria lotes que no se van a mandar.
    const { results: sizes = [] } = await db
      .prepare("SELECT seq, length(data) AS chars FROM deltas WHERE owner = ? AND seq > ? ORDER BY seq LIMIT ?")
      .bind(owner, since, DELTAS_PER_TRIP + 1)
      .all();
    let take = 0;
    let chars = 0;
    for (const r of sizes.slice(0, DELTAS_PER_TRIP)) {
      if (take && chars + Number(r.chars) > DELTA_TRIP_CHARS) break;
      take++;
      chars += Number(r.chars);
    }
    const last = take ? Number(sizes[take - 1]?.seq) : since;
    const { results = [] } = take
      ? await db.prepare("SELECT seq, data FROM deltas WHERE owner = ? AND seq > ? AND seq <= ? ORDER BY seq").bind(owner, since, last).all()
      : { results: [] };
    const deltas = results.map((r) => ({ seq: Number(r.seq), data: String(r.data) }));
    return json(200, { epoch: base.epoch, base: base.seq, deltas, more: take < sizes.length });
  }

  if (request.method === "PUT") {
    const seq = seqOf(params);
    const res = await writeCopy(request, db, owner, now, docs);
    const body = /** @type {Record<string, unknown>} */ (await res.json());
    return json(200, { ...body, ...(await settleDeltas(db, owner, seq)) }, { ETag: res.headers.get("ETag") ?? "" });
  }
  if (request.method === "GET") {
    const copy = await readR2Copy(db, docs, owner);
    if (copy) return copy;
  }
  if (request.method === "DELETE") {
    // Sin copia no hay base: la próxima subida empieza otra época, y los dispositivos vuelven a empezar.
    const head = await getHead(db, owner);
    if (head?.parts === 0 && docs) await docs.delete(copyKey(owner, head.version));
    await db.batch([db.prepare("DELETE FROM deltas WHERE owner = ?").bind(owner), db.prepare("DELETE FROM delta_base WHERE owner = ?").bind(owner)]);
  }
  return copyRoute(request, db, owner, false, now);
}

/** Si es una de las rutas de la subida por trozos. */
const upload = (/** @type {string} */ rest) => rest.startsWith("/copia/subida");

/** Dónde está en R2 la copia `version` de una clínica. */
export const copyKey = (/** @type {string} */ owner, /** @type {string} */ version) => `copias/${owner}/${version}`;

/** Los bytes de una copia: en R2 (parts = 0), los que son; en D1, los de su base64. */
const headBytes = (/** @type {Head} */ head) => (head.parts === 0 ? head.chars : approxBytes(head.chars));

/** @param {URLSearchParams} params */
function seqOf(params) {
  const seq = Number(params.get("seq"));
  if (!params.has("seq") || !Number.isSafeInteger(seq) || seq < 0) throw new HttpError(400, "Falta «seq»: hasta qué cambio lleva esta copia.");
  return seq;
}

/**
 * Una copia entera nueva ya lleva los cambios hasta `seq`: esos sobran. La primera vez, la clínica pasa a la
 * sincronización por cambios. Devuelve su época y hasta dónde llega.
 * @param {D1Database} db
 * @param {string} owner
 * @param {number} seq
 */
async function settleDeltas(db, owner, seq) {
  await db.batch([
    db
      .prepare("INSERT INTO delta_base (owner, epoch, seq) VALUES (?, ?, ?) ON CONFLICT (owner) DO UPDATE SET seq = max(seq, excluded.seq)")
      .bind(owner, crypto.randomUUID(), seq),
    db.prepare("DELETE FROM deltas WHERE owner = ? AND seq <= (SELECT seq FROM delta_base WHERE owner = ?)").bind(owner, owner),
  ]);
  const after = await getBase(db, owner);
  return { epoch: after?.epoch ?? null, base: after?.seq ?? seq };
}

/**
 * La copia vigente si está en R2: los bytes tal cual, sin pasar por la memoria del servidor. null si está en D1 (o no
 * hay). Si otra subida la sustituye justo antes de leerla, se vuelve a mirar una vez.
 * @param {D1Database} db
 * @param {R2Bucket | undefined} docs
 * @param {string} owner
 */
async function readR2Copy(db, docs, owner) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const head = await getHead(db, owner);
    if (head?.parts !== 0) return null;
    if (!docs) throw new HttpError(500, "La copia de la clínica está en el almacén R2, pero falta el enlace «DOCS» con él.");
    const object = await docs.get(copyKey(owner, head.version));
    if (object) return new Response(object.body, { status: 200, headers: { "Content-Type": "application/octet-stream", ETag: `"${head.version}"` } });
  }
  throw new HttpError(503, "La copia se está cambiando en este momento. Inténtalo de nuevo en unos segundos.");
}

/**
 * Subir la copia de una clínica a R2 por trozos: empezar, cada trozo, terminar (pasa a ser la vigente con la misma
 * condición que el PUT, If-None-Match o If-Match) o dejarlo. Así ninguna petición lleva más de 8 MiB y el servidor
 * nunca tiene la copia entera en memoria.
 * @param {Request} request
 * @param {D1Database} db
 * @param {R2Bucket | undefined} docs
 * @param {string} owner
 * @param {string} rest
 * @param {URLSearchParams} params
 * @param {() => number} now
 */
async function copyUpload(request, db, docs, owner, rest, params, now) {
  if (!docs) throw new HttpError(501, "Este servidor no tiene almacén R2: la copia se sube entera.");
  const [, version, step] = /** @type {RegExpExecArray} */ (/^\/copia\/subida(?:\/([0-9a-f-]{36})(?:\/(\d+|fin))?)?$/.exec(rest));
  if (!version) {
    const { expected, create } = precondition(request);
    const current = await getHead(db, owner);
    if (create ? current !== null : current?.version !== expected) throw conflict(current);
    const v = crypto.randomUUID();
    const started = await docs.createMultipartUpload(copyKey(owner, v));
    return json(200, { version: v, upload: started.uploadId, partBytes: COPY_PART_BYTES });
  }
  const id = params.get("id") ?? "";
  if (!id) throw new HttpError(400, "Falta «id»: la subida.");
  const up = docs.resumeMultipartUpload(copyKey(owner, version), id);
  if (request.method === "DELETE") {
    await up.abort().catch(() => {});
    return new Response(null, { status: 204 });
  }
  if (step !== "fin") {
    const n = Number(step);
    if (n > MAX_COPY_BYTES / COPY_PART_BYTES) throw new HttpError(413, "La copia pasa de 2 GB, el máximo que guarda este servidor.");
    const bytes = await readBytes(request, COPY_PART_BYTES, () => new HttpError(413, "Cada trozo de la copia tiene que ser de 8 MiB como mucho."));
    if (n === 1 && !(bytes.byteLength > COPY_MAGIC.length && COPY_MAGIC.every((b, i) => bytes[i] === b))) {
      throw new HttpError(415, "Solo se guardan copias cifradas.");
    }
    const part = await up.uploadPart(n, bytes);
    return json(200, { part: part.partNumber, etag: part.etag });
  }

  // Terminar: se junta en R2 y pasa a ser la vigente si nadie ha subido otra entre medias.
  const { expected, create } = precondition(request);
  const seq = seqOf(params);
  const body = await readJson(request);
  const list = typeof body === "object" && body !== null && "parts" in body && Array.isArray(body.parts) ? body.parts : [];
  const parts = list.map((p) => ({ partNumber: Number(p?.part), etag: String(p?.etag ?? "") }));
  if (!parts.length || parts.some((p, i) => p.partNumber !== i + 1 || !p.etag)) throw new HttpError(400, "Faltan los trozos de la copia («parts»), por orden.");
  // Lo que ocupa entera, según la app: si R2 junta otra cosa (faltaba un trozo), no se guarda.
  const size = typeof body === "object" && body !== null && "size" in body ? Number(body.size) : NaN;
  if (!Number.isSafeInteger(size) || size <= 0) throw new HttpError(400, "Falta lo que ocupa la copia («size»).");
  const key = copyKey(owner, version);
  let object;
  try {
    object = await up.complete(parts);
  } catch {
    throw new HttpError(502, "No se ha podido juntar la copia en el almacén: se volverá a subir.");
  }
  if (object.size !== size) {
    await docs.delete(key);
    throw new HttpError(400, "A la copia le faltan trozos: se volverá a subir.");
  }
  const updatedAt = new Date(now()).toISOString();
  const headWrite = create
    ? db.prepare("INSERT INTO heads (owner, version, parts, size, updated_at) VALUES (?, ?, 0, ?, ?) ON CONFLICT(owner) DO NOTHING").bind(owner, version, object.size, updatedAt)
    : db.prepare("UPDATE heads SET version = ?, parts = 0, size = ?, updated_at = ? WHERE owner = ? AND version = ?").bind(version, object.size, updatedAt, owner, expected);
  const result = await headWrite.run();
  if (result.meta?.changes !== 1) {
    // Otra subida ha llegado antes: esta sobra.
    await docs.delete(key);
    throw conflict(await getHead(db, owner));
  }
  // Lo de la copia anterior sobra: en R2, o sus trozos en D1 (si la clínica la tenía allí), si esta sigue vigente.
  if (expected) await docs.delete(copyKey(owner, expected));
  await db
    .prepare("DELETE FROM parts WHERE owner = ? AND EXISTS (SELECT 1 FROM heads WHERE owner = ? AND version = ?)")
    .bind(owner, owner, version)
    .run();
  return json(200, { version, size: object.size, updatedAt, ...(await settleDeltas(db, owner, seq)) }, { ETag: `"${version}"` });
}

/** Las rutas de una copia: «/copia» con GET, PUT o DELETE y «/copia/info» con GET. */
export const copyMethod = (/** @type {string} */ p, /** @type {string} */ method) =>
  (p === "/copia" && ["GET", "PUT", "DELETE"].includes(method)) || (p === "/copia/info" && method === "GET");

/**
 * Leer, guardar o borrar una copia (la de una clínica o la personal).
 * @param {Request} request
 * @param {D1Database} db
 * @param {string} owner
 * @param {boolean} info solo cuánto ocupa y su versión
 * @param {() => number} now
 */
export async function copyRoute(request, db, owner, info, now) {
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
