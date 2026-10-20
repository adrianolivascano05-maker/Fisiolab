// Junta la copia de la nube con la de este dispositivo, fila a fila: gana el cambio más reciente de cada fila
// (también los borrados), según el registro que dejan los disparadores de la migración 008. Trabaja sobre dos
// bases abiertas de SQLite WASM; el motor (engine.ts) la llama dentro de una transacción.

/* eslint-disable @typescript-eslint/no-explicit-any -- la API de sqlite-wasm no está tipada al detalle */
type DB = any;

/** Tablas que se sincronizan, de padres a hijos. `unique`: otras claves únicas además de la primaria. */
export const SYNC_TABLES: { name: string; pk: string[]; unique?: string[][] }[] = [
  { name: "patients", pk: ["id"] },
  { name: "free_measurements", pk: ["id"] },
  { name: "episodes", pk: ["id"] },
  { name: "tests", pk: ["id"] },
  { name: "profiles", pk: ["id"] },
  { name: "profile_tests", pk: ["profile_id", "test_id"] },
  { name: "results", pk: ["id"], unique: [["test_id", "metric", "series_index"]] },
  { name: "marks", pk: ["id"], unique: [["test_id", "event", "series_index"]] },
  { name: "videos", pk: ["id"], unique: [["test_id"]] },
  { name: "wellness", pk: ["id"] },
  { name: "anamnesis", pk: ["patient_id"] },
  { name: "findings", pk: ["id"] },
  { name: "sessions", pk: ["id"] },
  { name: "questionnaires", pk: ["id"] },
  { name: "consents", pk: ["id"] },
  { name: "validation_pairs", pk: ["id"] },
  { name: "settings", pk: ["key"] },
];

type Change = { tbl: string; pk: string; op: "upsert" | "delete"; at: string; device: string };
export type MergeResult = {
  /** Filas que han llegado de la nube (altas, cambios o borrados). */
  pulled: number;
  /** Este dispositivo tiene cambios que la nube no tiene: hay que subir la copia. */
  needUpload: boolean;
};

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const keyOf = (c: { tbl: string; pk: string }) => `${c.tbl}\u0000${c.pk}`;
/** `a` es posterior a `b`. A la misma hora decide el dispositivo, igual en los dos lados. */
const newer = (a: Change, b: Change) => a.at > b.at || (a.at === b.at && a.device > b.device);
const pkValues = (spec: { pk: string[] }, pk: string): unknown[] => (spec.pk.length === 1 ? [pk] : (JSON.parse(pk) as unknown[]));
const pkWhere = (spec: { pk: string[] }) => spec.pk.map((c) => `${c} = ?`).join(" and ");
const pkExpr = (spec: { pk: string[] }) => (spec.pk.length === 1 ? spec.pk[0]! : `json_array(${spec.pk.join(", ")})`);

const changes = (db: DB): Change[] => db.exec({ sql: "select tbl, pk, op, at, device from sync_changes", rowMode: "object", returnValue: "resultRows" });

function record(db: DB, c: Change) {
  db.exec({
    sql: `insert into sync_changes (tbl, pk, op, at, device) values (?, ?, ?, ?, ?)
          on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device`,
    bind: [c.tbl, c.pk, c.op, c.at, c.device],
  });
}

/** Un borrado hecho ahora por este dispositivo. */
function tombstone(db: DB, tbl: string, pk: string) {
  db.exec({
    sql: `insert into sync_changes (tbl, pk, op, at, device) values (?, ?, 'delete', ${NOW}, (select device from sync_state))
          on conflict (tbl, pk) do update set op = 'delete', at = excluded.at, device = excluded.device`,
    bind: [tbl, pk],
  });
  db.exec("update sync_state set changes = changes + 1");
}

/**
 * Deja la base vacía sin registrar borrados (al cerrar sesión borrando los datos del dispositivo): la copia de la
 * nube no se toca y, al volver a entrar, llega entera. Dentro de una transacción.
 */
export function wipeAll(db: DB) {
  db.exec("update sync_state set applying = 1");
  for (const t of [...SYNC_TABLES].reverse()) db.exec(`delete from ${t.name}`);
  db.exec("delete from sync_changes");
  db.exec("update sync_state set applying = 0, changes = 0, pushed = 0");
}

/**
 * Aplica en `local` lo que en `remote` es más reciente. Debe llamarse dentro de una transacción de `local`;
 * deja `sync_state.applying` a 0 al terminar.
 */
export function mergeInto(local: DB, remote: DB): MergeResult {
  const specs = new Map(SYNC_TABLES.map((t) => [t.name, t]));
  const mine = new Map(changes(local).map((c) => [keyOf(c), c]));
  const theirs = new Map(changes(remote).map((c) => [keyOf(c), c]));
  let needUpload = false;
  const wins: Change[] = [];
  for (const [k, r] of theirs) {
    if (!specs.has(r.tbl)) continue; // una tabla que esta versión no conoce: la copia es más nueva (se avisa antes)
    const l = mine.get(k);
    if (!l || newer(r, l)) wins.push(r);
    else if (newer(l, r)) needUpload = true;
  }
  for (const k of mine.keys()) if (!theirs.has(k)) needUpload = true;

  local.exec("update sync_state set applying = 1");
  // Las claves ajenas se comprueban al final: así no importa en qué orden llegan padres e hijos.
  local.exec("pragma defer_foreign_keys = on");

  // Primero los borrados (de hijos a padres), después altas y cambios (de padres a hijos).
  const order = (c: Change) => SYNC_TABLES.findIndex((t) => t.name === c.tbl);
  const deletes = wins.filter((c) => c.op === "delete").sort((a, b) => order(b) - order(a));
  const upserts = wins.filter((c) => c.op === "upsert").sort((a, b) => order(a) - order(b));
  for (const c of deletes) {
    const spec = specs.get(c.tbl)!;
    local.exec({ sql: `delete from ${c.tbl} where ${pkWhere(spec)}`, bind: pkValues(spec, c.pk) });
    record(local, c);
  }
  for (const c of upserts) {
    const spec = specs.get(c.tbl)!;
    const row = remote.selectObject(`select * from ${c.tbl} where ${pkWhere(spec)}`, pkValues(spec, c.pk)) as Record<string, unknown> | undefined;
    if (!row) continue; // el registro dice que existe pero no está: se queda como estaba
    // Otra fila de aquí con la misma clave única (p. ej. el mismo resultado del mismo test) pierde frente a esta.
    for (const cols of spec.unique ?? []) {
      const clash: Record<string, unknown>[] = local.exec({
        sql: `select ${pkExpr(spec)} as k from ${c.tbl} where ${cols.map((col) => `${col} is ?`).join(" and ")} and not (${pkWhere(spec)})`,
        bind: [...cols.map((col) => row[col]), ...pkValues(spec, c.pk)],
        rowMode: "object",
        returnValue: "resultRows",
      });
      for (const { k } of clash) {
        local.exec({ sql: `delete from ${c.tbl} where ${pkWhere(spec)}`, bind: pkValues(spec, String(k)) });
        record(local, { tbl: c.tbl, pk: String(k), op: "delete", at: c.at, device: c.device });
      }
    }
    const cols = Object.keys(row);
    const rest = cols.filter((col) => !spec.pk.includes(col));
    local.exec({
      sql: `insert into ${c.tbl} (${cols.join(", ")}) values (${cols.map(() => "?").join(", ")})
            on conflict (${spec.pk.join(", ")}) do ${rest.length ? `update set ${rest.map((col) => `${col} = excluded.${col}`).join(", ")}` : "nothing"}`,
      bind: cols.map((col) => row[col]),
    });
    record(local, c);
  }

  // Filas que se quedan sin padre (un paciente borrado en un lado y un test nuevo suyo en el otro): fuera.
  for (let guard = 0; guard < 10; guard++) {
    const orphans: { table: string; rowid: number }[] = local.exec({ sql: "pragma foreign_key_check", rowMode: "object", returnValue: "resultRows" });
    if (!orphans.length) break;
    for (const o of orphans) {
      const spec = specs.get(o.table);
      if (!spec) continue;
      const k = local.selectValue(`select ${pkExpr(spec)} from ${o.table} where rowid = ?`, [o.rowid]);
      local.exec({ sql: `delete from ${o.table} where rowid = ?`, bind: [o.rowid] });
      if (k !== undefined) {
        tombstone(local, o.table, String(k));
        needUpload = true;
      }
    }
  }

  // El registro tiene que decir la verdad: lo que figura como existente y ya no está (borrado en cascada) es un
  // borrado. Si la nube ya lo tenía borrado, se copia su borrado; si no, es un cambio de aquí.
  for (const spec of SYNC_TABLES) {
    const gone: { pk: string }[] = local.exec({
      sql: `select pk from sync_changes where tbl = ? and op = 'upsert' and pk not in (select ${pkExpr(spec)} from ${spec.name})`,
      bind: [spec.name],
      rowMode: "object",
      returnValue: "resultRows",
    });
    for (const { pk } of gone) {
      const r = theirs.get(keyOf({ tbl: spec.name, pk }));
      if (r?.op === "delete") record(local, r);
      else {
        tombstone(local, spec.name, pk);
        needUpload = true;
      }
    }
  }

  local.exec("update sync_state set applying = 0");
  return { pulled: wins.length, needUpload };
}
