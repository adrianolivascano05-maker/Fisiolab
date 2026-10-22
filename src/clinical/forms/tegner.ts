// Tegner: nivel de actividad laboral y deportiva (no la función), una sola respuesta de 11 niveles; nota 0-10 (el nivel),
// más es más actividad. Se pregunta antes de la lesión y ahora, y cada nivel se guarda aparte (dos subescalas).
import { answered, type Answers, type Option, type QuestionForm } from "./types";

/** Los 11 niveles, del 10 al 0: el valor es el nivel. */
const LEVELS: Option[] = [
  { value: 10, label: "Deporte de competición: fútbol, fútbol americano o rugby a nivel de élite nacional." },
  {
    value: 9,
    label: "Deporte de competición: fútbol, fútbol americano o rugby en categorías inferiores; hockey sobre hielo; lucha; gimnasia.",
  },
  { value: 8, label: "Deporte de competición: bandy; squash o bádminton; atletismo (saltos, etc.); esquí alpino." },
  {
    value: 7,
    label:
      "Deporte de competición: tenis; atletismo (carreras); motocross o speedway; balonmano; baloncesto. Deporte recreativo: fútbol, fútbol americano, rugby, bandy, hockey sobre hielo, baloncesto, squash, atletismo (saltos); carrera de orientación (recreativa o de competición).",
  },
  {
    value: 6,
    label: "Deporte recreativo: tenis y bádminton; balonmano; baloncesto; esquí alpino; correr al menos 5 veces por semana.",
  },
  {
    value: 5,
    label:
      "Trabajo pesado (construcción, trabajo forestal). Deporte de competición: ciclismo; esquí de fondo. Deporte recreativo: correr por terreno irregular al menos 2 veces por semana.",
  },
  {
    value: 4,
    label:
      "Trabajo moderadamente pesado (conducir camiones, tareas domésticas pesadas). Deporte recreativo: ciclismo; esquí de fondo; correr por terreno llano al menos 2 veces por semana.",
  },
  { value: 3, label: "Trabajo ligero (p. ej., enfermería). Deporte de competición y recreativo: natación. Puedo caminar por el monte." },
  { value: 2, label: "Trabajo ligero. Puedo caminar por terreno irregular, pero no por el monte." },
  { value: 1, label: "Trabajo sedentario (p. ej., de oficina). Puedo caminar por terreno llano." },
  { value: 0, label: "Estoy de baja o tengo una pensión por incapacidad por problemas de rodilla." },
];

/** Las dos veces que se pregunta, con el nombre de su subescala en el catálogo (../catalog/miembroInferior.ts). */
const WHEN: [string, string][] = [
  ["antes", "Antes de la lesión"],
  ["ahora", "Ahora"],
];

export const form: QuestionForm = {
  id: "tegner",
  instructions:
    "Marque el nivel que mejor describa su actividad más alta (trabajo o deporte). Responda primero cómo era antes de la lesión y después cómo es ahora.",
  sections: [{ title: "Nivel de actividad", items: WHEN.map(([id, text]) => ({ id, text, options: LEVELS })) }],
  score(answers: Answers) {
    // La nota es el nivel marcado, sin prorrateo; el previo y el actual se guardan por separado.
    const subscores = WHEN.flatMap(([id, name]) => answered(answers, [id]).map((score) => ({ name, score })));
    if (subscores.length === 0) {
      throw new RangeError("Faltan 2 de las 2 respuestas: el Tegner necesita al menos uno de los dos niveles (antes de la lesión o ahora).");
    }
    return { score: null, subscores };
  },
  source:
    "Tegner y Lysholm, 1985 (original), sin DOI en PubMed; Pujol et al., 2025 (traducción y adaptación cultural al español), DOI 10.24875/CIRU.23000460; Briggs et al., 2009 (fiabilidad y cambio mínimo detectable), DOI 10.1177/0363546508330143. Texto de trabajo fiel al original: revisar con la versión española publicada (Pujol et al., 2025) antes de usarlo en consulta.",
};
