// Fuerza (S13-S14): velocidad media de la barra por vídeo, pérdida de velocidad en la serie y
// perfil carga-velocidad con el 1RM estimado. Funciones puras; las prueba strength.test.ts.
import { linearRegression } from "./profile";
import { intervalS } from "./video";

export type ExerciseId = "squat" | "bench_press" | "deadlift" | "military_press" | "prone_bench_pull" | "hip_thrust";

export type Exercise = {
  id: ExerciseId;
  label: string;
  /** Velocidad media en el 1RM (umbral de velocidad mínima, m/s), editable por el usuario. */
  mvt: number;
  /** De dónde sale el umbral: si no hay una cifra clara en la literatura, se dice. */
  mvtSource: string;
  /** Qué es una repetición en el vídeo: dónde empieza y acaba la subida. */
  rep: string;
  /** Cómo medir el recorrido de la barra. */
  rom: string;
};

export const exercises: Exercise[] = [
  {
    id: "squat",
    label: "Sentadilla",
    mvt: 0.3,
    mvtSource: "0,30 m/s: valor de referencia habitual en sentadilla completa (algunos estudios dan 0,32).",
    rep: "Desde el punto más bajo hasta que las piernas quedan estiradas.",
    rom: "Altura de la barra de pie menos su altura abajo, con cinta métrica o en el vídeo junto a una referencia.",
  },
  {
    id: "bench_press",
    label: "Press de banca",
    mvt: 0.17,
    mvtSource: "0,17 m/s: umbral general recomendado en press de banca (otras fuentes, 0,15-0,16).",
    rep: "Desde que la barra toca el pecho hasta que los brazos quedan estirados.",
    rom: "Distancia del pecho a la barra con los brazos estirados.",
  },
  {
    id: "deadlift",
    label: "Peso muerto",
    mvt: 0.15,
    mvtSource: "0,14-0,15 m/s según la fuente; el 1RM estimado suele quedarse algo corto.",
    rep: "Desde que los discos despegan del suelo hasta quedar de pie con la cadera estirada.",
    rom: "Altura de la barra de pie menos su altura apoyada en el suelo.",
  },
  {
    id: "military_press",
    label: "Press militar",
    mvt: 0.2,
    mvtSource: "Por confirmar: no hay una cifra de referencia clara. Ajústala con un 1RM real.",
    rep: "Desde la barra a la altura de la barbilla hasta los brazos estirados.",
    rom: "Distancia de la barbilla a la barra con los brazos estirados.",
  },
  {
    id: "prone_bench_pull",
    label: "Remo tumbado en banco",
    mvt: 0.5,
    mvtSource: "Aproximado (en torno a 0,50 m/s); por confirmar.",
    rep: "Desde los brazos estirados hasta que la barra toca el banco.",
    rom: "Distancia de la barra colgando a la parte de abajo del banco.",
  },
  {
    id: "hip_thrust",
    label: "Hip thrust",
    mvt: 0.25,
    mvtSource: "Por confirmar: no hay una cifra de referencia clara. Ajústala con un 1RM real.",
    rep: "Desde la cadera abajo hasta la cadera estirada, en línea con el tronco.",
    rom: "Altura de la barra arriba menos su altura abajo.",
  },
];

export function getExercise(id: string): Exercise | undefined {
  return exercises.find((e) => e.id === id);
}

/** Rangos plausibles: fuera de ellos se avisa. */
export const plausibleVbt = { velocityMS: { min: 0.05, max: 2.5 }, romCm: { min: 5, max: 150 }, loadKg: { min: 0, max: 500 } };

/** Velocidad media de la fase de subida: recorrido / tiempo. */
export function meanVelocity(romM: number, durationS: number): number {
  if (!(romM > 0)) throw new RangeError("El recorrido debe ser mayor que cero");
  if (!(durationS > 0)) throw new RangeError("El fin de la subida debe ir después del inicio");
  return romM / durationS;
}

export type SetSummary = {
  /** Velocidad de cada repetición, en orden. */
  reps: number[];
  /** La más rápida: la que se usa para el perfil carga-velocidad. */
  best: number;
  mean: number;
  /** (más rápida − última) / más rápida · 100; null con una sola repetición. */
  velocityLossPct: number | null;
};

export function summarizeSet(reps: number[]): SetSummary {
  if (reps.length === 0) throw new RangeError("Hace falta al menos una repetición");
  const best = Math.max(...reps);
  const mean = reps.reduce((s, v) => s + v, 0) / reps.length;
  const last = reps.at(-1)!;
  return { reps, best, mean, velocityLossPct: reps.length > 1 ? ((best - last) / best) * 100 : null };
}

export type LoadPoint = { loadKg: number; velocity: number };

export type LoadVelocityProfile = {
  /** velocidad = intercept + slope · carga */
  intercept: number;
  slope: number;
  r2: number;
  mvt: number;
  /** Carga a la que la recta llega al umbral de velocidad mínima. */
  oneRmKg: number;
  /** Carga teórica a velocidad cero. */
  l0Kg: number;
};

/** Recta carga-velocidad por mínimos cuadrados y 1RM = carga a la velocidad del umbral. */
export function loadVelocityProfile(points: LoadPoint[], mvt: number): LoadVelocityProfile {
  if (new Set(points.map((p) => p.loadKg)).size < 2) throw new RangeError("Hacen falta al menos dos cargas distintas");
  if (!(mvt > 0)) throw new RangeError("La velocidad del 1RM debe ser mayor que cero");
  // linearRegression usa x = velocity, y = force: aquí x = carga, y = velocidad.
  const { slope, intercept, r2 } = linearRegression(points.map((p) => ({ velocity: p.loadKg, force: p.velocity })));
  if (!(slope < 0)) throw new RangeError("La velocidad no baja al subir la carga: revisa las series elegidas");
  const oneRmKg = (mvt - intercept) / slope;
  // Un 1RM por debajo de la carga más alta movida no tiene sentido: el umbral o las series no encajan.
  if (oneRmKg < Math.max(...points.map((p) => p.loadKg))) {
    throw new RangeError("Las velocidades ya están por debajo del umbral del 1RM: revisa las series o el umbral");
  }
  return { intercept, slope, r2, mvt, oneRmKg, l0Kg: -intercept / slope };
}

/** Velocidad esperada con una carga, según el perfil. */
export function velocityAtLoad(p: LoadVelocityProfile, loadKg: number): number {
  return p.intercept + p.slope * loadKg;
}

/** Marca de una repetición: inicio y fin de la subida, `seriesIndex` 0, 1, 2… por repetición. */
export type RepMark = { event: "bar_start" | "bar_end"; frame: number; seriesIndex: number };

/** Velocidad de cada repetición completa (con inicio y fin), en orden. */
export function velocitiesFromMarks(marks: RepMark[], romM: number, captureFps: number): number[] {
  const reps = [...new Set(marks.map((m) => m.seriesIndex))].sort((a, b) => a - b);
  const out: number[] = [];
  for (const i of reps) {
    const start = marks.find((m) => m.seriesIndex === i && m.event === "bar_start");
    const end = marks.find((m) => m.seriesIndex === i && m.event === "bar_end");
    if (start && end) out.push(meanVelocity(romM, intervalS(start.frame, end.frame, captureFps)));
  }
  return out;
}

export type VbtResult = { metric: "bar_velocity_m_s" | "velocity_loss_pct"; value: number; unit: string; seriesIndex: number };

/** Resultados que se guardan: cada repetición (1, 2…), la más rápida (0) y la pérdida de velocidad. */
export function vbtResults(reps: number[]): VbtResult[] {
  const s = summarizeSet(reps);
  const out: VbtResult[] = reps.map((v, i) => ({ metric: "bar_velocity_m_s", value: v, unit: "m/s", seriesIndex: i + 1 }));
  out.push({ metric: "bar_velocity_m_s", value: s.best, unit: "m/s", seriesIndex: 0 });
  if (s.velocityLossPct !== null) out.push({ metric: "velocity_loss_pct", value: s.velocityLossPct, unit: "%", seriesIndex: 0 });
  return out;
}
