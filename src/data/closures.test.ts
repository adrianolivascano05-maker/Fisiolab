import { beforeEach, describe, expect, it } from "vitest";
import { createAppointment } from "./appointments";
import { appointmentsInside, checkClosure, closesFor, closuresBetween, createClosure, deleteClosure, updateClosure } from "./closures";
import type { Db } from "./db";
import { createPatient } from "./repo";
import { createTestDb } from "./testDb";

const person = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("agenda cerrada", () => {
  it("se guarda, se cambia y se quita; solo sale en las fechas que toca", async () => {
    const id = await createClosure(db, { staffEmail: " Laura@Clinica.test ", startsAt: "2026-11-02T00:00:00.000Z", endsAt: "2026-11-09T00:00:00.000Z", note: " vacaciones " }, "laura@clinica.test");
    expect(await closuresBetween(db, "2026-11-05T00:00:00.000Z", "2026-11-06T00:00:00.000Z")).toEqual([
      { id, staffEmail: "laura@clinica.test", startsAt: "2026-11-02T00:00:00.000Z", endsAt: "2026-11-09T00:00:00.000Z", note: "vacaciones", createdBy: "laura@clinica.test" },
    ]);
    expect(await closuresBetween(db, "2026-11-09T00:00:00.000Z", "2026-11-10T00:00:00.000Z")).toEqual([]);
    await updateClosure(db, id, { staffEmail: "", startsAt: "2026-11-02T00:00:00.000Z", endsAt: "2026-11-03T00:00:00.000Z", note: "festivo" });
    expect((await closuresBetween(db, "2026-11-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"))[0]).toEqual(expect.objectContaining({ staffEmail: "", note: "festivo" }));
    await deleteClosure(db, id);
    expect(await closuresBetween(db, "2026-11-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z")).toEqual([]);
  });

  it("comprueba las fechas", () => {
    expect(() => checkClosure({ staffEmail: "", startsAt: "", endsAt: "", note: "" })).toThrow(/desde cuándo/);
    expect(() => checkClosure({ staffEmail: "", startsAt: "2026-11-02T10:00:00.000Z", endsAt: "2026-11-02T09:00:00.000Z", note: "" })).toThrow(/después/);
  });

  it("a quién afecta y cuántas citas ya hay dentro", async () => {
    expect(closesFor({ staffEmail: "" }, "pablo@clinica.test")).toBe(true);
    expect(closesFor({ staffEmail: "laura@clinica.test" }, "Laura@Clinica.test")).toBe(true);
    expect(closesFor({ staffEmail: "laura@clinica.test" }, "pablo@clinica.test")).toBe(false);
    const pid = await createPatient(db, person("Ana"));
    await createAppointment(db, pid, { startsAt: "2026-11-03T09:00:00.000Z", minutes: 45, assignedTo: "laura@clinica.test" });
    await createAppointment(db, pid, { startsAt: "2026-11-03T11:00:00.000Z", minutes: 45, assignedTo: "pablo@clinica.test" });
    // Una que empieza antes y acaba dentro también cuenta.
    await createAppointment(db, pid, { startsAt: "2026-11-02T23:30:00.000Z", minutes: 60, assignedTo: "laura@clinica.test" });
    const day = { startsAt: "2026-11-03T00:00:00.000Z", endsAt: "2026-11-04T00:00:00.000Z", note: "" };
    expect(await appointmentsInside(db, { ...day, staffEmail: "laura@clinica.test" })).toBe(2);
    expect(await appointmentsInside(db, { ...day, staffEmail: "" })).toBe(3);
  });
});
