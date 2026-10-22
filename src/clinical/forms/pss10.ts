// PSS-10 (escala de estrés percibido): cuánto percibe su vida del último mes como impredecible, incontrolable y
// sobrecargada, en 10 preguntas de 0 a 4 (las 4, 5, 7 y 8, en positivo, se invierten); nota 0-40, menos es mejor.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Casi nunca" },
  { value: 2, label: "De vez en cuando" },
  { value: 3, label: "A menudo" },
  { value: 4, label: "Muy a menudo" },
];

/** Cada pregunta empieza por «En el último mes, ¿con qué frecuencia…». */
const ENDINGS = [
  "se ha sentido afectado por algo que ha ocurrido inesperadamente?",
  "se ha sentido incapaz de controlar las cosas importantes de su vida?",
  "se ha sentido nervioso o estresado?",
  "se ha sentido seguro de su capacidad para manejar sus problemas personales?",
  "ha sentido que las cosas le iban bien?",
  "ha sentido que no podía con todas las cosas que tenía que hacer?",
  "ha podido controlar las cosas que le irritan en su vida?",
  "ha sentido que lo tenía todo bajo control?",
  "se ha enfadado por cosas que estaban fuera de su control?",
  "ha sentido que las dificultades se acumulaban tanto que no podía superarlas?",
];

const IDS = ENDINGS.map((_, i) => `i${i + 1}`);
/** Formuladas en positivo: puntúan 4 menos lo marcado. */
const REVERSED = ["i4", "i5", "i7", "i8"];

export const form: QuestionForm = {
  id: "pss10",
  instructions:
    "Las preguntas de esta escala tratan sobre sus sentimientos y pensamientos durante el último mes. En cada pregunta, indique con qué frecuencia se ha sentido o ha pensado de esa manera.",
  sections: [
    {
      title: "Último mes",
      items: ENDINGS.map((end, i) => ({ id: IDS[i], text: `En el último mes, ¿con qué frecuencia ${end}`, options: OPTIONS })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 10 respuestas: la PSS-10 necesita todas para calcular la nota.`);
    }
    // Sin puntos de corte clínicos verificados (se compara con normas de población): solo la nota.
    return { score: round1(IDS.reduce((s, id) => s + (REVERSED.includes(id) ? 4 - answers[id]! : answers[id]!), 0)) };
  },
  source:
    "Cohen et al., 1983 (PSS original), DOI no figura en PubMed; Remor, 2006 (validación española, incluye la forma de 10 ítems), DOI 10.1017/s1138741600006004. Texto de trabajo fiel al original: revisar con la versión española publicada (Remor, 2006) antes de usarlo en consulta.",
};
