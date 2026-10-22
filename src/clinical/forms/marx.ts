// Marx (Marx Activity Rating Scale): con qué frecuencia hace 4 movimientos exigentes para la rodilla, de 0 a 4 cada uno;
// nota 0-16, más es más actividad. Sin prorrateo: necesita los 4.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 0, label: "Menos de una vez al mes" },
  { value: 1, label: "Una vez al mes" },
  { value: 2, label: "Una vez a la semana" },
  { value: 3, label: "2 o 3 veces por semana" },
  { value: 4, label: "4 o más veces por semana" },
];

const TEXTS = [
  "Correr: correr mientras practica un deporte o hace footing.",
  "Cambiar de dirección: cambiar de dirección mientras corre.",
  "Frenar: pararse de golpe mientras corre.",
  "Pivotar: girar el cuerpo con el pie apoyado mientras practica un deporte (p. ej., esquiar, patinar, chutar, lanzar o golpear una pelota en golf, tenis, squash, etc.).",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "marx",
  instructions: "Indique con qué frecuencia hizo cada actividad en su momento más sano y activo del último año.",
  sections: [{ title: "Actividades", items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS })) }],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 4 respuestas: la escala de Marx necesita todas para calcular la nota.`);
    }
    // Sin puntos de corte ni cambio mínimo importante verificados: solo la nota.
    return { score: round1(values.reduce((s, v) => s + v, 0)) };
  },
  source:
    "Marx et al., 2001 (original), DOI 10.1177/03635465010290021601; validación española: no encontrada en PubMed. Texto de trabajo fiel al original (no hay versión española publicada con la que cotejarlo): revisarlo antes de usarlo en consulta.",
};
