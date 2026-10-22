// PROMIS-10 (PROMIS Global Health): salud global en 10 ítems de 1 a 5 (5 = mejor; el dolor, de 0 a 10, se recodifica).
// Dos escalas, salud física (GPH) y salud mental (GMH), con puntuación bruta 4-20, más es mejor; la T se saca con la
// tabla oficial de HealthMeasures, que aquí no se reproduce. Los ítems de salud general y de rol social van sueltos.
import type { Answers, Option, QuestionForm } from "./types";

const opts = (...labels: string[]): Option[] => labels.map((label, i) => ({ value: 5 - i, label }));
const GOOD = opts("Excelente", "Muy buena", "Buena", "Regular", "Mala");

/** Dolor (Global07, de 0 a 10) recodificado para la GPH: 0 → 5; 1-3 → 4; 4-6 → 3; 7-9 → 2; 10 → 1. */
export const recodePain = (v: number) => (v === 0 ? 5 : v <= 3 ? 4 : v <= 6 ? 3 : v <= 9 ? 2 : 1);

/** Escalas: nombre (el de ../questionnaires.ts) e ítems, por su nombre en PROMIS (Global03…). */
const SCALES: [string, string[]][] = [
  ["Salud física global (GPH)", ["g03", "g06", "g07", "g08"]],
  ["Salud mental global (GMH)", ["g02", "g04", "g05", "g10"]],
];

export const form: QuestionForm = {
  id: "promis_10",
  instructions: "Por favor, conteste a cada pregunta marcando una sola respuesta.",
  sections: [
    {
      title: "Su salud",
      items: [
        { id: "g01", text: "En general, ¿diría que su salud es…?", options: GOOD },
        { id: "g02", text: "En general, ¿diría que su calidad de vida es…?", options: GOOD },
        { id: "g03", text: "En general, ¿cómo calificaría su salud física?", options: GOOD },
        { id: "g04", text: "En general, ¿cómo calificaría su salud mental, incluidos su estado de ánimo y su capacidad de pensar?", options: GOOD },
        { id: "g05", text: "En general, ¿cómo calificaría su satisfacción con sus actividades sociales y sus relaciones?", options: GOOD },
        {
          id: "g09",
          text: "En general, califique cómo realiza sus actividades y funciones sociales habituales (en casa, en el trabajo y en su comunidad, y sus responsabilidades como padre o madre, hijo/a, pareja, trabajador/a, amigo/a, etc.).",
          options: opts("Excelente", "Muy bien", "Bien", "Regular", "Mal"),
        },
        {
          id: "g06",
          text: "¿Hasta qué punto puede hacer sus actividades físicas de cada día, como caminar, subir escaleras, llevar la compra o mover una silla?",
          options: opts("Completamente", "Casi del todo", "Moderadamente", "Un poco", "Nada"),
        },
        {
          id: "g10",
          text: "En los últimos 7 días, ¿con qué frecuencia le han molestado problemas emocionales, como sentirse ansioso/a, deprimido/a o irritable?",
          options: opts("Nunca", "Rara vez", "A veces", "A menudo", "Siempre"),
        },
        {
          id: "g08",
          text: "En los últimos 7 días, ¿cómo calificaría su fatiga, de media?",
          options: opts("Ninguna", "Leve", "Moderada", "Grave", "Muy grave"),
        },
        {
          id: "g07",
          text: "En los últimos 7 días, ¿cómo calificaría su dolor, de media?",
          scale: { from: 0, to: 10, ends: ["Sin dolor", "El peor dolor imaginable"] },
        },
      ],
    },
  ],
  score(answers: Answers) {
    const value = (id: string) => {
      const v = answers[id];
      if (typeof v !== "number") return null;
      return id === "g07" ? recodePain(v) : v;
    };
    // Si falta algún ítem de una escala, esa escala no se calcula.
    const subscores = SCALES.flatMap(([name, ids]) => {
      const values = ids.map(value);
      if (values.some((v) => v === null)) return [];
      return [{ name, score: values.reduce((s: number, v) => s + v!, 0) }];
    });
    if (!subscores.length) {
      throw new RangeError(
        "Faltan respuestas: para la salud física hacen falta las preguntas 3, 7, 9 y 10, y para la salud mental, las 2, 4, 5 y 8.",
      );
    }
    return { score: null, subscores, text: "Puntuaciones brutas (4-20): para la puntuación T, usar la tabla oficial de HealthMeasures." };
  },
  source:
    "Hays et al., 2009 (original), DOI 10.1007/s11136-009-9496-9; sin validación española en PubMed. Existe una traducción oficial al español (HealthMeasures), que hay que usar en lugar de esta. Texto de trabajo fiel al original: revisarlo con esa versión española antes de usarlo en consulta.",
};
