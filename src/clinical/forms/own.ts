// Cuestionarios propios de la clínica (docs/cuestionarios-propios.md): se describen como datos (OwnFormSpec) y se
// convierten en un cuestionario como los demás (QuestionForm) con buildForm. La nota es aritmética simple: suma,
// media o porcentaje sobre el máximo (y subescalas con lo mismo). Nunca se interpreta: no hay umbrales, puntos de
// corte, categorías ni colores por rango, y no existe ningún campo para ellos. «Más es mejor / menos es mejor» solo
// orienta el eje de la gráfica.
import { round1, type Answers, type FormScore, type Item, type QuestionForm, type Section } from "./types";

/** Los ids del catálogo de los cuestionarios propios: «own:<uuid>». */
export const OWN_PREFIX = "own:";
export const isOwnKind = (kind: string) => kind.startsWith(OWN_PREFIX);
/** La etiqueta fija, que no se puede quitar: en el formulario, la ficha, la gráfica, el informe y la exportación. */
export const OWN_LABEL = "Cuestionario propio de la clínica · no validado";
export const ownLabelFor = (clinic: string) => (clinic.trim() ? `Cuestionario propio de ${clinic.trim()} · no validado` : OWN_LABEL);

// ---------- Tipos ----------

type BaseItem = {
  /** «q_<8 hex>»: estable, nunca se reutiliza. */
  id: string;
  text: string;
  /** Se puede marcar «No aplica» (cuenta como sin responder). */
  na?: boolean;
};
/** Una opción con sus puntos (los puntos se escriben por opción: «4…0» ya es un ítem invertido). */
export type OwnOption = { label: string; points: number };
export type OwnItem =
  | (BaseItem & { type: "scale"; from: number; to: number; ends?: [string, string] })
  | (BaseItem & { type: "options"; options: OwnOption[] })
  | (BaseItem & { type: "yesno"; yes: number; no: number })
  /** Un número que se escribe; solo cuenta en la nota si `counts`. */
  | (BaseItem & { type: "number"; unit: string; min: number; max: number; counts?: boolean });
export type OwnItemType = OwnItem["type"];
export type OwnSection = { title?: string; intro?: string; items: OwnItem[] };
export type OwnScoring = {
  method: "sum" | "mean" | "percent";
  /** Solo orienta el eje de la gráfica (la flecha). No colorea nada. */
  better: "higher" | "lower";
  /** «block»: hacen falta todas las respuestas; «skip»: basta con `minAnswered`. */
  na: "skip" | "block";
  minAnswered?: number;
  subscales?: { name: string; items: string[] }[];
};
export type OwnFormSpec = {
  v: 1;
  id: string;
  name: string;
  instructions?: string;
  /** Nota para el profesional: un texto fijo de la clínica, siempre visible junto al cuestionario. */
  note?: string;
  sections: OwnSection[];
  scoring: OwnScoring | null;
  /** La huella de esta versión (la pone ownForms.ts al guardar). */
  hash?: string;
};

// ---------- Comprobar ----------

export const OWN_LIMITS = { sections: 10, items: 60, bytes: 32 * 1024, name: 120, text: 300, long: 1000, option: 120, options: 20, end: 60, unit: 20, subscales: 10 };
const ITEM_ID = /^q_[0-9a-f]{8}$/;
const OWN_ID = /^own:[0-9a-f-]{8,40}$/;

const str = (v: unknown, max: number, what: string, required = false): string | undefined => {
  if (v === undefined || v === null || v === "") {
    if (required) throw new RangeError(`${what}: falta.`);
    return undefined;
  }
  if (typeof v !== "string") throw new RangeError(`${what}: no es un texto.`);
  const t = v.trim();
  if (!t && required) throw new RangeError(`${what}: falta.`);
  if (t.length > max) throw new RangeError(`${what}: como mucho ${max} caracteres.`);
  return t || undefined;
};
const num = (v: unknown, what: string): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new RangeError(`${what}: tiene que ser un número.`);
  if (Math.abs(v) > 100_000) throw new RangeError(`${what}: el número es demasiado grande.`);
  return v;
};
const tidy = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Los puntos mínimo y máximo de una pregunta (para el porcentaje y el rango de la nota). */
export function itemRange(it: OwnItem): [number, number] {
  switch (it.type) {
    case "scale":
      return [it.from, it.to];
    case "options": {
      const p = it.options.map((o) => o.points);
      return [Math.min(...p), Math.max(...p)];
    }
    case "yesno":
      return [Math.min(it.yes, it.no), Math.max(it.yes, it.no)];
    case "number":
      return [it.min, it.max];
  }
}
/** Las preguntas que cuentan en la nota (todas menos los números que la clínica no marca). */
export const countedItems = (spec: Pick<OwnFormSpec, "sections">) => spec.sections.flatMap((s) => s.items).filter((it) => it.type !== "number" || it.counts);

function checkItem(it: OwnItem, n: number): OwnItem {
  if (!it || typeof it !== "object") throw new RangeError(`Pregunta ${n}: no es válida.`);
  if (!ITEM_ID.test(it.id ?? "")) throw new RangeError(`Pregunta ${n}: el identificador no es válido.`);
  const text = str(it.text, OWN_LIMITS.text, `Pregunta ${n}`, true)!;
  const base = { id: it.id, text, na: it.na === true ? true : undefined };
  const what = `«${text}»`;
  switch (it.type) {
    case "scale": {
      const from = num(it.from, `${what}, desde`);
      const to = num(it.to, `${what}, hasta`);
      if (!Number.isInteger(from) || !Number.isInteger(to)) throw new RangeError(`${what}: la escala va de un número entero a otro.`);
      if (from >= to) throw new RangeError(`${what}: la escala tiene que ir de menos a más (por ejemplo, de 0 a 10).`);
      if (to - from > 100) throw new RangeError(`${what}: la escala tiene como mucho 100 pasos.`);
      const ends = Array.isArray(it.ends) ? ([str(it.ends[0], OWN_LIMITS.end, `${what}, texto del inicio`) ?? "", str(it.ends[1], OWN_LIMITS.end, `${what}, texto del final`) ?? ""] as [string, string]) : undefined;
      return tidy({ ...base, type: "scale" as const, from, to, ends: ends && (ends[0] || ends[1]) ? ends : undefined });
    }
    case "options": {
      if (!Array.isArray(it.options)) throw new RangeError(`${what}: faltan las opciones.`);
      if (it.options.length > OWN_LIMITS.options) throw new RangeError(`${what}: como mucho ${OWN_LIMITS.options} opciones.`);
      const options: OwnOption[] = [];
      for (const o of it.options) {
        const label = str(o?.label, OWN_LIMITS.option, `${what}, opción`, true)!;
        if (options.some((x) => x.label.toLowerCase() === label.toLowerCase())) throw new RangeError(`${what}: la opción «${label}» está repetida.`);
        options.push({ label, points: num(o?.points, `${what}, puntos de «${label}»`) });
      }
      if (options.length < 2) throw new RangeError(`${what}: pon al menos dos opciones.`);
      return { ...base, type: "options", options } as OwnItem;
    }
    case "yesno":
      return tidy({ ...base, type: "yesno" as const, yes: num(it.yes ?? 1, `${what}, puntos de «Sí»`), no: num(it.no ?? 0, `${what}, puntos de «No»`) });
    case "number": {
      const min = num(it.min, `${what}, mínimo`);
      const max = num(it.max, `${what}, máximo`);
      if (min >= max) throw new RangeError(`${what}: el mínimo tiene que ser menor que el máximo.`);
      return tidy({ ...base, type: "number" as const, unit: str(it.unit, OWN_LIMITS.unit, `${what}, unidad`) ?? "", min, max, counts: it.counts === true ? true : undefined });
    }
    default:
      throw new RangeError(`Pregunta ${n}: el tipo no existe.`);
  }
}

/**
 * Comprueba y limpia un cuestionario propio antes de guardarlo: límites, textos, ids, opciones, puntos, rangos y la
 * nota. Las claves que no conoce se quitan (no hay forma de guardar un umbral). Los textos nunca se interpretan como
 * HTML ni markdown.
 */
export function checkOwnForm(spec: OwnFormSpec): OwnFormSpec {
  if (!spec || typeof spec !== "object") throw new RangeError("El cuestionario no es válido.");
  if (!OWN_ID.test(spec.id ?? "")) throw new RangeError("El identificador del cuestionario no es válido.");
  const name = str(spec.name, OWN_LIMITS.name, "Nombre", true)!;
  if (!Array.isArray(spec.sections) || !spec.sections.length) throw new RangeError("Añade al menos una pregunta.");
  if (spec.sections.length > OWN_LIMITS.sections) throw new RangeError(`Como mucho ${OWN_LIMITS.sections} apartados.`);
  const ids = new Set<string>();
  let n = 0;
  const sections: OwnSection[] = spec.sections.map((s, i) => {
    if (!s || typeof s !== "object" || !Array.isArray(s.items)) throw new RangeError(`Apartado ${i + 1}: no es válido.`);
    const items = s.items.map((it) => {
      const clean = checkItem(it, ++n);
      if (ids.has(clean.id)) throw new RangeError(`La pregunta «${clean.text}» tiene un identificador repetido.`);
      ids.add(clean.id);
      return clean;
    });
    return tidy({ title: str(s.title, OWN_LIMITS.name, `Apartado ${i + 1}, título`), intro: str(s.intro, OWN_LIMITS.long, `Apartado ${i + 1}, texto`), items });
  });
  if (!n) throw new RangeError("Añade al menos una pregunta.");
  if (n > OWN_LIMITS.items) throw new RangeError(`Como mucho ${OWN_LIMITS.items} preguntas.`);
  if (sections.some((s) => !s.items.length)) throw new RangeError("Hay un apartado sin preguntas: añádele alguna o quítalo.");
  let scoring: OwnScoring | null = null;
  if (spec.scoring) {
    const sc = spec.scoring;
    if (!["sum", "mean", "percent"].includes(sc.method)) throw new RangeError("La nota no es válida.");
    const counted = countedItems({ sections });
    if (!counted.length) throw new RangeError("Para calcular una nota hace falta al menos una pregunta que cuente.");
    const flat = counted.find((it) => {
      const [a, b] = itemRange(it);
      return a === b;
    });
    if (flat) throw new RangeError(`«${flat.text}»: todas sus respuestas valen lo mismo; cambia los puntos o quítala de la nota.`);
    const countedIds = new Set(counted.map((it) => it.id));
    let minAnswered: number | undefined;
    if (sc.minAnswered !== undefined && sc.minAnswered !== null) {
      minAnswered = num(sc.minAnswered, "Mínimo de preguntas contestadas");
      if (!Number.isInteger(minAnswered) || minAnswered < 1 || minAnswered > counted.length) throw new RangeError(`El mínimo de preguntas contestadas va de 1 a ${counted.length}.`);
      if (minAnswered === counted.length) minAnswered = undefined;
    }
    const subscales: { name: string; items: string[] }[] = [];
    for (const sub of Array.isArray(sc.subscales) ? sc.subscales : []) {
      const subName = str(sub?.name, OWN_LIMITS.name, "Subescala, nombre", true)!;
      if (subscales.some((x) => x.name.toLowerCase() === subName.toLowerCase())) throw new RangeError(`La subescala «${subName}» está repetida.`);
      const items = [...new Set((Array.isArray(sub.items) ? sub.items : []).filter((id) => countedIds.has(id)))];
      if (!items.length) throw new RangeError(`La subescala «${subName}» no tiene preguntas que cuenten en la nota.`);
      subscales.push({ name: subName, items });
    }
    if (subscales.length > OWN_LIMITS.subscales) throw new RangeError(`Como mucho ${OWN_LIMITS.subscales} subescalas.`);
    scoring = tidy({
      method: sc.method,
      better: sc.better === "lower" ? ("lower" as const) : ("higher" as const),
      na: sc.na === "skip" ? ("skip" as const) : ("block" as const),
      minAnswered: sc.na === "skip" ? minAnswered : undefined,
      subscales: subscales.length ? subscales : undefined,
    });
  }
  const out: OwnFormSpec = tidy({
    v: 1 as const,
    id: spec.id,
    name,
    instructions: str(spec.instructions, OWN_LIMITS.long, "Instrucciones"),
    note: str(spec.note, OWN_LIMITS.long, "Nota para el profesional"),
    sections,
    scoring,
    hash: typeof spec.hash === "string" && /^[0-9a-f]{12}$/.test(spec.hash) ? spec.hash : undefined,
  });
  if (new TextEncoder().encode(JSON.stringify(out)).length > OWN_LIMITS.bytes) throw new RangeError("El cuestionario es demasiado largo (como mucho 32 KB): quita preguntas o acorta textos.");
  return out;
}

// ---------- Nombres de cuestionarios con derechos de autor ----------

/** Nombres (y siglas) de cuestionarios con derechos de autor, retirados de la app o de pago. Solo para avisar. */
const COPYRIGHT = ["KOOS", "HOOS", "Oswestry", "ODI", "QuickDASH", "DASH", "NDI", "Neck Disability", "WOMAC", "Oxford", "TSK", "Tampa", "PCS", "Pain Catastrophizing", "VISA", "LEFS", "SPADI", "FABQ", "HIT-6", "HIT6", "Roland", "RMDQ", "SF-36", "SF-12", "EQ-5D", "PROMIS", "Constant", "WORC", "WOSI", "KJOC", "IKDC", "Start Back", "Örebro", "Orebro"];
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** El nombre de un cuestionario con derechos de autor que aparece en el nombre dado (o null). */
export function copyrightName(name: string): string | null {
  const t = ` ${fold(name).replace(/[^a-z0-9-]+/g, " ")} `;
  return COPYRIGHT.find((c) => t.includes(` ${fold(c).replace(/[^a-z0-9-]+/g, " ").trim()} `)) ?? null;
}

// ---------- Convertir en un cuestionario de la app ----------

/** Los puntos de una respuesta (las opciones y Sí/No se guardan por su posición; la escala y el número, tal cual). */
export function pointsOf(it: OwnItem, v: number): number | null {
  switch (it.type) {
    case "options":
      return Number.isInteger(v) ? (it.options[v]?.points ?? null) : null;
    case "yesno":
      return v === 0 ? it.yes : v === 1 ? it.no : null;
    case "scale":
      return Number.isInteger(v) && v >= it.from && v <= it.to ? v : null;
    case "number":
      return v >= it.min && v <= it.max ? v : null;
  }
}

/** El rango de la nota (para la gráfica): suma de mínimos y máximos; media de ellos; 0-100 en el porcentaje. */
export function scoreRange(spec: OwnFormSpec, items = countedItems(spec)): { min: number; max: number } {
  if (!spec.scoring || !items.length) return { min: 0, max: 0 };
  if (spec.scoring.method === "percent") return { min: 0, max: 100 };
  const lo = items.reduce((s, it) => s + itemRange(it)[0], 0);
  const hi = items.reduce((s, it) => s + itemRange(it)[1], 0);
  return spec.scoring.method === "mean" ? { min: round1(lo / items.length), max: round1(hi / items.length) } : { min: lo, max: hi };
}

/** La nota de unas preguntas: suma, media o % del máximo sobre las contestadas. */
function compute(method: OwnScoring["method"], parts: { points: number; lo: number; hi: number }[]): number {
  const sum = parts.reduce((s, p) => s + p.points, 0);
  if (method === "sum") return round1(sum);
  if (method === "mean") return round1(sum / parts.length);
  const lo = parts.reduce((s, p) => s + p.lo, 0);
  const hi = parts.reduce((s, p) => s + p.hi, 0);
  return round1(((sum - lo) / (hi - lo)) * 100);
}

/** La nota de un cuestionario propio. Lanza RangeError con un texto claro si faltan respuestas para calcularla. */
export function scoreOwn(spec: OwnFormSpec, answers: Answers): FormScore {
  const sc = spec.scoring;
  if (!sc) return { score: null };
  const counted = countedItems(spec);
  const partOf = (it: OwnItem) => {
    const v = answers[it.id];
    if (typeof v !== "number") return null;
    const points = pointsOf(it, v);
    if (points === null) return null;
    const [lo, hi] = itemRange(it);
    return { points, lo, hi };
  };
  const parts = counted.map(partOf).filter((p): p is NonNullable<typeof p> => p !== null);
  const need = sc.na === "skip" ? (sc.minAnswered ?? counted.length) : counted.length;
  if (parts.length < need) {
    const missing = need - parts.length;
    const what = missing === 1 ? "Falta 1 respuesta" : `Faltan ${missing} respuestas`;
    throw new RangeError(
      sc.na === "block" || need === counted.length
        ? `${what}: hacen falta todas para calcular la nota.`
        : `${what}: hacen falta al menos ${need} contestadas para calcular la nota.`,
    );
  }
  const score = compute(sc.method, parts);
  const subscores: FormScore["subscores"] = [];
  for (const sub of sc.subscales ?? []) {
    const items = counted.filter((it) => sub.items.includes(it.id));
    const subParts = items.map(partOf).filter((p): p is NonNullable<typeof p> => p !== null);
    // Con «skip», la misma proporción que la nota total; con «block», todas.
    const subNeed = Math.ceil((need / counted.length) * items.length);
    if (!subParts.length || subParts.length < subNeed) continue;
    const range = scoreRange(spec, items);
    subscores.push({ name: sub.name, score: compute(sc.method, subParts), ...(sc.method === "percent" ? {} : { max: range.max }) });
  }
  return { score, ...(subscores.length ? { subscores } : {}) };
}

/** El cuestionario propio como uno de la app: sus apartados, sus preguntas y su nota. */
export function buildForm(spec: OwnFormSpec): QuestionForm {
  const toItem = (it: OwnItem): Item => {
    const base = { id: it.id, text: it.text, ...(it.na ? { na: true } : {}) };
    switch (it.type) {
      case "scale":
        return { ...base, scale: { from: it.from, to: it.to, ends: it.ends ?? ["", ""] } };
      case "options":
        // Por su posición: dos opciones con los mismos puntos no se confunden al leer lo que se contestó.
        return { ...base, options: it.options.map((o, i) => ({ value: i, label: o.label })) };
      case "yesno":
        return { ...base, options: [{ value: 0, label: "Sí" }, { value: 1, label: "No" }] };
      case "number":
        return { ...base, input: { min: it.min, max: it.max, unit: it.unit } };
    }
  };
  const sections: Section[] = spec.sections.map((s, i) => ({ title: s.title ?? (spec.sections.length > 1 ? `Parte ${i + 1}` : ""), ...(s.intro ? { intro: s.intro } : {}), items: s.items.map(toItem) }));
  return {
    id: spec.id,
    instructions: spec.instructions ?? "",
    sections,
    score: (answers) => scoreOwn(spec, answers),
    source: OWN_LABEL,
  };
}
