// Sincronización campo a campo (migración 033 y syncMerge.ts): dos personas que cambian cosas distintas de la misma
// ficha no se pisan; si cambian lo mismo, se queda lo último y lo otro se guarda para recuperarlo; y, pase lo que pase y
// en el orden que sea, todos los dispositivos acaban con lo mismo.
import { beforeEach, describe, expect, it } from "vitest";
import { getAnamnesis, saveAnamnesis, saveSession, type Answers } from "./clinical";
import type { Db } from "./db";
import { migrations } from "./migrations";
import { patientPhysios, setPatientPhysios } from "./patientStaff";
import { createPatient, deletePatient } from "./repo";
import { SYNC_TABLES, type DeltaItem } from "./syncMerge";
import { createTestDb } from "./testDb";

const SCHEMA = migrations.at(-1)!.version;
const patient = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const session = (performedAt: string) => ({ performedAt, pain: 3, subjective: "", objective: "", treatment: "Ejercicio", plan: "", reviewOn: null, nextAt: null, nextMinutes: null });
/** Dos cambios seguidos en dos dispositivos tienen horas distintas. */
const tick = () => new Promise((r) => setTimeout(r, 3));
const set = (db: Db, sql: string, bind: (string | number | null)[]) => db.transaction([{ sql, bind }]);
const row = async (db: Db, id: string) => (await db.query("select name, phone, notes, dni from patients where id = ?", [id]))[0];

/** El servidor de la clínica: la copia entera, los lotes de después en orden, y por dónde va cada dispositivo. */
class Server {
  log: DeltaItem[][] = [];
  cursor = new Map<Db, number>();
  copy: { bytes: Uint8Array; base: number } | null = null;
  /** Una vuelta de sync.ts: bajar lo de los demás (la copia entera, si se ha quedado atrás), juntarlo y subir lo de aquí. */
  async round(db: Db) {
    let from = this.cursor.get(db) ?? 0;
    if (this.copy && from < this.copy.base) {
      await db.merge(this.copy.bytes);
      from = this.copy.base;
    }
    for (const items of this.log.slice(from)) await db.apply(items, SCHEMA);
    this.cursor.set(db, this.log.length);
    const p = await db.pending();
    if (p.items.length) this.log.push(p.items);
    await db.transaction([{ sql: "update sync_state set pushed = max(pushed, ?)", bind: [p.changes] }]);
    // Lo suyo ya lo tiene.
    if (p.items.length) this.cursor.set(db, this.log.length);
  }
  /** Resumir: tras una vuelta, un dispositivo sube su copia entera y los lotes de antes ya no hacen falta. */
  async compact(db: Db) {
    await this.round(db);
    this.copy = { bytes: (await db.snapshot()).bytes, base: this.log.length };
  }
  /** Vueltas hasta que nadie tiene nada que subir ni que bajar. */
  async settle(dbs: Db[]) {
    for (let i = 0; i < 10; i++) {
      for (const db of dbs) await this.round(db);
      const pending = await Promise.all(dbs.map(async (db) => (await db.pending()).items.length));
      if (pending.every((n) => n === 0) && dbs.every((db) => this.cursor.get(db) === this.log.length)) return;
    }
    throw new Error("La sincronización no se queda quieta");
  }
}

/**
 * Todo lo que se sincroniza, para comparar dos dispositivos. Sin updated_at: guardar algo sin cambiarlo solo cambia
 * esa hora en ese dispositivo, y eso no es un cambio que viaje (migración 016).
 */
async function dump(db: Db) {
  const out: Record<string, unknown[]> = {};
  for (const t of SYNC_TABLES) {
    const rows = await db.query<Record<string, unknown>>(`select * from ${t.name} order by ${t.pk.join(", ")}`);
    out[t.name] = rows.map(({ updated_at: _u, ...rest }) => rest);
  }
  return out;
}

let a: Db;
let b: Db;
let server: Server;
beforeEach(async () => {
  a = await createTestDb();
  b = await createTestDb();
  server = new Server();
});

describe("campo a campo", () => {
  it("uno cambia el teléfono y otro las notas del mismo paciente: se quedan los dos", async () => {
    const pid = await createPatient(a, patient("Ana Ruiz"));
    await server.settle([a, b]);
    await set(a, "update patients set phone = '612 000 111' where id = ?", [pid]);
    await tick();
    await set(b, "update patients set notes = 'Viene en bici' where id = ?", [pid]);
    await server.settle([a, b]);
    expect(await row(a, pid)).toMatchObject({ phone: "612 000 111", notes: "Viene en bici" });
    expect(await row(b, pid)).toEqual(await row(a, pid));
    // No se ha perdido nada: no hay nada que recuperar.
    expect(await a.query("select * from sync_conflicts")).toEqual([]);
    expect(await b.query("select * from sync_conflicts")).toEqual([]);
  });

  it("dos asignan fisios a la vez al mismo paciente: se quedan los dos; el mismo, una sola vez", async () => {
    const pid = await createPatient(a, patient("Ana Ruiz"));
    await server.settle([a, b]);
    await setPatientPhysios(a, pid, ["bruno@clinica.test"]);
    await setPatientPhysios(b, pid, ["carla@clinica.test", "bruno@clinica.test"]);
    await server.settle([a, b]);
    for (const db of [a, b]) expect(await patientPhysios(db, pid)).toEqual(["bruno@clinica.test", "carla@clinica.test"]);
    // Uno quita a Carla: se va en los dos.
    await setPatientPhysios(b, pid, ["bruno@clinica.test"]);
    await server.settle([a, b]);
    expect(await patientPhysios(a, pid)).toEqual(["bruno@clinica.test"]);
    expect(await dump(a)).toEqual(await dump(b));
  });

  it("lo mismo con la copia entera (Drive o un dispositivo que vuelve después de mucho)", async () => {
    const pid = await createPatient(a, patient("Ana Ruiz"));
    await b.merge((await a.snapshot()).bytes);
    await set(a, "update patients set phone = '612 000 111' where id = ?", [pid]);
    await tick();
    await set(b, "update patients set dni = '12345678Z' where id = ?", [pid]);
    const r = await a.merge((await b.snapshot()).bytes);
    expect(r.needUpload).toBe(true);
    await b.merge((await a.snapshot()).bytes);
    for (const db of [a, b]) expect(await row(db, pid)).toMatchObject({ phone: "612 000 111", dni: "12345678Z" });
    expect(await dump(a)).toEqual(await dump(b));
  });

  it("el mismo dato cambiado en los dos: se queda el último y lo otro se guarda para recuperarlo", async () => {
    const pid = await createPatient(a, patient("Ana Ruiz"));
    await server.settle([a, b]);
    await set(a, "update patients set phone = '612 000 111' where id = ?", [pid]);
    await tick();
    await set(b, "update patients set phone = '699 999 999' where id = ?", [pid]);
    // B sube primero; A, al bajar lo de B, pierde su teléfono (es anterior) y lo guarda.
    await server.round(b);
    const before = await a.query("select count(*) as n from sync_conflicts");
    expect(before).toEqual([{ n: 0 }]);
    await server.settle([a, b]);
    for (const db of [a, b]) expect(await row(db, pid)).toMatchObject({ phone: "699 999 999" });
    const lost = await a.query<{ tbl: string; field: string; mine: string; theirs: string }>("select tbl, field, mine, theirs from sync_conflicts");
    expect(lost).toEqual([{ tbl: "patients", field: "phone", mine: JSON.stringify("612 000 111"), theirs: JSON.stringify("699 999 999") }]);
    expect(await b.query("select * from sync_conflicts")).toEqual([]);
  });

  it("anamnesis: dos personas contestan preguntas distintas a la vez y se quedan las dos respuestas", async () => {
    const pid = await createPatient(a, patient("Ana Ruiz"));
    await saveAnamnesis(a, pid, { motivo: "Dolor lumbar", evolucion: "2 semanas" });
    await server.settle([a, b]);
    await saveAnamnesis(a, pid, { motivo: "Dolor lumbar al estar sentada", evolucion: "2 semanas" });
    await tick();
    // B (por ejemplo, al recoger el formulario del paciente) añade una respuesta y quita otra.
    await saveAnamnesis(b, pid, { motivo: "Dolor lumbar", antecedentes: "Ninguno" });
    await server.settle([a, b]);
    for (const db of [a, b]) expect((await getAnamnesis(db, pid))?.answers).toEqual({ motivo: "Dolor lumbar al estar sentada", antecedentes: "Ninguno" });
  });

  it("un borrado y un cambio a la vez: gana el más reciente de la ficha, como siempre", async () => {
    const pid = await createPatient(a, patient("Ana Ruiz"));
    await saveSession(a, pid, session("2026-10-01T10:00:00.000Z"));
    await server.settle([a, b]);
    await set(a, "update patients set notes = 'nota' where id = ?", [pid]);
    await tick();
    await deletePatient(b, pid);
    await server.settle([a, b]);
    for (const db of [a, b]) expect(await db.query("select count(*) as n from patients")).toEqual([{ n: 0 }]);
    expect(await dump(a)).toEqual(await dump(b));
  });

  it("un dispositivo sin actualizar (sus cambios no dicen qué campos tocan) se junta como antes, fila a fila", async () => {
    const pid = await createPatient(a, patient("Ana Ruiz"));
    await server.settle([a, b]);
    await set(a, "update patients set phone = '612 000 111' where id = ?", [pid]);
    await tick();
    await set(b, "update patients set notes = 'nota de B' where id = ?", [pid]);
    const p = await b.pending();
    const old = p.items.map(({ born: _born, fields: _fields, ...rest }) => rest);
    await a.apply(old, SCHEMA);
    // Antes, el cambio más reciente de la fila se quedaba entero.
    expect(await row(a, pid)).toMatchObject({ phone: "", notes: "nota de B" });
  });

  it("cambiar algo que ya se tenía igual no se guarda como pérdida", async () => {
    const pid = await createPatient(a, patient("Ana Ruiz"));
    await server.settle([a, b]);
    await set(a, "update patients set phone = '612 000 111' where id = ?", [pid]);
    await tick();
    await set(b, "update patients set phone = '612 000 111' where id = ?", [pid]);
    await server.settle([a, b]);
    expect(await a.query("select * from sync_conflicts")).toEqual([]);
    expect(await b.query("select * from sync_conflicts")).toEqual([]);
  });
});

describe("todos acaban igual", () => {
  /** Un generador de números al azar con semilla, para que la prueba sea siempre la misma. */
  const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    it(`tres dispositivos cambian cosas al azar y se sincronizan en desorden (semilla ${seed})`, async () => {
      const c = await createTestDb();
      const dbs = [a, b, c];
      const r = rng(seed);
      const pick = <T,>(l: T[]) => l[Math.floor(r() * l.length)]!;
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) ids.push(await createPatient(a, patient(`Paciente ${i}`)));
      await server.settle(dbs);
      for (let step = 0; step < 80; step++) {
        const db = pick(dbs);
        const live = (await db.query<{ id: string }>("select id from patients")).map((p) => p.id);
        const roll = r();
        if (!live.length || roll < 0.05) ids.push(await createPatient(db, patient(`Nuevo ${step}`)));
        else if (roll < 0.35) await set(db, `update patients set ${pick(["phone", "notes", "dni", "name"])} = ? where id = ?`, [`v${step}`, pick(live)]);
        else if (roll < 0.6) {
          const id = pick(live);
          const prev = (await getAnamnesis(db, id))?.answers ?? {};
          const key = pick(["motivo", "evolucion", "antecedentes", "plan"]);
          const next: Answers = { ...prev };
          if (r() < 0.2) delete next[key];
          else next[key] = `r${step}`;
          await saveAnamnesis(db, id, next);
        } else if (roll < 0.7) await saveSession(db, pick(live), session(`2026-10-${String(1 + (step % 28)).padStart(2, "0")}T10:00:00.000Z`));
        else if (roll < 0.78) {
          // Una sesión ya hecha: uno cambia el dolor, otro el tratamiento o el plan.
          const [s] = await db.query<{ id: string }>("select id from sessions order by random() limit 1");
          const col = pick(["pain", "treatment", "plan"]);
          if (s) await set(db, `update sessions set ${col} = ? where id = ?`, [col === "pain" ? Math.floor(r() * 10) : `t${step}`, s.id]);
        } else if (roll < 0.82) await deletePatient(db, pick(live));
        else if (roll < 0.86) await server.compact(db);
        else await server.round(db);
        await tick();
      }
      await server.settle(dbs);
      const first = await dump(a);
      if (process.env.DEBUG_SYNC) {
        const others = [await dump(b), await dump(c)];
        for (const t of Object.keys(first)) for (const [i, o] of others.entries()) if (JSON.stringify(o[t]) !== JSON.stringify(first[t])) console.log("DIFF", t, i, JSON.stringify(first[t]).slice(0, 2000), "\n VS", JSON.stringify(o[t]).slice(0, 2000));
      }
      expect(await dump(b)).toEqual(first);
      expect(await dump(c)).toEqual(first);
    }, 60_000);
  }
});

describe("cambios sustituidos", () => {
  it("se ven con su nombre, se recuperan (y llega a los demás) o se dejan", async () => {
    const { lostChanges, recoverLost, dismissLost } = await import("./conflicts");
    const pid = await createPatient(a, patient("Ana Ruiz"));
    await saveAnamnesis(a, pid, { motivo: "Dolor lumbar" });
    await server.settle([a, b]);
    await set(a, "update patients set phone = '612 000 111' where id = ?", [pid]);
    await saveAnamnesis(a, pid, { motivo: "Dolor lumbar al correr" });
    await tick();
    await set(b, "update patients set phone = '699 999 999' where id = ?", [pid]);
    await saveAnamnesis(b, pid, { motivo: "Lumbalgia" });
    await server.round(b);
    await server.settle([a, b]);
    const lost = await lostChanges(a);
    expect(lost.map((l) => [l.what, l.patient?.name, l.mine, l.theirs]).sort()).toEqual([
      ["Motivo principal", "Ana Ruiz", "Dolor lumbar al correr", "Lumbalgia"],
      ["Teléfono", "Ana Ruiz", "612 000 111", "699 999 999"],
    ]);
    const phone = lost.find((l) => l.what === "Teléfono")!;
    expect(await recoverLost(a, phone.id)).toBe(true);
    await dismissLost(a, lost.find((l) => l.what !== "Teléfono")!.id);
    expect(await lostChanges(a)).toEqual([]);
    await server.settle([a, b]);
    for (const db of [a, b]) {
      expect(await row(db, pid)).toMatchObject({ phone: "612 000 111" });
      expect((await getAnamnesis(db, pid))?.answers).toEqual({ motivo: "Lumbalgia" });
    }
  });
});

describe("citas dobles", () => {
  it("dos personas dan la misma hora a la misma fisio en dos dispositivos: avisa al sincronizar", async () => {
    const { createAppointment, doubleBookingsFromOthers } = await import("./appointments");
    for (const db of [a, b]) await db.transaction([{ sql: "insert into staff (email, name, color, updated_at) values ('laura@clinica.es', 'Laura Ortega', 1, '2026-01-01'), ('pablo@clinica.es', 'Pablo Serrano', 2, '2026-01-01')" }]);
    const ana = await createPatient(a, patient("Ana Ruiz"));
    const luis = await createPatient(a, patient("Luis Gómez"));
    await server.settle([a, b]);
    const day = new Date(Date.now() + 3 * 86_400_000);
    day.setHours(10, 0, 0, 0);
    const at = (min: number) => new Date(day.getTime() + min * 60_000).toISOString();
    // Cada uno en su dispositivo, sin ver lo del otro.
    await createAppointment(a, ana, { startsAt: at(0), minutes: 45, assignedTo: "laura@clinica.es" });
    await createAppointment(b, luis, { startsAt: at(15), minutes: 45, assignedTo: "laura@clinica.es" });
    // Con Pablo a la misma hora, no pasa nada.
    await createAppointment(b, ana, { startsAt: at(120), minutes: 45, assignedTo: "pablo@clinica.es" });
    await createAppointment(b, luis, { startsAt: at(120), minutes: 45, assignedTo: "laura@clinica.es" });
    expect(await doubleBookingsFromOthers(a)).toEqual([]);
    await server.settle([a, b]);
    const found = await doubleBookingsFromOthers(a);
    expect(found.map((d) => [d.who, d.first.name, d.second.name])).toEqual([["Laura Ortega", "Ana Ruiz", "Luis Gómez"]]);
    // En el que dio la segunda, también: la primera le ha llegado de otro dispositivo.
    expect((await doubleBookingsFromOthers(b)).map((d) => d.key)).toEqual(found.map((d) => d.key));
  });

  it("una cita doble dada a propósito en el mismo dispositivo no avisa", async () => {
    const { createAppointment, doubleBookingsFromOthers } = await import("./appointments");
    const ana = await createPatient(a, patient("Ana Ruiz"));
    const luis = await createPatient(a, patient("Luis Gómez"));
    const start = new Date(Date.now() + 86_400_000).toISOString();
    await createAppointment(a, ana, { startsAt: start, minutes: 45 });
    await createAppointment(a, luis, { startsAt: start, minutes: 45 });
    expect(await doubleBookingsFromOthers(a)).toEqual([]);
  });
});
