// Dónde vive la copia de la base de cada cuenta: Google Drive (la carpeta oculta de la app) o el servidor de la
// clínica en Cloudflare (cloudflare/README.md: base de datos en la UE y solo copias cifradas). sync.ts habla con
// los dos igual.
import type { Token } from "./auth";
import { AuthError, createFile, deleteFile, download, listFiles, updateFile } from "./drive";

export type RemoteCopy = { id: string; version: string };

/** La copia ha cambiado desde que se leyó (otro dispositivo ha subido entre medias): hay que volver a juntar. */
export class RemoteConflict extends Error {
  constructor() {
    super("La copia de la nube ha cambiado mientras se subía.");
  }
}

export interface RemoteStore {
  /** Para los textos: «tu Drive», «el servidor de la clínica». */
  readonly where: string;
  /** Solo acepta copias cifradas: no se sube nada sin la contraseña de la copia. */
  readonly encryptedOnly: boolean;
  /** Las copias que hay (normalmente una), la más reciente primero. */
  list(token: Token): Promise<RemoteCopy[]>;
  download(token: Token, copy: RemoteCopy): Promise<Uint8Array>;
  create(token: Token, bytes: Uint8Array): Promise<RemoteCopy>;
  /** Sustituye la copia; RemoteConflict si ya no es la versión que se leyó (si el almacén lo sabe comprobar). */
  update(token: Token, copy: RemoteCopy, bytes: Uint8Array): Promise<RemoteCopy>;
  remove(token: Token, copy: RemoteCopy): Promise<void>;
}

export const driveStore: RemoteStore = {
  where: "tu Drive",
  encryptedOnly: false,
  list: async (t) => (await listFiles(t.accessToken)).map((f) => ({ id: f.id, version: f.version })),
  download: (t, c) => download(t.accessToken, c.id),
  create: async (t, bytes) => {
    const f = await createFile(t.accessToken, bytes);
    return { id: f.id, version: f.version };
  },
  update: async (t, c, bytes) => {
    const f = await updateFile(t.accessToken, c.id, bytes);
    return { id: f.id, version: f.version };
  },
  remove: (t, c) => deleteFile(t.accessToken, c.id),
};

/** El servidor de Cloudflare no ha podido atender (no hay red, no existe, error suyo…). */
export class ServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * La copia viaja y se guarda en base64: el servidor solo corta y junta texto, sin tocar los bytes (en el plan
 * gratuito cada petición tiene 10 ms de procesador).
 */
function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const fromBase64 = (text: string) => Uint8Array.from(atob(text.trim()), (c) => c.charCodeAt(0));

/** El servidor de la clínica en Cloudflare (cloudflare/worker.js): una copia por cuenta, con versión. */
export function cloudflareStore(baseUrl: string): RemoteStore {
  const base = baseUrl.replace(/\/+$/, "");
  const ID = "copia";
  async function call(t: Token, path: string, init: RequestInit = {}, ok: number[] = []): Promise<Response> {
    const res = await fetch(`${base}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${t.accessToken}` }, cache: "no-store" });
    if (res.ok || ok.includes(res.status)) return res;
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      /* sin detalle */
    }
    if (res.status === 401) throw new AuthError("La sesión de Google ha caducado.");
    if (res.status === 403) throw new ServerError(detail || "Tu cuenta no está autorizada en el servidor de la clínica.", 403);
    if (res.status === 412) throw new RemoteConflict();
    throw new ServerError(`El servidor de la clínica respondió ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
  }
  return {
    where: "el servidor de la clínica",
    encryptedOnly: true,
    async list(t) {
      // Sin copia aún, { version: null }.
      const { version } = (await (await call(t, "/v1/copia/info")).json()) as { version: string | null };
      return version ? [{ id: ID, version }] : [];
    },
    async download(t) {
      return fromBase64(await (await call(t, "/v1/copia")).text());
    },
    async create(t, bytes) {
      const res = await call(t, "/v1/copia", { method: "PUT", headers: { "If-None-Match": "*", "Content-Type": "text/plain" }, body: toBase64(bytes) });
      return { id: ID, version: ((await res.json()) as { version: string }).version };
    },
    async update(t, c, bytes) {
      const res = await call(t, "/v1/copia", { method: "PUT", headers: { "If-Match": `"${c.version}"`, "Content-Type": "text/plain" }, body: toBase64(bytes) });
      return { id: ID, version: ((await res.json()) as { version: string }).version };
    },
    async remove(t) {
      await call(t, "/v1/copia", { method: "DELETE" });
    },
  };
}
