// Bienestar (S21): cuestionario de 5 preguntas de 1 a 5, donde 5 es siempre lo mejor
// (ítems de McLean et al., 2010: fatiga, calidad del sueño, dolor muscular, estrés y ánimo).
// Funciones puras; las prueba wellness.test.ts.

export type WellnessItem = "fatigue" | "sleep" | "soreness" | "stress" | "mood";

export const wellnessItems: { id: WellnessItem; label: string; short: string; low: string; high: string }[] = [
  { id: "fatigue", label: "Fatiga", short: "Fatiga", low: "Muy cansado", high: "Muy fresco" },
  { id: "sleep", label: "Calidad del sueño", short: "Sueño", low: "Muy mala", high: "Muy buena" },
  { id: "soreness", label: "Dolor muscular general", short: "Dolor musc.", low: "Mucho", high: "Ninguno" },
  { id: "stress", label: "Estrés", short: "Estrés", low: "Mucho", high: "Nada" },
  { id: "mood", label: "Ánimo", short: "Ánimo", low: "Muy bajo", high: "Muy bueno" },
];

export type WellnessScores = Record<WellnessItem, number>;

/** Suma de las 5 respuestas: de 5 (peor) a 25 (mejor). */
export function wellnessTotal(s: WellnessScores): number {
  return wellnessItems.reduce((sum, i) => sum + s[i.id], 0);
}

/** Respuestas de 1 o 2. */
export function lowItems(s: WellnessScores): WellnessItem[] {
  return wellnessItems.filter((i) => s[i.id] <= 2).map((i) => i.id);
}

/** Registros previos necesarios para comparar con la media del paciente. */
const MIN_BASELINE = 3;

export type Baseline = { mean: number; sd: number; n: number; diff: number };

/** El total de hoy frente a los anteriores del paciente: su media, la dispersión y la diferencia. Sin umbral ni
 * clasificación: la lectura es del profesional (revisión del 30-10-2026). */
export function compareToBaseline(today: number, previous: number[]): Baseline | null {
  if (previous.length < MIN_BASELINE) return null;
  const n = previous.length;
  const mean = previous.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(previous.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return { mean, sd, n, diff: today - mean };
}
