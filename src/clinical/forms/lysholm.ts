// Lysholm: síntomas y función de la rodilla en 8 apartados con pesos distintos (cojera 5, apoyo 5, bloqueo 15,
// inestabilidad 25, dolor 25, hinchazón 10, escaleras 10, cuclillas 5); nota 0-100, más es mejor. Necesita los 8.
import { answered, round1, type Answers, type Option, type QuestionForm } from "./types";

/** Opciones con sus puntos, en el orden del original (de mejor a peor). */
const opts = (rows: [number, string][]): Option[] => rows.map(([value, label]) => ({ value, label }));

const ITEMS: [string, Option[]][] = [
  ["Cojera", opts([[5, "No cojeo"], [3, "Cojeo leve o de vez en cuando"], [0, "Cojeo intenso y constante"]])],
  ["Apoyo", opts([[5, "No necesito ayuda"], [2, "Uso bastón o muleta"], [0, "No puedo apoyar el peso"]])],
  [
    "Bloqueo",
    opts([
      [15, "Ni bloqueos ni sensación de enganche"],
      [10, "Sensación de enganche pero sin bloqueo"],
      [6, "Bloqueo de vez en cuando"],
      [2, "Bloqueo frecuente"],
      [0, "La rodilla está bloqueada ahora mismo"],
    ]),
  ],
  [
    "Inestabilidad (la rodilla «falla» o «se va»)",
    opts([
      [25, "Nunca"],
      [20, "Rara vez, durante el deporte u otros esfuerzos intensos"],
      [15, "A menudo durante el deporte u otros esfuerzos intensos (o no puedo hacerlos)"],
      [10, "De vez en cuando en las actividades diarias"],
      [5, "A menudo en las actividades diarias"],
      [0, "A cada paso"],
    ]),
  ],
  [
    "Dolor",
    opts([
      [25, "Ninguno"],
      [20, "Leve y ocasional con esfuerzos intensos"],
      [15, "Marcado con esfuerzos intensos"],
      [10, "Marcado al caminar más de 2 km o después"],
      [5, "Marcado al caminar menos de 2 km o después"],
      [0, "Constante"],
    ]),
  ],
  ["Hinchazón", opts([[10, "Ninguna"], [6, "Con esfuerzos intensos"], [2, "Con esfuerzos normales"], [0, "Constante"]])],
  ["Subir escaleras", opts([[10, "Sin problema"], [6, "Un poco limitado"], [2, "Escalón a escalón"], [0, "No puedo"]])],
  ["Ponerse en cuclillas", opts([[5, "Sin problema"], [4, "Un poco limitado"], [2, "No más allá de 90° (ángulo recto)"], [0, "No puedo"]])],
];

const IDS = ITEMS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "lysholm",
  instructions: "Marque en cada apartado la opción que mejor describa cómo está su rodilla actualmente.",
  sections: [{ title: "Apartados", items: ITEMS.map(([text, options], i) => ({ id: IDS[i], text, options })) }],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      // Sin prorrateo: con un apartado en blanco, el total no se puede calcular.
      throw new RangeError(`Faltan ${missing} de las 8 respuestas: la escala de Lysholm necesita todas para calcular la nota.`);
    }
    // Las categorías clásicas (excelente, bueno, regular, malo) no se han podido verificar: no se enseñan.
    return { score: round1(values.reduce((s, v) => s + v, 0)) };
  },
  source:
    "Lysholm y Gillquist, 1982 (original), DOI 10.1177/036354658201000306; Arroyo-Morales et al., 2019 (validación española), DOI 10.1371/journal.pone.0221376; Briggs et al., 2009 (fiabilidad y cambio mínimo detectable), DOI 10.1177/0363546508330143. Texto de trabajo fiel al original: revisar con la versión española publicada (Arroyo-Morales et al., 2019) antes de usarlo en consulta.",
};
