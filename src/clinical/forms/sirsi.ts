// SIRSI (Shoulder Instability-Return to Sport after Injury): preparación psicológica para volver al deporte tras una
// inestabilidad traumática del hombro. 12 ítems de 0 a 10 (los del ACL-RSI con «hombro» en vez de «rodilla»); nota
// 0-100 %, más es mejor.
import { form as aclRsi } from "./acl_rsi";
import { answered, round1, type Answers, type QuestionForm, type Section } from "./types";

/**
 * Los 12 ítems del ACL-RSI de la app, por id, cambiando solo «la rodilla» por «el hombro». Los extremos de su escala ya
 * van de la respuesta menos favorable (0) a la más favorable (10), también en los de redacción negativa (2, 3, 6, 7, 9 y
 * 10), así que lo marcado puntúa tal cual y no hay que invertir nada.
 */
const sections: Section[] = aclRsi.sections.map((s) => ({
  ...s,
  items: s.items.map((item) => ({ ...item, text: item.text.replaceAll("la rodilla", "el hombro") })),
}));

const IDS = sections.flatMap((s) => s.items.map((i) => i.id));

export const form: QuestionForm = {
  id: "sirsi",
  instructions:
    "Responda a las siguientes preguntas pensando en el deporte que practicaba antes de lesionarse el hombro. Para cada pregunta, marque el número que mejor describa lo que siente ahora.",
  sections,
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    // Los autores no dicen qué hacer con las respuestas en blanco: como en el ACL-RSI, se exigen las 12.
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 12 respuestas: el SIRSI necesita todas para calcular la nota.`);
    }
    const sum = values.reduce((s, v) => s + v, 0);
    return { score: round1((sum / 120) * 100) };
  },
  source:
    "Gerometta et al., 2018 (original), DOI 10.1007/s00167-017-4645-0; sin validación española en PubMed. Texto de trabajo: el del ACL-RSI de la app (versión española de Sala-Barat et al., 2020) cambiando «rodilla» por «hombro», como en el original; revisarlo antes de usarlo en consulta.",
};
