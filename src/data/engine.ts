// Núcleo de la base de datos: abre, migra y atiende peticiones. Lo usan el worker del navegador
// y los tests en Node, así que no sabe nada de mensajes ni de OPFS.
import type { BackupInfo, Bind, Info, Request, Snapshot, Statement } from "./protocol";
import { applyDelta, mergeInto, pendingChanges, prepareForClinic, wipeAll, type DeltaItem, type MergeResult, type Pending } from "./syncMerge";

/* eslint-disable @typescript-eslint/no-explicit-any -- la API de sqlite-wasm no está tipada al detalle */
type Sqlite3 = any;
type DB = any;

export type Migration = { version: number; sql: string };

/**
 * Dónde se guardan las copias de antes de cada actualización de la base (fuera de la base; en el navegador, en OPFS
 * aparte del pool: sqlite.worker.ts). `save` se queda con las 2 últimas.
 */
export type BackupStore = {
  save: (name: string, bytes: Uint8Array) => Promise<void>;
  list: () => Promise<BackupInfo[]>;
  read: (name: string) => Promise<Uint8Array>;
};

export type Storage = {
  persistent: boolean;
  open: () => DB;
  /** Sustituye el archivo de la base por `bytes`. Solo con la base cerrada. */
  replace?: (bytes: Uint8Array) => Promise<void>;
  /** Las copias de antes de actualizar; sin esto, no se guardan (base en memoria, pruebas). */
  backups?: BackupStore;
};

/** El nombre de la copia de antes de actualizar: de qué versión a cuál. */
export const backupName = (from: number, to: number) => `v${from}-a-v${to}.sqlite3`;

const SQLITE_HEADER = "SQLite format 3\u0000";

/**
 * Para buscar en la base (src/data/patientSearch.ts): fold() quita tildes y mayúsculas, como fold de
 * src/app/format.ts, y digits() deja solo las cifras (un teléfono escrito con espacios o guiones).
 */
function addFunctions(db: DB) {
  const opts = { deterministic: true, arity: 1 };
  db.createFunction("fold", (_: unknown, s: unknown) => (s == null ? null : String(s).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()), opts);
  db.createFunction("digits", (_: unknown, s: unknown) => (s == null ? null : String(s).replace(/\D/g, "")), opts);
}

export class Engine {
  private db: DB;
  /** La copia de antes de actualizar, si se está guardando: el worker la espera antes de atender nada. */
  backupDone: Promise<void> = Promise.resolve();

  constructor(
    private sqlite3: Sqlite3,
    private storage: Storage,
    private migrations: Migration[],
  ) {
    this.db = this.openAndMigrate();
  }

  private openAndMigrate(): DB {
    return this.migrate(this.storage.open(), { backup: true });
  }

  /**
   * Aplica las migraciones que falten, cada una en su transacción (si una falla, no se aplica). Con `backup`, antes
   * de tocar una base que ya tiene datos (user_version > 0) se guarda tal como está (Storage.backups): si una
   * migración aplica algo equivocado, se sincroniza a todos los dispositivos y no hay vuelta atrás del esquema, así
   * que esa copia es la forma de recuperar los datos. No se hace con la copia de la nube (merge), que es de otro.
   */
  private migrate(db: DB, { backup }: { backup: boolean }): DB {
    db.exec("pragma foreign_keys = on;");
    addFunctions(db);
    const current = db.selectValue("pragma user_version") as number;
    const pending = [...this.migrations].sort((a, b) => a.version - b.version).filter((m) => m.version > current);
    if (backup && current > 0 && pending.length && this.storage.backups) {
      // Si no se puede sacar la copia (sin memoria para duplicar la base, p. ej.), se actualiza igual: quedarse sin
      // abrir la base sería peor que quedarse sin esa copia.
      try {
        const bytes = this.sqlite3.capi.sqlite3_js_db_export(db) as Uint8Array;
        this.backupDone = this.storage.backups.save(backupName(current, pending.at(-1)!.version), bytes);
      } catch (e) {
        console.warn("No se pudo guardar la copia de antes de actualizar:", e);
      }
    }
    for (const m of pending) {
      db.transaction(() => {
        db.exec(m.sql);
        db.exec(`pragma user_version = ${m.version}`);
      });
    }
    return db;
  }

  private get latestVersion() {
    return Math.max(...this.migrations.map((m) => m.version));
  }

  /** Abre una copia (bytes de un archivo .sqlite3) en memoria, sin tocar la base. */
  private openBytes(bytes: Uint8Array): DB {
    const header = new TextDecoder().decode(bytes.slice(0, 16));
    if (header !== SQLITE_HEADER) throw new Error("La copia de la nube no es una base de esta app.");
    const { capi, wasm, oo1 } = this.sqlite3;
    const db = new oo1.DB(":memory:", "c");
    const p = wasm.allocFromTypedArray(bytes);
    const rc = capi.sqlite3_deserialize(db.pointer, "main", p, bytes.byteLength, bytes.byteLength, capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE);
    db.checkRc(rc);
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
      case "snapshot":
        return this.snapshot();
      case "merge":
        return this.merge(req.bytes, req.member);
      case "pending":
        return pendingChanges(this.db) as Pending;
      case "apply":
        return this.applyDelta(req.items, req.schema);
      case "wipe":
        this.db.transaction(() => wipeAll(this.db));
        return null;
      case "backups":
        return this.storage.backups ? this.storage.backups.list() : ([] as BackupInfo[]);
      case "backup":
        if (!this.storage.backups) throw new Error("Este dispositivo no guarda copias de antes de actualizar.");
        return this.storage.backups.read(req.name);
    }
  }

  private snapshot(): Snapshot {
    return {
      bytes: this.sqlite3.capi.sqlite3_js_db_export(this.db) as Uint8Array,
      changes: this.db.selectValue("select changes from sync_state") as number,
    };
  }

  /**
   * Junta la copia de la nube con esta base (src/data/syncMerge.ts). Si algo falla, la base queda como estaba.
   * `member`: es la base de la cuenta de esa persona, que se lleva a la base de su clínica (prepareForClinic).
   */
  private merge(bytes: Uint8Array, member?: string): MergeResult {
    const remote = this.openBytes(bytes);
    try {
      if (remote.selectValue("pragma integrity_check") !== "ok") throw new Error("La copia de la nube está dañada.");
      const version = remote.selectValue("pragma user_version") as number;
      if (version > this.latestVersion) throw new Error("La copia de la nube es de una versión más nueva de la app: actualiza la app en este dispositivo.");
      this.migrate(remote, { backup: false });
      if (member) remote.transaction(() => prepareForClinic(remote, member));
      let result: MergeResult = { pulled: 0, needUpload: false };
      this.db.transaction(() => {
        result = mergeInto(this.db, remote);
        // Lo que se trae de la base de la cuenta es de este dispositivo y aún no está en la clínica: todo por subir.
        if (member) this.db.exec("update sync_changes set n = (select changes from sync_state) + 1; update sync_state set changes = changes + 1");
      });
      return result;
    } finally {
      remote.close();
    }
  }

  /** Un lote de cambios de otro dispositivo (sincronización por cambios). Si algo falla, la base queda como estaba. */
  private applyDelta(items: DeltaItem[], schema: number): MergeResult {
    if (schema > this.latestVersion) throw new Error("Hay cambios hechos con una versión más nueva de la app: actualiza la app en este dispositivo.");
    let result: MergeResult = { pulled: 0, needUpload: false };
    this.db.transaction(() => {
      result = applyDelta(this.db, items);
    });
    return result;
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

  /**
   * Restaura una copia de seguridad. Si el archivo no es válido, deja la base como estaba. Las facturas no se pierden:
   * las emitidas después de la copia se vuelven a poner (una factura emitida no se borra y su número no se repite).
   */
  private async importBytes(bytes: Uint8Array) {
    if (!this.storage.replace) throw new Error("Este navegador no permite restaurar copias.");
    const header = new TextDecoder().decode(bytes.slice(0, 16));
    if (header !== SQLITE_HEADER) throw new Error("El archivo no es una copia de seguridad válida.");
    const previous = this.sqlite3.capi.sqlite3_js_db_export(this.db) as Uint8Array;
    const invoices = this.query("select * from invoices") as Record<string, Bind[number]>[];
    this.db.close();
    try {
      await this.storage.replace(bytes);
      this.db = this.openAndMigrate();
      // La copia de antes de actualizar, escrita del todo antes de contestar: si la página se recarga al momento, no
      // se queda a medias.
      await this.backupDone.catch(() => {});
      const ok = this.db.selectValue("pragma integrity_check");
      const hasPatients = this.db.selectValue("select count(*) from sqlite_master where name = 'patients'");
      if (ok !== "ok" || !hasPatients) throw new Error("La copia está dañada o no es de esta app.");
      // Las facturas que no estaban en la copia, tal cual (y se sincronizan como un cambio de este dispositivo).
      if (invoices.length) {
        const cols = Object.keys(invoices[0]!);
        const sql = `insert or ignore into invoices (${cols.join(", ")}) values (${cols.map(() => "?").join(", ")})`;
        this.transaction(invoices.map((r) => ({ sql, bind: cols.map((c) => r[c] ?? null) })));
      }
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
