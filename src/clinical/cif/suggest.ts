// Lo que la ficha aporta a la hoja de la CIF, sin calificar nada (revisión del 30-10-2026): los atajos de la zona de
// la anamnesis (el dolor de esa parte, su estructura y las actividades que más suelen limitarse) y, para cada código,
// el dato de la ficha tal cual («EVA 6/10 en la anamnesis», «Oswestry 32 % el 20 oct», «Flexión de rodilla 110°
// izquierda y 130° derecha»). El calificador lo pone siempre el profesional: un código nuevo entra «sin especificar».
import type { Answers, Questionnaire } from "../../data/clinical";
import { displayName, kindOf, scoreText, type QDetails } from "../questionnaires";
import { cifLinks, informs } from "./questionnaireLinks";
import type { SymmetryRow } from "../symmetry";
import type { Coded } from "./cif";

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

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** «Oswestry (lumbar)» → «Oswestry», para que quepa en una línea. */
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

const questionnaireText = (q: Questionnaire) => `${shortName(q)} ${scoreText(kindOf(q.kind, q.details as QDetails), q.score)} el ${fmtDay(q.performedAt)}`;

/** El dato de la ficha que tiene que ver con este código, sin convertirlo a ninguna escala; null si no hay. */
export function evidenceText(code: string, ev: Evidence): string | null {
  if (code.startsWith("b280") && ev.pain) return upperFirst(ev.pain.short);
  if (code.startsWith("b710")) {
    const rom = ev.symmetry.filter((r) => !r.lowerIsBetter && /°/.test(r.left.text));
    if (rom.length) {
      const worst = rom.reduce((a, b) => (b.lsi < a.lsi ? b : a));
      return `${worst.title} ${worst.left.text} izquierda y ${worst.right.text} derecha`;
    }
  }
  const linked = linkedQuestionnaire(ev, code);
  if (linked) return questionnaireText(linked);
  if (code.startsWith("d")) {
    const q = regionQuestionnaire(ev);
    if (q) return questionnaireText(q);
  }
  return null;
}

/** Por zona: el dolor de esa parte, su estructura y las actividades que más suelen limitarse (atajos, no propuestas). */
const SHORTCUTS_BY_REGION: Record<string, { pain: string; structure: string; activities: string[] }> = {
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

/** Los atajos de la zona de la anamnesis (y la movilidad articular si hay ángulos medidos), en orden. */
export function proposedCodes(ev: Evidence): string[] {
  const codes: string[] = [];
  const add = (c: string) => !codes.includes(c) && codes.push(c);
  for (const r of ev.regions) {
    const z = SHORTCUTS_BY_REGION[r];
    if (!z) continue;
    add(z.pain);
    add(z.structure);
    z.activities.forEach(add);
  }
  if (!ev.regions.length) add("b280");
  if (ev.symmetry.some((r) => /°/.test(r.left.text))) add("b710");
  return codes;
}

/** Un código recién elegido: sin calificar (8, «sin especificar») y, si es una estructura, con el lado de la anamnesis. */
export function proposedCoded(code: string, ev?: Evidence): Coded {
  const c: Coded = { code, q: 8, capacity: null, facilitator: false };
  if (code[0] === "s" && ev?.side) c.location = ev.side;
  return c;
}

/** El lado de la anamnesis, en la escala de localización de la CIF. */
const SIDE: Record<string, number> = { Derecho: 1, Izquierdo: 2, "Los dos": 3 };

/** Lo que se sabe de la ficha, para enseñarlo como dato junto a cada código. */
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
