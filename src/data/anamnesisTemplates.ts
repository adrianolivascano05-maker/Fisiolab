// Plantillas de anamnesis de la clínica (docs/anamnesis-adaptable.md). La clínica no copia la ficha de OmniClin (el
// tronco, src/clinical/anamnesis.ts): guarda solo sus cambios encima (ocultar, renombrar, mover, quién contesta,
// preguntas añadidas). La ficha que se ve se calcula: tronco + cambios. «Volver al original» es borrar cambios, y las
// mejoras del tronco llegan solas salvo en lo que la clínica cambió.
//
// Cómo se guarda (en ajustes, que se sincronizan fila entera; sin migración de la base):
// - `anamnesis_tpl:<id>`: el puntero, con los cambios de la clínica, quién y cuándo (lo único que puede chocar entre
//   dos móviles: gana el último, y el editor dice quién lo cambió).
// - `anamnesis_tpl_v:<id>:<huella>`: la plantilla ya resuelta, inmutable, con su huella sha256 corta. Se escribe la
//   primera vez que se usa (al guardar una anamnesis o mandar un enlace), no en cada toque del editor.
// - Cada anamnesis apunta a la suya: `answers.__tpl = "<id>@<huella>"`. Así, años después, cada respuesta se lee con la
//   pregunta tal como se hizo (Ley 41/2002, art. 15).
// El formato ya lleva lo de la fase 2 (módulos, apartados nuevos, condiciones, obligatorias, destacados): esta versión
// los lee y los guarda aunque no los use, y enseña como texto los tipos de pregunta que no conoce.
import { ANAMNESIS, BASE_VERSION, FIXED, PATIENT_TEXT, defaultWho, getField, type Field, type Section, type Who } from "../clinical/anamnesis";
import { getCustomFields, type CustomField, type CustomFieldType } from "./customFields";
import type { Db } from "./db";
import { getSetting, setSetting } from "./settings";

/** La plantilla de siempre (la fase 2 añade más, hasta 20). */
export const GENERAL = "general";
const POINTER = (id: string) => `anamnesis_tpl:${id}`;
const SNAPSHOT = (id: string, hash: string) => `anamnesis_tpl_v:${id}:${hash}`;
export const isTemplateKey = (key: string) => key.startsWith("anamnesis_tpl:") || key.startsWith("anamnesis_tpl_v:");

// ---------- Tipos ----------

/** Cambios de la clínica sobre una pregunta del tronco: texto, texto para el paciente, ayuda, quién contesta, oculta. */
export type FieldPatch = { label?: string; patientLabel?: string; hint?: string; who?: Who; hidden?: boolean };
/** Tipos de las preguntas que añade la clínica en la fase 1. */
export type OwnType = "text" | "textarea" | "choice" | "multi" | "scale" | "yesno_detail";
export const OWN_TYPES: OwnType[] = ["text", "textarea", "choice", "multi", "scale", "yesno_detail"];
/**
 * Una pregunta añadida por la clínica (`c_<8 hex>`). No se borra: se retira (`removed`). Las opciones no se renombran:
 * se añaden o se retiran, así una respuesta guardada siempre significa lo que decía la opción.
 */
export type OwnField = {
  id: string;
  section: string;
  type: OwnType;
  label: string;
  hint?: string;
  patientLabel?: string;
  who: Who;
  options?: string[];
  other?: boolean;
  detail?: string;
  sensitive?: boolean;
  hidden?: boolean;
  removed?: boolean;
  /** Fase 2: se guardan tal cual. */
  required?: boolean;
  showIf?: Field["showIf"];
  highlight?: string[];
};
/** Fase 2: un apartado nuevo o cambiado. */
export type SectionPatch = { title?: string; hidden?: boolean };
export type TemplateDelta = {
  fields: Record<string, FieldPatch>;
  /** Orden de cada apartado: ids en el orden que quiere la clínica (lo que no esté, detrás, en su orden). */
  order: Record<string, string[]>;
  added: OwnField[];
  /** Fase 2. */
  sections: Record<string, SectionPatch>;
  modules: unknown[];
};
/** El puntero: la plantilla con sus cambios, quién la cambió por última vez y cuándo. */
export type TemplateDoc = { v: 1; id: string; name: string; base: number; delta: TemplateDelta; by?: string; at?: string; archived?: boolean };
/** La plantilla resuelta: los apartados con sus preguntas visibles y todas las preguntas que conoce (también ocultas y
 * retiradas, para leer lo ya respondido). */
export type Resolved = { id: string; name: string; base: number; sections: Section[]; all: Field[] };
export type ResolvedTemplate = Resolved & { hash: string; ref: string };

export const emptyDelta = (): TemplateDelta => ({ fields: {}, order: {}, added: [], sections: {}, modules: [] });

// ---------- Comprobar ----------

export const LIMITS = { sections: 40, fields: 300, bytes: 64 * 1024, snapshotBytes: 256 * 1024, label: 200, hint: 500 };
const ID = /^[a-z0-9_]{1,40}$/;
const BASE_IDS = new Set(ANAMNESIS.flatMap((s) => s.fields.map((f) => f.id)));
const SECTION_IDS = new Set(ANAMNESIS.map((s) => s.id));
const WHO: Who[] = ["patient", "clinician", "both"];

const text = (v: unknown, max: number, what: string): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new RangeError(`${what}: no es un texto.`);
  const t = v.trim();
  if (t.length > max) throw new RangeError(`${what}: como mucho ${max} caracteres.`);
  return t || undefined;
};
const who = (v: unknown): Who | undefined => (WHO.includes(v as Who) ? (v as Who) : undefined);
const bool = (v: unknown) => (v === true ? true : undefined);
/** Quita lo que no vale (undefined) para que el JSON sea siempre el mismo. */
const tidy = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function checkOptions(list: unknown, what: string): string[] {
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

/**
 * Comprueba y limpia una plantilla antes de guardarla: límites, ids, textos, opciones y fijas. Las claves que no conoce
 * se quitan (las de la fase 2 se conservan). Las etiquetas son texto: nunca se interpretan como HTML ni markdown.
 */
export function checkTemplate(doc: TemplateDoc): TemplateDoc {
  if (!doc || typeof doc !== "object") throw new RangeError("La plantilla no es válida.");
  if (!ID.test(doc.id ?? "")) throw new RangeError("El identificador de la plantilla no es válido.");
  const name = text(doc.name, LIMITS.label, "Nombre de la plantilla") ?? "General";
  const d = doc.delta ?? emptyDelta();
  const fields: Record<string, FieldPatch> = {};
  for (const [id, p] of Object.entries(d.fields ?? {})) {
    // Solo preguntas del tronco que existen (las propias llevan sus datos en `added`).
    if (!BASE_IDS.has(id) || typeof p !== "object" || p === null) continue;
    const q = getField(id)!;
    const patch = tidy<FieldPatch>({
      label: text(p.label, LIMITS.label, `«${q.label}»`),
      patientLabel: text(p.patientLabel, LIMITS.label, `«${q.label}», texto para el paciente`),
      hint: text(p.hint, LIMITS.hint, `«${q.label}», ayuda`),
      who: q.type === "cif" ? undefined : who(p.who),
      hidden: bool(p.hidden),
    });
    if (Object.keys(patch).length) fields[id] = patch;
  }
  const added: OwnField[] = [];
  const seen = new Set<string>();
  for (const f of d.added ?? []) {
    if (!f || typeof f !== "object") continue;
    if (!ID.test(f.id ?? "") || f.id.startsWith("__")) throw new RangeError("Una pregunta tiene un identificador no válido.");
    if (BASE_IDS.has(f.id) || seen.has(f.id)) throw new RangeError(`La pregunta «${f.label}» tiene un identificador repetido.`);
    seen.add(f.id);
    if (!OWN_TYPES.includes(f.type)) throw new RangeError(`La pregunta «${f.label}» tiene un tipo que no existe.`);
    if (!ID.test(f.section ?? "")) throw new RangeError(`La pregunta «${f.label}» no tiene apartado.`);
    const label = text(f.label, LIMITS.label, "Pregunta");
    if (!label) throw new RangeError("Escribe la pregunta.");
    const options = f.type === "choice" || f.type === "multi" ? checkOptions(f.options, `«${label}»`) : undefined;
    added.push(
      tidy<OwnField>({
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
        sensitive: bool(f.sensitive),
        hidden: bool(f.hidden),
        removed: bool(f.removed),
        required: f.sensitive ? undefined : bool(f.required),
        showIf: f.showIf,
        highlight: Array.isArray(f.highlight) ? f.highlight.filter((h) => options?.includes(h)) : undefined,
      }),
    );
  }
  const order: Record<string, string[]> = {};
  const known = new Set([...BASE_IDS, ...seen]);
  for (const [sid, ids] of Object.entries(d.order ?? {})) {
    if (!ID.test(sid) || !Array.isArray(ids)) continue;
    const list = [...new Set(ids.filter((x) => typeof x === "string" && known.has(x)))];
    if (list.length) order[sid] = list;
  }
  const sections: Record<string, SectionPatch> = {};
  for (const [sid, p] of Object.entries(d.sections ?? {})) {
    if (!ID.test(sid) || typeof p !== "object" || p === null) continue;
    const patch = tidy<SectionPatch>({ title: text(p.title, LIMITS.label, "Apartado"), hidden: bool(p.hidden) });
    if (Object.keys(patch).length) sections[sid] = patch;
  }
  const out: TemplateDoc = tidy({
    v: 1 as const,
    id: doc.id,
    name,
    base: Number.isInteger(doc.base) ? doc.base : BASE_VERSION,
    delta: { fields, order, added, sections, modules: Array.isArray(d.modules) ? d.modules : [] },
    by: typeof doc.by === "string" ? doc.by.slice(0, 200) : undefined,
    at: typeof doc.at === "string" ? doc.at : undefined,
    archived: bool(doc.archived),
  });
  const sectionCount = new Set([...SECTION_IDS, ...Object.keys(sections), ...added.map((f) => f.section)]).size;
  if (sectionCount > LIMITS.sections) throw new RangeError(`Como mucho ${LIMITS.sections} apartados.`);
  if (BASE_IDS.size + added.length > LIMITS.fields) throw new RangeError(`Como mucho ${LIMITS.fields} preguntas.`);
  if (new TextEncoder().encode(JSON.stringify(out)).length > LIMITS.bytes) throw new RangeError("La plantilla es demasiado grande.");
  return out;
}

// ---------- Resolver: tronco + cambios ----------

const ownToField = (f: OwnField): Field => {
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
  });
  switch (f.type) {
    case "choice":
    case "multi":
      return { ...base, type: f.type, options: f.options ?? [] };
    case "yesno_detail":
      return { ...base, type: "yesno_detail", detail: f.detail ?? "¿Cuál?" };
    default:
      return { ...base, type: f.type };
  }
};

const memo = new Map<string, Resolved>();

/** La ficha que se ve: tronco + cambios de la clínica. Memoizado por plantilla. */
export function resolveTemplate(doc: TemplateDoc): Resolved {
  const key = JSON.stringify(doc.delta) + doc.id + doc.name;
  const hit = memo.get(key);
  if (hit) return hit;
  const d = doc.delta;
  const all: Field[] = [];
  const sections: Section[] = ANAMNESIS.map((s) => {
    const base = s.fields.map((f): Field => {
      const p = d.fields[f.id] ?? {};
      const text = PATIENT_TEXT[f.id];
      return tidy({
        ...f,
        label: p.label ?? f.label,
        hint: p.hint ?? f.hint,
        patientLabel: p.patientLabel ?? text?.label,
        patientHint: text?.hint,
        who: p.who ?? f.who ?? defaultWho(f.id),
      }) as Field;
    });
    const own = d.added.filter((f) => f.section === s.id).map(ownToField);
    const fields = [...base, ...own];
    all.push(...fields);
    const hidden = (id: string) => d.fields[id]?.hidden || d.added.some((f) => f.id === id && (f.hidden || f.removed));
    const order = d.order[s.id] ?? [];
    const pos = (id: string) => {
      const i = order.indexOf(id);
      return i === -1 ? order.length + fields.findIndex((f) => f.id === id) : i;
    };
    return {
      id: s.id,
      title: d.sections[s.id]?.title ?? s.title,
      fields: fields.filter((f) => !hidden(f.id)).sort((x, y) => pos(x.id) - pos(y.id)),
    };
  });
  // Preguntas propias de apartados que no son del tronco (fase 2): se leen, aunque esta versión no las enseñe.
  for (const f of d.added) if (!SECTION_IDS.has(f.section)) all.push(ownToField(f));
  const out: Resolved = { id: doc.id, name: doc.name, base: doc.base, sections, all };
  // Cada toque del editor es una plantilla distinta: se guardan solo las últimas.
  if (memo.size > 50) memo.clear();
  memo.set(key, out);
  return out;
}

/** La huella de una plantilla resuelta: sha256 de su JSON, 12 primeras cifras hexadecimales. */
export async function templateHash(r: Resolved): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ id: r.id, name: r.name, base: r.base, sections: r.sections, all: r.all }));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest.subarray(0, 6), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function withHash(r: Resolved): Promise<ResolvedTemplate> {
  const hash = await templateHash(r);
  return { ...r, hash, ref: `${r.id}@${hash}` };
}

// ---------- Guardar y leer ----------

/** Las preguntas propias de antes (anamnesis_custom_fields) como preguntas de la plantilla: hoy las contesta el paciente. */
export function fromCustom(custom: CustomField[]): OwnField[] {
  return custom
    .filter((c) => !BASE_IDS.has(c.id))
    .map((c) => tidy<OwnField>({ id: c.id, section: c.section, type: c.type, label: c.label, who: "both", options: c.type === "choice" || c.type === "multi" ? c.options : undefined }));
}

/** La plantilla con sus cambios. Sin puntero todavía: el tronco con las preguntas propias de antes. */
export async function getTemplateDoc(db: Db, id = GENERAL): Promise<TemplateDoc> {
  const doc = await getSetting<TemplateDoc>(db, POINTER(id));
  if (doc) {
    try {
      return checkTemplate(doc);
    } catch {
      // Un puntero que no se entiende (de una versión más nueva con algo que esta no admite): se lee tal cual.
      return { ...doc, delta: { ...emptyDelta(), ...doc.delta } };
    }
  }
  return { v: 1, id, name: "General", base: BASE_VERSION, delta: { ...emptyDelta(), added: fromCustom(await getCustomFields(db)) } };
}

/** Las preguntas propias en el formato de antes, para los móviles sin actualizar (doble escritura durante una versión). */
export function toCustom(added: OwnField[]): CustomField[] {
  const types: Record<OwnType, CustomFieldType> = { text: "text", textarea: "textarea", choice: "choice", multi: "multi", scale: "scale", yesno_detail: "text" };
  return added
    .filter((f) => !f.removed && !f.hidden && SECTION_IDS.has(f.section))
    .map((f) => tidy<CustomField>({ id: f.id, section: f.section, label: f.label, type: types[f.type], options: f.type === "choice" || f.type === "multi" ? f.options : undefined }));
}

/**
 * Guarda los cambios de la plantilla (el puntero) con quién y cuándo, y las preguntas propias también en el formato de
 * antes para los móviles sin actualizar. No escribe la instantánea: se escribe al usarse (`markTemplateUsed`).
 */
export async function saveTemplateDoc(db: Db, doc: TemplateDoc, by: string | null): Promise<TemplateDoc> {
  const clean = checkTemplate({ ...doc, base: BASE_VERSION, by: by ?? undefined, at: new Date().toISOString() });
  await setSetting(db, POINTER(clean.id), clean);
  if (clean.id === GENERAL) await setSetting(db, "anamnesis_custom_fields", toCustom(clean.delta.added));
  return clean;
}

/** La plantilla que se usa ahora, resuelta y con su huella. */
export async function currentTemplate(db: Db, id = GENERAL): Promise<ResolvedTemplate> {
  return withHash(resolveTemplate(await getTemplateDoc(db, id)));
}

/** Se va a usar (guardar una anamnesis, mandar un enlace): se escribe su instantánea si aún no está. */
export async function markTemplateUsed(db: Db, t: ResolvedTemplate): Promise<string> {
  const key = SNAPSHOT(t.id, t.hash);
  if (!(await getSetting(db, key))) {
    const snap = { v: 1, id: t.id, name: t.name, base: t.base, sections: t.sections, all: t.all };
    if (new TextEncoder().encode(JSON.stringify(snap)).length > LIMITS.snapshotBytes) throw new RangeError("La plantilla es demasiado grande.");
    await setSetting(db, key, snap);
  }
  return t.ref;
}

/** La instantánea de «id@huella», o null si no está (o la referencia no es válida). */
export async function getSnapshot(db: Db, ref: unknown): Promise<ResolvedTemplate | null> {
  if (typeof ref !== "string") return null;
  const m = /^([a-z0-9_]{1,40})@([0-9a-f]{12})$/.exec(ref);
  if (!m) return null;
  const snap = await getSetting<Resolved>(db, SNAPSHOT(m[1]!, m[2]!));
  return snap ? { id: snap.id, name: snap.name, base: snap.base, sections: snap.sections, all: snap.all, hash: m[2]!, ref } : null;
}

/** Todas las instantáneas guardadas (para la exportación completa). */
export async function listSnapshots(db: Db): Promise<{ key: string; value: unknown }[]> {
  const rows = await db.query<{ key: string; value: string }>("select key, value from settings where key like 'anamnesis_tpl%' order by key");
  return rows.map((r) => ({ key: r.key, value: JSON.parse(r.value) }));
}

/**
 * La pregunta tal como se hizo, para leer una respuesta que ya no está en la ficha: la de la instantánea de esa
 * anamnesis, si no la de la plantilla de ahora (aunque esté oculta o retirada) y, si no, la del tronco.
 */
export function knownField(id: string, ...from: (Resolved | null | undefined)[]): Field | undefined {
  for (const t of from) {
    const f = t?.all.find((x) => x.id === id);
    if (f) return f;
  }
  return getField(id);
}

// ---------- Utilidades para el editor ----------

/** Qué deja de funcionar si se oculta una pregunta fija (o null si no es fija). */
export const hideWarning = (id: string): string | null => FIXED[id] ?? null;
export const isFixed = (id: string) => id in FIXED;
/** Cuántos cambios tiene la plantilla sobre el tronco (preguntas cambiadas, órdenes y preguntas añadidas). */
export function changeCount(d: TemplateDelta): number {
  return Object.keys(d.fields).length + Object.keys(d.order).length + d.added.filter((f) => !f.removed).length + Object.keys(d.sections).length;
}
export const newOwnId = () => `c_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

// ---------- Operaciones del editor (puras: devuelven la plantilla cambiada) ----------

/** Una fila del editor: la pregunta como se ve ahora, si está oculta, si la clínica la cambió y si es suya. */
export type EditorItem = { field: Field; hidden: boolean; changed: boolean; own: boolean };
export type EditorSection = { id: string; title: string; items: EditorItem[]; changed: boolean };

const ownOf = (d: TemplateDelta, id: string) => d.added.find((f) => f.id === id);

/** Los apartados del editor: todas las preguntas (también las ocultas), en su orden; las propias retiradas, no. */
export function editorView(doc: TemplateDoc): EditorSection[] {
  const d = doc.delta;
  const shown: TemplateDoc = {
    ...doc,
    delta: {
      ...d,
      fields: Object.fromEntries(Object.entries(d.fields).map(([id, p]) => [id, { ...p, hidden: undefined }])),
      added: d.added.map((f) => ({ ...f, hidden: undefined })),
    },
  };
  return resolveTemplate(shown).sections.map((s) => {
    const items = s.fields.map((field): EditorItem => {
      const own = ownOf(d, field.id);
      const p = d.fields[field.id];
      return { field, own: !!own, hidden: !!(own ? own.hidden : p?.hidden), changed: !own && !!p && Object.keys(p).some((k) => k !== "hidden") };
    });
    return { id: s.id, title: s.title, items, changed: !!d.order[s.id] || !!d.sections[s.id] || items.some((i) => i.changed || (!i.own && i.hidden)) };
  });
}

const withDelta = (doc: TemplateDoc, delta: Partial<TemplateDelta>): TemplateDoc => ({ ...doc, delta: { ...doc.delta, ...delta } });
const tidyPatch = (p: FieldPatch): FieldPatch | undefined => {
  const out = tidy(p);
  return Object.keys(out).length ? out : undefined;
};

/** Mostrar u ocultar una pregunta (del tronco o propia). */
export function setHidden(doc: TemplateDoc, id: string, hidden: boolean): TemplateDoc {
  const own = ownOf(doc.delta, id);
  if (own) return withDelta(doc, { added: doc.delta.added.map((f) => (f.id === id ? tidy({ ...f, hidden: hidden || undefined }) : f)) });
  return patchField(doc, id, { hidden: hidden || undefined });
}

/** Cambiar textos o quién contesta. En una del tronco, lo que coincide con el original no se guarda como cambio. */
export function patchField(doc: TemplateDoc, id: string, change: FieldPatch & Partial<Pick<OwnField, "options" | "other" | "detail" | "sensitive">>): TemplateDoc {
  const own = ownOf(doc.delta, id);
  if (own) return withDelta(doc, { added: doc.delta.added.map((f) => (f.id === id ? tidy({ ...f, ...change }) : f)) });
  const base = getField(id);
  if (!base) return doc;
  const next: FieldPatch = { ...doc.delta.fields[id], ...change };
  const blank = (v: string | undefined) => (v?.trim() ? v : undefined);
  next.label = blank(next.label) === base.label ? undefined : blank(next.label);
  next.hint = blank(next.hint) === base.hint ? undefined : blank(next.hint);
  next.patientLabel = blank(next.patientLabel) === PATIENT_TEXT[id]?.label ? undefined : blank(next.patientLabel);
  if (next.who === (base.who ?? defaultWho(id))) next.who = undefined;
  const fields = { ...doc.delta.fields };
  const p = tidyPatch(next);
  if (p) fields[id] = p;
  else delete fields[id];
  return withDelta(doc, { fields });
}

/** Volver al original una pregunta del tronco (sus textos, quién contesta y si se ve). */
export function resetField(doc: TemplateDoc, id: string): TemplateDoc {
  const fields = { ...doc.delta.fields };
  delete fields[id];
  return withDelta(doc, { fields });
}

/** Volver al original un apartado: sus preguntas del tronco y su orden. Las propias se quedan (se quitan una a una). */
export function resetSection(doc: TemplateDoc, sectionId: string): TemplateDoc {
  const ids = new Set(ANAMNESIS.find((s) => s.id === sectionId)?.fields.map((f) => f.id) ?? []);
  const order = { ...doc.delta.order };
  delete order[sectionId];
  const sections = { ...doc.delta.sections };
  delete sections[sectionId];
  return withDelta(doc, { fields: Object.fromEntries(Object.entries(doc.delta.fields).filter(([id]) => !ids.has(id))), order, sections });
}

/** Volver a la plantilla de OmniClin: sin cambios. Las preguntas propias se retiran (no se borran: lo respondido se lee). */
export function resetAll(doc: TemplateDoc): TemplateDoc {
  return withDelta(doc, { fields: {}, order: {}, sections: {}, added: doc.delta.added.map((f) => ({ ...f, removed: true })) });
}

/** Subir (-1) o bajar (1) una pregunta dentro de su apartado. */
export function moveField(doc: TemplateDoc, sectionId: string, id: string, by: -1 | 1): TemplateDoc {
  const ids = editorView(doc).find((s) => s.id === sectionId)?.items.map((i) => i.field.id) ?? [];
  const i = ids.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= ids.length) return doc;
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  return withDelta(doc, { order: { ...doc.delta.order, [sectionId]: ids } });
}

/** Añadir una pregunta propia al final de su apartado (o detrás de `after`). */
export function addOwn(doc: TemplateDoc, f: OwnField, after?: string): TemplateDoc {
  let next = withDelta(doc, { added: [...doc.delta.added, f] });
  if (after) {
    const ids = editorView(next).find((s) => s.id === f.section)?.items.map((i) => i.field.id) ?? [];
    const rest = ids.filter((x) => x !== f.id);
    rest.splice(rest.indexOf(after) + 1, 0, f.id);
    next = withDelta(next, { order: { ...next.delta.order, [f.section]: rest } });
  }
  return next;
}

/** Retirar una pregunta propia: deja de verse, pero lo respondido se sigue leyendo con su texto. */
export function retireOwn(doc: TemplateDoc, id: string): TemplateDoc {
  return withDelta(doc, { added: doc.delta.added.map((f) => (f.id === id ? { ...f, removed: true } : f)) });
}

/** Una copia propia de una pregunta, justo debajo (las de la CIF no se copian). */
export function duplicateField(doc: TemplateDoc, sectionId: string, field: Field): TemplateDoc {
  const type: OwnType | null = field.type === "choice" || field.type === "multi" || field.type === "scale" || field.type === "textarea" || field.type === "yesno_detail" ? field.type : field.type === "cif" ? null : "text";
  if (!type) return doc;
  const copy: OwnField = tidy({
    id: newOwnId(),
    section: sectionId,
    type,
    label: `${field.label} (copia)`.slice(0, LIMITS.label),
    who: field.who ?? defaultWho(field.id),
    options: field.type === "choice" || field.type === "multi" ? [...field.options] : undefined,
    other: field.other,
    detail: field.type === "yesno_detail" ? field.detail : undefined,
    sensitive: field.sensitive,
  });
  return addOwn(doc, copy, field.id);
}

/** Los paquetes de ejemplo por especialidad como preguntas propias (las que ya estén con el mismo texto, no). */
export function addPack(doc: TemplateDoc, fields: Omit<CustomField, "id">[]): { doc: TemplateDoc; added: number } {
  const add = fields
    .filter((f) => !doc.delta.added.some((x) => !x.removed && x.section === f.section && x.label.toLowerCase() === f.label.toLowerCase()))
    .map((f): OwnField => tidy({ id: newOwnId(), section: f.section, type: f.type, label: f.label, who: "both" as Who, options: f.options }));
  return { doc: withDelta(doc, { added: [...doc.delta.added, ...add] }), added: add.length };
}
