// Las preguntas que añade la clínica a la anamnesis (en una plantilla o en un módulo, docs/anamnesis-adaptable.md):
// sus tipos, cómo se comprueban antes de guardarlas y cómo se convierten en preguntas de la ficha. Lo comparten
// src/data/anamnesisTemplates.ts y src/data/anamnesisModules.ts.
import { BODY_REGIONS, NUMBER_UNITS, type Field, type ShowIf, type Who } from "../clinical/anamnesis";

/** Tipos de las preguntas que añade la clínica. */
export type OwnType = "text" | "textarea" | "choice" | "multi" | "scale" | "yesno_detail" | "yesno" | "number" | "date" | "zones";
export const OWN_TYPES: OwnType[] = ["text", "textarea", "choice", "multi", "scale", "yesno_detail", "yesno", "number", "date", "zones"];
/** Los que existían en la fase 1 (los demás, un móvil sin actualizar los enseña como texto). */
export const PHASE1_TYPES: OwnType[] = ["text", "textarea", "choice", "multi", "scale", "yesno_detail"];

/**
 * Una pregunta añadida por la clínica (`c_<8 hex>`) o de un módulo de OmniClin (`m_<módulo>_<pregunta>`). No se borra:
 * se retira (`removed`). Las opciones no se renombran: se añaden o se retiran, así una respuesta guardada siempre
 * significa lo que decía la opción.
 */
export type OwnField = {
  id: string;
  /** Apartado: uno del tronco, uno nuevo de la clínica (`s_<8 hex>`) o, en un módulo, «self» (su apartado propio). */
  section: string;
  type: OwnType;
  label: string;
  hint?: string;
  patientLabel?: string;
  who: Who;
  options?: string[];
  other?: boolean;
  detail?: string;
  /** Número con unidad. */
  unit?: string;
  sensitive?: boolean;
  hidden?: boolean;
  removed?: boolean;
  /** Obligatoria para el paciente (nunca las delicadas; como mucho 5 por formulario). */
  required?: boolean;
  showIf?: ShowIf;
  /** Respuestas que se destacan en la ficha (opciones o Sí/No). */
  highlight?: string[];
  /** Módulos de OmniClin: en qué versión del módulo apareció (para el aviso de novedades). */
  since?: number;
  /** Solo en la anamnesis ampliada (si no, en la base). */
  extra?: boolean;
};

export const LIMITS = { sections: 40, fields: 300, bytes: 64 * 1024, snapshotBytes: 256 * 1024, label: 200, hint: 500, templates: 20, moduleFields: 100 };
export const ID = /^[a-z0-9_]{1,40}$/;
const WHO: Who[] = ["patient", "clinician", "both"];

export const text = (v: unknown, max: number, what: string): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new RangeError(`${what}: no es un texto.`);
  const t = v.trim();
  if (t.length > max) throw new RangeError(`${what}: como mucho ${max} caracteres.`);
  return t || undefined;
};
export const who = (v: unknown): Who | undefined => (WHO.includes(v as Who) ? (v as Who) : undefined);
export const bool = (v: unknown) => (v === true ? true : undefined);
/** Quita lo que no vale (undefined) para que el JSON sea siempre el mismo. */
export const tidy = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export function checkOptions(list: unknown, what: string): string[] {
  if (!Array.isArray(list)) throw new RangeError(`${what}: faltan las opciones.`);
  const out: string[] = [];
  for (const o of list) {
    const t = text(o, LIMITS.label, `${what}, opción`);
    if (!t) continue;
    if (out.some((x) => x.toLowerCase() === t.toLowerCase())) throw new RangeError(`${what}: la opción «${t}» está repetida.`);
    out.push(t);
  }
  if (out.length < 2) throw new RangeError(`${what}: pon al menos dos opciones.`);
  return out;
}

/** Una condición bien formada (que la pregunta de la que depende exista y vaya antes se mira al resolver). */
export function checkShowIf(v: unknown, self: string): ShowIf | undefined {
  if (!v || typeof v !== "object") return undefined;
  const c = v as Partial<ShowIf>;
  if (typeof c.field !== "string" || !ID.test(c.field) || c.field === self) return undefined;
  if (c.op === "eq" && typeof c.value === "string" && c.value) return { field: c.field, op: "eq", value: c.value.slice(0, LIMITS.label) };
  if (c.op === "in" && Array.isArray(c.value)) {
    const value = [...new Set(c.value.filter((x): x is string => typeof x === "string" && !!x).map((x) => x.slice(0, LIMITS.label)))];
    if (value.length === 1) return { field: c.field, op: "eq", value: value[0]! };
    if (value.length) return { field: c.field, op: "in", value };
  }
  return undefined;
}

/** Las respuestas que se pueden destacar en una pregunta de este tipo. */
const highlightable = (type: OwnType, options?: string[]) => (type === "choice" || type === "multi" ? (options ?? []) : type === "yesno" || type === "yesno_detail" ? ["Sí", "No"] : []);

/** Comprueba y limpia una pregunta propia. `sectionOk`: qué apartados admite. */
export function checkOwnField(f: OwnField, sectionOk: (id: string) => boolean): OwnField {
  if (!f || typeof f !== "object") throw new RangeError("Una pregunta no es válida.");
  if (!ID.test(f.id ?? "") || f.id.startsWith("__")) throw new RangeError("Una pregunta tiene un identificador no válido.");
  if (!OWN_TYPES.includes(f.type)) throw new RangeError(`La pregunta «${f.label}» tiene un tipo que no existe.`);
  if (!ID.test(f.section ?? "") || !sectionOk(f.section)) throw new RangeError(`La pregunta «${f.label}» no tiene apartado.`);
  const label = text(f.label, LIMITS.label, "Pregunta");
  if (!label) throw new RangeError("Escribe la pregunta.");
  const options = f.type === "choice" || f.type === "multi" ? checkOptions(f.options, `«${label}»`) : undefined;
  const allowed = highlightable(f.type, options);
  const highlight = Array.isArray(f.highlight) ? [...new Set(f.highlight.filter((h) => allowed.includes(h)))] : [];
  return tidy<OwnField>({
    id: f.id,
    section: f.section,
    type: f.type,
    label,
    hint: text(f.hint, LIMITS.hint, `«${label}», ayuda`),
    patientLabel: text(f.patientLabel, LIMITS.label, `«${label}», texto para el paciente`),
    who: who(f.who) ?? "clinician",
    options,
    other: options ? bool(f.other) : undefined,
    detail: f.type === "yesno_detail" ? (text(f.detail, LIMITS.label, `«${label}», detalle`) ?? "¿Cuál?") : undefined,
    unit: f.type === "number" ? (NUMBER_UNITS.includes(f.unit ?? "") ? f.unit : undefined) : undefined,
    sensitive: bool(f.sensitive),
    hidden: bool(f.hidden),
    removed: bool(f.removed),
    // Las delicadas nunca son obligatorias; las que solo contesta el fisio, tampoco (es solo para el paciente).
    required: f.sensitive || f.who === "clinician" ? undefined : bool(f.required),
    showIf: checkShowIf(f.showIf, f.id),
    highlight: highlight.length ? highlight : undefined,
    since: Number.isInteger(f.since) && f.since! > 1 ? f.since : undefined,
    extra: bool(f.extra),
  });
}

/** Mínimo y máximo de un número con unidad que añade la clínica. */
export const NUMBER_RANGE = { min: 0, max: 100000 };

/** La pregunta propia como pregunta de la ficha. `module`: el módulo del que viene. */
export function ownToField(f: OwnField, module?: string): Field {
  const base = tidy({
    id: f.id,
    label: f.label,
    hint: f.hint,
    patientLabel: f.patientLabel,
    who: f.who,
    sensitive: f.sensitive,
    other: f.other,
    required: f.required,
    showIf: f.showIf,
    highlight: f.highlight,
    module,
    extra: f.extra || undefined,
  });
  switch (f.type) {
    case "choice":
    case "multi":
      return { ...base, type: f.type, options: f.options ?? [] };
    case "yesno_detail":
      return { ...base, type: "yesno_detail", detail: f.detail ?? "¿Cuál?" };
    case "number":
      return { ...base, type: "number", unit: f.unit ?? "", min: NUMBER_RANGE.min, max: NUMBER_RANGE.max };
    default:
      return { ...base, type: f.type };
  }
}

/** Las zonas del cuerpo que admite el tipo «Zonas» (las de la galería de tests). */
export const ZONE_IDS = new Set(BODY_REGIONS.map((r) => r.id));

export const newOwnId = () => `c_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
export const newSectionId = () => `s_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
