// Campos propios de la clínica en la anamnesis (Ajustes → Anamnesis de la clínica): preguntas que cada clínica añade a
// los apartados de la ficha (suelo pélvico, deportiva, neurológica…). Se guardan en un ajuste que se sincroniza, así el
// equipo entero usa la misma ficha. Las respuestas van con las demás de la anamnesis, por el id del campo: quitar un
// campo no borra lo respondido (sale en «Respuestas a preguntas que ya no están»).
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
