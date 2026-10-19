// FABQ (Fear-Avoidance Beliefs Questionnaire): creencias de miedo y evitación ante el dolor, en 16 frases de 0 a 6.
// No hay nota total: dos subescalas, actividad física (0-24) y trabajo (0-42); menos es mejor. Las frases 1, 8, 13,
// 14 y 16 se preguntan pero no puntúan.
import { answered, round1, type Answers, type Item, type QuestionForm } from "./types";

const SCALE = { from: 0, to: 6, ends: ["Completamente en desacuerdo", "Completamente de acuerdo"] as [string, string] };

const ACTIVITY = [
  "Mi dolor lo provocó la actividad física.",
  "La actividad física empeora mi dolor.",
  "La actividad física podría hacerle daño a mi espalda.",
  "No debería hacer actividades físicas que empeoran (o podrían empeorar) mi dolor.",
  "No puedo hacer actividades físicas que empeoran (o podrían empeorar) mi dolor.",
];

const WORK = [
  "Mi dolor lo provocó mi trabajo o un accidente en el trabajo.",
  "Mi trabajo agravó mi dolor.",
  "Tengo en marcha una reclamación para que me compensen por mi dolor.",
  "Mi trabajo es demasiado pesado para mí.",
  "Mi trabajo empeora o empeoraría mi dolor.",
  "Mi trabajo podría hacerle daño a mi espalda.",
  "Con el dolor que tengo ahora, no debería hacer mi trabajo habitual.",
  "Con el dolor que tengo ahora, no puedo hacer mi trabajo habitual.",
  "No puedo hacer mi trabajo habitual hasta que me traten el dolor.",
  "No creo que vuelva a mi trabajo habitual en los próximos 3 meses.",
  "No creo que pueda volver nunca a ese trabajo.",
];

const items: Item[] = [
  ...ACTIVITY.map((text, i) => ({ id: `i${i + 1}`, text, scale: SCALE })),
  ...WORK.map((text, i) => ({ id: `i${i + 6}`, text, scale: SCALE, na: true })),
];

/** Subescalas: nombre (el de ../questionnaires.ts) y los números de las frases que suman. */
const SUBSCALES: [string, number[]][] = [
  ["Actividad física", [2, 3, 4, 5]],
  ["Trabajo", [6, 7, 9, 10, 11, 12, 15]],
];

export const form: QuestionForm = {
  id: "fabq",
  instructions:
    "Estas frases son cosas que otros pacientes nos han contado sobre su dolor. Marque de 0 a 6 hasta qué punto está de acuerdo con cada una: 0 es completamente en desacuerdo, 3 es que no está seguro y 6, completamente de acuerdo. Si su dolor no es de espalda, piense en la zona que le duele.",
  sections: [
    {
      title: "Actividad física",
      intro: "Piense en cómo la actividad física (agacharse, levantar peso, caminar, conducir…) afecta o afectaría a su dolor.",
      items: items.slice(0, 5),
    },
    {
      title: "Trabajo",
      intro: "Piense en cómo su trabajo habitual afecta o afectaría a su dolor. Si no trabaja, marque «No aplica» en estas frases.",
      items: items.slice(5),
    },
  ],
  score(answers: Answers) {
    const subscores: { name: string; score: number }[] = [];
    for (const [name, ns] of SUBSCALES) {
      const values = answered(answers, ns.map((n) => `i${n}`));
      // Con una frase sin contestar (o «No aplica» en las de trabajo), la subescala no se calcula.
      if (values.length === ns.length) subscores.push({ name, score: round1(values.reduce((s, v) => s + v, 0)) });
    }
    if (!subscores.length) {
      throw new RangeError(
        "Faltan respuestas: para calcular el FABQ hacen falta las frases 2 a 5 (actividad física) o las 6, 7, 9, 10, 11, 12 y 15 (trabajo).",
      );
    }
    return { score: null, subscores };
  },
  source:
    "Waddell, Newton, Henderson, Somerville y Main, 1993 (FABQ original). Texto de trabajo: revisar con la versión española publicada.",
};
