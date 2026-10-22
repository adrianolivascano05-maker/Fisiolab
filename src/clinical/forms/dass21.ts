// DASS-21: depresión, ansiedad y estrés de la última semana en 21 frases de 0 a 3 (7 por subescala). Sin nota total:
// cada subescala suma 0-21 y se multiplica por 2 (0-42, como el DASS-42); menos es mejor.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 0, label: "No me ha pasado" },
  { value: 1, label: "Me ha pasado un poco, o durante parte del tiempo" },
  { value: 2, label: "Me ha pasado bastante, o durante una buena parte del tiempo" },
  { value: 3, label: "Me ha pasado mucho, o la mayor parte del tiempo" },
];

const TEXTS = [
  "Me ha costado mucho calmarme.",
  "Me he dado cuenta de que tenía la boca seca.",
  "No he podido sentir ninguna emoción positiva.",
  "He tenido dificultad para respirar (por ejemplo, respiración muy rápida o falta de aire sin haber hecho esfuerzo).",
  "Me ha costado mucho tomar la iniciativa para hacer cosas.",
  "He tendido a reaccionar de forma exagerada ante las situaciones.",
  "He notado temblores (por ejemplo, en las manos).",
  "He sentido que estaba gastando mucha energía nerviosa.",
  "Me han preocupado situaciones en las que podría tener pánico y hacer el ridículo.",
  "He sentido que no tenía nada que esperar del futuro.",
  "Me he notado agitado.",
  "Me ha costado relajarme.",
  "Me he sentido triste y desanimado.",
  "No he tolerado nada que me impidiera seguir con lo que estaba haciendo.",
  "He sentido que estaba a punto de tener pánico.",
  "No he podido entusiasmarme con nada.",
  "He sentido que valía muy poco como persona.",
  "He sentido que estaba muy susceptible.",
  "He notado los latidos de mi corazón sin haber hecho esfuerzo físico (por ejemplo, aumento del ritmo cardiaco o latidos irregulares).",
  "Me he sentido asustado sin motivo.",
  "He sentido que la vida no tenía sentido.",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

/**
 * Subescalas (los nombres de ../questionnaires.ts), los números de sus frases y las categorías del manual de los
 * autores, ya multiplicadas por 2: cada una hasta su nota incluida. Están sin verificar (manual no indexado), así que
 * se enseñan como orientativas.
 */
const SUBSCALES: [string, number[], [number, string][]][] = [
  ["Depresión", [3, 5, 10, 13, 16, 17, 21], [[9, "normal"], [13, "leve"], [20, "moderada"], [27, "grave"], [42, "extremadamente grave"]]],
  ["Ansiedad", [2, 4, 7, 9, 15, 19, 20], [[7, "normal"], [9, "leve"], [14, "moderada"], [19, "grave"], [42, "extremadamente grave"]]],
  ["Estrés", [1, 6, 8, 11, 12, 14, 18], [[14, "normal"], [18, "leve"], [25, "moderado"], [33, "grave"], [42, "extremadamente grave"]]],
];

export const form: QuestionForm = {
  id: "dass21",
  instructions:
    "Lea cada frase y marque el número (0, 1, 2 o 3) que indique cuánto le ha pasado durante la última semana. No hay respuestas buenas ni malas. No dedique demasiado tiempo a cada frase.",
  sections: [
    {
      title: "Última semana",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS })),
    },
  ],
  score(answers: Answers) {
    const subscores: { name: string; score: number }[] = [];
    const levels: string[] = [];
    for (const [name, ns, bands] of SUBSCALES) {
      const values = answered(answers, ns.map((n) => `i${n}`));
      // Con una frase sin contestar, esa subescala no se calcula.
      if (values.length < ns.length) continue;
      const score = round1(values.reduce((s, v) => s + v, 0) * 2);
      subscores.push({ name, score });
      levels.push(`${name.toLowerCase()} ${bands.find(([upTo]) => score <= upTo)![1]}`);
    }
    if (!subscores.length) {
      const missing = IDS.length - answered(answers, IDS).length;
      throw new RangeError(
        `Faltan ${missing} de las 21 respuestas: el DASS-21 necesita las 7 frases de al menos una subescala (depresión, ansiedad o estrés) para calcular su nota.`,
      );
    }
    return {
      score: null,
      subscores,
      text: `Orientativo, sin verificar (categorías del manual de los autores): ${levels.join(" · ")}`,
    };
  },
  source:
    "Lovibond y Lovibond, 1995 (DASS original), DOI 10.1016/0005-7967(94)00075-u; Bados et al., 2005 (validación española; sin verificar: no está en PubMed); Soria-Reyes et al., 2024 (muestra española), DOI 10.1038/s41598-024-68814-9. Texto de trabajo fiel al original: revisar con la versión española publicada (Bados et al., 2005) antes de usarlo en consulta.",
};
