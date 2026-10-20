// Worker que guarda la base en el almacenamiento privado del navegador (OPFS, VFS opfs-sahpool).
// Si el navegador no lo permite, usa una base en memoria y lo dice: la app avisa de que no se guardará.
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { Engine, type Storage } from "./engine";
import { migrations } from "./migrations";
import type { Request } from "./protocol";

// Sin cuentas, la base de siempre. Con cuenta (src/cloud), la suya: el nombre llega como nombre del worker.
const LEGACY = "/fisiolab.sqlite3";
const [account, flag] = (self.name || "").split("|");
const FILE = account ? `/${account}.sqlite3` : LEGACY;

/**
 * Solo una pestaña puede tener abierta la base en OPFS. Se reserva con un Web Lock que dura lo
 * que dure este worker (se suelta al cerrar la pestaña). Si otra pestaña lo tiene, esta lo dice
 * en vez de trabajar en una base vacía en memoria y perder lo que se escriba.
 */
function acquireTabLock(): Promise<boolean> {
  if (!("locks" in navigator)) return Promise.resolve(true);
  // Al recargar, la página anterior tarda un momento en soltarla: se espera hasta 3 s antes de decir que está ocupada.
  return new Promise((resolve) => {
    navigator.locks
      .request("fisiolab-db", { signal: AbortSignal.timeout(3000) }, () => {
        resolve(true);
        return new Promise<void>(() => {});
      })
      .catch(() => resolve(false));
  });
}

async function start(): Promise<Engine | "locked"> {
  if (!(await acquireTabLock())) return "locked";
  const sqlite3 = await sqlite3InitModule();
  let storage: Storage;
  try {
    const pool = await sqlite3.installOpfsSAHPoolVfs({ name: "fisiolab-pool" });
    // Cada base ocupa dos huecos (el archivo y su diario): sitio para varias cuentas en el mismo dispositivo.
    if (pool.getCapacity() - pool.getFileCount() < 4) await pool.addCapacity(4);
    // Primera vez con cuenta en este dispositivo: los datos que había sin cuenta pasan a ser suyos.
    if (flag === "adopt" && FILE !== LEGACY) {
      const files: string[] = pool.getFileNames();
      if (!files.includes(FILE) && files.includes(LEGACY)) {
        await pool.importDb(FILE, pool.exportFile(LEGACY));
        pool.unlink(LEGACY);
      }
    }
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
