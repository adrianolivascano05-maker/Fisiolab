import { SceneClock, wordAt, wordEnd } from "./timeline";

/** Efecto de sonido en un frame RELATIVO a la escena. */
export type Cue = { at: number; file: string; vol?: number };

/** Momentos clave de cada escena (los mismos que disparan las animaciones, palabra a palabra). */
export const sceneCues = (c: SceneClock): Cue[] => {
  const s = c.s;
  switch (c.id) {
    case "gancho":
      return [
        { at: Math.max(0, wordAt(s[0], "fisios") - 2), file: "pop", vol: 0.7 },
        { at: wordAt(s[0], "expertos"), file: "click", vol: 0.9 },
        { at: wordAt(s[1], "palpando"), file: "pop", vol: 0.7 },
        { at: wordAt(s[1], "lumbares"), file: "ding", vol: 0.4 },
        { at: wordAt(s[2], "mitad") - 2, file: "impact", vol: 0.7 },
        { at: wordAt(s[2], "equivocaron"), file: "impact", vol: 0.9 },
        { at: wordAt(s[2], "equivocaron"), file: "error", vol: 0.6 },
        { at: wordAt(s[2], "vértebra"), file: "pop", vol: 0.7 },
      ];
    case "prueba":
      return [
        { at: 0, file: "xray", vol: 0.8 },
        { at: wordAt(s[0], "opinión"), file: "pop", vol: 0.6 },
        { at: wordEnd(s[0], "opinión"), file: "error", vol: 0.7 },
        { at: wordAt(s[0], "comprobaron"), file: "ding", vol: 0.7 },
        { at: wordAt(s[0], "radiografía") - 2, file: "xray", vol: 0.9 },
      ];
    case "estudio":
      return [
        { at: wordAt(s[0], "cinco"), file: "pop", vol: 0.7 },
        { at: wordAt(s[0], "manual"), file: "pop", vol: 0.5 },
        { at: wordAt(s[0], "marcaron"), file: "click", vol: 0.8 },
        ...["L1", "L3", "L5"].map((lv) => ({ at: wordAt(s[0], lv) + 2, file: "click", vol: 0.9 })),
        { at: wordAt(s[0], "setenta"), file: "pop", vol: 0.7 },
        { at: wordAt(s[0], "lumbalgia"), file: "error", vol: 0.45 },
        { at: wordAt(s[1], "marcador"), file: "click", vol: 0.8 },
        { at: wordAt(s[1], "piel"), file: "whoosh", vol: 0.4 },
        { at: wordAt(s[1], "radiografía") - 3, file: "xray", vol: 0.9 },
      ];
    case "quiz":
      return [
        { at: wordAt(s[0], "cuántos"), file: "pop", vol: 0.8 },
        ...[0, 1, 2].map((i) => ({ at: wordAt(s[0], "crees") + i * 5, file: "pop", vol: 0.6 })),
        { at: wordAt(s[0], "acertaron") + 6, file: "click", vol: 1 },
      ];
    case "hallazgo":
      return [
        { at: wordAt(s[0], "vértebra"), file: "pop", vol: 0.6 },
        { at: wordAt(s[0], "exacta"), file: "click", vol: 0.8 },
        ...[0, 1, 2].map((i) => ({ at: wordAt(s[0], "cuarenta") - 2 + i * 3, file: "error", vol: 0.5 })),
        { at: wordEnd(s[0], "siete"), file: "impact", vol: 1 },
      ];
    case "giro":
      return [
        { at: wordAt(s[0], "incómodo"), file: "impact", vol: 0.6 },
        { at: wordAt(s[0], "cambiaba"), file: "pop", vol: 0.6 },
        { at: wordEnd(s[0], "paciente"), file: "error", vol: 0.8 },
        { at: wordAt(s[1], "peso") + 4, file: "error", vol: 0.8 },
        { at: wordAt(s[1], "edad") + 4, file: "error", vol: 0.8 },
        { at: wordEnd(s[1], "edad") + 10, file: "error", vol: 0.8 },
        { at: wordAt(s[2], "quién"), file: "whoosh", vol: 0.7 },
        { at: wordAt(s[2], "palpaba"), file: "impact", vol: 0.7 },
      ];
    case "matiz":
      return [
        { at: wordAt(s[0], "buena"), file: "ding", vol: 0.6 },
        ...[0, 1, 2].map((i) => ({ at: wordAt(s[0], "tres") + i * 2, file: "pop", vol: 0.5 })),
        { at: wordEnd(s[0], "nivel"), file: "ding", vol: 0.8 },
        { at: wordAt(s[1], "zona"), file: "ding", vol: 0.7 },
        { at: wordAt(s[2], "vértebra"), file: "error", vol: 0.5 },
      ];
    case "quehacer":
      return [
        ...["tienes", "L4-L5", "bloqueada"].map((w) => ({ at: wordAt(s[0], w), file: "click", vol: 0.6 })),
        { at: wordEnd(s[0], "bloqueada") + 2, file: "error", vol: 0.8 },
        ...["zona", "lumbar", "baja"].map((w) => ({ at: wordAt(s[1], w), file: "click", vol: 0.6 })),
        { at: wordAt(s[1], "busca"), file: "pop", vol: 0.5 },
        { at: wordAt(s[1], "reconoce"), file: "ding", vol: 0.8 },
      ];
    case "cta":
      return [
        { at: wordAt(s[0], "comenta"), file: "pop", vol: 0.9 },
        { at: wordAt(s[0], "l4"), file: "click", vol: 0.8 },
        { at: wordAt(s[0], "l4") + 5, file: "click", vol: 0.8 },
        { at: wordAt(s[0], "seguridad"), file: "impact", vol: 0.5 },
        { at: wordAt(s[1], "parte"), file: "whoosh", vol: 0.8 },
        { at: wordAt(s[1], "test"), file: "pop", vol: 0.6 },
        { at: wordAt(s[1], "confirma"), file: "error", vol: 0.7 },
        { at: wordAt(s[1], "descarta"), file: "error", vol: 0.7 },
        { at: wordEnd(s[1], "descarta") + 6, file: "ding", vol: 0.6 },
      ];
    default:
      return [];
  }
};
