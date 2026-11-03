import { SceneClock, wordAt, wordEnd } from "../../timeline";
import { Cue } from "../types";

/** Efectos de sonido de cada escena, en los mismos momentos que las animaciones. */
export const sceneCues = (c: SceneClock): Cue[] => {
  const s = c.s;
  switch (c.id) {
    case "gancho":
      return [
        { at: wordAt(s[0], "pierna"), file: "error", vol: 0.4 },
        { at: wordAt(s[1], "lasègue"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "positivo"), file: "click", vol: 0.8 },
        { at: wordAt(s[2], "confirma"), file: "pop", vol: 0.7 },
        { at: wordAt(s[2], "descarta"), file: "pop", vol: 0.7 },
      ];
    case "prueba":
      return [
        { at: wordAt(s[0], "revisión"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "confirma"), file: "impact", vol: 0.7 },
        { at: wordAt(s[1], "números"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "contrario"), file: "error", vol: 0.8 },
      ];
    case "datos":
      return [
        { at: wordAt(s[0], "sensibilidad"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "cero"), file: "ding", vol: 0.6 },
        { at: wordAt(s[1], "positivo"), file: "click", vol: 0.6 },
        { at: wordAt(s[2], "especificidad"), file: "pop", vol: 0.6 },
        { at: wordAt(s[2], "cero"), file: "error", vol: 0.6 },
        { at: wordAt(s[3], "sin"), file: "click", vol: 0.6 },
      ];
    case "quiz":
      return [
        { at: wordAt(s[0], "negativo"), file: "pop", vol: 0.7 },
        ...[0, 1, 2].map((i) => ({ at: wordAt(s[0], "qué") + 4 + i * 4, file: "pop", vol: 0.5 })),
        { at: wordEnd(s[0], "dice") + 4, file: "click", vol: 1 },
      ];
    case "hallazgo":
      return [
        { at: wordAt(s[0], "raíz"), file: "error", vol: 0.6 },
        { at: wordAt(s[0], "poco"), file: "impact", vol: 0.9 },
        { at: wordAt(s[1], "sensible"), file: "pop", vol: 0.5 },
        { at: wordAt(s[1], "descarta"), file: "ding", vol: 0.8 },
      ];
    case "giro":
      return [
        { at: wordAt(s[0], "cruzado"), file: "whoosh", vol: 0.6 },
        { at: wordAt(s[0], "otra"), file: "error", vol: 0.5 },
        { at: wordAt(s[1], "cero"), file: "ding", vol: 0.6 },
        { at: wordAt(s[2], "confirma"), file: "impact", vol: 0.7 },
      ];
    case "matiz":
      return [
        { at: wordAt(s[0], "revisión"), file: "pop", vol: 0.5 },
        { at: wordAt(s[0], "revés"), file: "impact", vol: 0.8 },
        { at: wordAt(s[1], "números"), file: "whoosh", vol: 0.5 },
      ];
    case "quehacer":
      return [
        { at: wordAt(s[0], "baja"), file: "ding", vol: 0.7 },
        { at: wordAt(s[1], "cruzado"), file: "ding", vol: 0.7 },
      ];
    case "cta":
      return [
        { at: wordAt(s[0], "comenta"), file: "pop", vol: 0.8 },
        { at: wordAt(s[0], "cruzado"), file: "click", vol: 0.7 },
        { at: wordEnd(s[0], s[0].words[s[0].words.length - 1]?.w ?? "cruzado") + 4, file: "ding", vol: 0.7 },
      ];
    default:
      return [];
  }
};
