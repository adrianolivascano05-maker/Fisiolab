// Plantilla de la anamnesis: la «Ficha de anamnesis de fisioterapia» de la clínica, apartado por apartado y con
// sus mismos nombres, para que la rellene el fisioterapeuta. Solo se marcan en una lista la zona y el lado (para
// ordenar los tests de exploración y los cuestionarios), las banderas rojas y las precauciones (salen en los
// consentimientos); lo demás se escribe. El mapa del dolor es un cuestionario (src/clinical/questionnaires.ts).
// Las respuestas se guardan por id de campo: si se cambia esta lista, lo ya escrito no se pierde (un
// campo que se quite se sigue viendo en «Otros datos guardados»). Nombre, fecha de nacimiento y sexo están en
// los datos del paciente.
import { PRECAUTIONS } from "../consent/precautions";
import type { AnswerValue, Answers } from "../data/clinical";
import type { CustomField } from "../data/customFields";
import { marksText } from "./bodyMap";

/** El mapa del dolor estuvo un tiempo en la anamnesis con este id: lo guardado se sigue leyendo. */
const OLD_MAP = "mapa_dolor";

type Base = { id: string; label: string; hint?: string };
export type Field =
  | (Base & { type: "text" | "textarea" | "date"; rows?: number; inputMode?: "tel" | "email" })
  | (Base & { type: "number"; unit: string; min: number; max: number })
  /** Escala 0-10 (EVA). */
  | (Base & { type: "scale" })
  | (Base & { type: "choice" | "multi"; options: string[] });
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

export const RED_FLAGS = [
  "Pérdida de peso sin explicación",
  "Fiebre o malestar general",
  "Antecedente de cáncer",
  "Dolor nocturno que no cede con el reposo",
  "Traumatismo importante reciente",
  "Alteración de esfínteres o anestesia en silla de montar",
  "Pérdida de fuerza o sensibilidad que avanza",
  "Corticoides durante mucho tiempo o inmunosupresión",
];

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
      { id: "banderas_rojas", label: "Banderas rojas", type: "multi", options: RED_FLAGS, hint: "Si hay alguna, valora derivar." },
    ],
  },
  {
    id: "antecedentes",
    title: "3. Antecedentes personales",
    fields: [
      { id: "enfermedades", label: "Enfermedades previas", type: "textarea" },
      { id: "cirugias", label: "Cirugías previas", type: "textarea" },
      { id: "traumatismos", label: "Traumatismos / fracturas", type: "textarea" },
      { id: "fisio_previa", label: "Tratamientos de fisioterapia previos", type: "textarea" },
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
    title: "4. Antecedentes familiares",
    fields: [{ id: "familiares", label: "Antecedentes relevantes en la familia", type: "textarea" }],
  },
  {
    id: "habitos",
    title: "5. Hábitos y estilo de vida",
    fields: [
      { id: "actividad", label: "Actividad física / deporte", type: "text" },
      { id: "frecuencia", label: "Frecuencia", type: "text", hint: "Por ejemplo, 3 veces por semana." },
      { id: "ocupacion", label: "Ocupación laboral / postura habitual", type: "text" },
      { id: "toxicos", label: "Hábitos: tabaco / alcohol", type: "text" },
      { id: "sueno", label: "Calidad del sueño", type: "text" },
      { id: "estres", label: "Nivel de estrés", type: "textarea" },
      { id: "avd", label: "Actividades de la vida diaria afectadas", type: "textarea" },
    ],
  },
  {
    id: "exploracion",
    title: "6. Exploración física",
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
    title: "7. Diagnóstico fisioterápico",
    fields: [
      { id: "diagnostico_funcional", label: "Diagnóstico fisioterapéutico (criterio del profesional)", type: "textarea" },
      { id: "estructuras", label: "Estructuras implicadas", type: "text" },
    ],
  },
  {
    id: "objetivos",
    title: "8. Objetivos",
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
    title: "9. Observaciones",
    fields: [
      { id: "observaciones", label: "Observaciones", type: "textarea", rows: 4 },
      { id: "alta_recomendaciones", label: "Recomendaciones al alta", type: "textarea", hint: "Salen en el informe de alta." },
    ],
  },
];

export const ALL_FIELDS = ANAMNESIS.flatMap((s) => s.fields);
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
        .map((c): Field => (c.type === "choice" || c.type === "multi" ? { id: c.id, label: c.label, type: c.type, options: c.options ?? [] } : { id: c.id, label: c.label, type: c.type })),
    ],
  }));
}
/** Un campo de la ficha (con los propios), por su id. */
export const fieldIn = (sections: Section[], id: string) => sections.flatMap((s) => s.fields).find((f) => f.id === id);

/** Texto de una respuesta para leerla (en la ficha, el resumen y el informe). */
export function answerText(field: Field | undefined, v: AnswerValue): string {
  if (v === null || v === undefined || v === "") return "";
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

/** Nombre y texto de una respuesta guardada que ya no está en la plantilla. */
export function orphanText(id: string, v: AnswerValue): { label: string; text: string } {
  if (id === OLD_MAP) return { label: "Mapa del dolor (ahora está en Cuestionarios)", text: marksText(v) };
  return { label: id, text: answerText(undefined, v) };
}

/** Respuestas guardadas de campos que ya no están en la plantilla (no se pierden). */
export function orphanAnswers(a: Answers, sections: Section[] = ANAMNESIS): [string, AnswerValue][] {
  const ids = new Set(sections.flatMap((s) => s.fields.map((f) => f.id)));
  return Object.entries(a).filter(([k, v]) => !ids.has(k) && answered(v));
}
