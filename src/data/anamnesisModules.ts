// Módulos de especialidad de la anamnesis (docs/anamnesis-adaptable.md, fase 2). Un módulo es un bloque de preguntas
// con nombre que una plantilla lleva encima del tronco: en su apartado propio o repartidas en los del tronco.
// - De OmniClin (src/data/modulesLibrary.ts): van en el código con versión. Al añadirlo, la clínica guarda solo sus
//   cambios encima (como con el tronco): las versiones nuevas le llegan salvo en lo que ella cambió, con un aviso.
// - De la clínica: todas sus preguntas son suyas.
// Los cambios de un módulo son de la clínica, no de cada plantilla (decisión 11): se ven igual en todas las que lo
// llevan; cada plantilla puede ocultar preguntas del módulo con su interruptor.
//
// Cómo se guarda (ajustes que se sincronizan fila entera, sin migración):
// - `anamnesis_mod:<id>`: el puntero, con los cambios (OmniClin) o las preguntas (propio), quién y cuándo.
// - `anamnesis_mod_v:<id>:<huella>`: el módulo ya resuelto, inmutable, la primera vez que se usa. La instantánea de la
//   plantilla ya lleva sus módulos resueltos, así que una anamnesis o un enlace se entienden solos.
import { ANAMNESIS, type Field, type ShowIf, type Who } from "../clinical/anamnesis";
import { bool, checkOwnField, checkShowIf, LIMITS, ownToField, text, tidy, who, type OwnField } from "./anamnesisFields";
import type { Db } from "./db";
import { isLibraryModule, libraryModule, MODULE_SELF, type ModuleSpec } from "./modulesLibrary";
import { getSetting, setSetting } from "./settings";
import type { Proposals } from "./anamnesisTemplates";

const POINTER = (id: string) => `anamnesis_mod:${id}`;
const SNAPSHOT = (id: string, hash: string) => `anamnesis_mod_v:${id}:${hash}`;
export const isModuleKey = (key: string) => key.startsWith("anamnesis_mod:") || key.startsWith("anamnesis_mod_v:");
const TRUNK_SECTIONS = new Set(ANAMNESIS.map((s) => s.id));
const TRUNK_FIELDS = new Set(ANAMNESIS.flatMap((s) => s.fields.map((f) => f.id)));
const OWN_MODULE_ID = /^md_[0-9a-f]{8}$/;

/** Cambios de la clínica sobre una pregunta de un módulo de OmniClin. Las opciones no se renombran: se añaden o retiran. */
export type ModuleFieldPatch = {
  label?: string;
  patientLabel?: string;
  hint?: string;
  who?: Who;
  /** Otro apartado: uno del tronco o «self». */
  section?: string;
  required?: boolean;
  removed?: boolean;
  addOptions?: string[];
  removeOptions?: string[];
  highlight?: string[];
  /** null: sin la condición que traía. */
  showIf?: ShowIf | null;
  detail?: string;
};

/** El puntero de un módulo de la clínica (propio, o de OmniClin con sus cambios). */
export type ModuleDoc = {
  v: 1;
  id: string;
  name: string;
  /** OmniClin: la versión del módulo que la clínica ya vio (las preguntas nuevas de después se avisan). */
  seen?: number;
  /** OmniClin: cambios sobre sus preguntas. */
  fields: Record<string, ModuleFieldPatch>;
  /** Preguntas de la clínica (todas, en uno propio; las que añade, en uno de OmniClin). */
  added: OwnField[];
  title?: string;
  guardian?: boolean;
  propose?: Proposals;
  by?: string;
  at?: string;
  archived?: boolean;
};

/** Una pregunta del módulo ya resuelta: la pregunta, su apartado («self» o del tronco) y si está retirada. */
export type ModuleItem = { field: Field; section: string; removed: boolean; own: boolean; changed: boolean; since?: number };
export type ResolvedModule = {
  id: string;
  name: string;
  title: string;
  version: number;
  lib: boolean;
  items: ModuleItem[];
  hideTrunk: string[];
  propose?: Proposals;
  guardian?: boolean;
  /** Preguntas de OmniClin más nuevas que la versión que vio la clínica. */
  news: string[];
  /** La clínica ha cambiado algo (para «Volver a la versión de OmniClin»). */
  changed: boolean;
};

export const newModuleId = () => `md_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
const sectionOk = (s: string) => s === MODULE_SELF || TRUNK_SECTIONS.has(s);

export function checkProposals(p: unknown): Proposals | undefined {
  if (!p || typeof p !== "object") return undefined;
  const list = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length <= 80))].slice(0, 30) : []);
  const { questionnaires, measures } = p as Proposals;
  return { questionnaires: list(questionnaires), measures: list(measures) };
}

/** Comprueba y limpia un módulo de la clínica antes de guardarlo. */
export function checkModule(doc: ModuleDoc): ModuleDoc {
  if (!doc || typeof doc !== "object") throw new RangeError("El módulo no es válido.");
  const lib = isLibraryModule(doc.id ?? "") ? libraryModule(doc.id) : undefined;
  if (!lib && !OWN_MODULE_ID.test(doc.id ?? "")) throw new RangeError("El identificador del módulo no es válido.");
  const name = text(doc.name, LIMITS.label, "Nombre del módulo") ?? lib?.name;
  if (!name) throw new RangeError("Escribe el nombre del módulo.");
  const fields: Record<string, ModuleFieldPatch> = {};
  if (lib) {
    const libIds = new Map(lib.fields.map((f) => [f.id, f]));
    for (const [id, p] of Object.entries(doc.fields ?? {})) {
      const f = libIds.get(id);
      if (!f || !p || typeof p !== "object") continue;
      const what = `«${f.label}»`;
      const opts = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, LIMITS.label)))] : undefined);
      const patch = tidy<ModuleFieldPatch>({
        label: text(p.label, LIMITS.label, what),
        patientLabel: text(p.patientLabel, LIMITS.label, `${what}, texto para el paciente`),
        hint: text(p.hint, LIMITS.hint, `${what}, ayuda`),
        who: who(p.who),
        section: typeof p.section === "string" && sectionOk(p.section) && p.section !== f.section ? p.section : undefined,
        required: f.sensitive ? undefined : bool(p.required),
        removed: bool(p.removed),
        addOptions: f.options ? opts(p.addOptions)?.filter((o) => !f.options!.includes(o)) : undefined,
        removeOptions: f.options ? opts(p.removeOptions)?.filter((o) => f.options!.includes(o)) : undefined,
        highlight: Array.isArray(p.highlight) ? opts(p.highlight) : undefined,
        showIf: p.showIf === null ? null : checkShowIf(p.showIf, id),
        detail: f.type === "yesno_detail" ? text(p.detail, LIMITS.label, `${what}, detalle`) : undefined,
      });
      if (patch.addOptions && !patch.addOptions.length) delete patch.addOptions;
      if (patch.removeOptions && !patch.removeOptions.length) delete patch.removeOptions;
      if (Object.keys(patch).length) fields[id] = patch;
    }
  }
  const seen = new Set<string>(lib?.fields.map((f) => f.id));
  const added: OwnField[] = [];
  for (const f of doc.added ?? []) {
    const clean = checkOwnField(f, sectionOk);
    if (seen.has(clean.id) || TRUNK_FIELDS.has(clean.id)) throw new RangeError(`La pregunta «${clean.label}» tiene un identificador repetido.`);
    seen.add(clean.id);
    added.push(clean);
  }
  if (seen.size > LIMITS.moduleFields) throw new RangeError(`Un módulo tiene como mucho ${LIMITS.moduleFields} preguntas.`);
  const out: ModuleDoc = tidy({
    v: 1 as const,
    id: doc.id,
    name,
    seen: lib ? (Number.isInteger(doc.seen) ? Math.min(doc.seen!, lib.version) : lib.version) : undefined,
    fields,
    added,
    title: text(doc.title, LIMITS.label, "Título del apartado"),
    guardian: bool(doc.guardian),
    propose: checkProposals(doc.propose),
    by: typeof doc.by === "string" ? doc.by.slice(0, 200) : undefined,
    at: typeof doc.at === "string" ? doc.at : undefined,
    archived: bool(doc.archived),
  });
  if (new TextEncoder().encode(JSON.stringify(out)).length > LIMITS.bytes) throw new RangeError("El módulo es demasiado grande.");
  return out;
}

/** Un módulo de OmniClin con su pregunta tal como la deja la clínica. */
function patchLibField(f: OwnField, p: ModuleFieldPatch | undefined): OwnField {
  if (!p) return f;
  const options = f.options ? [...f.options.filter((o) => !p.removeOptions?.includes(o)), ...(p.addOptions ?? [])] : undefined;
  return tidy({
    ...f,
    label: p.label ?? f.label,
    patientLabel: p.patientLabel ?? f.patientLabel,
    hint: p.hint ?? f.hint,
    who: p.who ?? f.who,
    section: p.section ?? f.section,
    required: f.sensitive ? undefined : (p.required ?? f.required),
    options,
    highlight: p.highlight ?? f.highlight,
    showIf: p.showIf === null ? undefined : (p.showIf ?? f.showIf),
    detail: p.detail ?? f.detail,
  });
}

/** El módulo de la clínica por defecto (de OmniClin, sin cambios; o propio, vacío). */
export function blankModule(id: string, name = ""): ModuleDoc {
  const lib = libraryModule(id);
  return { v: 1, id, name: lib?.name ?? name, ...(lib ? { seen: lib.version } : {}), fields: {}, added: [] };
}

/** Un módulo ya resuelto: las preguntas de OmniClin con los cambios de la clínica y las suyas. null si no se conoce. */
export function resolveModule(id: string, doc?: ModuleDoc | null): ResolvedModule | null {
  const lib: ModuleSpec | undefined = libraryModule(id);
  if (!lib && !doc) return null;
  const d = doc ?? blankModule(id);
  const items: ModuleItem[] = [];
  for (const f of lib?.fields ?? []) {
    const p = d.fields[f.id];
    const g = patchLibField(f, p);
    items.push({ field: ownToField(g, id), section: g.section, removed: !!p?.removed, own: false, changed: !!p && Object.keys(p).length > 0, ...(f.since ? { since: f.since } : {}) });
  }
  for (const f of d.added) items.push({ field: ownToField(f, id), section: f.section, removed: !!f.removed, own: true, changed: false });
  const seen = d.seen ?? lib?.version ?? 1;
  return tidy({
    id,
    name: d.name || lib?.name || id,
    title: d.title ?? lib?.title ?? (d.name || lib?.name || id),
    version: lib?.version ?? 1,
    lib: !!lib,
    items,
    hideTrunk: lib?.hideTrunk ?? [],
    propose: d.propose ?? lib?.propose,
    guardian: d.guardian ?? lib?.guardian,
    news: (lib?.fields ?? []).filter((f) => (f.since ?? 1) > seen).map((f) => f.id),
    changed: Object.keys(d.fields).length > 0 || d.added.some((f) => !f.removed) || !!d.title,
  });
}

// ---------- Guardar y leer ----------

export async function listModuleDocs(db: Db): Promise<ModuleDoc[]> {
  const rows = await db.query<{ value: string }>("select value from settings where key like 'anamnesis\\_mod:%' escape '\\'");
  const out: ModuleDoc[] = [];
  for (const r of rows) {
    try {
      out.push(checkModule(JSON.parse(r.value) as ModuleDoc));
    } catch {
      // Uno que esta versión no entiende: se lee tal cual (no se pierde).
      const raw = JSON.parse(r.value) as ModuleDoc;
      if (raw?.id) out.push({ ...raw, fields: raw.fields ?? {}, added: raw.added ?? [] });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getModuleDoc(db: Db, id: string): Promise<ModuleDoc | null> {
  const doc = await getSetting<ModuleDoc>(db, POINTER(id));
  if (!doc) return null;
  try {
    return checkModule(doc);
  } catch {
    return { ...doc, fields: doc.fields ?? {}, added: doc.added ?? [] };
  }
}

export async function saveModuleDoc(db: Db, doc: ModuleDoc, by: string | null): Promise<ModuleDoc> {
  const clean = checkModule({ ...doc, by: by ?? undefined, at: new Date().toISOString() });
  await setSetting(db, POINTER(clean.id), clean);
  return clean;
}

/** La instantánea de un módulo resuelto (al usarse la plantilla que lo lleva), si aún no está. */
export async function markModuleUsed(db: Db, m: ResolvedModule): Promise<void> {
  const body = JSON.stringify({ id: m.id, name: m.name, title: m.title, version: m.version, items: m.items });
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)));
  const hash = Array.from(digest.subarray(0, 6), (b) => b.toString(16).padStart(2, "0")).join("");
  const key = SNAPSHOT(m.id, hash);
  if (!(await getSetting(db, key))) await setSetting(db, key, { v: 1, ...JSON.parse(body) });
}

// ---------- Operaciones del editor (puras) ----------

const ownIn = (d: ModuleDoc, id: string) => d.added.find((f) => f.id === id);

/**
 * Cambiar una pregunta del módulo. En una de OmniClin se guarda solo lo que difiere del original; las opciones se
 * comparan con las del original (las que faltan se retiran; las nuevas se añaden).
 */
export function patchModuleField(d: ModuleDoc, id: string, change: Omit<Partial<OwnField>, "showIf"> & { showIf?: ShowIf | null }): ModuleDoc {
  const own = ownIn(d, id);
  if (own) {
    const next = tidy({ ...own, ...change, showIf: change.showIf === null ? undefined : (change.showIf ?? own.showIf) }) as OwnField;
    return { ...d, added: d.added.map((f) => (f.id === id ? next : f)) };
  }
  const lib = libraryModule(d.id)?.fields.find((f) => f.id === id);
  if (!lib) return d;
  const prev = d.fields[id] ?? {};
  const now = patchLibField(lib, prev);
  const want = { ...now, ...change };
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const blank = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);
  const p: ModuleFieldPatch = tidy({
    label: blank(want.label) === lib.label ? undefined : blank(want.label),
    patientLabel: blank(want.patientLabel) === lib.patientLabel ? undefined : blank(want.patientLabel),
    hint: blank(want.hint) === lib.hint ? undefined : blank(want.hint),
    who: want.who === lib.who ? undefined : want.who,
    section: want.section === lib.section ? undefined : want.section,
    required: !!want.required === !!lib.required ? undefined : !!want.required,
    removed: prev.removed,
    addOptions: lib.options ? (want.options ?? []).filter((o) => !lib.options!.includes(o)) : undefined,
    removeOptions: lib.options ? lib.options.filter((o) => !(want.options ?? []).includes(o)) : undefined,
    highlight: same(want.highlight ?? [], lib.highlight ?? []) ? undefined : (want.highlight ?? []),
    showIf: change.showIf === null ? (lib.showIf ? null : undefined) : same(want.showIf, lib.showIf) ? undefined : want.showIf,
    detail: blank(want.detail) === lib.detail ? undefined : blank(want.detail),
  });
  if (p.addOptions && !p.addOptions.length) delete p.addOptions;
  if (p.removeOptions && !p.removeOptions.length) delete p.removeOptions;
  const fields = { ...d.fields };
  if (Object.keys(p).length) fields[id] = p;
  else delete fields[id];
  return { ...d, fields };
}

/** Volver al original una pregunta de OmniClin del módulo. */
export function resetModuleField(d: ModuleDoc, id: string): ModuleDoc {
  const fields = { ...d.fields };
  delete fields[id];
  return { ...d, fields };
}

/** Añadir una pregunta al módulo. */
export const addModuleField = (d: ModuleDoc, f: OwnField): ModuleDoc => ({ ...d, added: [...d.added, f] });

/** Retirar una pregunta del módulo: deja de verse en todas sus plantillas; lo respondido se sigue leyendo. */
export function retireModuleField(d: ModuleDoc, id: string): ModuleDoc {
  if (ownIn(d, id)) return { ...d, added: d.added.map((f) => (f.id === id ? { ...f, removed: true } : f)) };
  return { ...d, fields: { ...d.fields, [id]: { ...d.fields[id], removed: true } } };
}

/** Volver a la versión de OmniClin: sin cambios; las preguntas que añadió la clínica se retiran (no se borran). */
export function resetModule(d: ModuleDoc): ModuleDoc {
  const lib = libraryModule(d.id);
  return { ...d, name: lib?.name ?? d.name, title: undefined, fields: {}, added: d.added.map((f) => ({ ...f, removed: true })) };
}

/** Las novedades de OmniClin ya vistas. */
export function ackModule(d: ModuleDoc): ModuleDoc {
  const lib = libraryModule(d.id);
  return lib ? { ...d, seen: lib.version } : d;
}

/** Una copia propia del módulo (con otro id y todas sus preguntas como propias, con ids nuevos). */
export function copyModule(src: ResolvedModule, name: string, newId: () => string): ModuleDoc {
  const ids = new Map(src.items.map((it) => [it.field.id, newId()]));
  const added: OwnField[] = src.items
    .filter((it) => !it.removed && it.field.type !== "cif")
    .map((it) => {
      const f = it.field;
      return tidy<OwnField>({
        id: ids.get(f.id)!,
        section: it.section,
        type: f.type as OwnField["type"],
        label: f.label,
        hint: f.hint,
        patientLabel: f.patientLabel,
        who: f.who ?? "clinician",
        options: f.type === "choice" || f.type === "multi" ? [...f.options] : undefined,
        other: f.other,
        detail: f.type === "yesno_detail" ? f.detail : undefined,
        unit: f.type === "number" ? f.unit : undefined,
        sensitive: f.sensitive,
        required: f.required,
        highlight: f.highlight,
        showIf: f.showIf && ids.has(f.showIf.field) ? { ...f.showIf, field: ids.get(f.showIf.field)! } : undefined,
      });
    });
  return { v: 1, id: newModuleId(), name, fields: {}, added, ...(src.guardian ? { guardian: true } : {}), ...(src.propose ? { propose: src.propose } : {}) };
}
