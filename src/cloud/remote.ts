// Dónde vive la copia de la base de cada cuenta: Google Drive (la carpeta oculta de la app) o el servidor de la
// clínica en Cloudflare (cloudflare/README.md: base de datos en la UE y solo copias cifradas). sync.ts habla con
// los dos igual.
import type { Token } from "./auth";
import { AuthError, createFile, deleteFile, download, listFiles, updateFile } from "./drive";

/** `epoch` y `base`: con la sincronización por cambios, la época de la copia y hasta qué cambio lleva (DeltaApi). */
export type RemoteCopy = { id: string; version: string; epoch?: string | null; base?: number };

/** Lo que dice el servidor de la copia de una clínica con la sincronización por cambios (cloudflare/worker.js). */
export type DeltaInfo = {
  version: string | null;
  /** null: la clínica aún no sincroniza por cambios (la primera vuelta la pasa). */
  epoch: string | null;
  /** Hasta qué cambio lleva la copia entera (los anteriores ya no están). */
  base: number | null;
  /** El último cambio que hay. */
  last: number;
  /** Cambios guardados después de la copia entera, y cuánto ocupan. */
  deltas: number;
  deltaSize: number;
};
export type DeltaPage = { epoch: string; base: number; deltas: { seq: number; data: Uint8Array }[]; more: boolean };

/** La sincronización por cambios: cada dispositivo sube lo que ha cambiado y baja lo de los demás. */
export interface DeltaApi {
  /** null si el servidor es de una versión anterior (sin cambios): entonces, la copia entera como siempre. */
  info(token: Token): Promise<DeltaInfo | null>;
  /** Los cambios después de `seq` (por tandas: `more`). */
  since(token: Token, seq: number): Promise<DeltaPage>;
  /** Sube un lote cifrado; devuelve su número. */
  post(token: Token, bytes: Uint8Array): Promise<number>;
}

/** La copia ha cambiado desde que se leyó (otro dispositivo ha subido entre medias): hay que volver a juntar. */
export class RemoteConflict extends Error {
  constructor() {
    super("La copia de la nube ha cambiado mientras se subía.");
  }
}

export interface RemoteStore {
  /** Para los textos: «tu Drive», «el servidor de la clínica». */
  readonly where: string;
  /** Qué almacén es, para los textos y avisos (las dos solo reciben copias cifradas, sync.ts). */
  readonly kind: "drive" | "server";
  /** Las copias que hay (normalmente una), la más reciente primero. */
  list(token: Token): Promise<RemoteCopy[]>;
  download(token: Token, copy: RemoteCopy): Promise<Uint8Array>;
  /** `seq`: con la sincronización por cambios, hasta qué cambio lleva la copia. */
  create(token: Token, bytes: Uint8Array, seq?: number): Promise<RemoteCopy>;
  /** Sustituye la copia; RemoteConflict si ya no es la versión que se leyó (si el almacén lo sabe comprobar). */
  update(token: Token, copy: RemoteCopy, bytes: Uint8Array, seq?: number): Promise<RemoteCopy>;
  remove(token: Token, copy: RemoteCopy): Promise<void>;
  /** Solo el servidor de una clínica: sincronizar por cambios. */
  readonly deltas?: DeltaApi;
}

export const driveStore: RemoteStore = {
  where: "tu Drive",
  kind: "drive",
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

/**
 * Una petición al servidor de Cloudflare con la sesión de Google. AuthError si ha caducado, RemoteConflict si la copia
 * ha cambiado (412) y ServerError con el mensaje del servidor en lo demás. `ok`: otros estados que no son error.
 */
export async function serverCall(baseUrl: string, t: Token, path: string, init: RequestInit = {}, ok: number[] = []): Promise<Response> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${t.accessToken}` },
    cache: "no-store",
  });
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
  throw new ServerError(detail || `El servidor de la clínica respondió ${res.status}.`, res.status);
}

/**
 * El servidor de la clínica en Cloudflare (cloudflare/worker.js): la copia de la clínica `clinicId`, que comparte
 * todo su equipo (src/cloud/clinic.ts), con versión. Sin clínica, la copia de la cuenta (versiones anteriores).
 */
export function cloudflareStore(baseUrl: string, clinicId?: string): RemoteStore {
  const path = clinicId ? `/v1/clinicas/${encodeURIComponent(clinicId)}/copia` : "/v1/copia";
  const ID = "copia";
  // La app de ahora sabe sincronizar por cambios (?v=2): un servidor de una versión anterior no mira la consulta.
  const v2 = clinicId ? "?v=2" : "";
  const call = (t: Token, sub: string, init?: RequestInit) => serverCall(baseUrl, t, path + sub, init);
  const put = async (t: Token, bytes: Uint8Array, seq: number | undefined, precondition: Record<string, string>): Promise<RemoteCopy> => {
    const res = await call(t, clinicId ? `${v2}&seq=${seq ?? 0}` : "", { method: "PUT", headers: { ...precondition, "Content-Type": "text/plain" }, body: toBase64(bytes) });
    const r = (await res.json()) as { version: string; epoch?: string | null; base?: number };
    return { id: ID, version: r.version, epoch: r.epoch, base: r.base };
  };
  const deltas: DeltaApi = {
    async info(t) {
      const r = (await (await call(t, `/info${v2}`)).json()) as Partial<DeltaInfo>;
      return typeof r.last === "number" ? (r as DeltaInfo) : null;
    },
    async since(t, seq) {
      const r = (await (await call(t, `/cambios${v2}&desde=${seq}`)).json()) as Omit<DeltaPage, "deltas"> & { deltas: { seq: number; data: string }[] };
      return { ...r, deltas: r.deltas.map((d) => ({ seq: d.seq, data: fromBase64(d.data) })) };
    },
    async post(t, bytes) {
      const res = await call(t, `/cambios${v2}`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: toBase64(bytes) });
      return ((await res.json()) as { seq: number }).seq;
    },
  };
  return {
    where: "el servidor de la clínica",
    kind: "server",
    async list(t) {
      // Sin copia aún, { version: null }.
      const { version } = (await (await call(t, `/info${v2}`)).json()) as { version: string | null };
      return version ? [{ id: ID, version }] : [];
    },
    async download(t) {
      return fromBase64(await (await call(t, v2)).text());
    },
    create: (t, bytes, seq) => put(t, bytes, seq, { "If-None-Match": "*" }),
    update: (t, c, bytes, seq) => put(t, bytes, seq, { "If-Match": `"${c.version}"` }),
    async remove(t) {
      await call(t, v2, { method: "DELETE" });
    },
    ...(clinicId ? { deltas } : {}),
  };
}
