// RMDQ (Roland-Morris Disability Questionnaire): discapacidad por dolor lumbar en el día de hoy, en 24 frases que se
// marcan si describen al paciente (1 punto) o se dejan sin marcar (0); nota 0-24, menos es mejor.
import type { Answers, QuestionForm } from "./types";

/** Marcada = 1; sin marcar = 0. Dejarla en blanco es lo mismo que «No me describe». */
const OPTIONS = [
  { value: 1, label: "Sí, me describe hoy" },
  { value: 0, label: "No me describe" },
];

const TEXTS = [
  "Me quedo en casa la mayor parte del tiempo por mi espalda.",
  "Cambio de postura con frecuencia para intentar que mi espalda esté cómoda.",
  "Ando más despacio de lo habitual por mi espalda.",
  "Por mi espalda, no hago ninguna de las tareas que suelo hacer en casa.",
  "Por mi espalda, me agarro a la barandilla para subir escaleras.",
  "Por mi espalda, me tumbo a descansar más a menudo.",
  "Por mi espalda, tengo que agarrarme a algo para levantarme de un sillón.",
  "Por mi espalda, intento que otras personas hagan las cosas por mí.",
  "Me visto más despacio de lo habitual por mi espalda.",
  "Solo me quedo de pie durante ratos cortos por mi espalda.",
  "Por mi espalda, procuro no agacharme ni arrodillarme.",
  "Me cuesta levantarme de una silla por mi espalda.",
  "Me duele la espalda casi todo el tiempo.",
  "Me cuesta darme la vuelta en la cama por mi espalda.",
  "Tengo poco apetito por mi dolor de espalda.",
  "Me cuesta ponerme los calcetines (o las medias) por el dolor de espalda.",
  "Solo ando distancias cortas por mi espalda.",
  "Duermo peor por mi espalda.",
  "Por mi dolor de espalda, necesito ayuda de otra persona para vestirme.",
  "Paso sentado/a la mayor parte del día por mi espalda.",
  "Evito las tareas pesadas de la casa por mi espalda.",
  "Por mi dolor de espalda, estoy más irritable y de peor humor con la gente de lo habitual.",
  "Por mi espalda, subo las escaleras más despacio de lo habitual.",
  "Me quedo en la cama la mayor parte del tiempo por mi espalda.",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "rmdq",
  instructions:
    "Cuando le duele la espalda, puede que le cueste hacer algunas de las cosas que hace habitualmente. Esta lista contiene frases que la gente usa para describirse cuando le duele la espalda. Al leerlas, puede que alguna le llame la atención porque le describe a usted hoy. Léalas y marque solo las frases que le describan a usted hoy. Si una frase no le describe, déjela sin marcar y pase a la siguiente.",
  sections: [
    {
      title: "Frases",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS })),
    },
  ],
  score(answers: Answers) {
    // Una frase sin marcar cuenta como 0: no hay respuestas en blanco, así que la nota siempre se puede calcular.
    return { score: IDS.filter((id) => answers[id] === 1).length };
  },
  source:
    "Roland y Morris, 1983 (original), DOI 10.1097/00007632-198303000-00004; Kovacs et al., 2002 (validación española), DOI 10.1097/00007632-200203010-00016; Ostelo et al., 2008 (cambio mínimo importante), DOI 10.1097/BRS.0b013e31815e3a10. Texto de trabajo fiel al original: revisar con la versión española publicada (Kovacs et al., 2002) antes de usarlo en consulta.",
};
