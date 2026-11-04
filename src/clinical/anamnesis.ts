// Plantilla de la anamnesis: la «Ficha de anamnesis de fisioterapia» de la clínica, apartado por apartado y con
// sus mismos nombres, para que la rellene el fisioterapeuta. Solo se marcan en una lista la zona y el lado (para
// ordenar los tests de exploración y los cuestionarios), las banderas rojas y las precauciones (salen en los
// consentimientos); lo demás se escribe. El mapa del dolor es un cuestionario (src/clinical/questionnaires.ts).
// Las respuestas se guardan por id de campo: si se cambia esta lista, lo ya escrito no se pierde (un
// campo que se quite se sigue viendo en «Respuestas a preguntas que ya no están»). Nombre, fecha de nacimiento y sexo están en
// los datos del paciente.
import { PRECAUTIONS } from "../consent/precautions";
import type { AnswerValue, Answers } from "../data/clinical";
import type { CustomField } from "../data/customFields";
import { marksText } from "./bodyMap";
import { entriesText } from "./cif/cif";
import { PATIENT_FLAG_LABELS, RED_FLAG_LABELS } from "./redFlags";

/** El mapa del dolor estuvo un tiempo en la anamnesis con este id: lo guardado se sigue leyendo. */
const OLD_MAP = "mapa_dolor";

/** Quién contesta una pregunta: el paciente en su formulario, solo el fisioterapeuta en la ficha, o los dos. */
export type Who = "patient" | "clinician" | "both";
/** Condición «mostrar solo si…» (fase 2): sobre una pregunta anterior del mismo apartado. */
export type ShowIf = { field: string; op: "eq" | "in"; value: string | string[] };
type Base = {
  id: string;
  label: string;
  hint?: string;
  /** Cómo se le pregunta al paciente (si no, `label`). */
  patientLabel?: string;
  patientHint?: string;
  /** Quién la contesta (si no, `defaultWho`). */
  who?: Who;
  /** Pregunta delicada (tóxicos, salud mental, sexualidad…): lleva «Prefiero no responder» y no puede ser obligatoria. */
  sensitive?: boolean;
  /** Opciones: deja contestar «Otro» con un texto corto (se guarda «Otro: …»). */
  other?: boolean;
  /** Fase 2 (se leen y se guardan aunque esta versión no los use): obligatoria para el paciente, condición, opciones
   *  destacadas y módulo del que viene. */
  required?: boolean;
  showIf?: ShowIf;
  highlight?: string[];
  module?: string;
};
export type Field =
  | (Base & { type: "text" | "textarea" | "date"; rows?: number; inputMode?: "tel" | "email" })
  | (Base & { type: "number"; unit: string; min: number; max: number })
  /** Escala 0-10 (EVA). */
  | (Base & { type: "scale" })
  | (Base & { type: "choice" | "multi"; options: string[] })
  /** Sí / No y, si contesta Sí, un detalle («¿Cuál?»). Se guarda como texto: «No» o «Sí: rodilla izquierda». */
  | (Base & { type: "yesno_detail"; detail?: string })
  /** Códigos de la CIF con sus calificadores (src/clinical/cif). */
  | (Base & { type: "cif" });
export type Section = { id: string; title: string; fields: Field[] };

/** Articulaciones (los mismos ids que la galería de tests, para proponer los tests de la zona). */
export const BODY_REGIONS: { id: string; label: string }[] = [
  { id: "atm", label: "ATM" },
  { id: "cervical", label: "Cervical" },
  { id: "hombro", label: "Hombro" },
  { id: "codo", label: "Codo" },
  { id: "muneca_mano", label: "Muñeca y mano" },
  { id: "dorsal", label: "Dorsal" },
  { id: "lumbar", label: "Lumbar" },
  { id: "sacroiliaca", label: "Sacroilíaca y pelvis" },
  { id: "cadera", label: "Cadera" },
  { id: "rodilla", label: "Rodilla" },
  { id: "tobillo_pie", label: "Tobillo y pie" },
];
export const regionLabel = (id: string) => BODY_REGIONS.find((r) => r.id === id)?.label ?? id;

/** La lista de banderas rojas del fisioterapeuta: síntomas y signos (src/clinical/redFlags.ts). */
const RED_FLAGS = RED_FLAG_LABELS;

export const ANAMNESIS: Section[] = [
  {
    id: "datos",
    title: "1. Datos personales",
    fields: [
      { id: "fecha_valoracion", label: "Fecha", type: "date", hint: "De esta valoración." },
      { id: "profesion", label: "Profesión", type: "text" },
      { id: "derivado_por", label: "Médico / derivado por", type: "text" },
    ],
  },
  {
    id: "motivo",
    title: "2. Motivo de consulta",
    fields: [
      { id: "motivo", label: "Motivo principal", type: "textarea", rows: 4 },
      {
        id: "regiones",
        label: "Zona",
        type: "multi",
        options: BODY_REGIONS.map((r) => r.id),
        hint: "Marca todas las que te interesen: en Exploración salen todos sus tests y en Cuestionarios, los suyos primero.",
      },
      { id: "lado", label: "Lado", type: "choice", options: ["Derecho", "Izquierdo", "Los dos", "No aplica"] },
      { id: "fecha_inicio", label: "Fecha de inicio", type: "text", hint: "Una fecha o «hace 3 semanas»." },
      { id: "forma_inicio", label: "Forma de inicio", type: "text", hint: "Súbito o progresivo." },
      { id: "localizacion", label: "Localización del dolor/síntoma", type: "text" },
      { id: "tipo_dolor", label: "Tipo de dolor", type: "text" },
      { id: "eva", label: "Intensidad (EVA 0-10)", type: "scale" },
      { id: "agravantes", label: "Factores agravantes", type: "textarea" },
      { id: "atenuantes", label: "Factores atenuantes", type: "textarea" },
      { id: "ritmo", label: "Ritmo", type: "text", hint: "Mecánico, inflamatorio o mixto." },
      { id: "irradiacion", label: "Irradiación", type: "text" },
      { id: "evolucion", label: "Evolución desde el inicio", type: "textarea" },
      { id: "banderas_rojas", label: "Banderas rojas", type: "multi", options: RED_FLAGS, hint: "Las que confirmes al preguntar. Abajo salen las que marcó el paciente o aparecen en lo escrito." },
      {
        id: "sintomas_paciente",
        label: "Síntomas que marcó el paciente en su formulario",
        type: "multi",
        options: PATIENT_FLAG_LABELS,
        hint: "Los marca el paciente en su formulario: pregúntale por cada uno.",
      },
    ],
  },
  {
    id: "antecedentes",
    title: "3. Antecedentes médicos personales",
    fields: [
      { id: "enfermedades", label: "Enfermedades previas", type: "textarea" },
      { id: "cirugias", label: "Cirugías previas", type: "textarea" },
      { id: "traumatismos", label: "Traumatismos / fracturas", type: "textarea" },
      { id: "medicacion", label: "Medicación actual", type: "textarea" },
      { id: "alergias", label: "Alergias", type: "text" },
      {
        id: "precauciones",
        label: "Precauciones",
        type: "multi",
        options: PRECAUTIONS.map((p) => p.label),
        hint: "Cambian los riesgos de algunos tratamientos: salen en los consentimientos.",
      },
      { id: "pruebas", label: "Pruebas complementarias (RX, RM, eco…)", type: "textarea" },
    ],
  },
  {
    id: "familiares",
    title: "4. Antecedentes médicos familiares",
    fields: [{ id: "familiares", label: "Enfermedades relevantes en la familia", type: "textarea", hint: "Padres y hermanos: reumáticas, cardiovasculares, cáncer, neurológicas…" }],
  },
  {
    id: "tratamientos",
    title: "5. Tratamientos previos y expectativas",
    fields: [
      { id: "fisio_previa", label: "Fisioterapia previa", type: "textarea", hint: "Para este problema u otros: cuándo, qué le hicieron y cómo le fue." },
      { id: "otros_tratamientos", label: "Otros tratamientos para este problema", type: "textarea", hint: "Medicación, infiltraciones, cirugía, osteopatía, quiropraxia, acupuntura…" },
      { id: "respuesta_tratamientos", label: "Respuesta a los tratamientos", type: "textarea", hint: "Qué le ayudó, qué no y qué le empeoró." },
      { id: "creencias", label: "Qué cree el paciente que le pasa", type: "textarea", hint: "Su explicación del problema y de su causa." },
      { id: "expectativas", label: "Expectativas del paciente", type: "textarea", hint: "Qué espera del tratamiento y en cuánto tiempo." },
      { id: "objetivo_paciente", label: "Qué quiere volver a hacer", type: "textarea", hint: "En sus palabras: correr, dormir sin dolor, coger en brazos a su hijo…" },
    ],
  },
  {
    id: "habitos",
    title: "6. Hábitos y estilo de vida",
    fields: [
      { id: "actividad", label: "Actividad física / deporte", type: "text" },
      { id: "frecuencia", label: "Frecuencia", type: "text", hint: "Por ejemplo, 3 veces por semana." },
      { id: "ocupacion", label: "Ocupación laboral / postura habitual", type: "text" },
      { id: "toxicos", label: "Hábitos: tabaco / alcohol", type: "text", sensitive: true },
      { id: "sueno", label: "Calidad del sueño", type: "text", sensitive: true },
      { id: "estres", label: "Nivel de estrés", type: "textarea", sensitive: true },
      { id: "avd", label: "Actividades de la vida diaria afectadas", type: "textarea" },
    ],
  },
  {
    id: "exploracion",
    title: "7. Exploración física",
    fields: [
      { id: "inspeccion", label: "Inspección / observación postural", type: "textarea" },
      { id: "palpacion", label: "Palpación", type: "textarea" },
      { id: "rom", label: "Balance articular (ROM)", type: "textarea", hint: "Las mediciones de movilidad de la app se ven aquí debajo." },
      { id: "balance_muscular", label: "Balance muscular", type: "textarea" },
      { id: "pruebas_orto", label: "Pruebas ortopédicas / neurológicas", type: "textarea", hint: "Los tests que registres en Exploración se ven aquí debajo." },
      { id: "marcha", label: "Marcha y equilibrio", type: "textarea" },
      { id: "otros_hallazgos", label: "Otros hallazgos", type: "textarea" },
    ],
  },
  {
    id: "diagnostico",
    title: "8. Diagnóstico fisioterápico",
    fields: [
      {
        id: "cif",
        label: "Perfil CIF",
        type: "cif",
        hint: "Por componentes (funciones, estructuras, actividades y participación, ambientales): acota desde los atajos de fisioterapia o busca, califica cada uno y, si quieres, pásalo a texto en el diagnóstico.",
      },
      { id: "diagnostico_funcional", label: "Diagnóstico fisioterapéutico (criterio del profesional)", type: "textarea" },
      { id: "estructuras", label: "Estructuras implicadas", type: "text" },
    ],
  },
  {
    id: "objetivos",
    title: "9. Objetivos",
    fields: [
      { id: "objetivos_corto", label: "Objetivos a corto plazo", type: "textarea" },
      { id: "objetivos_largo", label: "Objetivos a largo plazo", type: "textarea" },
      { id: "plan", label: "Plan de intervención propuesto", type: "textarea", rows: 6 },
      { id: "frecuencia_duracion", label: "Frecuencia y duración estimada", type: "text" },
      { id: "sesiones_previstas", label: "Sesiones previstas (o del bono)", type: "number", unit: "", min: 1, max: 200, hint: "La pestaña Sesiones cuenta las que lleva de estas." },
    ],
  },
  {
    id: "observaciones",
    title: "10. Observaciones",
    fields: [
      { id: "observaciones", label: "Observaciones", type: "textarea", rows: 4 },
      { id: "alta_recomendaciones", label: "Recomendaciones al alta", type: "textarea", hint: "Salen en el informe de alta." },
    ],
  },
];

export const ALL_FIELDS = ANAMNESIS.flatMap((s) => s.fields);

/**
 * Versión del tronco común (esta plantilla). Se sube cuando OmniClin cambia sus preguntas: las clínicas reciben las
 * mejoras salvo en lo que ellas cambiaron (src/data/anamnesisTemplates.ts).
 */
export const BASE_VERSION = 1;

/**
 * Preguntas fijas del tronco: la app o la ley las usan. Se pueden renombrar, mover y ocultar (con aviso), pero no
 * borrar ni cambiar de tipo u opciones: banderas rojas y precauciones se reconocen por el texto de la opción
 * (redFlags.ts, consent/precautions.ts). Lo que dice cada una es lo que deja de funcionar si se oculta.
 */
export const FIXED: Record<string, string> = {
  motivo: "el nombre del motivo de consulta, el resumen de la ficha y el informe se quedarán sin el motivo",
  fecha_valoracion: "el informe y el alta no tendrán la fecha de la valoración",
  regiones: "Exploración no propondrá los tests ni los cuestionarios de la zona",
  lado: "las mediciones no propondrán el lado",
  eva: "el resumen no tendrá el dolor de la primera visita",
  banderas_rojas: "no se podrán apuntar las banderas rojas ni saldrán en los consentimientos",
  sintomas_paciente: "el paciente no podrá marcar sus síntomas de alarma",
  precauciones: "los consentimientos no tendrán en cuenta las precauciones",
  enfermedades: "los consentimientos no tendrán en cuenta sus enfermedades",
  medicacion: "los consentimientos no tendrán en cuenta su medicación",
  alergias: "los consentimientos no tendrán en cuenta sus alergias",
  cirugias: "los consentimientos no tendrán en cuenta sus cirugías",
  observaciones: "los consentimientos no tendrán en cuenta las observaciones",
  cif: "no habrá perfil CIF ni el diagnóstico redactado desde él",
  diagnostico_funcional: "el informe, el alta y los consentimientos no tendrán el diagnóstico",
  plan: "el informe y los consentimientos no tendrán el plan",
  objetivos_corto: "los consentimientos no tendrán los objetivos a corto plazo",
  objetivos_largo: "el resumen y los consentimientos no tendrán los objetivos",
  alta_recomendaciones: "el informe de alta no tendrá las recomendaciones",
  sesiones_previstas: "la pestaña Sesiones no contará las previstas",
  derivado_por: "el informe de alta no dirá quién lo derivó",
  localizacion: "el resumen no tendrá la localización del dolor",
  profesion: "la redacción de la CIF no tendrá su profesión",
  ocupacion: "la redacción de la CIF no tendrá su ocupación",
  actividad: "la redacción de la CIF no tendrá su actividad física",
  frecuencia: "la redacción de la CIF no tendrá la frecuencia de su actividad",
  creencias: "la redacción de la CIF no tendrá lo que cree que le pasa",
  expectativas: "la redacción de la CIF no tendrá sus expectativas",
  objetivo_paciente: "la redacción de la CIF no tendrá lo que quiere volver a hacer",
};

/** Los títulos de los apartados para el paciente (sin número). */
export const PATIENT_SECTION_TITLES: Record<string, string> = {
  datos: "Datos personales",
  motivo: "Motivo de consulta",
  antecedentes: "Antecedentes médicos personales",
  familiares: "Antecedentes médicos familiares",
  tratamientos: "Tratamientos previos y expectativas",
  habitos: "Hábitos y estilo de vida",
};

/**
 * Cómo se le pregunta al paciente cada pregunta del tronco que puede contestar (si la clínica no escribe otra forma).
 * Lo demás (zona y lado para los tests, banderas rojas, precauciones, exploración, diagnóstico y plan) es del
 * fisioterapeuta.
 */
export const PATIENT_TEXT: Record<string, { label: string; hint?: string }> = {
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

/**
 * Las 15 preguntas que contesta el paciente si la clínica no cambia nada (unos 5 minutos). Las demás de PATIENT_TEXT
 * son «Solo tú» por defecto: cada clínica las enciende si quiere.
 */
export const PATIENT_DEFAULT = new Set([
  "motivo",
  "fecha_inicio",
  "localizacion",
  "eva",
  "agravantes",
  "atenuantes",
  "evolucion",
  "sintomas_paciente",
  "enfermedades",
  "cirugias",
  "medicacion",
  "alergias",
  "pruebas",
  "fisio_previa",
  "objetivo_paciente",
]);

/** Quién contesta una pregunta del tronco si la clínica no dice otra cosa. */
export const defaultWho = (id: string): Who => (PATIENT_DEFAULT.has(id) ? "both" : "clinician");
/** Quién contesta: lo de la pregunta o lo de por defecto. */
export const whoOf = (f: Field): Who => f.who ?? defaultWho(f.id);
/** Lo que contesta el paciente («Paciente» o «Los dos»). */
export const forPatient = (f: Field) => whoOf(f) !== "clinician";

/** Claves internas de las respuestas («__tpl», «__src», «__respondent»…): no son preguntas. */
export const isMetaKey = (k: string) => k.startsWith("__");
/** Lo que se guarda si el paciente prefiere no contestar una pregunta delicada. */
export const NO_ANSWER = "Prefiero no responder";
const fieldById = new Map(ALL_FIELDS.map((f) => [f.id, f]));
export const getField = (id: string) => fieldById.get(id);

/** La ficha de la clínica: la de siempre con sus campos propios al final de cada apartado (src/data/customFields.ts). */
export function withCustom(custom: CustomField[]): Section[] {
  if (!custom.length) return ANAMNESIS;
  return ANAMNESIS.map((s) => ({
    ...s,
    fields: [
      ...s.fields,
      ...custom
        .filter((c) => c.section === s.id && !fieldById.has(c.id))
        .map((c): Field => (c.type === "choice" || c.type === "multi" ? { id: c.id, label: c.label, type: c.type, options: c.options ?? [], who: "both" } : { id: c.id, label: c.label, type: c.type, who: "both" })),
    ],
  }));
}
/** Un campo de la ficha (con los propios), por su id. */
export const fieldIn = (sections: Section[], id: string) => sections.flatMap((s) => s.fields).find((f) => f.id === id);

/** Texto de una respuesta para leerla (en la ficha, el resumen y el informe). */
export function answerText(field: Field | undefined, v: AnswerValue): string {
  if (v === null || v === undefined || v === "") return "";
  if (field?.type === "cif" && Array.isArray(v)) return entriesText(v as string[]);
  if (Array.isArray(v)) return v.map((x) => (field?.id === "regiones" ? regionLabel(x) : x)).join(", ");
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (field?.type === "number") return `${String(v).replace(".", ",")}${field.unit ? ` ${field.unit}` : ""}`;
  if (field?.type === "scale") return `${v}/10`;
  if (field?.type === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  }
  return String(v);
}

const list = (a: Answers, id: string) => (Array.isArray(a[id]) ? (a[id] as string[]) : []);
const str = (a: Answers, id: string) => (typeof a[id] === "string" ? (a[id] as string) : "");

/** Lo esencial para el resumen de la ficha. */
export function clinicalSummary(a: Answers) {
  return {
    reason: str(a, "motivo"),
    regions: list(a, "regiones"),
    side: str(a, "lado"),
    location: str(a, "localizacion"),
    referral: str(a, "derivado_por"),
    diagnosis: str(a, "diagnostico_funcional"),
    painNow: typeof a.eva === "number" ? a.eva : null,
    redFlags: list(a, "banderas_rojas"),
    goal: str(a, "objetivos_largo"),
  };
}

const answered = (v: AnswerValue | undefined) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

/** Cuántos campos de un apartado (o de toda la plantilla) tienen respuesta. */
export function answeredCount(a: Answers, fields = ALL_FIELDS): number {
  return fields.filter((f) => answered(a[f.id])).length;
}

/**
 * Nombre y texto de una respuesta guardada que ya no está en la plantilla. `known`: la pregunta tal como se hizo (de la
 * instantánea de la anamnesis o de la plantilla, aunque esté oculta o retirada); si no, la del tronco.
 */
export function orphanText(id: string, v: AnswerValue, known?: Field): { label: string; text: string } {
  if (id === OLD_MAP) return { label: "Mapa del dolor (ahora está en Cuestionarios)", text: marksText(v) };
  const f = known ?? getField(id);
  return { label: f?.label ?? id, text: answerText(f, v) };
}

/** Respuestas guardadas de campos que ya no están en la plantilla (no se pierden). */
export function orphanAnswers(a: Answers, sections: Section[] = ANAMNESIS): [string, AnswerValue][] {
  const ids = new Set(sections.flatMap((s) => s.fields.map((f) => f.id)));
  return Object.entries(a).filter(([k, v]) => !isMetaKey(k) && !ids.has(k) && answered(v));
}
