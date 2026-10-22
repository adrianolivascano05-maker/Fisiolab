// DHI (Dizziness Handicap Inventory): cuánto limitan el mareo y la inestabilidad, en 25 preguntas (Sí 4, A veces 2,
// No 0); nota 0-100, menos es mejor, con tres subescalas: física (0-28), emocional (0-36) y funcional (0-36).
import { answered, round1, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 4, label: "Sí" },
  { value: 2, label: "A veces" },
  { value: 0, label: "No" },
];

/** Cada pregunta con su subescala: P física, E emocional, F funcional. */
const ROWS: ["P" | "E" | "F", string][] = [
  ["P", "¿Le aumenta el problema al mirar hacia arriba?"],
  ["E", "Por su problema, ¿se siente frustrado/a?"],
  ["F", "Por su problema, ¿limita sus viajes de trabajo o de ocio?"],
  ["P", "¿Le aumenta el problema al caminar por el pasillo de un supermercado?"],
  ["F", "Por su problema, ¿le cuesta acostarse o levantarse de la cama?"],
  ["F", "¿Su problema le limita bastante para participar en actividades sociales, como salir a cenar, ir al cine, bailar o ir a fiestas?"],
  ["F", "Por su problema, ¿le cuesta leer?"],
  ["P", "¿Le aumenta el problema al hacer actividades más exigentes, como deporte, bailar o tareas de casa como barrer o guardar los platos?"],
  ["E", "Por su problema, ¿le da miedo salir de casa sin que alguien le acompañe?"],
  ["E", "Por su problema, ¿ha pasado vergüenza delante de otras personas?"],
  ["P", "¿Le aumentan el problema los movimientos rápidos de la cabeza?"],
  ["F", "Por su problema, ¿evita las alturas?"],
  ["P", "¿Le aumenta el problema al darse la vuelta en la cama?"],
  ["F", "Por su problema, ¿le cuesta hacer tareas pesadas de la casa o del jardín?"],
  ["E", "Por su problema, ¿le da miedo que la gente piense que está bebido/a?"],
  ["F", "Por su problema, ¿le cuesta salir a pasear solo/a?"],
  ["P", "¿Le aumenta el problema al caminar por la acera?"],
  ["E", "Por su problema, ¿le cuesta concentrarse?"],
  ["F", "Por su problema, ¿le cuesta caminar por su casa a oscuras?"],
  ["E", "Por su problema, ¿le da miedo quedarse solo/a en casa?"],
  ["E", "Por su problema, ¿se siente discapacitado/a?"],
  ["E", "¿Su problema le ha causado tensiones en la relación con familiares o amigos?"],
  ["E", "Por su problema, ¿se siente deprimido/a?"],
  ["F", "¿Su problema le dificulta su trabajo o sus responsabilidades en casa?"],
  ["P", "¿Le aumenta el problema al agacharse?"],
];

const IDS = ROWS.map((_, i) => `i${i + 1}`);

/** Subescalas: nombre y letra de sus preguntas. */
const SUBSCALES: [string, "P" | "E" | "F"][] = [
  ["Física (P)", "P"],
  ["Emocional (E)", "E"],
  ["Funcional (F)", "F"],
];

/** Whitney 2004: 0-30 leve, 31-60 moderada, 61-100 grave. */
const severity = (total: number) => (total <= 30 ? "leve (0-30)" : total <= 60 ? "moderada (31-60)" : "grave (61-100)");

export const form: QuestionForm = {
  id: "dhi",
  instructions:
    "Este cuestionario sirve para saber qué dificultades le causa su mareo o inestabilidad. Conteste a cada pregunta con \"Sí\", \"A veces\" o \"No\", pensando solo en su problema de mareo o inestabilidad.",
  sections: [
    {
      title: "Su problema de mareo o inestabilidad",
      items: ROWS.map(([, text], i) => ({ id: IDS[i], text, options: OPTIONS })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    // No hay regla publicada para los ítems en blanco: sin todas las respuestas, el total queda incompleto.
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 25 respuestas: el DHI necesita todas para calcular la nota (sin ellas, el total queda incompleto).`);
    }
    const total = round1(values.reduce((s, v) => s + v, 0));
    const subscores = SUBSCALES.map(([name, letter]) => {
      const ids = IDS.filter((_, i) => ROWS[i][0] === letter);
      return { name, score: round1(answered(answers, ids).reduce((s, v) => s + v, 0)), max: 4 * ids.length };
    });
    return { score: total, subscores, text: `Discapacidad por mareo ${severity(total)}` };
  },
  source:
    "Jacobson y Newman, 1990 (original), DOI 10.1001/archotol.1990.01870040046011; Pérez et al., 2000 (validación española), PMID 11270034 (el DOI no figura en PubMed); Whitney et al., 2004 (puntos de corte), DOI 10.1097/00129492-200403000-00010. Texto de trabajo fiel al original: revisar con la versión española publicada antes de usarlo en consulta.",
};
