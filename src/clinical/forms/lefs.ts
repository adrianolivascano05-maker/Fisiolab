// LEFS (Lower Extremity Functional Scale): 20 actividades del miembro inferior, de 0 a 4; nota 0-80, más es mejor.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 0, label: "Dificultad extrema o incapaz de realizar la actividad" },
  { value: 1, label: "Bastante dificultad" },
  { value: 2, label: "Dificultad moderada" },
  { value: 3, label: "Un poco de dificultad" },
  { value: 4, label: "Ninguna dificultad" },
];

const TEXTS = [
  "Cualquiera de sus actividades habituales en el trabajo, en casa o en el colegio",
  "Sus aficiones habituales y sus actividades recreativas o deportivas",
  "Entrar o salir de la bañera",
  "Caminar de una habitación a otra",
  "Ponerse los zapatos o los calcetines",
  "Ponerse en cuclillas",
  "Levantar del suelo un objeto, como una bolsa de la compra",
  "Hacer tareas ligeras en casa",
  "Hacer tareas pesadas en casa",
  "Entrar o salir del coche",
  "Caminar dos manzanas",
  "Caminar una milla (unos 1,5 km)",
  "Subir o bajar 10 escalones (más o menos un tramo de escalera)",
  "Estar de pie durante una hora",
  "Estar sentado durante una hora",
  "Correr en terreno llano",
  "Correr en terreno irregular",
  "Hacer giros bruscos mientras corre deprisa",
  "Saltar a la pata coja",
  "Darse la vuelta en la cama",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "lefs",
  instructions:
    "Nos interesa saber si su problema en la pierna le dificulta hacer las actividades que siguen. Responda a todas, marcando la opción que mejor describa cómo está hoy.",
  sections: [
    {
      title: "Actividades",
      intro: "Hoy, ¿tiene o tendría alguna dificultad, a causa de su problema en la pierna, para…",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    // Sin una regla oficial para prorratear, se exigen las 20 respuestas.
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 20 respuestas: la LEFS necesita todas para calcular la nota.`);
    }
    return { score: round1(values.reduce((s, v) => s + v, 0)) };
  },
  source: "Binkley et al., 1999 (LEFS original); versión española de Cruz-Díaz et al., 2014.",
};
