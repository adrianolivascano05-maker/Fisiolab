// Bandeja de envíos: lo que toca mandar hoy a los pacientes, calculado con unas reglas fijas, para enviarlo por
// WhatsApp (o por correo) desde este dispositivo, uno tras otro. Nada sale solo: cada mensaje lo envía la persona
// con un toque (src/schedule/OutboxPage.tsx). Sin servicios de pago.
//
// Las reglas:
// - Confirmación: las citas que un paciente ha reservado por internet (src/booking), con su enlace para anular. Si
//   además le toca ya la anamnesis, va en el mismo mensaje.
// - Recordatorio: las citas de mañana (y las de hoy que aún no han llegado) que no se han recordado.
// - Anamnesis: antes de la primera cita de un paciente nuevo, su parte de la anamnesis por enlace, 48 horas antes
//   (o en cuanto se da la cita, si queda menos). Hace falta el servidor de la clínica.
// - Seguimiento: antes de una reevaluación, los cuestionarios que rellenó al empezar, para ver cómo va. Hace falta el
//   servidor de la clínica.
import { madridDay } from "../app/format";
import { ANAMNESIS_KIND, SENDABLE } from "../clinical/patientForms";
import type { ReminderItem } from "../data/appointments";
import type { OutboxMark } from "../data/outbox";
import { dayText, hourText } from "./reminders";

export type OutboxRule = "confirmacion" | "recordatorio" | "anamnesis" | "seguimiento";

export const RULE_LABELS: Record<OutboxRule, { title: string; when: string }> = {
  confirmacion: { title: "Confirmaciones de reservas por internet", when: "en cuanto se reserva" },
  recordatorio: { title: "Recordatorios de cita", when: "el día antes" },
  anamnesis: { title: "Anamnesis antes de la primera cita", when: "48 horas antes" },
  seguimiento: { title: "Cuestionarios antes de reevaluar", when: "antes de la reevaluación" },
};

/** Ajuste sincronizado: qué reglas están encendidas y con cuánta antelación. */
export const OUTBOX_SETTINGS_KEY = "outbox_settings";
export type OutboxSettings = { reminders: boolean; anamnesis: boolean; anamnesisHours: number; followUp: boolean; followUpDays: number };
export const DEFAULT_OUTBOX: OutboxSettings = { reminders: true, anamnesis: true, anamnesisHours: 48, followUp: true, followUpDays: 2 };
export const outboxSettings = (s: Partial<OutboxSettings> | null | undefined): OutboxSettings => ({ ...DEFAULT_OUTBOX, ...(s ?? {}) });

/** Un paciente, con lo que hace falta para escribirle. */
export type Contact = { patientId: string; name: string; phone: string; email: string; contact: boolean | null };

export type OutboxItem = Contact & {
  /** La regla y a qué va: «recordatorio:<cita>», «anamnesis:<cita>», «seguimiento:<paciente>:<día>». */
  id: string;
  rule: OutboxRule;
  /** La cita a la que se refiere (recordatorio y anamnesis). */
  appointment?: ReminderItem;
  /** El día de la reevaluación (seguimiento). */
  reviewOn?: string;
  /** Los cuestionarios que se mandan (seguimiento). */
  kinds?: string[];
  /** Hace falta crear enlaces en el servidor de la clínica antes de mandarlo. */
  needsForms: boolean;
  /** Confirmación de una reserva que además lleva su anamnesis (le toca ya). */
  withAnamnesis?: boolean;
};

/** Lo que hace falta saber para calcular la bandeja (lo reúne loadOutbox en OutboxPage). */
export type OutboxInput = {
  now: string;
  settings: OutboxSettings;
  /** Citas pendientes desde ahora (las reservadas por internet, hasta dos meses vista), con el contacto del paciente. */
  upcoming: ReminderItem[];
  /** Pacientes que ya han venido antes (una sesión o una cita anterior no anulada): no es su primera cita. */
  seenBefore: Set<string>;
  /** Pacientes que ya tienen anamnesis. */
  withAnamnesis: Set<string>;
  /** Formularios ya mandados (no anulados) por paciente: su tipo y cuándo. */
  formsSent: { patientId: string; kind: string; sentAt: string }[];
  /** Reevaluaciones de los próximos días (la última fecha puesta a cada paciente), con su contacto. */
  reviews: (Contact & { reviewOn: string })[];
  /** Los cuestionarios rellenados por paciente: tipo y fecha. */
  questionnaires: { patientId: string; kind: string; performedAt: string }[];
  /** Cuestionarios que la clínica puede mandar (los de licencia libre y los que tiene permiso). */
  sendable: Set<string>;
  marks: OutboxMark[];
};

const DAY = 86_400_000;
const addDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Lo que toca mandar ahora, por orden: recordatorios, anamnesis y seguimientos; dentro, por hora. */
export function buildOutbox(input: OutboxInput): OutboxItem[] {
  const { now, settings } = input;
  const t = Date.parse(now);
  const today = madridDay(now);
  const done = new Set(input.marks.map((m) => m.id));
  const out: OutboxItem[] = [];
  const contactOf = (a: ReminderItem): Contact => ({ patientId: a.patientId, name: a.name, phone: a.phone, email: a.email, contact: a.contact });

  // Las reservas por internet: confirmarlas (con su enlace para anular) en cuanto llegan.
  for (const a of input.upcoming) {
    const id = `confirmacion:${a.id}`;
    if (a.source !== "online" || Date.parse(a.startsAt) <= t || done.has(id) || a.contact === false) continue;
    out.push({ ...contactOf(a), id, rule: "confirmacion", appointment: a, needsForms: false });
  }

  if (settings.reminders) {
    const tomorrow = addDay(today, 1);
    for (const a of input.upcoming) {
      const day = madridDay(a.startsAt);
      const id = `recordatorio:${a.id}`;
      // Mañana, o hoy si aún faltan más de dos horas (si ayer no se recordó).
      const inWindow = day === tomorrow || (day === today && Date.parse(a.startsAt) - t > 2 * 3_600_000);
      if (!inWindow || a.remindedAt || a.confirmedAt || done.has(id) || a.contact === false) continue;
      out.push({ ...contactOf(a), id, rule: "recordatorio", appointment: a, needsForms: false });
    }
  }

  if (settings.anamnesis) {
    const horizon = t + settings.anamnesisHours * 3_600_000;
    const recentAnamnesis = new Set(input.formsSent.filter((f) => f.kind === ANAMNESIS_KIND && t - Date.parse(f.sentAt) < 60 * DAY).map((f) => f.patientId));
    const firstOf = new Map<string, ReminderItem>();
    for (const a of [...input.upcoming].sort((x, y) => x.startsAt.localeCompare(y.startsAt))) if (!firstOf.has(a.patientId)) firstOf.set(a.patientId, a);
    for (const a of firstOf.values()) {
      const id = `anamnesis:${a.id}`;
      const start = Date.parse(a.startsAt);
      if (start <= t || start > horizon || done.has(id) || a.contact === false) continue;
      if (input.seenBefore.has(a.patientId) || input.withAnamnesis.has(a.patientId) || recentAnamnesis.has(a.patientId)) continue;
      // Si su confirmación aún no ha salido, la anamnesis va en el mismo mensaje.
      const confirmation = out.find((i) => i.rule === "confirmacion" && i.appointment?.id === a.id);
      if (confirmation) Object.assign(confirmation, { withAnamnesis: true, needsForms: true });
      else out.push({ ...contactOf(a), id, rule: "anamnesis", appointment: a, needsForms: true });
    }
  }

  if (settings.followUp) {
    const last = addDay(today, settings.followUpDays);
    for (const r of input.reviews) {
      if (r.reviewOn < today || r.reviewOn > last || r.contact === false) continue;
      const id = `seguimiento:${r.patientId}:${r.reviewOn}`;
      if (done.has(id)) continue;
      // Los cuestionarios que rellenó hace al menos dos semanas y no ha vuelto a rellenar, ni se le han mandado.
      const latest = new Map<string, string>();
      for (const q of input.questionnaires) if (q.patientId === r.patientId && (latest.get(q.kind) ?? "") < q.performedAt) latest.set(q.kind, q.performedAt);
      const sentRecently = new Set(input.formsSent.filter((f) => f.patientId === r.patientId && t - Date.parse(f.sentAt) < 14 * DAY).map((f) => f.kind));
      const kinds = [...latest]
        .filter(([kind, at]) => input.sendable.has(kind) && t - Date.parse(at) >= 14 * DAY && !sentRecently.has(kind))
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([kind]) => kind)
        .slice(0, 3);
      if (!kinds.length) continue;
      out.push({ patientId: r.patientId, name: r.name, phone: r.phone, email: r.email, contact: r.contact, id, rule: "seguimiento", reviewOn: r.reviewOn, kinds, needsForms: true });
    }
  }

  const order: Record<OutboxRule, number> = { confirmacion: 0, recordatorio: 1, anamnesis: 2, seguimiento: 3 };
  const when = (i: OutboxItem) => i.appointment?.startsAt ?? `${i.reviewOn}T09:00:00`;
  return out.sort((a, b) => order[a.rule] - order[b.rule] || when(a).localeCompare(when(b)) || a.name.localeCompare(b.name, "es"));
}

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? full;

/** El mensaje con el enlace de su anamnesis, antes de la primera cita. */
export function anamnesisText(p: { name: string; clinic: string; startsAt: string; url: string }): string {
  return [
    `Hola, ${firstName(p.name)}. Tu primera cita de fisioterapia en ${p.clinic.trim() || "la clínica"} es el ${dayText(p.startsAt)} a las ${hourText(p.startsAt)}.`,
    "Para aprovecharla al máximo, rellena antes unas preguntas sobre tu salud:",
    p.url,
    "Tus respuestas van cifradas y solo las verá tu fisioterapeuta.",
  ].join("\n");
}

/** La línea del enlace para anular, al final de la confirmación y del recordatorio. */
export const cancelLine = (url: string) => `Si no puedes venir, anúlala aquí: ${url}`;

/** Confirmación de una cita reservada por internet, con su enlace para anular (y su anamnesis, si ya le toca). */
export function confirmationText(p: { name: string; clinic: string; startsAt: string; professional?: string | null; cancelUrl: string; anamnesisUrl?: string }): string {
  return [
    `Hola, ${firstName(p.name)}. Tu cita de fisioterapia${p.professional ? ` con ${p.professional}` : ""} en ${p.clinic.trim() || "la clínica"} queda reservada para el ${dayText(p.startsAt)} a las ${hourText(p.startsAt)}.`,
    ...(p.anamnesisUrl ? ["Antes de venir, rellena unas preguntas sobre tu salud:", p.anamnesisUrl] : []),
    cancelLine(p.cancelUrl),
  ].join("\n");
}

/** El mensaje con los cuestionarios antes de reevaluar. */
export function followUpText(p: { name: string; clinic: string; reviewOn: string; links: { title: string; url: string }[] }): string {
  const day = new Date(`${p.reviewOn}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
  return [
    `Hola, ${firstName(p.name)}. El ${day} toca revisar cómo vas en ${p.clinic.trim() || "la clínica"}.`,
    p.links.length === 1 ? "Antes, rellena este cuestionario:" : "Antes, rellena estos cuestionarios:",
    ...p.links.map((l) => `${l.title}: ${l.url}`),
    "Tus respuestas van cifradas y solo las verá tu fisioterapeuta.",
  ].join("\n");
}

/** Lo que se cuenta de cada envío en la lista: a quién, de qué y cuándo. */
export function itemWhen(i: OutboxItem): string {
  if (i.appointment) return `${i.rule === "anamnesis" ? "Primera cita" : "Cita"}: ${dayText(i.appointment.startsAt)}, ${hourText(i.appointment.startsAt)}`;
  if (i.reviewOn) return `Reevaluación: ${new Date(`${i.reviewOn}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" })}`;
  return "";
}

/** Los cuestionarios que se pueden mandar por enlace (sin los que necesitan un permiso que la clínica no ha marcado). */
export const sendableKinds = (granted: readonly string[]) => new Set(SENDABLE.filter((k) => k.license !== "comprobar" || granted.includes(k.id)).map((k) => k.id));
