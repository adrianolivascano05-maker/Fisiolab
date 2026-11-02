import { SceneClock, wordAt, wordEnd } from "../../timeline";
import { Cue } from "../types";

/** Efectos de sonido de cada escena, en los mismos momentos que las animaciones. */
export const sceneCues = (c: SceneClock): Cue[] => {
  const s = c.s;
  switch (c.id) {
    case "gancho":
      return [
        { at: wordAt(s[0], "nalga"), file: "error", vol: 0.4 },
        { at: wordAt(s[1], "test"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "positivo"), file: "click", vol: 0.8 },
        { at: wordAt(s[2], "sacroilíaca"), file: "impact", vol: 0.6 },
      ];
    case "prueba":
      return [
        { at: wordAt(s[0], "revisión"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "noventa"), file: "riser", vol: 0.3 },
        { at: wordEnd(s[0], "ciento"), file: "impact", vol: 0.7 },
        { at: wordAt(s[1], "original"), file: "whoosh", vol: 0.6 },
        { at: wordAt(s[1], "dos"), file: "ding", vol: 0.5 },
        { at: wordAt(s[2], "otra"), file: "error", vol: 0.7 },
      ];
    case "estudio":
      return [
        { at: wordAt(s[0], "ciento"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "diagnosticados"), file: "whoosh", vol: 0.4 },
        { at: wordAt(s[1], "seis"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "tres"), file: "ding", vol: 0.5 },
        { at: wordAt(s[1], "sacroilíaca"), file: "click", vol: 0.7 },
        { at: wordAt(s[2], "cuatro"), file: "impact", vol: 0.6 },
      ];
    case "quiz":
      return [
        { at: wordAt(s[0], "qué"), file: "pop", vol: 0.8 },
        ...[0, 1, 2].map((i) => ({ at: wordAt(s[0], "mide") + i * 5, file: "pop", vol: 0.5 })),
        { at: wordEnd(s[0], "uno") + 4, file: "click", vol: 1 },
      ];
    case "hallazgo":
      return [
        { at: wordAt(s[0], "cuántos"), file: "error", vol: 0.6 },
        { at: wordAt(s[0], "positivo"), file: "impact", vol: 0.9 },
        { at: wordAt(s[0], "formaba"), file: "whoosh", vol: 0.5 },
        { at: wordAt(s[0], "diagnóstico"), file: "impact", vol: 0.7 },
      ];
    case "giro":
      return [
        { at: wordAt(s[0], "detector", 0), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "mismo"), file: "error", vol: 0.5 },
        { at: wordAt(s[0], "fuego"), file: "whoosh", vol: 0.5 },
        { at: wordEnd(s[1], "infiltración") + 2, file: "error", vol: 0.8 },
        { at: wordEnd(s[1], "problema") + 2, file: "error", vol: 0.8 },
        { at: wordAt(s[1], "acierta"), file: "impact", vol: 0.8 },
      ];
    case "matiz":
      return [
        { at: wordAt(s[0], "útil"), file: "ding", vol: 0.5 },
        { at: wordAt(s[0], "poco"), file: "error", vol: 0.5 },
        { at: wordAt(s[0], "batería"), file: "whoosh", vol: 0.5 },
        { at: wordAt(s[0], "más"), file: "ding", vol: 0.8 },
      ];
    case "quehacer":
      return [
        { at: wordAt(s[0], "no"), file: "pop", vol: 0.6 },
        { at: wordEnd(s[0], "cuatro") + 2, file: "error", vol: 0.8 },
        { at: wordAt(s[1], "haz"), file: "whoosh", vol: 0.5 },
        ...[0, 1, 2].map((i) => ({ at: wordAt(s[1], "cuenta") + i * 10, file: "ding", vol: 0.5 })),
      ];
    case "cta":
      return [
        { at: wordAt(s[0], "comenta"), file: "pop", vol: 0.8 },
        { at: wordAt(s[0], "original"), file: "click", vol: 0.7 },
        { at: wordAt(s[1], "parte"), file: "whoosh", vol: 0.8 },
        { at: wordAt(s[1], "lasègue"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "revés"), file: "whoosh", vol: 0.6 },
        { at: wordEnd(s[1], "revés") + 6, file: "ding", vol: 0.6 },
      ];
    default:
      return [];
  }
};
