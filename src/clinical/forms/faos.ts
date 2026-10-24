// FAOS (Foot and Ankle Outcome Score): el KOOS adaptado al pie y tobillo, 42 ítems en cinco subescalas.
// Cada subescala va de 0 (problemas extremos) a 100 (sin problemas), más es mejor; no hay nota total.
import { form as koos, subscaleScores } from "./koos";
import type { QuestionForm, Section } from "./types";

/**
 * El texto del KOOS de la app con «rodilla» cambiado por «pie/tobillo», como dice la ficha, con el artículo y lo que
 * concuerda con él en masculino («el pie/tobillo… al moverlo», «lesionado», «del»). Solo la palabra suelta: «Arrodillarse»
 * se queda como está.
 */
function toFootAnkle(text: string): string {
  return text
    .replace(/\bla rodilla al moverla\b/g, "el pie/tobillo al moverlo")
    .replace(/\bla rodilla lesionada\b/g, "el pie/tobillo lesionado")
    .replace(/\bde la rodilla\b/g, "del pie/tobillo")
    .replace(/\bla rodilla\b/g, "el pie/tobillo")
    .replace(/\brodilla\b/g, "pie/tobillo");
}

// Los 42 ítems del KOOS, con sus mismos ids, apartados y respuestas; solo cambia el texto.
const sections: Section[] = koos.sections.map((s) => ({
  ...s,
  ...(s.intro ? { intro: toFootAnkle(s.intro) } : {}),
  items: s.items.map((item) => ({ ...item, text: toFootAnkle(item.text) })),
}));

export const form: QuestionForm = {
  id: "faos",
  instructions: toFootAnkle(koos.instructions),
  sections,
  // La misma regla que el KOOS de la app: cada subescala, si está contestada al menos la mitad de sus ítems.
  score: (a) => subscaleScores(sections, a, "FAOS"),
  source:
    "Roos et al., 2001 (original), DOI 10.1177/107110070102201004; Navarro-Flores et al., 2020 (validación española), DOI 10.1111/iwj.13400; Pellegrini et al., 2020 (versión en español de Chile), DOI 10.1016/j.fas.2019.10.007. Texto de trabajo fiel al original: revisar con la versión española publicada (Navarro-Flores et al., 2020) antes de usarlo en consulta. Sale del KOOS de la app cambiando «rodilla» por «pie/tobillo»; algunos ítems de síntomas y de dolor no son una sustitución literal, así que hay que cotejarlos uno a uno.",
};
