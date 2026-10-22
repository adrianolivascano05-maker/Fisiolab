// DN4 (Douleur Neuropathique 4): cribado de dolor neuropático en 10 ítems de sí (1) o no (0): 7 de entrevista y 3 de
// exploración, que rellena el fisioterapeuta; nota 0-10, menos es mejor. Desde 4, cribado positivo.
import { answered, round1, type Answers, type Item, type QuestionForm, type Section } from "./types";

const YES_NO = [
  { value: 1, label: "Sí" },
  { value: 0, label: "No" },
];

/** Ítems con ids correlativos («i1», «i2»…) desde `from`: la numeración del original (1 a 10). */
const items = (texts: string[], from: number): Item[] => texts.map((text, i) => ({ id: `i${i + from}`, text, options: YES_NO }));

const sections: Section[] = [
  {
    title: "Entrevista — Pregunta 1",
    intro: "¿Tiene su dolor alguna de las siguientes características?",
    items: items(["Quemazón", "Sensación de frío doloroso", "Descargas eléctricas"], 1),
  },
  {
    title: "Entrevista — Pregunta 2",
    intro: "¿Se asocia el dolor con alguno de los siguientes síntomas en la misma zona?",
    items: items(["Hormigueo", "Sensación de alfileres y agujas (pinchazos)", "Entumecimiento", "Picazón (escozor)"], 4),
  },
  {
    title: "Exploración (la rellena el fisioterapeuta) — Pregunta 3",
    clinician: true,
    intro: "¿Está el dolor localizado en una zona donde la exploración física muestra alguna de las siguientes características?",
    items: items(["Hipoestesia al tacto", "Hipoestesia al pinchazo"], 8),
  },
  {
    title: "Exploración (la rellena el fisioterapeuta) — Pregunta 4",
    clinician: true,
    intro: "En la zona dolorosa, ¿el dolor puede ser provocado o aumentado por…?",
    items: items(["El roce (cepillado suave)"], 10),
  },
];

const IDS = sections.flatMap((s) => s.items.map((i) => i.id));

/** Desde esta nota, cribado positivo de dolor neuropático (validación española y original). */
const CUTOFF = 4;

export const form: QuestionForm = {
  id: "dn4",
  instructions:
    "Responda a las preguntas siguientes marcando “Sí” o “No” en cada característica. Piense en el dolor por el que consulta.",
  sections,
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      // Es un cribado con punto de corte: los blancos no se imputan.
      throw new RangeError(`Faltan ${missing} de las 10 respuestas: el DN4 necesita todas para calcular la nota.`);
    }
    const total = round1(values.reduce((s, v) => s + v, 0));
    return {
      score: total,
      text:
        total >= CUTOFF
          ? `Cribado positivo de dolor neuropático (${CUTOFF} o más)`
          : `Cribado negativo de dolor neuropático (menos de ${CUTOFF})`,
    };
  },
  source:
    "Bouhassira et al., 2005 (DN4 original), DOI 10.1016/j.pain.2004.12.010; Pérez et al., 2007 (validación española), DOI 10.1186/1477-7525-5-66. Texto de trabajo fiel al original: revisar con la versión española publicada (Pérez et al., 2007) antes de usarlo en consulta.",
};
