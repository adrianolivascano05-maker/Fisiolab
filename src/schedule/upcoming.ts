// «Tus próximas citas»: la lista que se le manda al paciente por WhatsApp o correo desde su calendario (Ficha ›
// Calendario). Solo sus citas pendientes de ahora en adelante, como mucho diez; nada de su salud.
import { dayOf } from "../app/dates";
import type { Appointment } from "../data/appointments";
import { dayText, hourText } from "../messages/templates";

/** Cuántas se mandan como mucho (las siguientes). */
export const UPCOMING_MAX = 10;
/** Cuántas salen como mucho en la hoja en papel (src/clinical/UpcomingSheetPage.tsx). */
export const SHEET_MAX = 30;

/** Sus citas pendientes que aún no han empezado, por orden. */
export const upcomingOf = (appointments: Appointment[], now = new Date()) =>
  appointments.filter((a) => a.status === "scheduled" && Date.parse(a.startsAt) > now.getTime()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

/** Una línea por cita: «· martes, 17 de noviembre a las 10:00 (con Laura)». */
export function upcomingLines(appointments: Appointment[], who: (email: string | null) => string | null = () => null, now = new Date()): string[] {
  return upcomingOf(appointments, now)
    .slice(0, UPCOMING_MAX)
    .map((a) => {
      const person = who(a.assignedTo);
      return `· ${dayText(a.startsAt)} a las ${hourText(a.startsAt)}${person ? ` (con ${person})` : ""}`;
    });
}

/**
 * Las filas de la hoja en papel: el día («martes, 17 de noviembre»; con el año si no es el de ahora), la hora y con
 * quién; y cuántas pendientes más quedan después de las que caben.
 */
export function sheetRows(appointments: Appointment[], who: (email: string | null) => string | null = () => null, now = new Date()) {
  const all = upcomingOf(appointments, now);
  const thisYear = dayOf(now.toISOString()).slice(0, 4);
  const rows = all.slice(0, SHEET_MAX).map((a) => {
    const year = dayOf(a.startsAt).slice(0, 4);
    return { id: a.id, day: `${dayText(a.startsAt)}${year === thisYear ? "" : ` de ${year}`}`, hour: hourText(a.startsAt), who: who(a.assignedTo) };
  });
  return { rows, more: all.length - rows.length };
}
