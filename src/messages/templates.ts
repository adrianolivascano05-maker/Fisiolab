// Los mensajes que la app prepara para WhatsApp y correo (recordatorio, hueco libre, lista de espera, anamnesis,
// cuestionarios antes de revisar, formulario por enlace, petición de informes y pruebas y hoja de ejercicios). Cada clínica puede cambiar su texto y su asunto en
// Ajustes › Mensajes a pacientes, y poner una firma común al final de todos. Las fichas como {nombre} o {dia} se
// sustituyen al preparar cada mensaje. El ajuste va en la base de la clínica (cifrada y sincronizada). Nada se
// envía solo: el mensaje se abre en el WhatsApp o el correo del dispositivo y lo manda la persona.
import type { Db } from "../data/db";
import { getSetting, setSetting } from "../data/repo";

// «firma» (documento para firmar por enlace) se retiró el 30-10-2026; lo que una clínica guardó con ese nombre se
// ignora y desaparece al volver a guardar (saveMessages solo recorre MESSAGES).
export type MessageKind = "recordatorio" | "hueco" | "espera" | "anamnesis" | "seguimiento" | "formulario" | "archivos" | "ejercicios";

export type MessageSpec = {
  kind: MessageKind;
  label: string;
  /** Dónde lo usa la app. */
  where: string;
  text: string;
  subject: string;
  /** Las fichas que se pueden usar en este mensaje. */
  vars: string[];
};

/** El texto del recordatorio de siempre (también el ajuste antiguo `reminder_template`). */
export const DEFAULT_TEMPLATE =
  "Hola, {nombre}. Te recordamos tu cita de fisioterapia{con} en {clinica} el {dia} a las {hora}. Si no puedes venir, avísanos respondiendo a este mensaje. ¡Gracias!";

const PRIVATE = "Tus respuestas van cifradas y solo las verá tu fisioterapeuta.";

export const MESSAGES: MessageSpec[] = [
  { kind: "recordatorio", label: "Recordatorio de cita", where: "Agenda › Recordatorios, la hoja de la cita y la bandeja de envíos", text: DEFAULT_TEMPLATE, subject: "Recordatorio de tu cita", vars: ["{nombre}", "{dia}", "{hora}", "{clinica}", "{con}"] },
  {
    kind: "hueco",
    label: "Hueco libre",
    where: "Lista de espera, al anularse una cita",
    text: "Hola, {nombre}. Se ha quedado libre un hueco de fisioterapia{con} en {clinica} el {dia} a las {hora}. ¿Te viene bien? Responde a este mensaje y te lo guardamos.",
    subject: "Hueco libre para tu fisioterapia",
    vars: ["{nombre}", "{dia}", "{hora}", "{clinica}", "{con}"],
  },
  {
    kind: "espera",
    label: "Lista de espera",
    where: "Agenda › Lista de espera, al escribir a alguien de la lista sin un hueco concreto (para contarle el que tengas)",
    text: "Hola, {nombre}. Te escribimos de {clinica} porque estás en nuestra lista de espera de fisioterapia.",
    subject: "Tu lista de espera en {clinica}",
    vars: ["{nombre}", "{clinica}"],
  },
  {
    kind: "anamnesis",
    label: "Anamnesis antes de la primera cita",
    where: "Bandeja de envíos, a los pacientes nuevos",
    text: `Hola, {nombre}. Tu primera cita de fisioterapia en {clinica} es el {dia} a las {hora}.\nPara aprovecharla al máximo, rellena antes unas preguntas sobre tu salud:\n{enlace}\n${PRIVATE}`,
    subject: "Antes de tu primera cita",
    vars: ["{nombre}", "{dia}", "{hora}", "{clinica}", "{enlace}"],
  },
  {
    kind: "seguimiento",
    label: "Cuestionarios antes de reevaluar",
    where: "Bandeja de envíos, antes de una reevaluación",
    text: `Hola, {nombre}. El {dia} toca revisar cómo vas en {clinica}.\nAntes, rellena {cuestionarios}:\n{enlaces}\n${PRIVATE}`,
    subject: "Antes de tu revisión",
    vars: ["{nombre}", "{dia}", "{clinica}", "{cuestionarios}", "{enlaces}"],
  },
  {
    kind: "formulario",
    label: "Formulario por enlace",
    where: "Ficha › Formularios › Enviar",
    text: `Hola {nombre}: desde {clinica} te pedimos que rellenes {formulario} antes de tu próxima visita. Es aquí:\n{enlace}\n${PRIVATE} El enlace vale hasta el {caduca}.`,
    subject: "Un formulario de {clinica}",
    vars: ["{nombre}", "{clinica}", "{formulario}", "{enlace}", "{caduca}"],
  },
  {
    kind: "archivos",
    label: "Pedir sus informes y pruebas",
    where: "Ficha › Archivos del paciente › Pedírselos al paciente",
    text: "Hola {nombre}: desde {clinica} te pedimos que nos envíes tus informes o pruebas (en PDF o en foto) antes de tu próxima visita. Súbelos aquí:\n{enlace}\nVan cifrados y solo los verá tu fisioterapeuta. El enlace vale hasta el {caduca}.",
    subject: "Tus informes para {clinica}",
    vars: ["{nombre}", "{clinica}", "{enlace}", "{caduca}"],
  },
  {
    kind: "ejercicios",
    label: "Hoja de ejercicios",
    where: "La hoja de ejercicios del paciente (debajo va la lista de ejercicios, que no se edita)",
    text: "Hola, {nombre}. Tus ejercicios para casa de {clinica}:",
    subject: "Tus ejercicios para casa",
    vars: ["{nombre}", "{clinica}"],
  },
];

export const specOf = (kind: MessageKind): MessageSpec => MESSAGES.find((m) => m.kind === kind)!;

/**
 * El primer mensaje a un paciente nuevo que aún no ha firmado el permiso de contacto (la excepción de mayMessage,
 * src/data/privacy.ts): el enlace de su anamnesis, sin datos de salud, sin la palabra «fisioterapia» y sin la firma
 * común (podría llevarla). No se puede cambiar en Ajustes: va a quien aún no ha dicho que se le pueda escribir.
 */
export const FIRST_MESSAGE = {
  label: "Primer mensaje a un paciente nuevo",
  where: "La anamnesis antes de la primera cita, a quien aún no ha firmado el permiso de contacto",
  withDate: "Hola, {nombre}. Te escribimos de {clinica} por la cita que has pedido para el {dia} a las {hora}. Antes de venir, si quieres, puedes rellenar este formulario: {enlace} Caduca el {caduca}. Si no has pedido cita, ignora este mensaje.",
  noDate: "Hola, {nombre}. Te escribimos de {clinica} por la cita que has pedido. Antes de venir, si quieres, puedes rellenar este formulario: {enlace} Caduca el {caduca}. Si no has pedido cita, ignora este mensaje.",
  subject: "Tu cita en {clinica}",
};

/** El primer mensaje, relleno: con la cita si la hay. */
export function firstMessageText(p: { name: string; clinic: string; url: string; expiresAt: string; startsAt?: string | null }): string {
  const caduca = new Date(p.expiresAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" });
  const vars: MessageVars = { nombre: firstName(p.name), clinica: p.clinic, enlace: p.url, caduca };
  return p.startsAt ? fillTemplate(FIRST_MESSAGE.withDate, { ...vars, dia: dayText(p.startsAt), hora: hourText(p.startsAt) }) : fillTemplate(FIRST_MESSAGE.noDate, vars);
}
export const firstMessageSubject = (clinic: string) => fillTemplate(FIRST_MESSAGE.subject, { clinica: clinic });

/** Lo que guarda la clínica: por mensaje, el texto o el asunto que haya cambiado, y la firma común. */
export type MessageTexts = Partial<Record<MessageKind, { text?: string; subject?: string }>>;
export type MessageSettings = { texts: MessageTexts; signature: string };
export const MESSAGES_KEY = "message_templates";
/** El ajuste anterior, solo del recordatorio: se sigue leyendo (y escribiendo) para no perder lo que ya estaba. */
export const REMINDER_TEMPLATE_KEY = "reminder_template";

/** Junta lo guardado con el ajuste antiguo del recordatorio, si lo había y no hay texto nuevo. */
export function mergeLegacy(raw: Partial<MessageSettings> | null, legacyReminder: string | null): MessageSettings {
  const texts: MessageTexts = { ...raw?.texts };
  if (!texts.recordatorio?.text?.trim() && legacyReminder?.trim() && legacyReminder.trim() !== DEFAULT_TEMPLATE) {
    texts.recordatorio = { ...texts.recordatorio, text: legacyReminder.trim() };
  }
  return { texts, signature: (raw?.signature ?? "").trim() };
}

export async function loadMessages(db: Db): Promise<MessageSettings> {
  const [raw, legacy] = await Promise.all([getSetting<Partial<MessageSettings>>(db, MESSAGES_KEY), getSetting<string>(db, REMINDER_TEMPLATE_KEY)]);
  return mergeLegacy(raw, legacy);
}

/** Guarda solo lo que cambia respecto al texto de OmniClin; el recordatorio también en el ajuste antiguo. */
export async function saveMessages(db: Db, s: MessageSettings): Promise<void> {
  const texts: MessageTexts = {};
  for (const m of MESSAGES) {
    const t = s.texts[m.kind];
    const text = t?.text?.trim();
    const subject = t?.subject?.trim();
    const entry: { text?: string; subject?: string } = {};
    if (text && text !== m.text) entry.text = text;
    if (subject && subject !== m.subject) entry.subject = subject;
    if (entry.text || entry.subject) texts[m.kind] = entry;
  }
  await setSetting(db, MESSAGES_KEY, { texts, signature: s.signature.trim() });
  await setSetting(db, REMINDER_TEMPLATE_KEY, texts.recordatorio?.text ?? DEFAULT_TEMPLATE);
}

// ---------- Rellenar ----------

/** El nombre de pila: lo primero del nombre completo. */
export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? full;

/** «martes, 21 de octubre» y «10:30», en la hora de Madrid. */
export function dayText(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
}
export function hourText(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}

/** Las fichas de un mensaje, ya con su valor (sin las llaves). */
export type MessageVars = Partial<Record<"nombre" | "dia" | "hora" | "clinica" | "con" | "enlace" | "enlaces" | "cuestionarios" | "formulario" | "caduca", string>>;

/** Las fichas también valen con tilde ({día}, {clínica}) por si alguien las escribe así. */
const ALIASES: Record<string, keyof MessageVars> = { día: "dia", clínica: "clinica" };

/** Sustituye las fichas de `text`. {clinica} vacía sale como «la clínica»; {con} es « con Laura» o nada. */
export function fillTemplate(text: string, vars: MessageVars): string {
  const v: MessageVars = { ...vars, clinica: vars.clinica?.trim() || "la clínica", con: vars.con ?? "" };
  return text
    .replace(/\{([a-záéíóú]+)\}/gi, (whole, raw: string) => {
      const key = (ALIASES[raw.toLowerCase()] ?? raw.toLowerCase()) as keyof MessageVars;
      return key in v ? (v[key] ?? "") : whole;
    })
    .replace(/ en la clínica la clínica/g, " en la clínica");
}

/** El texto de un mensaje: el de la clínica o el de OmniClin, con las fichas puestas y la firma al final (si la hay). */
export function messageText(kind: MessageKind, s: MessageSettings | null | undefined, vars: MessageVars, opts: { signature?: boolean } = {}): string {
  const spec = specOf(kind);
  const text = fillTemplate(s?.texts[kind]?.text?.trim() || spec.text, vars);
  return opts.signature === false ? text : withSignature(text, s);
}

export function withSignature(text: string, s: MessageSettings | null | undefined): string {
  const sig = s?.signature?.trim();
  return sig ? `${text}\n\n${sig}` : text;
}

/** El asunto del correo de un mensaje. */
export function messageSubject(kind: MessageKind, s: MessageSettings | null | undefined, vars: MessageVars): string {
  return fillTemplate(s?.texts[kind]?.subject?.trim() || specOf(kind).subject, vars);
}

/** « con Laura» para {con}, o nada. */
export const withWho = (professional?: string | null) => (professional ? ` con ${professional}` : "");
