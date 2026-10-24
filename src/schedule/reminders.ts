// Recordatorios de cita sin servicios de pago: el mensaje se prepara aquí y se abre en WhatsApp (o en el correo) del
// propio dispositivo, listo para enviar con un toque. Nada sale de la app sin que la persona lo envíe.

/** Ajuste sincronizado: el texto del recordatorio, el mismo para toda la clínica. */
export const REMINDER_TEMPLATE_KEY = "reminder_template";
export const DEFAULT_TEMPLATE =
  "Hola, {nombre}. Te recordamos tu cita de fisioterapia{con} en {clinica} el {dia} a las {hora}. Si no puedes venir, avísanos respondiendo a este mensaje. ¡Gracias!";

/** Las palabras que se sustituyen en el texto, para la ayuda de la pantalla. */
export const TEMPLATE_WORDS = ["{nombre}", "{dia}", "{hora}", "{clinica}", "{con}"];

export type ReminderVars = { name: string; startsAt: string; clinic: string; professional?: string | null };

/** El nombre de pila: «Ana» de «Ana Ruiz López». */
/** El nombre de pila: lo primero del nombre completo. */
export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? full;

/** «martes 21 de octubre» y «10:30», en la hora de Madrid. */
export function dayText(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
}
export function hourText(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}

export function reminderText(template: string, v: ReminderVars): string {
  return (template.trim() || DEFAULT_TEMPLATE)
    .replace(/\{nombre\}/g, firstName(v.name))
    .replace(/\{dia\}/g, dayText(v.startsAt))
    .replace(/\{hora\}/g, hourText(v.startsAt))
    .replace(/\{clinica\}/g, v.clinic.trim() || "la clínica")
    .replace(/\{con\}/g, v.professional ? ` con ${v.professional}` : "")
    .replace(/ en la clínica la clínica/g, " en la clínica");
}

/** El mensaje para ofrecer un hueco que se ha quedado libre a quien está en la lista de espera. */
export function offerText(v: ReminderVars): string {
  return `Hola, ${firstName(v.name)}. Se ha quedado libre un hueco de fisioterapia${v.professional ? ` con ${v.professional}` : ""} en ${v.clinic.trim() || "la clínica"} el ${dayText(v.startsAt)} a las ${hourText(v.startsAt)}. ¿Te viene bien? Responde a este mensaje y te lo guardamos.`;
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
