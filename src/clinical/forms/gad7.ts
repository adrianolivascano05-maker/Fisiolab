// GAD-7: síntomas de ansiedad de las últimas 2 semanas en 7 preguntas de 0 a 3; nota 0-21, menos es mejor.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Varios días" },
  { value: 2, label: "Más de la mitad de los días" },
  { value: 3, label: "Casi todos los días" },
];

const TEXTS = [
  "Sentirse nervioso, ansioso o con los nervios de punta",
  "No poder dejar de preocuparse o no poder controlar la preocupación",
  "Preocuparse demasiado por cosas distintas",
  "Tener dificultad para relajarse",
  "Estar tan inquieto que le cuesta quedarse quieto sentado",
  "Molestarse o irritarse con facilidad",
  "Sentir miedo, como si fuera a pasar algo terrible",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);


export const form: QuestionForm = {
  id: "gad7",
  instructions:
    "Piense en las últimas 2 semanas. En cada pregunta, marque con qué frecuencia le ha pasado. No hay respuestas buenas ni malas; responda a todas.",
  sections: [
    {
      title: "Últimas 2 semanas",
      intro: "Durante las últimas 2 semanas, ¿con qué frecuencia le ha pasado lo siguiente?",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 7 respuestas: el GAD-7 necesita todas para calcular la nota.`);
    }
    const total = round1(values.reduce((s, v) => s + v, 0));
    return { score: total };
  },
  source: "Spitzer, Kroenke, Williams y Löwe, 2006 (GAD-7 original). Texto de trabajo: revisar con la versión española publicada.",
};
