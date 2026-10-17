// Base para tests en Node: el mismo motor y las mismas migraciones que el navegador,
// sobre el sistema de archivos en memoria de SQLite WASM.
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { dbFromHandler, type Db } from "./db";
import { Engine } from "./engine";
import { migrations } from "./migrations";

let counter = 0;

export async function createTestDb(): Promise<Db> {
  const sqlite3 = await sqlite3InitModule();
  const file = `/test-${counter++}.sqlite3`;
  const engine = new Engine(
    sqlite3,
    {
      persistent: false,
      open: () => new sqlite3.oo1.DB(file, "c"),
      replace: async (bytes) => {
        sqlite3.capi.sqlite3_js_posix_create_file(file, bytes);
      },
    },
    migrations,
  );
  return dbFromHandler((req) => engine.handle(req));
}
