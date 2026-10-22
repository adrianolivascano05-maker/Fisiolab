// ASES (American Shoulder and Elbow Surgeons, sección del paciente): 1 ítem de dolor de 0 a 10 y 10 actividades de 0 a
// 3 que se preguntan para cada brazo (solo puntúa el lado afectado). Dolor 0-50 + función 0-50 = nota 0-100, más es mejor.
import { answered, round1, type Answers, type Item, type Option, type QuestionForm } from "./types";

const OPTIONS: Option[] = [
  { value: 0, label: "Incapaz de hacerlo" },
  { value: 1, label: "Muy difícil" },
  { value: 2, label: "Algo difícil" },
  { value: 3, label: "Nada difícil" },
];

// Ítems 2 a 11 del original. En el trabajo y el deporte, el papel deja escribir cuál es; aquí no hay sitio para ello.
const ACTIVITIES = [
  "Ponerse un abrigo",
  "Dormir sobre el lado que le duele o que tiene afectado",
  "Lavarse la espalda o abrocharse el sujetador por detrás",
  "Asearse después de ir al baño",
  "Peinarse",
  "Alcanzar un estante alto",
  "Levantar 4,5 kg (10 libras) por encima del hombro",
  "Lanzar una pelota por encima de la cabeza",
  "Hacer su trabajo habitual",
  "Practicar su deporte habitual",
];

/** Las 10 actividades de un brazo: «d2»…«d11» el derecho, «i2»…«i11» el izquierdo (el número es el del original). */
const activities = (prefix: string): Item[] => ACTIVITIES.map((text, i) => ({ id: `${prefix}${i + 2}`, text, options: OPTIONS }));
const RIGHT = activities("d");
const LEFT = activities("i");

/** Lado afectado: hace falta para saber qué actividades puntúan. */
const SIDE = { right: 1, left: 2 };
/** Actividades del lado afectado necesarias como mínimo (la ficha propone 8 de 10 y prorratear con la media). */
const MIN_ACTIVITIES = 8;

export const form: QuestionForm = {
  id: "ases",
  instructions:
    "Marque en la escala la intensidad de su dolor de hombro hoy. Después, indique para cada actividad cuánta dificultad tiene para hacerla con cada brazo.",
  sections: [
    {
      title: "Hombro afectado",
      items: [
        {
          id: "lado",
          text: "¿Qué hombro es el afectado?",
          options: [
            { value: SIDE.right, label: "El derecho" },
            { value: SIDE.left, label: "El izquierdo" },
          ],
        },
      ],
    },
    {
      title: "Dolor",
      items: [{ id: "p1", text: "¿Cuánto le duele el hombro hoy?", scale: { from: 0, to: 10, ends: ["Ningún dolor", "El peor dolor posible"] } }],
    },
    { title: "Actividades con el brazo derecho", intro: "Responda por separado para el brazo derecho y para el izquierdo.", items: RIGHT },
    { title: "Actividades con el brazo izquierdo", items: LEFT },
  ],
  score(answers: Answers) {
    const side = answers.lado;
    if (side !== SIDE.right && side !== SIDE.left) {
      throw new RangeError("Falta 1 respuesta: el ASES necesita saber qué hombro es el afectado, porque solo puntúan las actividades de ese brazo.");
    }
    const pain = answers.p1;
    if (typeof pain !== "number") throw new RangeError("Falta 1 respuesta: el ASES necesita la intensidad del dolor para calcular la nota.");
    const arm = side === SIDE.right ? RIGHT : LEFT;
    const values = answered(answers, arm.map((i) => i.id));
    if (values.length < MIN_ACTIVITIES) {
      const name = side === SIDE.right ? "derecho" : "izquierdo";
      throw new RangeError(
        `Faltan ${arm.length - values.length} de las 10 actividades del brazo ${name}: el ASES necesita al menos ${MIN_ACTIVITIES} para calcular la nota.`,
      );
    }
    const painScore = (10 - pain) * 5;
    // Suma de las 10 × 5/3; con alguna en blanco, la media de las respondidas × 10 × 5/3.
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const fnScore = (mean * 10 * 5) / 3;
    return {
      score: round1(painScore + fnScore),
      // No están en el catálogo: van con su máximo.
      subscores: [
        { name: "Dolor", score: round1(painScore), max: 50 },
        { name: "Función", score: round1(fnScore), max: 50 },
      ],
    };
  },
  source:
    "Richards et al., 1994 (original), DOI 10.1016/S1058-2746(09)80019-0; Vrotsou et al., 2016 (validación española), DOI 10.1186/s12955-016-0552-1; Michener et al., 2002 (MCID), DOI 10.1067/mse.2002.127096; Policastro et al., 2019 (versión argentina), DOI 10.1016/j.msksp.2019.05.010. Texto de trabajo fiel al original: revisar con la versión española publicada (Vrotsou et al., 2016) antes de usarlo en consulta.",
};
