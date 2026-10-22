// HOOS-12: forma corta del HOOS con 12 de sus ítems (dolor 4, función 4, calidad de vida 4), de 0 a 4 como en el HOOS.
// Cada subescala y el resumen (media de las tres) van de 0 (problemas extremos) a 100 (sin problemas): más es mejor.
import { form as hoos } from "./hoos";
import { introOf, pick, shortFormScores } from "./koos12";
import type { QuestionForm, Section } from "./types";

const sections: Section[] = [
  // Frecuencia del dolor; sentado o tumbado; terreno llano; escaleras.
  { title: "Dolor", intro: introOf(hoos, "Dolor"), items: pick(hoos, ["p1", "p7", "p4", "p5"]) },
  // Estar de pie; levantarse de una silla; subir o bajar del coche (AVD); caminar por terreno irregular (deporte y ocio).
  { title: "Función", intro: introOf(hoos, "AVD"), items: pick(hoos, ["a4", "a3", "a7", "sp4"]) },
  { title: "Calidad de vida", items: pick(hoos, ["q1", "q2", "q3", "q4"]) },
];

export const form: QuestionForm = {
  id: "hoos12",
  instructions: hoos.instructions,
  sections,
  // Igual que en el KOOS-12 (también el mínimo provisional de ítems contestados por subescala).
  score: (a) => shortFormScores(sections, a, "HOOS-12"),
  source: `Gandek et al., 2019 (selección de ítems), DOI 10.1016/j.joca.2018.11.011; Gandek et al., 2019 (validación original), DOI 10.1016/j.joca.2018.09.017; validación española: no encontrada en PubMed. Ítems y texto del HOOS de la app: ${hoos.source.replace(/\.?$/, ".")} Texto de trabajo fiel al original (no hay validación española publicada del HOOS-12 con la que cotejarlo): revisarlo antes de usarlo en consulta.`,
};
