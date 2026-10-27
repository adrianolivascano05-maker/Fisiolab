// Una D1 de prueba para worker.test.ts: la parte de la API de D1 que usa worker.js (prepare, bind, run, all,
// first, batch en una transacción, meta.changes y meta.size_after) sobre SQLite WASM en memoria, con las tablas de
// schema.sql.
// Como D1, acepta los BLOB como ArrayBuffer, vista o lista de números y los devuelve como lista de números.
import sqlite3InitModule, { type Database, type SqlValue } from "@sqlite.org/sqlite-wasm";
import { readFileSync } from "node:fs";

export type D1Row = Record<string, unknown>;
export type D1Result = { success: true; results: D1Row[]; meta: { changes: number; size_after: number } };

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
let sqlite3: Promise<Awaited<ReturnType<typeof sqlite3InitModule>>> | null = null;

export class D1Statement {
  constructor(
    private readonly shim: D1Shim,
    readonly sql: string,
    readonly params: readonly unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1Statement {
    return new D1Statement(this.shim, this.sql, values);
  }
  async run(): Promise<D1Result> {
    return this.shim.execute(this);
  }
  async all(): Promise<D1Result> {
    return this.shim.execute(this);
  }
  async first(): Promise<D1Row | null> {
    return this.shim.execute(this).results[0] ?? null;
  }
}

export class D1Shim {
  constructor(readonly db: Database) {}

  prepare(sql: string): D1Statement {
    return new D1Statement(this, sql);
  }

  async batch(statements: D1Statement[]): Promise<D1Result[]> {
    this.db.exec("BEGIN");
    try {
      const out = statements.map((s) => this.execute(s));
      this.db.exec("COMMIT");
      return out;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  execute(statement: D1Statement): D1Result {
    const before = this.db.changes(true);
    const rows = this.db.exec({
      sql: statement.sql,
      bind: statement.params.length ? statement.params.map(toSql) : undefined,
      rowMode: "object",
      returnValue: "resultRows",
    }) as D1Row[];
    const results = rows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Uint8Array ? Array.from(v) : v])),
    );
    const size = Number(this.db.selectValue("PRAGMA page_count")) * Number(this.db.selectValue("PRAGMA page_size"));
    return { success: true, results, meta: { changes: Number(this.db.changes(true)) - Number(before), size_after: size } };
  }
}

/** Como D1: los bytes como BLOB, true/false como 1/0, y undefined no vale. */
function toSql(value: unknown): SqlValue {
  if (value === undefined) throw new TypeError("D1_TYPE_ERROR: Type 'undefined' not supported");
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  return value as SqlValue;
}

/** Una base nueva, vacía, con las tablas de schema.sql. */
export async function createD1(): Promise<D1Shim> {
  sqlite3 ??= sqlite3InitModule();
  const db = new (await sqlite3).oo1.DB(":memory:", "c");
  db.exec(schema);
  return new D1Shim(db);
}
