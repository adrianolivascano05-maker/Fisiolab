import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { beforeEach, describe, expect, it } from "vitest";
import { agenda, clashes, createAppointment, createWeekly, getAppointment, lastVisitOf, markConfirmed, markReminded, nextAppointmentOf, updateAppointment, upcomingAppointments } from "./appointments";
import { deleteSession, nextVisitOf, saveSession, upcomingVisits } from "./clinical";
import { dbFromHandler, type Db } from "./db";
import { Engine } from "./engine";
import { migrations } from "./migrations";
import { createPatient, listPatients } from "./repo";
import { createTestDb } from "./testDb";

const person = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const session = (performedAt: string, nextAt: string | null = null) => ({
  performedAt,
  pain: 3,
  subjective: "",
  objective: "",
  treatment: "Ejercicio",
  plan: "",
  reviewOn: null,
  nextAt,
  nextMinutes: nextAt ? 45 : null,
});
const NOW = new Date("2026-10-20T08:00:00.000Z");

let db: Db;
let pid: string;
beforeEach(async () => {
  db = await createTestDb();
  pid = await createPatient(db, person("Ana"));
});

describe("citas", () => {
  it("la siguiente cita de una sesión es una cita con el id de la sesión: se mueve con ella y se quita con ella", async () => {
    const sid = await saveSession(db, pid, session("2026-10-19T10:00:00.000Z", "2026-10-22T10:00:00.000Z"));
    expect(await getAppointment(db, sid)).toMatchObject({ patientId: pid, startsAt: "2026-10-22T10:00:00.000Z", minutes: 45, status: "scheduled" });
    expect(await nextVisitOf(db, pid, NOW)).toEqual({ id: sid, nextAt: "2026-10-22T10:00:00.000Z", nextMinutes: 45 });
    await saveSession(db, pid, session("2026-10-19T10:00:00.000Z", "2026-10-23T09:30:00.000Z"), sid);
    expect((await getAppointment(db, sid))!.startsAt).toBe("2026-10-23T09:30:00.000Z");
    await saveSession(db, pid, session("2026-10-19T10:00:00.000Z"), sid);
    expect(await getAppointment(db, sid)).toBeNull();
    await saveSession(db, pid, session("2026-10-19T10:00:00.000Z", "2026-10-24T09:30:00.000Z"), sid);
    await deleteSession(db, sid);
    expect(await getAppointment(db, sid)).toBeNull();
  });

  it("mover la siguiente cita desde la sesión quita el «recordada» y el «confirmada» (eran de la otra hora)", async () => {
    const sid = await saveSession(db, pid, session("2026-10-19T10:00:00.000Z", "2026-10-27T10:00:00.000Z"));
    await markReminded(db, sid);
    await markConfirmed(db, sid, true);
    await saveSession(db, pid, { ...session("2026-10-19T10:00:00.000Z", "2026-10-27T10:00:00.000Z"), treatment: "Otro" }, sid);
    expect(await getAppointment(db, sid)).toMatchObject({ remindedAt: expect.any(String), confirmedAt: expect.any(String) });
    await saveSession(db, pid, session("2026-10-19T10:00:00.000Z", "2026-10-29T10:00:00.000Z"), sid);
    expect(await getAppointment(db, sid)).toMatchObject({ remindedAt: null, confirmedAt: null });
  });

  it("la última visita, para el justificante: la cita que ya empezó o una sesión más reciente; nunca una futura", async () => {
    expect(await lastVisitOf(db, pid, NOW)).toBeNull();
    const a = await createAppointment(db, pid, { startsAt: "2026-10-15T08:00:00.000Z", minutes: 60 });
    await createAppointment(db, pid, { startsAt: "2026-10-22T08:00:00.000Z", minutes: 45 }); // futura
    expect(await lastVisitOf(db, pid, NOW)).toEqual({ startsAt: "2026-10-15T08:00:00.000Z", minutes: 60, appointmentId: a });
    await saveSession(db, pid, session("2026-10-15T08:05:00.000Z")); // la del mismo día: manda la cita
    expect((await lastVisitOf(db, pid, NOW))?.appointmentId).toBe(a);
    await saveSession(db, pid, session("2026-10-19T16:00:00.000Z"));
    expect(await lastVisitOf(db, pid, NOW)).toEqual({ startsAt: "2026-10-19T16:00:00.000Z", minutes: 45, appointmentId: null });
  });

  it("guardar la sesión sin cambiar la cita no la vuelve a dejar pendiente", async () => {
    const sid = await saveSession(db, pid, session("2026-10-19T10:00:00.000Z", "2026-10-22T10:00:00.000Z"));
    await updateAppointment(db, sid, { status: "no_show" });
    await saveSession(db, pid, { ...session("2026-10-19T10:00:00.000Z", "2026-10-22T10:00:00.000Z"), treatment: "Otro" }, sid);
    expect((await getAppointment(db, sid))!.status).toBe("no_show");
  });

  it("citas sin sesión: no vino, anulada o movida (vuelve a estar pendiente)", async () => {
    const id = await createAppointment(db, pid, { startsAt: "2026-10-21T16:00:00.000Z", minutes: 30 });
    await expect(createAppointment(db, pid, { startsAt: "mañana", minutes: 30 })).rejects.toThrow(/día y la hora/);
    await expect(createAppointment(db, pid, { startsAt: "2026-10-21T16:00:00.000Z", minutes: 0 })).rejects.toThrow(/cuánto dura/);
    expect((await nextAppointmentOf(db, pid, NOW))!.id).toBe(id);
    await updateAppointment(db, id, { status: "cancelled" });
    expect(await nextAppointmentOf(db, pid, NOW)).toBeNull();
    expect(await upcomingAppointments(db, NOW)).toEqual([]);
    await updateAppointment(db, id, { startsAt: "2026-10-28T16:00:00.000Z" });
    expect(await getAppointment(db, id)).toMatchObject({ status: "scheduled", startsAt: "2026-10-28T16:00:00.000Z" });
    expect((await listPatients(db, "", NOW))[0]!.nextAt).toBe("2026-10-28T16:00:00.000Z");
    expect((await upcomingVisits(db, NOW)).map((v) => v.id)).toEqual([id]);
  });

  it("al apuntar la sesión del día, su cita queda atendida; la agenda enseña todas", async () => {
    const luis = await createPatient(db, person("Luis"));
    const a = await createAppointment(db, pid, { startsAt: "2026-10-20T08:00:00.000Z", minutes: 45 }); // 10:00 en Madrid
    const b = await createAppointment(db, luis, { startsAt: "2026-10-20T09:00:00.000Z", minutes: 45 });
    const later = await createAppointment(db, pid, { startsAt: "2026-10-27T08:00:00.000Z", minutes: 45 });
    await updateAppointment(db, b, { status: "no_show" });
    await saveSession(db, pid, session("2026-10-20T07:55:00.000Z"));
    const today = await agenda(db, "2026-10-19T22:00:00.000Z", "2026-10-20T22:00:00.000Z");
    expect(today.map((x) => [x.name, x.status])).toEqual([
      ["Ana", "done"],
      ["Luis", "no_show"],
    ]);
    expect((await getAppointment(db, a))!.status).toBe("done");
    expect((await getAppointment(db, later))!.status).toBe("scheduled");
  });
});

describe("agenda más sencilla", () => {
  it("avisa de las citas pendientes que se pisan (de la misma persona); las anuladas y la propia no cuentan", async () => {
    const at = "2026-10-21T08:00:00.000Z";
    const a = await createAppointment(db, pid, { startsAt: at, minutes: 45, assignedTo: "ana@x.es" });
    const b = await createAppointment(db, pid, { startsAt: "2026-10-21T09:00:00.000Z", minutes: 30, assignedTo: "luis@x.es" });
    expect((await clashes(db, "2026-10-21T08:30:00.000Z", 30, "ana@x.es")).map((c) => c.id)).toEqual([a]);
    expect(await clashes(db, "2026-10-21T08:45:00.000Z", 30, "ana@x.es")).toEqual([]); // empieza cuando acaba
    expect(await clashes(db, "2026-10-21T08:30:00.000Z", 30, "luis@x.es")).toEqual([]);
    expect((await clashes(db, "2026-10-21T07:30:00.000Z", 120)).map((c) => c.id)).toEqual([a, b]); // sin equipo, todas
    expect(await clashes(db, "2026-10-21T08:30:00.000Z", 30, null)).toEqual([]);
    expect(await clashes(db, at, 45, "ana@x.es", a)).toEqual([]);
    await updateAppointment(db, a, { status: "cancelled" });
    expect(await clashes(db, at, 45, "ana@x.es")).toEqual([]);
  });

  it("una serie: una cita por semana a la misma hora, también al cambiar al horario de invierno", async () => {
    const ids = await createWeekly(db, pid, { startsAt: new Date("2026-10-14T10:00:00").toISOString(), minutes: 45 }, 3);
    const list = await agenda(db, "2026-10-01T00:00:00.000Z", "2026-11-30T00:00:00.000Z");
    expect(list.map((a) => a.id)).toEqual(ids);
    expect(list.map((a) => new Date(a.startsAt).getHours())).toEqual([10, 10, 10]);
    expect(list.map((a) => new Date(a.startsAt).getDate())).toEqual([14, 21, 28]);
  });
});

describe("migración 013", () => {
  it("la siguiente cita aún por llegar de la última sesión de cada paciente pasa a la agenda", async () => {
    const sqlite3 = await sqlite3InitModule();
    const storage = { persistent: false, open: () => new sqlite3.oo1.DB("/migrate-v12.sqlite3", "c") };
    const before = dbFromHandler((req) => new Engine(sqlite3, storage, migrations.filter((m) => m.version < 13)).handle(req));
    const sql = `insert into sessions (id, patient_id, performed_at, pain, subjective, objective, treatment, plan, next_at, next_minutes, created_at, updated_at)
                 values (?, 'p1', ?, null, '', '', '', '', ?, 60, '2026-01-01', '2026-01-01')`;
    await before.transaction([
      { sql: "insert into patients (id, name, notes, created_at, updated_at) values ('p1', 'Ana', '', '2026-01-01', '2026-01-01')" },
      { sql, bind: ["vieja", "2026-01-01T10:00:00.000Z", "2099-01-10T10:00:00.000Z"] },
      { sql, bind: ["ultima", "2026-02-01T10:00:00.000Z", "2099-02-10T10:00:00.000Z"] },
      { sql, bind: ["pasada", "2025-02-01T10:00:00.000Z", "2025-02-10T10:00:00.000Z"] },
    ]);
    const after = dbFromHandler((req) => new Engine(sqlite3, storage, migrations).handle(req));
    expect(await after.query("select id, starts_at, minutes, status from appointments")).toEqual([
      { id: "ultima", starts_at: "2099-02-10T10:00:00.000Z", minutes: 60, status: "scheduled" },
    ]);
    expect(await after.query("select op from sync_changes where tbl = 'appointments'")).toEqual([{ op: "upsert" }]);
  });
});
