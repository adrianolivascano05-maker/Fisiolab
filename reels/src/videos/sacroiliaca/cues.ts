import { SceneClock, wordAt, wordEnd } from "../../timeline";
import { Cue } from "../types";

/** Efectos de sonido de cada escena, en los mismos momentos que las animaciones. */
export const sceneCues = (c: SceneClock): Cue[] => {
  const s = c.s;
  switch (c.id) {
    case "gancho":
      return [
        { at: Math.max(0, s[0].start - 4), file: "riser", vol: 0.4 },
        { at: wordEnd(s[0], "ciento"), file: "impact", vol: 0.8 },
        { at: wordAt(s[1], "revisión"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "cuatro"), file: "click", vol: 0.7 },
        { at: wordAt(s[2], "original"), file: "whoosh", vol: 0.6 },
        { at: wordAt(s[2], "parece"), file: "error", vol: 0.7 },
      ];
    case "prueba":
      return [
        { at: wordAt(s[0], "error"), file: "impact", vol: 0.6 },
        { at: wordAt(s[0], "dos", 0), file: "pop", vol: 0.6 },
        { at: wordEnd(s[0], "ocho") + 4, file: "error", vol: 0.8 },
        { at: wordAt(s[0], "dos", 1), file: "pop", vol: 0.6 },
        { at: wordEnd(s[0], "dieciocho"), file: "ding", vol: 0.8 },
      ];
    case "estudio":
      return [
        { at: wordAt(s[0], "ciento"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "todos"), file: "click", vol: 0.7 },
        { at: wordAt(s[0], "diagnosticados"), file: "whoosh", vol: 0.4 },
        { at: wordAt(s[1], "cómo"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "positivos"), file: "ding", vol: 0.7 },
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
        { at: wordAt(s[1], "pacientes"), file: "whoosh", vol: 0.5 },
        { at: wordAt(s[1], "mismos"), file: "impact", vol: 0.7 },
      ];
    case "giro":
      return [
        { at: wordAt(s[0], "comparó"), file: "pop", vol: 0.6 },
        { at: wordEnd(s[0], "infiltración") + 2, file: "error", vol: 0.8 },
        { at: wordEnd(s[0], "diagnóstico") + 2, file: "error", vol: 0.8 },
        { at: wordAt(s[1], "sensibilidad"), file: "impact", vol: 0.8 },
      ];
    case "matiz":
      return [
        { at: wordAt(s[0], "autores"), file: "pop", vol: 0.5 },
        { at: wordAt(s[0], "poco"), file: "error", vol: 0.5 },
        { at: wordAt(s[0], "batería"), file: "whoosh", vol: 0.5 },
        { at: wordAt(s[0], "más"), file: "ding", vol: 0.8 },
      ];
    case "quehacer":
      return [
        { at: wordAt(s[0], "no"), file: "pop", vol: 0.6 },
        { at: wordEnd(s[0], "cuatro") + 2, file: "error", vol: 0.8 },
        { at: wordAt(s[0], "haz"), file: "whoosh", vol: 0.5 },
        ...[0, 1, 2].map((i) => ({ at: wordAt(s[0], "cuenta") + i * 10, file: "ding", vol: 0.5 })),
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
