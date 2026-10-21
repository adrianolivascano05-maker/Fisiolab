import { beforeEach, describe, expect, it } from "vitest";
import { createAppointment } from "./appointments";
import type { Db } from "./db";
import { createPatient, deletePatient } from "./repo";
import { createTestDb } from "./testDb";
import { addToWaitlist, fits, listWaitlist, markOffered, preferText, removeFromWaitlist, removePatientFromWaitlist, slotOf, updateWaitlist, waitlistCount } from "./waitlist";
import { offerText } from "../schedule/reminders";

const patient = (name: string, phone = "") => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "", phone });

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("lista de espera", () => {
  it("apunta a cada paciente una vez, por orden de llegada, con su próxima cita", async () => {
    const ana = await createPatient(db, patient("Ana Ruiz", "612345678"));
    const luis = await createPatient(db, patient("Luis Gil"));
    await createAppointment(db, luis, { startsAt: "2099-03-02T10:00:00.000Z", minutes: 45 });
    await addToWaitlist(db, ana, { note: " Mañanas ", assignedTo: null });
    await addToWaitlist(db, luis, { note: "", assignedTo: "bruno@clinica.test" });
    await expect(addToWaitlist(db, ana, { note: "", assignedTo: null })).rejects.toThrow(/Ya está/);
    const list = await listWaitlist(db);
    expect(list.map((w) => [w.name, w.note, w.assignedTo, w.nextAt])).toEqual([
      ["Ana Ruiz", "Mañanas", null, null],
      ["Luis Gil", "", "bruno@clinica.test", "2099-03-02T10:00:00.000Z"],
    ]);
    expect(list[0]).toMatchObject({ phone: "612345678", contact: null });
    expect(list[1]!.nextId).toEqual(expect.any(String));
    expect(list[0]!.nextId).toBeNull();
    expect(await waitlistCount(db)).toBe(2);
  });

  it("para un hueco de una persona del equipo: los que la esperan a ella o a cualquiera", async () => {
    const ana = await createPatient(db, patient("Ana Ruiz"));
    const luis = await createPatient(db, patient("Luis Gil"));
    const eva = await createPatient(db, patient("Eva Sanz"));
    await addToWaitlist(db, ana, { note: "", assignedTo: null });
    await addToWaitlist(db, luis, { note: "", assignedTo: "bruno@clinica.test" });
    await addToWaitlist(db, eva, { note: "", assignedTo: "carla@clinica.test" });
    expect((await listWaitlist(db, "bruno@clinica.test")).map((w) => w.name)).toEqual(["Ana Ruiz", "Luis Gil"]);
  });

  it("se quita a mano, al darle la cita o al borrar el paciente", async () => {
    const ana = await createPatient(db, patient("Ana Ruiz"));
    const luis = await createPatient(db, patient("Luis Gil"));
    const eva = await createPatient(db, patient("Eva Sanz"));
    const id = await addToWaitlist(db, ana, { note: "", assignedTo: null });
    await addToWaitlist(db, luis, { note: "", assignedTo: null });
    await addToWaitlist(db, eva, { note: "", assignedTo: null });
    await removeFromWaitlist(db, id);
    await removePatientFromWaitlist(db, luis);
    await deletePatient(db, eva);
    expect(await waitlistCount(db)).toBe(0);
  });

  it("el mensaje para ofrecer el hueco", () => {
    expect(offerText({ name: "Ana Ruiz", startsAt: "2026-10-21T08:00:00.000Z", clinic: "Fisiolab", professional: "Bruno" })).toBe(
      "Hola, Ana. Se ha quedado libre un hueco de fisioterapia con Bruno en Fisiolab el miércoles, 21 de octubre a las 10:00. ¿Te viene bien? Responde a este mensaje y te lo guardamos.",
    );
  });

  it("cuándo le viene bien: mañanas o tardes y qué días; si le encaja un hueco", async () => {
    const ana = await createPatient(db, patient("Ana Ruiz"));
    const id = await addToWaitlist(db, ana, { note: "", assignedTo: null, preferTime: "manana", preferDays: [3, 1, 3] });
    let [w] = await listWaitlist(db);
    expect(w).toMatchObject({ preferTime: "manana", preferDays: [1, 3], offeredAt: null });
    expect(preferText(w!)).toBe("Mañanas, lunes y miércoles");
    // Miércoles 21 de octubre de 2026: a las 10:00 y a las 17:00 en Madrid.
    expect(slotOf("2026-10-21T08:00:00.000Z")).toEqual({ day: 3, time: "manana" });
    expect(fits(w!, "2026-10-21T08:00:00.000Z")).toBe(true);
    expect(fits(w!, "2026-10-21T15:00:00.000Z")).toBe(false);
    expect(fits(w!, "2026-10-22T08:00:00.000Z")).toBe(false);
    await updateWaitlist(db, id, { note: "Mejor pronto", assignedTo: null, preferTime: "", preferDays: [] });
    await markOffered(db, id);
    [w] = await listWaitlist(db);
    expect(w).toMatchObject({ note: "Mejor pronto", preferTime: "", preferDays: [] });
    expect(w!.offeredAt).not.toBeNull();
    expect(preferText(w!)).toBe("Cualquier día y hora");
    expect(fits(w!, "2026-10-25T18:00:00.000Z")).toBe(true);
    expect(preferText({ preferTime: "", preferDays: [5] })).toBe("Viernes");
  });
});
