// Los ajustes de la reserva online (Ajustes › Reserva online): se guardan en la base de la clínica (cifrada y
// sincronizada), igual que su clave privada. Al servidor solo va lo que se enseña en la página pública.
import type { Db } from "../data/db";
import { getSetting, setSetting } from "../data/repo";
import { DEFAULT_HOURS, type WeeklyHours } from "./availability";
import { newBookingKeys, url64, type BookingKeys } from "./crypto";

export const BOOKING_SETTINGS_KEY = "booking_settings";
export const BOOKING_KEYS_KEY = "booking_keys";

/** Un tipo de cita: lo que dura y, si se quiere enseñar, su precio (en céntimos). */
export type BookingKind = { id: string; label: string; minutes: number; priceCents?: number | null };
/** Un fisio que sale en la reserva: su correo (solo en la app), un id público al azar y el nombre que se enseña. */
export type BookingPro = { email: string; id: string; name: string; bio?: string };

export type BookingSettings = {
  enabled: boolean;
  /** La dirección de la página: …/reservar/<slug>. */
  slug: string;
  intro: string;
  kinds: BookingKind[];
  /** Con cuántas horas de antelación como mínimo, y hasta cuántos días vista. */
  minNoticeHours: number;
  days: number;
  /** Cada cuántos minutos empiezan las citas (10:00, 10:15…). */
  step: number;
  /** El horario de la clínica (para quien no tiene turnos puestos). */
  hours: WeeklyHours;
  /** En una clínica con equipo, quién sale en la reserva. Sin equipo, vacío. */
  pros: BookingPro[];
};

export const DEFAULT_BOOKING: BookingSettings = {
  enabled: false,
  slug: "",
  intro: "",
  kinds: [
    { id: "primera", label: "Primera visita", minutes: 60 },
    { id: "seguimiento", label: "Seguimiento", minutes: 45 },
  ],
  minNoticeHours: 12,
  days: 30,
  step: 15,
  hours: DEFAULT_HOURS,
  pros: [],
};

/** «Fisiolab Centro» → «fisiolab-centro». */
export function slugify(name: string): string {
  const s = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return s.length >= 3 ? s : `${s}-clinica`.replace(/^-/, "");
}

export const isSlug = (s: string) => /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(s);

export async function getBookingSettings(db: Db): Promise<BookingSettings> {
  const s = await getSetting<Partial<BookingSettings>>(db, BOOKING_SETTINGS_KEY);
  return { ...DEFAULT_BOOKING, ...s };
}

export async function saveBookingSettings(db: Db, s: BookingSettings): Promise<void> {
  await setSetting(db, BOOKING_SETTINGS_KEY, s);
}

/** Las claves de la clínica para la reserva: se crean la primera vez y se guardan en su base. */
export async function bookingKeys(db: Db): Promise<BookingKeys> {
  const have = await getSetting<BookingKeys>(db, BOOKING_KEYS_KEY);
  if (have?.privateJwk && have.publicJwk) return have;
  const keys = await newBookingKeys();
  await setSetting(db, BOOKING_KEYS_KEY, keys);
  return keys;
}

/** Un id público al azar para un fisio (no su correo). */
export const newProId = () => url64(crypto.getRandomValues(new Uint8Array(6)));

/** Lo que manda el paciente, cifrado para la clínica. */
export type BookingPayload = { v: 1; name: string; phone: string; email: string; note: string; cancelToken: string; consentAt: string };

/** Lo que se publica y ve el paciente en …/reservar/<slug> (sin correos de los fisios ni pacientes). */
export type PublicBookingInfo = {
  clinic: string;
  intro: string;
  kinds: BookingKind[];
  minNoticeHours: number;
  step: number;
  /** Quién sale: id público, nombre, a qué se dedica (si se ha escrito) y su color en la agenda (para su inicial). */
  pros: { id: string; name: string; bio?: string; color?: string }[];
  contact?: { phone: string; email: string; address: string; taxId: string; dpo: string };
};
