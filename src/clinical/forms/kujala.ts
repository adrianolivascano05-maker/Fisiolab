// Kujala / AKPS (Anterior Knee Pain Scale): síntomas y limitación funcional en el dolor femoropatelar, en 13 apartados
// que puntúan cada uno lo suyo (de 5 o de 10 como máximo); nota 0-100, más es mejor. Sin prorrateo: necesita los 13.
import { answered, round1, type Answers, type Option, type QuestionForm } from "./types";

/** Opciones con sus puntos, en el orden del original (de mejor a peor). */
const opts = (rows: [number, string][]): Option[] => rows.map(([value, label]) => ({ value, label }));

const ITEMS: [string, Option[]][] = [
  ["Cojera", opts([[5, "No cojeo"], [3, "Cojeo leve o de vez en cuando"], [0, "Cojeo siempre"]])],
  ["Apoyo del peso", opts([[5, "Apoyo todo el peso sin dolor"], [3, "Apoyar me duele"], [0, "No puedo apoyar el peso"]])],
  ["Caminar", opts([[5, "Sin límite"], [3, "Más de 2 km"], [2, "Entre 1 y 2 km"], [0, "No puedo caminar"]])],
  ["Escaleras", opts([[10, "Sin dificultad"], [8, "Un poco de dolor al bajar"], [5, "Dolor al bajar y al subir"], [0, "No puedo"]])],
  [
    "Ponerse en cuclillas",
    opts([
      [5, "Sin dificultad"],
      [4, "Me duele si lo hago repetidamente"],
      [3, "Me duele cada vez"],
      [2, "Solo puedo si no cargo todo el peso"],
      [0, "No puedo"],
    ]),
  ],
  [
    "Correr",
    opts([
      [10, "Sin dificultad"],
      [8, "Dolor después de más de 2 km"],
      [6, "Un poco de dolor desde el principio"],
      [3, "Dolor intenso"],
      [0, "No puedo"],
    ]),
  ],
  ["Saltar", opts([[10, "Sin dificultad"], [7, "Un poco de dificultad"], [2, "Dolor constante"], [0, "No puedo"]])],
  [
    "Estar sentado mucho rato con las rodillas dobladas",
    opts([
      [10, "Sin dificultad"],
      [8, "Me duele después de hacer ejercicio"],
      [6, "Dolor constante"],
      [4, "El dolor me obliga a estirar las rodillas de vez en cuando"],
      [0, "No puedo"],
    ]),
  ],
  [
    "Dolor",
    opts([
      [10, "Ninguno"],
      [8, "Leve y ocasional"],
      [6, "Me altera el sueño"],
      [3, "A veces intenso"],
      [0, "Constante e intenso"],
    ]),
  ],
  [
    "Hinchazón",
    opts([
      [10, "Ninguna"],
      [8, "Después de un esfuerzo intenso"],
      [6, "Después de las actividades diarias"],
      [4, "Todas las tardes"],
      [0, "Constante"],
    ]),
  ],
  [
    "Movimientos anormales y dolorosos de la rótula (sensación de que se sale)",
    opts([
      [10, "Nunca"],
      [6, "A veces, al hacer deporte"],
      [4, "A veces, en la vida diaria"],
      [2, "He tenido al menos una luxación confirmada"],
      [0, "Más de dos luxaciones"],
    ]),
  ],
  ["Pérdida de masa muscular del muslo", opts([[5, "No"], [3, "Leve"], [0, "Importante"]])],
  ["Dificultad para doblar la rodilla del todo", opts([[5, "No"], [3, "Leve"], [0, "Importante"]])],
];

const IDS = ITEMS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "kujala",
  instructions: "Para cada pregunta, marque la opción que mejor describa los síntomas actuales de su rodilla.",
  sections: [{ title: "Apartados", items: ITEMS.map(([text, options], i) => ({ id: IDS[i], text, options })) }],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      // No hay regla de prorrateo publicada: con algún apartado en blanco, el total queda incompleto.
      throw new RangeError(`Faltan ${missing} de las 13 respuestas: la escala de Kujala necesita todas para calcular la nota.`);
    }
    return { score: round1(values.reduce((s, v) => s + v, 0)) };
  },
  source:
    "Kujala et al., 1993 (original), DOI 10.1016/s0749-8063(05)80366-4; Gil-Gámez et al., 2016 (validación española), DOI 10.1007/s00167-015-3521-z; Crossley et al., 2004 (MCID), DOI 10.1016/s0003-9993(03)00613-0. Texto de trabajo fiel al original: revisar con la versión española publicada (Gil-Gámez et al., 2016) antes de usarlo en consulta.",
};
