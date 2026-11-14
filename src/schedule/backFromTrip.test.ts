// «Vuelve de viaje y no tiene cita» (backFromTrip.ts): quién sale y cuándo deja de salir.
import { beforeEach, describe, expect, it } from "vitest";
import { createAppointment, updateAppointment } from "../data/appointments";
import type { Db } from "../data/db";
import { savePatientEvent, type EventInput } from "../data/patientEvents";
import { createPatient } from "../data/repo";
import { updateEpisode } from "../data/episodes";
import { createTestDb } from "../data/testDb";
import { backFromTrip, backText } from "./backFromTrip";

const patient = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const trip = (startsOn: string, endsOn: string): EventInput => ({ kind: "travel", title: "", startsOn, endsOn, time: null, minutes: null, repeatDays: [], repeatUntil: null, notes: "" });
const today = "2026-11-20";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("vuelve de viaje sin cita", () => {
  it("sale si vino antes de irse y no tiene cita desde entonces; deja de salir con una cita", async () => {
    const ana = await createPatient(db, patient("Ana Viaje"));
    await createAppointment(db, ana, { startsAt: "2026-11-02T09:00:00.000Z", minutes: 45 });
    await savePatientEvent(db, ana, trip("2026-11-10", "2026-11-19"));
    expect((await backFromTrip(db, today)).map((b) => [b.name, b.back])).toEqual([["Ana Viaje", "2026-11-20"]]);
    const next = await createAppointment(db, ana, { startsAt: "2026-11-24T09:00:00.000Z", minutes: 45 });
    expect(await backFromTrip(db, today)).toEqual([]);
    // Si se anula, vuelve a salir.
    await updateAppointment(db, next, { status: "cancelled" });
    expect(await backFromTrip(db, today)).toHaveLength(1);
  });

  it("las citas que se quedaron dentro del viaje («No vino» o pendientes) no cuentan; una atendida al volver, sí", async () => {
    const ana = await createPatient(db, patient("Ana Viaje"));
    await createAppointment(db, ana, { startsAt: "2026-11-03T09:00:00.000Z", minutes: 45 });
    const inside = await createAppointment(db, ana, { startsAt: "2026-11-12T09:00:00.000Z", minutes: 45 });
    await updateAppointment(db, inside, { status: "no_show" });
    await createAppointment(db, ana, { startsAt: "2026-11-17T09:00:00.000Z", minutes: 45 });
    await savePatientEvent(db, ana, trip("2026-11-10", "2026-11-19"));
    expect((await backFromTrip(db, today)).map((b) => b.name)).toEqual(["Ana Viaje"]);
    const back = await createAppointment(db, ana, { startsAt: "2026-11-20T08:00:00.000Z", minutes: 45 });
    await updateAppointment(db, back, { status: "done" });
    expect(await backFromTrip(db, today)).toEqual([]);
  });

  it("no sale quien no venía antes de irse, ni fuera de los días de alrededor de la vuelta", async () => {
    const nuevo = await createPatient(db, patient("Nuevo Sin Visitas"));
    await savePatientEvent(db, nuevo, trip("2026-11-10", "2026-11-19"));
    const viejo = await createPatient(db, patient("Vino Hace Mucho"));
    await createAppointment(db, viejo, { startsAt: "2026-08-01T09:00:00.000Z", minutes: 45 });
    await savePatientEvent(db, viejo, trip("2026-11-10", "2026-11-19"));
    const lejos = await createPatient(db, patient("Vuelve Mas Tarde"));
    await createAppointment(db, lejos, { startsAt: "2026-11-02T09:00:00.000Z", minutes: 45 });
    await savePatientEvent(db, lejos, trip("2026-11-10", "2026-11-25"));
    expect(await backFromTrip(db, today)).toEqual([]);
    // Dos días antes de volver ya sale; una semana después, todavía; al octavo día, ya no.
    expect((await backFromTrip(db, "2026-11-24")).map((b) => b.name)).toEqual(["Vuelve Mas Tarde"]);
    expect((await backFromTrip(db, "2026-12-02")).map((b) => b.name)).toEqual(["Vuelve Mas Tarde"]);
    expect(await backFromTrip(db, "2026-12-03")).toEqual([]);
  });

  it("no sale quien tiene su motivo de consulta dado de alta", async () => {
    const ana = await createPatient(db, patient("Ana Alta"));
    await createAppointment(db, ana, { startsAt: "2026-11-02T09:00:00.000Z", minutes: 45 });
    await savePatientEvent(db, ana, trip("2026-11-10", "2026-11-19"));
    expect(await backFromTrip(db, today)).toHaveLength(1);
    await updateEpisode(db, ana, ana, { closedAt: "2026-11-05T10:00:00.000Z" });
    expect(await backFromTrip(db, today)).toEqual([]);
  });

  it("en palabras", () => {
    expect(backText("2026-11-20", today)).toBe("Vuelve hoy");
    expect(backText("2026-11-21", today)).toBe("Vuelve el sábado, 21 de noviembre");
    expect(backText("2026-11-16", today)).toBe("Volvió el lunes, 16 de noviembre");
  });
});
