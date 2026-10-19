// Örebro corto (ÖMPSQ-10): riesgo de que el dolor musculoesquelético se cronifique, en 10 preguntas que puntúan de 0
// a 10 (la primera, la duración, de 1 a 10); nota 0-100, menos es mejor. En las preguntas 3, 4 y 8 el 10 es lo
// mejor, así que puntúan al revés (10 menos lo marcado).
import { answered, round1, type Answers, type Item, type QuestionForm } from "./types";

const DURATION = ["0-1 semana", "1-2 semanas", "3-4 semanas", "4-5 semanas", "6-8 semanas", "9-11 semanas", "3-6 meses", "6-9 meses", "9-12 meses", "Más de 1 año"];

const AGREE: [string, string] = ["Totalmente en desacuerdo", "Totalmente de acuerdo"];
const ABLE: [string, string] = ["En absoluto", "Sin ninguna dificultad"];

const items: Item[] = [
  {
    id: "i1",
    text: "¿Desde cuándo tiene el problema de dolor por el que consulta ahora?",
    options: DURATION.map((label, i) => ({ value: i + 1, label })),
  },
  {
    id: "i2",
    text: "¿Cómo de fuerte ha sido su dolor durante la última semana?",
    scale: { from: 0, to: 10, ends: ["Sin dolor", "El peor dolor posible"] },
  },
  { id: "i3", text: "Puedo hacer un trabajo ligero durante una hora.", scale: { from: 0, to: 10, ends: ABLE } },
  { id: "i4", text: "Puedo dormir por la noche.", scale: { from: 0, to: 10, ends: ABLE } },
  {
    id: "i5",
    text: "¿Cuánta tensión o ansiedad ha sentido durante la última semana?",
    scale: { from: 0, to: 10, ends: ["Totalmente tranquilo y relajado", "Más tenso y ansioso que nunca"] },
  },
  {
    id: "i6",
    text: "¿Cuánto le ha afectado sentirse decaído o deprimido durante la última semana?",
    scale: { from: 0, to: 10, ends: ["Nada", "Muchísimo"] },
  },
  {
    id: "i7",
    text: "En su opinión, ¿qué riesgo hay de que su dolor actual se vuelva persistente?",
    scale: { from: 0, to: 10, ends: ["Ningún riesgo", "Un riesgo muy alto"] },
  },
  {
    id: "i8",
    text: "Según usted, ¿qué probabilidad hay de que dentro de 3 meses esté haciendo sus tareas habituales, en casa o en el trabajo?",
    scale: { from: 0, to: 10, ends: ["Ninguna", "Muy alta"] },
  },
  {
    id: "i9",
    text: "Si el dolor aumenta, es una señal de que debo parar lo que estoy haciendo hasta que el dolor baje.",
    scale: { from: 0, to: 10, ends: AGREE },
  },
  {
    id: "i10",
    text: "Con el dolor que tengo ahora, no debería hacer mis tareas habituales, en casa o en el trabajo.",
    scale: { from: 0, to: 10, ends: AGREE },
  },
];

const IDS = items.map((i) => i.id);
/** Preguntas en las que el 10 es lo mejor: puntúan 10 menos lo marcado. */
const REVERSED = ["i3", "i4", "i8"];
/** Desde esta nota, riesgo alto. */
const CUTOFF = 50;

export const form: QuestionForm = {
  id: "ompsq10",
  instructions:
    "Estas preguntas se refieren a su dolor actual. Léalas con calma y marque en cada una la respuesta que mejor describa su caso. Responda a todas.",
  sections: [
    { title: "Su dolor", items: items.slice(0, 2) },
    { title: "Su día a día y cómo se siente", items: items.slice(2) },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 10 respuestas: el Örebro corto necesita todas para calcular la nota.`);
    }
    const total = round1(IDS.reduce((s, id) => s + (REVERSED.includes(id) ? 10 - answers[id]! : answers[id]!), 0));
    return {
      score: total,
      text: total >= CUTOFF ? "Riesgo alto de discapacidad persistente" : "Riesgo bajo de discapacidad persistente",
    };
  },
  source:
    "Linton, Nicholas y MacDonald, 2011 (Örebro versión corta original). Texto de trabajo: revisar con la versión española publicada.",
};
