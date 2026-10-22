// KOOS-12: forma corta del KOOS con 12 de sus ítems (dolor 4, función 4, calidad de vida 4), de 0 a 4 como en el KOOS.
// Cada subescala y el resumen (media de las tres) van de 0 (problemas extremos) a 100 (sin problemas): más es mejor.
import { form as koos } from "./koos";
import { answered, round1, type Answers, type FormScore, type Item, type QuestionForm, type Section } from "./types";

/** Ítems de otro formulario de la app, por id, con su texto y sus respuestas tal cual. */
export function pick(source: QuestionForm, ids: string[]): Item[] {
  const all = source.sections.flatMap((s) => s.items);
  return ids.map((id) => {
    const item = all.find((it) => it.id === id);
    if (!item) throw new Error(`El ${source.id} no tiene el ítem ${id}.`);
    return item;
  });
}

/** La introducción de un apartado de otro formulario de la app. */
export const introOf = (source: QuestionForm, title: string) => source.sections.find((s) => s.title === title)?.intro;

/** Subescalas, con los nombres del catálogo (../catalog/miembroInferior.ts); el resumen va después. */
const SUBSCALES = ["Dolor", "Función", "Calidad de vida"];
/**
 * Como mucho 2 ítems en blanco por subescala. ⚠ Regla provisional del documento hasta comprobar el mínimo en la guía
 * de puntuación KOOS-12 / HOOS-12 (koos.nu).
 */
const MAX_BLANK = 2;

/**
 * KOOS-12 y HOOS-12: cada subescala, 100 − media de lo contestado × 100 / 4; el resumen, la media de las tres (solo
 * si se pueden calcular las tres). La subescala con más de 2 en blanco se omite.
 */
export function shortFormScores(sections: Section[], a: Answers, name: string): FormScore {
  const all = sections.flatMap((s) => s.items.map((it) => it.id));
  const parts = SUBSCALES.flatMap((title) => {
    const ids = sections.find((s) => s.title === title)!.items.map((it) => it.id);
    const vals = answered(a, ids);
    if (ids.length - vals.length > MAX_BLANK) return [];
    const mean = vals.reduce((x, y) => x + y, 0) / vals.length;
    return [{ name: title, value: 100 - (mean * 100) / 4 }];
  });
  if (parts.length === 0) {
    const missing = all.length - answered(a, all).length;
    throw new RangeError(
      `Faltan ${missing} de las ${all.length} respuestas: el ${name} necesita al menos 2 de las 4 preguntas de alguna parte (dolor, función o calidad de vida).`,
    );
  }
  const subscores = parts.map((p) => ({ name: p.name, score: round1(p.value) }));
  if (parts.length === SUBSCALES.length) {
    subscores.push({ name: "Resumen", score: round1(parts.reduce((s, p) => s + p.value, 0) / parts.length) });
  }
  return { score: null, subscores };
}

const sections: Section[] = [
  // Frecuencia del dolor; sentado o tumbado; terreno llano; escaleras.
  { title: "Dolor", intro: introOf(koos, "Dolor"), items: pick(koos, ["p1", "p8", "p5", "p6"]) },
  // Estar de pie; levantarse de una silla; subir o bajar del coche (AVD); girar o pivotar (deporte y ocio).
  { title: "Función", intro: introOf(koos, "AVD"), items: pick(koos, ["a4", "a3", "a7", "sp4"]) },
  { title: "Calidad de vida", items: pick(koos, ["q1", "q2", "q3", "q4"]) },
];

export const form: QuestionForm = {
  id: "koos12",
  instructions: koos.instructions,
  sections,
  score: (a) => shortFormScores(sections, a, "KOOS-12"),
  source: `Gandek et al., 2019 (selección de ítems), DOI 10.1016/j.joca.2018.11.011; Gandek et al., 2019 (validación original), DOI 10.1016/j.joca.2019.01.011; Horta-Baas et al., 2021 (validación española, latinoamericana: México), DOI 10.1007/s10067-020-05403-x. Ítems y texto del KOOS de la app: ${koos.source.replace(/\.?$/, ".")} Texto de trabajo fiel al original: revisar con la versión española publicada (Horta-Baas et al., 2021, México) antes de usarlo en consulta.`,
};
