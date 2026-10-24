// Campos propios de la clínica en la anamnesis (Ajustes → Anamnesis de la clínica): preguntas que cada clínica añade a
// los apartados de la ficha (suelo pélvico, deportiva, neurológica…). Se guardan en un ajuste que se sincroniza, así el
// equipo entero usa la misma ficha. Las respuestas van con las demás de la anamnesis, por el id del campo: quitar un
// campo no borra lo respondido (sale en «Otros datos guardados»).
import { getSetting, setSetting } from "./repo";
import type { Db } from "./db";

export type CustomFieldType = "text" | "textarea" | "choice" | "multi" | "scale";
export const CUSTOM_TYPES: { id: CustomFieldType; label: string }[] = [
  { id: "text", label: "Texto corto" },
  { id: "textarea", label: "Texto largo" },
  { id: "choice", label: "Una opción" },
  { id: "multi", label: "Varias opciones" },
  { id: "scale", label: "Escala de 0 a 10" },
];
/** Un campo propio: en qué apartado de la anamnesis va, su pregunta y su tipo (con sus opciones). */
export type CustomField = { id: string; section: string; label: string; type: CustomFieldType; options?: string[] };
const CUSTOM_FIELDS_KEY = "anamnesis_custom_fields";

export async function getCustomFields(db: Db): Promise<CustomField[]> {
  return (await getSetting<CustomField[]>(db, CUSTOM_FIELDS_KEY)) ?? [];
}

/** Comprueba y limpia un campo (las opciones, una por línea, sin repetir). */
export function checkCustomField(f: CustomField): CustomField {
  const label = f.label.trim();
  if (!label) throw new RangeError("Escribe la pregunta.");
  const options = [...new Set((f.options ?? []).map((o) => o.trim()).filter(Boolean))];
  if ((f.type === "choice" || f.type === "multi") && options.length < 2) throw new RangeError("Pon al menos dos opciones, una por línea.");
  return { id: f.id, section: f.section, label, type: f.type, ...(f.type === "choice" || f.type === "multi" ? { options } : {}) };
}

export const newCustomId = () => `c_${crypto.randomUUID().slice(0, 8)}`;

export async function saveCustomFields(db: Db, fields: CustomField[]): Promise<void> {
  await setSetting(db, CUSTOM_FIELDS_KEY, fields.map(checkCustomField));
}

/** Paquetes de ejemplo por especialidad, para empezar (se añaden y luego se cambian como se quiera). */
export const CUSTOM_PACKS: { id: string; title: string; fields: Omit<CustomField, "id">[] }[] = [
  {
    id: "deporte",
    title: "Fisioterapia deportiva",
    fields: [
      { section: "habitos", label: "Deporte principal y nivel", type: "text" },
      { section: "habitos", label: "Horas de entrenamiento a la semana", type: "text" },
      { section: "habitos", label: "Próxima competición o evento", type: "text" },
      { section: "objetivos", label: "Objetivo deportivo", type: "textarea" },
    ],
  },
  {
    id: "suelo_pelvico",
    title: "Suelo pélvico",
    fields: [
      { section: "antecedentes", label: "Embarazos y partos", type: "textarea" },
      { section: "motivo", label: "Escapes de orina", type: "choice", options: ["No", "Al esfuerzo", "Con urgencia", "Mixtos"] },
      { section: "motivo", label: "Uso de absorbentes", type: "text" },
      { section: "motivo", label: "Dolor en las relaciones sexuales", type: "choice", options: ["No", "Sí", "Prefiere no responder"] },
      { section: "habitos", label: "Hábito intestinal", type: "text" },
    ],
  },
  {
    id: "neuro",
    title: "Fisioterapia neurológica",
    fields: [
      { section: "antecedentes", label: "Diagnóstico neurológico y fecha", type: "textarea" },
      { section: "habitos", label: "Ayudas técnicas", type: "multi", options: ["Bastón", "Andador", "Silla de ruedas", "Ortesis", "Ninguna"] },
      { section: "habitos", label: "Nivel de independencia en las actividades diarias", type: "choice", options: ["Independiente", "Necesita algo de ayuda", "Dependiente"] },
      { section: "exploracion", label: "Tono y espasticidad", type: "textarea" },
    ],
  },
];

/** Añade un paquete (sin repetir preguntas que ya estén con el mismo texto en el mismo apartado). Devuelve cuántas. */
export async function addCustomPack(db: Db, packId: string): Promise<number> {
  const pack = CUSTOM_PACKS.find((p) => p.id === packId);
  if (!pack) return 0;
  const now = await getCustomFields(db);
  const add = pack.fields
    .filter((f) => !now.some((x) => x.section === f.section && x.label.toLowerCase() === f.label.toLowerCase()))
    .map((f) => ({ ...f, id: newCustomId() }));
  if (add.length) await saveCustomFields(db, [...now, ...add]);
  return add.length;
}
