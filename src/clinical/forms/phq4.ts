// PHQ-4: cribado rápido de ansiedad (GAD-2: los 2 primeros ítems del GAD-7) y depresión (PHQ-2: los 2 primeros del
// PHQ-9) en 4 preguntas de 0 a 3; nota 0-12, menos es mejor. Reutiliza el texto de gad7.ts y phq9.ts.
import { form as gad7 } from "./gad7";
import { form as phq9 } from "./phq9";
import { answered, round1, type Answers, type Item, type QuestionForm } from "./types";

/** Un ítem de otro cuestionario de la app, tal cual, con el id que lleva aquí. */
const reuse = (f: QuestionForm, from: string, id: string): Item => ({ ...f.sections.flatMap((s) => s.items).find((i) => i.id === from)!, id });

const ANXIETY = ["i1", "i2"];
const DEPRESSION = ["i3", "i4"];
const IDS = [...ANXIETY, ...DEPRESSION];


export const form: QuestionForm = {
  id: "phq4",
  instructions: phq9.instructions,
  sections: [
    {
      title: phq9.sections[0].title,
      intro: phq9.sections[0].intro,
      items: [reuse(gad7, "i1", "i1"), reuse(gad7, "i2", "i2"), reuse(phq9, "i1", "i3"), reuse(phq9, "i2", "i4")],
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 4 respuestas: el PHQ-4 necesita todas para calcular la nota.`);
    }
    const sum = (ids: string[]) => round1(answered(answers, ids).reduce((s, v) => s + v, 0));
    const anxiety = sum(ANXIETY);
    const depression = sum(DEPRESSION);
    const total = sum(IDS);
    return {
      score: total,
      // No están en el catálogo: van con su máximo (3 por pregunta).
      subscores: [
        { name: "Ansiedad (GAD-2)", score: anxiety, max: 6 },
        { name: "Depresión (PHQ-2)", score: depression, max: 6 },
      ],
    };
  },
  source:
    "Kroenke et al., 2009 (PHQ-4 original), DOI 10.1176/appi.psy.50.6.613; Cano-Vindel et al., 2018 (validación española, atención primaria), DOI 10.1016/j.jad.2018.01.030; Löwe et al., 2009 (normas en población general), DOI 10.1016/j.jad.2009.06.019. Texto de trabajo fiel al original, el mismo del GAD-7 y del PHQ-9 de la app: revisar con la versión española publicada (Cano-Vindel et al., 2018) antes de usarlo en consulta.",
};
