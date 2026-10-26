// Los archivos del paciente con el servidor de la clínica (cloudflare/worker.js, /documentos): añadirlos (se cifran y
// se guardan aquí; se suben en cuanto se puede), abrirlos (de aquí o del servidor) y, cada minuto con la app abierta
// (DocSync.tsx), subir lo pendiente y borrar del servidor lo que se ha borrado aquí.
import type { Token } from "../cloud/auth";
import type { ClinicApi, DocsUsage } from "../cloud/clinic";
import { ServerError } from "../cloud/remote";
import { currentEpisode } from "../data/episodes";
import type { Db } from "../data/db";
import { addDocument, forgetTrashed, markUploaded, pendingUploads, trashedDocuments, type PatientDocument } from "../data/documents";
import { cacheDelete, cacheGet, cacheKeys, cachePut } from "./cache";
import { newDocKey, openDoc, sealDoc } from "./docCrypto";
import type { Prepared } from "./prepare";

/** Lo que hace falta para hablar con el servidor de la clínica (sin él, todo se queda en el dispositivo). */
export type DocsServer = { api: ClinicApi["docs"]; clinicId: string; token: () => Token | null };

/** El almacén de documentos del servidor está lleno (el tope de 10 GB). */
export const isFull = (e: unknown) => e instanceof ServerError && e.status === 507;

/** Sube un archivo ya cifrado y lo marca como subido. false si no se ha podido (sin conexión, sin sesión…). */
async function upload(db: Db, server: DocsServer | null, id: string, sealed: Uint8Array): Promise<boolean> {
  const token = server?.token();
  // Solo si el navegador dice que no hay conexión (donde no lo sabe, se intenta).
  if (!server || !token || (typeof navigator !== "undefined" && navigator.onLine === false)) return false;
  await server.api.put(token, server.clinicId, id, sealed);
  await markUploaded(db, id);
  return true;
}

export type Added = { ids: string[]; uploaded: number; full: boolean };

/**
 * Añade archivos a un paciente: cada uno con su clave, cifrado y guardado aquí; se intentan subir ya (si no se puede,
 * se suben solos después). `full`: el almacén del servidor está lleno (se quedan aquí, pendientes).
 */
export async function addPatientFiles(db: Db, space: string, server: DocsServer | null, patientId: string, files: Prepared[]): Promise<Added> {
  const episodeId = await currentEpisode(db, patientId);
  const out: Added = { ids: [], uploaded: 0, full: false };
  for (const f of files) {
    const key = newDocKey();
    const sealed = await sealDoc(f.bytes, key);
    const id = crypto.randomUUID();
    await cachePut(space, id, sealed);
    await addDocument(db, { id, patientId, episodeId, name: f.name, mime: f.mime, size: f.bytes.byteLength, key });
    out.ids.push(id);
    if (out.full) continue;
    try {
      if (await upload(db, server, id, sealed)) out.uploaded++;
    } catch (e) {
      if (isFull(e)) out.full = true;
      // Lo demás (sin conexión, sesión caducada…): se sube en la próxima vuelta.
    }
  }
  return out;
}

/**
 * El archivo, listo para ver: de este dispositivo si está; si no, del servidor (y se guarda aquí para la próxima vez).
 */
export async function readDocument(space: string, server: DocsServer | null, doc: PatientDocument): Promise<Uint8Array> {
  let sealed = await cacheGet(space, doc.id);
  if (!sealed) {
    if (!doc.uploadedAt) throw new Error("Este archivo aún no está en el servidor: lo tiene el dispositivo donde se añadió y lo subirá en cuanto tenga conexión.");
    const token = server?.token();
    if (!server || !token) throw new Error("Para abrir este archivo hace falta conexión y la sesión de Google (Ajustes › Cuenta).");
    sealed = await server.api.get(token, server.clinicId, doc.id);
    await cachePut(space, doc.id, sealed).catch(() => {});
  }
  return openDoc(sealed, doc.key);
}

export type DocSyncResult = { uploaded: number; deleted: number; full: boolean };

/** Sube lo que este dispositivo tiene pendiente y borra del servidor lo que se ha borrado aquí. */
export async function syncDocuments(db: Db, space: string, server: DocsServer): Promise<DocSyncResult> {
  const out: DocSyncResult = { uploaded: 0, deleted: 0, full: false };
  const token = server.token();
  if (!token) return out;
  for (const id of await trashedDocuments(db)) {
    await server.api.remove(token, server.clinicId, id);
    await cacheDelete(space, id).catch(() => {});
    await forgetTrashed(db, id);
    out.deleted++;
  }
  const here = new Set(await cacheKeys(space));
  for (const doc of await pendingUploads(db)) {
    // Los de otro dispositivo (aquí no están): los sube el suyo.
    if (!here.has(doc.id)) continue;
    const sealed = await cacheGet(space, doc.id);
    if (!sealed) continue;
    try {
      if (await upload(db, server, doc.id, sealed)) out.uploaded++;
    } catch (e) {
      if (!isFull(e)) throw e;
      out.full = true;
      break;
    }
  }
  return out;
}

/** Libera espacio en este dispositivo: borra de aquí los archivos que ya están en el servidor. Devuelve cuántos. */
export async function freeDeviceSpace(db: Db, space: string): Promise<number> {
  const uploaded = new Set((await db.query<{ id: string }>("select id from documents where uploaded_at is not null")).map((r) => r.id));
  let n = 0;
  for (const id of await cacheKeys(space)) {
    // Los pendientes de subir se quedan; los que ya no existen (borrados), fuera.
    const [row] = await db.query<{ id: string }>("select id from documents where id = ?", [id]);
    if (uploaded.has(id) || !row) {
      await cacheDelete(space, id);
      n++;
    }
  }
  return n;
}

// ---------- Si el servidor tiene documentos ----------

const usageKey = (clinicId: string) => `cenit.documentos.${clinicId}`;

/** Lo último que se supo del almacén de esta clínica (para enseñarlo sin conexión). */
export function lastUsage(clinicId: string): DocsUsage | null {
  try {
    return JSON.parse(localStorage.getItem(usageKey(clinicId)) ?? "null") as DocsUsage | null;
  } catch {
    return null;
  }
}

/** Pregunta al servidor si tiene documentos y cuánto ocupan, y lo recuerda. */
export async function fetchUsage(server: DocsServer): Promise<DocsUsage | null> {
  const token = server.token();
  if (!token) return lastUsage(server.clinicId);
  const usage = await server.api.usage(token, server.clinicId);
  try {
    localStorage.setItem(usageKey(server.clinicId), JSON.stringify(usage));
  } catch {
    /* sin almacenamiento: ya se preguntará */
  }
  return usage;
}
