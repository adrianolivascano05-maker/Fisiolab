// Lo que lleva el enlace de «Su calendario» (createForm.ts): lo que ya tiene apuntado de hoy en adelante, sin las notas
// de la clínica, y sus próximas citas, para que lo vea y no lo apunte otra vez.
import { describe, expect, it } from "vitest";
import { createAppointment, updateAppointment } from "../data/appointments";
import { savePatientEvent, type EventInput } from "../data/patientEvents";
import { createPatient } from "../data/repo";
import { createTestDb } from "../data/testDb";
import { calendarSnapshot } from "./createForm";

const patient = { name: "Nora Enlace", birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" };
const ev = (over: Partial<EventInput>): EventInput => ({ kind: "other", title: "", startsOn: "2026-11-20", endsOn: null, time: null, minutes: null, repeatDays: [], repeatUntil: null, notes: "", ...over });
// Jueves 12 de noviembre de 2026, 10:00 en Madrid.
const NOW = new Date("2026-11-12T09:00:00.000Z");

describe("«Su calendario»: lo que ya tiene", () => {
  it("lo de hoy en adelante (también lo de cada semana que sigue), sin notas, y sus próximas citas pendientes", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient);
    await savePatientEvent(db, pid, ev({ kind: "surgery", title: "Menisco", startsOn: "2026-10-01", notes: "Nota interna" })); // ya pasó
    await savePatientEvent(db, pid, ev({ kind: "competition", title: "Partido", startsOn: "2026-11-21", notes: "Nota interna" }));
    await savePatientEvent(db, pid, ev({ kind: "training", title: "Pádel", startsOn: "2026-09-01", repeatDays: [2, 4], time: "19:00", minutes: 90 }));
    await createAppointment(db, pid, { startsAt: "2026-11-10T09:00:00.000Z", minutes: 45 }); // ya pasó
    await createAppointment(db, pid, { startsAt: "2026-11-17T09:00:00.000Z", minutes: 45 });
    const cancelled = await createAppointment(db, pid, { startsAt: "2026-11-19T09:00:00.000Z", minutes: 45 });
    await updateAppointment(db, cancelled, { status: "cancelled" });
    const snap = await calendarSnapshot(db, pid, NOW);
    expect(snap.events.map((e) => [e.title, e.notes])).toEqual([
      ["Pádel", ""],
      ["Partido", ""],
    ]);
    expect(snap.visits).toEqual(["2026-11-17T09:00:00.000Z"]);
  });
});
