// «Tus próximas citas»: la lista que se le manda al paciente por WhatsApp o correo desde su calendario (Ficha ›
// Calendario). Solo sus citas pendientes de ahora en adelante, como mucho diez; nada de su salud.
import type { Appointment } from "../data/appointments";
import { dayText, hourText } from "../messages/templates";

/** Cuántas se mandan como mucho (las siguientes). */
export const UPCOMING_MAX = 10;

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
