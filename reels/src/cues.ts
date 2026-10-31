import { SceneClock, wordAt } from "./timeline";

/** Efecto de sonido en un frame RELATIVO a la escena. */
export type Cue = { at: number; file: string; vol?: number };

/** Momentos clave de cada escena (los mismos que usan las animaciones). */
export const sceneCues = (c: SceneClock): Cue[] => {
  const s = c.s;
  switch (c.id) {
    case "gancho":
      return [
        { at: s[0].start, file: "pop", vol: 0.7 },
        { at: s[1].start, file: "pop", vol: 0.7 },
        { at: wordAt(s[2], "mitad") - 2, file: "impact", vol: 0.7 },
        { at: wordAt(s[2], "equivocaron"), file: "impact", vol: 0.9 },
      ];
    case "prueba":
      return [
        { at: 0, file: "xray", vol: 0.8 },
        { at: wordAt(s[0], "radiografía") - 3, file: "xray", vol: 0.9 },
      ];
    case "estudio":
      return [
        { at: wordAt(s[0], "Cinco"), file: "pop", vol: 0.7 },
        { at: wordAt(s[0], "setenta"), file: "pop", vol: 0.7 },
        ...["L1", "L3", "L5"].map((lv) => ({ at: wordAt(s[0], lv) + 1, file: "click", vol: 0.9 })),
        { at: wordAt(s[1], "radiografía") - 4, file: "xray", vol: 0.9 },
        { at: Math.min(wordAt(s[1], "radiografía") - 4 + 28, s[1].end - 10), file: "pop", vol: 0.8 },
      ];
    case "hallazgo":
      return [{ at: wordAt(s[0], "cuarenta") + 20, file: "impact", vol: 1 }];
    case "giro":
      return [
        { at: wordAt(s[1], "peso"), file: "error", vol: 0.8 },
        { at: wordAt(s[1], "edad"), file: "error", vol: 0.8 },
        { at: s[1].end + 4, file: "error", vol: 0.8 },
        { at: s[2].start + 8, file: "impact", vol: 0.6 },
      ];
    case "matiz":
      return [
        { at: wordAt(s[0], "cuatro") + 20, file: "ding", vol: 0.8 },
        { at: wordAt(s[1], "zona") - 4, file: "ding", vol: 0.7 },
        { at: wordAt(s[2], "vértebra") - 4, file: "error", vol: 0.5 },
      ];
    case "quehacer":
      return [
        { at: wordAt(s[0], "bloqueada") + 4, file: "error", vol: 0.8 },
        { at: wordAt(s[1], "zona") - 4, file: "ding", vol: 0.8 },
        { at: wordAt(s[1], "reconoce") - 6, file: "ding", vol: 0.8 },
      ];
    case "cta":
      return [
        { at: s[0].start + 2, file: "pop", vol: 0.9 },
        { at: s[1].start, file: "whoosh", vol: 0.8 },
        { at: s[1].end + 4, file: "ding", vol: 0.6 },
      ];
    default:
      return [];
  }
};
