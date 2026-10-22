// OSTRC-H2 (Oslo Sports Trauma Research Center, problemas de salud, 2.ª versión): 4 preguntas sobre la última semana;
// gravedad = suma de sus puntos, de 0 a 100, menos es mejor. Si en la 1 no hay problema, las demás cuentan 0.
import { answered, type Answers, type Option, type QuestionForm } from "./types";

const options = (rows: [number, string][]): Option[] => rows.map(([value, label]) => ({ value, label }));

const EXTENT = options([
  [0, "Nada"],
  [6, "En poca medida"],
  [13, "En moderada medida"],
  [19, "En gran medida"],
  [25, "No he podido participar"],
]);

/** P1 «participación completa sin problemas de salud»: el resto se rellena con 0 (lógica del cuestionario v2). */
const NO_PROBLEM = 0;
/** Problema importante: en la P2 o la P3, «en moderada medida» (13) o más. */
const SUBSTANTIAL = 13;

const FOLLOW_UP =
  "En el H2, anote si es lesión o enfermedad, la zona o los síntomas y los días sin poder entrenar; cada problema se registra por separado, con su propia puntuación.";

export const form: QuestionForm = {
  id: "ostrc_h2",
  instructions: "Responda pensando en los últimos 7 días, aunque no haya tenido ningún problema.",
  sections: [
    {
      title: "Última semana",
      intro: "Si en la pregunta 1 marca «participación completa sin problemas de salud», las demás cuentan como 0 y no hace falta contestarlas.",
      items: [
        {
          id: "p1",
          text: "¿Ha tenido dificultades para participar con normalidad en los entrenamientos y la competición por una lesión, una enfermedad u otro problema de salud en la última semana?",
          options: options([
            [0, "Participación completa sin problemas de salud"],
            [8, "Participación completa, pero con lesión o enfermedad"],
            [17, "Participación reducida por lesión o enfermedad"],
            [25, "No he podido participar por lesión o enfermedad"],
          ]),
        },
        {
          id: "p2",
          text: "¿En qué medida ha reducido el volumen de entrenamiento por una lesión, una enfermedad u otro problema de salud en la última semana?",
          options: EXTENT,
        },
        {
          id: "p3",
          text: "¿En qué medida ha afectado una lesión, una enfermedad u otro problema de salud a su rendimiento en la última semana?",
          options: EXTENT,
        },
        {
          id: "p4",
          text: "¿En qué medida ha tenido síntomas o molestias de salud en la última semana?",
          options: options([
            [0, "Ninguno"],
            [8, "Leves"],
            [17, "Moderados"],
            [25, "Intensos"],
          ]),
        },
      ],
    },
  ],
  score(answers: Answers) {
    const p1 = answers.p1;
    if (typeof p1 !== "number") {
      throw new RangeError("Falta la pregunta 1: el OSTRC-H2 la necesita para calcular la gravedad.");
    }
    if (p1 === NO_PROBLEM) return { score: 0, text: "Sin problemas de salud en la última semana" };
    const rest = answered(answers, ["p2", "p3", "p4"]);
    const missing = 3 - rest.length;
    if (missing > 0) {
      throw new RangeError(
        `Faltan ${missing} de las 4 respuestas: el OSTRC-H2 necesita todas para calcular la gravedad (salvo con «participación completa sin problemas de salud» en la pregunta 1).`,
      );
    }
    const substantial = (answers.p2 ?? 0) >= SUBSTANTIAL || (answers.p3 ?? 0) >= SUBSTANTIAL;
    const kind = substantial
      ? "Problema importante (en la pregunta 2 o la 3, «en moderada medida», «en gran medida» o «no he podido participar»)"
      : "Problema de salud no importante (en la pregunta 2 y la 3, «nada» o «en poca medida»)";
    return { score: p1 + rest.reduce((s, v) => s + v, 0), text: `${kind}. ${FOLLOW_UP}` };
  },
  source:
    "Clarsen et al., 2013 (original, OSTRC-O), DOI 10.1136/bjsports-2012-091524; Clarsen et al., 2020 (versión 2, H2 y O2), DOI 10.1136/bjsports-2019-101337; Bailón-Cerezo et al., 2020 (validación española, deportistas de 12 a 17 años), DOI 10.1177/2325967120968552; Martínez-Cal et al., 2023 (validación española del OSTRC-O de primera versión, balonmano), DOI 10.3390/healthcare11060912. Texto de trabajo fiel al original: revisar con la versión española publicada (Bailón-Cerezo et al., 2020) antes de usarlo en consulta.",
};
