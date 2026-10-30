import type { BackupInfo, Bind, Info, Request, Snapshot, Statement } from "./protocol";
import type { DeltaItem, MergeResult, Pending } from "./syncMerge";

/** Acceso a la base. La app usa el worker; los tests, el motor directamente. Mismas firmas. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, bind?: Bind): Promise<T[]>;
  transaction(statements: Statement[]): Promise<void>;
  exportBytes(): Promise<Uint8Array>;
  importBytes(bytes: Uint8Array): Promise<void>;
  info(): Promise<Info>;
  /**
   * Sincronización (src/cloud): la copia con su número de cambios, y juntarla con la de la nube. `member`: es la base
   * de la cuenta de esa persona, que se lleva a la de su clínica (syncMerge.ts, prepareForClinic).
   */
  snapshot(): Promise<Snapshot>;
  merge(bytes: Uint8Array, member?: string): Promise<MergeResult>;
  /** Sincronización por cambios (syncMerge.ts): lo que falta por subir, y aplicar un lote de otro dispositivo. */
  pending(): Promise<Pending>;
  apply(items: DeltaItem[], schema: number): Promise<MergeResult>;
  wipe(): Promise<void>;
  /** Las copias de este dispositivo de antes de cada actualización de la base (engine.ts), y leer una. */
  listBackups(): Promise<BackupInfo[]>;
  readBackup(name: string): Promise<Uint8Array>;
}

export function dbFromHandler(handle: (req: Request) => Promise<unknown>): Db {
  return {
    query: (sql, bind) => handle({ op: "query", sql, bind }) as Promise<never>,
    transaction: async (statements) => {
      await handle({ op: "transaction", statements });
    },
    exportBytes: () => handle({ op: "export" }) as Promise<Uint8Array>,
    importBytes: async (bytes) => {
      await handle({ op: "import", bytes });
    },
    info: () => handle({ op: "info" }) as Promise<Info>,
    snapshot: () => handle({ op: "snapshot" }) as Promise<Snapshot>,
    merge: (bytes, member) => handle({ op: "merge", bytes, member }) as Promise<MergeResult>,
    pending: () => handle({ op: "pending" }) as Promise<Pending>,
    apply: (items, schema) => handle({ op: "apply", items, schema }) as Promise<MergeResult>,
    wipe: async () => {
      await handle({ op: "wipe" });
    },
    listBackups: () => handle({ op: "backups" }) as Promise<BackupInfo[]>,
    readBackup: (name) => handle({ op: "backup", name }) as Promise<Uint8Array>,
  };
}

let shared: Db | null = null;

/**
 * La base que se abre: `name`, el archivo (sin «.sqlite3»). `adopt`: pasarle lo que había sin cuenta. `from` y
 * `member`: es la base nueva de una clínica y se le llevan los pacientes de la base `from` de esa persona.
 */
export type DbFile = { name: string; adopt?: boolean; from?: string; member?: string };
let file: DbFile | null = null;
const listeners = new Set<() => void>();

/**
 * Qué base abrir: la de la cuenta con la que se ha entrado (src/cloud/account.ts) o, sin cuentas, la de siempre.
 * Antes de la primera llamada a getDb.
 */
export function configureDb(f: DbFile | null) {
  if (shared) throw new Error("La base ya está abierta.");
  file = f;
}

/** Avisa después de cada cambio en la base hecho por la app (para sincronizar). Devuelve cómo dejar de avisar. */
export function onDbChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** La base de la app (un único worker para toda la sesión). */
export function getDb(): Db {
  if (shared) return shared;
  // El nombre del worker le dice qué archivo abrir y qué hacer al abrirlo (sqlite.worker.ts).
  const name = file ? [file.name, file.adopt && "adopt", file.from && file.member && `from=${file.from}|member=${file.member}`].filter(Boolean).join("|") : "";
  const worker = new Worker(new URL("./sqlite.worker.ts", import.meta.url), { type: "module", name });
  let next = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.error) p.reject(new Error(e.data.error));
    else p.resolve(e.data.result);
  };
  // Al dejar la página se cierra la base. Safari guarda la página anterior «congelada» para volver atrás deprisa, con
  // su base abierta: la página nueva (al volver de entrar con Google, al cambiar de clínica, al recargar) la
  // encontraría ocupada y diría que la app está abierta en otra pestaña. Si se vuelve a la congelada, se recarga.
  // Lo que estuviera a medias se queda sin respuesta (la página ya no se ve): avisar de un error ahí solo haría ruido.
  let closed = false;
  addEventListener("pagehide", () => {
    closed = true;
    worker.terminate();
  });
  addEventListener("pageshow", (e) => {
    if (e.persisted && closed) location.reload();
  });
  const base = dbFromHandler(
    (req) =>
      new Promise((resolve, reject) => {
        if (closed) return;
        const id = next++;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, req });
      }),
  );
  const changed = () => listeners.forEach((fn) => fn());
  shared = {
    ...base,
    transaction: async (statements) => {
      await base.transaction(statements);
      changed();
    },
    importBytes: async (bytes) => {
      await base.importBytes(bytes);
      changed();
    },
  };
  return shared;
}
