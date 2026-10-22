// PRTEE (Patient-Rated Tennis Elbow Evaluation): dolor y discapacidad en la epicondilalgia lateral, en 15 ítems de 0 a
// 10 (5 de dolor y 10 de función). Dolor 0-50 + función 0-50 = nota 0-100, menos es mejor.
import { answered, round1, type Answers, type Item, type QuestionForm } from "./types";

const PAIN_ENDS: [string, string] = ["Sin dolor", "El peor dolor imaginable"];
const SPECIFIC_ENDS: [string, string] = ["Ninguna dificultad", "Incapaz de hacerlo"];
const USUAL_ENDS: [string, string] = ["Ninguna dificultad", "Tanta dificultad que no pudo hacer ninguna de esas actividades"];

const PAIN: Item[] = [
  "En reposo",
  "Al hacer una tarea con movimientos repetidos del brazo",
  "Al llevar una bolsa de la compra de plástico",
  "Cuando el dolor fue mínimo",
  "Cuando el dolor fue máximo",
].map((text, i) => ({ id: `i${i + 1}`, text, scale: { from: 0, to: 10, ends: PAIN_ENDS } }));

// En las de función se puede marcar «No aplica»: «si nunca ha realizado esa actividad, puede dejarla en blanco».
const SPECIFIC: Item[] = [
  "Girar el pomo de una puerta o una llave",
  "Llevar una bolsa de la compra o un maletín por el asa",
  "Llevarse a la boca una taza de café o un vaso de leche llenos",
  "Abrir un tarro",
  "Subirse los pantalones",
  "Escurrir un paño o una toalla mojados",
].map((text, i) => ({ id: `i${i + 6}`, text, scale: { from: 0, to: 10, ends: SPECIFIC_ENDS }, na: true }));

const USUAL: Item[] = [
  "Actividades personales (vestirse, lavarse)",
  "Tareas de la casa (limpieza, mantenimiento)",
  "Trabajo (su empleo o su trabajo habitual de cada día)",
  "Actividades de ocio o deportivas",
].map((text, i) => ({ id: `i${i + 12}`, text, scale: { from: 0, to: 10, ends: USUAL_ENDS }, na: true }));

const PAIN_IDS = PAIN.map((i) => i.id);
const FUNCTION_IDS = [...SPECIFIC, ...USUAL].map((i) => i.id);
/** Ítems de función sin responder que se pueden sustituir por la media de los demás (la ficha habla de «un ítem»). */
const MAX_MISSING_FUNCTION = 1;

export const form: QuestionForm = {
  id: "prtee",
  instructions:
    "Las siguientes preguntas nos ayudarán a saber cuánta dificultad ha tenido con el brazo durante la última semana. Describa los síntomas de su brazo como término medio a lo largo de la última semana, en una escala de 0 a 10. Responda a todas las preguntas. Si no realizó alguna actividad, calcule el dolor o la dificultad que habría tenido. Si nunca ha realizado esa actividad, puede dejarla en blanco.",
  sections: [
    { title: "Dolor en el brazo afectado", intro: "De 0 a 10 (0 = sin dolor; 10 = el peor dolor imaginable).", items: PAIN },
    {
      title: "Función, actividades específicas",
      intro: "De 0 a 10 (0 = ninguna dificultad; 10 = incapaz de hacerlo).",
      items: SPECIFIC,
    },
    {
      title: "Función, actividades habituales",
      intro: "Dificultad de 0 a 10 (0 = ninguna dificultad; 10 = tanta dificultad que no pudo hacer ninguna de esas actividades).",
      items: USUAL,
    },
  ],
  score(answers: Answers) {
    const pain = answered(answers, PAIN_IDS);
    const fn = answered(answers, FUNCTION_IDS);
    const missingPain = PAIN_IDS.length - pain.length;
    const missingFunction = FUNCTION_IDS.length - fn.length;
    if (missingPain > 0) {
      throw new RangeError(`Faltan ${missingPain} de las 5 respuestas de dolor: el PRTEE necesita todas las de dolor para calcular la nota.`);
    }
    if (missingFunction > MAX_MISSING_FUNCTION) {
      throw new RangeError(
        `Faltan ${missingFunction} de las 10 respuestas de función: el PRTEE solo puede sustituir ${MAX_MISSING_FUNCTION} por la media de las demás.`,
      );
    }
    const painScore = pain.reduce((s, v) => s + v, 0);
    // Un ítem de función sin responder vale la media de los demás: la suma de los 10 es la media × 10, y se divide entre 2.
    const fnScore = ((fn.reduce((s, v) => s + v, 0) / fn.length) * FUNCTION_IDS.length) / 2;
    return {
      score: round1(painScore + fnScore),
      // No están en el catálogo: van con su máximo.
      subscores: [
        { name: "Dolor", score: round1(painScore), max: 50 },
        { name: "Función", score: round1(fnScore), max: 50 },
      ],
    };
  },
  source:
    "Overend et al., 1999 (original, como Patient-rated forearm evaluation questionnaire), DOI 10.1016/s0894-1130(99)80031-3; Rompe et al., 2007 (validación como PRTEE), DOI 10.1197/j.jht.2006.10.003; Gallego-Izquierdo et al., 2020 (validación española), DOI 10.1002/jor.24820. Texto de trabajo fiel al original: revisar con la versión española publicada (Gallego-Izquierdo et al., 2020) antes de usarlo en consulta.",
};
