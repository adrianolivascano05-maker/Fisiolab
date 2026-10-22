// ICIQ-UI SF: frecuencia (0-5), cantidad (0, 2, 4 o 6) e impacto (0-10) de la pérdida de orina en las últimas 4
// semanas; nota 0-21, menos es mejor. La cuarta pregunta (cuándo pierde orina) no puntúa: se guarda como lista.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const SCORED = ["i1", "i2", "i3"];

const SITUATIONS = [
  "Nunca",
  "Antes de llegar al servicio",
  "Al toser o estornudar",
  "Mientras duerme",
  "Al hacer esfuerzos físicos o ejercicio",
  "Cuando ha terminado de orinar y ya se ha vestido",
  "Sin motivo evidente",
  "De forma continua",
];

/** Gravedad según Klovning 2009 (de 1 a 21; el 0 no entra en ningún tramo). */
const severity = (total: number) =>
  total < 1 ? undefined : total <= 5 ? "leve (1-5)" : total <= 12 ? "moderada (6-12)" : total <= 18 ? "grave (13-18)" : "muy grave (19-21)";

export const form: QuestionForm = {
  id: "iciq_ui_sf",
  instructions:
    "Mucha gente pierde orina alguna vez. Queremos saber cuántas personas pierden orina y cuánto les afecta. Le agradeceremos que conteste a estas preguntas pensando en cómo se ha encontrado, de media, durante las últimas 4 semanas.",
  sections: [
    {
      title: "Pérdidas de orina",
      items: [
        {
          id: "i1",
          text: "¿Con qué frecuencia pierde orina?",
          options: [
            { value: 0, label: "Nunca" },
            { value: 1, label: "Una vez a la semana o menos" },
            { value: 2, label: "Dos o tres veces a la semana" },
            { value: 3, label: "Una vez al día" },
            { value: 4, label: "Varias veces al día" },
            { value: 5, label: "Continuamente" },
          ],
        },
        {
          id: "i2",
          text: "Nos gustaría saber cuánta orina cree usted que pierde. ¿Qué cantidad de orina pierde habitualmente (tanto si lleva protección como si no)?",
          options: [
            { value: 0, label: "Nada" },
            { value: 2, label: "Muy poca cantidad" },
            { value: 4, label: "Una cantidad moderada" },
            { value: 6, label: "Mucha cantidad" },
          ],
        },
        {
          id: "i3",
          text: "En general, ¿cuánto afectan las pérdidas de orina a su vida diaria?",
          scale: { from: 0, to: 10, ends: ["Nada", "Mucho"] },
        },
      ],
    },
    {
      title: "¿Cuándo pierde orina?",
      intro: "Marque todo lo que le pase: «Sí» en lo que le pase y «No» en lo demás. Esta pregunta no puntúa.",
      items: SITUATIONS.map((text, i) => ({
        id: `s${i + 1}`,
        text,
        options: [
          { value: 1, label: "Sí" },
          { value: 0, label: "No" },
        ],
      })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, SCORED);
    const missing = SCORED.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 3 respuestas que puntúan: el ICIQ-UI SF necesita las preguntas 1, 2 y 3 para calcular la nota.`);
    }
    const total = round1(values.reduce((s, v) => s + v, 0));
    const level = severity(total);
    return level ? { score: total, text: `Incontinencia ${level}` } : { score: total };
  },
  source:
    "Avery et al., 2004 (original), DOI 10.1002/nau.20041; Espuña Pons et al., 2004 (validación española), DOI 10.1016/s0025-7753(04)74212-8; Klovning et al., 2009 (gravedad), DOI 10.1002/nau.20674. El ICIQ facilita con el permiso el texto oficial español: hay que usar ese texto. Texto de trabajo fiel al original: revisar con la versión española publicada antes de usarlo en consulta.",
};
