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
  { name: "closures", pk: ["id"] },
  { name: "questionnaires", pk: ["id"] },
  { name: "consents", pk: ["id"] },
  { name: "packs", pk: ["id"] },
  { name: "payments", pk: ["id"] },
  { name: "invoices", pk: ["id"] },
  { name: "waitlist", pk: ["id"], unique: [["patient_id"]] },
  { name: "exercises", pk: ["id"] },
  { name: "exercise_plans", pk: ["id"] },
  { name: "patient_forms", pk: ["id"] },
  { name: "documents", pk: ["id"] },
  { name: "outbox", pk: ["id"] },
  { name: "validation_pairs", pk: ["id"] },
  { name: "settings", pk: ["key"] },
  { name: "devices", pk: ["device"] },
];

/**
 * Columnas con un objeto JSON de respuestas: cada respuesta cuenta como un campo («answers.motivo»), así dos personas
 * que contestan preguntas distintas de la misma anamnesis no se pisan (migración 033).
 */
export const JSON_FIELDS: Record<string, string[]> = { anamnesis: ["answers"], episodes: ["answers"] };

/** `born`: cuándo nació la fila (migración 033); sin él (dispositivos sin actualizar), la hora del cambio. */
type Change = { tbl: string; pk: string; op: "upsert" | "delete"; at: string; device: string; born?: string | null; n?: number };
/**
 * Un cambio con la fila tal como quedó (sin fila si es un borrado): lo que viaja en la sincronización por cambios.
 * `fields`: los campos cambiados después del alta y cuándo (migración 033).
 */
export type DeltaItem = Change & { row?: Record<string, unknown>; fields?: Record<string, string> };
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

const changes = (db: DB): Change[] => db.exec({ sql: "select tbl, pk, op, at, device, born, n from sync_changes", rowMode: "object", returnValue: "resultRows" });

/**
 * Sentencias preparadas una vez y reutilizadas: al juntar una copia entera se escriben cientos de miles de filas, y
 * preparar cada sentencia cada vez es lo que más tarda. `close` al terminar.
 */
class Stmts {
  private cache = new Map<string, { bind(v: unknown[]): unknown; step(): boolean; get(o: object): Record<string, unknown>; reset(): unknown; stepReset(): unknown; finalize(): unknown }>();
  constructor(private db: DB) {}
  private stmt(sql: string) {
    let st = this.cache.get(sql);
    if (!st) {
      st = this.db.prepare(sql);
      this.cache.set(sql, st!);
    }
    return st!;
  }
  run(sql: string, bind: unknown[]) {
    const st = this.stmt(sql);
    if (bind.length) st.bind(bind);
    st.stepReset();
  }
  one(sql: string, bind: unknown[]): Record<string, unknown> | undefined {
    const st = this.stmt(sql);
    if (bind.length) st.bind(bind);
    try {
      return st.step() ? st.get({}) : undefined;
    } finally {
      st.reset();
    }
  }
  all(sql: string, bind: unknown[]): Record<string, unknown>[] {
    const st = this.stmt(sql);
    if (bind.length) st.bind(bind);
    const out: Record<string, unknown>[] = [];
    try {
      while (st.step()) out.push(st.get({}));
    } finally {
      st.reset();
    }
    return out;
  }
  close() {
    for (const st of this.cache.values()) st.finalize();
    this.cache.clear();
  }
}

const RECORD = `insert into sync_changes (tbl, pk, op, at, device, born) values (?, ?, ?, ?, ?, ?)
          on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device, born = excluded.born`;

function record(db: DB | Stmts, c: Change) {
  const bind = [c.tbl, c.pk, c.op, c.at, c.device, c.born ?? c.at];
  if (db instanceof Stmts) db.run(RECORD, bind);
  else db.exec({ sql: RECORD, bind });
}

/** La hora y el dispositivo del último cambio de cada campo de una fila. */
type FieldTimes = Map<string, { at: string; device: string }>;

const FIELDS = "select field, at, device from sync_fields where tbl = ? and pk = ?";

function fieldsOf(db: DB | Stmts, tbl: string, pk: string): FieldTimes {
  const rows = (
    db instanceof Stmts ? db.all(FIELDS, [tbl, pk]) : db.exec({ sql: FIELDS, bind: [tbl, pk], rowMode: "object", returnValue: "resultRows" })
  ) as { field: string; at: string; device: string }[];
  return new Map(rows.map((r) => [r.field, { at: r.at, device: r.device }]));
}

/** Los campos de una fila. `fresh`: la fila es nueva aquí y no tiene ninguno que borrar. */
function saveFields(q: Stmts, tbl: string, pk: string, times: FieldTimes, fresh = false) {
  if (!fresh) q.run("delete from sync_fields where tbl = ? and pk = ?", [tbl, pk]);
  for (const [field, t] of times) q.run("insert into sync_fields (tbl, pk, field, at, device) values (?, ?, ?, ?, ?)", [tbl, pk, field, t.at, t.device]);
}

/** Dos valores de SQLite iguales (los blob, byte a byte). */
function same(a: unknown, b: unknown): boolean {
  if (a instanceof Uint8Array && b instanceof Uint8Array) return a.length === b.length && a.every((x, i) => x === b[i]);
  return a === b;
}

/** Dos valores JSON iguales (sin mirar el orden de las claves). */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => k in b && sameJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** El objeto JSON guardado en una columna de texto; null si no es un objeto. */
function objectIn(v: unknown): Record<string, unknown> | null {
  if (typeof v !== "string") return null;
  try {
    const o = JSON.parse(v) as unknown;
    return typeof o === "object" && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Un instante justo después de `at` (o ahora, si es más tarde): para un cambio nuevo que tiene que ganar a los dos. */
function after(...ats: string[]): string {
  const latest = Math.max(...ats.map((a) => Date.parse(a)).filter((t) => !Number.isNaN(t)));
  return new Date(Math.max(Date.now(), latest + 1)).toISOString();
}

/** Lo que se queda de una fila que han cambiado los dos lados, campo a campo (ver `apply`). */
type Merged = {
  row: Record<string, unknown>;
  times: FieldTimes;
  born: string;
  /** Lo de aquí que ha perdido frente a otro valor de otro dispositivo, y cuándo se había cambiado aquí. */
  lost: { field: string; mine: unknown; theirs: unknown; mineAt: string }[];
};

/**
 * Junta campo a campo una fila que está en los dos lados: de cada campo se queda el cambiado más tarde (si los dos lo
 * tienen a la misma hora, el del cambio más reciente de la fila). Un campo sin cambios desde el alta tiene la hora
 * del alta (`born`). En las columnas de JSON_FIELDS, cada respuesta por separado. updated_at: la más reciente.
 * `mineNow`: el cambio de un campo es de este dispositivo y los demás aún no lo han visto (para guardar lo que pierde).
 */
function mergeRow(
  tbl: string,
  pk: string[],
  local: { row: Record<string, unknown>; change: Change; fields: FieldTimes },
  remote: { row: Record<string, unknown>; change: Change; fields: FieldTimes },
  mineNow: (change: { at: string; device: string }) => boolean,
): Merged {
  const lBorn = local.change.born ?? local.change.at;
  const rBorn = remote.change.born ?? remote.change.at;
  const tie = newer(remote.change, local.change);
  const when = (side: typeof local, born: string, field: string) => side.fields.get(field)?.at ?? born;
  const out: Merged = { row: { ...local.row }, times: new Map(), born: lBorn > rBorn ? lBorn : rBorn, lost: [] };
  /** Decide un campo: true si se queda el de fuera. Apunta su hora si alguno de los dos la tenía. */
  const decide = (field: string, differ: boolean, mine: () => unknown, theirs: () => unknown): boolean => {
    const l = when(local, lBorn, field);
    const r = when(remote, rBorn, field);
    const theirsWins = r > l || (r === l && tie);
    const lf = local.fields.get(field);
    const rf = remote.fields.get(field);
    if (lf || rf) out.times.set(field, theirsWins ? { at: r, device: rf?.device ?? remote.change.device } : { at: l, device: lf?.device ?? local.change.device });
    if (theirsWins && differ && lf && mineNow(lf)) out.lost.push({ field, mine: mine(), theirs: theirs(), mineAt: lf.at });
    return theirsWins;
  };
  for (const col of Object.keys(remote.row)) {
    if (pk.includes(col)) continue;
    const mine = local.row[col];
    const theirs = remote.row[col];
    if (col === "updated_at") {
      if (typeof mine === "string" && typeof theirs === "string") out.row[col] = theirs > mine ? theirs : mine;
      else out.row[col] = mine ?? theirs;
      continue;
    }
    const lo = JSON_FIELDS[tbl]?.includes(col) ? objectIn(mine) : null;
    const ro = lo ? objectIn(theirs) : null;
    if (lo && ro) {
      // Respuesta a respuesta: se queda la contestada (o quitada) más tarde.
      const merged: Record<string, unknown> = {};
      for (const k of new Set([...Object.keys(lo), ...Object.keys(ro)])) {
        const src = decide(`${col}.${k}`, !sameJson(lo[k], ro[k]), () => lo[k], () => ro[k]) ? ro : lo;
        if (k in src) merged[k] = src[k];
      }
      // La columna entera también lleva su hora (por si un día deja de ser un objeto): la más reciente.
      const lc = local.fields.get(col);
      const rc = remote.fields.get(col);
      const latest = lc && rc ? (rc.at > lc.at ? rc : lc) : (lc ?? rc);
      if (latest) out.times.set(col, latest);
      out.row[col] = sameJson(merged, lo) ? mine : sameJson(merged, ro) ? theirs : JSON.stringify(merged);
      continue;
    }
    if (decide(col, !same(mine, theirs), () => mine, () => theirs)) out.row[col] = theirs;
  }
  return out;
}

/** Un borrado hecho ahora por este dispositivo (con su número de cambio: hay que subirlo, migración 017). */
function tombstone(db: DB, tbl: string, pk: string) {
  db.exec({
    sql: `insert into sync_changes (tbl, pk, op, at, device, n) values (?, ?, 'delete', ${NOW}, (select device from sync_state), (select changes from sync_state) + 1)
          on conflict (tbl, pk) do update set op = 'delete', at = excluded.at, device = excluded.device, n = excluded.n`,
    bind: [tbl, pk],
  });
  db.exec({ sql: "delete from sync_fields where tbl = ? and pk = ?", bind: [tbl, pk] });
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
  db.exec("delete from sync_fields");
  db.exec("delete from sync_conflicts");
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
  db.exec({ sql: `update sync_fields set pk = pk || '@' || ? where tbl = 'settings' and pk in (${keys})`, bind: [sub, ...MEMBER_SETTINGS] });
  db.exec({
    sql: `insert into settings (key, value)
          select ?, json_object('professional', coalesce(json_extract(value, '$.professional'), ''), 'license', coalesce(json_extract(value, '$.license'), ''))
            from settings where key = 'clinic_privacy'`,
    bind: [`professional@${sub}`],
  });
  db.exec({
    sql: "insert into sync_changes (tbl, pk, op, at, device, born) select 'settings', ?, op, at, device, born from sync_changes where tbl = 'settings' and pk = 'clinic_privacy' and op = 'upsert'",
    bind: [`professional@${sub}`],
  });
  db.exec("update settings set value = json_set(value, '$.professional', '', '$.license', '') where key = 'clinic_privacy'");
  db.exec("update sync_changes set at = '1970-01-01T00:00:00.000Z', born = '1970-01-01T00:00:00.000Z' where tbl = 'settings' and pk not like '%@%'");
  db.exec("delete from sync_fields where tbl = 'settings' and pk not like '%@%'");
  db.exec({ sql: "update appointments set created_by = ? where created_by is null", bind: [sub] });
  db.exec("update sync_state set applying = 0");
}

/** Los campos de una fila tal como los da un lote (todos del dispositivo que hizo el cambio). */
const deltaFields = (c: DeltaItem): FieldTimes => new Map(Object.entries(c.fields ?? {}).map(([f, at]) => [f, { at, device: c.device }]));

/**
 * Aplica en `local` lo que en `remote` es más reciente. Debe llamarse dentro de una transacción de `local`;
 * deja `sync_state.applying` a 0 al terminar.
 */
export function mergeInto(local: DB, remote: DB): MergeResult {
  const specs = new Map(SYNC_TABLES.map((t) => [t.name, t]));
  // Los campos de toda la copia, de una vez (cada fila los pide).
  const fields = new Map<string, FieldTimes>();
  const all: { tbl: string; pk: string; field: string; at: string; device: string }[] = remote.exec({
    sql: "select tbl, pk, field, at, device from sync_fields",
    rowMode: "object",
    returnValue: "resultRows",
  });
  for (const f of all) {
    const k = keyOf(f);
    if (!fields.has(k)) fields.set(k, new Map());
    fields.get(k)!.set(f.field, { at: f.at, device: f.device });
  }
  const rq = new Stmts(remote);
  try {
    const rowOf = (c: Change) => rq.one(`select * from ${c.tbl} where ${pkWhere(specs.get(c.tbl)!)}`, pkValues(specs.get(c.tbl)!, c.pk));
    return apply(local, changes(remote), rowOf, (c) => fields.get(keyOf(c)) ?? new Map(), true);
  } finally {
    rq.close();
  }
}

/**
 * Aplica en `local` un lote de cambios de otros dispositivos (sincronización por cambios), con la misma regla: de cada
 * campo, el cambio más reciente. Dentro de una transacción de `local`.
 */
export function applyDelta(local: DB, items: DeltaItem[]): MergeResult {
  const byKey = new Map(items.map((i) => [keyOf(i), i]));
  return apply(
    local,
    [...byKey.values()],
    (c) => byKey.get(keyOf(c))?.row,
    (c) => deltaFields(byKey.get(keyOf(c)) ?? c),
    false,
  );
}

/** Lo que falta por subir de este dispositivo: los cambios con número mayor que el último subido, con sus filas. */
export function pendingChanges(db: DB): Pending {
  const specs = new Map(SYNC_TABLES.map((t) => [t.name, t]));
  const [state] = db.exec({ sql: "select changes, pushed from sync_state", rowMode: "object", returnValue: "resultRows" }) as { changes: number; pushed: number }[];
  const list: Change[] = db.exec({
    sql: "select tbl, pk, op, at, device, born from sync_changes where n > ? order by n",
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
    if (!row) continue;
    const fields = fieldsOf(db, c.tbl, c.pk);
    items.push({ ...c, row, ...(fields.size ? { fields: Object.fromEntries([...fields].map(([f, t]) => [f, t.at])) } : {}) });
  }
  return { changes: state!.changes, items };
}

/** Lo que se pierde se guarda tres meses (Ajustes, «Cambios sustituidos»). */
const KEEP_LOST_DAYS = 90;

/**
 * Junta con `local` los cambios `incoming` (las filas, con `rowOf`; sus campos, con `fieldsIn`). `full`: es una copia
 * entera, que trae todo; si no, es un lote de cambios y solo se mira lo que trae (sin calcular si hay que subir: eso
 * lo dice el número de cada cambio, migración 017).
 *
 * Una fila que está en los dos lados se junta campo a campo (mergeRow): de cada campo, el cambiado más tarde. Si el
 * resultado no es igual a ninguno de los dos, es un cambio nuevo de este dispositivo (hora nueva y por subir), para
 * que los demás también se queden con todo. Un borrado contra un cambio: gana el más reciente de la fila.
 */
function apply(
  local: DB,
  incoming: Change[],
  rowOf: (c: Change) => Record<string, unknown> | undefined,
  fieldsIn: (c: Change) => FieldTimes,
  full: boolean,
): MergeResult {
  const q = new Stmts(local);
  try {
    return applyWith(local, q, incoming, rowOf, fieldsIn, full);
  } finally {
    q.close();
  }
}

function applyWith(
  local: DB,
  q: Stmts,
  incoming: Change[],
  rowOf: (c: Change) => Record<string, unknown> | undefined,
  fieldsIn: (c: Change) => FieldTimes,
  full: boolean,
): MergeResult {
  const specs = new Map(SYNC_TABLES.map((t) => [t.name, t]));
  const mine = full ? new Map(changes(local).map((c) => [keyOf(c), c])) : null;
  const theirs = new Map(incoming.map((c) => [keyOf(c), c]));
  const mineOf = (c: Change): Change | undefined =>
    mine
      ? mine.get(keyOf(c))
      : (q.one("select tbl, pk, op, at, device, born, n from sync_changes where tbl = ? and pk = ?", [c.tbl, c.pk]) as Change | undefined);
  let needUpload = false;
  const wins: Change[] = [];
  /** Filas que están en los dos lados con cambios distintos: se juntan campo a campo. */
  const both: { r: Change; l: Change }[] = [];
  const here = local.selectValue("select device from sync_state") as string;
  const pushed = local.selectValue("select pushed from sync_state") as number;
  const recent = new Date(Date.now() - 15 * 60_000).toISOString();
  const overwritten: { tbl: string; pk: string; device: string }[] = [];
  for (const r of theirs.values()) {
    if (!specs.has(r.tbl)) continue; // una tabla que esta versión no conoce: la copia es más nueva (se avisa antes)
    const l = mineOf(r);
    if (l && l.op === r.op && l.at === r.at && l.device === r.device) continue; // el mismo cambio: ya está
    if (l && l.op === "upsert" && r.op === "upsert") {
      both.push({ r, l });
      continue;
    }
    if (l && newer(r, l) && l.device === here && r.device !== here && l.op === "upsert" && l.at > recent) overwritten.push({ tbl: r.tbl, pk: r.pk, device: r.device });
    if (!l || newer(r, l)) wins.push(r);
    else if (newer(l, r)) needUpload = true;
  }
  if (mine) for (const k of mine.keys()) if (!theirs.has(k)) needUpload = true;

  local.exec("update sync_state set applying = 1");
  // Las claves ajenas se comprueban al final: así no importa en qué orden llegan padres e hijos.
  local.exec("pragma defer_foreign_keys = on");

  /** Escribe una fila (alta o cambio). Otra fila de aquí con la misma clave única pierde frente a esta. */
  const write = (c: Change, row: Record<string, unknown>) => {
    const spec = specs.get(c.tbl)!;
    for (const cols of spec.unique ?? []) {
      const clash = q.all(`select ${pkExpr(spec)} as k from ${c.tbl} where ${cols.map((col) => `${col} is ?`).join(" and ")} and not (${pkWhere(spec)})`, [
        ...cols.map((col) => row[col]),
        ...pkValues(spec, c.pk),
      ]);
      for (const { k } of clash) {
        q.run(`delete from ${c.tbl} where ${pkWhere(spec)}`, pkValues(spec, String(k)));
        record(q, { tbl: c.tbl, pk: String(k), op: "delete", at: c.at, device: c.device });
        q.run("delete from sync_fields where tbl = ? and pk = ?", [c.tbl, String(k)]);
      }
    }
    const cols = Object.keys(row);
    const rest = cols.filter((col) => !spec.pk.includes(col));
    q.run(
      `insert into ${c.tbl} (${cols.join(", ")}) values (${cols.map(() => "?").join(", ")})
            on conflict (${spec.pk.join(", ")}) do ${rest.length ? `update set ${rest.map((col) => `${col} = excluded.${col}`).join(", ")}` : "nothing"}`,
      cols.map((col) => row[col]),
    );
  };

  // Primero los borrados (de hijos a padres), después altas y cambios (de padres a hijos).
  const order = (c: Change) => SYNC_TABLES.findIndex((t) => t.name === c.tbl);
  const deletes = wins.filter((c) => c.op === "delete").sort((a, b) => order(b) - order(a));
  const upserts = [...wins.filter((c) => c.op === "upsert").map((r) => ({ r, l: undefined as Change | undefined })), ...both].sort((a, b) => order(a.r) - order(b.r));
  for (const c of deletes) {
    const spec = specs.get(c.tbl)!;
    q.run(`delete from ${c.tbl} where ${pkWhere(spec)}`, pkValues(spec, c.pk));
    record(q, c);
    q.run("delete from sync_fields where tbl = ? and pk = ?", [c.tbl, c.pk]);
  }
  let pulled = deletes.length;
  const lost: { tbl: string; pk: string; field: string; mine: unknown; theirs: unknown; mineAt: string; device: string }[] = [];
  for (const { r: c, l } of upserts) {
    const spec = specs.get(c.tbl)!;
    const row = rowOf(c);
    if (!row) continue; // el registro dice que existe pero no está: se queda como estaba
    const here_ = l ? q.one(`select * from ${c.tbl} where ${pkWhere(spec)}`, pkValues(spec, c.pk)) : undefined;
    if (!l || !here_) {
      // No está aquí (o el registro de aquí no se corresponde): la de fuera, si es más reciente.
      if (l && !newer(c, l)) {
        if (newer(l, c)) needUpload = true;
        continue;
      }
      write(c, row);
      record(q, c);
      saveFields(q, c.tbl, c.pk, fieldsIn(c), !l);
      pulled++;
      continue;
    }
    const unpushed = (l.n ?? 0) > pushed;
    const m = mergeRow(
      c.tbl,
      spec.pk,
      { row: here_, change: l, fields: fieldsOf(q, c.tbl, c.pk) },
      { row, change: c, fields: fieldsIn(c) },
      (f) => f.device === here && (unpushed || f.at > recent),
    );
    // updated_at no cuenta: guardar sin cambiar nada no es un cambio y no viaja (migración 016).
    const cols = Object.keys(row).filter((col) => col !== "updated_at");
    const asTheirs = cols.every((col) => same(m.row[col], row[col]));
    const asMine = cols.every((col) => same(m.row[col], here_[col]));
    for (const x of m.lost) lost.push({ tbl: c.tbl, pk: c.pk, ...x, device: c.device });
    if (m.lost.length) overwritten.push({ tbl: c.tbl, pk: c.pk, device: c.device });
    if (asTheirs) {
      // Se queda lo de fuera (o es igual): como un cambio suyo.
      if (!asMine || !same(here_.updated_at, row.updated_at)) {
        write(c, row);
        pulled++;
      }
      record(q, newer(c, l) ? { ...c, born: m.born } : { ...l, born: m.born });
    } else if (asMine) {
      // Lo de aquí ya tiene todo: la nube no.
      record(q, { ...l, born: m.born });
      needUpload = true;
    } else {
      // Un poco de cada lado: un cambio nuevo de aquí, posterior a los dos, para que los demás se queden con todo.
      write(c, m.row);
      record(q, { tbl: c.tbl, pk: c.pk, op: "upsert", at: after(l.at, c.at), device: here, born: m.born });
      q.run("update sync_changes set n = (select changes from sync_state) + 1 where tbl = ? and pk = ?", [c.tbl, c.pk]);
      q.run("update sync_state set changes = changes + 1", []);
      pulled++;
      needUpload = true;
    }
    saveFields(q, c.tbl, c.pk, m.times);
  }
  // Lo de aquí que ha perdido: se guarda para poder recuperarlo (y lo de hace más de tres meses, fuera).
  const at = new Date().toISOString();
  local.exec({ sql: "delete from sync_conflicts where at < ?", bind: [new Date(Date.now() - KEEP_LOST_DAYS * 86_400_000).toISOString()] });
  for (const x of lost) {
    local.exec({
      sql: "insert into sync_conflicts (tbl, pk, field, mine, theirs, by_device, mine_at, at) values (?, ?, ?, ?, ?, ?, ?, ?)",
      bind: [x.tbl, x.pk, x.field, x.mine === undefined ? null : JSON.stringify(x.mine), x.theirs === undefined ? null : JSON.stringify(x.theirs), x.device, x.mineAt, at],
    });
  }

  // Filas que se quedan sin padre (un paciente borrado en un lado y un test nuevo suyo en el otro): fuera.
  // Con un lote de cambios sin borrados, basta con mirar las tablas que han recibido filas.
  const checks = full || deletes.length ? ["pragma foreign_key_check"] : [...new Set(upserts.map((c) => c.r.tbl))].map((t) => `pragma foreign_key_check(${t})`);
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
      if (r?.op === "delete") {
        record(local, r);
        local.exec({ sql: "delete from sync_fields where tbl = ? and pk = ?", bind: [spec.name, pk] });
      } else {
        tombstone(local, spec.name, pk);
        needUpload = true;
      }
    }
  }

  local.exec("update sync_state set applying = 0");
  return { pulled, needUpload, overwritten };
}
