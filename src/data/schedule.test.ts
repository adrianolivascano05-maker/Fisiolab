// Horario de la clínica (src/data/schedule.ts): el equipo, los turnos y con quién es cada cita, y que todo viaja
// entre dispositivos al juntar las copias.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { agenda, createAppointment, getAppointment, updateAppointment, upcomingAppointments } from "./appointments";
import type { Db } from "./db";
import { setMember } from "./member";
import { createPatient } from "./repo";
import {
  copyWeekForward,
  createShift,
  deleteShift,
  ensureStaff,
  listStaff,
  plusWeeks,
  removeStaff,
  shiftsBetween,
  updateShift,
  withinShift,
} from "./schedule";
import { createTestDb } from "./testDb";

const person = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const MONDAY = "2026-10-19T00:00:00.000Z";
const at = (day: number, hour: number) => new Date(Date.UTC(2026, 9, 19 + day, hour)).toISOString();

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  setMember("1001", "Ana@Clinica.es");
});
afterEach(() => setMember(null));

describe("equipo", () => {
  it("cada persona una vez, con su color; quien entra pone su nombre si solo había el del correo", async () => {
    await ensureStaff(db, "eva@clinica.es", "");
    await ensureStaff(db, "ANA@clinica.es", "Ana Ruiz");
    await ensureStaff(db, "eva@clinica.es", "Otra cosa");
    expect(await listStaff(db)).toEqual([
      { email: "ana@clinica.es", name: "Ana Ruiz", color: 1 },
      { email: "eva@clinica.es", name: "eva", color: 0 },
    ]);
    await ensureStaff(db, "eva@clinica.es", "Eva Gil", true);
    expect((await listStaff(db)).map((s) => s.name)).toEqual(["Ana Ruiz", "Eva Gil"]);
  });
});

describe("turnos", () => {
  it("se ponen, se repiten cada semana, se cambian y se borran", async () => {
    const ids = await createShift(db, { staffEmail: "Eva@clinica.es", startsAt: at(0, 7), endsAt: at(0, 12), note: " mañana " }, 2);
    expect(ids).toHaveLength(3);
    const all = await shiftsBetween(db, MONDAY, plusWeeks(MONDAY, 3));
    expect(all.map((s) => [s.staffEmail, s.startsAt, s.note])).toEqual([
      ["eva@clinica.es", at(0, 7), "mañana"],
      ["eva@clinica.es", at(7, 7), "mañana"],
      ["eva@clinica.es", at(14, 7), "mañana"],
    ]);
    await updateShift(db, ids[1]!, { staffEmail: "ana@clinica.es", startsAt: at(8, 15), endsAt: at(8, 19), note: "" });
    await deleteShift(db, ids[2]!);
    expect((await shiftsBetween(db, plusWeeks(MONDAY, 1), plusWeeks(MONDAY, 3))).map((s) => [s.staffEmail, s.startsAt])).toEqual([["ana@clinica.es", at(8, 15)]]);
  });

  it("no valen sin persona, al revés o de más de 16 horas", async () => {
    await expect(createShift(db, { staffEmail: "", startsAt: at(0, 7), endsAt: at(0, 9), note: "" })).rejects.toThrow(/de quién/);
    await expect(createShift(db, { staffEmail: "eva@clinica.es", startsAt: at(0, 9), endsAt: at(0, 7), note: "" })).rejects.toThrow(/después/);
    await expect(createShift(db, { staffEmail: "eva@clinica.es", startsAt: at(0, 1), endsAt: at(0, 20), note: "" })).rejects.toThrow(/16 horas/);
  });

  it("copiar la semana a la siguiente no repite lo que ya está", async () => {
    await createShift(db, { staffEmail: "eva@clinica.es", startsAt: at(0, 7), endsAt: at(0, 12), note: "" });
    await createShift(db, { staffEmail: "ana@clinica.es", startsAt: at(2, 14), endsAt: at(2, 18), note: "tarde" });
    await createShift(db, { staffEmail: "eva@clinica.es", startsAt: at(7, 7), endsAt: at(7, 12), note: "" });
    expect(await copyWeekForward(db, MONDAY)).toBe(1);
    expect((await shiftsBetween(db, plusWeeks(MONDAY, 1), plusWeeks(MONDAY, 2))).map((s) => [s.staffEmail, s.startsAt, s.note])).toEqual([
      ["eva@clinica.es", at(7, 7), ""],
      ["ana@clinica.es", at(9, 14), "tarde"],
    ]);
    expect(await copyWeekForward(db, MONDAY)).toBe(0);
  });

  it("si una cita cae dentro del turno de esa persona", async () => {
    await createShift(db, { staffEmail: "eva@clinica.es", startsAt: at(0, 7), endsAt: at(0, 12), note: "" });
    const shifts = await shiftsBetween(db, MONDAY, plusWeeks(MONDAY, 1));
    expect(withinShift(shifts, "eva@clinica.es", at(0, 11), 45)).toBe(true);
    expect(withinShift(shifts, "eva@clinica.es", at(0, 12), 45)).toBe(false);
    expect(withinShift(shifts, "ana@clinica.es", at(0, 8), 45)).toBe(false);
  });
});

describe("citas del equipo", () => {
  it("cada cita es con alguien: por defecto con quien la da; se puede pasar a otra persona", async () => {
    const pid = await createPatient(db, person("Paciente"));
    const mine = await createAppointment(db, pid, { startsAt: at(1, 9), minutes: 45 });
    const eva = await createAppointment(db, pid, { startsAt: at(1, 10), minutes: 45, assignedTo: "eva@clinica.es" });
    expect((await getAppointment(db, mine))!.assignedTo).toBe("ana@clinica.es");
    expect((await agenda(db, MONDAY, plusWeeks(MONDAY, 1))).map((a) => a.assignedTo)).toEqual(["ana@clinica.es", "eva@clinica.es"]);
    // Al Google Calendar de cada una van las suyas.
    const now = new Date(MONDAY);
    expect((await upcomingAppointments(db, now, { sub: "1001", email: "ana@clinica.es" })).map((a) => a.id)).toEqual([mine]);
    expect((await upcomingAppointments(db, now, { sub: "1002", email: "eva@clinica.es" })).map((a) => a.id)).toEqual([eva]);
    await updateAppointment(db, eva, { assignedTo: "ana@clinica.es" });
    expect((await upcomingAppointments(db, now, { sub: "1001", email: "ana@clinica.es" })).map((a) => a.id)).toEqual([mine, eva]);
  });

  it("quien deja el equipo sale del horario; sus citas pendientes quedan sin asignar", async () => {
    const pid = await createPatient(db, person("Paciente"));
    await ensureStaff(db, "eva@clinica.es", "Eva");
    await createShift(db, { staffEmail: "eva@clinica.es", startsAt: at(0, 7), endsAt: at(0, 12), note: "" });
    await createShift(db, { staffEmail: "eva@clinica.es", startsAt: at(7, 7), endsAt: at(7, 12), note: "" });
    const past = await createAppointment(db, pid, { startsAt: at(0, 8), minutes: 45, assignedTo: "eva@clinica.es" });
    const next = await createAppointment(db, pid, { startsAt: at(7, 8), minutes: 45, assignedTo: "eva@clinica.es" });
    await removeStaff(db, "eva@clinica.es", new Date(at(3, 0)));
    expect(await listStaff(db)).toEqual([]);
    expect((await shiftsBetween(db, MONDAY, plusWeeks(MONDAY, 2))).map((s) => s.startsAt)).toEqual([at(0, 7)]);
    expect((await getAppointment(db, past))!.assignedTo).toBe("eva@clinica.es");
    expect((await getAppointment(db, next))!.assignedTo).toBeNull();
  });

  it("el horario viaja a los demás dispositivos al juntar las copias", async () => {
    await ensureStaff(db, "eva@clinica.es", "Eva");
    await createShift(db, { staffEmail: "eva@clinica.es", startsAt: at(0, 7), endsAt: at(0, 12), note: "" });
    const other = await createTestDb();
    await other.merge((await db.snapshot()).bytes);
    expect(await listStaff(other)).toEqual(await listStaff(db));
    expect(await shiftsBetween(other, MONDAY, plusWeeks(MONDAY, 1))).toEqual(await shiftsBetween(db, MONDAY, plusWeeks(MONDAY, 1)));
  });
});
