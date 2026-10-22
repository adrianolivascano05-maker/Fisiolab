// BQ-L (Bournemouth Questionnaire, versión lumbar): 7 escalas de 0 a 10 (dolor, AVD, actividades sociales, ansiedad,
// depresión, efecto del trabajo y control del dolor), con 10 siempre como lo peor; nota 0-70 (suma), menos es mejor.
// La versión de cuello (bq_cuello.ts) sale de aquí: solo cambian la zona y los ejemplos del ítem 2.
import { answered, type Answers, type QuestionForm } from "./types";

/** Lo que cambia entre la versión lumbar y la de cuello. */
type Version = {
  id: string;
  /** Sigla para los mensajes: «BQ-L», «BQ-C». */
  name: string;
  /** «espalda» o «cuello», como en «su dolor de espalda». */
  zone: string;
  /** Los ejemplos de actividades diarias del ítem 2. */
  dailyActivities: string;
  source: string;
};

/** Las 7 escalas de la BQ para una zona. Los extremos van de 0 (lo mejor) a 10 (lo peor): no se invierte ninguna. */
export function bournemouth({ id, name, zone, dailyActivities, source }: Version): QuestionForm {
  const pain = `dolor de ${zone}`;
  const NOT_PREVENTED: [string, string] = ["No me lo ha impedido", "No he podido realizarlas"];
  const rows: [string, [string, string]][] = [
    [`Durante la última semana, de media, ¿cómo puntuaría su ${pain}?`, ["Sin dolor", "El peor dolor posible"]],
    [`Durante la última semana, ¿cuánto le ha impedido el ${pain} realizar sus actividades diarias (${dailyActivities})?`, NOT_PREVENTED],
    [`Durante la última semana, ¿cuánto le ha impedido el ${pain} participar en actividades recreativas, sociales y familiares?`, NOT_PREVENTED],
    [
      "Durante la última semana, ¿cuánta ansiedad ha sentido (tensión, nerviosismo, irritabilidad, dificultad para concentrarse o relajarse)?",
      ["Ninguna ansiedad", "Muchísima ansiedad"],
    ],
    [
      "Durante la última semana, ¿cuánto se ha sentido deprimido/a (decaído/a, triste, desanimado/a, pesimista, infeliz)?",
      ["Nada deprimido/a", "Muy deprimido/a"],
    ],
    [
      `Durante la última semana, ¿cómo cree que su trabajo (dentro y fuera de casa) ha afectado (o afectaría) a su ${pain}?`,
      ["No lo ha empeorado", "Lo ha empeorado mucho"],
    ],
    [
      `Durante la última semana, ¿cuánto ha podido controlar (reducir o aliviar) por sí mismo/a su ${pain}?`,
      ["Lo controlo por completo", "No lo controlo en absoluto"],
    ],
  ];
  const ids = rows.map((_, i) => `i${i + 1}`);
  return {
    id,
    instructions: `Las siguientes escalas sirven para medir cómo está su ${pain} y cómo le está afectando. Rodee con un círculo el número que mejor describa cómo se siente, pensando en la última semana.`,
    sections: [
      {
        title: "Última semana",
        items: rows.map(([text, ends], i) => ({ id: ids[i], text, scale: { from: 0, to: 10, ends } })),
      },
    ],
    score(answers: Answers) {
      const values = answered(answers, ids);
      const missing = ids.length - values.length;
      // Sin regla de imputación publicada: con un ítem sin contestar no se calcula.
      if (missing > 0) throw new RangeError(`Faltan ${missing} de las 7 respuestas: el ${name} necesita todas para calcular la nota.`);
      return { score: values.reduce((s, v) => s + v, 0) };
    },
    source,
  };
}

export const form: QuestionForm = bournemouth({
  id: "bq_lumbar",
  name: "BQ-L",
  zone: "espalda",
  dailyActivities: "tareas de casa, lavarse, vestirse, caminar, subir escaleras, entrar o salir de la cama o de una silla",
  source:
    "Bolton y Breen, 1999 (original), DOI 10.1016/s0161-4754(99)70001-1; sin validación española en PubMed para la versión lumbar (solo la de cuello). Texto de trabajo fiel al original: revisar con la versión española publicada antes de usarlo en consulta.",
});
