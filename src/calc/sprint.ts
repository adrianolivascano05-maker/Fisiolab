// Sprint lineal (S15): tiempos de paso y perfil fuerza-velocidad del sprint.
// Funciones puras; las prueba sprint.test.ts.
//
// Modelo (Samozino et al., 2016, sin la resistencia del aire): la velocidad sube como
//   v(t) = vmax · (1 − e^(−t/τ))   →   x(t) = vmax · (t − τ · (1 − e^(−t/τ)))
// Con los tiempos de paso se ajustan vmax y τ por mínimos cuadrados. Después:
//   F0 = vmax / τ (N/kg, aceleración inicial), V0 = vmax (m/s), Pmax = F0 · V0 / 4 (W/kg).
// Sin el término del aire, F0 y V0 salen algo por debajo del método completo: sirve para
// seguir a un mismo paciente.

export type Split = { distanceM: number; timeS: number };

/** Distancia recorrida a los t segundos con el modelo. */
export function modelDistance(vmax: number, tau: number, t: number): number {
  return vmax * (t - tau * (1 - Math.exp(-t / tau)));
}

export type SprintProfile = { vmax: number; tau: number; f0: number; v0: number; pmax: number; slope: number; r2: number };

/** Ajusta el modelo a los pasos: búsqueda de τ con vmax óptimo en forma cerrada para cada τ. */
export function sprintProfile(splits: Split[]): SprintProfile {
  if (splits.length < 3) throw new RangeError("Hacen falta al menos 3 tiempos de paso");
  const g = (t: number, tau: number) => t - tau * (1 - Math.exp(-t / tau));
  const fit = (tau: number) => {
    const sxg = splits.reduce((s, p) => s + p.distanceM * g(p.timeS, tau), 0);
    const sgg = splits.reduce((s, p) => s + g(p.timeS, tau) ** 2, 0);
    const vmax = sxg / sgg;
    const sse = splits.reduce((s, p) => s + (p.distanceM - vmax * g(p.timeS, tau)) ** 2, 0);
    return { vmax, sse };
  };
  // Sección áurea sobre τ en [0,1; 5] s.
  let a = 0.1;
  let b = 5;
  const phi = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 200; i++) {
    const c = b - phi * (b - a);
    const d = a + phi * (b - a);
    if (fit(c).sse < fit(d).sse) b = d;
    else a = c;
  }
  const tau = (a + b) / 2;
  const { vmax, sse } = fit(tau);
  if (!(vmax > 0) || tau <= 0.11 || tau >= 4.9) throw new RangeError("Los tiempos no encajan con un sprint: revísalos");
  const mean = splits.reduce((s, p) => s + p.distanceM, 0) / splits.length;
  const sst = splits.reduce((s, p) => s + (p.distanceM - mean) ** 2, 0);
  const f0 = vmax / tau;
  return { vmax, tau, f0, v0: vmax, pmax: (f0 * vmax) / 4, slope: -f0 / vmax, r2: sst > 0 ? 1 - sse / sst : 1 };
}

export type Segment = { fromM: number; toM: number; timeS: number; velocity: number };

/** Tramos entre pasos consecutivos (el primero desde la salida). */
export function segments(splits: Split[]): Segment[] {
  const sorted = [...splits].sort((a, b) => a.distanceM - b.distanceM);
  return sorted.map((s, i) => {
    const prev = i === 0 ? { distanceM: 0, timeS: 0 } : sorted[i - 1]!;
    const timeS = s.timeS - prev.timeS;
    return { fromM: prev.distanceM, toM: s.distanceM, timeS, velocity: (s.distanceM - prev.distanceM) / timeS };
  });
}

/** Comprueba que distancias y tiempos crecen a la vez. */
export function validSplits(splits: Split[]): boolean {
  const sorted = [...splits].sort((a, b) => a.distanceM - b.distanceM);
  return sorted.every((s, i) => s.distanceM > 0 && s.timeS > 0 && (i === 0 || (s.distanceM > sorted[i - 1]!.distanceM && s.timeS > sorted[i - 1]!.timeS)));
}

/** Lee "5, 10, 20, 30" → [5, 10, 20, 30]; null si no es una lista válida y creciente (máx. 10 pasos, ≤ 100 m). */
export function parseGates(text: string): number[] | null {
  const parts = text.split(/[;\s]+|,(?=\s)|,(?=\d+\s*$)/).map((p) => p.trim()).filter(Boolean);
  const nums = parts.map((p) => Number(p.replace(",", ".")));
  if (nums.length === 0 || nums.length > 10 || nums.some((n) => !(n > 0 && n <= 100))) return null;
  return nums.every((n, i) => i === 0 || n > nums[i - 1]!) ? nums : null;
}

export const gatePresets = ["5, 10, 20, 30", "10, 20, 30", "5, 10, 20, 30, 40"];
