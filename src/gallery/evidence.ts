// Cuentas de la evidencia publicada de un test: sus razones de verosimilitud (LR+ y LR−), para la tabla de la
// Biblioteca. La app no calcula la probabilidad de un paciente ni lee lo que significa su resultado.
import type { Accuracy } from "./types";

/** LR+ y LR− de una fila: las publicadas o, si no hay, calculadas con la sensibilidad y la especificidad. */
export function likelihoodRatios(a: Accuracy): { pos: number | null; neg: number | null } {
  const s = a.sens !== undefined ? a.sens / 100 : null;
  const e = a.spec !== undefined ? a.spec / 100 : null;
  const pos = a.lrPos ?? (s !== null && e !== null && e < 1 ? s / (1 - e) : null);
  const neg = a.lrNeg ?? (s !== null && e !== null && e > 0 ? (1 - s) / e : null);
  return { pos: pos !== null && Number.isFinite(pos) ? pos : null, neg: neg !== null && Number.isFinite(neg) ? neg : null };
}
