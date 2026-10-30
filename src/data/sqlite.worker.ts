// Worker que guarda la base en el almacenamiento privado del navegador (OPFS, VFS opfs-sahpool).
// Si el navegador no lo permite, usa una base en memoria y lo dice: la app avisa de que no se guardará.
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { Engine, type BackupStore, type Storage } from "./engine";
import { migrations } from "./migrations";
import type { BackupInfo, Request } from "./protocol";

// Sin cuentas, la base de siempre. Con cuenta (src/cloud), la suya o la de su clínica: el nombre llega como nombre
// del worker, con lo que hay que hacer al abrirla (db.ts, configureDb): «adopt», pasarle lo que había sin cuenta;
// «from=<base>|member=<sub>», llevar a la base nueva de una clínica los pacientes de la base de esa cuenta.
const LEGACY = "/fisiolab.sqlite3";
const [account, ...flags] = (self.name || "").split("|");
const FILE = account ? `/${account}.sqlite3` : LEGACY;
const flag = (name: string) => flags.find((f) => f === name || f.startsWith(`${name}=`))?.slice(name.length + 1);

/**
 * Solo una pestaña puede tener abierta la base en OPFS. Se reserva con un Web Lock que dura lo que dure este worker
 * (se suelta al cerrar la pestaña). Se espera lo que haga falta: al recargar o al cambiar de página, la anterior puede
 * tardar unos segundos en soltarla (en un móvil lento). Si a los 3 s aún no se tiene, se avisa de que está en otra
 * pestaña (en vez de trabajar en una base vacía en memoria y perder lo que se escriba), y en cuanto se suelta, sigue.
 */
const LOCK_NOTICE_MS = 3000;
let waitingLock = false;
function acquireTabLock(): Promise<void> {
  if (!("locks" in navigator)) return Promise.resolve();
  return new Promise((resolve) => {
    const slow = setTimeout(() => (waitingLock = true), LOCK_NOTICE_MS);
    void navigator.locks.request("fisiolab-db", () => {
      clearTimeout(slow);
      waitingLock = false;
      resolve();
      return new Promise<void>(() => {});
    });
  });
}

type Sqlite3 = Awaited<ReturnType<typeof sqlite3InitModule>>;

/** Cuántas copias de antes de actualizar se guardan por base (las más recientes). */
const BACKUPS_KEPT = 2;
/** El acceso síncrono a un archivo de OPFS desde un worker (no está en los tipos del DOM). */
type SyncHandle = { truncate(size: number): void; write(bytes: Uint8Array, opts?: { at: number }): number; flush(): void; close(): void };
type SyncFileHandle = FileSystemFileHandle & { createSyncAccessHandle(): Promise<SyncHandle> };

/**
 * Las copias de antes de cada actualización de la base, en OPFS pero fuera del pool de SQLite: la carpeta
 * «antes-de-migrar/<base>/», con «v<de>-a-v<a>.sqlite3». Se escriben desde el worker con un acceso síncrono (vale
 * en Chrome, Safari y Firefox). Si OPFS no deja, la app sigue sin copias y lo dice en la consola.
 */
async function backupStore(base: string): Promise<BackupStore> {
  const dir = async () => (await (await navigator.storage.getDirectory()).getDirectoryHandle("antes-de-migrar", { create: true })).getDirectoryHandle(base, { create: true });
  const list = async (): Promise<BackupInfo[]> => {
    const d = await dir();
    const out: BackupInfo[] = [];
    for await (const [name, handle] of d as unknown as AsyncIterable<[string, FileSystemHandle]>) {
      if (handle.kind !== "file") continue;
      const f = await (handle as FileSystemFileHandle).getFile();
      out.push({ name, size: f.size, at: f.lastModified ? new Date(f.lastModified).toISOString() : null });
    }
    return out.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  };
  return {
    list,
    async read(name) {
      const f = await (await (await dir()).getFileHandle(name)).getFile();
      return new Uint8Array(await f.arrayBuffer());
    },
    async save(name, bytes) {
      const d = await dir();
      const handle = await ((await d.getFileHandle(name, { create: true })) as SyncFileHandle).createSyncAccessHandle();
      try {
        handle.truncate(0);
        handle.write(bytes, { at: 0 });
        handle.flush();
      } finally {
        handle.close();
      }
      for (const old of (await list()).slice(BACKUPS_KEPT)) await d.removeEntry(old.name);
    },
  };
}

/**
 * El almacenamiento privado (OPFS) solo lo puede tener abierto un contexto a la vez. La página anterior lo suelta al
 * morir, pero puede tardar un instante: se insiste unos segundos antes de rendirse y trabajar en memoria (donde se
 * perdería lo que se escriba). Si el navegador no tiene OPFS, no hay nada que esperar.
 */
async function openPool(sqlite3: Sqlite3) {
  const until = Date.now() + 5000;
  for (;;) {
    try {
      return await sqlite3.installOpfsSAHPoolVfs({ name: "fisiolab-pool", forceReinitIfPreviouslyFailed: true } as { name: string });
    } catch (err) {
      if (Date.now() >= until || (err instanceof Error && err.message.includes("Missing required OPFS APIs"))) throw err;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

async function start(): Promise<Engine> {
  await acquireTabLock();
  let adoptFrom: { bytes: Uint8Array; member: string; done: () => void } | null = null;
  const sqlite3 = await sqlite3InitModule();
  let storage: Storage;
  try {
    const pool = await openPool(sqlite3);
    // Cada base ocupa dos huecos (el archivo y su diario): sitio para varias cuentas en el mismo dispositivo.
    if (pool.getCapacity() - pool.getFileCount() < 4) await pool.addCapacity(4);
    const files: string[] = pool.getFileNames();
    // Primera vez con cuenta en este dispositivo: los datos que había sin cuenta pasan a ser suyos.
    if (flag("adopt") !== undefined && FILE !== LEGACY && !files.includes(FILE) && files.includes(LEGACY)) {
      await pool.importDb(FILE, pool.exportFile(LEGACY));
      pool.unlink(LEGACY);
    }
    // Primera vez en una clínica: se llevan a ella los pacientes de la cuenta (como al adoptar los de sin cuenta, la
    // base de la cuenta se borra cuando ya están en la de la clínica).
    const from = flag("from") && `/${flag("from")}.sqlite3`;
    const member = flag("member");
    if (from && member && !files.includes(FILE) && files.includes(from)) adoptFrom = { bytes: pool.exportFile(from), member, done: () => pool.unlink(from) };
    storage = {
      persistent: true,
      open: () => new pool.OpfsSAHPoolDb(FILE),
      replace: async (bytes) => {
        // Por trozos (aquí, uno): esa variante vacía el archivo antes de escribir. La directa no lo hace, y si la
        // copia nueva es más corta que la base de antes quedaban páginas viejas al final y la base salía dañada
        // («invalid rootpage») al restaurar una copia anterior.
        let sent = false;
        await pool.importDb(FILE, async () => (sent ? undefined : ((sent = true), bytes)));
      },
      backups: await backupStore(FILE.replace(/^\//, "").replace(/\.sqlite3$/, "")).catch((err: unknown) => {
        console.warn("Sin sitio para las copias de antes de actualizar:", err instanceof Error ? `${err.name}: ${err.message}` : String(err));
        return undefined;
      }),
    };
  } catch (err) {
    // Se ve en la consola del navegador (y en las pruebas): por qué no se guarda en el dispositivo.
    console.warn("Sin almacenamiento privado (OPFS); los datos irán en memoria:", err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    storage = { persistent: false, open: () => new sqlite3.oo1.DB(":memory:", "c") };
  }
  const engine = new Engine(sqlite3, storage, migrations);
  // La copia de antes de actualizar, escrita del todo antes de atender nada.
  await engine.backupDone.catch((err: unknown) => console.warn("No se pudo guardar la copia de antes de actualizar:", err instanceof Error ? err.message : err));
  if (adoptFrom) {
    try {
      await engine.handle({ op: "merge", bytes: adoptFrom.bytes, member: adoptFrom.member });
      adoptFrom.done();
    } catch (err) {
      // Los pacientes siguen en la base de la cuenta: la clínica se abre igual.
      console.error("No se pudieron llevar los pacientes a la clínica:", err instanceof Error ? err.message : err);
    }
  }
  return engine;
}

const ready = start();
let started = false;
void ready.then(
  () => (started = true),
  () => {},
);
const noticeAfter = new Promise<void>((resolve) => setTimeout(resolve, LOCK_NOTICE_MS));

self.onmessage = async (e: MessageEvent<{ id: number; req: Request }>) => {
  const { id, req } = e.data;
  try {
    if (!started) {
      // Aún sin la base: hasta 3 s se espera; si sigue en otra pestaña, se dice (y se sigue esperando por detrás).
      await Promise.race([ready, noticeAfter]);
      if (!started && waitingLock) {
        if (req.op !== "info") throw new Error("La app está abierta en otra pestaña.");
        self.postMessage({ id, result: { persistent: false, sqliteVersion: "", schemaVersion: 0, locked: true } });
        return;
      }
    }
    const engine = await ready;
    const result = await engine.handle(req);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
