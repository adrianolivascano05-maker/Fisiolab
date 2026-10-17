// Cuentas de la evidencia: razones de verosimilitud y probabilidad tras el test (nomograma de Fagan).
import type { Accuracy } from "./types";

/** LR+ y LR− de una fila: las publicadas o, si no hay, calculadas con la sensibilidad y la especificidad. */
export function likelihoodRatios(a: Accuracy): { pos: number | null; neg: number | null } {
  const s = a.sens !== undefined ? a.sens / 100 : null;
  const e = a.spec !== undefined ? a.spec / 100 : null;
  const pos = a.lrPos ?? (s !== null && e !== null && e < 1 ? s / (1 - e) : null);
  const neg = a.lrNeg ?? (s !== null && e !== null && e > 0 ? (1 - s) / e : null);
  return { pos: pos !== null && Number.isFinite(pos) ? pos : null, neg: neg !== null && Number.isFinite(neg) ? neg : null };
}

/** Probabilidad tras el test: odds previas × LR. Probabilidades en % (0-100). */
export function postTest(preTestPct: number, lr: number): number {
  const p = Math.min(99.9, Math.max(0.1, preTestPct)) / 100;
  const odds = (p / (1 - p)) * lr;
  return (odds / (1 + odds)) * 100;
}

/** Lectura de una razón de verosimilitud (Jaeschke et al., 1994). */
export function lrMeaning(lr: number, positive: boolean): string {
  if (positive) {
    if (lr >= 10) return "cambio grande: casi confirma";
    if (lr >= 5) return "cambio moderado: ayuda a confirmar";
    if (lr >= 2) return "cambio pequeño";
    return "apenas cambia la probabilidad";
  }
  if (lr <= 0.1) return "cambio grande: casi descarta";
  if (lr <= 0.2) return "cambio moderado: ayuda a descartar";
  if (lr <= 0.5) return "cambio pequeño";
  return "apenas cambia la probabilidad";
}
