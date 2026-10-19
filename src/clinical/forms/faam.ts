// FAAM, subescala de actividades de la vida diaria: 21 ítems de 0 a 4 con «No aplica»; nota en % (más es mejor).
import { answered, round1, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 4, label: "Ninguna dificultad" },
  { value: 3, label: "Dificultad leve" },
  { value: 2, label: "Dificultad moderada" },
  { value: 1, label: "Dificultad extrema" },
  { value: 0, label: "Incapaz de hacerlo" },
];

const TEXTS = [
  "Estar de pie",
  "Caminar por terreno llano",
  "Caminar descalzo por terreno llano",
  "Subir cuestas",
  "Bajar cuestas",
  "Subir escaleras",
  "Bajar escaleras",
  "Caminar por terreno irregular",
  "Subir y bajar bordillos",
  "Ponerse en cuclillas",
  "Ponerse de puntillas",
  "Empezar a caminar",
  "Caminar 5 minutos o menos",
  "Caminar unos 10 minutos",
  "Caminar 15 minutos o más",
  "Tareas de casa",
  "Actividades de la vida diaria",
  "Cuidado personal",
  "Trabajo ligero o moderado (estar de pie, caminar)",
  "Trabajo pesado (empujar o tirar, trepar, cargar peso)",
  "Actividades de ocio",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);
/** Respuestas necesarias como mínimo para dar la nota. */
const MIN_ANSWERED = 17;

export const form: QuestionForm = {
  id: "faam",
  instructions:
    "Responda a cada pregunta con la opción que mejor describa cómo ha estado durante la última semana. Si la actividad le cuesta por algo que no sea el pie o el tobillo, marque «No aplica».",
  sections: [
    {
      title: "Actividades de la vida diaria",
      intro: "Por su problema de pie o tobillo, ¿cuánta dificultad tiene para…",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS, na: true })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    if (values.length < MIN_ANSWERED) {
      throw new RangeError(
        `Hay ${values.length} respuestas válidas y hacen falta al menos ${MIN_ANSWERED} de 21 (sin contar «No aplica») para calcular la FAAM.`,
      );
    }
    // Puntos obtenidos sobre el máximo posible de los ítems contestados.
    const sum = values.reduce((s, v) => s + v, 0);
    return { score: round1((sum / (4 * values.length)) * 100) };
  },
  source: "Martin et al., 2005 (FAAM original); versión española FAAM-Sp de Cervera-Garvi et al., 2017.",
};
