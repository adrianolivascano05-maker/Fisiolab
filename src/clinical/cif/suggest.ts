// Calificadores propuestos con lo que ya hay en la ficha, pasando cada dato a porcentaje y llevándolo a la escala
// genérica de la CIF (0-4 % → 0, 5-24 % → 1, 25-49 % → 2, 50-95 % → 3, 96-100 % → 4):
// - Dolor (b280 y sus subcategorías): el último dolor de 0 a 10 (sesión o EVA de la anamnesis) × 10.
// - Movilidad articular (b710): la asimetría de movilidad entre lados (100 − LSI).
// - El resto: el último cuestionario que informa esa categoría (src/clinical/cif/questionnaireLinks.ts: Oswestry → d430,
//   PHQ-9 → b152, ISI → b134, DHI → b240…), como porcentaje de problema sobre su rango; para las actividades (d) sin
//   cuestionario propio, el último de la zona.
// Es orientativo: la CIF pide calibrar los porcentajes con instrumentos validados; el calificador lo decide el
// profesional.
import type { Answers, Questionnaire } from "../../data/clinical";
import { displayName, kindOf, scoreText, type QDetails } from "../questionnaires";
import { cifLinks, informs } from "./questionnaireLinks";
import type { SymmetryRow } from "../symmetry";
import { makeEntry, type Coded } from "./cif";

export type Evidence = {
  /** El último dolor de 0 a 10 y de dónde sale («Sesión del 21 oct»; en frase, «dolor 6/10 en la sesión del 21 oct»). */
  pain: { value: number; from: string; short: string } | null;
  /** De más reciente a más antiguo. */
  questionnaires: Questionnaire[];
  symmetry: SymmetryRow[];
  regions: string[];
  /** El lado de la anamnesis en la escala de localización de las estructuras (1 derecha, 2 izquierda, 3 ambos lados). */
  side?: number | null;
};
/** El calificador propuesto, por qué (para leerlo al elegir) y el dato en pocas palabras (para el texto redactado). */
export type Suggestion = { q: number; why: string; short: string };

/** La escala genérica de la CIF. */
export function percentToQualifier(p: number): number {
  const v = Math.round(p);
  return v <= 4 ? 0 : v <= 24 ? 1 : v <= 49 ? 2 : v <= 95 ? 3 : 4;
}

const pct = (v: number) => `${Math.round(v)} %`;
/** Para el borrador rápido cuentan los cuestionarios de estos días antes del último. */
const RECENT_DAYS = 120;

/** El porcentaje de problema de un cuestionario (0 = ninguno), sea cual sea su sentido. */
function problemPercent(q: Questionnaire): number {
  const k = kindOf(q.kind, q.details as QDetails);
  const span = k.max - k.min || 1;
  const p = k.better === "lower" ? (q.score - k.min) / span : (k.max - q.score) / span;
  return Math.max(0, Math.min(100, p * 100));
}

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** «Oswestry (lumbar)» → «Oswestry», para que quepa entre paréntesis en el texto redactado. */
const shortName = (q: Questionnaire) => displayName(q.kind, q.details as QDetails).replace(/\s*\([^)]*\)/g, "");

/** Los códigos CIF que informa un registro (con su subescala). */
const linksOf = (q: Questionnaire) => cifLinks(q.kind, (q.details as QDetails).subscale);

/** El último cuestionario de función de la zona de la anamnesis. */
function regionQuestionnaire(ev: Evidence): Questionnaire | undefined {
  return ev.questionnaires.find((q) => {
    const regions = kindOf(q.kind, q.details as QDetails).regions ?? [];
    return regions.some((r) => ev.regions.includes(r)) && linksOf(q).length > 0;
  });
}

/** El último cuestionario que informa esa categoría (src/clinical/cif/questionnaireLinks.ts). */
const linkedQuestionnaire = (ev: Evidence, code: string) => ev.questionnaires.find((q) => informs(linksOf(q), code));

function fromQuestionnaire(q: Questionnaire): Suggestion {
  const k = kindOf(q.kind, q.details as QDetails);
  const p = problemPercent(q);
  const value = k.unit === "%" ? `${pct(p)} de problema` : `${scoreText(k, q.score)}, ${pct(p)} de problema`;
  return {
    q: percentToQualifier(p),
    why: `${displayName(q.kind, q.details as QDetails)} del ${fmtDay(q.performedAt)}: ${value}`,
    short: `${shortName(q)} ${scoreText(k, q.score)} el ${fmtDay(q.performedAt)}`,
  };
}

export function suggestQualifier(code: string, ev: Evidence): Suggestion | null {
  if (code.startsWith("b280") && ev.pain) {
    const p = ev.pain.value * 10;
    return { q: percentToQualifier(p), why: `${ev.pain.from}: dolor ${ev.pain.value}/10 = ${pct(p)}`, short: ev.pain.short };
  }
  if (code.startsWith("b710")) {
    const rom = ev.symmetry.filter((r) => !r.lowerIsBetter && /°/.test(r.left.text));
    if (rom.length) {
      const worst = rom.reduce((a, b) => (b.lsi < a.lsi ? b : a));
      const p = 100 - worst.lsi;
      return {
        q: percentToQualifier(p),
        why: `${worst.title}: ${worst.left.text} izquierda y ${worst.right.text} derecha, ${pct(p)} menos en el lado peor`,
        short: `${lowerFirst(worst.title)} ${worst.left.text} izquierda y ${worst.right.text} derecha`,
      };
    }
  }
  const linked = linkedQuestionnaire(ev, code);
  if (linked) return fromQuestionnaire(linked);
  if (code.startsWith("d")) {
    const q = regionQuestionnaire(ev);
    if (q) return fromQuestionnaire(q);
  }
  return null;
}

/** Por zona: el dolor de esa parte, su estructura y las actividades que más suelen limitarse (sugerencia de la app). */
const AUTO_BY_REGION: Record<string, { pain: string; structure: string; activities: string[] }> = {
  atm: { pain: "b28010", structure: "s7103", activities: ["d550"] },
  cervical: { pain: "b28010", structure: "s76000", activities: ["d415", "d430"] },
  hombro: { pain: "b28014", structure: "s720", activities: ["d430", "d445"] },
  codo: { pain: "b28014", structure: "s73001", activities: ["d430", "d445"] },
  muneca_mano: { pain: "b28014", structure: "s73011", activities: ["d440", "d445"] },
  dorsal: { pain: "b28013", structure: "s76001", activities: ["d410", "d415"] },
  lumbar: { pain: "b28013", structure: "s76002", activities: ["d410", "d415", "d430"] },
  sacroiliaca: { pain: "b28013", structure: "s7401", activities: ["d410", "d415"] },
  cadera: { pain: "b28015", structure: "s75001", activities: ["d410", "d450", "d455"] },
  rodilla: { pain: "b28015", structure: "s75011", activities: ["d410", "d450", "d455"] },
  tobillo_pie: { pain: "b28015", structure: "s75021", activities: ["d450", "d455"] },
};

/** Los códigos que encajan con la zona y los datos de la ficha, en el orden en que se proponen. */
export function proposedCodes(ev: Evidence): string[] {
  const codes: string[] = [];
  const add = (c: string) => !codes.includes(c) && codes.push(c);
  for (const r of ev.regions) {
    const z = AUTO_BY_REGION[r];
    if (!z) continue;
    add(ev.pain ? z.pain : "b280");
    add(z.structure);
    z.activities.forEach(add);
  }
  if (!ev.regions.length) add("b280");
  if (ev.symmetry.some((r) => /°/.test(r.left.text))) add("b710");
  // Lo que informan los cuestionarios de los últimos 4 meses (el más reciente, el primero).
  const newest = ev.questionnaires[0] ? Date.parse(ev.questionnaires[0].performedAt) : 0;
  for (const q of ev.questionnaires.filter((x) => Date.parse(x.performedAt) >= newest - RECENT_DAYS * 86_400_000)) linksOf(q).forEach(add);
  // El dolor en general sobra si ya está el de una parte concreta.
  return codes.some((c) => c.startsWith("b280") && c !== "b280") ? codes.filter((c) => c !== "b280") : codes;
}

/**
 * Un código recién elegido: con el calificador propuesto (o «sin especificar» si no hay datos para proponerlo) y, si
 * es una estructura, con el lado de la anamnesis.
 */
export function proposedCoded(code: string, ev?: Evidence): Coded {
  const s = ev ? suggestQualifier(code, ev) : null;
  const c: Coded = { code, q: s ? s.q : 8, capacity: null, facilitator: false };
  if (code[0] === "s" && ev?.side) c.location = ev.side;
  return c;
}

/** El borrador rápido: los códigos propuestos con su calificador. No repite los que ya están. */
export function autoProfile(ev: Evidence, titleOf: (code: string) => string | undefined, existing: Set<string>): string[] {
  return proposedCodes(ev)
    .filter((code) => !existing.has(code) && titleOf(code))
    .map((code) => makeEntry(proposedCoded(code, ev), titleOf(code)!));
}

/** El lado de la anamnesis, en la escala de localización de la CIF. */
const SIDE: Record<string, number> = { Derecho: 1, Izquierdo: 2, "Los dos": 3 };

/** Lo que se sabe de la ficha para proponer calificadores. */
export function evidenceFrom(a: Answers, sessions: { pain: number | null; performedAt: string }[], questionnaires: Questionnaire[], symmetry: SymmetryRow[]): Evidence {
  const last = sessions.find((s) => s.pain !== null);
  const pain = last
    ? { value: last.pain!, from: `Sesión del ${fmtDay(last.performedAt)}`, short: `dolor ${last.pain}/10 en la sesión del ${fmtDay(last.performedAt)}` }
    : typeof a.eva === "number"
      ? { value: a.eva, from: "EVA de la anamnesis", short: `EVA ${a.eva}/10 en la anamnesis` }
      : null;
  const side = SIDE[typeof a.lado === "string" ? a.lado : ""] ?? null;
  return { pain, questionnaires, symmetry, regions: Array.isArray(a.regiones) ? (a.regiones as string[]) : [], side };
}
