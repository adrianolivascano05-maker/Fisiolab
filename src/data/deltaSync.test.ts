// Sincronización por cambios (migración 017 y syncMerge.ts): qué falta por subir y aplicar lotes de otros dispositivos.
import { beforeEach, describe, expect, it } from "vitest";
import { saveSession } from "./clinical";
import type { Db } from "./db";
import { migrations } from "./migrations";
import { createPatient, deletePatient, setSetting } from "./repo";
import { createTestDb } from "./testDb";

const patient = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const session = (performedAt: string) => ({ performedAt, pain: 3, subjective: "", objective: "", treatment: "Ejercicio", plan: "", reviewOn: null, nextAt: null, nextMinutes: null });
const names = async (db: Db) => (await db.query<{ name: string }>("select name from patients order by name")).map((p) => p.name);
const SCHEMA = migrations.at(-1)!.version;
/** Sube lo que falta (como sync.ts al terminar de subir el lote) y devuelve el lote. */
async function push(db: Db) {
  const p = await db.pending();
  await db.transaction([{ sql: "update sync_state set pushed = max(pushed, ?)", bind: [p.changes] }]);
  return p.items;
}

let a: Db;
let b: Db;
beforeEach(async () => {
  a = await createTestDb();
  b = await createTestDb();
});

describe("lo que falta por subir", () => {
  it("solo lo cambiado desde la última subida, con sus filas; un borrado sin fila", async () => {
    const pid = await createPatient(a, patient("Ana"));
    await saveSession(a, pid, session("2026-10-01T10:00:00.000Z"));
    const first = await push(a);
    expect(first.map((i) => `${i.tbl}:${i.op}`)).toEqual(["patients:upsert", "sessions:upsert"]);
    expect(first[0]!.row).toMatchObject({ id: pid, name: "Ana" });
    expect(await a.pending()).toMatchObject({ items: [] });

    await a.transaction([{ sql: "update patients set notes = 'nota' where id = ?", bind: [pid] }]);
    expect((await a.pending()).items.map((i) => [i.tbl, i.row?.notes])).toEqual([["patients", "nota"]]);
    await push(a);
    await deletePatient(a, pid);
    const del = await a.pending();
    expect(del.items.map((i) => `${i.tbl}:${i.op}`).sort()).toEqual(["patients:delete", "sessions:delete"]);
    expect(del.items.every((i) => i.row === undefined)).toBe(true);
  });

  it("lo que llega de otro dispositivo no se vuelve a subir", async () => {
    await createPatient(a, patient("Ana"));
    const items = await push(a);
    await b.apply(items, SCHEMA);
    expect(await names(b)).toEqual(["Ana"]);
    expect((await b.pending()).items).toEqual([]);
    // Lo de una copia entera, tampoco.
    await createPatient(a, patient("Luis"));
    await b.merge((await a.snapshot()).bytes);
    expect((await b.pending()).items).toEqual([]);
  });
});

describe("aplicar un lote", () => {
  it("altas, cambios y borrados (en cascada) llegan; repetir un lote no cambia nada", async () => {
    const pid = await createPatient(a, patient("Ana"));
    await saveSession(a, pid, session("2026-10-01T10:00:00.000Z"));
    const items = await push(a);
    expect(await b.apply(items, SCHEMA)).toMatchObject({ pulled: 2 });
    expect(await b.query("select treatment from sessions")).toEqual([{ treatment: "Ejercicio" }]);
    expect(await b.apply(items, SCHEMA)).toMatchObject({ pulled: 0 });

    await deletePatient(a, pid);
    expect(await b.apply(await push(a), SCHEMA)).toMatchObject({ pulled: 2 });
    expect(await names(b)).toEqual([]);
    expect(await b.query("select count(*) as n from sessions")).toEqual([{ n: 0 }]);
  });

  it("gana el cambio más reciente de cada fila: uno viejo no pisa lo de aquí", async () => {
    const pid = await createPatient(a, patient("Ana"));
    await b.apply(await push(a), SCHEMA);
    await a.transaction([{ sql: "update patients set notes = 'de A' where id = ?", bind: [pid] }]);
    await a.transaction([{ sql: "update sync_changes set at = '2026-01-01T00:00:00.000Z' where tbl = 'patients'" }]);
    const old = await push(a);
    await b.transaction([{ sql: "update patients set notes = 'de B' where id = ?", bind: [pid] }]);
    expect(await b.apply(old, SCHEMA)).toMatchObject({ pulled: 0 });
    expect(await b.query("select notes from patients")).toEqual([{ notes: "de B" }]);
  });

  it("una sesión nueva de un paciente que aquí se ha borrado se queda fuera, y ese borrado se sube", async () => {
    const pid = await createPatient(a, patient("Ana"));
    await b.apply(await push(a), SCHEMA);
    await push(b);
    await saveSession(a, pid, session("2026-10-01T10:00:00.000Z"));
    await deletePatient(b, pid);
    await push(b);
    expect(await b.apply(await push(a), SCHEMA)).toMatchObject({ pulled: 1 });
    expect(await b.query("select count(*) as n from sessions")).toEqual([{ n: 0 }]);
    expect((await b.pending()).items.map((i) => `${i.tbl}:${i.op}`)).toEqual(["sessions:delete"]);
  });

  it("los ajustes y el equipo también", async () => {
    await setSetting(a, "agenda_hours", { from: 8, to: 20 });
    await a.transaction([{ sql: "insert into staff (email, name, color, updated_at) values ('ana@clinica.es', 'Ana', 2, '2026-01-01')" }]);
    await b.apply(await push(a), SCHEMA);
    expect(await b.query("select value from settings where key = 'agenda_hours'")).toEqual([{ value: JSON.stringify({ from: 8, to: 20 }) }]);
    expect(await b.query("select name, color from staff")).toEqual([{ name: "Ana", color: 2 }]);
  });

  it("un lote de una versión más nueva de la app pide actualizar, sin tocar nada", async () => {
    await createPatient(a, patient("Ana"));
    await expect(b.apply(await push(a), SCHEMA + 1)).rejects.toThrow(/actualiza la app/);
    expect(await names(b)).toEqual([]);
  });
});
