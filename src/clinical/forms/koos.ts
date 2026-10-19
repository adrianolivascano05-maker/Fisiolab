// KOOS (Knee injury and Osteoarthritis Outcome Score): 42 ítems en cinco subescalas.
// Cada subescala va de 0 (problemas extremos) a 100 (sin problemas); no hay nota total.

import { answered, round1, type Answers, type FormScore, type Item, type Option, type QuestionForm, type Section } from "./types";

// Respuestas, de 0 (sin problema) a 4 (problema extremo), como en la guía de puntuación.
export const often: Option[] = [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Raramente" },
  { value: 2, label: "A veces" },
  { value: 3, label: "A menudo" },
  { value: 4, label: "Siempre" },
];
// S4 y S5 («¿puede estirar / doblar…?») van al revés: «Siempre» es lo bueno.
const canDo: Option[] = [
  { value: 0, label: "Siempre" },
  { value: 1, label: "A menudo" },
  { value: 2, label: "A veces" },
  { value: 3, label: "Raramente" },
  { value: 4, label: "Nunca" },
];
export const intensityF: Option[] = [
  { value: 0, label: "Ninguna" },
  { value: 1, label: "Poca" },
  { value: 2, label: "Bastante" },
  { value: 3, label: "Mucha" },
  { value: 4, label: "Muchísima" },
];
export const intensityM: Option[] = [
  { value: 0, label: "Ninguno" },
  { value: 1, label: "Poco" },
  { value: 2, label: "Bastante" },
  { value: 3, label: "Mucho" },
  { value: 4, label: "Muchísimo" },
];
export const frequency = (last: string): Option[] => [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Cada mes" },
  { value: 2, label: "Cada semana" },
  { value: 3, label: "Cada día" },
  { value: 4, label: last },
];
export const amount = (last: string): Option[] => [
  { value: 0, label: "Nada" },
  { value: 1, label: "Un poco" },
  { value: 2, label: "Moderadamente" },
  { value: 3, label: "Mucho" },
  { value: 4, label: last },
];

/** Ítems con ids correlativos («a1», «a2»…) a partir de `from`. */
export const list = (prefix: string, texts: string[], options: Option[], from = 1): Item[] =>
  texts.map((text, i) => ({ id: `${prefix}${i + from}`, text, options }));

const sections: Section[] = [
  {
    title: "Síntomas",
    intro: "Piense en los síntomas que ha tenido en la rodilla durante la última semana.",
    items: [
      { id: "s1", text: "¿Se le hincha la rodilla?", options: often },
      { id: "s2", text: "¿Siente crujidos, oye chasquidos o algún otro tipo de ruido cuando mueve la rodilla?", options: often },
      { id: "s3", text: "¿Se le engancha o se le bloquea la rodilla al moverla?", options: often },
      { id: "s4", text: "¿Puede estirar la rodilla completamente?", options: canDo },
      { id: "s5", text: "¿Puede doblar la rodilla completamente?", options: canDo },
      { id: "s6", text: "Rigidez: ¿cuánta rigidez nota en la rodilla al despertarse por la mañana?", options: intensityF },
      { id: "s7", text: "Rigidez: ¿cuánta rigidez nota en la rodilla después de estar sentado, tumbado o descansando más tarde durante el día?", options: intensityF },
    ],
  },
  {
    title: "Dolor",
    intro: "Piense en el dolor de rodilla que ha tenido durante la última semana. Desde la segunda pregunta, indique cuánto dolor ha tenido en cada situación.",
    items: [
      { id: "p1", text: "¿Con qué frecuencia le duele la rodilla?", options: frequency("Siempre") },
      ...list(
        "p",
        [
          "Al girar o pivotar sobre la rodilla",
          "Al estirar la rodilla completamente",
          "Al doblar la rodilla completamente",
          "Al caminar sobre una superficie plana",
          "Al subir o bajar escaleras",
          "Por la noche, en la cama",
          "Sentado o tumbado",
          "De pie",
        ],
        intensityM,
        2,
      ),
    ],
  },
  {
    title: "AVD",
    intro:
      "Las siguientes preguntas son sobre su capacidad para moverse y valerse por sí mismo. Indique cuánta dificultad ha tenido durante la última semana, a causa de la rodilla, al hacer cada actividad.",
    items: list(
      "a",
      [
        "Bajar escaleras",
        "Subir escaleras",
        "Levantarse estando sentado",
        "Estar de pie",
        "Agacharse hasta el suelo o coger un objeto del suelo",
        "Caminar sobre una superficie plana",
        "Entrar o salir de un coche",
        "Ir de compras",
        "Ponerse los calcetines o las medias",
        "Levantarse de la cama",
        "Quitarse los calcetines o las medias",
        "Estar tumbado en la cama (darse la vuelta, mantener la posición de la rodilla)",
        "Entrar o salir de la bañera",
        "Estar sentado",
        "Sentarse o levantarse del inodoro",
        "Hacer tareas domésticas pesadas (mover cajas pesadas, fregar el suelo, etc.)",
        "Hacer tareas domésticas ligeras (cocinar, quitar el polvo, etc.)",
      ],
      intensityF,
    ),
  },
  {
    title: "Deporte y ocio",
    intro:
      "Las siguientes preguntas son sobre su capacidad para hacer actividades más exigentes. Indique cuánta dificultad ha tenido durante la última semana, a causa de la rodilla, al hacer cada actividad.",
    items: list(
      "sp",
      [
        "Ponerse en cuclillas",
        "Correr",
        "Saltar",
        "Girar o pivotar sobre la rodilla lesionada",
        "Arrodillarse",
      ],
      intensityF,
    ),
  },
  {
    title: "Calidad de vida",
    items: [
      { id: "q1", text: "¿Con qué frecuencia es consciente de su problema de rodilla?", options: frequency("Constantemente") },
      { id: "q2", text: "¿Ha modificado su forma de vida para evitar actividades que puedan dañarle la rodilla?", options: amount("Totalmente") },
      { id: "q3", text: "¿Cuánto le preocupa la falta de confianza en su rodilla?", options: amount("Muchísimo") },
      { id: "q4", text: "En general, ¿cuánta dificultad tiene con la rodilla?", options: intensityF },
    ],
  },
];

/** Orden de las subescalas en ../questionnaires.ts. */
const SUBSCALES = ["Dolor", "Síntomas", "AVD", "Deporte y ocio", "Calidad de vida"];

/** Cada subescala: 100 − media × 25, si está contestada al menos la mitad de sus ítems. */
export function subscaleScores(secs: Section[], a: Answers, name: string): FormScore {
  const subscores = SUBSCALES.flatMap((title) => {
    const ids = secs.find((s) => s.title === title)!.items.map((it) => it.id);
    const vals = answered(a, ids);
    if (vals.length * 2 < ids.length) return [];
    const mean = vals.reduce((x, y) => x + y, 0) / vals.length;
    return [{ name: title, score: round1(100 - (mean * 100) / 4) }];
  });
  if (subscores.length === 0) {
    throw new RangeError(`Faltan respuestas: conteste al menos la mitad de las preguntas de alguna parte del ${name}.`);
  }
  return { score: null, subscores };
}

export const form: QuestionForm = {
  id: "koos",
  instructions:
    "Este cuestionario le pregunta por su rodilla. Piense en cómo ha estado la rodilla durante la última semana y marque una sola respuesta en cada pregunta. Si no está seguro, marque la que le parezca más cercana.",
  sections,
  score: (a) => subscaleScores(sections, a, "KOOS"),
  source: "Roos et al., 1998 (KOOS); versión española de Vaquero et al., 2014.",
};
