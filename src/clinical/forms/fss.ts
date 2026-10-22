// FSS (Fatigue Severity Scale): gravedad de la fatiga en 9 frases de 1 (muy en desacuerdo) a 7 (muy de acuerdo);
// nota = media de los 9 ítems, de 1 a 7, menos es mejor. Con 1 ítem sin contestar, media de los 8 contestados.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const TEXTS = [
  "Cuando estoy fatigado/a, tengo menos motivación.",
  "El ejercicio me produce fatiga.",
  "Me fatigo con facilidad.",
  "La fatiga interfiere en mi funcionamiento físico.",
  "La fatiga me causa problemas con frecuencia.",
  "La fatiga me impide mantener una actividad física de forma continuada.",
  "La fatiga interfiere en el cumplimiento de algunas de mis obligaciones y responsabilidades.",
  "La fatiga es uno de mis tres síntomas más incapacitantes.",
  "La fatiga interfiere en mi trabajo, mi familia o mi vida social.",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "fss",
  instructions:
    "Lea cada frase y elija el número del 1 al 7 que mejor indique su grado de acuerdo, pensando en la última semana. 1 = muy en desacuerdo; 7 = muy de acuerdo.",
  sections: [
    {
      title: "La última semana",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, scale: { from: 1, to: 7, ends: ["Muy en desacuerdo", "Muy de acuerdo"] } })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    // Criterio práctico de la ficha (no hay regla oficial): la media se calcula si falta como mucho 1 ítem.
    if (missing > 1) {
      throw new RangeError(`Faltan ${missing} de las 9 respuestas: la FSS necesita al menos 8 para calcular la media.`);
    }
    return { score: round1(values.reduce((s, v) => s + v, 0) / values.length) };
  },
  source:
    "Krupp et al., 1989 (original), DOI 10.1001/archneur.1989.00520460115022; sin validación española en PubMed. Texto de trabajo fiel al original: no hay versión española validada, así que hay que revisarlo antes de usarlo en consulta.",
};
