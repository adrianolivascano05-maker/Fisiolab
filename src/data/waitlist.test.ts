import { beforeEach, describe, expect, it } from "vitest";
import { createAppointment } from "./appointments";
import type { Db } from "./db";
import { createPatient, deletePatient } from "./repo";
import { createTestDb } from "./testDb";
import {
  activeFilters,
  addToWaitlist,
  bandsOf,
  filterWaitlist,
  fits,
  listWaitlist,
  markOffered,
  preferText,
  removeFromWaitlist,
  removePatientFromWaitlist,
  slotOf,
  sortWaitlist,
  waitlistOf,
  updateWaitlist,
  waitlistCount,
  type WaitItem,
} from "./waitlist";
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
    // La entrada de un paciente, sin leer la lista entera (la ficha); null si no está.
    expect(await waitlistOf(db, luis)).toMatchObject({ name: "Luis Gil", nextAt: "2099-03-02T10:00:00.000Z" });
    expect(await waitlistOf(db, "nadie")).toBeNull();
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
    expect(slotOf("2026-10-21T08:00:00.000Z")).toEqual({ date: "2026-10-21", day: 3, time: "manana", min: 600 });
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

  it("preferente, desde qué día puede y unas horas concretas: se guardan, se comprueban y deciden si encaja un hueco", async () => {
    const ana = await createPatient(db, patient("Ana Ruiz"));
    const id = await addToWaitlist(db, ana, { note: "", assignedTo: null, preferTime: "manana", preferDays: [2], priority: true, availableFrom: "2026-11-02", fromMin: 18 * 60, toMin: 20 * 60 });
    const [w] = await listWaitlist(db);
    // Con horas concretas, la franja no cuenta.
    expect(w).toMatchObject({ priority: true, availableFrom: "2026-11-02", fromMin: 1080, toMin: 1200, preferTime: "" });
    expect(preferText(w!)).toBe("De 18:00 a 20:00, martes");
    expect(bandsOf(w!)).toEqual({ manana: false, tarde: true });
    // Martes 27 de octubre, 18:00 en Madrid: aún no puede. Martes 3 de noviembre: a las 18:00 sí; a las 19:30, 45 minutos no caben.
    expect(fits(w!, "2026-10-27T17:00:00.000Z", 45)).toBe(false);
    expect(fits(w!, "2026-11-03T17:00:00.000Z", 45)).toBe(true);
    expect(fits(w!, "2026-11-03T18:30:00.000Z", 45)).toBe(false);
    expect(fits(w!, "2026-11-03T09:00:00.000Z", 45)).toBe(false);
    await expect(updateWaitlist(db, id, { note: "", assignedTo: null, fromMin: 600, toMin: null })).rejects.toThrow(/desde qué hora y hasta qué hora/);
    await expect(updateWaitlist(db, id, { note: "", assignedTo: null, fromMin: 600, toMin: 540 })).rejects.toThrow(/después/);
    await expect(updateWaitlist(db, id, { note: "", assignedTo: null, availableFrom: "mañana" })).rejects.toThrow(/no es válida/);
    await updateWaitlist(db, id, { note: "", assignedTo: null, preferTime: "tarde" });
    expect((await listWaitlist(db))[0]).toMatchObject({ priority: false, availableFrom: null, fromMin: null, toMin: null, preferTime: "tarde" });
  });

  it("se filtra por varias cosas a la vez y se ordena por tiempo de espera, prioridad, cita, ofrecido o nombre", () => {
    const now = new Date("2026-10-25T10:00:00.000Z");
    const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
    const base: WaitItem = {
      id: "", patientId: "", name: "", phone: "", email: "", contact: null, note: "", assignedTo: null, createdAt: ago(1), nextAt: null, nextId: null,
      preferTime: "", preferDays: [], offeredAt: null, priority: false, availableFrom: null, fromMin: null, toMin: null,
    };
    const w = (name: string, x: Partial<WaitItem>): WaitItem => ({ ...base, id: name, name, ...x });
    const items = [
      w("Álvaro Mañanas", { preferTime: "manana", preferDays: [1, 3], createdAt: ago(20), phone: "+34 600 111 222" }),
      w("Bea Tardes", { preferTime: "tarde", createdAt: ago(3), priority: true, assignedTo: "laura@x.test", offeredAt: ago(1) }),
      w("Carla Cualquiera", { createdAt: ago(40), nextAt: "2026-12-01T10:00:00.000Z" }),
      w("Dani Horas", { fromMin: 18 * 60, toMin: 20 * 60, preferDays: [2], createdAt: ago(10), availableFrom: "2026-11-10", assignedTo: "pablo@x.test" }),
      w("Eva Lunes", { preferDays: [1], createdAt: ago(8), nextAt: "2026-10-28T10:00:00.000Z", offeredAt: ago(5) }),
    ];
    const names = (l: WaitItem[]) => l.map((x) => x.name.split(" ")[0]);
    // Mañanas: quien las pidió y quien puede a cualquier hora.
    expect(names(filterWaitlist(items, { band: "manana" }, now))).toEqual(["Álvaro", "Carla", "Eva"]);
    // Tardes y martes: quien puede alguna tarde de martes.
    expect(names(filterWaitlist(items, { band: "tarde", days: [2] }, now))).toEqual(["Bea", "Carla", "Dani"]);
    // Con Laura: los suyos y los de cualquiera; preferentes; ya pueden; más de 15 días esperando.
    expect(names(filterWaitlist(items, { who: "laura@x.test" }, now))).toEqual(["Álvaro", "Bea", "Carla", "Eva"]);
    expect(names(filterWaitlist(items, { priority: true }, now))).toEqual(["Bea"]);
    expect(names(filterWaitlist(items, { ready: true }, now))).toEqual(["Álvaro", "Bea", "Carla", "Eva"]);
    expect(names(filterWaitlist(items, { minDays: 15 }, now))).toEqual(["Álvaro", "Carla"]);
    // Ofrecido o no, con cita o sin ella, y todo a la vez.
    expect(names(filterWaitlist(items, { offered: "no", cita: "no" }, now))).toEqual(["Álvaro", "Dani"]);
    expect(names(filterWaitlist(items, { band: "manana", days: [1], cita: "si", offered: "si", ready: true }, now))).toEqual(["Eva"]);
    // Buscar por nombre (sin tildes), por la nota o por el teléfono.
    expect(names(filterWaitlist(items, { q: "alvaro" }, now))).toEqual(["Álvaro"]);
    expect(names(filterWaitlist(items, { q: "111 222" }, now))).toEqual(["Álvaro"]);
    expect(activeFilters({ band: "manana", days: [1], q: " " })).toBe(2);
    expect(activeFilters({})).toBe(0);

    expect(names(sortWaitlist(items, "espera"))).toEqual(["Carla", "Álvaro", "Dani", "Eva", "Bea"]);
    expect(names(sortWaitlist(items, "recientes"))).toEqual(["Bea", "Eva", "Dani", "Álvaro", "Carla"]);
    expect(names(sortWaitlist(items, "prioridad"))).toEqual(["Bea", "Carla", "Álvaro", "Dani", "Eva"]);
    expect(names(sortWaitlist(items, "cita"))).toEqual(["Álvaro", "Dani", "Bea", "Carla", "Eva"]);
    expect(names(sortWaitlist(items, "ofrecido"))).toEqual(["Carla", "Álvaro", "Dani", "Eva", "Bea"]);
    expect(names(sortWaitlist(items, "nombre"))).toEqual(["Álvaro", "Bea", "Carla", "Dani", "Eva"]);
  });
});
