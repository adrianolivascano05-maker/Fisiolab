// 5PQ (cuestionario de 5 preguntas de Hakim y Grahame): cribado autoinformado de hipermovilidad articular
// generalizada; Sí = 1, No = 0; nota 0-5. No es de mejor o peor: 2 o más «sí» es probable hipermovilidad.
import { answered, type Answers, type QuestionForm } from "./types";

const TEXTS = [
  "¿Puede ahora (o pudo alguna vez) apoyar las palmas de las manos en el suelo sin doblar las rodillas?",
  "¿Puede ahora (o pudo alguna vez) doblar el pulgar hasta tocar el antebrazo?",
  "De niño/a, ¿divertía a sus amigos contorsionando el cuerpo en posturas raras, o podía hacer el spagat (abrirse de piernas del todo)?",
  "De niño/a o adolescente, ¿se le salió (luxó) el hombro o la rótula en más de una ocasión?",
  "¿Se considera una persona «con articulaciones dobles» (muy flexible o «descoyuntada»)?",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

/** Hakim y Grahame 2003: 2 o más «sí», probable hipermovilidad. */
const CUTOFF = 2;

export const form: QuestionForm = {
  id: "hipermovilidad_5pq",
  instructions: "Conteste \"Sí\" o \"No\" a cada pregunta.",
  sections: [
    {
      title: "Preguntas",
      items: TEXTS.map((text, i) => ({
        id: IDS[i],
        text,
        options: [
          { value: 1, label: "Sí" },
          { value: 0, label: "No" },
        ],
      })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    if (!values.length) throw new RangeError("Faltan las 5 respuestas: el 5PQ necesita al menos una para puntuar.");
    // Si falta alguna, se puntúa con las contestadas y se marca incompleto.
    const missing = IDS.length - values.length;
    const yes = values.reduce((s, v) => s + v, 0);
    const left = missing === 1 ? "falta 1 respuesta" : `faltan ${missing} respuestas`;
    let text: string;
    if (yes >= CUTOFF) text = `Probable hipermovilidad (${CUTOFF} o más «sí»)`;
    else if (yes + missing < CUTOFF) text = `Cribado negativo (menos de ${CUTOFF} «sí»)`;
    else text = `Por ahora, menos de ${CUTOFF} «sí»: con lo que falta no se puede descartar la hipermovilidad`;
    if (missing) text += ` · Incompleto: ${left}`;
    return { score: yes, text };
  },
  source:
    "Hakim y Grahame, 2003 (original), PMID 12723715 (el DOI no figura en PubMed); Aranda-Sánchez et al., 2023 (adaptación cultural al español y fiabilidad, Perú), DOI 10.5867/medwave.2023.01.2575; sin validación en España. Texto de trabajo fiel al original: revisar con la versión española publicada (la adaptación peruana) antes de usarlo en consulta.",
};
