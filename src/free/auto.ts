// Autocompletado de la medición libre: qué medición encaja con el movimiento del vídeo y dónde
// empieza y acaba. Funciones puras sobre las poses ya detectadas.
import { bodyFrame, measureFrame, planeNormal, type MeasureConfig } from "./geometry";
import { jointPoint, presets } from "./joints";
import type { FramePose } from "./types";

export type Preset = (typeof presets)[number];

export function toConfig(p: Preset): MeasureConfig {
  return {
    plane: p.plane,
    reference: p.reference.type === "plumb_line" ? { type: "plumb_line" } : { type: "axial_body", start: p.reference.start, end: p.reference.end },
    movement: { ...p.movement },
  };
}

/**
 * Parte del segmento móvil que queda dentro del plano anatómico (1 = en el plano, 0 = perpendicular).
 * Cuando es pequeña, el ángulo proyectado no es fiable: un brazo en abducción visto en el plano
 * sagital se queda en un punto y su ángulo salta.
 */
export function inPlaneFraction(pose: FramePose, cfg: MeasureConfig): number | null {
  if (cfg.plane === "screen") return 1;
  const frame = bodyFrame(pose.world);
  const a = jointPoint(pose.world, cfg.movement.start);
  const b = jointPoint(pose.world, cfg.movement.end);
  if (!frame || !a || !b) return null;
  const v = [b.x - a.x, b.y - a.y, b.z - a.z];
  const len = Math.hypot(v[0]!, v[1]!, v[2]!);
  if (len < 1e-9) return null;
  const n = planeNormal(frame, cfg.plane);
  const along = (v[0]! * n[0] + v[1]! * n[1] + v[2]! * n[2]) / len;
  return Math.sqrt(Math.max(0, 1 - along * along));
}

export type Sample = { frame: number; angle: number };

/** Ángulo por fotograma, solo donde la medida es fiable (puntos visibles y segmento en el plano). */
export function angleSeries(poses: FramePose[], cfg: MeasureConfig, size: { w: number; h: number }): Sample[] {
  const out: Sample[] = [];
  for (const p of [...poses].sort((a, b) => a.frame - b.frame)) {
    const angle = measureFrame(p, cfg, size);
    const share = inPlaneFraction(p, cfg);
    if (angle !== null && share !== null && share >= 0.5) out.push({ frame: p.frame, angle });
  }
  return out;
}

/** Por debajo de esta amplitud no se considera que haya un movimiento claro. */
const MIN_MOVEMENT_DEG = 10;

/**
 * La medición preparada que más se mueve en el vídeo (la que el paciente está haciendo).
 * Solo cuenta si se puede medir en al menos la mitad de los fotogramas.
 */
export function choosePreset(poses: FramePose[], size: { w: number; h: number }): { preset: Preset; amplitude: number } | null {
  let best: { preset: Preset; amplitude: number } | null = null;
  for (const preset of presets) {
    const s = angleSeries(poses, toConfig(preset), size);
    if (s.length < Math.max(3, poses.length / 2)) continue;
    const angles = s.map((x) => x.angle);
    const amplitude = Math.max(...angles) - Math.min(...angles);
    if (amplitude >= MIN_MOVEMENT_DEG && (!best || amplitude > best.amplitude)) best = { preset, amplitude };
  }
  return best;
}

/**
 * Inicio, pico y fin del movimiento: el pico es el fotograma más alejado de la posición de partida;
 * el inicio y el fin, los fotogramas a su alrededor donde aún está cerca de ella (15 % del recorrido,
 * 5° como mínimo).
 */
export function movementWindow(series: Sample[]): { start: number; peak: number; end: number } | null {
  if (series.length < 3) return null;
  const first = series.slice(0, 3).map((s) => s.angle).sort((a, b) => a - b);
  const base = first[Math.floor(first.length / 2)]!;
  const off = (i: number) => Math.abs(series[i]!.angle - base);
  let pk = 0;
  for (let i = 1; i < series.length; i++) if (off(i) > off(pk)) pk = i;
  const excursion = off(pk);
  if (excursion < MIN_MOVEMENT_DEG) return null;
  const threshold = Math.max(5, 0.15 * excursion);
  let s = pk;
  while (s > 0 && off(s) >= threshold) s--;
  let e = pk;
  while (e < series.length - 1 && off(e) >= threshold) e++;
  return { start: series[s]!.frame, peak: series[pk]!.frame, end: series[e]!.frame };
}

/** `count` fotogramas repartidos entre `start` y `end` (ambos incluidos). */
export function spread(start: number, end: number, count: number): number[] {
  const step = Math.max(1, Math.ceil((end - start + 1) / count));
  const frames: number[] = [];
  for (let f = start; f <= end; f += step) frames.push(f);
  if (frames.at(-1) !== end) frames.push(end);
  return frames;
}
