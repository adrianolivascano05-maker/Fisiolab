// @ts-check

import { MAGIC, MAX_CHARS, PARTS_PER_TRIP, PART_CHARS } from "./constants.js";
import { copyKey } from "./copy.js";
import { HttpError, approxBytes, json, parseEtag } from "./util.js";

/** @typedef {import("./types.js").D1Database} D1Database */
/** @typedef {import("./types.js").Head} Head */

// ---------- La copia en D1 ----------

/**
 * @param {D1Database} db
 * @param {string} owner
 * @returns {Promise<Head | null>}
 */
export async function getHead(db, owner) {
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
export async function readCopy(db, owner) {
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
 * La condición de una subida: If-None-Match: * (crear) o If-Match con la versión que sustituye. 428 si no hay.
 * @param {Request} request
 */
export function precondition(request) {
  const ifMatch = request.headers.get("If-Match");
  const expected = ifMatch === null ? null : parseEtag(ifMatch);
  const create = ifMatch === null && (request.headers.get("If-None-Match") ?? "").trim() === "*";
  if (expected === null && !create) {
    throw new HttpError(428, "Falta la condición de la subida: If-None-Match: * para crear la copia o If-Match con su versión para sustituirla.");
  }
  return { expected, create };
}

/**
 * Guarda una copia nueva. Los trozos van con una versión nueva y la copia vigente solo cambia al final, con una
 * escritura condicionada a la versión que dice el dispositivo: así nunca se pisa lo que subió otro.
 * @param {Request} request
 * @param {D1Database} db
 * @param {string} owner
 * @param {() => number} now
 * @param {R2Bucket} [docs] si la copia que sustituye estaba en R2, se borra de allí
 */
export async function writeCopy(request, db, owner, now, docs) {
  const { expected, create } = precondition(request);
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
  if (current?.parts === 0 && docs) await docs.delete(copyKey(owner, current.version));

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
export function conflict(current) {
  return new HttpError(412, "La copia del servidor ha cambiado: hay que bajarla y juntarla antes de subir esta.", {
    version: current ? current.version : null,
  });
}
