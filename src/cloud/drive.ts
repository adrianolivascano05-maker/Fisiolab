// Google Drive: la copia de la base en la carpeta oculta de la app (appDataFolder). Solo esta app la ve; la
// persona puede borrarla desde Drive → Configuración → Gestionar aplicaciones. Además, con el permiso drive.file,
// los archivos que la persona guarda a la vista (informes en PDF, resultados en CSV) en la carpeta «OmniClin» de su
// Drive: la app solo ve los archivos que ha creado ella. API REST v3 con fetch.
import type { Account } from "./account";

const FILES = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";
const FILE_NAME = "cenit-fisiolab.sqlite3";
/** Hasta aquí, subida en una sola petición; por encima, subida reanudable (Drive no acepta más de 5 MB de golpe). */
const SIMPLE_LIMIT = 4.5 * 1024 * 1024;

export type RemoteFile = { id: string; version: string; modifiedTime: string };

/** El token ha caducado o se ha retirado el permiso: hay que volver a entrar. */
export class AuthError extends Error {}

/** Google ha respondido con un error (404 no existe, 409 ya existe…). */
export class GoogleError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Petición a una API de Google con el token. Los errores, como AuthError o GoogleError. */
export async function call(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new AuthError("La sesión de Google ha caducado.");
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? "";
    } catch {
      /* sin detalle */
    }
    if (res.status === 403 && /insufficient|scope/i.test(detail)) throw new AuthError("Falta un permiso de Google: vuelve a entrar y acéptalo.");
    throw new GoogleError(`Google respondió ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
  }
  return res;
}

export async function userInfo(token: string): Promise<Account> {
  const u = (await (await call(token, USERINFO)).json()) as { sub: string; email: string; name?: string; picture?: string };
  return { sub: u.sub, email: u.email, name: u.name || u.email, picture: u.picture };
}

/** Las copias de la app (normalmente una), la más reciente primero. */
export async function listFiles(token: string): Promise<RemoteFile[]> {
  const q = encodeURIComponent(`name = '${FILE_NAME}' and trashed = false`);
  const url = `${FILES}?spaces=appDataFolder&q=${q}&orderBy=modifiedTime desc&pageSize=10&fields=files(id,version,modifiedTime)`;
  return ((await (await call(token, url)).json()) as { files: RemoteFile[] }).files;
}

export async function download(token: string, id: string): Promise<Uint8Array> {
  return new Uint8Array(await (await call(token, `${FILES}/${id}?alt=media`)).arrayBuffer());
}

const fields = "fields=id,version,modifiedTime";

async function resumable<T>(token: string, init: { method: "POST" | "PATCH"; url: string; metadata: object; contentType?: string; fields?: string }, bytes: Uint8Array): Promise<T> {
  const contentType = init.contentType ?? "application/octet-stream";
  const start = await call(token, `${init.url}?uploadType=resumable&${init.fields ?? fields}`, {
    method: init.method,
    headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": contentType },
    body: JSON.stringify(init.metadata),
  });
  const session = start.headers.get("Location");
  if (!session) throw new Error("Google Drive no ha abierto la subida.");
  return (await (await call(token, session, { method: "PUT", headers: { "Content-Type": contentType }, body: bytes as BlobPart })).json()) as T;
}

/** Sube un archivo nuevo con sus metadatos (nombre, carpeta, tipo). */
async function upload<T>(token: string, metadata: { name: string; parents: string[]; mimeType: string }, bytes: Uint8Array, fieldList: string): Promise<T> {
  if (bytes.byteLength > SIMPLE_LIMIT) return resumable<T>(token, { method: "POST", url: UPLOAD, metadata, contentType: metadata.mimeType, fields: fieldList }, bytes);
  const boundary = `cenit-${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`,
    bytes as BlobPart,
    `\r\n--${boundary}--`,
  ]);
  const res = await call(token, `${UPLOAD}?uploadType=multipart&${fieldList}`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body });
  return (await res.json()) as T;
}

/** Sube la primera copia. */
export function createFile(token: string, bytes: Uint8Array): Promise<RemoteFile> {
  return upload<RemoteFile>(token, { name: FILE_NAME, parents: ["appDataFolder"], mimeType: "application/octet-stream" }, bytes, fields);
}

// ---------- Archivos a la vista (drive.file) ----------

export const FOLDER_NAME = "OmniClin";
/** Los nombres que tuvo la carpeta (la app se llamó Cénit hasta el 28-10-2026): la que ya existe se renombra, no se crea otra. */
export const OLD_FOLDER_NAMES = ["Cénit · Fisiolab"];
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Le pone el nombre de ahora; si Google no deja, se queda como estaba (sigue sirviendo). */
async function renameFolder(token: string, id: string) {
  await call(token, `${FILES}/${id}?fields=id`, { method: "PATCH", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify({ name: FOLDER_NAME }) }).catch(() => {});
}

/** La carpeta de la app en «Mi unidad»: la guardada si sigue ahí (y no en la papelera); si no, la que se llame así (o como antes); si no, otra. */
export async function ensureFolder(token: string, id: string | null): Promise<string> {
  if (id) {
    try {
      const f = (await (await call(token, `${FILES}/${id}?fields=id,trashed,name`)).json()) as { trashed?: boolean; name?: string };
      if (!f.trashed) {
        if (f.name && OLD_FOLDER_NAMES.includes(f.name)) await renameFolder(token, id);
        return id;
      }
    } catch (e) {
      if (!(e instanceof GoogleError && e.status === 404)) throw e;
    }
  }
  for (const name of [FOLDER_NAME, ...OLD_FOLDER_NAMES]) {
    const q = encodeURIComponent(`name = '${name}' and mimeType = '${FOLDER_MIME}' and trashed = false`);
    const found = ((await (await call(token, `${FILES}?q=${q}&pageSize=1&fields=files(id)`)).json()) as { files: { id: string }[] }).files[0];
    if (!found) continue;
    if (name !== FOLDER_NAME) await renameFolder(token, found.id);
    return found.id;
  }
  const res = await call(token, `${FILES}?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  return ((await res.json()) as { id: string }).id;
}

export type VisibleFile = { id: string; webViewLink?: string };

/** Guarda un archivo a la vista en la carpeta. */
export function uploadVisible(token: string, folder: string, name: string, mimeType: string, bytes: Uint8Array): Promise<VisibleFile> {
  return upload<VisibleFile>(token, { name, parents: [folder], mimeType }, bytes, "fields=id,webViewLink");
}

/** Sustituye la copia por la nueva. */
export async function updateFile(token: string, id: string, bytes: Uint8Array): Promise<RemoteFile> {
  if (bytes.byteLength > SIMPLE_LIMIT) return resumable<RemoteFile>(token, { method: "PATCH", url: `${UPLOAD}/${id}`, metadata: {} }, bytes);
  const res = await call(token, `${UPLOAD}/${id}?uploadType=media&${fields}`, { method: "PATCH", headers: { "Content-Type": "application/octet-stream" }, body: bytes as BlobPart });
  return (await res.json()) as RemoteFile;
}

export async function deleteFile(token: string, id: string): Promise<void> {
  await call(token, `${FILES}/${id}`, { method: "DELETE" });
}
