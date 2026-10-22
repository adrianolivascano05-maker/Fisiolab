// IKDC 2000, formulario subjetivo de rodilla: 18 ítems que puntúan (10 preguntas; la 9 con 9 apartados) más la función
// antes de la lesión (10a), que se guarda pero no suma. Nota 0-100 (suma / máximo de lo contestado), más es mejor.
import { answered, round1, type Answers, type Item, type Option, type QuestionForm } from "./types";

/** Opciones de nivel de actividad (ítems 1, 5, 7 y 8). */
const LEVEL: Option[] = [
  { value: 4, label: "Actividades muy intensas, como saltar o hacer giros bruscos (baloncesto, fútbol)" },
  { value: 3, label: "Actividades intensas, como trabajo físico duro, esquí o tenis" },
  { value: 2, label: "Actividades moderadas, como trabajo físico moderado, correr o trotar" },
  { value: 1, label: "Actividades ligeras, como caminar, tareas de la casa o del jardín" },
  { value: 0, label: "No puedo hacer ninguna de estas actividades por la rodilla" },
];

const DIFFICULTY: Option[] = [
  { value: 4, label: "Ninguna dificultad" },
  { value: 3, label: "Dificultad mínima" },
  { value: 2, label: "Dificultad moderada" },
  { value: 1, label: "Dificultad extrema" },
  { value: 0, label: "No puedo hacerlo" },
];

/** Escala de 0 a 10 de la función de la rodilla (pregunta 10). */
const FUNCTION_SCALE = {
  from: 0,
  to: 10,
  ends: ["No poder hacer ninguna de sus actividades diarias habituales, deporte incluido", "Función normal y excelente"] as [string, string],
};

const SYMPTOMS: Item[] = [
  { id: "i1", text: "¿Cuál es el nivel de actividad más alto que puede hacer sin dolor importante en la rodilla?", options: LEVEL },
  {
    id: "i2",
    text: "En las últimas 4 semanas, o desde su lesión, ¿con qué frecuencia ha tenido dolor?",
    scale: { from: 0, to: 10, ends: ["Nunca", "Constantemente"] },
  },
  { id: "i3", text: "Si tiene dolor, ¿cuánto le duele?", scale: { from: 0, to: 10, ends: ["Nada", "El peor dolor imaginable"] } },
  {
    id: "i4",
    text: "En las últimas 4 semanas, o desde su lesión, ¿cuánta rigidez o hinchazón ha tenido en la rodilla?",
    options: [
      { value: 4, label: "Nada" },
      { value: 3, label: "Poca" },
      { value: 2, label: "Moderada" },
      { value: 1, label: "Mucha" },
      { value: 0, label: "Muchísima" },
    ],
  },
  { id: "i5", text: "¿Cuál es el nivel de actividad más alto que puede hacer sin que se le hinche mucho la rodilla?", options: LEVEL },
  {
    id: "i6",
    text: "En las últimas 4 semanas, o desde su lesión, ¿se le ha bloqueado o enganchado la rodilla?",
    options: [
      { value: 1, label: "No" },
      { value: 0, label: "Sí" },
    ],
  },
  { id: "i7", text: "¿Cuál es el nivel de actividad más alto que puede hacer sin que la rodilla le falle de forma importante?", options: LEVEL },
];

/** Pregunta 9, «¿Cuánto le dificulta la rodilla…?», con sus 9 apartados (a-i). */
const TASKS = [
  "subir escaleras",
  "bajar escaleras",
  "arrodillarse (apoyando la parte delantera de la rodilla)",
  "ponerse en cuclillas",
  "estar sentado con la rodilla doblada",
  "levantarse de una silla",
  "correr en línea recta",
  "saltar y caer sobre la pierna afectada",
  "parar y arrancar de golpe",
];

const SPORTS: Item[] = [
  { id: "i8", text: "¿Cuál es el nivel de actividad más alto que puede practicar de forma habitual?", options: LEVEL },
  ...TASKS.map((task, i) => ({ id: `i9${"abcdefghi"[i]}`, text: `¿Cuánto le dificulta la rodilla ${task}?`, options: DIFFICULTY })),
];

const FUNCTION: Item[] = [
  // 10a: se guarda, pero no puntúa.
  { id: "i10a", text: "Función antes de la lesión", scale: FUNCTION_SCALE },
  { id: "i10b", text: "Función actual", scale: FUNCTION_SCALE },
];

/** Puntos máximos de cada uno de los 18 ítems que puntúan (suman 87). */
const MAX: Record<string, number> = {
  ...Object.fromEntries([...SYMPTOMS, ...SPORTS].map((it) => [it.id, it.scale ? 10 : Math.max(...it.options!.map((o) => o.value))])),
  i10b: 10,
};
const SCORED = Object.keys(MAX);
/** Los ítems 2 y 3 se invierten: puntos = 10 − número marcado. */
const INVERTED = new Set(["i2", "i3"]);
/** Respondidos al menos 16 de los 18 (90 %); con más en blanco, no se calcula. */
const MIN_ANSWERED = 16;

export const form: QuestionForm = {
  id: "ikdc",
  instructions:
    "Responda pensando en su rodilla. Para las actividades, escoja el nivel más alto que puede hacer sin que aparezca el síntoma que se indica, aunque no lo practique realmente.",
  sections: [
    { title: "Síntomas", items: SYMPTOMS },
    { title: "Actividad deportiva", items: SPORTS },
    {
      title: "Función",
      intro:
        "Valore la función de su rodilla de 0 a 10, donde 10 es una función normal y excelente y 0 es no poder hacer ninguna de sus actividades diarias habituales, deporte incluido.",
      items: FUNCTION,
    },
  ],
  score(answers: Answers) {
    const done = SCORED.filter((id) => answered(answers, [id]).length === 1);
    if (done.length < MIN_ANSWERED) {
      throw new RangeError(
        `Faltan ${SCORED.length - done.length} de las 18 respuestas: el IKDC necesita al menos ${MIN_ANSWERED} para calcular la nota.`,
      );
    }
    const points = done.reduce((s, id) => s + (INVERTED.has(id) ? 10 - answers[id]! : answers[id]!), 0);
    const max = done.reduce((s, id) => s + MAX[id], 0);
    // (suma − mínimo posible) / (máximo de lo contestado − mínimo posible) × 100, con el mínimo en 0.
    return { score: round1((points / max) * 100) };
  },
  source:
    "Irrgang et al., 2001 (original), DOI 10.1177/03635465010290051301; Pujol et al., 2025 (traducción y adaptación cultural al español, sin estudio psicométrico completo), DOI 10.24875/CIRU.23000460; Irrgang et al., 2006 (MCID), DOI 10.1177/0363546506288855. Texto de trabajo fiel al original: revisar con la versión española publicada (Pujol et al., 2025) antes de usarlo en consulta.",
};
