import { SceneClock, wordAt, wordEnd } from "../../timeline";
import { Cue } from "../types";

/** Efectos de sonido de cada escena, en los mismos momentos que las animaciones. */
export const sceneCues = (c: SceneClock): Cue[] => {
  const s = c.s;
  switch (c.id) {
    case "gancho":
      return [
        { at: wordAt(s[0], "domingo"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "martes"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "distinto"), file: "xray", vol: 0.6 },
        { at: wordAt(s[2], "lesionando"), file: "error", vol: 0.6 },
      ];
    case "prueba":
      return [
        { at: wordAt(s[0], "revisión"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "fútbol"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "caballos"), file: "pop", vol: 0.6 },
      ];
    case "datos":
      return [
        { at: s[0].start, file: "impact", vol: 0.5 },
        { at: s[1].start + 6, file: "xray", vol: 0.6 },
        { at: wordAt(s[2], "normalidad"), file: "ding", vol: 0.7 },
      ];
    case "quiz":
      return [
        { at: Math.max(0, wordAt(s[0], "qué") - 2), file: "pop", vol: 0.8 },
        ...[0, 1, 2].map((i) => ({ at: wordAt(s[0], "cambiado") + i * 4, file: "pop", vol: 0.5 })),
        { at: wordEnd(s[0], "días") + 4, file: "click", vol: 1 },
      ];
    case "hallazgo":
      return [
        { at: wordAt(s[0], "relleno"), file: "error", vol: 0.5 },
        { at: wordAt(s[0], "proteoglicanos"), file: "impact", vol: 0.8 },
        { at: wordAt(s[0], "agua"), file: "whoosh", vol: 0.5 },
        { at: wordAt(s[1], "tardan"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "ritmo"), file: "ding", vol: 0.8 },
      ];
    case "giro":
      return [
        { at: wordAt(s[0], "colágeno"), file: "pop", vol: 0.5 },
        { at: wordAt(s[0], "apenas"), file: "error", vol: 0.6 },
        { at: wordEnd(s[1], "fibras"), file: "error", vol: 0.7 },
      ];
    case "matiz":
      return [
        { at: Math.max(0, s[0].start - 2), file: "impact", vol: 0.5 },
        { at: wordAt(s[0], "adaptación"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "problema"), file: "pop", vol: 0.6 },
      ];
    case "quehacer":
      return [
        { at: wordAt(s[0], "pregunta"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "dos"), file: "click", vol: 0.6 },
        { at: wordAt(s[1], "cuatro"), file: "click", vol: 0.6 },
        { at: wordAt(s[1], "mismo"), file: "ding", vol: 0.7 },
      ];
    case "cta":
      return [
        { at: wordAt(s[0], "comenta"), file: "pop", vol: 0.8 },
        { at: wordAt(s[0], "día"), file: "click", vol: 0.7 },
        { at: wordEnd(s[0], s[0].words[s[0].words.length - 1]?.w ?? "partidos") + 4, file: "ding", vol: 0.7 },
      ];
    default:
      return [];
  }
};
