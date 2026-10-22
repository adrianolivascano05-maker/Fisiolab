// Brief IPQ: cómo percibe el paciente su problema de salud, en 8 ítems de 0 a 10 (los ítems 3, 4 y 7 se invierten);
// nota 0-80, menos es mejor (menos amenaza percibida). La pregunta 9 (las tres causas, texto libre) no puntúa y no se
// incluye: la app no tiene preguntas de texto libre.
import { answered, round1, type Answers, type Item, type QuestionForm } from "./types";

/** Texto, extremos (0 y 10) y qué representa cada ítem (para verlos sueltos). */
const ROWS: [string, string, string, string][] = [
  ["¿Cuánto afecta su problema a su vida?", "No afecta nada", "Afecta gravemente a mi vida", "Consecuencias"],
  ["¿Cuánto tiempo cree que va a durar su problema?", "Muy poco tiempo", "Para siempre", "Duración"],
  ["¿Cuánto control cree que tiene usted sobre su problema?", "Ningún control", "Control total", "Control"],
  ["¿Hasta qué punto cree que su tratamiento puede ayudar a su problema?", "Nada", "Muchísimo", "Eficacia del tratamiento"],
  ["¿Cuántos síntomas de su problema nota?", "Ningún síntoma", "Muchos síntomas graves", "Síntomas"],
  ["¿Cuánto le preocupa su problema?", "Nada", "Muchísimo", "Preocupación"],
  ["¿Hasta qué punto cree que entiende su problema?", "No lo entiendo nada", "Lo entiendo muy claramente", "Comprensión"],
  [
    "¿Cuánto le afecta emocionalmente su problema? (por ejemplo, ¿le hace sentir enfado, miedo, disgusto o tristeza?)",
    "No me afecta nada emocionalmente",
    "Me afecta muchísimo emocionalmente",
    "Impacto emocional",
  ],
];

const items: Item[] = ROWS.map(([text, from, to], i) => ({ id: `i${i + 1}`, text, scale: { from: 0, to: 10, ends: [from, to] } }));
const IDS = items.map((i) => i.id);
/** En estos el 10 es lo menos amenazante: puntúan 10 menos lo marcado. */
const REVERSED = ["i3", "i4", "i7"];

export const form: QuestionForm = {
  id: "bipq",
  instructions:
    "Para cada pregunta, marque el número que mejor refleje su opinión sobre su problema de salud (su dolor o lesión).",
  sections: [{ title: "Su problema de salud", items }],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(
        `Faltan ${missing} de las 8 respuestas: el Brief IPQ necesita las preguntas 1 a 8 para calcular el total (las contestadas se ven sueltas en el cuestionario).`,
      );
    }
    const total = round1(IDS.reduce((s, id) => s + (REVERSED.includes(id) ? 10 - answers[id]! : answers[id]!), 0));
    return {
      score: total,
      // Cada ítem suelto, tal como lo marcó (sin invertir), porque lo habitual es analizarlos también por separado.
      subscores: ROWS.map(([, , , name], i) => ({ name, score: answers[IDS[i]]!, max: 10 })),
    };
  },
  source:
    "Broadbent et al., 2006 (Brief IPQ original), DOI 10.1016/j.jpsychores.2005.10.020; Pacheco-Huergo et al., 2011 (validación lingüística española), DOI 10.1016/j.aprim.2010.11.022. Texto de trabajo fiel al original: revisar con la versión española publicada (Pacheco-Huergo et al., 2011) antes de usarlo en consulta.",
};
