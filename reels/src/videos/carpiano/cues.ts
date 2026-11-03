import { SceneClock, wordAt, wordEnd } from "../../timeline";
import { Cue } from "../types";

/** Efectos de sonido de cada escena, en los mismos momentos que las animaciones. */
export const sceneCues = (c: SceneClock): Cue[] => {
  const s = c.s;
  switch (c.id) {
    case "gancho":
      return [
        { at: wordAt(s[0], "fibromialgia"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "muñeca"), file: "error", vol: 0.5 },
        { at: wordAt(s[1], "túnel"), file: "whoosh", vol: 0.5 },
        { at: wordAt(s[1], "carpiano") + 4, file: "ding", vol: 0.6 },
        { at: wordAt(s[2], "cerrado"), file: "impact", vol: 0.6 },
      ];
    case "prueba":
      return [
        { at: wordAt(s[0], "revisión"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "casos"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "controles"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "nueve"), file: "click", vol: 0.6 },
      ];
    case "datos":
      return [
        { at: s[0].start, file: "impact", vol: 0.5 },
        { at: wordAt(s[0], "dos"), file: "whoosh", vol: 0.5 },
        { at: wordAt(s[1], "triple"), file: "ding", vol: 0.7 },
        { at: wordAt(s[2], "resorte"), file: "pop", vol: 0.5 },
        { at: wordAt(s[2], "quervain"), file: "pop", vol: 0.5 },
        { at: wordAt(s[2], "tendinitis"), file: "pop", vol: 0.5 },
        { at: wordAt(s[2], "artrosis"), file: "pop", vol: 0.5 },
      ];
    case "quiz":
      return [
        { at: Math.max(0, wordAt(s[0], "qué") - 2), file: "pop", vol: 0.8 },
        ...[0, 1, 2].map((i) => ({ at: wordAt(s[0], "va") + i * 4, file: "pop", vol: 0.5 })),
        { at: wordEnd(s[0], "primero") + 4, file: "click", vol: 1 },
      ];
    case "hallazgo":
      return [
        { at: wordAt(s[0], "solo"), file: "error", vol: 0.5 },
        { at: wordAt(s[0], "juntas"), file: "impact", vol: 0.8 },
        { at: wordAt(s[1], "antes"), file: "whoosh", vol: 0.5 },
        { at: wordAt(s[1], "causa"), file: "error", vol: 0.7 },
      ];
    case "giro":
      return [
        { at: wordAt(s[0], "sanitario"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "operaban"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "posible"), file: "impact", vol: 0.5 },
        { at: wordAt(s[1], "diagnósticos"), file: "ding", vol: 0.6 },
      ];
    case "matiz":
      return [
        { at: Math.max(0, s[0].start - 2), file: "impact", vol: 0.5 },
        { at: wordAt(s[0], "asociación"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "causa"), file: "error", vol: 0.6 },
      ];
    case "quehacer":
      return [
        { at: wordAt(s[0], "confirma"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "exploración"), file: "click", vol: 0.6 },
        { at: wordAt(s[1], "nervio"), file: "ding", vol: 0.7 },
      ];
    case "cta":
      return [
        { at: wordAt(s[0], "comenta"), file: "pop", vol: 0.8 },
        { at: wordAt(s[0], "fibro"), file: "click", vol: 0.7 },
        { at: wordEnd(s[0], s[0].words[s[0].words.length - 1]?.w ?? "fibro") + 4, file: "ding", vol: 0.7 },
      ];
    default:
      return [];
  }
};
