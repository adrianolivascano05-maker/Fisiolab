// Worker que guarda la base en el almacenamiento privado del navegador (OPFS, VFS opfs-sahpool).
// Si el navegador no lo permite, usa una base en memoria y lo dice: la app avisa de que no se guardará.
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { Engine, type Storage } from "./engine";
import { migrations } from "./migrations";
import type { Request } from "./protocol";

const FILE = "/fisiolab.sqlite3";

/**
 * Solo una pestaña puede tener abierta la base en OPFS. Se reserva con un Web Lock que dura lo
 * que dure este worker (se suelta al cerrar la pestaña). Si otra pestaña lo tiene, esta lo dice
 * en vez de trabajar en una base vacía en memoria y perder lo que se escriba.
 */
function acquireTabLock(): Promise<boolean> {
  if (!("locks" in navigator)) return Promise.resolve(true);
  return new Promise((resolve) => {
    void navigator.locks.request("fisiolab-db", { ifAvailable: true }, (lock) => {
      resolve(lock !== null);
      return lock ? new Promise<void>(() => {}) : undefined;
    });
  });
}

async function start(): Promise<Engine | "locked"> {
  if (!(await acquireTabLock())) return "locked";
  const sqlite3 = await sqlite3InitModule();
  let storage: Storage;
  try {
    const pool = await sqlite3.installOpfsSAHPoolVfs({ name: "fisiolab-pool" });
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
  return new Engine(sqlite3, storage, migrations);
}

const ready = start();

self.onmessage = async (e: MessageEvent<{ id: number; req: Request }>) => {
  const { id, req } = e.data;
  try {
    const engine = await ready;
    if (engine === "locked") {
      if (req.op !== "info") throw new Error("La app está abierta en otra pestaña.");
      self.postMessage({ id, result: { persistent: false, sqliteVersion: "", schemaVersion: 0, locked: true } });
      return;
    }
    const result = await engine.handle(req);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
