// FAAM, subescala Deporte: 8 ítems de 0 a 4 con «No aplica»; nota en % (0-100), más es mejor. Se suele pasar a
// continuación de la FAAM AVD (faam.ts).
import { answered, round1, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 4, label: "Ninguna dificultad" },
  { value: 3, label: "Dificultad leve" },
  { value: 2, label: "Dificultad moderada" },
  { value: 1, label: "Dificultad extrema" },
  { value: 0, label: "No puedo hacerlo" },
];

const TEXTS = [
  "Correr",
  "Saltar",
  "Caer tras un salto",
  "Arrancar y parar de golpe",
  "Cambiar de dirección o moverse en lateral",
  "Hacer actividades de bajo impacto",
  "Hacer la actividad con su técnica habitual",
  "Practicar su deporte preferido todo el tiempo que quiera",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "faam_deporte",
  instructions:
    "Responda a cada pregunta con la opción que mejor describa su estado durante la última semana. Si no hace la actividad por un motivo distinto del pie o el tobillo, marque «no aplicable».",
  sections: [
    {
      title: "Deporte",
      intro: "Por culpa del pie o del tobillo, ¿cuánta dificultad tiene para…?",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS, na: true })),
    },
  ],
  score(answers: Answers) {
    // «No aplica» no puntúa y se excluye: puntos obtenidos sobre el máximo de los ítems contestados.
    const values = answered(answers, IDS);
    if (values.length === 0) {
      throw new RangeError(
        "Faltan las 8 respuestas (sin contar «No aplica»): la FAAM Deporte necesita al menos una para calcular la nota.",
      );
    }
    const sum = values.reduce((s, v) => s + v, 0);
    return { score: round1((sum / (4 * values.length)) * 100) };
  },
  source:
    "Martin et al., 2005 (original), DOI 10.1177/107110070502601113; Cervera-Garvi et al., 2017 (validación española, FAAM-Sp), DOI 10.1186/s13047-017-0221-6. Texto de trabajo fiel al original: revisar con la versión española publicada (FAAM-Sp, Cervera-Garvi et al., 2017) antes de usarlo en consulta.",
};
