// ACL-RSI: preparación psicológica para volver al deporte tras una lesión del ligamento cruzado anterior.
// 12 ítems de 0 a 10 (el original va de 0 a 100 de 10 en 10); nota en % (más es mejor).
import { answered, round1, type Answers, type QuestionForm } from "./types";

/** Texto y extremos (0 y 10) de cada ítem. Los extremos van siempre de peor a mejor, así que no se invierte ninguno. */
const ROWS: [string, string, string][] = [
  ["¿Confía en que puede practicar su deporte al mismo nivel que antes?", "Nada seguro", "Totalmente seguro"],
  ["¿Cree que es probable que vuelva a lesionarse la rodilla si practica su deporte?", "Muy probable", "Nada probable"],
  ["¿Se siente nervioso al practicar su deporte?", "Muy nervioso", "Nada nervioso"],
  ["¿Confía en que la rodilla no le fallará al practicar su deporte?", "Nada seguro", "Totalmente seguro"],
  ["¿Confía en que podría practicar su deporte sin preocuparse por la rodilla?", "Nada seguro", "Totalmente seguro"],
  ["¿Le resulta frustrante tener que pensar en la rodilla cuando practica su deporte?", "Muy frustrante", "Nada frustrante"],
  ["¿Tiene miedo de volver a lesionarse la rodilla al practicar su deporte?", "Mucho miedo", "Ningún miedo"],
  ["¿Confía en que la rodilla aguantará cuando se le exija?", "Nada seguro", "Totalmente seguro"],
  ["¿Teme lesionarse la rodilla de forma accidental al practicar su deporte?", "Mucho temor", "Ningún temor"],
  [
    "¿Le impide practicar su deporte pensar que podría tener que pasar otra vez por la cirugía y la rehabilitación?",
    "Siempre",
    "Nunca",
  ],
  ["¿Confía en su capacidad para rendir bien en su deporte?", "Nada seguro", "Totalmente seguro"],
  ["¿Se siente tranquilo al practicar su deporte?", "Nada tranquilo", "Totalmente tranquilo"],
];

const IDS = ROWS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "acl_rsi",
  instructions:
    "Las preguntas se refieren al deporte principal que practicaba antes de lesionarse. Marque en cada una el número, de 0 a 10, que mejor describa lo que siente ahora.",
  sections: [
    {
      title: "Vuelta al deporte",
      items: ROWS.map(([text, worst, best], i) => ({ id: IDS[i], text, scale: { from: 0, to: 10, ends: [worst, best] } })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 12 respuestas: el ACL-RSI necesita todas para calcular la nota.`);
    }
    const sum = values.reduce((s, v) => s + v, 0);
    return { score: round1((sum / (10 * values.length)) * 100) };
  },
  source: "Webster, Feller y Lambros, 2008 (ACL-RSI original); versión española de Sala-Barat et al., 2020.",
};
