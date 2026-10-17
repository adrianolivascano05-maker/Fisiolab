// Núcleo de la base de datos: abre, migra y atiende peticiones. Lo usan el worker del navegador
// y los tests en Node, así que no sabe nada de mensajes ni de OPFS.
import type { Bind, Info, Request, Statement } from "./protocol";

/* eslint-disable @typescript-eslint/no-explicit-any -- la API de sqlite-wasm no está tipada al detalle */
type Sqlite3 = any;
type DB = any;

export type Migration = { version: number; sql: string };

export type Storage = {
  persistent: boolean;
  open: () => DB;
  /** Sustituye el archivo de la base por `bytes`. Solo con la base cerrada. */
  replace?: (bytes: Uint8Array) => Promise<void>;
};

const SQLITE_HEADER = "SQLite format 3\u0000";

export class Engine {
  private db: DB;

  constructor(
    private sqlite3: Sqlite3,
    private storage: Storage,
    private migrations: Migration[],
  ) {
    this.db = this.openAndMigrate();
  }

  private openAndMigrate(): DB {
    const db = this.storage.open();
    db.exec("pragma foreign_keys = on;");
    const current = db.selectValue("pragma user_version") as number;
    for (const m of [...this.migrations].sort((a, b) => a.version - b.version)) {
      if (m.version <= current) continue;
      db.transaction(() => {
        db.exec(m.sql);
        db.exec(`pragma user_version = ${m.version}`);
      });
    }
    return db;
  }

  async handle(req: Request): Promise<unknown> {
    switch (req.op) {
      case "query":
        return this.query(req.sql, req.bind);
      case "transaction":
        return this.transaction(req.statements);
      case "export":
        return this.sqlite3.capi.sqlite3_js_db_export(this.db) as Uint8Array;
      case "import":
        return this.importBytes(req.bytes);
      case "info":
        return this.info();
    }
  }

  private query(sql: string, bind?: Bind) {
    return this.db.exec({ sql, bind, rowMode: "object", returnValue: "resultRows" });
  }

  private transaction(statements: Statement[]) {
    this.db.transaction(() => {
      for (const s of statements) this.db.exec({ sql: s.sql, bind: s.bind });
    });
    return null;
  }

  private info(): Info {
    return {
      persistent: this.storage.persistent,
      sqliteVersion: this.sqlite3.version.libVersion,
      schemaVersion: this.db.selectValue("pragma user_version") as number,
    };
  }

  /** Restaura una copia de seguridad. Si el archivo no es válido, deja la base como estaba. */
  private async importBytes(bytes: Uint8Array) {
    if (!this.storage.replace) throw new Error("Este navegador no permite restaurar copias.");
    const header = new TextDecoder().decode(bytes.slice(0, 16));
    if (header !== SQLITE_HEADER) throw new Error("El archivo no es una copia de seguridad válida.");
    const previous = this.sqlite3.capi.sqlite3_js_db_export(this.db) as Uint8Array;
    this.db.close();
    try {
      await this.storage.replace(bytes);
      this.db = this.openAndMigrate();
      const ok = this.db.selectValue("pragma integrity_check");
      const hasPatients = this.db.selectValue("select count(*) from sqlite_master where name = 'patients'");
      if (ok !== "ok" || !hasPatients) throw new Error("La copia está dañada o no es de esta app.");
    } catch (err) {
      try {
        this.db?.close();
      } catch {
        /* ya cerrada */
      }
      await this.storage.replace(previous);
      this.db = this.openAndMigrate();
      throw err;
    }
    return null;
  }
}
