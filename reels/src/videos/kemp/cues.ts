import { SceneClock, wordAt, wordEnd } from "../../timeline";
import { Cue } from "../types";

/** Efectos de sonido de cada escena, en los mismos momentos que las animaciones. */
export const sceneCues = (c: SceneClock): Cue[] => {
  const s = c.s;
  switch (c.id) {
    case "gancho":
      return [
        { at: Math.max(0, wordAt(s[0], "kemp") - 4), file: "pop", vol: 0.7 },
        { at: wordAt(s[0], "positivo"), file: "error", vol: 0.5 },
        { at: wordAt(s[1], "anotas"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "facetario"), file: "click", vol: 0.9 },
        { at: wordAt(s[2], "confirma") - 2, file: "impact", vol: 0.7 },
        { at: wordAt(s[2], "confirma") + 2, file: "error", vol: 0.6 },
        { at: wordAt(s[2], "descarta") - 1, file: "impact", vol: 0.9 },
        { at: wordAt(s[2], "descarta") + 3, file: "error", vol: 0.6 },
      ];
    case "prueba":
      return [
        { at: 0, file: "xray", vol: 0.6 },
        { at: wordAt(s[0], "revisión"), file: "pop", vol: 0.7 },
        { at: wordAt(s[0], "dos"), file: "impact", vol: 0.4 },
        ...[0, 4, 8].map((d) => ({ at: wordAt(s[0], "reunió") + d, file: "whoosh", vol: 0.5 })),
        { at: wordAt(s[0], "midieron"), file: "ding", vol: 0.5 },
      ];
    case "datos":
      return [
        { at: wordAt(s[0], "sensibilidad"), file: "pop", vol: 0.7 },
        { at: wordAt(s[0], "veintitrés"), file: "click", vol: 0.8 },
        { at: wordAt(s[0], "uno"), file: "impact", vol: 0.6 },
        { at: wordAt(s[1], "especificidad"), file: "pop", vol: 0.7 },
        { at: wordAt(s[1], "dieciséis"), file: "click", vol: 0.8 },
        { at: wordAt(s[1], "seiscientos") + 10, file: "impact", vol: 0.8 },
      ];
    case "quiz":
      return [
        { at: wordAt(s[0], "kemp") - 4, file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "confirma") - 2, file: "pop", vol: 0.8 },
        ...[0, 1, 2].map((i) => ({ at: wordAt(s[0], "confirma") + 6 + i * 5, file: "pop", vol: 0.5 })),
        { at: wordEnd(s[0], "descarta") + 4, file: "click", vol: 1 },
      ];
    case "giro":
      return [
        { at: wordAt(s[0], "especificidad"), file: "pop", vol: 0.6 },
        ...[0, 2, 3, 5, 6, 8].map((i) => ({ at: wordAt(s[0], "positivo") + i * 2, file: "click", vol: 0.6 })),
        { at: wordEnd(s[0], "facetario") + 2, file: "error", vol: 0.8 },
        { at: wordAt(s[1], "negativo"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "tampoco") + 2, file: "error", vol: 0.8 },
        { at: wordEnd(s[1], "tranquilo") + 2, file: "ding", vol: 0.7 },
      ];
    case "matiz":
      return [
        { at: wordAt(s[0], "sirva"), file: "error", vol: 0.6 },
        ...["pieza", "extender", "rodilla", "neurológica"].map((w) => ({ at: wordAt(s[1], w), file: "click", vol: 0.8 })),
        { at: wordAt(s[1], "normal"), file: "ding", vol: 0.8 },
      ];
    case "quehacer":
      return [
        { at: wordAt(s[0], "facetario"), file: "click", vol: 0.7 },
        { at: wordEnd(s[0], "kemp") + 2, file: "error", vol: 0.8 },
        ...[0, 1, 2, 3].map((i) => ({ at: wordAt(s[1], "piezas") + i * 5, file: "ding", vol: 0.5 })),
      ];
    case "cta":
      return [
        { at: wordAt(s[0], "comenta"), file: "pop", vol: 0.8 },
        { at: wordAt(s[0], "kemp"), file: "click", vol: 0.7 },
        { at: wordEnd(s[0], s[0].words[s[0].words.length - 1]?.w ?? "kemp") + 4, file: "ding", vol: 0.7 },
      ];
    default:
      return [];
  }
};
