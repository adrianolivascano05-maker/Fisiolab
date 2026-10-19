// Google Drive: la copia de la base en la carpeta oculta de la app (appDataFolder). Solo esta app la ve; la
// persona puede borrarla desde Drive → Configuración → Gestionar aplicaciones. API REST v3 con fetch.
import type { Account } from "./account";

const FILES = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";
export const FILE_NAME = "cenit-fisiolab.sqlite3";
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

async function resumable(token: string, init: { method: "POST" | "PATCH"; url: string; metadata: object }, bytes: Uint8Array): Promise<RemoteFile> {
  const start = await call(token, `${init.url}?uploadType=resumable&${fields}`, {
    method: init.method,
    headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "application/octet-stream" },
    body: JSON.stringify(init.metadata),
  });
  const session = start.headers.get("Location");
  if (!session) throw new Error("Google Drive no ha abierto la subida.");
  return (await (await call(token, session, { method: "PUT", body: bytes as BlobPart })).json()) as RemoteFile;
}

/** Sube la primera copia. */
export async function createFile(token: string, bytes: Uint8Array): Promise<RemoteFile> {
  const metadata = { name: FILE_NAME, parents: ["appDataFolder"], mimeType: "application/octet-stream" };
  if (bytes.byteLength > SIMPLE_LIMIT) return resumable(token, { method: "POST", url: UPLOAD, metadata }, bytes);
  const boundary = `cenit-${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    bytes as BlobPart,
    `\r\n--${boundary}--`,
  ]);
  const res = await call(token, `${UPLOAD}?uploadType=multipart&${fields}`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body });
  return (await res.json()) as RemoteFile;
}

/** Sustituye la copia por la nueva. */
export async function updateFile(token: string, id: string, bytes: Uint8Array): Promise<RemoteFile> {
  if (bytes.byteLength > SIMPLE_LIMIT) return resumable(token, { method: "PATCH", url: `${UPLOAD}/${id}`, metadata: {} }, bytes);
  const res = await call(token, `${UPLOAD}/${id}?uploadType=media&${fields}`, { method: "PATCH", headers: { "Content-Type": "application/octet-stream" }, body: bytes as BlobPart });
  return (await res.json()) as RemoteFile;
}

export async function deleteFile(token: string, id: string): Promise<void> {
  await call(token, `${FILES}/${id}`, { method: "DELETE" });
}
