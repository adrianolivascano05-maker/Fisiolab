import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cloud } from "../cloud/CloudGate";
import { createAppointment, deleteAppointment, getAppointment, updateAppointment } from "../data/appointments";
import { createClosure } from "../data/closures";
import type { Db } from "../data/db";
import { createPatient } from "../data/repo";
import { createTestDb } from "../data/testDb";
import { sealForClinic, tokenHash } from "./crypto";
import { bookingKeys, DEFAULT_BOOKING, saveBookingSettings, type BookingPayload } from "./settings";
import { bookingPage, collectBookings, forgetSentLinks, syncCancelLinks } from "./sync";

vi.mock("../cloud/auth", () => ({ getToken: () => ({ accessToken: "tok", expiresAt: Date.now() + 3_600_000 }) }));

const person = (name: string, phone = "") => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "", phone });

type Link = { hash: string; ref: string; startsAt: string; minutes: number; pro: string | null; cancelled?: boolean };
type Inbox = Awaited<ReturnType<NonNullable<Cloud["clinics"]>["booking"]["inbox"]>>;

function fakeCloud(inbox: Partial<Inbox> = {}) {
  const sent = { links: [] as Link[][], collected: [] as unknown[] };
  const cloud = {
    clinic: { id: "clinica-1", name: "Fisiolab", role: "admin" },
    clinics: {
      booking: {
        publish: vi.fn(async () => {}),
        inbox: vi.fn(async () => ({ slug: "fisiolab", bookings: [], cancels: [], ...inbox })),
        collected: vi.fn(async (_t: unknown, _id: string, done: unknown) => void sent.collected.push(done)),
        links: vi.fn(async (_t: unknown, _id: string, links: Link[]) => void sent.links.push(links)),
      },
    },
  } as unknown as Cloud;
  return { cloud, sent };
}

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  const store = new Map<string, string>();
  const local = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  // Como el de verdad: Object.keys da las claves guardadas.
  vi.stubGlobal("localStorage", new Proxy(local, { ownKeys: () => [...store.keys()], getOwnPropertyDescriptor: (_t, k) => (store.has(String(k)) ? { enumerable: true, configurable: true, value: store.get(String(k)) } : undefined) }));
});

describe("reserva online desde la app", () => {
  it("lo que se publica son franjas libres: sin pacientes, sin citas y sin correos", async () => {
    const pid = await createPatient(db, person("Lucía Secreta", "600111222"));
    const now = new Date("2026-10-26T06:00:00.000Z"); // lunes, 7:00 en Madrid
    await createAppointment(db, pid, { startsAt: "2026-10-27T09:00:00.000Z", minutes: 60 }); // martes 10:00
    const { page, windows } = await bookingPage(db, { ...DEFAULT_BOOKING, enabled: true, slug: "fisiolab", days: 2, minNoticeHours: 2 }, false, now);
    const text = JSON.stringify({ page, windows });
    expect(text).not.toMatch(/Lucía|600111222/);
    // El martes por la mañana: libre de 9 a 10 y de 11 a 14 (hora de Madrid).
    expect(windows.filter((w) => w.from.startsWith("2026-10-27") && w.to <= "2026-10-27T13:00:00.000Z")).toEqual([
      { pro: "", from: "2026-10-27T08:00:00.000Z", to: "2026-10-27T09:00:00.000Z" },
      { pro: "", from: "2026-10-27T10:00:00.000Z", to: "2026-10-27T13:00:00.000Z" },
    ]);
  });

  it("lo publicado no ofrece los días cerrados, cuenta la sesión que ya ha empezado y lleva el contorno aparte", async () => {
    const pid = await createPatient(db, person("Pepe"));
    const now = new Date("2026-10-26T09:30:00.000Z"); // lunes, 10:30 en Madrid
    await createAppointment(db, pid, { startsAt: "2026-10-26T09:00:00.000Z", minutes: 90 }); // 10:00–11:30, ya empezada
    await createClosure(db, { staffEmail: "", startsAt: "2026-10-27T00:00:00.000+01:00", endsAt: "2026-10-28T00:00:00.000+01:00", note: "festivo" }, "");
    const { windows, envelope } = await bookingPage(db, { ...DEFAULT_BOOKING, enabled: true, slug: "fisiolab", days: 2, minNoticeHours: 0 }, false, now);
    // El lunes, desde que acaba la sesión empezada; el martes, nada (cerrado); el miércoles, su horario.
    expect(windows.filter((w) => w.from.startsWith("2026-10-26"))).toEqual([{ pro: "", from: "2026-10-26T10:30:00.000Z", to: "2026-10-26T13:00:00.000Z" }, { pro: "", from: "2026-10-26T15:00:00.000Z", to: "2026-10-26T19:00:00.000Z" }]);
    expect(windows.some((w) => w.from.startsWith("2026-10-27"))).toBe(false);
    expect(windows.some((w) => w.from.startsWith("2026-10-28"))).toBe(true);
    // El contorno: el horario sin lo cerrado, con la sesión dentro (al anularla se puede volver a ofrecer).
    expect(envelope.filter((w) => w.from.startsWith("2026-10-26"))[0]).toEqual({ pro: "", from: "2026-10-26T09:30:00.000Z", to: "2026-10-26T13:00:00.000Z" });
  });

  it("recoge una reserva: abre lo cifrado, crea el paciente y la cita, y avisa al servidor; la anulación la anula", async () => {
    await saveBookingSettings(db, { ...DEFAULT_BOOKING, enabled: true, slug: "fisiolab" });
    const keys = await bookingKeys(db);
    const payload: BookingPayload = { v: 1, name: "Marta Nueva", phone: "611 222 333", email: "", note: "Hombro", cancelToken: "codigo-de-marta-123456789", consentAt: "2026-10-23T10:00:00.000Z" };
    const booking = { id: "reserva-1", startsAt: "2026-10-27T09:00:00.000Z", minutes: 60, pro: "", kind: "primera", payload: await sealForClinic(keys.publicJwk, payload), createdAt: "", collected: false, cancelledAt: null };
    const first = fakeCloud({ bookings: [booking] });
    expect(await collectBookings(db, first.cloud)).toEqual({ booked: [{ name: "Marta Nueva", startsAt: booking.startsAt }], cancelled: [], unreadable: 0 });
    expect(first.sent.collected).toEqual([{ bookings: ["reserva-1"], cancels: [] }]);
    const a = await getAppointment(db, "reserva-1");
    expect(a).toEqual(expect.objectContaining({ startsAt: booking.startsAt, minutes: 60, status: "scheduled", source: "online", cancelToken: payload.cancelToken }));
    const [p] = await db.query<{ name: string; phone: string; notes: string }>("select name, phone, notes from patients where id = ?", [a!.patientId]);
    expect(p).toEqual(expect.objectContaining({ name: "Marta Nueva", phone: "611 222 333" }));
    expect(p!.notes).toContain("Hombro");
    // Si vuelve a llegar (el aviso se perdió), no se duplica.
    await collectBookings(db, fakeCloud({ bookings: [booking] }).cloud);
    expect((await db.query("select id from appointments")).length).toBe(1);

    // La anula desde su enlace.
    const again = fakeCloud({ bookings: [{ ...booking, payload: null, collected: true, cancelledAt: "2026-10-24T10:00:00.000Z" }] });
    expect(await collectBookings(db, again.cloud)).toEqual({ booked: [], cancelled: [{ name: "Marta Nueva", startsAt: booking.startsAt }], unreadable: 0 });
    expect((await getAppointment(db, "reserva-1"))!.status).toBe("cancelled");
  });

  it("un paciente que ya está (mismo móvil) no se duplica", async () => {
    await createPatient(db, person("Marta Antigua", "+34 611222333"));
    const keys = await bookingKeys(db);
    const payload: BookingPayload = { v: 1, name: "Marta", phone: "611222333", email: "", note: "", cancelToken: "codigo-de-marta-987654321", consentAt: "" };
    const { cloud } = fakeCloud({ bookings: [{ id: "reserva-2", startsAt: "2026-10-27T09:00:00.000Z", minutes: 45, pro: "", kind: "seguimiento", payload: await sealForClinic(keys.publicJwk, payload), createdAt: "", collected: false, cancelledAt: null }] });
    await collectBookings(db, cloud);
    expect((await db.query("select id from patients")).length).toBe(1);
  });

  it("una reserva que no se puede abrir se descarta y se avisa, sin atascar las demás", async () => {
    const keys = await bookingKeys(db);
    const good: BookingPayload = { v: 1, name: "Rosa Buena", phone: "622000111", email: "", note: "", cancelToken: "codigo-de-rosa-123456789", consentAt: "" };
    const other = await bookingKeys(await createTestDb()); // la clave de otra clínica
    const base = { minutes: 60, pro: "", kind: "primera", createdAt: "", collected: false, cancelledAt: null };
    const { cloud, sent } = fakeCloud({
      bookings: [
        { ...base, id: "falsa", startsAt: "2026-10-27T08:00:00.000Z", payload: await sealForClinic(other.publicJwk, good) },
        { ...base, id: "sin-datos", startsAt: "2026-10-27T10:00:00.000Z", payload: await sealForClinic(keys.publicJwk, { hola: 1 }) },
        { ...base, id: "buena", startsAt: "2026-10-27T09:00:00.000Z", payload: await sealForClinic(keys.publicJwk, good) },
      ],
    });
    expect(await collectBookings(db, cloud)).toEqual({ booked: [{ name: "Rosa Buena", startsAt: "2026-10-27T09:00:00.000Z" }], cancelled: [], unreadable: 2 });
    // Las tres se dan por vistas: las malas no vuelven y no ocupan su hueco.
    expect(sent.collected).toEqual([{ bookings: ["falsa", "sin-datos", "buena"], cancels: [] }]);
    expect(await getAppointment(db, "falsa")).toBeNull();
  });

  it("si la reserva cae encima de otra cita (se dio a mano a la vez), avisa con quién se solapa", async () => {
    const pid = await createPatient(db, person("Juan Mano"));
    await createAppointment(db, pid, { startsAt: "2026-10-27T09:30:00.000Z", minutes: 60 });
    const keys = await bookingKeys(db);
    const payload: BookingPayload = { v: 1, name: "Rosa Web", phone: "622000222", email: "", note: "", cancelToken: "codigo-de-rosa-987654321", consentAt: "" };
    const { cloud } = fakeCloud({ bookings: [{ id: "web", startsAt: "2026-10-27T09:00:00.000Z", minutes: 60, pro: "", kind: "primera", payload: await sealForClinic(keys.publicJwk, payload), createdAt: "", collected: false, cancelledAt: null }] });
    expect((await collectBookings(db, cloud))!.booked).toEqual([{ name: "Rosa Web", startsAt: "2026-10-27T09:00:00.000Z", clash: "Juan Mano" }]);
  });

  it("una anulación de una cita que este dispositivo aún no tiene no se da por vista (salvo si ya pasó)", async () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const first = fakeCloud({
      cancels: [
        { hash: "a".repeat(64), ref: "de-otro-dispositivo", startsAt: future, cancelledAt: "" },
        { hash: "b".repeat(64), ref: "vieja", startsAt: past, cancelledAt: "" },
      ],
    });
    await collectBookings(db, first.cloud);
    expect(first.sent.collected).toEqual([{ bookings: [], cancels: ["b".repeat(64)] }]);
    // Cuando llega la cita (con la sincronización), se anula y ya sí.
    const pid = await createPatient(db, person("Lola"));
    await db.transaction([{ sql: "insert into appointments (id, patient_id, starts_at, minutes, status, created_at, updated_at) values (?, ?, ?, 45, 'scheduled', ?, ?)", bind: ["de-otro-dispositivo", pid, future, future, future] }]);
    const again = fakeCloud({ cancels: [{ hash: "a".repeat(64), ref: "de-otro-dispositivo", startsAt: future, cancelledAt: "" }] });
    expect((await collectBookings(db, again.cloud))!.cancelled).toEqual([{ name: "Lola", startsAt: future }]);
    expect(again.sent.collected).toEqual([{ bookings: [], cancels: ["a".repeat(64)] }]);

    // Igual con una reserva anulada: si la recogió otro dispositivo, se espera a tener la cita; si nadie la recogió, no.
    const base = { minutes: 60, pro: "", kind: "primera", payload: null, createdAt: "", cancelledAt: "2026-10-24T10:00:00.000Z" };
    const third = fakeCloud({ bookings: [{ ...base, id: "recogida-por-otro", startsAt: future, collected: true }, { ...base, id: "sin-recoger", startsAt: future, collected: false }] });
    await collectBookings(db, third.cloud);
    expect(third.sent.collected).toEqual([{ bookings: ["sin-recoger"], cancels: [] }]);
  });

  it("si se borra una cita con enlace, el enlace se anula; tras restaurar una copia, no", async () => {
    const pid = await createPatient(db, person("Pablo"));
    const id = await createAppointment(db, pid, { startsAt: "2099-01-05T09:00:00.000Z", minutes: 45 });
    await db.transaction([{ sql: "update appointments set cancel_token = ? where id = ?", bind: ["codigo-de-pablo-111111111", id] }]);
    const { cloud, sent } = fakeCloud();
    await syncCancelLinks(db, cloud, false);
    await deleteAppointment(db, id);
    expect(await syncCancelLinks(db, cloud, false)).toBe(1);
    expect(sent.links[1]).toEqual([expect.objectContaining({ hash: await tokenHash("codigo-de-pablo-111111111"), ref: id, cancelled: true })]);
    expect(await syncCancelLinks(db, cloud, false)).toBe(0);

    // Restaurar: lo que no esté en la copia no se da por borrado.
    const other = await createAppointment(db, pid, { startsAt: "2099-01-06T09:00:00.000Z", minutes: 45 });
    await db.transaction([{ sql: "update appointments set cancel_token = ? where id = ?", bind: ["codigo-de-pablo-222222222", other] }]);
    await syncCancelLinks(db, cloud, false);
    forgetSentLinks();
    await db.transaction([{ sql: "delete from appointments where id = ?", bind: [other] }]);
    expect(await syncCancelLinks(db, cloud, false)).toBe(0);
  });

  it("los enlaces para anular se ponen al día solo cuando la cita cambia (hora o anulada)", async () => {
    const pid = await createPatient(db, person("Pablo"));
    const id = await createAppointment(db, pid, { startsAt: "2099-01-05T09:00:00.000Z", minutes: 45 });
    await db.transaction([{ sql: "update appointments set cancel_token = ? where id = ?", bind: ["codigo-de-pablo-111111111", id] }]);
    const { cloud, sent } = fakeCloud();
    expect(await syncCancelLinks(db, cloud, false)).toBe(1);
    expect(sent.links[0]).toEqual([expect.objectContaining({ hash: await tokenHash("codigo-de-pablo-111111111"), ref: id, startsAt: "2099-01-05T09:00:00.000Z", minutes: 45, pro: null, cancelled: false })]);
    expect(await syncCancelLinks(db, cloud, false)).toBe(0);
    await updateAppointment(db, id, { startsAt: "2099-01-05T11:00:00.000Z" });
    expect(await syncCancelLinks(db, cloud, false)).toBe(1);
    expect(sent.links[1]![0]!.startsAt).toBe("2099-01-05T11:00:00.000Z");
    await updateAppointment(db, id, { status: "cancelled" });
    await syncCancelLinks(db, cloud, false);
    expect(sent.links[2]![0]!.cancelled).toBe(true);
  });
});
