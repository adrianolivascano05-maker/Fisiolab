// JFLS-8 (Jaw Functional Limitation Scale, 8 ítems): limitación funcional de la mandíbula en el último mes, en 8
// escalas de 0 (sin limitación) a 10 (limitación grave); nota 0-10 (media de los ítems respondidos), menos es mejor.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const TEXTS = [
  "Masticar alimentos duros",
  "Masticar pollo (por ejemplo, hecho al horno)",
  "Comer alimentos blandos que no hay que masticar (por ejemplo, puré de patatas, compota de manzana, natillas, comida triturada)",
  "Abrir la boca lo suficiente para beber de una taza",
  "Tragar",
  "Bostezar",
  "Hablar",
  "Sonreír",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);
/**
 * Pueden faltar 2 ítems como mucho. Es la regla del manual de puntuación DC/TMD, que la ficha marca «sin verificar con
 * PubMed»; es la única que da, y sin ella habría que dar una media con un solo ítem.
 */
const MAX_MISSING = 2;

export const form: QuestionForm = {
  id: "jfls8",
  instructions:
    "Para cada una de las actividades siguientes, indique su grado de limitación durante el último mes. Si ha evitado por completo una actividad porque le resultaba demasiado difícil, marque 10. Si ha evitado una actividad por otros motivos que no sean el dolor o la dificultad, deje ese ítem en blanco.",
  sections: [
    {
      title: "Último mes",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, scale: { from: 0, to: 10, ends: ["Sin limitación", "Limitación grave"] } })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > MAX_MISSING) {
      throw new RangeError(
        `Faltan ${missing} de las 8 respuestas: el JFLS-8 necesita al menos ${IDS.length - MAX_MISSING} para calcular la media (pueden faltar ${MAX_MISSING} como mucho).`,
      );
    }
    return { score: round1(values.reduce((s, v) => s + v, 0) / values.length) };
  },
  source:
    "Ohrbach, Larsson y List, 2008 (original), DOI no figura en PubMed (PMID 18780535); sin validación española en PubMed. Texto de trabajo fiel al original: revisar con la versión española publicada (traducción del DC/TMD en rdc-tmdinternational.org) antes de usarlo en consulta.",
};
