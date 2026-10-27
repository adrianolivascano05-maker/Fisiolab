// Dónde vive la copia de la base de cada cuenta: Google Drive (la carpeta oculta de la app) o el servidor de la
// clínica en Cloudflare (cloudflare/README.md: base de datos en la UE y solo copias cifradas). sync.ts habla con
// los dos igual.
import type { Token } from "./auth";
import { isPieces } from "./crypt";
import { AuthError, createFile, deleteFile, download, listFiles, updateFile } from "./drive";

/** `epoch` y `base`: con la sincronización por cambios, la época de la copia y hasta qué cambio lleva (DeltaApi). */
export type RemoteCopy = { id: string; version: string; epoch?: string | null; base?: number };

/** Lo que dice el servidor de la copia de una clínica con la sincronización por cambios (cloudflare/worker.js). */
export type DeltaInfo = {
  version: string | null;
  /** Lo que ocupa la copia entera (bytes, aproximados si está en base64). */
  size?: number;
  /** null: la clínica aún no sincroniza por cambios (la primera vuelta la pasa). */
  epoch: string | null;
  /** Hasta qué cambio lleva la copia entera (los anteriores ya no están). */
  base: number | null;
  /** El último cambio que hay. */
  last: number;
  /** Cambios guardados después de la copia entera, y cuánto ocupan. */
  deltas: number;
  deltaSize: number;
  /** Respuestas de pacientes por recoger (un servidor de una versión anterior no lo dice). */
  forms?: number;
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
  /**
   * El servidor guarda la copia entera en R2 por trozos (lo dice la última consulta): se cifra por trozos
   * (crypt.ts, encryptPieces) y se sube en bytes, sin base64 y sin tope de 50 MB.
   */
  readonly pieces?: boolean;
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

/** Intentos de cada trozo de la copia si se corta la conexión o el servidor falla (el móvil cambia de red…). */
const PART_TRIES = 3;

/**
 * El servidor de la clínica en Cloudflare (cloudflare/worker.js): la copia de la clínica `clinicId`, que comparte
 * todo su equipo (src/cloud/clinic.ts), con versión. Sin clínica, la copia de la cuenta (versiones anteriores).
 */
export function cloudflareStore(baseUrl: string, clinicId?: string): RemoteStore {
  const path = clinicId ? `/v1/clinicas/${encodeURIComponent(clinicId)}/copia` : "/v1/copia";
  const ID = "copia";
  // La app de ahora sabe sincronizar por cambios (?v=2) y leer la copia en R2 (&trozos=1): un servidor de una versión
  // anterior no mira la consulta.
  const v2 = clinicId ? "?v=2&trozos=1" : "";
  /** Si el servidor guarda la copia en R2 (lo dice /info: la última vez que se ha mirado). */
  let pieces = false;
  const call = (t: Token, sub: string, init?: RequestInit) => serverCall(baseUrl, t, path + sub, init);
  const put = async (t: Token, bytes: Uint8Array, seq: number | undefined, precondition: Record<string, string>): Promise<RemoteCopy> => {
    if (clinicId && isPieces(bytes)) return putPieces(t, bytes, seq ?? 0, precondition);
    const res = await call(t, clinicId ? `${v2}&seq=${seq ?? 0}` : "", { method: "PUT", headers: { ...precondition, "Content-Type": "text/plain" }, body: toBase64(bytes) });
    const r = (await res.json()) as { version: string; epoch?: string | null; base?: number };
    return { id: ID, version: r.version, epoch: r.epoch, base: r.base };
  };
  /**
   * La copia a R2: se empieza la subida, cada trozo por separado (con reintentos) y se termina con la misma condición.
   * Si algo falla, se deja la subida (R2 borra los trozos) y la siguiente vuelta empieza de nuevo.
   */
  const putPieces = async (t: Token, bytes: Uint8Array, seq: number, precondition: Record<string, string>): Promise<RemoteCopy> => {
    const start = (await (await call(t, `/subida${v2}`, { method: "POST", headers: precondition })).json()) as { version: string; upload: string; partBytes: number };
    const at = `/subida/${start.version}`;
    const id = `&id=${encodeURIComponent(start.upload)}`;
    try {
      const parts: { part: number; etag: string }[] = [];
      for (let n = 1; (n - 1) * start.partBytes < bytes.byteLength; n++) {
        const body = bytes.subarray((n - 1) * start.partBytes, n * start.partBytes);
        for (let attempt = 1; ; attempt++) {
          try {
            const res = await call(t, `${at}/${n}${v2}${id}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: body as BodyInit });
            parts.push((await res.json()) as { part: number; etag: string });
            break;
          } catch (e) {
            const retry = e instanceof TypeError || (e instanceof ServerError && e.status >= 500);
            if (!retry || attempt >= PART_TRIES) throw e;
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }
      }
      const res = await call(t, `${at}/fin${v2}${id}&seq=${seq}`, {
        method: "POST",
        headers: { ...precondition, "Content-Type": "application/json" },
        body: JSON.stringify({ parts, size: bytes.byteLength }),
      });
      const r = (await res.json()) as { version: string; epoch?: string | null; base?: number };
      return { id: ID, version: r.version, epoch: r.epoch, base: r.base };
    } catch (e) {
      await call(t, `${at}${v2}${id}`, { method: "DELETE" }).catch(() => {});
      throw e;
    }
  };
  const readInfo = async (t: Token) => {
    const r = (await (await call(t, `/info${v2}`)).json()) as Partial<DeltaInfo> & { pieces?: boolean };
    pieces = r.pieces === true;
    return r;
  };
  const deltas: DeltaApi = {
    async info(t) {
      const r = await readInfo(t);
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
    get pieces() {
      return pieces;
    },
    async list(t) {
      // Sin copia aún, { version: null }.
      const { version } = await readInfo(t);
      return version ? [{ id: ID, version }] : [];
    },
    async download(t) {
      const res = await call(t, v2);
      // En R2, los bytes tal cual; en D1 (o un servidor anterior), base64.
      if (res.headers.get("Content-Type")?.startsWith("application/octet-stream")) return new Uint8Array(await res.arrayBuffer());
      return fromBase64(await res.text());
    },
    create: (t, bytes, seq) => put(t, bytes, seq, { "If-None-Match": "*" }),
    update: (t, c, bytes, seq) => put(t, bytes, seq, { "If-Match": `"${c.version}"` }),
    async remove(t) {
      await call(t, v2, { method: "DELETE" });
    },
    ...(clinicId ? { deltas } : {}),
  };
}
