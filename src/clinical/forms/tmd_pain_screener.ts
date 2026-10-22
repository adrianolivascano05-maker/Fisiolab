// TMD Pain Screener (6 ítems): cribado del dolor por trastorno temporomandibular en los últimos 30 días. El ítem 1
// vale 0, 1 o 2 y los ítems 2 a 6, No = 0 y Sí = 1; nota 0-7 (suma), menos es mejor.
import { answered, type Answers, type QuestionForm } from "./types";

const YES_NO = [
  { value: 0, label: "No" },
  { value: 1, label: "Sí" },
];

const ACTIVITIES = [
  "Masticar alimentos duros o correosos",
  "Abrir la boca o mover la mandíbula hacia delante o hacia los lados",
  "Hábitos de la mandíbula, como mantener los dientes juntos, apretar o rechinar los dientes, o mascar chicle",
  "Otras actividades de la mandíbula, como hablar, besar o bostezar",
];

const IDS = ["i1", "i2", "i3", "i4", "i5", "i6"];
/**
 * Punto de corte del protocolo DC/TMD (3 o más, cribado positivo). La ficha lo marca «sin verificar con PubMed» (el
 * resumen del estudio original no lo da), así que solo se enseña como orientativo.
 */
const CUTOFF = 3;

export const form: QuestionForm = {
  id: "tmd_pain_screener",
  instructions: "Responda a las siguientes preguntas pensando en los últimos 30 días.",
  sections: [
    {
      title: "Últimos 30 días",
      items: [
        {
          id: "i1",
          text: "En los últimos 30 días, por término medio, ¿cuánto le duró el dolor en la mandíbula o en la sien, en cualquiera de los dos lados?",
          options: [
            { value: 0, label: "Sin dolor" },
            { value: 1, label: "El dolor va y viene" },
            { value: 2, label: "El dolor está siempre presente" },
          ],
        },
        { id: "i2", text: "En los últimos 30 días, ¿ha tenido dolor o rigidez en la mandíbula al despertarse?", options: YES_NO },
      ],
    },
    {
      title: "Actividades",
      intro:
        "En los últimos 30 días, ¿alguna de las siguientes actividades cambió el dolor (es decir, lo mejoró o lo empeoró) en la mandíbula o en la sien, en cualquiera de los dos lados?",
      items: ACTIVITIES.map((text, i) => ({ id: IDS[i + 2], text, options: YES_NO })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 6 respuestas: el TMD Pain Screener necesita todas para calcular el resultado.`);
    }
    const total = values.reduce((s, v) => s + v, 0);
    return {
      score: total,
      text:
        total >= CUTOFF
          ? `Cribado positivo según el protocolo DC/TMD (${CUTOFF} o más; punto de corte orientativo, sin verificar)`
          : `Por debajo del punto de corte del protocolo DC/TMD (${CUTOFF}; orientativo, sin verificar)`,
    };
  },
  source:
    "Gonzalez et al., 2011 (original), DOI 10.14219/jada.archive.2011.0088; sin validación española en PubMed. Texto de trabajo fiel al original: revisar con la versión española publicada antes de usarlo en consulta.",
};
