// La CIF en la anamnesis: cada código elegido se guarda con su notación oficial («b280.2», «d450.21», «e310+3») y de
// ahí salen el texto para leerlo y el borrador del diagnóstico fisioterapéutico. Las palabras de cada calificador son
// las de la escala de la CIF (OMS 2001) para cada componente. El catálogo (src/clinical/cif/cifData.ts) se carga solo
// al abrir el buscador.
import { fold } from "../redFlags";

export type Component = "b" | "s" | "d" | "e";
export type CifEntry = { code: string; title: string; component: Component; level: number; search: string };

export const COMPONENTS: { id: Component; label: string; short: string }[] = [
  { id: "b", label: "Funciones corporales", short: "Funciones (b)" },
  { id: "s", label: "Estructuras corporales", short: "Estructuras (s)" },
  { id: "d", label: "Actividades y participación", short: "Actividades (d)" },
  { id: "e", label: "Factores ambientales", short: "Ambientales (e)" },
];

/** El catálogo, una sola vez y solo cuando hace falta (es grande: va en su propio archivo). */
let catalog: Promise<CifEntry[]> | null = null;
export const loadCatalog = () => (catalog ??= import("./cifData").then((m) => parseCatalog(m.CIF_TSV)));

/** Nivel de una categoría: 1 el capítulo (b2), 2 (b280), 3 (b2801), 4 (b28013). */
export const levelOf = (code: string) => (code.length <= 2 ? 1 : code.length - 2);

export function parseCatalog(tsv: string): CifEntry[] {
  return tsv.split("\n").map((line) => {
    const [code, title] = line.split("\t") as [string, string];
    return { code, title, component: code[0] as Component, level: levelOf(code), search: fold(`${code} ${title}`) };
  });
}

/**
 * Buscar por código («b28», «d450») o por palabras en cualquier orden («dolor espalda»), sin tildes. Primero lo que
 * empieza por el código, luego los de nivel más general.
 */
export function searchCif(catalog: CifEntry[], query: string, component: Component | null, limit = 60): CifEntry[] {
  const q = fold(query.trim());
  const pool = component ? catalog.filter((e) => e.component === component) : catalog;
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const hits = pool.filter((e) => e.code.startsWith(q) || words.every((w) => e.search.includes(w)));
  const byCode = /^[bsde]\d*$/.test(q);
  return hits
    .sort((x, y) => (byCode ? x.code.localeCompare(y.code) : x.level - y.level || x.code.localeCompare(y.code)))
    .slice(0, limit);
}

// ---------- Notación y calificadores ----------

/** Un código elegido: el primer calificador (en d, el desempeño/realización), el segundo (en d, la capacidad) y si un factor ambiental es facilitador. */
export type Coded = { code: string; q: number | null; capacity: number | null; facilitator: boolean };

export const QUALIFIERS = [0, 1, 2, 3, 4, 8, 9] as const;

export function parseCoded(s: string): Coded | null {
  const m = /^([bsde]\d{1,5})(?:([.+])(\d)?(\d)?)?$/.exec(s.trim());
  if (!m) return null;
  return { code: m[1]!, facilitator: m[2] === "+", q: m[3] !== undefined ? Number(m[3]) : null, capacity: m[4] !== undefined ? Number(m[4]) : null };
}

export function formatCoded(c: Coded): string {
  if (c.q === null) return c.code;
  const sep = c.code[0] === "e" && c.facilitator ? "+" : ".";
  return `${c.code}${sep}${c.q}${c.code[0] === "d" && c.capacity !== null ? c.capacity : ""}`;
}

const SCALE: Record<number, string> = { 0: "NO hay", 1: "LIGERA", 2: "MODERADA", 3: "GRAVE", 4: "COMPLETA" };
const SCALE_M: Record<number, string> = { 0: "NO hay", 1: "LIGERO", 2: "MODERADO", 3: "GRAVE", 4: "COMPLETO" };

/** La palabra oficial de cada calificador, para elegirlo y para el texto («Deficiencia MODERADA»). */
export function qualifierLabel(component: Component, q: number, opts: { facilitator?: boolean; capacity?: boolean } = {}): string {
  if (q === 9) return "no aplicable";
  if (component === "e") {
    if (q === 8) return opts.facilitator ? "facilitador, sin especificar" : "barrera, no especificada";
    if (q === 0) return opts.facilitator ? "NO hay facilitador" : "NO hay barrera";
    return opts.facilitator ? `Facilitador ${SCALE_M[q]}` : `Barrera ${SCALE[q]}`;
  }
  if (q === 8) return "sin especificar";
  const noun = component === "d" ? "dificultad" : "deficiencia";
  return q === 0 ? `NO hay ${noun}` : `${noun[0]!.toUpperCase()}${noun.slice(1)} ${SCALE[q]}`;
}

/** Porcentaje orientativo de la escala genérica. */
export const PERCENT: Record<number, string> = { 0: "0-4 %", 1: "5-24 %", 2: "25-49 %", 3: "50-95 %", 4: "96-100 %" };

/** «Andar (d450.21): desempeño, dificultad MODERADA; capacidad, dificultad LIGERA». */
export function codedText(c: Coded, title: string): string {
  const k = c.code[0] as Component;
  const notation = formatCoded(c);
  if (c.q === null) return `${title} (${notation})`;
  const lower = (s: string) => s.toLowerCase();
  if (k === "d") {
    const perf = `desempeño/realización: ${lower(qualifierLabel("d", c.q))}`;
    return `${title} (${notation}): ${perf}${c.capacity !== null ? `; capacidad: ${lower(qualifierLabel("d", c.capacity))}` : ""}`;
  }
  return `${title} (${notation}): ${lower(qualifierLabel(k, c.q, { facilitator: c.facilitator }))}`;
}

/** El borrador del diagnóstico fisioterapéutico: los códigos elegidos, por componente, con sus calificadores. */
export function draftDiagnosis(entries: string[]): string {
  const parsed = entries.map(readEntry).filter((e): e is NonNullable<ReturnType<typeof readEntry>> => !!e);
  const lines: string[] = [];
  for (const comp of COMPONENTS) {
    const mine = parsed.filter((e) => e.coded.code[0] === comp.id);
    if (!mine.length) continue;
    const head =
      comp.id === "b"
        ? "Deficiencias en las funciones corporales"
        : comp.id === "s"
          ? "Deficiencias en las estructuras corporales"
          : comp.id === "d"
            ? "Limitaciones en la actividad y restricciones en la participación"
            : "Factores ambientales";
    lines.push(`${head}: ${mine.map((e) => codedText(e.coded, e.title)).join("; ")}.`);
  }
  return lines.join("\n");
}

// ---------- Sugerencias ----------

/** Por zona de la anamnesis: la estructura y el dolor de esa parte del cuerpo (códigos de la propia CIF). */
const BY_REGION: Record<string, string[]> = {
  atm: ["b28010", "s7103"],
  cervical: ["b28010", "s76000", "s7104"],
  hombro: ["b28014", "s720"],
  codo: ["b28014", "s73001"],
  muneca_mano: ["b28014", "s73011", "s73021"],
  dorsal: ["b28013", "s76001"],
  lumbar: ["b28013", "s76002"],
  sacroiliaca: ["b28013", "s7401", "s76003"],
  cadera: ["b28015", "s75001"],
  rodilla: ["b28015", "s75011"],
  tobillo_pie: ["b28015", "s75021"],
};
/** Habituales en fisioterapia musculoesquelética (sugerencia de la app, no un «core set» oficial). */
export const COMMON = ["b280", "b710", "b730", "b740", "b770", "d410", "d415", "d430", "d450", "d850", "d920", "e310", "e355"];

export function suggestedCodes(regions: string[]): string[] {
  return [...new Set([...regions.flatMap((r) => BY_REGION[r] ?? []), ...COMMON])];
}

/** Las más usadas en este dispositivo, para tenerlas a mano. */
const RECENT_KEY = "fisiolab.cif.recent";
export function recentCodes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function rememberCode(code: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([code, ...recentCodes().filter((c) => c !== code)].slice(0, 20)));
  } catch {
    // Sin almacenamiento (navegación privada): no pasa nada.
  }
}

// ---------- Cómo se guarda en la anamnesis ----------

/** Cada código se guarda con su título («b280.2 Sensación de dolor»): se lee sin cargar el catálogo. */
export const makeEntry = (c: Coded, title: string) => `${formatCoded(c)} ${title}`;
export function readEntry(s: string): { coded: Coded; title: string } | null {
  const at = s.indexOf(" ");
  const coded = parseCoded(at === -1 ? s : s.slice(0, at));
  return coded ? { coded, title: at === -1 ? coded.code : s.slice(at + 1) } : null;
}
/** Para leer en la ficha, el informe y la carta. */
export const entriesText = (entries: string[]) =>
  entries
    .map(readEntry)
    .filter((e): e is NonNullable<ReturnType<typeof readEntry>> => !!e)
    .map((e) => codedText(e.coded, e.title))
    .join("\n");
