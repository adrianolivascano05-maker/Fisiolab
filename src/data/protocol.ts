// Mensajes entre la app y el worker de SQLite.
export type Bind = Array<string | number | null>;
export type Statement = { sql: string; bind?: Bind };

export type Request =
  | { op: "query"; sql: string; bind?: Bind }
  | { op: "transaction"; statements: Statement[] }
  | { op: "export" }
  | { op: "import"; bytes: Uint8Array }
  | { op: "info" };

export type Info = {
  persistent: boolean;
  sqliteVersion: string;
  schemaVersion: number;
  /** La base ya está abierta en otra pestaña: esta no puede usarla. */
  locked?: boolean;
};
