// PEG: intensidad media del dolor e interferencia en el disfrute de la vida y en la actividad general, en 3 ítems de
// 0 a 10; nota 0-10 (la media de los tres, con un decimal), menos es mejor.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const INTERFERENCE: [string, string] = ["No interfiere", "Interfiere por completo"];

export const form: QuestionForm = {
  id: "peg",
  instructions: "Responda a cada pregunta marcando el número que mejor describa su caso durante la última semana.",
  sections: [
    {
      title: "Última semana",
      items: [
        {
          id: "i1",
          text: "¿Qué número describe mejor su dolor, por término medio, durante la última semana?",
          scale: { from: 0, to: 10, ends: ["Sin dolor", "El peor dolor que pueda imaginar"] },
        },
        {
          id: "i2",
          text: "¿Qué número describe mejor cuánto ha interferido el dolor, durante la última semana, en su disfrute de la vida?",
          scale: { from: 0, to: 10, ends: INTERFERENCE },
        },
        {
          id: "i3",
          text: "¿Qué número describe mejor cuánto ha interferido el dolor, durante la última semana, en su actividad general?",
          scale: { from: 0, to: 10, ends: INTERFERENCE },
        },
      ],
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, ["i1", "i2", "i3"]);
    const missing = 3 - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 3 respuestas: la PEG necesita todas para calcular la nota.`);
    }
    // Sin puntos de corte ni cambio mínimo verificados: solo la nota.
    return { score: round1(values.reduce((s, v) => s + v, 0) / 3) };
  },
  source:
    "Krebs et al., 2009 (PEG original), DOI 10.1007/s11606-009-0981-1; sin validación española en PubMed para España; validación en español de EE. UU. (población hispana, PEG-S): Kapos et al., 2023, DOI 10.1016/j.jpain.2023.06.005. Texto de trabajo fiel al original: revisar con la versión en español publicada (PEG-S) antes de usarlo en consulta.",
};
