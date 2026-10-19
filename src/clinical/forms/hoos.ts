// HOOS (Hip disability and Osteoarthritis Outcome Score): 40 ítems en cinco subescalas.
// Cada subescala va de 0 (problemas extremos) a 100 (sin problemas); no hay nota total.

import { amount, frequency, intensityF, intensityM, list, often, subscaleScores } from "./koos";
import type { QuestionForm, Section } from "./types";

const sections: Section[] = [
  {
    title: "Síntomas",
    intro: "Piense en los síntomas que ha tenido en la cadera durante la última semana.",
    items: [
      { id: "s1", text: "¿Siente crujidos, oye chasquidos o algún otro tipo de ruido en la cadera?", options: often },
      { id: "s2", text: "¿Tiene dificultad para separar mucho las piernas?", options: often },
      { id: "s3", text: "¿Tiene dificultad para dar pasos largos al caminar?", options: often },
      { id: "s4", text: "Rigidez: ¿cuánta rigidez nota en la cadera al despertarse por la mañana?", options: intensityF },
      { id: "s5", text: "Rigidez: ¿cuánta rigidez nota en la cadera después de estar sentado, tumbado o descansando más tarde durante el día?", options: intensityF },
    ],
  },
  {
    title: "Dolor",
    intro: "Piense en el dolor de cadera que ha tenido durante la última semana. Desde la segunda pregunta, indique cuánto dolor ha tenido en cada situación.",
    items: [
      { id: "p1", text: "¿Con qué frecuencia le duele la cadera?", options: frequency("Siempre") },
      ...list(
        "p",
        [
          "Al estirar la cadera completamente",
          "Al doblar la cadera completamente",
          "Al caminar sobre una superficie plana",
          "Al subir o bajar escaleras",
          "Por la noche, en la cama",
          "Sentado o tumbado",
          "De pie",
          "Al caminar sobre una superficie dura (asfalto, cemento, etc.)",
          "Al caminar sobre una superficie irregular",
        ],
        intensityM,
        2,
      ),
    ],
  },
  {
    title: "AVD",
    intro:
      "Las siguientes preguntas son sobre su capacidad para moverse y valerse por sí mismo. Indique cuánta dificultad ha tenido durante la última semana, a causa de la cadera, al hacer cada actividad.",
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
        "Estar tumbado en la cama (darse la vuelta, mantener la posición de la cadera)",
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
      "Las siguientes preguntas son sobre su capacidad para hacer actividades más exigentes. Indique cuánta dificultad ha tenido durante la última semana, a causa de la cadera, al hacer cada actividad.",
    items: list(
      "sp",
      [
        "Ponerse en cuclillas",
        "Correr",
        "Girar o pivotar sobre la pierna en carga",
        "Caminar sobre una superficie irregular",
      ],
      intensityF,
    ),
  },
  {
    title: "Calidad de vida",
    items: [
      { id: "q1", text: "¿Con qué frecuencia es consciente de su problema de cadera?", options: frequency("Constantemente") },
      { id: "q2", text: "¿Ha modificado su forma de vida para evitar actividades que puedan dañarle la cadera?", options: amount("Totalmente") },
      { id: "q3", text: "¿Cuánto le preocupa la falta de confianza en su cadera?", options: amount("Muchísimo") },
      { id: "q4", text: "En general, ¿cuánta dificultad tiene con la cadera?", options: intensityF },
    ],
  },
];

export const form: QuestionForm = {
  id: "hoos",
  instructions:
    "Este cuestionario le pregunta por su cadera. Piense en cómo ha estado la cadera durante la última semana y marque una sola respuesta en cada pregunta. Si no está seguro, marque la que le parezca más cercana.",
  sections,
  score: (a) => subscaleScores(sections, a, "HOOS"),
  source: "Nilsdotter et al., 2003 (HOOS); traducción al español basada en la versión de koos.org (HOOS 2.0).",
};
