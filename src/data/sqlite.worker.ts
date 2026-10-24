// Worker que guarda la base en el almacenamiento privado del navegador (OPFS, VFS opfs-sahpool).
// Si el navegador no lo permite, usa una base en memoria y lo dice: la app avisa de que no se guardará.
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { Engine, type Storage } from "./engine";
import { migrations } from "./migrations";
import type { Request } from "./protocol";

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
        await pool.importDb(FILE, bytes);
      },
    };
  } catch {
    storage = { persistent: false, open: () => new sqlite3.oo1.DB(":memory:", "c") };
  }
  const engine = new Engine(sqlite3, storage, migrations);
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
