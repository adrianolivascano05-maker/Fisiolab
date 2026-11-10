// Plantillas de anamnesis de la clínica (docs/anamnesis-adaptable.md). La clínica no copia la ficha de OmniClin (el
// tronco, src/clinical/anamnesis.ts): guarda solo sus cambios encima (ocultar, renombrar, mover, quién contesta,
// preguntas y apartados añadidos) y los módulos que lleva (src/data/anamnesisModules.ts). La ficha que se ve se
// calcula: tronco + cambios + módulos. «Volver al original» es borrar cambios, y las mejoras del tronco y de los
// módulos de OmniClin llegan solas salvo en lo que la clínica cambió.
//
// Cómo se guarda (en ajustes, que se sincronizan fila entera; sin migración de la base):
// - `anamnesis_tpl:<id>`: el puntero de cada plantilla («general» y hasta 20 más, `t_<8 hex>`), con sus cambios, sus
//   módulos, quién y cuándo (lo único que puede chocar entre dos móviles: gana el último).
// - `anamnesis_tpl_default`: la que sale por defecto (si no, «general»).
// - `anamnesis_tpl_v:<id>:<huella>`: la plantilla ya resuelta (con sus módulos), inmutable, con su huella sha256 corta.
//   Se escribe la primera vez que se usa (al guardar una anamnesis, abrir un motivo o mandar un enlace).
// - Cada anamnesis apunta a la suya: `answers.__tpl = "<id>@<huella>"`. Así, años después, cada respuesta se lee con la
//   pregunta tal como se hizo (Ley 41/2002, art. 15), y un motivo conserva su plantilla aunque se archive.
// Un móvil sin actualizar (fase 1) ve la plantilla «General» sin los módulos, enseña como texto los tipos que no
// conoce y no borra nada.
import { ANAMNESIS, BASE_VERSION, CORE, FIXED, MAX_REQUIRED, PATIENT_TEXT, TRUNK_SINCE, conditionTarget, conditionValues, defaultWho, forPatient, getField, type Field, type Section, type Who } from "../clinical/anamnesis";
import {
  bool,
  checkOwnField,
  ID,
  LIMITS,
  newOwnId,
  newSectionId,
  OWN_TYPES,
  ownToField,
  PHASE1_TYPES,
  text,
  tidy,
  who,
  type OwnField,
  type OwnType,
} from "./anamnesisFields";
import { blankModule, checkProposals, listModuleDocs, markModuleUsed, resolveModule, type ModuleDoc, type ResolvedModule } from "./anamnesisModules";
import { getCustomFields, type CustomField, type CustomFieldType } from "./customFields";
import type { Db } from "./db";
import { MODULE_SELF } from "./modulesLibrary";
import { getSetting, setSetting } from "./settings";

export { LIMITS, newOwnId, newSectionId, OWN_TYPES, type OwnField, type OwnType };

/** La plantilla de siempre (la de la fase 1). */
export const GENERAL = "general";
const POINTER = (id: string) => `anamnesis_tpl:${id}`;
const SNAPSHOT = (id: string, hash: string) => `anamnesis_tpl_v:${id}:${hash}`;
const DEFAULT_KEY = "anamnesis_tpl_default";
export const isTemplateKey = (key: string) => key.startsWith("anamnesis_tpl:") || key.startsWith("anamnesis_tpl_v:");
export const newTemplateId = () => `t_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

// ---------- Tipos ----------

/** Cuestionarios libres de la app y mediciones que se proponen al abrir un motivo con la plantilla. */
export type Proposals = { questionnaires: string[]; measures: string[] };
/** Cambios de la clínica sobre una pregunta del tronco: texto, texto para el paciente, ayuda, quién contesta, oculta,
 *  otro apartado y obligatoria para el paciente. */
export type FieldPatch = {
  label?: string;
  patientLabel?: string;
  hint?: string;
  who?: Who;
  hidden?: boolean;
  section?: string;
  required?: boolean;
  /** En la anamnesis base o solo en la ampliada, si la clínica lo cambia (si no, lo que dice `CORE`). */
  level?: Level;
};
/** Dónde sale una pregunta: en la base (y en la ampliada) o solo en la ampliada. */
export type Level = "base" | "extra";
/** Dónde sale una pregunta del tronco si la clínica no dice otra cosa. */
export const defaultLevel = (id: string): Level => (CORE.has(id) ? "base" : "extra");
/** Un apartado cambiado, o uno nuevo de la clínica (`s_<8 hex>`); retirado si ya no se usa. */
export type SectionPatch = { title?: string; hidden?: boolean; removed?: boolean };
/** Un módulo en la plantilla y las preguntas suyas que esta plantilla oculta. */
export type TemplateModule = { id: string; hidden?: string[] };
export type TemplateDelta = {
  fields: Record<string, FieldPatch>;
  /** Orden de cada apartado: ids en el orden que quiere la clínica (lo que no esté, detrás, en su orden). */
  order: Record<string, string[]>;
  added: OwnField[];
  sections: Record<string, SectionPatch>;
  modules: TemplateModule[];
  /** Orden de los apartados (los que no estén, en su sitio de siempre). */
  sectionOrder?: string[];
  /** Lo que propone al abrir un motivo, si la clínica lo cambia (si no, lo de sus módulos). */
  propose?: Proposals;
};
/** El puntero: la plantilla con sus cambios, quién la cambió por última vez y cuándo. `base`: la versión del tronco
 *  cuyas novedades ya vio la clínica. */
export type TemplateDoc = { v: 1; id: string; name: string; base: number; delta: TemplateDelta; by?: string; at?: string; archived?: boolean };
/** La plantilla resuelta: los apartados con sus preguntas visibles y todas las preguntas que conoce (también ocultas y
 *  retiradas, para leer lo ya respondido); y, si lleva módulos, cuáles. */
export type Resolved = {
  id: string;
  name: string;
  base: number;
  sections: Section[];
  all: Field[];
  modules?: { id: string; name: string; version: number }[];
  /** Algún módulo lo contesta un familiar o tutor: el formulario pregunta al principio quién contesta. */
  guardian?: boolean;
  propose?: Proposals;
};
export type ResolvedTemplate = Resolved & { hash: string; ref: string };

export const emptyDelta = (): TemplateDelta => ({ fields: {}, order: {}, added: [], sections: {}, modules: [] });

// ---------- Comprobar ----------

const BASE_IDS = new Set(ANAMNESIS.flatMap((s) => s.fields.map((f) => f.id)));
const SECTION_IDS = new Set(ANAMNESIS.map((s) => s.id));
const NEW_SECTION = /^s_[0-9a-f]{8}$/;
const TEMPLATE_ID = /^(general|t_[0-9a-f]{8})$/;
const MODULE_ID = /^(m_[a-z0-9_]{1,30}|md_[0-9a-f]{8})$/;
/** Apartados donde puede ir una pregunta de la plantilla: los del tronco y los nuevos de la clínica. */
const sectionOk = (sid: string) => SECTION_IDS.has(sid) || NEW_SECTION.test(sid);

/**
 * Comprueba y limpia una plantilla antes de guardarla: límites, ids, textos, opciones, fijas, condiciones y módulos.
 * Las claves que no conoce se quitan. Las etiquetas son texto: nunca se interpretan como HTML ni markdown.
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
      section: typeof p.section === "string" && sectionOk(p.section) && ANAMNESIS.find((s) => s.fields.some((f) => f.id === id))?.id !== p.section ? p.section : undefined,
      // Las delicadas (tóxicos, sueño, estrés) y la CIF nunca son obligatorias.
      required: q.sensitive || q.type === "cif" ? undefined : bool(p.required),
      level: (p.level === "base" || p.level === "extra") && p.level !== defaultLevel(id) ? p.level : undefined,
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
    added.push(checkOwnField(f, (s) => ID.test(s)));
  }
  const order: Record<string, string[]> = {};
  const known = new Set([...BASE_IDS, ...seen]);
  const modules: TemplateModule[] = [];
  for (const m of Array.isArray(d.modules) ? d.modules : []) {
    if (!m || typeof m !== "object" || typeof (m as TemplateModule).id !== "string") continue;
    const tm = m as TemplateModule;
    if (!MODULE_ID.test(tm.id) || modules.some((x) => x.id === tm.id)) continue;
    const hidden = Array.isArray(tm.hidden) ? [...new Set(tm.hidden.filter((x) => typeof x === "string" && ID.test(x)))] : [];
    modules.push(hidden.length ? { id: tm.id, hidden } : { id: tm.id });
  }
  for (const [sid, ids] of Object.entries(d.order ?? {})) {
    if (!ID.test(sid) || !Array.isArray(ids)) continue;
    // Las preguntas de los módulos también se ordenan aquí (sus ids no los conoce la plantilla).
    const list = [...new Set(ids.filter((x) => typeof x === "string" && (known.has(x) || (modules.length > 0 && ID.test(x)))))];
    if (list.length) order[sid] = list;
  }
  const sections: Record<string, SectionPatch> = {};
  for (const [sid, p] of Object.entries(d.sections ?? {})) {
    if (!ID.test(sid) || typeof p !== "object" || p === null) continue;
    const patch = tidy<SectionPatch>({ title: text(p.title, LIMITS.label, "Apartado"), hidden: bool(p.hidden), removed: NEW_SECTION.test(sid) ? bool(p.removed) : undefined });
    if (NEW_SECTION.test(sid) && !patch.title && !patch.removed) throw new RangeError("Un apartado nuevo necesita un nombre.");
    if (Object.keys(patch).length) sections[sid] = patch;
  }
  const sectionOrder = Array.isArray(d.sectionOrder) ? [...new Set(d.sectionOrder.filter((x) => typeof x === "string" && ID.test(x)))] : [];
  // Una condición solo sobre una pregunta que exista (que vaya antes en el mismo apartado se comprueba al resolver).
  for (const f of added) if (f.showIf && !known.has(f.showIf.field) && !modules.length) throw new RangeError(`La condición de «${f.label}» depende de una pregunta que no existe.`);
  const required = Object.values(fields).filter((p) => p.required).length + added.filter((f) => f.required && !f.removed && !f.hidden).length;
  if (required > MAX_REQUIRED) throw new RangeError(`Como mucho ${MAX_REQUIRED} preguntas obligatorias por plantilla.`);
  const propose = checkProposals(d.propose);
  const out: TemplateDoc = tidy({
    v: 1 as const,
    id: doc.id,
    name,
    base: Number.isInteger(doc.base) ? doc.base : BASE_VERSION,
    delta: tidy({ fields, order, added, sections, modules, sectionOrder: sectionOrder.length ? sectionOrder : undefined, propose }),
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

// ---------- Resolver: tronco + cambios + módulos ----------

/** Una pregunta candidata: la pregunta, en qué apartado va, si está oculta y de dónde sale. */
type Item = { field: Field; section: string; hidden: boolean; home: string };

/** El orden de los apartados por defecto: los del tronco hasta «Hábitos», los nuevos y los de módulos, y el resto. */
function defaultSectionOrder(extra: string[]): string[] {
  const at = ANAMNESIS.findIndex((s) => s.id === "exploracion");
  const ids = ANAMNESIS.map((s) => s.id);
  return [...ids.slice(0, at), ...extra, ...ids.slice(at)];
}
/** Aplica el orden que guardó la clínica: los que están en él, en su orden; los demás, en su sitio. */
function applyOrder(ids: string[], wanted: string[] | undefined): string[] {
  if (!wanted?.length) return ids;
  const listed = ids.filter((x) => wanted.includes(x)).sort((a, b) => wanted.indexOf(a) - wanted.indexOf(b));
  let k = 0;
  return ids.map((x) => (wanted.includes(x) ? listed[k++]! : x));
}

const memo = new Map<string, Resolved>();

/**
 * La ficha que se ve: tronco + cambios de la clínica + sus módulos (`mods`: los módulos de la clínica; los de OmniClin
 * que no tengan puntero se leen tal cual). Memoizado. Sin módulos ni apartados nuevos, igual que en la fase 1 (la
 * misma huella).
 */
export function resolveTemplate(doc: TemplateDoc, mods: ModuleDoc[] = []): Resolved {
  const d = doc.delta;
  const used = (d.modules ?? []).map((m) => mods.find((x) => x.id === m.id) ?? null);
  const key = JSON.stringify([d, doc.id, doc.name, doc.base, used]);
  const hit = memo.get(key);
  if (hit) return hit;
  const items: Item[] = [];
  const all: Field[] = [];
  // El tronco, apartado por apartado, con sus preguntas propias detrás (el orden de la fase 1).
  for (const s of ANAMNESIS) {
    for (const f of s.fields) {
      const p = d.fields[f.id] ?? {};
      const t = PATIENT_TEXT[f.id];
      const field = tidy({
        ...f,
        label: p.label ?? f.label,
        hint: p.hint ?? f.hint,
        patientLabel: p.patientLabel ?? t?.label,
        patientHint: t?.hint,
        who: p.who ?? f.who ?? defaultWho(f.id),
        required: p.required,
        extra: (p.level ?? defaultLevel(f.id)) === "extra" || undefined,
      }) as Field;
      items.push({ field, section: p.section ?? s.id, hidden: !!p.hidden, home: s.id });
      all.push(field);
    }
    for (const f of d.added.filter((x) => x.section === s.id)) {
      const field = ownToField(f);
      items.push({ field, section: f.section, hidden: !!(f.hidden || f.removed), home: f.section });
      all.push(field);
    }
  }
  for (const f of d.added.filter((x) => !SECTION_IDS.has(x.section))) {
    const field = ownToField(f);
    items.push({ field, section: f.section, hidden: !!(f.hidden || f.removed), home: f.section });
    all.push(field);
  }
  // Los módulos: sus preguntas en su apartado propio (id = el del módulo) o en los del tronco.
  const resolvedMods: ResolvedModule[] = [];
  (d.modules ?? []).forEach((tm, i) => {
    const rm = resolveModule(tm.id, used[i]);
    if (!rm) return;
    resolvedMods.push(rm);
    for (const it of rm.items) {
      const section = it.section === MODULE_SELF ? rm.id : it.section;
      items.push({ field: it.field, section, hidden: it.removed || !!tm.hidden?.includes(it.field.id), home: section });
      all.push(it.field);
    }
  });
  // Los apartados: los del tronco, los nuevos de la clínica y los propios de los módulos.
  const newSections = Object.keys(d.sections).filter((sid) => NEW_SECTION.test(sid) && !d.sections[sid]!.removed);
  // Un módulo de la clínica tiene siempre su apartado (aunque aún esté vacío, para añadirle preguntas); uno de OmniClin,
  // si alguna de sus preguntas va en él.
  const modSections = resolvedMods.filter((m) => !m.lib || m.items.some((it) => it.section === MODULE_SELF)).map((m) => m.id);
  const titles = new Map<string, { title: string; module?: string }>([
    ...ANAMNESIS.map((s) => [s.id, { title: d.sections[s.id]?.title ?? s.title }] as const),
    ...newSections.map((sid) => [sid, { title: d.sections[sid]!.title ?? "Apartado" }] as const),
    ...resolvedMods.map((m) => [m.id, { title: d.sections[m.id]?.title ?? m.title, module: m.id }] as const),
  ]);
  const order = applyOrder(defaultSectionOrder([...newSections, ...modSections]), d.sectionOrder);
  const exists = new Set(order);
  const sections: Section[] = [];
  let required = 0;
  for (const sid of order) {
    if (d.sections[sid]?.hidden) continue;
    // Una pregunta movida a un apartado que ya no está vuelve al suyo.
    const here = items.filter((it) => (exists.has(it.section) ? it.section : it.home) === sid);
    const wanted = d.order[sid] ?? [];
    const pos = (id: string) => {
      const i = wanted.indexOf(id);
      return i === -1 ? wanted.length + here.findIndex((it) => it.field.id === id) : i;
    };
    const visible = here
      .filter((it) => !it.hidden)
      .map((it) => it.field)
      .sort((x, y) => pos(x.id) - pos(y.id));
    // Condiciones solo sobre una pregunta anterior del mismo apartado que se vea, de Sí/No u opción única; si no, la
    // pregunta se ve siempre. Obligatorias, como mucho 5 (y nunca las delicadas).
    const fields = visible.map((f, i) => {
      let out = f;
      if (f.showIf) {
        const target = visible.slice(0, i).find((x) => x.id === f.showIf!.field);
        const values = target ? conditionValues(target) : [];
        const ok = !!target && conditionTarget(target) && (Array.isArray(f.showIf.value) ? f.showIf.value : [f.showIf.value]).every((v) => values.includes(v));
        if (!ok) out = tidy({ ...out, showIf: undefined }) as Field;
      }
      if (out.required) {
        if (out.sensitive || !forPatient(out) || required >= MAX_REQUIRED) out = tidy({ ...out, required: undefined }) as Field;
        else required++;
      }
      return out;
    });
    const t = titles.get(sid)!;
    if (!SECTION_IDS.has(sid) && !fields.length && !t.module && !NEW_SECTION.test(sid)) continue;
    sections.push({ id: sid, title: t.title, fields, ...(t.module ? { module: t.module } : {}) });
  }
  const propose = d.propose ?? mergeProposals(resolvedMods.map((m) => m.propose));
  const out: Resolved = tidy({
    id: doc.id,
    name: doc.name,
    base: doc.base,
    sections,
    all,
    modules: resolvedMods.length ? resolvedMods.map((m) => ({ id: m.id, name: m.name, version: m.version })) : undefined,
    guardian: resolvedMods.some((m) => m.guardian && m.items.some((it) => !it.removed && forPatient(it.field))) || undefined,
    propose,
  });
  // Cada toque del editor es una plantilla distinta: se guardan solo las últimas.
  if (memo.size > 50) memo.clear();
  memo.set(key, out);
  return out;
}

const mergeProposals = (list: (Proposals | undefined)[]): Proposals | undefined => {
  const q = [...new Set(list.flatMap((p) => p?.questionnaires ?? []))];
  const m = [...new Set(list.flatMap((p) => p?.measures ?? []))];
  return q.length || m.length ? { questionnaires: q, measures: m } : undefined;
};

/** La huella de una plantilla resuelta: sha256 de su JSON, 12 primeras cifras hexadecimales. */
export async function templateHash(r: Resolved): Promise<string> {
  const body = { id: r.id, name: r.name, base: r.base, sections: r.sections, all: r.all, ...(r.modules ? { modules: r.modules } : {}), ...(r.guardian ? { guardian: true } : {}) };
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(body))));
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

/** La plantilla con sus cambios. Sin puntero todavía: «General» es el tronco con las preguntas propias de antes. */
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
  return { v: 1, id, name: "General", base: BASE_VERSION, delta: { ...emptyDelta(), added: id === GENERAL ? fromCustom(await getCustomFields(db)) : [] } };
}

/** Todas las plantillas de la clínica («General» primero, aunque aún no tenga puntero; luego por nombre). */
export async function listTemplates(db: Db): Promise<TemplateDoc[]> {
  const rows = await db.query<{ value: string }>("select value from settings where key like 'anamnesis\\_tpl:%' escape '\\'");
  const docs: TemplateDoc[] = [];
  for (const r of rows) {
    const raw = JSON.parse(r.value) as TemplateDoc;
    if (!raw?.id || !TEMPLATE_ID.test(raw.id)) continue;
    try {
      docs.push(checkTemplate(raw));
    } catch {
      docs.push({ ...raw, delta: { ...emptyDelta(), ...raw.delta } });
    }
  }
  if (!docs.some((x) => x.id === GENERAL)) docs.push(await getTemplateDoc(db, GENERAL));
  return docs.sort((a, b) => (a.id === GENERAL ? -1 : b.id === GENERAL ? 1 : a.name.localeCompare(b.name, "es")));
}

/** La que sale por defecto (si se archivó o no está, «General»). */
export async function getDefaultTemplateId(db: Db): Promise<string> {
  const id = await getSetting<string>(db, DEFAULT_KEY);
  if (typeof id !== "string" || id === GENERAL) return GENERAL;
  const doc = await getSetting<TemplateDoc>(db, POINTER(id));
  return doc && !doc.archived ? id : GENERAL;
}
export async function setDefaultTemplate(db: Db, id: string): Promise<void> {
  await setSetting(db, DEFAULT_KEY, id);
}

/** Las preguntas propias en el formato de antes, para los móviles sin actualizar (doble escritura). */
export function toCustom(added: OwnField[]): CustomField[] {
  const types: Partial<Record<OwnType, CustomFieldType>> = { text: "text", textarea: "textarea", choice: "choice", multi: "multi", scale: "scale" };
  return added
    .filter((f) => !f.removed && !f.hidden && SECTION_IDS.has(f.section))
    .map((f) => tidy<CustomField>({ id: f.id, section: f.section, label: f.label, type: types[f.type] ?? "text", options: f.type === "choice" || f.type === "multi" ? f.options : undefined }));
}

/**
 * Guarda los cambios de la plantilla (el puntero) con quién y cuándo y, en «General», las preguntas propias también en
 * el formato de antes para los móviles sin actualizar. No escribe la instantánea: se escribe al usarse.
 */
export async function saveTemplateDoc(db: Db, doc: TemplateDoc, by: string | null): Promise<TemplateDoc> {
  const clean = checkTemplate({ ...doc, by: by ?? undefined, at: new Date().toISOString() });
  await setSetting(db, POINTER(clean.id), clean);
  if (clean.id === GENERAL) await setSetting(db, "anamnesis_custom_fields", toCustom(clean.delta.added.filter((f) => PHASE1_TYPES.includes(f.type))));
  return clean;
}

/** Una plantilla resuelta con sus módulos y su huella. */
export async function resolvedTemplate(db: Db, doc: TemplateDoc, mods?: ModuleDoc[]): Promise<ResolvedTemplate> {
  return withHash(resolveTemplate(doc, mods ?? (doc.delta.modules.length ? await listModuleDocs(db) : [])));
}

/** La plantilla que se usa ahora (la indicada o la de por defecto), resuelta y con su huella. */
export async function currentTemplate(db: Db, id?: string): Promise<ResolvedTemplate> {
  return resolvedTemplate(db, await getTemplateDoc(db, id ?? (await getDefaultTemplateId(db))));
}

/** El id de la plantilla de una anamnesis («id@huella»), o null. */
export const templateIdOf = (ref: unknown): string | null => (typeof ref === "string" ? (/^([a-z0-9_]{1,40})@[0-9a-f]{12}$/.exec(ref)?.[1] ?? null) : null);

/**
 * La plantilla con la que se ve y se edita una anamnesis: la suya (`__tpl`), tal como está ahora aunque esté
 * archivada; si este móvil aún no la tiene, su instantánea; sin `__tpl`, la de por defecto.
 */
export async function templateFor(db: Db, ref: unknown): Promise<ResolvedTemplate> {
  const id = templateIdOf(ref);
  if (id && (id === GENERAL || (await getSetting(db, POINTER(id))))) return currentTemplate(db, id);
  if (id) {
    const snap = await getSnapshot(db, ref);
    if (snap) return snap;
  }
  return currentTemplate(db);
}

/** Se va a usar (guardar una anamnesis, abrir un motivo, mandar un enlace): se escribe su instantánea si aún no está. */
export async function markTemplateUsed(db: Db, t: ResolvedTemplate): Promise<string> {
  const key = SNAPSHOT(t.id, t.hash);
  if (!(await getSetting(db, key))) {
    const snap = tidy({ v: 1, id: t.id, name: t.name, base: t.base, sections: t.sections, all: t.all, modules: t.modules, guardian: t.guardian, propose: t.propose });
    if (new TextEncoder().encode(JSON.stringify(snap)).length > LIMITS.snapshotBytes) throw new RangeError("La plantilla es demasiado grande.");
    await setSetting(db, key, snap);
    // Y la de cada módulo que lleva (la de la plantilla ya los lleva resueltos: esto es para el módulo suelto).
    if (t.modules?.length) {
      const mods = await listModuleDocs(db);
      for (const m of t.modules) {
        const rm = resolveModule(m.id, mods.find((x) => x.id === m.id));
        if (rm) await markModuleUsed(db, rm);
      }
    }
  }
  return t.ref;
}

/** La instantánea de «id@huella», o null si no está (o la referencia no es válida). */
export async function getSnapshot(db: Db, ref: unknown): Promise<ResolvedTemplate | null> {
  if (typeof ref !== "string") return null;
  const m = /^([a-z0-9_]{1,40})@([0-9a-f]{12})$/.exec(ref);
  if (!m) return null;
  const snap = await getSetting<Resolved>(db, SNAPSHOT(m[1]!, m[2]!));
  return snap ? tidy({ id: snap.id, name: snap.name, base: snap.base, sections: snap.sections, all: snap.all, modules: snap.modules, guardian: snap.guardian, propose: snap.propose, hash: m[2]!, ref }) : null;
}

/** Todas las instantáneas y punteros de plantillas y módulos (para la exportación completa). */
export async function listSnapshots(db: Db): Promise<{ key: string; value: unknown }[]> {
  const rows = await db.query<{ key: string; value: string }>("select key, value from settings where key like 'anamnesis\\_tpl%' escape '\\' or key like 'anamnesis\\_mod%' escape '\\' order by key");
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

// ---------- Plantillas: crear, duplicar, renombrar, archivar ----------

/** Plantillas en uso (sin archivar) que puede tener una clínica. */
export async function activeTemplateCount(db: Db): Promise<number> {
  return (await listTemplates(db)).filter((t) => !t.archived).length;
}

/**
 * Una plantilla nueva: el tronco con los cambios de la que sale por defecto (lo que la clínica ya ajustó) y los módulos
 * elegidos; las preguntas del tronco que esos módulos ocultan, ocultas (se pueden volver a encender).
 */
export async function createTemplate(db: Db, name: string, moduleIds: string[], by: string | null): Promise<TemplateDoc> {
  if ((await activeTemplateCount(db)) >= LIMITS.templates) throw new RangeError(`Como mucho ${LIMITS.templates} plantillas.`);
  const from = await getTemplateDoc(db, await getDefaultTemplateId(db));
  let doc: TemplateDoc = { v: 1, id: newTemplateId(), name: name.trim(), base: from.base, delta: { ...structuredClone(from.delta), modules: [] } };
  const mods = await listModuleDocs(db);
  for (const id of moduleIds) doc = addModule(doc, id, mods);
  return saveTemplateDoc(db, doc, by);
}

/** Una copia entera con otro nombre. */
export async function duplicateTemplate(db: Db, id: string, by: string | null): Promise<TemplateDoc> {
  if ((await activeTemplateCount(db)) >= LIMITS.templates) throw new RangeError(`Como mucho ${LIMITS.templates} plantillas.`);
  const src = await getTemplateDoc(db, id);
  return saveTemplateDoc(db, { ...structuredClone(src), id: newTemplateId(), name: `${src.name} (copia)`.slice(0, LIMITS.label), archived: undefined }, by);
}

export async function renameTemplate(db: Db, id: string, name: string, by: string | null): Promise<TemplateDoc> {
  const src = await getTemplateDoc(db, id);
  return saveTemplateDoc(db, { ...src, name }, by);
}

/** Archivar (o volver a usar): deja de salir al abrir un motivo; los motivos que la usan la conservan. */
export async function archiveTemplate(db: Db, id: string, archived: boolean, by: string | null): Promise<TemplateDoc> {
  if (archived && (id === GENERAL || id === (await getDefaultTemplateId(db)))) throw new RangeError("La plantilla por defecto no se archiva: elige antes otra por defecto.");
  if (!archived && (await activeTemplateCount(db)) >= LIMITS.templates) throw new RangeError(`Como mucho ${LIMITS.templates} plantillas.`);
  const src = await getTemplateDoc(db, id);
  return saveTemplateDoc(db, { ...src, archived: archived || undefined }, by);
}

// ---------- Utilidades para el editor ----------

/** Qué deja de funcionar si se oculta una pregunta fija (o null si no es fija). */
export const hideWarning = (id: string): string | null => FIXED[id] ?? null;
export const isFixed = (id: string) => id in FIXED;
/** Cuántos cambios tiene la plantilla sobre el tronco (preguntas cambiadas, órdenes, preguntas y apartados añadidos). */
export function changeCount(d: TemplateDelta): number {
  return Object.keys(d.fields).length + Object.keys(d.order).length + d.added.filter((f) => !f.removed).length + Object.keys(d.sections).length;
}

/** Novedades del tronco que la clínica aún no ha visto (preguntas de OmniClin más nuevas que `base`). */
export const trunkNews = (doc: TemplateDoc): string[] => Object.entries(TRUNK_SINCE).filter(([, v]) => v > doc.base).map(([id]) => id);

// ---------- Operaciones del editor (puras: devuelven la plantilla cambiada) ----------

/** Una fila del editor: la pregunta como se ve ahora, si está oculta, si la clínica la cambió, si es suya y de qué
 *  módulo viene. */
export type EditorItem = { field: Field; hidden: boolean; changed: boolean; own: boolean; module?: string };
export type EditorSection = { id: string; title: string; items: EditorItem[]; changed: boolean; module?: string; added?: boolean };

const ownOf = (d: TemplateDelta, id: string) => d.added.find((f) => f.id === id);

/** Los apartados del editor: todas las preguntas (también las ocultas), en su orden; las retiradas, no. */
export function editorView(doc: TemplateDoc, mods: ModuleDoc[] = []): EditorSection[] {
  const d = doc.delta;
  const shown: TemplateDoc = {
    ...doc,
    delta: {
      ...d,
      fields: Object.fromEntries(Object.entries(d.fields).map(([id, p]) => [id, { ...p, hidden: undefined }])),
      added: d.added.map((f) => ({ ...f, hidden: undefined })),
      modules: d.modules.map((m) => ({ id: m.id })),
      sections: Object.fromEntries(Object.entries(d.sections).map(([id, p]) => [id, { ...p, hidden: undefined }])),
    },
  };
  const resolved = resolveTemplate(shown, mods);
  const modChanged = new Map<string, Set<string>>();
  for (const tm of d.modules) {
    const rm = resolveModule(tm.id, mods.find((m) => m.id === tm.id));
    if (rm) modChanged.set(tm.id, new Set(rm.items.filter((it) => it.changed).map((it) => it.field.id)));
  }
  return resolved.sections.map((s) => {
    const items = s.fields.map((field): EditorItem => {
      if (field.module) {
        const tm = d.modules.find((m) => m.id === field.module);
        return { field, own: false, module: field.module, hidden: !!tm?.hidden?.includes(field.id), changed: !!modChanged.get(field.module)?.has(field.id) };
      }
      const own = ownOf(d, field.id);
      const p = d.fields[field.id];
      return { field, own: !!own, hidden: !!(own ? own.hidden : p?.hidden), changed: !own && !!p && Object.keys(p).some((k) => k !== "hidden") };
    });
    return tidy({
      id: s.id,
      title: s.title,
      items,
      module: s.module,
      added: NEW_SECTION.test(s.id) || undefined,
      changed: !!d.order[s.id] || !!d.sections[s.id] || items.some((i) => i.changed || (!i.own && !i.module && i.hidden)),
    });
  });
}

const withDelta = (doc: TemplateDoc, delta: Partial<TemplateDelta>): TemplateDoc => ({ ...doc, delta: { ...doc.delta, ...delta } });
const tidyPatch = (p: FieldPatch): FieldPatch | undefined => {
  const out = tidy(p);
  return Object.keys(out).length ? out : undefined;
};

/** Mostrar u ocultar una pregunta (del tronco, propia o, con `module`, de un módulo en esta plantilla). */
export function setHidden(doc: TemplateDoc, id: string, hidden: boolean, module?: string): TemplateDoc {
  if (module) {
    return withDelta(doc, {
      modules: doc.delta.modules.map((m) => {
        if (m.id !== module) return m;
        const list = new Set(m.hidden ?? []);
        if (hidden) list.add(id);
        else list.delete(id);
        return list.size ? { id: m.id, hidden: [...list] } : { id: m.id };
      }),
    });
  }
  const own = ownOf(doc.delta, id);
  if (own) return withDelta(doc, { added: doc.delta.added.map((f) => (f.id === id ? tidy({ ...f, hidden: hidden || undefined }) : f)) });
  return patchField(doc, id, { hidden: hidden || undefined });
}

/** Cambiar textos, quién contesta, apartado u obligatoria. En una del tronco, lo igual que el original no es cambio. */
export function patchField(doc: TemplateDoc, id: string, change: FieldPatch & Partial<Pick<OwnField, "options" | "other" | "detail" | "sensitive" | "unit" | "highlight" | "showIf">>): TemplateDoc {
  const own = ownOf(doc.delta, id);
  if (own) {
    // En una propia, dónde sale se guarda como `extra` (en la base si no se dice).
    const { level, ...rest } = change;
    return withDelta(doc, { added: doc.delta.added.map((f) => (f.id === id ? tidy({ ...f, ...rest, ...(level ? { extra: level === "extra" || undefined } : {}) }) : f)) });
  }
  const base = getField(id);
  if (!base) return doc;
  const next: FieldPatch = { ...doc.delta.fields[id], ...change };
  const blank = (v: string | undefined) => (v?.trim() ? v : undefined);
  next.label = blank(next.label) === base.label ? undefined : blank(next.label);
  next.hint = blank(next.hint) === base.hint ? undefined : blank(next.hint);
  next.patientLabel = blank(next.patientLabel) === PATIENT_TEXT[id]?.label ? undefined : blank(next.patientLabel);
  if (next.who === (base.who ?? defaultWho(id))) next.who = undefined;
  if (next.section === ANAMNESIS.find((s) => s.fields.some((f) => f.id === id))?.id) next.section = undefined;
  if (!next.required) next.required = undefined;
  if (next.level === defaultLevel(id)) next.level = undefined;
  const fields = { ...doc.delta.fields };
  const p = tidyPatch(tidy({ label: next.label, patientLabel: next.patientLabel, hint: next.hint, who: next.who, hidden: next.hidden, section: next.section, required: next.required, level: next.level }));
  if (p) fields[id] = p;
  else delete fields[id];
  return withDelta(doc, { fields });
}

/** Volver al original una pregunta del tronco (sus textos, quién contesta, si se ve y su apartado). */
export function resetField(doc: TemplateDoc, id: string): TemplateDoc {
  const fields = { ...doc.delta.fields };
  delete fields[id];
  return withDelta(doc, { fields });
}

/** Volver al original un apartado del tronco: sus preguntas del tronco, su nombre y su orden. Las propias se quedan. */
export function resetSection(doc: TemplateDoc, sectionId: string): TemplateDoc {
  const ids = new Set(ANAMNESIS.find((s) => s.id === sectionId)?.fields.map((f) => f.id) ?? []);
  const order = { ...doc.delta.order };
  delete order[sectionId];
  const sections = { ...doc.delta.sections };
  delete sections[sectionId];
  return withDelta(doc, { fields: Object.fromEntries(Object.entries(doc.delta.fields).filter(([id]) => !ids.has(id))), order, sections });
}

/** Volver a la plantilla de OmniClin: sin cambios. Las preguntas propias se retiran (no se borran: lo respondido se
 *  lee); los apartados nuevos, también. Los módulos se quedan (se quitan uno a uno). */
export function resetAll(doc: TemplateDoc): TemplateDoc {
  const sections = Object.fromEntries(Object.keys(doc.delta.sections).filter((sid) => NEW_SECTION.test(sid)).map((sid) => [sid, { ...doc.delta.sections[sid], removed: true }]));
  return withDelta(doc, { fields: {}, order: {}, sections, sectionOrder: undefined, added: doc.delta.added.map((f) => ({ ...f, removed: true })), modules: doc.delta.modules.map((m) => ({ id: m.id })) });
}

/** Subir (-1) o bajar (1) una pregunta dentro de su apartado. */
export function moveField(doc: TemplateDoc, sectionId: string, id: string, by: -1 | 1, mods: ModuleDoc[] = []): TemplateDoc {
  const ids = editorView(doc, mods).find((s) => s.id === sectionId)?.items.map((i) => i.field.id) ?? [];
  const i = ids.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= ids.length) return doc;
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  return withDelta(doc, { order: { ...doc.delta.order, [sectionId]: ids } });
}

/** Subir (-1) o bajar (1) un apartado. */
export function moveSection(doc: TemplateDoc, sectionId: string, by: -1 | 1, mods: ModuleDoc[] = []): TemplateDoc {
  const ids = editorView(doc, mods).map((s) => s.id);
  const i = ids.indexOf(sectionId);
  const j = i + by;
  if (i < 0 || j < 0 || j >= ids.length) return doc;
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  return withDelta(doc, { sectionOrder: ids });
}

/** Un apartado nuevo de la clínica (detrás de «Hábitos», o donde se mueva). */
export function addSection(doc: TemplateDoc, title: string, id = newSectionId()): TemplateDoc {
  return withDelta(doc, { sections: { ...doc.delta.sections, [id]: { title: title.trim() } } });
}
/** Cambiar el nombre de un apartado (del tronco, nuevo o de un módulo, solo en esta plantilla). */
export function renameSection(doc: TemplateDoc, sectionId: string, title: string): TemplateDoc {
  const sections = { ...doc.delta.sections };
  const t = title.trim();
  const original = ANAMNESIS.find((s) => s.id === sectionId)?.title;
  const p = tidy({ ...sections[sectionId], title: t && t !== original ? t : NEW_SECTION.test(sectionId) ? t || "Apartado" : undefined });
  if (Object.keys(p).length) sections[sectionId] = p;
  else delete sections[sectionId];
  return withDelta(doc, { sections });
}
/** Retirar un apartado nuevo (solo vacío: sus preguntas se mueven o se quitan antes). */
export function removeSection(doc: TemplateDoc, sectionId: string): TemplateDoc {
  if (!NEW_SECTION.test(sectionId)) return doc;
  return withDelta(doc, { sections: { ...doc.delta.sections, [sectionId]: { ...doc.delta.sections[sectionId], removed: true } } });
}

/** Añadir una pregunta propia al final de su apartado (o detrás de `after`). */
export function addOwn(doc: TemplateDoc, f: OwnField, after?: string, mods: ModuleDoc[] = []): TemplateDoc {
  let next = withDelta(doc, { added: [...doc.delta.added, f] });
  if (after) {
    const ids = editorView(next, mods).find((s) => s.id === f.section)?.items.map((i) => i.field.id) ?? [];
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

/** La pregunta como pregunta propia nueva (para duplicar o copiar): los tipos que no se copian (CIF), null. */
export function asOwn(field: Field, sectionId: string, id = newOwnId()): OwnField | null {
  if (field.type === "cif") return null;
  const type: OwnType = (OWN_TYPES as string[]).includes(field.type) ? (field.type as OwnType) : "text";
  return tidy({
    id,
    section: sectionId,
    type,
    label: field.label.slice(0, LIMITS.label),
    who: field.who ?? defaultWho(field.id),
    options: field.type === "choice" || field.type === "multi" ? [...field.options] : undefined,
    other: field.other,
    detail: field.type === "yesno_detail" ? field.detail : undefined,
    unit: field.type === "number" && field.unit ? field.unit : undefined,
    sensitive: field.sensitive,
    extra: field.extra || undefined,
  });
}

/** Una copia propia de una pregunta, justo debajo (las de la CIF no se copian). */
export function duplicateField(doc: TemplateDoc, sectionId: string, field: Field, mods: ModuleDoc[] = []): TemplateDoc {
  const copy = asOwn(field, sectionId);
  if (!copy) return doc;
  return addOwn(doc, { ...copy, label: `${field.label} (copia)`.slice(0, LIMITS.label) }, field.id, mods);
}

/** Lo que propone al abrir un motivo (null: lo de sus módulos). */
export const setProposals = (doc: TemplateDoc, p: Proposals | null): TemplateDoc => withDelta(doc, { propose: p ?? undefined });

// ---------- Módulos en la plantilla ----------

/**
 * Añadir un módulo a la plantilla: sus preguntas aparecen (en su apartado o repartidas) y las del tronco que oculta se
 * ocultan aquí (la clínica las puede volver a encender).
 */
export function addModule(doc: TemplateDoc, id: string, mods: ModuleDoc[] = []): TemplateDoc {
  if (doc.delta.modules.some((m) => m.id === id)) return doc;
  const rm = resolveModule(id, mods.find((m) => m.id === id) ?? blankModule(id));
  if (!rm) return doc;
  let next = withDelta(doc, { modules: [...doc.delta.modules, { id }] });
  for (const t of rm.hideTrunk) if (BASE_IDS.has(t)) next = patchField(next, t, { hidden: true });
  return next;
}

/** Quitar un módulo de la plantilla. Lo respondido a sus preguntas no se pierde (se lee con su texto). */
export function removeModule(doc: TemplateDoc, id: string): TemplateDoc {
  return withDelta(doc, { modules: doc.delta.modules.filter((m) => m.id !== id) });
}
