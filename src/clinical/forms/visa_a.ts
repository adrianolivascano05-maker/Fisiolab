// VISA-A: gravedad de la tendinopatía aquílea en 8 preguntas; nota 0-100, más es mejor.
// La pregunta 8 tiene tres versiones (8a, 8b, 8c) y solo se contesta la que corresponde.
import { answered, round1, type Answers, type Item, type QuestionForm } from "./types";

const PAIN: [string, string] = ["Dolor muy fuerte", "Sin dolor"];

/** Opciones de la pregunta 8 con sus puntos según la versión (a, b o c). */
const minutes = (points: number[]) =>
  ["Nada", "1-10 minutos", "11-20 minutos", "21-30 minutos", "Más de 30 minutos"].map((label, i) => ({ value: points[i], label }));

const BASE = ["1", "2", "3", "4", "5", "6", "7"];
const BRANCH = ["8a", "8b", "8c"];

const items: Item[] = [
  {
    id: "1",
    text: "Al levantarse por la mañana, ¿durante cuántos minutos nota rigidez en la zona del tendón de Aquiles?",
    scale: { from: 0, to: 10, ends: ["100 minutos o más", "0 minutos"] },
  },
  {
    id: "2",
    text: "Una vez que ha entrado en calor a lo largo del día, ¿tiene dolor al estirar del todo el tendón de Aquiles sobre el borde de un escalón, con la rodilla recta?",
    scale: { from: 0, to: 10, ends: PAIN },
  },
  {
    id: "3",
    text: "Después de caminar 30 minutos por terreno llano, ¿tiene dolor en las dos horas siguientes? (Si el dolor no le deja caminar 30 minutos por llano, marque 0).",
    scale: { from: 0, to: 10, ends: PAIN },
  },
  {
    id: "4",
    text: "¿Tiene dolor al bajar escaleras con un paso normal?",
    scale: { from: 0, to: 10, ends: PAIN },
  },
  {
    id: "5",
    text: "¿Tiene dolor durante o justo después de ponerse de puntillas 10 veces sobre una sola pierna, desde el suelo plano?",
    scale: { from: 0, to: 10, ends: PAIN },
  },
  {
    id: "6",
    text: "¿Cuántos saltos seguidos sobre una sola pierna puede dar sin dolor?",
    scale: { from: 0, to: 10, ends: ["Ninguno", "10"] },
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
    text: "Si NO tiene dolor al hacer deportes que cargan el tendón de Aquiles: ¿cuánto tiempo puede entrenar o practicar?",
    options: minutes([0, 7, 14, 21, 30]),
    na: true,
  },
  {
    id: "8b",
    text: "Si tiene algo de dolor al hacer deportes que cargan el tendón de Aquiles, pero no le impide terminar el entrenamiento: ¿cuánto tiempo puede entrenar o practicar?",
    options: minutes([0, 4, 10, 14, 20]),
    na: true,
  },
  {
    id: "8c",
    text: "Si tiene un dolor que le impide terminar el entrenamiento en deportes que cargan el tendón de Aquiles: ¿cuánto tiempo puede entrenar o practicar?",
    options: minutes([0, 2, 5, 7, 10]),
    na: true,
  },
];

export const form: QuestionForm = {
  id: "visa_a",
  instructions:
    "Las preguntas se refieren a su tendón de Aquiles y a los síntomas de la última semana. En la pregunta 8 conteste solo la opción (a, b o c) que describa su caso y marque «No aplica» en las otras dos.",
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
      throw new RangeError(`Faltan ${BASE.length - base.length} respuestas de las preguntas 1 a 7 del VISA-A.`);
    }
    const q8 = answered(answers, BRANCH);
    if (q8.length !== 1) {
      throw new RangeError(
        q8.length === 0
          ? "Falta la pregunta 8 del VISA-A: conteste la 8a, la 8b o la 8c."
          : "En la pregunta 8 del VISA-A solo se puede contestar una opción (8a, 8b o 8c).",
      );
    }
    const sum = [...base, q8[0]].reduce((s, v) => s + v, 0);
    return { score: round1(sum) };
  },
  source: "Robinson et al., 2001 (VISA-A original); texto según la adaptación española VISA-A-S.",
};
