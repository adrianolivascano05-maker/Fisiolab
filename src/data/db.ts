import type { Bind, Info, Request, Statement } from "./protocol";

/** Acceso a la base. La app usa el worker; los tests, el motor directamente. Mismas firmas. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, bind?: Bind): Promise<T[]>;
  transaction(statements: Statement[]): Promise<void>;
  exportBytes(): Promise<Uint8Array>;
  importBytes(bytes: Uint8Array): Promise<void>;
  info(): Promise<Info>;
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
  };
}

let shared: Db | null = null;

/** La base de la app (un único worker para toda la sesión). */
export function getDb(): Db {
  if (shared) return shared;
  const worker = new Worker(new URL("./sqlite.worker.ts", import.meta.url), { type: "module" });
  let next = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.error) p.reject(new Error(e.data.error));
    else p.resolve(e.data.result);
  };
  shared = dbFromHandler(
    (req) =>
      new Promise((resolve, reject) => {
        const id = next++;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, req });
      }),
  );
  return shared;
}
