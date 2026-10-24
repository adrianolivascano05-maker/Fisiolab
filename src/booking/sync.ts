// La reserva online desde la app: publicar en el servidor las franjas libres (cuando cambia la agenda) y recoger las
// reservas y las anulaciones que han hecho los pacientes. Las reservas se convierten en citas (y en pacientes nuevos
// si no están ya). También los enlaces para anular las citas que da la clínica.
import { logError } from "../app/errorLog";
import { getToken } from "../cloud/auth";
import type { Cloud } from "../cloud/CloudGate";
import { agenda, createOnlineAppointment, getAppointment, setCancelToken, updateAppointment, type Appointment } from "../data/appointments";
import type { Db } from "../data/db";
import { memberEmail } from "../data/member";
import { getClinic } from "../data/privacy";
import { createPatient } from "../data/repo";
import { closesFor, closuresBetween } from "../data/closures";
import { listStaff, shiftsBetween, staffColor } from "../data/schedule";
import { bookableSpans, freeWindows, type Span } from "./availability";
import { newCancelToken, openFromPatient, tokenHash } from "./crypto";
import { bookingKeys, getBookingSettings, type BookingPayload, type BookingSettings, type PublicBookingInfo } from "./settings";

const DAY = 86_400_000;

/**
 * Lo que se publica: la página (sin correos ni pacientes), las franjas libres y cuándo se puede reservar con cada fisio
 * sin quitar las citas (`envelope`: al anular una cita, el servidor solo deja libre lo que cae dentro; nunca un rato
 * cerrado ni fuera de horario).
 */
export async function bookingPage(db: Db, settings: BookingSettings, team: boolean, now = new Date()) {
  const from = now.toISOString();
  const to = new Date(now.getTime() + (settings.days + 2) * DAY).toISOString();
  // Desde unas horas antes: una sesión que ya ha empezado también ocupa su hueco.
  const since = new Date(now.getTime() - 12 * 3_600_000).toISOString();
  const [appointments, shifts, closures, staff, clinic] = await Promise.all([
    agenda(db, since, to),
    team ? shiftsBetween(db, from, to) : Promise.resolve([]),
    closuresBetween(db, from, to),
    team ? listStaff(db) : Promise.resolve([]),
    getClinic(db),
  ]);
  const busyOf = (keep: (a: Appointment) => boolean): Span[] =>
    appointments.filter((a) => a.status !== "cancelled" && keep(a)).map((a) => ({ from: a.startsAt, to: new Date(Date.parse(a.startsAt) + a.minutes * 60_000).toISOString() }));
  const closedFor = (email: string | null): Span[] => closures.filter((c) => (team ? closesFor(c, email) : true)).map((c) => ({ from: c.startsAt, to: c.endsAt }));
  const pros = team
    ? settings.pros.map((p) => ({
        id: p.id,
        shifts: shifts.filter((s) => s.staffEmail === p.email).map((s) => ({ from: s.startsAt, to: s.endsAt })),
        // Sus citas y las que no son de nadie (para no dar dos veces el mismo hueco).
        busy: busyOf((a) => a.assignedTo === p.email || !a.assignedTo),
        closed: closedFor(p.email),
      }))
    : [{ id: "", shifts: [], busy: busyOf(() => true), closed: closedFor(null) }];
  const input = { now: from, days: settings.days, minNoticeHours: settings.minNoticeHours, hours: settings.hours, pros };
  const windows = freeWindows(input);
  const envelope = bookableSpans(input);
  const page: PublicBookingInfo = {
    clinic: clinic.name,
    intro: settings.intro,
    kinds: settings.kinds,
    minNoticeHours: settings.minNoticeHours,
    step: settings.step,
    pros: team
      ? settings.pros.map((p) => ({ id: p.id, name: p.name, ...(p.bio?.trim() ? { bio: p.bio.trim() } : {}), color: staffColor(staff.find((m) => m.email === p.email)) }))
      : [],
    // Para que el paciente pueda llamar o escribir, y la información de protección de datos (quién recibe sus datos).
    contact: { phone: clinic.phone, email: clinic.email, address: clinic.address, taxId: clinic.taxId, dpo: clinic.dpo },
  };
  return { page, windows, envelope };
}

let lastPublished = "";

/** Publica la página si ha cambiado algo desde la última vez. `force`: aunque no haya cambiado. */
export async function publishBooking(db: Db, cloud: Cloud | null, team: boolean, force = false): Promise<"off" | "same" | "published"> {
  const token = getToken();
  if (!token || !cloud?.clinic || !cloud.clinics) return "off";
  const settings = await getBookingSettings(db);
  if (!settings.enabled || !settings.slug) {
    if (force) await cloud.clinics.booking.publish(token, cloud.clinic.id, { enabled: false });
    lastPublished = "";
    return "off";
  }
  const keys = await bookingKeys(db);
  const body = { enabled: true, slug: settings.slug, publicKey: keys.publicJwk, ...(await bookingPage(db, settings, team)) };
  const text = JSON.stringify(body);
  if (!force && text === lastPublished) return "same";
  await cloud.clinics.booking.publish(token, cloud.clinic.id, body);
  lastPublished = text;
  return "published";
}

/** Un paciente que ya está (mismo móvil o mismo correo) o uno nuevo con lo que ha dejado en la reserva. */
async function patientFor(db: Db, p: BookingPayload): Promise<{ id: string; isNew: boolean }> {
  const digits = (s: string) => s.replace(/\D/g, "").slice(-9);
  const phone = digits(p.phone);
  const email = p.email.trim().toLowerCase();
  const all = await db.query<{ id: string; phone: string | null; email: string | null }>("select id, phone, email from patients");
  const found = all.find((x) => (phone.length >= 9 && digits(x.phone ?? "") === phone) || (email && (x.email ?? "").trim().toLowerCase() === email));
  if (found) return { id: found.id, isNew: false };
  const id = await createPatient(db, {
    name: p.name.trim().slice(0, 120) || "Paciente sin nombre",
    birthDate: null,
    sex: null,
    bodyMassKg: null,
    heightCm: null,
    legLengthCm: null,
    pushOffDistanceCm: null,
    notes: `Reservó por internet el ${new Date().toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}.${p.note.trim() ? ` Motivo que escribió: ${p.note.trim().slice(0, 500)}` : ""}`,
    phone: p.phone.trim().slice(0, 40),
    email: p.email.trim().slice(0, 120),
  });
  return { id, isNew: true };
}

export type Collected = { booked: { name: string; startsAt: string }[]; cancelled: { name: string; startsAt: string }[] };

/** Recoge las reservas y anulaciones nuevas y las pone en la agenda. */
export async function collectBookings(db: Db, cloud: Cloud | null): Promise<Collected | null> {
  const token = getToken();
  if (!token || !cloud?.clinic || !cloud.clinics) return null;
  const inbox = await cloud.clinics.booking.inbox(token, cloud.clinic.id);
  const out: Collected = { booked: [], cancelled: [] };
  if (!inbox.bookings.length && !inbox.cancels.length) return out;
  const settings = await getBookingSettings(db);
  const keys = await bookingKeys(db);
  const done = { bookings: [] as string[], cancels: [] as string[] };
  const cancel = async (id: string) => {
    const a = await getAppointment(db, id);
    if (a && a.status === "scheduled") {
      await updateAppointment(db, id, { status: "cancelled" });
      const name = (await db.query<{ name: string }>("select name from patients where id = ?", [a.patientId]))[0]?.name ?? "";
      out.cancelled.push({ name, startsAt: a.startsAt });
    }
  };
  for (const b of inbox.bookings) {
    try {
      if (!b.collected && !b.cancelledAt && b.payload) {
        const p = await openFromPatient<BookingPayload>(keys.privateJwk, b.payload);
        const patient = await patientFor(db, p);
        const pro = settings.pros.find((x) => x.id === b.pro)?.email ?? null;
        const made = await createOnlineAppointment(db, { id: b.id, patientId: patient.id, startsAt: b.startsAt, minutes: b.minutes, assignedTo: pro ?? (cloud.clinic && !settings.pros.length ? memberEmail() : null), cancelToken: p.cancelToken });
        if (made) out.booked.push({ name: p.name, startsAt: b.startsAt });
      } else if (b.cancelledAt) {
        await cancel(b.id);
      }
      done.bookings.push(b.id);
    } catch (e) {
      // No se puede abrir (otra clave): se deja en el servidor y se apunta el fallo.
      logError("reserva online", e);
    }
  }
  for (const c of inbox.cancels) {
    await cancel(c.ref);
    done.cancels.push(c.hash);
  }
  if (done.bookings.length || done.cancels.length) await cloud.clinics.booking.collected(token, cloud.clinic.id, done);
  return out;
}

/** La dirección del enlace para anular. */
export const cancelUrl = (base: string, token: string) => `${base}cita/${token}`;

/**
 * Con quién sale una cita en la reserva online (su id público), para que al anularla el hueco quede libre en la
 * página al momento. Sin la reserva encendida, o si ese fisio no sale en ella, null.
 */
const proFor = (settings: BookingSettings, team: boolean, assignedTo: string | null) =>
  !settings.enabled ? null : team ? (settings.pros.find((p) => p.email === assignedTo)?.id ?? null) : "";

/**
 * El código del enlace para anular una cita: el que ya tiene (y se pone al día su hora en el servidor) o uno nuevo.
 * Sin servidor, null (el mensaje sale sin enlace).
 */
export async function ensureCancelLink(db: Db, cloud: Cloud | null, a: Appointment, label: string, team: boolean): Promise<string | null> {
  const token = getToken();
  if (!token || !cloud?.clinic || !cloud.clinics) return null;
  const code = a.cancelToken ?? newCancelToken();
  const pro = proFor(await getBookingSettings(db), team, a.assignedTo);
  await cloud.clinics.booking.links(token, cloud.clinic.id, [{ hash: await tokenHash(code), ref: a.id, startsAt: a.startsAt, label, minutes: a.minutes, pro }]);
  if (!a.cancelToken) await setCancelToken(db, a.id, code);
  return code;
}

/** Lo último que se mandó al servidor de cada cita con enlace (en este dispositivo), para mandar solo lo que cambia. */
const linksKey = (clinic: string) => `cenit.enlaces.${clinic}`;

/**
 * Pone al día en el servidor los enlaces para anular de las citas que han cambiado desde la última vez: si la
 * clínica mueve una cita, el paciente ve la hora nueva en su enlace; si la anula, la ve anulada.
 */
export async function syncCancelLinks(db: Db, cloud: Cloud | null, team: boolean): Promise<number> {
  const token = getToken();
  if (!token || !cloud?.clinic || !cloud.clinics) return 0;
  const rows = await db.query<{ id: string; starts_at: string; minutes: number; status: string; assigned_to: string | null; cancel_token: string }>(
    "select id, starts_at, minutes, status, assigned_to, cancel_token from appointments where cancel_token is not null and starts_at > ?",
    [new Date(Date.now() - DAY).toISOString()],
  );
  if (!rows.length) return 0;
  const key = linksKey(cloud.clinic.id);
  let sent: Record<string, string> = {};
  try {
    sent = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, string>;
  } catch {
    /* sin almacenamiento: se manda todo */
  }
  const [settings, staff] = await Promise.all([getBookingSettings(db), team ? listStaff(db) : Promise.resolve([])]);
  const changed: { id: string; sig: string; link: Parameters<NonNullable<Cloud["clinics"]>["booking"]["links"]>[2][number] }[] = [];
  for (const r of rows) {
    const pro = proFor(settings, team, r.assigned_to);
    const label = team && r.assigned_to ? `con ${staff.find((m) => m.email === r.assigned_to)?.name ?? r.assigned_to.split("@")[0]}` : "";
    const cancelled = r.status === "cancelled";
    const sig = [r.starts_at, r.minutes, cancelled, pro, label].join("|");
    if (sent[r.id] === sig) continue;
    changed.push({ id: r.id, sig, link: { hash: await tokenHash(r.cancel_token), ref: r.id, startsAt: r.starts_at, label, minutes: r.minutes, pro, cancelled } });
  }
  if (!changed.length) return 0;
  const batch = changed.slice(0, 200);
  await cloud.clinics.booking.links(token, cloud.clinic.id, batch.map((c) => c.link));
  const keep = new Set(rows.map((r) => r.id));
  const next = Object.fromEntries(Object.entries(sent).filter(([id]) => keep.has(id)));
  for (const c of batch) next[c.id] = c.sig;
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* nada */
  }
  return batch.length;
}
