// FFI (Foot Function Index, versión original de 1991): 23 ítems de 0 a 10 en tres subescalas (dolor, discapacidad y
// limitación de actividad); cada subescala y el total van de 0 a 100 y se guardan aparte; menos es mejor.
import { answered, round1, type Answers, type Item, type QuestionForm } from "./types";

/** Ítems de 0 a 10 con «No aplica» (si no se le aplica, se deja sin marcar y no cuenta). */
const scaleItems = (prefix: string, texts: string[], ends: [string, string]): Item[] =>
  texts.map((text, i) => ({ id: `${prefix}${i + 1}`, text, scale: { from: 0, to: 10, ends }, na: true }));

const PAIN = scaleItems(
  "p",
  [
    "En su peor momento",
    "Al dar los primeros pasos por la mañana",
    "Al caminar descalzo",
    "Al estar de pie descalzo",
    "Al caminar con calzado",
    "Al estar de pie con calzado",
    "Al caminar con plantillas",
    "Al estar de pie con plantillas",
    "Al final del día",
  ],
  ["Ninguno", "El peor imaginable"],
);

const DISABILITY = scaleItems(
  "d",
  [
    "Caminar por casa",
    "Caminar fuera de casa",
    "Caminar 4 manzanas",
    "Subir escaleras",
    "Bajar escaleras",
    "Ponerse de puntillas",
    "Levantarse de una silla",
    "Subir bordillos",
    "Caminar deprisa",
  ],
  ["Ninguna", "Tanta que no puede hacerlo sin ayuda"],
);

const ACTIVITY = scaleItems(
  "l",
  [
    "Usa algún apoyo (bastón, andador, muletas) dentro de casa",
    "Usa algún apoyo fuera de casa",
    "Se queda en casa todo el día",
    "Se queda en la cama todo el día",
    "Limita sus actividades",
  ],
  ["Nunca", "Siempre"],
);

/** Las tres subescalas, con los nombres del catálogo (../catalog/pieDeporte.ts). */
const SUBSCALES: [string, Item[]][] = [
  ["Dolor", PAIN],
  ["Discapacidad", DISABILITY],
  ["Limitación de actividad", ACTIVITY],
];

export const form: QuestionForm = {
  id: "ffi",
  instructions:
    "Puntúe de 0 a 10 cada pregunta pensando en cómo ha estado su pie la última semana. Si una pregunta no se le aplica (por ejemplo, no usa plantillas), déjela en blanco.",
  sections: [
    { title: "Dolor", intro: "¿Cuánto dolor tiene en el pie…?", items: PAIN },
    { title: "Discapacidad", intro: "¿Cuánta dificultad tiene para…?", items: DISABILITY },
    { title: "Limitación de actividad", intro: "Por culpa del pie, ¿con qué frecuencia…?", items: ACTIVITY },
  ],
  score(answers: Answers) {
    // Cada subescala: suma de lo contestado sobre el máximo de lo contestado (10 por ítem), en %. Sin respuestas, sin nota.
    const subs = SUBSCALES.flatMap(([name, items]) => {
      const values = answered(answers, items.map((it) => it.id));
      if (values.length === 0) return [];
      return [{ name, exact: (values.reduce((s, v) => s + v, 0) / (10 * values.length)) * 100 }];
    });
    if (subs.length === 0) {
      throw new RangeError("Faltan las 23 respuestas (sin contar «No aplica»): el FFI necesita al menos una en alguna subescala para calcular su nota.");
    }
    // Total: la media de las tres subescalas, solo si las tres tienen nota.
    const total = subs.length === SUBSCALES.length ? [{ name: "Total", score: round1(subs.reduce((s, x) => s + x.exact, 0) / subs.length) }] : [];
    return { score: null, subscores: [...total, ...subs.map(({ name, exact }) => ({ name, score: round1(exact) }))] };
  },
  source:
    "Budiman-Mak et al., 1991 (original), DOI 10.1016/0895-4356(91)90220-4; Paez-Moguer et al., 2014 (validación española), DOI 10.1016/j.fas.2013.09.005. Texto de trabajo fiel al original: revisar con la versión española publicada (FFI-Sp, Paez-Moguer et al., 2014) antes de usarlo en consulta.",
};
