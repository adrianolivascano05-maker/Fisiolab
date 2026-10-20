// Junta la copia de la nube con la de este dispositivo, fila a fila: gana el cambio más reciente de cada fila
// (también los borrados), según el registro que dejan los disparadores de la migración 008. Trabaja sobre dos
// bases abiertas de SQLite WASM; el motor (engine.ts) la llama dentro de una transacción.

import { MEMBER_SETTINGS } from "./member";

/* eslint-disable @typescript-eslint/no-explicit-any -- la API de sqlite-wasm no está tipada al detalle */
type DB = any;

/** El ajuste con la sal de la contraseña de cifrado (src/cloud/crypt.ts, ENCRYPTION_KEY). */
const ENCRYPTION_SETTING = "drive_encryption";

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
  { name: "appointments", pk: ["id"] },
  { name: "staff", pk: ["email"] },
  { name: "shifts", pk: ["id"] },
  { name: "questionnaires", pk: ["id"] },
  { name: "consents", pk: ["id"] },
  { name: "validation_pairs", pk: ["id"] },
  { name: "settings", pk: ["key"] },
  { name: "devices", pk: ["device"] },
];

type Change = { tbl: string; pk: string; op: "upsert" | "delete"; at: string; device: string };
/** Un cambio con la fila tal como quedó (sin fila si es un borrado): lo que viaja en la sincronización por cambios. */
export type DeltaItem = Change & { row?: Record<string, unknown> };
/** Lo que falta por subir: los cambios hechos aquí después del último subido, y hasta qué número llegan. */
export type Pending = { changes: number; items: DeltaItem[] };
export type MergeResult = {
  /** Filas que han llegado de la nube (altas, cambios o borrados). */
  pulled: number;
  /** Este dispositivo tiene cambios que la nube no tiene: hay que subir la copia. */
  needUpload: boolean;
  /**
   * Filas que se acababan de cambiar aquí (hace menos de un cuarto de hora) y que otro dispositivo ha cambiado después:
   * se queda lo suyo. Para avisar («Editado por»).
   */
  overwritten?: { tbl: string; pk: string; device: string }[];
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

/** Un borrado hecho ahora por este dispositivo (con su número de cambio: hay que subirlo, migración 017). */
function tombstone(db: DB, tbl: string, pk: string) {
  db.exec({
    sql: `insert into sync_changes (tbl, pk, op, at, device, n) values (?, ?, 'delete', ${NOW}, (select device from sync_state), (select changes from sync_state) + 1)
          on conflict (tbl, pk) do update set op = 'delete', at = excluded.at, device = excluded.device, n = excluded.n`,
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
 * Deja la base de una cuenta lista para juntarla con la de una clínica (al llevar a ella los pacientes del
 * dispositivo). Sin registrar cambios nuevos: cada fila conserva la hora de su último cambio.
 * - Lo que es de cada persona pasa a ser de `sub`: su calendario, su carpeta de Drive, su nombre y nº de colegiado
 *   y las citas que ha dado (src/data/member.ts).
 * - La contraseña de cifrado de la cuenta no vale para la clínica, que tiene la suya: fuera.
 * - Los demás ajustes, como si fueran de siempre: si la clínica ya tiene los suyos, ganan los de la clínica.
 */
export function prepareForClinic(db: DB, sub: string) {
  const keys = MEMBER_SETTINGS.map(() => "?").join(", ");
  db.exec("update sync_state set applying = 1");
  db.exec({ sql: "delete from settings where key = ?", bind: [ENCRYPTION_SETTING] });
  db.exec({ sql: "delete from sync_changes where tbl = 'settings' and pk = ?", bind: [ENCRYPTION_SETTING] });
  db.exec({ sql: `update settings set key = key || '@' || ? where key in (${keys})`, bind: [sub, ...MEMBER_SETTINGS] });
  db.exec({ sql: `update sync_changes set pk = pk || '@' || ? where tbl = 'settings' and pk in (${keys})`, bind: [sub, ...MEMBER_SETTINGS] });
  db.exec({
    sql: `insert into settings (key, value)
          select ?, json_object('professional', coalesce(json_extract(value, '$.professional'), ''), 'license', coalesce(json_extract(value, '$.license'), ''))
            from settings where key = 'clinic_privacy'`,
    bind: [`professional@${sub}`],
  });
  db.exec({
    sql: "insert into sync_changes (tbl, pk, op, at, device) select 'settings', ?, op, at, device from sync_changes where tbl = 'settings' and pk = 'clinic_privacy' and op = 'upsert'",
    bind: [`professional@${sub}`],
  });
  db.exec("update settings set value = json_set(value, '$.professional', '', '$.license', '') where key = 'clinic_privacy'");
  db.exec("update sync_changes set at = '1970-01-01T00:00:00.000Z' where tbl = 'settings' and pk not like '%@%'");
  db.exec({ sql: "update appointments set created_by = ? where created_by is null", bind: [sub] });
  db.exec("update sync_state set applying = 0");
}

/**
 * Aplica en `local` lo que en `remote` es más reciente. Debe llamarse dentro de una transacción de `local`;
 * deja `sync_state.applying` a 0 al terminar.
 */
export function mergeInto(local: DB, remote: DB): MergeResult {
  const specs = new Map(SYNC_TABLES.map((t) => [t.name, t]));
  const rowOf = (c: Change) => remote.selectObject(`select * from ${c.tbl} where ${pkWhere(specs.get(c.tbl)!)}`, pkValues(specs.get(c.tbl)!, c.pk)) as Record<string, unknown> | undefined;
  return apply(local, changes(remote), rowOf, true);
}

/**
 * Aplica en `local` un lote de cambios de otros dispositivos (sincronización por cambios), con la misma regla: gana
 * el más reciente de cada fila. Dentro de una transacción de `local`.
 */
export function applyDelta(local: DB, items: DeltaItem[]): MergeResult {
  const byKey = new Map(items.map((i) => [keyOf(i), i]));
  return apply(local, [...byKey.values()], (c) => byKey.get(keyOf(c))?.row, false);
}

/** Lo que falta por subir de este dispositivo: los cambios con número mayor que el último subido, con sus filas. */
export function pendingChanges(db: DB): Pending {
  const specs = new Map(SYNC_TABLES.map((t) => [t.name, t]));
  const [state] = db.exec({ sql: "select changes, pushed from sync_state", rowMode: "object", returnValue: "resultRows" }) as { changes: number; pushed: number }[];
  const list: Change[] = db.exec({
    sql: "select tbl, pk, op, at, device from sync_changes where n > ? order by n",
    bind: [state!.pushed],
    rowMode: "object",
    returnValue: "resultRows",
  });
  const items: DeltaItem[] = [];
  for (const c of list) {
    const spec = specs.get(c.tbl);
    if (!spec) continue;
    if (c.op === "delete") {
      items.push(c);
      continue;
    }
    const row = db.selectObject(`select * from ${c.tbl} where ${pkWhere(spec)}`, pkValues(spec, c.pk)) as Record<string, unknown> | undefined;
    if (row) items.push({ ...c, row });
  }
  return { changes: state!.changes, items };
}

/**
 * Junta con `local` los cambios `incoming` (las filas, con `rowOf`). `full`: es una copia entera, que trae todo; si
 * no, es un lote de cambios y solo se mira lo que trae (sin calcular si hay que subir: eso lo dice el número de cada
 * cambio, migración 017).
 */
function apply(local: DB, incoming: Change[], rowOf: (c: Change) => Record<string, unknown> | undefined, full: boolean): MergeResult {
  const specs = new Map(SYNC_TABLES.map((t) => [t.name, t]));
  const mine = full ? new Map(changes(local).map((c) => [keyOf(c), c])) : null;
  const theirs = new Map(incoming.map((c) => [keyOf(c), c]));
  const mineOf = (c: Change): Change | undefined =>
    mine
      ? mine.get(keyOf(c))
      : (local.selectObject("select tbl, pk, op, at, device from sync_changes where tbl = ? and pk = ?", [c.tbl, c.pk]) as Change | undefined);
  let needUpload = false;
  const wins: Change[] = [];
  const here = local.selectValue("select device from sync_state") as string;
  const recent = new Date(Date.now() - 15 * 60_000).toISOString();
  const overwritten: { tbl: string; pk: string; device: string }[] = [];
  for (const r of theirs.values()) {
    if (!specs.has(r.tbl)) continue; // una tabla que esta versión no conoce: la copia es más nueva (se avisa antes)
    const l = mineOf(r);
    if (l && newer(r, l) && l.device === here && r.device !== here && l.op === "upsert" && l.at > recent) overwritten.push({ tbl: r.tbl, pk: r.pk, device: r.device });
    if (!l || newer(r, l)) wins.push(r);
    else if (newer(l, r)) needUpload = true;
  }
  if (mine) for (const k of mine.keys()) if (!theirs.has(k)) needUpload = true;

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
    const row = rowOf(c);
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
  // Con un lote de cambios sin borrados, basta con mirar las tablas que han recibido filas.
  const checks = full || deletes.length ? ["pragma foreign_key_check"] : [...new Set(upserts.map((c) => c.tbl))].map((t) => `pragma foreign_key_check(${t})`);
  for (let guard = 0; guard < 10 && checks.length; guard++) {
    const orphans: { table: string; rowid: number }[] = checks.flatMap((sql) => local.exec({ sql, rowMode: "object", returnValue: "resultRows" }));
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
  for (const spec of full || deletes.length ? SYNC_TABLES : []) {
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
  return { pulled: wins.length, needUpload, overwritten };
}
