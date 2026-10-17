// Concordancia entre dos formas de medir lo mismo (Cénit frente a una referencia, o dos marcaciones
// del mismo vídeo): Bland-Altman, correlación de Pearson, ICC(A,1), error típico y cambio mínimo
// detectable. Funciones puras.

/** a: Cénit (o la segunda marcación); b: la referencia (o la primera). */
export type Pair = { a: number; b: number };

export type Agreement = {
  n: number;
  meanA: number;
  meanB: number;
  /** Sesgo: media de a − b. */
  bias: number;
  /** Intervalo de confianza del 95 % del sesgo. */
  biasCi: [number, number];
  /** Desviación típica de las diferencias. */
  sdDiff: number;
  /** Límites de acuerdo del 95 %: sesgo ± 1,96 DT. */
  loa: [number, number];
  /** Sesgo en % de la media de la referencia. */
  biasPct: number;
  /** Correlación de Pearson (null si una de las dos no varía). */
  r: number | null;
  /** ICC de acuerdo absoluto, dos factores, una medida: ICC(A,1) (McGraw y Wong, 1996). */
  icc: number | null;
  /** Error típico de medida = DT de las diferencias / √2 (Hopkins, 2000). */
  sem: number;
  /** Error típico en % de la media (coeficiente de variación). */
  cvPct: number;
  /** Cambio mínimo detectable al 95 % = 1,96 · √2 · error típico. */
  mdc95: number;
  /** Recta para pasar de a a b: b ≈ intercept + slope · a. */
  fit: { slope: number; intercept: number } | null;
  /** Pendiente de la diferencia frente a la media: lejos de 0, el sesgo cambia con el tamaño. */
  proportional: number | null;
};

const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;

/** t de Student bilateral al 95 % (tabla hasta 30 grados de libertad; después, aproximación). */
export function t95(df: number): number {
  const table = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
  if (df < 1) return NaN;
  if (df <= 30) return table[df - 1]!;
  return 1.96 + 2.4 / df;
}

function slopeOf(x: number[], y: number[]) {
  const mx = mean(x);
  const my = mean(y);
  let sxx = 0;
  let sxy = 0;
  x.forEach((xi, i) => {
    sxx += (xi - mx) ** 2;
    sxy += (xi - mx) * (y[i]! - my);
  });
  return sxx > 0 ? { slope: sxy / sxx, intercept: my - (sxy / sxx) * mx } : null;
}

export function agreement(pairs: Pair[]): Agreement | null {
  const n = pairs.length;
  if (n < 2) return null;
  const a = pairs.map((p) => p.a);
  const b = pairs.map((p) => p.b);
  const d = pairs.map((p) => p.a - p.b);
  const meanA = mean(a);
  const meanB = mean(b);
  const bias = mean(d);
  const sdDiff = Math.sqrt(d.reduce((s, x) => s + (x - bias) ** 2, 0) / (n - 1));
  const half = t95(n - 1) * (sdDiff / Math.sqrt(n));

  const sa = Math.sqrt(a.reduce((s, x) => s + (x - meanA) ** 2, 0));
  const sb = Math.sqrt(b.reduce((s, x) => s + (x - meanB) ** 2, 0));
  const r = sa > 0 && sb > 0 ? a.reduce((s, x, i) => s + (x - meanA) * (b[i]! - meanB), 0) / (sa * sb) : null;

  // ICC(A,1) con k = 2 medidas por sujeto.
  const k = 2;
  const grand = (meanA + meanB) / 2;
  const ssRows = k * pairs.reduce((s, p) => s + ((p.a + p.b) / 2 - grand) ** 2, 0);
  const ssCols = n * ((meanA - grand) ** 2 + (meanB - grand) ** 2);
  const ssTotal = pairs.reduce((s, p) => s + (p.a - grand) ** 2 + (p.b - grand) ** 2, 0);
  const ssErr = Math.max(0, ssTotal - ssRows - ssCols);
  const msr = ssRows / (n - 1);
  const msc = ssCols / (k - 1);
  const mse = ssErr / ((n - 1) * (k - 1));
  const denom = msr + (k - 1) * mse + (k * (msc - mse)) / n;
  const icc = denom > 0 ? (msr - mse) / denom : null;

  const sem = sdDiff / Math.SQRT2;
  const means = pairs.map((p) => (p.a + p.b) / 2);
  return {
    n,
    meanA,
    meanB,
    bias,
    biasCi: [bias - half, bias + half],
    sdDiff,
    loa: [bias - 1.96 * sdDiff, bias + 1.96 * sdDiff],
    biasPct: meanB !== 0 ? (bias / meanB) * 100 : NaN,
    r,
    icc,
    sem,
    cvPct: grand !== 0 ? (sem / Math.abs(grand)) * 100 : NaN,
    mdc95: 1.96 * Math.SQRT2 * sem,
    fit: slopeOf(a, b),
    proportional: slopeOf(means, d)?.slope ?? null,
  };
}

export type Verdict = { tone: "success" | "warning" | "danger" | "info"; title: string; text: string };

/** Mínimo de pares para sacar conclusiones (lo habitual en estudios de validación es 20-30 o más). */
export const MIN_PAIRS = 20;

/**
 * Lectura en lenguaje claro frente a la diferencia que importa en la clínica (`delta`).
 * Intercambiables si los dos límites de acuerdo caen dentro de ±delta.
 */
export function verdict(ag: Agreement, delta: number, fmtv: (v: number) => string): Verdict {
  const few = ag.n < MIN_PAIRS ? ` Con ${ag.n} pares es orientativo: lo recomendable son ${MIN_PAIRS} o más.` : "";
  const [lo, hi] = ag.loa;
  if (lo >= -delta && hi <= delta) {
    return { tone: ag.n < MIN_PAIRS ? "info" : "success", title: "Intercambiables", text: `El 95 % de las diferencias cae entre ${fmtv(lo)} y ${fmtv(hi)}, dentro de ±${fmtv(delta)}.${few}` };
  }
  const width = hi - lo;
  if (Math.abs(ag.bias) > delta / 2 && width <= 2 * delta) {
    return {
      tone: "warning",
      title: "Sesgo constante: se puede corregir",
      text: `Cénit da de media ${fmtv(ag.bias)} respecto a la referencia, de forma bastante constante. Restando ese sesgo, el 95 % de las diferencias quedaría en ±${fmtv(width / 2)}.${few}`,
    };
  }
  if (Math.abs(ag.bias) <= delta / 2) {
    return {
      tone: "warning",
      title: "Sin sesgo importante, pero mucha dispersión",
      text: `De media coinciden (sesgo ${fmtv(ag.bias)}), pero una medida suelta puede diferir entre ${fmtv(lo)} y ${fmtv(hi)}. Revisa cómo se graba y se marca.${few}`,
    };
  }
  return { tone: "danger", title: "No son intercambiables", text: `Las diferencias van de ${fmtv(lo)} a ${fmtv(hi)}, más que ±${fmtv(delta)}.${few}` };
}
