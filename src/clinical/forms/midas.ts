// MIDAS (Migraine Disability Assessment): días perdidos o con rendimiento reducido por la cefalea en los últimos 3
// meses, en 5 preguntas de 0 a 90 días; nota 0-450 (suma de días), menos es mejor. Las preguntas A (días con dolor de
// cabeza) y B (intensidad de 0 a 10) no suman: se enseñan aparte.
import { answered, type Answers, type Item, type QuestionForm } from "./types";

const DAYS: Item["input"] = { min: 0, max: 90, unit: "días" };

const TEXTS = [
  "¿Cuántos días de los últimos 3 meses faltó al trabajo o a clase por sus dolores de cabeza?",
  "¿Cuántos días de los últimos 3 meses se redujo a la mitad o más su rendimiento en el trabajo o en clase por sus dolores de cabeza? (No cuente los días que ya contó en la pregunta 1, en los que faltó al trabajo o a clase.)",
  "¿Cuántos días de los últimos 3 meses no hizo las tareas de casa por sus dolores de cabeza?",
  "¿Cuántos días de los últimos 3 meses se redujo a la mitad o más su rendimiento en las tareas de casa por sus dolores de cabeza? (No cuente los días que ya contó en la pregunta 3, en los que no hizo las tareas de casa.)",
  "¿Cuántos días de los últimos 3 meses se perdió actividades familiares, sociales o de ocio por sus dolores de cabeza?",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

/**
 * Grados habituales del MIDAS. La ficha los marca «sin verificar» (no están en el resumen de PubMed), así que solo se
 * enseñan como orientativos.
 */
const GRADES: { upTo: number; text: string }[] = [
  { upTo: 5, text: "Grado I (0–5): poca o ninguna discapacidad" },
  { upTo: 10, text: "Grado II (6–10): discapacidad leve" },
  { upTo: 20, text: "Grado III (11–20): discapacidad moderada" },
  { upTo: Infinity, text: "Grado IV (21 o más): discapacidad grave" },
];

export const form: QuestionForm = {
  id: "midas",
  instructions:
    "Responda a las siguientes preguntas sobre TODOS los dolores de cabeza que ha tenido en los últimos 3 meses. Escriba 0 si no realizó esa actividad en los últimos 3 meses.",
  sections: [
    {
      title: "Últimos 3 meses",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, input: DAYS })),
    },
    {
      title: "Preguntas A y B (no puntúan)",
      items: [
        {
          id: "a",
          text: "¿Cuántos días de los últimos 3 meses tuvo dolor de cabeza? (Si un dolor de cabeza duró más de un día, cuente cada día.)",
          input: DAYS,
        },
        {
          id: "b",
          text: "En una escala de 0 a 10, de media, ¿cuánto le dolieron esos dolores de cabeza?",
          scale: { from: 0, to: 10, ends: ["Sin dolor", "El peor dolor posible"] },
        },
      ],
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 5 respuestas: el MIDAS necesita las preguntas 1 a 5 para calcular la nota.`);
    }
    if (values.some((v) => v < 0 || v > 90)) throw new RangeError("Cada respuesta de la 1 a la 5 tiene que estar entre 0 y 90 días.");
    const total = values.reduce((s, v) => s + v, 0);
    // A y B no suman: van aparte, sobre su máximo, si se han contestado.
    const subscores: { name: string; score: number; max: number }[] = [];
    if (typeof answers.a === "number") subscores.push({ name: "A. Días con dolor de cabeza (no puntúa)", score: answers.a, max: 90 });
    if (typeof answers.b === "number") subscores.push({ name: "B. Intensidad media del dolor (no puntúa)", score: answers.b, max: 10 });
    const grade = GRADES.find((g) => total <= g.upTo)!.text;
    return { score: total, ...(subscores.length ? { subscores } : {}), text: `${grade} (orientativo, sin verificar)` };
  },
  source:
    "Stewart et al., 2001 (original), DOI 10.1212/wnl.56.suppl_1.s20; Rodríguez-Almagro et al., 2020 (validación española, estudiantes universitarios), DOI 10.1186/s12883-020-01646-y. Texto de trabajo fiel al original: revisar con la versión española publicada (Rodríguez-Almagro et al., 2020) antes de usarlo en consulta.",
};
