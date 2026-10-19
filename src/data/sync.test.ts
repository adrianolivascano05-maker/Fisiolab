import { beforeEach, describe, expect, it } from "vitest";
import { saveSession } from "./clinical";
import type { Db } from "./db";
import { createPatient, deletePatient, setSetting } from "./repo";
import { SYNC_TABLES } from "./syncMerge";
import { createTestDb } from "./testDb";

const patient = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const session = (performedAt: string) => ({ performedAt, pain: 3, subjective: "", objective: "", treatment: "Ejercicio", plan: "", reviewOn: null, nextAt: null, nextMinutes: null });
const names = async (db: Db) => (await db.query<{ name: string }>("select name from patients order by name")).map((p) => p.name);
/** Fija la hora de un cambio: en las pruebas todo pasa en el mismo milisegundo. */
const stamp = (db: Db, tbl: string, pk: string, at: string) => db.transaction([{ sql: "update sync_changes set at = ? where tbl = ? and pk = ?", bind: [at, tbl, pk] }]);
const state = async (db: Db) => (await db.query<{ changes: number; pushed: number }>("select changes, pushed from sync_state"))[0]!;

let a: Db; // un dispositivo
let b: Db; // otro dispositivo de la misma cuenta
beforeEach(async () => {
  a = await createTestDb();
  b = await createTestDb();
});

describe("registro de cambios", () => {
  it("todas las tablas de datos se sincronizan, con sus tres disparadores y su clave", async () => {
    const tables = (await a.query<{ name: string }>("select name from sqlite_master where type = 'table' and name not like 'sync_%' and name not like 'sqlite_%'")).map((t) => t.name);
    // El motivo que se está viendo es de cada dispositivo (migración 010).
    tables.splice(tables.indexOf("episode_focus"), 1);
    expect(tables.sort()).toEqual(SYNC_TABLES.map((t) => t.name).sort());
    for (const t of SYNC_TABLES) {
      const triggers = await a.query("select name from sqlite_master where type = 'trigger' and tbl_name = ? and name like 'sync_%'", [t.name]);
      expect(triggers, t.name).toHaveLength(3);
      const pk = (await a.query<{ name: string; pk: number }>(`select name, pk from pragma_table_info('${t.name}') where pk > 0 order by pk`)).map((c) => c.name);
      expect(pk, t.name).toEqual(t.pk);
    }
  });

  it("cada alta, cambio o borrado (también en cascada) deja su hora; los ajustes del dispositivo no", async () => {
    const pid = await createPatient(a, patient("Ana"));
    await saveSession(a, pid, session("2026-10-01T10:00:00.000Z"));
    expect((await state(a)).changes).toBe(2);
    await setSetting(a, "sensor_check", { ok: true });
    await setSetting(a, "mvt.squat", 0.3);
    await deletePatient(a, pid);
    const log = await a.query<{ tbl: string; op: string }>("select tbl, op from sync_changes order by tbl");
    expect(log).toEqual([
      { tbl: "patients", op: "delete" },
      { tbl: "sessions", op: "delete" },
      { tbl: "settings", op: "upsert" },
    ]);
  });
});

describe("juntar dos dispositivos", () => {
  it("lo de un dispositivo llega al otro; volver a juntar la misma copia no cambia nada", async () => {
    const pid = await createPatient(a, patient("Ana"));
    await saveSession(a, pid, session("2026-10-01T10:00:00.000Z"));
    const snap = await a.snapshot();
    expect(snap.changes).toBe(2);
    expect(await b.merge(snap.bytes)).toEqual({ pulled: 2, needUpload: false });
    expect(await names(b)).toEqual(["Ana"]);
    expect(await b.query("select treatment from sessions")).toEqual([{ treatment: "Ejercicio" }]);
    // Lo que llega de la nube no cuenta como cambio de este dispositivo.
    expect((await state(b)).changes).toBe(0);
    expect(await b.merge(snap.bytes)).toEqual({ pulled: 0, needUpload: false });
  });

  it("cada uno con sus pacientes: al juntar están todos y hay que subir lo que falta en la nube", async () => {
    await createPatient(a, patient("Ana"));
    await createPatient(b, patient("Bruno"));
    expect(await b.merge((await a.snapshot()).bytes)).toEqual({ pulled: 1, needUpload: true });
    expect(await names(b)).toEqual(["Ana", "Bruno"]);
    expect(await a.merge((await b.snapshot()).bytes)).toEqual({ pulled: 1, needUpload: false });
    expect(await names(a)).toEqual(["Ana", "Bruno"]);
  });

  it("la misma ficha cambiada en los dos: gana el cambio más reciente", async () => {
    const pid = await createPatient(a, patient("Ana"));
    await b.merge((await a.snapshot()).bytes);
    await a.transaction([{ sql: "update patients set notes = 'desde A' where id = ?", bind: [pid] }]);
    await b.transaction([{ sql: "update patients set notes = 'desde B' where id = ?", bind: [pid] }]);
    await stamp(a, "patients", pid, "2030-10-02T10:00:00.000Z");
    await stamp(b, "patients", pid, "2030-10-02T11:00:00.000Z");
    expect(await a.merge((await b.snapshot()).bytes)).toEqual({ pulled: 1, needUpload: false });
    expect(await a.query("select notes from patients")).toEqual([{ notes: "desde B" }]);
    expect(await b.merge((await a.snapshot()).bytes)).toEqual({ pulled: 0, needUpload: false });
    expect(await b.query("select notes from patients")).toEqual([{ notes: "desde B" }]);
  });

  it("un borrado posterior gana a un cambio anterior, y se lleva lo que colgaba del paciente", async () => {
    const pid = await createPatient(a, patient("Ana"));
    await saveSession(a, pid, session("2026-10-01T10:00:00.000Z"));
    await b.merge((await a.snapshot()).bytes);
    await b.transaction([{ sql: "update patients set notes = 'nota' where id = ?", bind: [pid] }]);
    await stamp(b, "patients", pid, "2030-10-02T10:00:00.000Z");
    await deletePatient(a, pid);
    await stamp(a, "patients", pid, "2030-10-03T10:00:00.000Z");
    await b.merge((await a.snapshot()).bytes);
    expect(await names(b)).toEqual([]);
    expect(await b.query("select count(*) as n from sessions")).toEqual([{ n: 0 }]);
    expect(await b.query("pragma foreign_key_check")).toEqual([]);
  });

  it("un cambio posterior gana a un borrado anterior: el paciente vuelve", async () => {
    const pid = await createPatient(a, patient("Ana"));
    await b.merge((await a.snapshot()).bytes);
    await deletePatient(b, pid);
    await stamp(b, "patients", pid, "2030-10-02T10:00:00.000Z");
    await a.transaction([{ sql: "update patients set notes = 'sigue' where id = ?", bind: [pid] }]);
    await stamp(a, "patients", pid, "2030-10-03T10:00:00.000Z");
    expect(await b.merge((await a.snapshot()).bytes)).toEqual({ pulled: 1, needUpload: false });
    expect(await b.query("select name, notes from patients")).toEqual([{ name: "Ana", notes: "sigue" }]);
  });

  it("una sesión nueva de un paciente que el otro borró se va con él, sin romper la base", async () => {
    const pid = await createPatient(a, patient("Ana"));
    await b.merge((await a.snapshot()).bytes);
    await deletePatient(a, pid);
    await stamp(a, "patients", pid, "2030-10-03T10:00:00.000Z");
    await saveSession(b, pid, session("2026-10-04T10:00:00.000Z"));
    const result = await b.merge((await a.snapshot()).bytes);
    expect(result.needUpload).toBe(true); // la sesión borrada aquí también tiene que borrarse en la nube
    expect(await names(b)).toEqual([]);
    expect(await b.query("select count(*) as n from sessions")).toEqual([{ n: 0 }]);
    expect(await b.query("select op from sync_changes where tbl = 'sessions'")).toEqual([{ op: "delete" }]);
  });

  it("el mismo resultado de un test guardado en los dos con otra id: se queda el más reciente", async () => {
    const pid = await createPatient(a, patient("Ana"));
    const t = "2026-10-01T10:00:00.000Z";
    await a.transaction([{ sql: "insert into tests (id, patient_id, category, type, performed_at, created_at, updated_at) values ('t1', ?, 'jump', 'cmj', ?, ?, ?)", bind: [pid, t, t, t] }]);
    await b.merge((await a.snapshot()).bytes);
    const result = (id: string, v: number) => ({ sql: "insert into results (id, test_id, metric, value, unit, created_at) values (?, 't1', 'jump_height_cm', ?, 'cm', ?)", bind: [id, v, t] });
    await a.transaction([result("ra", 30)]);
    await b.transaction([result("rb", 32)]);
    await stamp(a, "results", "ra", "2030-10-02T10:00:00.000Z");
    await stamp(b, "results", "rb", "2030-10-02T11:00:00.000Z");
    await a.merge((await b.snapshot()).bytes);
    expect(await a.query("select id, value from results")).toEqual([{ id: "rb", value: 32 }]);
    expect(await a.query("select op from sync_changes where pk = 'ra'")).toEqual([{ op: "delete" }]);
  });

  it("una copia de una versión más nueva de la app no se toca; un archivo que no es una base, tampoco", async () => {
    await createPatient(a, patient("Ana"));
    await createPatient(b, patient("Bruno"));
    const future = await createTestDb();
    await future.transaction([{ sql: "pragma user_version = 999" }]);
    await expect(b.merge((await future.snapshot()).bytes)).rejects.toThrow("más nueva");
    await expect(b.merge(new TextEncoder().encode("no es una base de datos"))).rejects.toThrow("no es una base");
    expect(await names(b)).toEqual(["Bruno"]);
  });
});
