// Worker que guarda la base en el almacenamiento privado del navegador (OPFS, VFS opfs-sahpool).
// Si el navegador no lo permite, usa una base en memoria y lo dice: la app avisa de que no se guardará.
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { Engine, type Storage } from "./engine";
import { migrations } from "./migrations";
import type { Request } from "./protocol";

const FILE = "/fisiolab.sqlite3";

async function start(): Promise<Engine> {
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
    const result = await engine.handle(req);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
