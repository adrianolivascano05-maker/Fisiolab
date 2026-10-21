import { describe, expect, it } from "vitest";
import { createAppointment, updateAppointment } from "./appointments";
import { addPayment, createPack } from "./billing";
import { saveSession } from "./clinical";
import { createPatient } from "./repo";
import { clinicStats, monthStarts } from "./stats";
import { createTestDb } from "./testDb";

const person = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const session = (performedAt: string) => ({ performedAt, pain: 3, subjective: "", objective: "", treatment: "Ejercicio", plan: "", reviewOn: null, nextAt: null, nextMinutes: null });

describe("la clínica en números", () => {
  it("sesiones, pacientes, citas, ausencias y por profesional, solo del periodo", async () => {
    const db = await createTestDb();
    const ana = await createPatient(db, person("Ana"));
    const luis = await createPatient(db, person("Luis"));
    await saveSession(db, ana, session("2026-10-02T09:00:00.000Z"));
    await saveSession(db, ana, session("2026-10-09T09:00:00.000Z"));
    await saveSession(db, luis, session("2026-10-05T09:00:00.000Z"));
    await saveSession(db, luis, session("2026-09-05T09:00:00.000Z")); // fuera
    const done = await createAppointment(db, ana, { startsAt: "2026-10-02T09:00:00.000Z", minutes: 45, assignedTo: "bruno@x.es" });
    const missed = await createAppointment(db, luis, { startsAt: "2026-10-03T09:00:00.000Z", minutes: 45, assignedTo: "bruno@x.es" });
    const off = await createAppointment(db, luis, { startsAt: "2026-10-04T09:00:00.000Z", minutes: 45, assignedTo: null });
    await createAppointment(db, luis, { startsAt: "2026-10-30T09:00:00.000Z", minutes: 45, assignedTo: null });
    await updateAppointment(db, done, { status: "done" });
    await updateAppointment(db, missed, { status: "no_show" });
    await updateAppointment(db, off, { status: "cancelled" });
    await createPack(db, ana, { title: "Bono 5", sessions: 5, priceCents: 18000, boughtOn: "2026-10-01", expiresOn: null, note: "" }, "bizum");
    await addPayment(db, luis, { amountCents: 4000, method: "efectivo", paidOn: "2026-10-31", concept: "" });
    await addPayment(db, luis, { amountCents: 4000, method: "efectivo", paidOn: "2026-11-01", concept: "" }); // fuera

    const s = await clinicStats(db, { from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" });
    expect(s).toMatchObject({ sessions: 3, patientsSeen: 2, discharges: 0, appointments: { done: 1, noShow: 1, cancelled: 1, scheduled: 1 }, noShowRate: 0.5, collectedCents: 22000, packsSold: 1 });
    expect(s.byPerson).toEqual([
      { email: "bruno@x.es", done: 1, noShow: 1, cancelled: 0 },
      { email: null, done: 0, noShow: 0, cancelled: 1 },
    ]);
    expect(s.monthly).toHaveLength(12);
    expect(s.monthly.at(-1)).toEqual({ month: "2026-10", sessions: 3 });
    expect(s.monthly.at(-2)).toEqual({ month: "2026-09", sessions: 1 });
  });

  it("los meses de la gráfica cruzan el año", () => {
    expect(monthStarts(new Date(2026, 1, 10), 3).map((d) => `${d.getFullYear()}-${d.getMonth() + 1}`)).toEqual(["2025-12", "2026-1", "2026-2"]);
  });
});
