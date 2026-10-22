// Calificadores propuestos con lo que ya hay en la ficha, pasando cada dato a porcentaje y llevándolo a la escala
// genérica de la CIF (0-4 % → 0, 5-24 % → 1, 25-49 % → 2, 50-95 % → 3, 96-100 % → 4):
// - Dolor (b280 y sus subcategorías): el último dolor de 0 a 10 (sesión o EVA de la anamnesis) × 10.
// - Actividades y participación (d): el último cuestionario de la zona (Oswestry, NDI, QuickDASH, SPADI, LEFS…),
//   como porcentaje de discapacidad.
// - Movilidad articular (b710): la asimetría de movilidad entre lados (100 − LSI).
// - Funciones emocionales (b152): PHQ-9 o GAD-7, como porcentaje de su máximo.
// Es orientativo: la CIF pide calibrar los porcentajes con instrumentos validados; el calificador lo decide el
// profesional.
import type { Answers, Questionnaire } from "../../data/clinical";
import { kindOf } from "../questionnaires";
import type { SymmetryRow } from "../symmetry";
import { makeEntry, type Coded } from "./cif";

export type Evidence = {
  /** El último dolor de 0 a 10 y de dónde sale. */
  pain: { value: number; from: string } | null;
  /** De más reciente a más antiguo. */
  questionnaires: Questionnaire[];
  symmetry: SymmetryRow[];
  regions: string[];
};
export type Suggestion = { q: number; why: string };

/** La escala genérica de la CIF. */
export function percentToQualifier(p: number): number {
  const v = Math.round(p);
  return v <= 4 ? 0 : v <= 24 ? 1 : v <= 49 ? 2 : v <= 95 ? 3 : 4;
}

const pct = (v: number) => `${Math.round(v)} %`;

/** El porcentaje de problema de un cuestionario (0 = ninguno), sea cual sea su sentido. */
function problemPercent(q: Questionnaire): number {
  const k = kindOf(q.kind, q.details);
  const span = k.max - k.min || 1;
  const p = k.better === "lower" ? (q.score - k.min) / span : (k.max - q.score) / span;
  return Math.max(0, Math.min(100, p * 100));
}

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

/** El último cuestionario de función de la zona de la anamnesis. */
function regionQuestionnaire(ev: Evidence): Questionnaire | undefined {
  return ev.questionnaires.find((q) => {
    const regions = kindOf(q.kind, q.details).regions ?? [];
    return regions.some((r) => ev.regions.includes(r));
  });
}

export function suggestQualifier(code: string, ev: Evidence): Suggestion | null {
  if (code.startsWith("b280") && ev.pain) {
    const p = ev.pain.value * 10;
    return { q: percentToQualifier(p), why: `${ev.pain.from}: dolor ${ev.pain.value}/10 = ${pct(p)}` };
  }
  if (code.startsWith("b710")) {
    const rom = ev.symmetry.filter((r) => !r.lowerIsBetter && /°/.test(r.left.text));
    if (rom.length) {
      const worst = rom.reduce((a, b) => (b.lsi < a.lsi ? b : a));
      const p = 100 - worst.lsi;
      return { q: percentToQualifier(p), why: `${worst.title}: ${worst.left.text} izquierda y ${worst.right.text} derecha, ${pct(p)} menos en el lado peor` };
    }
  }
  if (code.startsWith("b152")) {
    const q = ev.questionnaires.find((x) => x.kind === "phq9" || x.kind === "gad7");
    if (q) {
      const p = problemPercent(q);
      return { q: percentToQualifier(p), why: `${kindOf(q.kind, q.details).name} del ${fmtDay(q.performedAt)}: ${q.score} = ${pct(p)} del máximo` };
    }
  }
  if (code.startsWith("d")) {
    const q = regionQuestionnaire(ev);
    if (q) {
      const p = problemPercent(q);
      return { q: percentToQualifier(p), why: `${kindOf(q.kind, q.details).name} del ${fmtDay(q.performedAt)}: ${pct(p)} de discapacidad` };
    }
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

/**
 * El borrador rápido: los códigos que encajan con la zona y los datos de la ficha, cada uno con el calificador
 * propuesto (o «sin especificar» si no hay datos para proponerlo). No repite los que ya están.
 */
export function autoProfile(ev: Evidence, titleOf: (code: string) => string | undefined, existing: Set<string>): string[] {
  const codes: string[] = [];
  const add = (c: string) => !existing.has(c) && !codes.includes(c) && titleOf(c) && codes.push(c);
  for (const r of ev.regions) {
    const z = AUTO_BY_REGION[r];
    if (!z) continue;
    add(ev.pain ? z.pain : "b280");
    add(z.structure);
    z.activities.forEach(add);
  }
  if (!ev.regions.length) add("b280");
  if (ev.symmetry.some((r) => /°/.test(r.left.text))) add("b710");
  if (ev.questionnaires.some((q) => q.kind === "phq9" || q.kind === "gad7")) add("b152");
  return codes.map((code) => {
    const s = suggestQualifier(code, ev);
    const c: Coded = { code, q: s ? s.q : 8, capacity: null, facilitator: false };
    return makeEntry(c, titleOf(code)!);
  });
}

/** Lo que se sabe de la ficha para proponer calificadores. */
export function evidenceFrom(a: Answers, sessions: { pain: number | null; performedAt: string }[], questionnaires: Questionnaire[], symmetry: SymmetryRow[]): Evidence {
  const last = sessions.find((s) => s.pain !== null);
  const pain = last ? { value: last.pain!, from: `Sesión del ${fmtDay(last.performedAt)}` } : typeof a.eva === "number" ? { value: a.eva, from: "EVA de la anamnesis" } : null;
  return { pain, questionnaires, symmetry, regions: Array.isArray(a.regiones) ? (a.regiones as string[]) : [] };
}
