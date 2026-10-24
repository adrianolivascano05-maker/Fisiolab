// Banderas amarillas: factores psicológicos y sociales que pueden alargar el dolor y la discapacidad (miedo a
// moverse, catastrofismo, ánimo bajo, expectativas pasivas, el trabajo, dolor por todo el cuerpo). Se buscan en lo
// escrito en la anamnesis y se propone el cuestionario de la app que las mide. No etiqueta al paciente: es para
// preguntar y medir.
//
// Fuente (PubMed): Nicholas MK, Linton SJ, Watson PJ, Main CJ. Early identification and management of psychological
// risk factors («yellow flags») in patients with low back pain: a reappraisal. Phys Ther 2011.
// https://doi.org/10.2522/ptj.20100224
import type { Answers } from "../data/clinical";
import { fold } from "./redFlags";

export type YellowFlag = {
  id: string;
  label: string;
  words: string[];
  /** Cuestionarios de la app que lo miden (ids de src/clinical/questionnaires.ts). */
  measure: string[];
  ask: string;
};

const YELLOW_FLAGS: YellowFlag[] = [
  {
    id: "miedo",
    label: "Miedo al movimiento o a hacerse daño",
    words: ["miedo a mover", "me da miedo", "le da miedo", "no me atrevo", "no se atreve", "evito", "evita", "se me va a romper", "se le va a romper", "romperse", "hacerme dano", "hacerse dano", "mejor no moverlo", "reposo absoluto"],
    measure: ["tsk11", "fabq"],
    ask: "¿Qué cree que pasaría si se mueve o hace esa actividad? ¿Qué ha dejado de hacer por miedo?",
  },
  {
    id: "catastrofismo",
    label: "Pensamientos catastrofistas sobre el dolor",
    words: ["no voy a mejorar", "no va a mejorar", "nunca se me va a quitar", "nunca se le va a quitar", "insoportable", "no puedo mas", "no puede mas", "horrible", "lo peor", "desesperad", "algo grave"],
    measure: ["pcs"],
    ask: "Cuando le duele, ¿en qué piensa? ¿Cree que puede ser algo grave o que no tiene solución?",
  },
  {
    id: "animo",
    label: "Ánimo bajo, ansiedad o mucho estrés",
    words: ["triste", "deprimid", "depresion", "sin ganas", "desanimad", "ansiedad", "ansios", "angustia", "agobi", "estres alto", "mucho estres", "muy estresad", "lloro", "llora"],
    measure: ["phq9", "gad7"],
    ask: "¿Cómo está de ánimo últimamente? ¿Duerme bien? ¿Algo le preocupa especialmente?",
  },
  {
    id: "pasivo",
    label: "Expectativas pasivas o poca confianza en poder manejarlo",
    words: ["que me lo quiten", "que se lo quiten", "que me arreglen", "que le arreglen", "que me lo solucionen", "solo masaje", "no puedo hacer nada", "no puede hacer nada", "esperar a que se pase", "no depende de mi"],
    measure: ["pseq"],
    ask: "¿Qué cree que puede hacer usted para mejorar? ¿Qué espera que hagamos nosotros?",
  },
  {
    id: "trabajo",
    label: "Trabajo: baja, conflicto o insatisfacción",
    words: ["de baja", "baja laboral", "accidente laboral", "accidente de trabajo", "mutua", "abogado", "juicio", "indemnizacion", "despido", "no aguanto el trabajo", "odio mi trabajo"],
    measure: ["ompsq10"],
    ask: "¿Cómo está en el trabajo? ¿Cree que podrá volver o seguir? ¿Hay algún trámite o reclamación en marcha?",
  },
  {
    id: "generalizado",
    label: "Dolor extendido o por todo el cuerpo",
    words: ["me duele todo", "le duele todo", "todo el cuerpo", "fibromialgia", "dolor generalizado", "por todas partes"],
    measure: ["csi"],
    ask: "¿Le duelen también otras zonas? ¿Le molestan la luz, los ruidos o los olores más que antes?",
  },
];

export type YellowHit = { flag: YellowFlag; field: string; quote: string };

/** Las banderas amarillas que aparecen en lo escrito (sin contar lo dicho en negativo), una vez cada una. */
export function findYellowFlags(a: Answers, labelOf: (fieldId: string) => string = (id) => id): YellowHit[] {
  const out: YellowHit[] = [];
  for (const f of YELLOW_FLAGS) {
    found: for (const [field, v] of Object.entries(a)) {
      if (typeof v !== "string" || !v.trim()) continue;
      const text = fold(v);
      for (const w of f.words) {
        let at = text.indexOf(w);
        // Palabra entera por delante («evita», no «inevitable») y no dicha en negativo.
        while (at !== -1 && ((at > 0 && /[a-zñ]/.test(text[at - 1]!)) || /(^|[\s,.;(])(no|sin|niega|nunca)\s+(\S+\s+){0,1}$/.test(text.slice(Math.max(0, at - 20), at)))) at = text.indexOf(w, at + w.length);
        if (at !== -1) {
          const start = Math.max(0, at - 25);
          const end = Math.min(v.length, at + w.length + 25);
          out.push({ flag: f, field: labelOf(field), quote: `${start > 0 ? "…" : ""}${v.slice(start, end).trim()}${end < v.length ? "…" : ""}` });
          break found;
        }
      }
    }
  }
  return out;
}
