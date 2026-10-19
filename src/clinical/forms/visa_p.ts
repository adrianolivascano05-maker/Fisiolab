// VISA-P: gravedad de la tendinopatía rotuliana en 8 preguntas; nota 0-100, más es mejor.
// La pregunta 8 tiene tres versiones (8a, 8b, 8c) y solo se contesta la que corresponde.
import { answered, round1, type Answers, type Item, type QuestionForm } from "./types";

const PAIN: [string, string] = ["Dolor muy fuerte", "Sin dolor"];

/** Opciones de la pregunta 8 con sus puntos según la versión (a, b o c). */
const minutes = (points: number[]) =>
  ["Nada", "1-5 minutos", "6-10 minutos", "11-15 minutos", "Más de 15 minutos"].map((label, i) => ({ value: points[i], label }));

const BASE = ["1", "2", "3", "4", "5", "6", "7"];
const BRANCH = ["8a", "8b", "8c"];

const items: Item[] = [
  {
    id: "1",
    text: "¿Cuántos minutos puede estar sentado sin dolor?",
    scale: { from: 0, to: 10, ends: ["0 minutos", "100 minutos o más"] },
  },
  {
    id: "2",
    text: "¿Tiene dolor al bajar escaleras con un paso normal?",
    scale: { from: 0, to: 10, ends: PAIN },
  },
  {
    id: "3",
    text: "¿Tiene dolor en la rodilla al estirarla del todo, de forma activa y sin apoyar peso?",
    scale: { from: 0, to: 10, ends: PAIN },
  },
  {
    id: "4",
    text: "¿Tiene dolor al hacer una zancada completa cargando el peso del cuerpo?",
    scale: { from: 0, to: 10, ends: PAIN },
  },
  {
    id: "5",
    text: "¿Tiene problemas para ponerse en cuclillas?",
    scale: { from: 0, to: 10, ends: ["No puedo", "Sin problemas"] },
  },
  {
    id: "6",
    text: "¿Tiene dolor durante o justo después de dar 10 saltos sobre una sola pierna?",
    scale: { from: 0, to: 10, ends: ["Dolor muy fuerte o no puedo", "Sin dolor"] },
  },
  {
    id: "7",
    text: "¿Hace ahora deporte u otra actividad física?",
    options: [
      { value: 0, label: "No, nada" },
      { value: 4, label: "Entrenamiento modificado, con o sin competición modificada" },
      { value: 7, label: "Entrenamiento completo, con o sin competición, pero no al mismo nivel que cuando empezaron los síntomas" },
      { value: 10, label: "Compito al mismo nivel o a uno más alto que cuando empezaron los síntomas" },
    ],
  },
  {
    id: "8a",
    text: "Si NO tiene dolor al hacer deporte: ¿cuánto tiempo puede entrenar o practicar?",
    options: minutes([0, 7, 14, 21, 30]),
    na: true,
  },
  {
    id: "8b",
    text: "Si tiene algo de dolor al hacer deporte, pero no le impide terminar el entrenamiento: ¿cuánto tiempo puede entrenar o practicar?",
    options: minutes([0, 4, 10, 14, 20]),
    na: true,
  },
  {
    id: "8c",
    text: "Si tiene un dolor que le impide terminar el entrenamiento: ¿cuánto tiempo puede entrenar o practicar?",
    options: minutes([0, 2, 5, 7, 10]),
    na: true,
  },
];

export const form: QuestionForm = {
  id: "visa_p",
  instructions:
    "Las preguntas se refieren al dolor en la parte delantera de la rodilla (tendón rotuliano) durante la última semana. En la pregunta 8 conteste solo la opción (a, b o c) que describa su caso y marque «No aplica» en las otras dos.",
  sections: [
    { title: "Síntomas y función", items: items.slice(0, 7) },
    {
      title: "Pregunta 8: tiempo de entrenamiento",
      intro: "Conteste solo una: la 8a si no tiene dolor, la 8b si tiene dolor pero puede terminar, o la 8c si el dolor le hace parar.",
      items: items.slice(7),
    },
  ],
  score(answers: Answers) {
    const base = answered(answers, BASE);
    if (base.length < BASE.length) {
      throw new RangeError(`Faltan ${BASE.length - base.length} respuestas de las preguntas 1 a 7 del VISA-P.`);
    }
    const q8 = answered(answers, BRANCH);
    if (q8.length !== 1) {
      throw new RangeError(
        q8.length === 0
          ? "Falta la pregunta 8 del VISA-P: conteste la 8a, la 8b o la 8c."
          : "En la pregunta 8 del VISA-P solo se puede contestar una opción (8a, 8b o 8c).",
      );
    }
    const sum = [...base, q8[0]].reduce((s, v) => s + v, 0);
    return { score: round1(sum) };
  },
  source: "Visentini et al., 1998 (VISA-P original); versión española VISA-P-Sp de Hernández-Sánchez et al., 2011.",
};
