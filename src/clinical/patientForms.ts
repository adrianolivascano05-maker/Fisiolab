// Formularios para que el paciente los rellene desde su móvil: su parte de la anamnesis o un cuestionario entero. La
// clínica crea un enlace (con una clave al azar después de «#», que el navegador no manda al servidor), el paciente
// lo abre sin cuenta (src/patientForm/PublicFormPage.tsx) y sus respuestas vuelven cifradas con la misma clave. Al
// recogerlas (src/patientForm/FormInbox.tsx), se rellena lo que estaba vacío en la anamnesis o se guarda el
// cuestionario con su nota. El servidor (cloudflare/worker.js) solo ve bytes ilegibles.
import type { AnswerValue, Answers } from "../data/clinical";
import type { FormBrand } from "../brand/form";
import type { Db } from "../data/db";
import type { PrivacySection } from "../data/privacy";
import { messageText, type MessageSettings } from "../messages/templates";
import { cachedCloudConfig } from "../cloud/config";
import { ALL_FIELDS, type Field, type Section } from "./anamnesis";
import { formResult } from "./FormFill";
import { formFor, type Answers as FormAnswers } from "./forms";
import { ACTIVE, getKind } from "./questionnaires";

export const ANAMNESIS_KIND = "anamnesis";
/** Pedirle sus informes y pruebas (archivos en PDF o fotos, src/documents): los sube con el enlace. */
export const DOCS_KIND = "documentos";
/** Archivos que puede subir con un enlace. */
export const DOCS_PER_LINK = 5;
/**
 * Firmar por enlace se retiró el 30-10-2026: la hoja de protección de datos («proteccion-datos») y los consentimientos
 * («consentimiento:<plantilla>») se firman en la clínica. Estos tipos quedan solo para leer lo firmado antes de esa
 * fecha (los envíos recogidos siguen en la ficha): ya no se crean, y si llega una respuesta se descarta (collect.ts).
 */
export const PRIVACY_KIND = "proteccion-datos";
export const CONSENT_PREFIX = "consentimiento:";
export const isConsentKind = (kind: string) => kind.startsWith(CONSENT_PREFIX);
export const isSignKind = (kind: string) => kind === PRIVACY_KIND || isConsentKind(kind);

/** Días que vale un enlace. */
export const FORM_DAYS = 14;

/** Lo que va cifrado en el enlace: qué preguntar y a quién. */
export type FormRequest = {
  v: 1;
  /** Nombre de la clínica, para que el paciente sepa quién se lo pide. */
  clinic: string;
  /** El nombre de pila del paciente, para saludarle. */
  name: string;
  /** «anamnesis» o el id del cuestionario. */
  kind: string;
  /** La anamnesis: sus apartados con las preguntas para el paciente. */
  sections?: Section[];
  expiresAt: string;
  /** La marca de la clínica para la página del paciente (src/brand/form.ts); sin ella, la de OmniClin. */
  brand?: FormBrand;
  /** Si se le piden archivos, cuántos puede subir. */
  maxDocs?: number;
  /**
   * El responsable del tratamiento y el correo para ejercer los derechos (Ajustes › Clínica y protección de datos),
   * para el texto informativo del principio. Los formularios mandados antes no lo llevan.
   */
  controller?: { name: string; email: string };
  /**
   * Anamnesis inicial a un paciente nuevo que aún no ha firmado la hoja de protección de datos: la información en una
   * capa, la casilla obligatoria de «He leído» y la opcional de contacto (src/privacy/intakeText.ts). La respuesta
   * lleva `answers.__intake = { ack, contact }`.
   */
  intake?: { version: string; notice: PrivacySection[]; ackText: string; contactText: string };
};
/**
 * Lo que vuelve cifrado: las respuestas por id de campo (anamnesis) o de ítem (cuestionario); si se le pidieron archivos,
 * `answers.docs` con lo que ha subido (cada uno en su número, n, del enlace).
 */
export type FormResponse = { v: 1; answers: Record<string, unknown> };
export type SentDoc = { n: number; name: string; size: number };

// ---------- Qué se le pregunta ----------

/** Los apartados de la anamnesis que rellena el paciente, con un título suyo. */
const PATIENT_SECTIONS: Record<string, string> = {
  datos: "Datos personales",
  motivo: "Motivo de consulta",
  antecedentes: "Antecedentes médicos personales",
  familiares: "Antecedentes médicos familiares",
  tratamientos: "Tratamientos previos y expectativas",
  habitos: "Hábitos y estilo de vida",
};

/**
 * Las preguntas de la ficha que puede contestar el paciente, dichas para él. Lo demás (zona y lado para los tests,
 * banderas rojas, precauciones, exploración, diagnóstico y plan) es del fisioterapeuta.
 */
const PATIENT_FIELDS: Record<string, { label: string; hint?: string }> = {
  profesion: { label: "¿A qué te dedicas?" },
  motivo: { label: "¿Por qué vienes? Cuéntanos qué te pasa", hint: "Con tus palabras." },
  fecha_inicio: { label: "¿Desde cuándo te pasa?", hint: "Una fecha o, por ejemplo, «hace 3 semanas»." },
  forma_inicio: { label: "¿Cómo empezó?", hint: "De golpe (con un gesto, un golpe…) o poco a poco." },
  localizacion: { label: "¿Dónde te duele o lo notas?" },
  tipo_dolor: { label: "¿Cómo es lo que notas?", hint: "Por ejemplo: pinchazo, quemazón, dolor sordo, hormigueo, como una corriente…" },
  eva: { label: "¿Cuánto te duele ahora?", hint: "0 es nada y 10, el peor dolor que te puedas imaginar." },
  agravantes: { label: "¿Qué lo empeora?" },
  atenuantes: { label: "¿Qué lo alivia?" },
  irradiacion: { label: "¿Se va hacia otra zona?", hint: "Por ejemplo, del cuello al brazo o de la espalda a la pierna." },
  evolucion: { label: "¿Cómo ha ido desde que empezó?", hint: "Mejor, peor, igual, a temporadas…" },
  sintomas_paciente: { label: "¿Has notado alguna de estas cosas?", hint: "Marca las que te pasen. Si no te pasa ninguna, déjalo en blanco." },
  enfermedades: { label: "¿Tienes o has tenido alguna enfermedad importante?" },
  cirugias: { label: "¿Te han operado de algo?" },
  traumatismos: { label: "¿Has tenido golpes fuertes, fracturas o esguinces?" },
  fisio_previa: { label: "¿Has ido antes a fisioterapia? ¿Por qué y cómo te fue?" },
  otros_tratamientos: { label: "¿Qué otros tratamientos has probado para esto?", hint: "Medicación, infiltraciones, cirugía, osteopatía…" },
  respuesta_tratamientos: { label: "¿Te ayudaron? ¿Alguno te empeoró?" },
  creencias: { label: "¿Qué crees que te pasa y por qué?" },
  expectativas: { label: "¿Qué esperas de la fisioterapia?", hint: "Y en cuánto tiempo te gustaría notarlo." },
  objetivo_paciente: { label: "¿Qué te gustaría volver a hacer?", hint: "Por ejemplo: correr, dormir sin dolor, coger en brazos a tu hijo…" },
  medicacion: { label: "¿Qué medicación tomas?" },
  alergias: { label: "¿Tienes alguna alergia?" },
  pruebas: { label: "¿Te han hecho pruebas (radiografía, resonancia, ecografía…)? ¿Qué decían?" },
  familiares: { label: "¿Tus padres o hermanos tienen o han tenido alguna enfermedad importante?", hint: "Por ejemplo: reumáticas, del corazón, cáncer, neurológicas…" },
  actividad: { label: "¿Haces deporte o actividad física? ¿Cuál?" },
  frecuencia: { label: "¿Cada cuánto?", hint: "Por ejemplo, 3 veces por semana." },
  ocupacion: { label: "En tu trabajo, ¿cómo pasas el día?", hint: "Por ejemplo: con el ordenador, de pie, cargando peso…" },
  toxicos: { label: "¿Fumas o bebes alcohol? ¿Cuánto?" },
  sueno: { label: "¿Qué tal duermes?" },
  estres: { label: "¿Cuánto estrés tienes últimamente?" },
  avd: { label: "¿Qué cosas del día a día te cuestan por esto?" },
};
const BASE_IDS = new Set(ALL_FIELDS.map((f) => f.id));

/** Los apartados de la ficha de la clínica (con sus campos propios) que contesta el paciente, con sus preguntas. */
export function patientSections(sections: Section[]): Section[] {
  return sections
    .filter((s) => s.id in PATIENT_SECTIONS)
    .map((s) => ({
      id: s.id,
      title: PATIENT_SECTIONS[s.id]!,
      fields: s.fields.flatMap((f): Field[] => {
        const own = PATIENT_FIELDS[f.id];
        if (own) return [{ ...f, label: own.label, hint: own.hint }];
        // Las preguntas propias de la clínica (Ajustes → Anamnesis de la clínica) van tal cual.
        return BASE_IDS.has(f.id) ? [] : [f];
      }),
    }))
    .filter((s) => s.fields.length);
}

/** Los cuestionarios que se pueden mandar: los que tienen todas sus preguntas en la app y las contesta el paciente. */
export const SENDABLE = ACTIVE.filter((k) => {
  const f = formFor(k.id);
  // Los que tienen una parte de exploración (DN4) los rellena el fisioterapeuta en la consulta.
  return !!f && !f.sections.some((s) => s.clinician);
});

/** «tu historia clínica» o «el cuestionario «X»», para el mensaje y la ficha. */
export function formWhat(kind: string): string {
  if (kind === DOCS_KIND) return "tus informes o pruebas";
  if (kind === PRIVACY_KIND) return "la hoja de protección de datos";
  if (isConsentKind(kind)) return "el consentimiento informado";
  return kind === ANAMNESIS_KIND ? "unas preguntas sobre tu salud para tu historia clínica" : `el cuestionario «${getKind(kind)?.name ?? kind}»`;
}
/** Nombre corto para las listas de la clínica. */
export const formTitle = (kind: string) =>
  kind === DOCS_KIND
    ? "Sus informes y pruebas"
    : kind === ANAMNESIS_KIND
      ? "Anamnesis (su parte)"
      : kind === PRIVACY_KIND
        ? "Hoja de protección de datos (para firmar)"
        : isConsentKind(kind)
          ? "Consentimiento informado (para firmar)"
          : (getKind(kind)?.name ?? kind);

// ---------- Cifrado ----------

const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
const url64 = (bytes: Uint8Array) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unurl64 = (t: string) => unb64(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((t.length + 3) % 4));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** Id del formulario (24 caracteres al azar): hace de llave para abrirlo en el servidor. */
export const newFormId = () => url64(random(18));
/** Clave AES-256 del formulario, en texto para el enlace. */
export const newFormKey = () => url64(random(32));

const aesKey = (k: string) => crypto.subtle.importKey("raw", unurl64(k) as Uint8Array<ArrayBuffer>, "AES-GCM", false, ["encrypt", "decrypt"]);

/** Cifra un objeto con la clave del formulario: base64 de iv (12 bytes) y texto cifrado. */
export async function seal(data: unknown, key: string): Promise<string> {
  const iv = random(12);
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(key), plain));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64(out);
}

/** Lo contrario de seal. Lanza si la clave no es la buena o el texto se ha tocado. */
export async function unseal<T>(blob: string, key: string): Promise<T> {
  const bytes = unb64(blob);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12) as Uint8Array<ArrayBuffer> }, await aesKey(key), bytes.subarray(12) as Uint8Array<ArrayBuffer>);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

// ---------- El enlace y el mensaje ----------

/** Dónde se abren los formularios: «formsUrl» de cloud.json o, sin él, esta misma app. Acaba en «/». */
function formsBase(): string {
  const url = cachedCloudConfig()?.formsUrl?.trim();
  return url ? url.replace(/\/*$/, "/") : `${location.origin}${import.meta.env.BASE_URL}`;
}

/** La dirección que abre el paciente, con el id y la clave (que no sale del móvil). */
export function formLink(id: string, key: string, base = formsBase()): string {
  return `${base}formulario/${id}#${key}`;
}

/** El mensaje de WhatsApp o del correo (el texto de la clínica o el de siempre, src/messages/templates.ts). */
export function formMessage(p: { name: string; clinic: string; kind: string; url: string; expiresAt: string }, s?: MessageSettings | null): string {
  const until = new Date(p.expiresAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" });
  return messageText(p.kind === DOCS_KIND ? "archivos" : "formulario", s, { nombre: p.name, clinica: p.clinic, formulario: formWhat(p.kind), enlace: p.url, caduca: until });
}

// ---------- Al recoger las respuestas ----------

const filled = (v: unknown) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

/** Una respuesta del paciente limpia para el tipo de su campo, o null si no vale. */
function cleanValue(f: Field, v: unknown): AnswerValue {
  switch (f.type) {
    case "scale":
      return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10 ? v : null;
    case "number":
      return typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() ? v.trim().slice(0, 50) : null;
    case "multi":
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && f.options.includes(x)) : null;
    case "choice":
      return typeof v === "string" && f.options.includes(v) ? v : null;
    default:
      return typeof v === "string" && v.trim() ? v.trim().slice(0, 5000) : null;
  }
}

/**
 * Pone en la anamnesis lo que ha contestado el paciente: solo en los campos que se le preguntan y que estaban vacíos.
 * Lo que ya tenía escrito el fisioterapeuta no se toca: esos campos van en `skipped` (lo que contestó se puede ver).
 * `sentFields`: las preguntas que se le mandaron (migración 036); si viene, solo se aceptan las que estén en las dos
 * (lo enviado y la plantilla de ahora): una pregunta añadida después no la vio y una quitada ya no existe.
 */
export function mergeAnamnesis(
  current: Answers,
  incoming: Record<string, unknown>,
  sections: Section[],
  sentFields?: string[],
): { merged: Answers; filled: string[]; skipped: string[]; clean: Answers } {
  const sent = sentFields ? new Set(sentFields) : null;
  const merged: Answers = { ...current };
  /** Lo que contestó, solo de lo que se le preguntó y limpio (lo que se guarda para verlo). */
  const clean: Answers = {};
  const done: string[] = [];
  const skipped: string[] = [];
  for (const f of patientSections(sections).flatMap((s) => s.fields)) {
    if (sent && !sent.has(f.id)) continue;
    const v = cleanValue(f, incoming[f.id]);
    if (!filled(v)) continue;
    clean[f.id] = v;
    if (filled(current[f.id])) {
      if (JSON.stringify(current[f.id]) !== JSON.stringify(v)) skipped.push(f.id);
      continue;
    }
    merged[f.id] = v;
    done.push(f.id);
  }
  return { merged, filled: done, skipped, clean };
}

/** Las respuestas de un cuestionario, solo las de sus ítems y con valores de sus opciones o rangos. */
export function cleanFormAnswers(kind: string, incoming: Record<string, unknown>): FormAnswers {
  const form = formFor(kind);
  // Contestado antes de que el cuestionario saliera de la app (de pago o de solo nota): las respuestas, tal como
  // llegaron, para que no se pierdan (se guardan con el formulario recogido, aunque ya no den nota).
  if (!form) return Object.fromEntries(Object.entries(incoming).filter(([, v]) => v === null || (typeof v === "number" && Number.isFinite(v)))) as FormAnswers;
  const out: FormAnswers = {};
  for (const item of form.sections.flatMap((s) => s.items)) {
    const v = incoming[item.id];
    if (v === null && item.na) out[item.id] = null;
    else if (typeof v !== "number" || !Number.isFinite(v)) continue;
    else if (item.options ? item.options.some((o) => o.value === v) : item.scale ? v >= item.scale.from && v <= item.scale.to : item.input ? v >= item.input.min && v <= item.input.max : false) out[item.id] = v;
  }
  return out;
}

/**
 * Guarda un cuestionario contestado por el paciente con su nota (KOOS y HOOS, una por subescala, como en la ficha).
 * Devuelve cuántos registros ha guardado; 0 si las respuestas no bastan para la nota.
 */
export async function saveAnsweredQuestionnaire(
  db: Db,
  patientId: string,
  episodeId: string,
  kind: string,
  answers: FormAnswers,
  performedAt: string,
  formId: string,
): Promise<number> {
  const form = formFor(kind);
  const k = getKind(kind);
  if (!form || !k) return 0;
  const result = formResult(form, answers);
  if ("missing" in result) return 0;
  const notes = "Lo rellenó el paciente desde su móvil.";
  const rows: { score: number; details: Record<string, unknown> }[] = [];
  if (k.subscales) {
    for (const sub of result.ok.subscores ?? []) rows.push({ score: sub.score, details: { subscale: sub.name, answers, group: formId } });
  } else if (result.ok.score !== null) {
    rows.push({ score: result.ok.score, details: { answers, ...(result.ok.subscores ? { subscores: result.ok.subscores } : {}) } });
  }
  // El id sale del formulario: si dos dispositivos recogen las mismas respuestas a la vez, es el mismo registro (no
  // dos), y la sincronización los junta. Va al motivo de consulta al que se mandó.
  const t = new Date().toISOString();
  await db.transaction(
    rows.map((r, i) => ({
      sql: `insert or ignore into questionnaires (id, patient_id, kind, performed_at, score, details, notes, episode_id, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [`${formId}-${i}`, patientId, kind, performedAt, r.score, JSON.stringify(r.details), notes, episodeId, t, t],
    })),
  );
  return rows.length;
}
