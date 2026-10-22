// ALR-RSI: preparación psicológica para volver al deporte tras una ligamentoplastia de tobillo. Son los 12 ítems del
// ACL-RSI de la app con «tobillo» en vez de «rodilla», de 0 a 10 (el original, de 0 a 100 de 10 en 10); nota 0-100,
// más es mejor (más preparado).
import { form as aclRsi } from "./acl_rsi";
import { answered, round1, type Answers, type QuestionForm } from "./types";

/** «rodilla» → «tobillo», como dice la ficha (con el artículo en masculino). */
export const toAnkle = (text: string) => text.replace(/\bla rodilla\b/g, "el tobillo").replace(/\brodilla\b/g, "tobillo");

// Los 12 ítems del ACL-RSI por su id, con sus mismos extremos (de peor a mejor, ninguno invertido); solo cambia el texto.
const IDS = Array.from({ length: 12 }, (_, i) => `i${i + 1}`);
const aclItems = aclRsi.sections.flatMap((s) => s.items);
const items = IDS.map((id) => {
  const item = aclItems.find((it) => it.id === id)!;
  return { ...item, text: toAnkle(item.text) };
});

export const form: QuestionForm = {
  id: "alr_rsi",
  instructions: toAnkle(aclRsi.instructions),
  sections: [{ title: aclRsi.sections[0].title, items }],
  // Igual que el ACL-RSI de la app: con las 12 contestadas, la media de los ítems (0-10) × 10.
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 12 respuestas: el ALR-RSI necesita todas para calcular la nota.`);
    }
    const sum = values.reduce((s, v) => s + v, 0);
    return { score: round1((sum / (10 * values.length)) * 100) };
  },
  source:
    "Sigonney et al., 2020 (original), DOI 10.1007/s00167-020-06020-6; Pioger et al., 2022 (validación tras Broström-Gould), DOI 10.1007/s00167-022-06895-7; Pérez-de la Cruz, 2023 (validación española), DOI 10.3390/jpm13040606. Texto de trabajo fiel al original: revisar con la versión española publicada (Pérez-de la Cruz, 2023) antes de usarlo en consulta. Sale del ACL-RSI de la app cambiando «rodilla» por «tobillo».",
};
