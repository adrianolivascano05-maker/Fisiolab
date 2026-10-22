// PRWE (Patient-Rated Wrist Evaluation): dolor y discapacidad de la muñeca en 15 ítems de 0 a 10 (5 de dolor y 10 de
// función). Dolor 0-50 + función 0-50 = nota 0-100, menos es mejor.
import { answered, round1, type Answers, type Item, type QuestionForm } from "./types";

const PAIN_ENDS: [string, string] = ["Sin dolor", "El peor dolor que haya tenido nunca"];
const SPECIFIC_ENDS: [string, string] = ["Ninguna dificultad", "Incapaz de hacerlo"];
const USUAL_ENDS: [string, string] = ["Ninguna dificultad", "Tanta dificultad que no pudo hacer ninguna de esas actividades"];

const PAIN: Item[] = [
  { id: "i1", text: "En reposo", scale: { from: 0, to: 10, ends: PAIN_ENDS } },
  { id: "i2", text: "Al hacer una tarea con movimientos repetidos de la muñeca", scale: { from: 0, to: 10, ends: PAIN_ENDS } },
  { id: "i3", text: "Al levantar un objeto pesado", scale: { from: 0, to: 10, ends: PAIN_ENDS } },
  { id: "i4", text: "Cuando el dolor es máximo", scale: { from: 0, to: 10, ends: PAIN_ENDS } },
  { id: "i5", text: "¿Con qué frecuencia tiene dolor?", scale: { from: 0, to: 10, ends: ["Nunca", "Siempre"] } },
];

// En las de función se puede marcar «No aplica»: «si nunca ha realizado esa actividad, puede dejarla en blanco».
const SPECIFIC: Item[] = [
  "Girar el pomo de una puerta con la mano afectada",
  "Cortar carne con un cuchillo en la mano afectada",
  "Abrocharse los botones de la camisa",
  "Apoyarse en la mano afectada para levantarse de una silla",
  "Llevar un objeto de unos 5 kg (10 libras) con la mano afectada",
  "Usar el papel higiénico con la mano afectada",
].map((text, i) => ({ id: `i${i + 6}`, text, scale: { from: 0, to: 10, ends: SPECIFIC_ENDS }, na: true }));

const USUAL: Item[] = [
  "Actividades de cuidado personal (vestirse, lavarse)",
  "Tareas de la casa (limpieza, mantenimiento)",
  "Trabajo (su empleo o su trabajo habitual de cada día)",
  "Actividades de ocio",
].map((text, i) => ({ id: `i${i + 12}`, text, scale: { from: 0, to: 10, ends: USUAL_ENDS }, na: true }));

const PAIN_IDS = PAIN.map((i) => i.id);
const FUNCTION_IDS = [...SPECIFIC, ...USUAL].map((i) => i.id);
/** Ítems de función sin responder que se pueden sustituir por la media de los demás (la ficha habla de «un ítem»). */
const MAX_MISSING_FUNCTION = 1;

export const form: QuestionForm = {
  id: "prwe",
  instructions:
    "Las siguientes preguntas nos ayudarán a saber cuánta dificultad ha tenido con la muñeca durante la última semana. Describa los síntomas de su muñeca como término medio a lo largo de la última semana, en una escala de 0 a 10. Responda a todas las preguntas. Si no realizó alguna actividad, calcule el dolor o la dificultad que habría tenido. Si nunca ha realizado esa actividad, puede dejarla en blanco.",
  sections: [
    {
      title: "Dolor",
      intro: "Puntúe el dolor de su muñeca de 0 a 10 (0 = sin dolor; 10 = el peor dolor que haya tenido nunca). En el ítem 5: 0 = nunca; 10 = siempre.",
      items: PAIN,
    },
    {
      title: "Función, actividades específicas",
      intro: "Puntúe la dificultad de 0 a 10 (0 = ninguna dificultad; 10 = incapaz de hacerlo).",
      items: SPECIFIC,
    },
    {
      title: "Función, actividades habituales",
      intro:
        "Puntúe la dificultad para hacer sus actividades habituales en cada área de 0 a 10 (0 = ninguna dificultad; 10 = tanta dificultad que no pudo hacer ninguna de esas actividades).",
      items: USUAL,
    },
  ],
  score(answers: Answers) {
    const pain = answered(answers, PAIN_IDS);
    const fn = answered(answers, FUNCTION_IDS);
    const missingPain = PAIN_IDS.length - pain.length;
    const missingFunction = FUNCTION_IDS.length - fn.length;
    if (missingPain > 0) {
      throw new RangeError(`Faltan ${missingPain} de las 5 respuestas de dolor: el PRWE necesita todas las de dolor para calcular la nota.`);
    }
    if (missingFunction > MAX_MISSING_FUNCTION) {
      throw new RangeError(
        `Faltan ${missingFunction} de las 10 respuestas de función: el PRWE solo puede sustituir ${MAX_MISSING_FUNCTION} por la media de las demás.`,
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
    "MacDermid et al., 1998 (original), DOI 10.1097/00005131-199811000-00009; Rosales et al., 2017 (validación española), DOI 10.1186/s12955-017-0745-2; Simental-Mendía et al., 2026 (versión mexicana), DOI 10.1080/09638288.2025.2574534. Texto de trabajo fiel al original: revisar con la versión española publicada (Rosales et al., 2017) antes de usarlo en consulta.",
};
