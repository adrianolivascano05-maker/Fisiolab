// SBST (STarT Back Screening Tool): cribado pronóstico del dolor lumbar en 9 ítems de 0 o 1 punto; nota 0-9 y
// subescala psicosocial 0-5 (ítems 5 a 9), menos es mejor. Clasifica el riesgo en bajo, medio o alto (Hill et al., 2008).
import { answered, type Answers, type QuestionForm } from "./types";

/** Ítems 1-8: En desacuerdo = 0; De acuerdo = 1. */
const AGREE = [
  { value: 0, label: "En desacuerdo" },
  { value: 1, label: "De acuerdo" },
];

/**
 * Ítem 9: el valor que se guarda es la respuesta (0-4), porque las tres primeras valen lo mismo (0) y las dos últimas
 * también (1) y con valores repetidos no se sabría cuál se marcó. Al puntuar: Nada / Un poco / Moderadamente = 0;
 * Mucho / Muchísimo = 1 (ver `points9`).
 */
const BOTHER = [
  { value: 0, label: "Nada" },
  { value: 1, label: "Un poco" },
  { value: 2, label: "Moderadamente" },
  { value: 3, label: "Mucho" },
  { value: 4, label: "Muchísimo" },
];
/** Lo que puntúa la respuesta del ítem 9. */
export const points9 = (answer: number) => (answer >= 3 ? 1 : 0);

const TEXTS = [
  "En algún momento de las últimas 2 semanas, el dolor de espalda se me ha extendido a la pierna o las piernas.",
  "En algún momento de las últimas 2 semanas, he tenido dolor en el hombro o en el cuello.",
  "Por el dolor de espalda, solo he andado distancias cortas.",
  "En las últimas 2 semanas, me he vestido más despacio de lo habitual por el dolor de espalda.",
  "Para una persona con un problema como el mío, no es realmente seguro hacer actividad física.",
  "He tenido pensamientos de preocupación en la cabeza gran parte del tiempo.",
  "Siento que mi dolor de espalda es terrible y que nunca va a mejorar.",
  "En general, no he disfrutado de todas las cosas con las que antes disfrutaba.",
];

const IDS = [...TEXTS.map((_, i) => `i${i + 1}`), "i9"];
/** Subescala psicosocial: ítems 5, 6, 7, 8 y 9. */
const PSYCHOSOCIAL = ["i5", "i6", "i7", "i8", "i9"];

export const form: QuestionForm = {
  id: "sbst",
  instructions: "Piense en las últimas 2 semanas y marque su respuesta a cada una de las siguientes preguntas.",
  sections: [
    {
      title: "Últimas 2 semanas",
      items: [
        ...TEXTS.map((text, i) => ({ id: IDS[i], text, options: AGREE })),
        { id: "i9", text: "En general, ¿cuánto le ha molestado el dolor de espalda en las últimas 2 semanas?", options: BOTHER },
      ],
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(
        `Faltan ${missing} de las 9 respuestas: el SBST necesita todas para calcular el riesgo (los puntos de corte son de 1 punto).`,
      );
    }
    const pts = (id: string) => (id === "i9" ? points9(answers.i9 as number) : (answers[id] as number));
    const total = IDS.reduce((s, id) => s + pts(id), 0);
    const psychosocial = PSYCHOSOCIAL.reduce((s, id) => s + pts(id), 0);
    // Clasificación de Hill et al. (2008).
    const text =
      total <= 3
        ? "Riesgo bajo (total de 0 a 3)"
        : psychosocial >= 4
          ? "Riesgo alto (total de 4 o más y subescala psicosocial de 4 o 5)"
          : "Riesgo medio (total de 4 o más y subescala psicosocial de 3 o menos)";
    return { score: total, subscores: [{ name: "Subescala psicosocial", score: psychosocial, max: 5 }], text };
  },
  source:
    "Hill et al., 2008 (original), DOI 10.1002/art.23563; Gusi et al., 2011 (versión española: traducción y adaptación transcultural, sin estudio psicométrico completo), DOI 10.1016/j.aprim.2010.05.019. Texto de trabajo fiel al original: revisar con la versión española publicada (Gusi et al., 2011) antes de usarlo en consulta.",
};
