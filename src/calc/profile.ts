// Perfil fuerza-velocidad en salto (Samozino et al., 2008, 2012, 2014).
// Cada salto con una carga distinta da un punto (v̄, F̄) del empuje; la recta que los une es el perfil.

export type Point = { velocity: number; force: number };

export function linearRegression(points: Point[]): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  if (n < 2) throw new RangeError("Hacen falta al menos dos puntos");
  const mx = points.reduce((a, p) => a + p.velocity, 0) / n;
  const my = points.reduce((a, p) => a + p.force, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    sxx += (p.velocity - mx) ** 2;
    sxy += (p.velocity - mx) * (p.force - my);
    syy += (p.force - my) ** 2;
  }
  if (sxx === 0) throw new RangeError("Todos los saltos tienen la misma velocidad: hacen falta cargas distintas");
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy) };
}

const G = 9.81;

/**
 * Altura alcanzable con un perfil (F0, pendiente S, ambos por kg de masa corporal) y una distancia de empuje,
 * con el modelo macroscópico de Samozino: F̄ = F0 + S·v̄, F̄ = g·(h/hpo + 1), h = 2·v̄²/g.
 */
export function heightFromProfile(f0: number, slope: number, pushOffM: number): number {
  const a = 2 / pushOffM;
  const b = -slope;
  const c = G - f0;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 0;
  const v = (-b + Math.sqrt(disc)) / (2 * a);
  return Math.max(0, (2 * v * v) / G);
}

/**
 * Pendiente óptima: la que, con la misma potencia máxima (Pmax = F0·V0/4 = −F0²/(4·S)), da el salto más alto.
 * Se busca numéricamente con el mismo modelo en vez de usar la fórmula cerrada del artículo.
 */
export function optimalSlope(pmaxWkg: number, pushOffM: number): number {
  const h = (s: number) => heightFromProfile(Math.sqrt(-4 * s * pmaxWkg), s, pushOffM);
  let lo = -300;
  let hi = -0.1;
  for (let i = 0; i < 200; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (h(m1) < h(m2)) lo = m1;
    else hi = m2;
  }
  return (lo + hi) / 2;
}

export type FvProfile = {
  f0: number; // N/kg
  v0: number; // m/s
  pmax: number; // W/kg
  slope: number; // N·s/m/kg
  r2: number;
  optimalSlope: number | null;
  /** SFv / SFvopt en %: <100 déficit de fuerza, >100 déficit de velocidad. */
  ratioPct: number | null;
  /** Desequilibrio: |1 − SFv/SFvopt| en %. */
  imbalancePct: number | null;
  orientation: "force_deficit" | "velocity_deficit" | "balanced" | null;
};

/** Perfil a partir de los saltos; `pushOffM` permite calcular el perfil óptimo y el desequilibrio. */
export function fvProfile(points: Point[], pushOffM: number | null): FvProfile {
  const { slope, intercept, r2 } = linearRegression(points);
  if (slope >= 0) throw new RangeError("La fuerza no baja al subir la velocidad: revisa los saltos y las cargas");
  const f0 = intercept;
  const v0 = -f0 / slope;
  const pmax = (f0 * v0) / 4;
  const opt = pushOffM ? optimalSlope(pmax, pushOffM) : null;
  const ratio = opt ? slope / opt : null;
  const imbalance = ratio === null ? null : Math.abs(1 - ratio) * 100;
  return {
    f0,
    v0,
    pmax,
    slope,
    r2,
    optimalSlope: opt,
    ratioPct: ratio === null ? null : ratio * 100,
    imbalancePct: imbalance,
    orientation: imbalance === null ? null : imbalance < 10 ? "balanced" : ratio! < 1 ? "force_deficit" : "velocity_deficit",
  };
}
