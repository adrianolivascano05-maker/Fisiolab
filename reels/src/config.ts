/**
 * CONFIGURACIÓN COMPARTIDA por todos los reels: formato, colores y tipos.
 * Lo propio de cada vídeo (guion, datos, escenas) vive en src/videos/<id>/.
 */

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const COLORS = {
  // «Clínico»: blanco-gris frío, tinta azul marino y un solo acento azul
  bgTop: "#FAFBFC",
  bgBottom: "#EEF2F6",
  orange: "#0A58CA", // dato fuerte (azul clínico)
  cyan: "#0FA3B1", // prueba / radiografía (verde azulado)
  red: "#D7263D", // error
  green: "#12A37A", // lo correcto
  amber: "#FFE066", // marcador fluorescente (subtítulos)
  white: "#0B1220", // texto principal (tinta)
  muted: "rgba(11,18,32,0.55)",
  ink: "#0B1220",
  paper: "#FFFFFF",
  line: "rgba(11,18,32,0.16)", // bordes finos
};

/** Sombras suaves (sin pegatina). */
export const STICKER = "0 12px 32px rgba(11,18,32,0.10)";
export const STICKER_SM = "0 6px 18px rgba(11,18,32,0.10)";

/** Opciones habituales de interpolate(): no extrapolar por ningún lado. */
export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Tiempos (segundos, línea de tiempo global) de cada frase y de cada palabra. Los escriben tools/align.mjs o tools/estimate.mjs */
export type WordTiming = { w: string; start: number; end: number };
export type SentenceTiming = { start: number; end: number; words: WordTiming[] };
export type Timings = {
  source: "estimado" | "voz";
  voiceDuration: number;
  sentences: SentenceTiming[]; // mismo orden que SCENES[].sentences aplanado
  tail: number; // segundos extra al final tras la última frase
  intro?: number; // segundos de cold open antes de la voz
};

/** Una frase = unidad de alineación con la voz (separada por pausas en el TTS). */
export type Sentence = {
  /** Texto tal y como se locuta (los números, en letras, para el TTS). */
  text: string;
  /** Líneas de subtítulo: cada una es una secuencia de palabras habladas consecutivas (≤ 6 palabras). */
  chunks?: string[];
  /** Palabras que se resaltan en naranja (sin signos). */
  keys?: string[];
  /** Cómo se muestran en pantalla algunos grupos de palabras habladas (p. ej. números en cifras). */
  display?: Record<string, string>;
};

export type SceneDef = { id: string; sentences: Sentence[] };

/** Metadatos de un vídeo (lo que cambia de un reel a otro, aparte de las escenas). */
export type VideoMeta = {
  id: string;
  titulo: string;
  pilar: string;
  fuente: string;
  portada: { linea1: string; dato: string; sub: string };
  /** Cold open: dato a pantalla completa antes de que arranque la voz (y último fotograma, para el bucle). */
  coldOpen: { big: string; small: string };
};

export const flatSentences = (scenes: SceneDef[]): { scene: string; sentence: Sentence; sceneIndex: number }[] =>
  scenes.flatMap((s, si) => s.sentences.map((sentence) => ({ scene: s.id, sentence, sceneIndex: si })));

/** Normaliza una palabra para compararla (sin signos ni mayúsculas). */
export const norm = (w: string) => w.toLowerCase().replace(/[«»"“”¿?¡!,.:;()…]/g, "").replace(/\.{3}/g, "");

/** Palabras habladas de una frase (misma tokenización que usan las herramientas). */
export const spokenWords = (text: string) => text.split(/\s+/).map(norm).filter(Boolean);
