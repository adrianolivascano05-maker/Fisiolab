// PCS (Pain Catastrophizing Scale): pensamientos y sentimientos ante el dolor en 13 frases de 0 a 4; nota 0-52,
// menos es mejor, con tres subescalas (rumiación, magnificación e indefensión).
import { answered, round1, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 0, label: "Nada en absoluto" },
  { value: 1, label: "Un poco" },
  { value: 2, label: "Moderadamente" },
  { value: 3, label: "Mucho" },
  { value: 4, label: "Todo el tiempo" },
];

const TEXTS = [
  "Me preocupa todo el rato si el dolor se acabará.",
  "Siento que ya no puedo seguir.",
  "Es terrible y pienso que nunca va a mejorar.",
  "Es horrible y siento que me supera.",
  "Siento que ya no lo aguanto más.",
  "Me da miedo que el dolor vaya a peor.",
  "Me vienen a la cabeza otras situaciones en las que tuve dolor.",
  "Deseo con ansia que el dolor desaparezca.",
  "No consigo quitármelo de la cabeza.",
  "No dejo de pensar en lo mucho que me duele.",
  "No dejo de pensar en las ganas que tengo de que el dolor pare.",
  "No hay nada que yo pueda hacer para que el dolor sea menos intenso.",
  "Me pregunto si me puede pasar algo grave.",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

/** Subescalas: los números de sus frases. */
const SUBSCALES: [string, number[]][] = [
  ["Rumiación", [8, 9, 10, 11]],
  ["Magnificación", [6, 7, 13]],
  ["Indefensión", [1, 2, 3, 4, 5, 12]],
];

/** A partir de esta nota, el catastrofismo se considera clínicamente relevante. */
const CUTOFF = 30;

export const form: QuestionForm = {
  id: "pcs",
  instructions:
    "Todos pasamos alguna vez por situaciones de dolor. Piense en lo que suele pensar y sentir cuando tiene dolor y marque, en cada frase, hasta qué punto le pasa. Responda a todas.",
  sections: [
    {
      title: "Cuando tengo dolor…",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 13 respuestas: la PCS necesita todas para calcular la nota.`);
    }
    const sum = (ns: number[]) => answered(answers, ns.map((n) => `i${n}`)).reduce((s, v) => s + v, 0);
    const total = round1(values.reduce((s, v) => s + v, 0));
    return {
      score: total,
      // No están en el catálogo: van con su máximo (4 por frase).
      subscores: SUBSCALES.map(([name, ns]) => ({ name, score: round1(sum(ns)), max: 4 * ns.length })),
      text:
        total >= CUTOFF
          ? `Catastrofismo clínicamente relevante (${CUTOFF} o más)`
          : `Por debajo del punto de corte de catastrofismo clínicamente relevante (${CUTOFF})`,
    };
  },
  source: "Sullivan, Bishop y Pivik, 1995 (PCS original). Texto de trabajo: revisar con la versión española publicada.",
};
