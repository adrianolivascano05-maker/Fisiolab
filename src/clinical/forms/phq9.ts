// PHQ-9: síntomas depresivos de las últimas 2 semanas en 9 preguntas de 0 a 3; nota 0-27, menos es mejor.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Varios días" },
  { value: 2, label: "Más de la mitad de los días" },
  { value: 3, label: "Casi todos los días" },
];

const TEXTS = [
  "Tener poco interés en hacer cosas o disfrutar poco haciéndolas",
  "Sentirse decaído, deprimido o sin esperanza",
  "Tener problemas para dormirse o para seguir dormido, o dormir demasiado",
  "Sentirse cansado o con poca energía",
  "Tener poco apetito o comer en exceso",
  "Sentirse mal consigo mismo: pensar que es un fracaso o que se ha fallado a sí mismo o a su familia",
  "Tener dificultad para concentrarse en algo, como leer el periódico o ver la televisión",
  "Moverse o hablar tan despacio que otras personas lo hayan podido notar, o lo contrario: estar tan inquieto o agitado que se ha movido mucho más de lo habitual",
  "Pensar que estaría mejor muerto o pensar en hacerse daño de alguna manera",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "phq9",
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
      throw new RangeError(`Faltan ${missing} de las 9 respuestas: el PHQ-9 necesita todas para calcular la nota.`);
    }
    const total = round1(values.reduce((s, v) => s + v, 0));
    return { score: total };
  },
  source: "Kroenke, Spitzer y Williams, 2001 (PHQ-9 original). Texto de trabajo: revisar con la versión española publicada.",
};
