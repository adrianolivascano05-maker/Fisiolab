// Mensajes entre la app y el worker de SQLite.
import type { DeltaItem } from "./syncMerge";
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
  | { op: "merge"; bytes: Uint8Array; member?: string }
  /** Sincronización por cambios: lo que falta por subir, y aplicar un lote de otros dispositivos (de la versión `schema`). */
  | { op: "pending" }
  | { op: "apply"; items: DeltaItem[]; schema: number }
  /** Vacía la base sin que cuente como borrado (cerrar sesión borrando los datos del dispositivo). */
  | { op: "wipe" }
  /** Las copias de este dispositivo de antes de cada actualización de la base (engine.ts), y leer una. */
  | { op: "backups" }
  | { op: "backup"; name: string };

/** Una copia de antes de actualizar la base: su nombre («v20-a-v34.sqlite3»), cuánto ocupa y de cuándo es. */
export type BackupInfo = { name: string; size: number; at: string | null };

export type Snapshot = { bytes: Uint8Array; changes: number };

export type Info = {
  persistent: boolean;
  sqliteVersion: string;
  schemaVersion: number;
  /** La base ya está abierta en otra pestaña: esta no puede usarla. */
  locked?: boolean;
};
