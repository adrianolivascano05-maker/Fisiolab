import { SceneClock, wordAt, wordEnd } from "../../timeline";
import { Cue } from "../types";

/** Efectos de sonido de cada escena, en los mismos momentos que las animaciones. */
export const sceneCues = (c: SceneClock): Cue[] => {
  const s = c.s;
  switch (c.id) {
    case "gancho":
      return [
        { at: wordAt(s[0], "operada"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "isométrico"), file: "whoosh", vol: 0.5 },
        { at: wordAt(s[1], "estirada"), file: "click", vol: 0.6 },
        { at: wordAt(s[2], "frena"), file: "error", vol: 0.6 },
      ];
    case "prueba":
      return [
        { at: wordAt(s[0], "revisión"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "frena"), file: "error", vol: 0.5 },
        { at: wordAt(s[1], "reflejo"), file: "impact", vol: 0.5 },
      ];
    case "datos":
      return [
        { at: wordAt(s[0], "presión"), file: "whoosh", vol: 0.5 },
        { at: wordAt(s[0], "u"), file: "ding", vol: 0.6 },
        { at: wordAt(s[1], "máxima"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "mínima"), file: "pop", vol: 0.6 },
        { at: wordAt(s[2], "patrón"), file: "impact", vol: 0.5 },
      ];
    case "quiz":
      return [
        { at: Math.max(0, s[0].start - 2), file: "pop", vol: 0.8 },
        ...[0, 1, 2].map((i) => ({ at: wordAt(s[0], "ángulo") + i * 4, file: "pop", vol: 0.5 })),
        { at: wordEnd(s[0], "harías") + 4, file: "click", vol: 1 },
      ];
    case "hallazgo":
      return [
        { at: wordAt(s[0], "meniscectomía"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "estirada"), file: "whoosh", vol: 0.5 },
        { at: wordAt(s[0], "doble"), file: "impact", vol: 0.8 },
        { at: wordAt(s[0], "treinta"), file: "ding", vol: 0.7 },
      ];
    case "giro":
      return [
        { at: wordAt(s[0], "recomiendan"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "treinta") + 20, file: "click", vol: 0.6 },
        { at: wordAt(s[1], "mínima"), file: "ding", vol: 0.7 },
      ];
    case "matiz":
      return [
        { at: Math.max(0, s[0].start - 2), file: "impact", vol: 0.5 },
        { at: wordAt(s[0], "ochenta"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "noventa"), file: "pop", vol: 0.6 },
      ];
    case "quehacer":
      return [
        { at: wordAt(s[0], "isométrico"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "doblada") + 14, file: "click", vol: 0.6 },
        { at: wordAt(s[1], "derrame"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "pesa"), file: "ding", vol: 0.6 },
      ];
    case "cta":
      return [
        { at: wordAt(s[0], "comenta"), file: "pop", vol: 0.8 },
        { at: wordAt(s[0], "treinta"), file: "click", vol: 0.7 },
        { at: wordEnd(s[0], s[0].words[s[0].words.length - 1]?.w ?? "doblada") + 4, file: "ding", vol: 0.7 },
      ];
    default:
      return [];
  }
};
