// RAND-36 (RAND 36-Item Health Survey 1.0): 36 ítems en ocho escalas de 0 a 100, más es mejor; no hay nota total.
// Cada respuesta se guarda por su posición (1, 2, 3…), como en el original, y se pasa a 0-100 al puntuar.
import { round1, type Answers, type FormScore, type Item, type Option, type QuestionForm, type Section } from "./types";

/** Opciones numeradas desde 1, en el orden en que se leen. */
const opts = (...labels: string[]): Option[] => labels.map((label, i) => ({ value: i + 1, label }));

const LIMITS = opts("Sí, me limita mucho", "Sí, me limita un poco", "No, no me limita nada");
const YES_NO = opts("Sí", "No");
const HOW_MUCH = opts("Nada", "Un poco", "Moderadamente", "Bastante", "Muchísimo");
const TIME6 = opts("Siempre", "Casi siempre", "Muchas veces", "Algunas veces", "Solo alguna vez", "Nunca");
const TIME5 = opts("Siempre", "Casi siempre", "Algunas veces", "Solo alguna vez", "Nunca");
const TRUE_FALSE = opts("Totalmente cierta", "Bastante cierta", "No lo sé", "Bastante falsa", "Totalmente falsa");

/** Ítems con ids correlativos («i3», «i4»…) a partir del número `from`. */
const numbered = (from: number, texts: string[], options: Option[]): Item[] =>
  texts.map((text, i) => ({ id: `i${from + i}`, text, options }));

const sections: Section[] = [
  {
    title: "Su salud en general",
    items: [
      { id: "i1", text: "En general, ¿cómo diría que es su salud?", options: opts("Excelente", "Muy buena", "Buena", "Regular", "Mala") },
      {
        id: "i2",
        text: "Comparada con la de hace un año, ¿cómo diría que es ahora su salud en general?",
        options: opts("Mucho mejor que hace un año", "Algo mejor que hace un año", "Más o menos igual", "Algo peor que hace un año", "Mucho peor que hace un año"),
      },
    ],
  },
  {
    title: "Limitaciones en actividades",
    intro: "Estas preguntas tratan de actividades que podría hacer en un día normal. ¿Su salud actual le limita para hacerlas? Si es así, ¿cuánto?",
    items: numbered(
      3,
      [
        "Actividades intensas, como correr, levantar objetos pesados o hacer deportes que exigen mucho esfuerzo",
        "Actividades moderadas, como mover una mesa, pasar la aspiradora, jugar a los bolos o al golf",
        "Levantar o llevar la bolsa de la compra",
        "Subir varios pisos por la escalera",
        "Subir un solo piso por la escalera",
        "Agacharse, arrodillarse o inclinarse",
        "Caminar más de un kilómetro y medio",
        "Caminar varias manzanas",
        "Caminar una sola manzana",
        "Bañarse o vestirse por sí mismo",
      ],
      LIMITS,
    ),
  },
  {
    title: "Problemas por la salud física",
    intro:
      "Durante las últimas 4 semanas, ¿ha tenido alguno de estos problemas en su trabajo o en sus actividades diarias habituales a causa de su salud física?",
    items: numbered(
      13,
      [
        "Ha reducido el tiempo que dedicaba al trabajo o a otras actividades",
        "Ha hecho menos de lo que le hubiera gustado",
        "Ha tenido que limitar el tipo de trabajo o de actividades que hace",
        "Le ha costado hacer el trabajo o sus actividades (por ejemplo, le han exigido un esfuerzo de más)",
      ],
      YES_NO,
    ),
  },
  {
    title: "Problemas emocionales",
    intro:
      "Durante las últimas 4 semanas, ¿ha tenido alguno de estos problemas en su trabajo o en sus actividades diarias habituales a causa de algún problema emocional (como sentirse triste, deprimido o nervioso)?",
    items: numbered(
      17,
      [
        "Ha reducido el tiempo que dedicaba al trabajo o a otras actividades",
        "Ha hecho menos de lo que le hubiera gustado",
        "No ha hecho el trabajo o sus actividades con el cuidado de siempre",
      ],
      YES_NO,
    ),
  },
  {
    title: "Vida social y dolor",
    items: [
      {
        id: "i20",
        text: "Durante las últimas 4 semanas, ¿hasta qué punto su salud física o sus problemas emocionales le han dificultado sus actividades sociales habituales con la familia, los amigos, los vecinos u otras personas?",
        options: HOW_MUCH,
      },
      {
        id: "i21",
        text: "¿Cuánto dolor ha tenido en alguna parte del cuerpo durante las últimas 4 semanas?",
        options: opts("Ninguno", "Muy poco", "Poco", "Moderado", "Fuerte", "Muy fuerte"),
      },
      {
        id: "i22",
        text: "Durante las últimas 4 semanas, ¿hasta qué punto el dolor le ha dificultado su trabajo habitual (tanto el de fuera de casa como las tareas de la casa)?",
        options: HOW_MUCH,
      },
    ],
  },
  {
    title: "Energía y emociones",
    intro:
      "Estas preguntas tratan de cómo se ha sentido y de cómo le han ido las cosas durante las últimas 4 semanas. Marque en cada una la respuesta que más se acerque a cómo se ha sentido. Durante las últimas 4 semanas, ¿cuánto tiempo…",
    items: numbered(
      23,
      [
        "…se ha sentido lleno de vitalidad?",
        "…ha estado muy nervioso?",
        "…se ha sentido tan bajo de ánimo que nada podía animarle?",
        "…se ha sentido tranquilo y sereno?",
        "…ha tenido mucha energía?",
        "…se ha sentido desanimado y triste?",
        "…se ha sentido agotado?",
        "…se ha sentido feliz?",
        "…se ha sentido cansado?",
      ],
      TIME6,
    ),
  },
  {
    title: "Actividades sociales",
    items: [
      {
        id: "i32",
        text: "Durante las últimas 4 semanas, ¿cuánto tiempo le han dificultado su salud física o sus problemas emocionales las actividades sociales (como visitar a amigos o familiares)?",
        options: TIME5,
      },
    ],
  },
  {
    title: "Opinión sobre su salud",
    intro: "¿Hasta qué punto es cierta o falsa para usted cada una de estas frases?",
    items: numbered(
      33,
      [
        "Creo que me pongo enfermo con más facilidad que otras personas",
        "Estoy tan sano como cualquier persona que conozco",
        "Creo que mi salud va a empeorar",
        "Mi salud es excelente",
      ],
      TRUE_FALSE,
    ),
  },
];

/** Del 1 al n. */
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

// Recodificación de RAND (tabla 1 de sus instrucciones): la respuesta en la posición k vale table[k − 1].
const RECODE = new Map<number, number[]>();
const recode = (items: number[], table: number[]) => items.forEach((n) => RECODE.set(n, table));
recode([1, 2, 20, 22, 34, 36], [100, 75, 50, 25, 0]);
recode(range(3, 12), [0, 50, 100]);
recode(range(13, 19), [0, 100]);
recode([21, 23, 26, 27, 30], [100, 80, 60, 40, 20, 0]);
recode([24, 25, 28, 29, 31], [0, 20, 40, 60, 80, 100]);
recode([32, 33, 35], [0, 25, 50, 75, 100]);

/** Las escalas con sus ítems, en el orden de ../questionnaires.ts. La pregunta 2 no puntúa. */
const SCALES: [string, number[]][] = [
  ["Función física", range(3, 12)],
  ["Rol físico", range(13, 16)],
  ["Dolor corporal", [21, 22]],
  ["Salud general", [1, 33, 34, 35, 36]],
  ["Vitalidad", [23, 27, 29, 31]],
  ["Función social", [20, 32]],
  ["Rol emocional", range(17, 19)],
  ["Salud mental", [24, 25, 26, 28, 30]],
];

/** El ítem pasado a 0-100; undefined si no está contestado o la respuesta no existe. */
const recoded = (a: Answers, n: number): number | undefined => {
  const v = a[`i${n}`];
  return typeof v === "number" ? RECODE.get(n)![v - 1] : undefined;
};

/** Cada escala: la media de sus ítems contestados (pasados a 0-100); sin ninguno contestado, no sale. */
function score(a: Answers): FormScore {
  const subscores = SCALES.flatMap(([name, items]) => {
    const vals = items.map((n) => recoded(a, n)).filter((v): v is number => v !== undefined);
    if (vals.length === 0) return [];
    return [{ name, score: round1(vals.reduce((x, y) => x + y, 0) / vals.length) }];
  });
  if (subscores.length === 0) {
    throw new RangeError("Faltan respuestas: conteste al menos una pregunta de alguna escala del RAND-36 (la 2 no puntúa).");
  }
  return { score: null, subscores };
}

export const form: QuestionForm = {
  id: "rand36",
  instructions:
    "Este cuestionario pregunta por su salud y por cómo se encuentra. Conteste todas las preguntas marcando la respuesta que mejor describa su caso. Si no está seguro, marque la que más se acerque.",
  sections,
  score,
  source: "RAND Health, 1992; Hays et al., 1993 (RAND 36-Item Health Survey 1.0, dominio público). Texto de trabajo: revisar con la versión española publicada.",
};
