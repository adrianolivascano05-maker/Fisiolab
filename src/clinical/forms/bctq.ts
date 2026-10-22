// BCTQ (Boston Carpal Tunnel Questionnaire): síndrome del túnel carpiano en 19 ítems de 1 a 5. Sin nota total: dos
// escalas que se dan por separado, gravedad de síntomas (SSS, 11 ítems) y estado funcional (FSS, 8 ítems), cada una
// como media de 1 a 5; menos es mejor.
import { answered, round1, type Answers, type Item, type Option, type QuestionForm } from "./types";

/** Opciones con valores del 1 al 5, en el orden de los textos. */
const options = (labels: string[]): Option[] => labels.map((label, i) => ({ value: i + 1, label }));

const SEVERITY_M = (none: string) => options([none, "Leve", "Moderado", "Intenso", "Muy intenso"]);
const SEVERITY_F = (none: string) => options([none, "Leve", "Moderada", "Intensa", "Muy intensa"]);
const WAKINGS = options(["Nunca", "Una vez", "2 o 3 veces", "4 o 5 veces", "Más de 5 veces"]);

const SYMPTOMS: Item[] = (
  [
    ["¿Cómo de intenso es el dolor de mano o muñeca que tiene por la noche?", SEVERITY_M("No tengo dolor por la noche")],
    ["¿Cuántas veces le ha despertado el dolor de mano o muñeca en una noche típica de las dos últimas semanas?", WAKINGS],
    ["¿Suele tener dolor en la mano o la muñeca durante el día?", SEVERITY_M("Nunca tengo dolor durante el día")],
    [
      "¿Con qué frecuencia tiene dolor de mano o muñeca durante el día?",
      options(["Nunca", "Una o dos veces al día", "De 3 a 5 veces al día", "Más de 5 veces al día", "El dolor es constante"]),
    ],
    [
      "Como término medio, ¿cuánto dura un episodio de dolor durante el día?",
      options([
        "Nunca tengo dolor durante el día",
        "Menos de 10 minutos",
        "De 10 a 60 minutos",
        "Más de 60 minutos",
        "El dolor es constante durante todo el día",
      ]),
    ],
    ["¿Tiene entumecimiento (pérdida de sensibilidad) en la mano?", SEVERITY_M("No")],
    ["¿Tiene debilidad en la mano o la muñeca?", SEVERITY_F("No")],
    ["¿Tiene sensación de hormigueo en la mano?", SEVERITY_F("No")],
    [
      "¿Cómo de intenso es el entumecimiento (pérdida de sensibilidad) o el hormigueo por la noche?",
      SEVERITY_M("No tengo entumecimiento ni hormigueo por la noche"),
    ],
    ["¿Cuántas veces le han despertado el entumecimiento o el hormigueo de la mano en una noche típica de las dos últimas semanas?", WAKINGS],
    [
      "¿Tiene dificultad para agarrar y usar objetos pequeños, como llaves o bolígrafos?",
      options(["Ninguna dificultad", "Dificultad leve", "Dificultad moderada", "Dificultad intensa", "Dificultad muy intensa"]),
    ],
  ] as [string, Option[]][]
).map(([text, opts], i) => ({ id: `i${i + 1}`, text, options: opts }));

const FUNCTION_OPTIONS = options([
  "Ninguna dificultad",
  "Dificultad leve",
  "Dificultad moderada",
  "Dificultad intensa",
  "No puedo hacerlo en absoluto por los síntomas de la mano o la muñeca",
]);

const FUNCTION: Item[] = [
  "Escribir",
  "Abrocharse la ropa",
  "Sujetar un libro mientras lee",
  "Sujetar el auricular del teléfono",
  "Abrir tarros",
  "Tareas domésticas",
  "Llevar las bolsas de la compra",
  "Bañarse y vestirse",
].map((text, i) => ({ id: `i${i + 12}`, text, options: FUNCTION_OPTIONS }));

/**
 * Cada escala: su nombre (el de ../questionnaires.ts), sus ítems y cuántos hacen falta como mínimo. La media se hace
 * con los respondidos; el mínimo del 80 % (9 de 11 y 7 de 8) es el criterio práctico que propone la ficha, no una
 * regla del artículo original.
 */
const SCALES: [string, Item[], number][] = [
  ["Gravedad de síntomas (SSS)", SYMPTOMS, 9],
  ["Estado funcional (FSS)", FUNCTION, 7],
];

export const form: QuestionForm = {
  id: "bctq",
  instructions:
    "Las siguientes preguntas se refieren a sus síntomas en un periodo típico de 24 horas durante las dos últimas semanas. Marque una respuesta en cada pregunta.",
  sections: [
    { title: "Escala de gravedad de síntomas (SSS)", items: SYMPTOMS },
    {
      title: "Escala de estado funcional (FSS)",
      intro: "¿Cuánta dificultad tiene para hacer las siguientes actividades por los síntomas de la mano y la muñeca?",
      items: FUNCTION,
    },
  ],
  score(answers: Answers) {
    const subscores: { name: string; score: number }[] = [];
    for (const [name, items, min] of SCALES) {
      const values = answered(answers, items.map((i) => i.id));
      if (values.length >= min) subscores.push({ name, score: round1(values.reduce((s, v) => s + v, 0) / values.length) });
    }
    if (!subscores.length) {
      throw new RangeError(
        "Faltan respuestas: para calcular el BCTQ hacen falta al menos 9 de las 11 preguntas de síntomas o 7 de las 8 de función.",
      );
    }
    return { score: null, subscores };
  },
  source:
    "Levine et al., 1993 (original), DOI 10.2106/00004623-199311000-00002; Oteo-Álvaro et al., 2016 (validación española), DOI 10.1016/j.medcli.2015.10.013. Texto de trabajo fiel al original: revisar con la versión española publicada (Oteo-Álvaro et al., 2016) antes de usarlo en consulta.",
};
