import { Easing, interpolate, spring } from "remotion";
import { CLAMP, FPS } from "./config";

/** Muelles calibrados como en los reels de motion graphics hechos con código. */
export const SPRINGS = {
  /** Palabras, pastillas, iconos (ligero rebote). */
  snappy: { damping: 14, stiffness: 160, mass: 0.6 },
  /** Bloques grandes (sin rebote). */
  smooth: { damping: 20, stiffness: 90, mass: 1 },
  /** Acentos y sellos (rebote marcado). */
  bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
  /** Contadores. */
  counter: { damping: 30, stiffness: 60 },
} as const;

/** Progreso 0..1 de un muelle que arranca en el frame `at`. */
export const springAt = (frame: number, at: number, config: { damping: number; stiffness: number; mass?: number } = SPRINGS.snappy) =>
  frame < at ? 0 : spring({ frame: frame - at, fps: FPS, config });

/** Entrada «premium»: aparece, sube 40 px y crece de 0,94 a 1 con muelle suave. */
export const enter = (frame: number, at: number) => {
  const p = springAt(frame, at, SPRINGS.smooth);
  return { opacity: Math.min(1, p * 1.4), translate: `0px ${40 * (1 - p)}px`, scale: String(0.94 + 0.06 * p) };
};

/** Salida rápida en los últimos frames de una escena (más corta que la entrada). */
export const exitStyle = (frame: number, durationInFrames: number) => {
  const p = interpolate(frame, [durationInFrames - 12, durationInFrames - 2], [0, 1], { ...CLAMP, easing: Easing.bezier(0.7, 0, 0.84, 0) });
  return { y: -42 * p, opacity: 1 - p };
};

/** Respiración sutil cuando algo lleva más de 2 s quieto. */
export const breathe = (frame: number, since = 60) => {
  if (frame < since) return { scale: 1, y: 0 };
  const f = frame - since;
  return { scale: 1 + Math.sin(f / 22) * 0.012, y: Math.sin(f / 30) * 3 };
};
