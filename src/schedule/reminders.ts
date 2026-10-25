// Recordatorios de cita sin servicios de pago: el mensaje se prepara aquí y se abre en WhatsApp (o en el correo) del
// propio dispositivo, listo para enviar con un toque. Nada sale de la app sin que la persona lo envíe. Los textos
// (y los de los demás mensajes) los cambia la clínica en Ajustes › Mensajes a pacientes (src/messages/templates.ts).
import { DEFAULT_TEMPLATE, dayText, fillTemplate, firstName, hourText, messageText, withWho, type MessageSettings, type MessageVars } from "../messages/templates";

export { DEFAULT_TEMPLATE, dayText, hourText } from "../messages/templates";

export type ReminderVars = { name: string; startsAt: string; clinic: string; professional?: string | null };

/** Las fichas de un recordatorio o de un hueco libre: nombre de pila, día, hora, clínica y «con quién». */
export function appointmentVars(v: ReminderVars): MessageVars {
  return { nombre: firstName(v.name), dia: dayText(v.startsAt), hora: hourText(v.startsAt), clinica: v.clinic, con: withWho(v.professional) };
}

/** Un texto de recordatorio concreto (sin firma): lo usa la vista previa; vacío, el de siempre. */
export function reminderText(template: string, v: ReminderVars): string {
  return fillTemplate(template.trim() || DEFAULT_TEMPLATE, appointmentVars(v));
}

/** El recordatorio de la clínica (su texto o el de siempre), con su firma. */
export function reminderMessage(s: MessageSettings | null | undefined, v: ReminderVars): string {
  return messageText("recordatorio", s, appointmentVars(v));
}

/** El mensaje para ofrecer un hueco que se ha quedado libre a quien está en la lista de espera. */
export function offerText(v: ReminderVars, s?: MessageSettings | null): string {
  return messageText("hueco", s, appointmentVars(v));
}

/**
 * El teléfono para WhatsApp: solo cifras y con el prefijo del país. Un móvil o fijo español de 9 cifras lleva el 34;
 * «+44…» o «0044…» se quedan con el suyo. null si no parece un teléfono.
 */
export function waPhone(phone: string): string | null {
  const raw = phone.trim();
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (/^[6789]\d{8}$/.test(digits)) digits = `34${digits}`;
  digits = digits.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export const whatsappUrl = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
export const mailtoUrl = (email: string, subject: string, body: string) =>
  `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
