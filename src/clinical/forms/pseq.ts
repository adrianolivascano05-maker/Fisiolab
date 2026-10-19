// PSEQ (Pain Self-Efficacy Questionnaire): confianza en poder hacer cosas a pesar del dolor, en 10 frases de 0 a 6;
// nota 0-60, más es mejor.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const TEXTS = [
  "Puedo disfrutar de las cosas a pesar del dolor.",
  "Puedo hacer la mayoría de las tareas de casa (recoger, fregar los platos…) a pesar del dolor.",
  "Puedo ver a mis amigos o a mi familia tan a menudo como antes, a pesar del dolor.",
  "Puedo hacer frente al dolor en la mayoría de las situaciones.",
  "Puedo hacer algún tipo de trabajo a pesar del dolor (cuentan las tareas de casa y el trabajo pagado o no pagado).",
  "Todavía puedo hacer muchas de las cosas que me gustan, como aficiones o actividades de ocio, a pesar del dolor.",
  "Puedo hacer frente al dolor sin tomar medicación.",
  "Todavía puedo conseguir la mayoría de mis objetivos en la vida, a pesar del dolor.",
  "Puedo llevar una vida normal a pesar del dolor.",
  "Puedo ir siendo más activo poco a poco, a pesar del dolor.",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "pseq",
  instructions:
    "Piense en cómo está ahora. En cada frase, marque de 0 a 6 hasta qué punto se siente seguro de poder hacerlo a pesar del dolor: 0 es nada seguro y 6, totalmente seguro. Responda a todas.",
  sections: [
    {
      title: "A pesar del dolor",
      intro: "Ahora mismo, ¿hasta qué punto está seguro de lo que dice cada frase?",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, scale: { from: 0, to: 6, ends: ["Nada seguro", "Totalmente seguro"] } })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 10 respuestas: el PSEQ necesita todas para calcular la nota.`);
    }
    return { score: round1(values.reduce((s, v) => s + v, 0)) };
  },
  source: "Nicholas, 2007 (PSEQ original). Texto de trabajo: revisar con la versión española publicada.",
};
