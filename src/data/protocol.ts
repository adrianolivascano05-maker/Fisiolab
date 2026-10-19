// Mensajes entre la app y el worker de SQLite.
export type Bind = Array<string | number | null>;
export type Statement = { sql: string; bind?: Bind };

export type Request =
  | { op: "query"; sql: string; bind?: Bind }
  | { op: "transaction"; statements: Statement[] }
  | { op: "export" }
  | { op: "import"; bytes: Uint8Array }
  | { op: "info" }
  /** Sincronización: la copia y cuántos cambios lleva (a la vez), y juntar con la copia de la nube. */
  | { op: "snapshot" }
  | { op: "merge"; bytes: Uint8Array }
  /** Vacía la base sin que cuente como borrado (cerrar sesión borrando los datos del dispositivo). */
  | { op: "wipe" };

export type Snapshot = { bytes: Uint8Array; changes: number };

export type Info = {
  persistent: boolean;
  sqliteVersion: string;
  schemaVersion: number;
  /** La base ya está abierta en otra pestaña: esta no puede usarla. */
  locked?: boolean;
};
