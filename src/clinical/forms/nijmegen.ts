// Cuestionario de Nijmegen: 16 síntomas de hiperventilación o respiración disfuncional, de 0 (nunca) a 4 (muy a
// menudo); nota 0-64, menos es mejor; 23 o más sugiere síndrome de hiperventilación.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Rara vez" },
  { value: 2, label: "A veces" },
  { value: 3, label: "A menudo" },
  { value: 4, label: "Muy a menudo" },
];

const TEXTS = [
  "Dolor en el pecho",
  "Sensación de tensión",
  "Visión borrosa",
  "Mareos",
  "Sensación de confusión o de estar desorientado/a",
  "Respiración más rápida o más profunda",
  "Falta de aire",
  "Opresión en el pecho",
  "Sensación de hinchazón en el estómago",
  "Hormigueo en los dedos",
  "No poder respirar hondo",
  "Rigidez en los dedos o en los brazos",
  "Sensación de tirantez alrededor de la boca",
  "Manos o pies fríos",
  "Palpitaciones (el corazón se acelera)",
  "Sensación de ansiedad",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "nijmegen",
  instructions: "A continuación hay una lista de síntomas. Indique con qué frecuencia los tiene.",
  sections: [{ title: "Síntomas", items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS })) }],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 16 respuestas: el cuestionario de Nijmegen necesita todas para calcular la nota.`);
    }
    const total = round1(values.reduce((s, v) => s + v, 0));
    return { score: total };
  },
  source:
    "van Dixhoorn y Duivenvoorden, 1985 (original), DOI 10.1016/0022-3999(85)90042-x; sin validación española en PubMed (versión española usada por Martínez-Moragón et al., 2005, DOI 10.1016/s1579-2129(06)60221-8). Texto de trabajo fiel al original: revisar con la versión española publicada (la de Martínez-Moragón) antes de usarlo en consulta.",
};
