import { describe, expect, it } from "vitest";
import { agreement, t95, verdict } from "./agreement";

describe("concordancia", () => {
  it("Bland-Altman, ICC y error típico con un caso calculado a mano", () => {
    // Diferencias a − b: 1, 2, 0, 1, 1 → sesgo 1; DT = √(2/4) = 0,7071.
    const pairs = [
      { a: 31, b: 30 },
      { a: 27, b: 25 },
      { a: 40, b: 40 },
      { a: 36, b: 35 },
      { a: 22, b: 21 },
    ];
    const ag = agreement(pairs)!;
    expect(ag.n).toBe(5);
    expect(ag.bias).toBeCloseTo(1, 10);
    expect(ag.sdDiff).toBeCloseTo(Math.SQRT1_2, 10);
    expect(ag.loa[0]).toBeCloseTo(1 - 1.96 * Math.SQRT1_2, 10);
    expect(ag.loa[1]).toBeCloseTo(1 + 1.96 * Math.SQRT1_2, 10);
    expect(ag.biasCi[1] - ag.bias).toBeCloseTo(2.776 * (Math.SQRT1_2 / Math.sqrt(5)), 10);
    expect(ag.sem).toBeCloseTo(0.5, 10);
    expect(ag.mdc95).toBeCloseTo(1.96 * Math.SQRT2 * 0.5, 10);
    expect(ag.r!).toBeGreaterThan(0.99);
    // ICC(A,1) = (MSR − MSE) / (MSR + MSE + 2(MSC − MSE)/n), con MSR 108,15, MSC 2,5 y MSE 0,25: 107,9 / 109,3 = 0,9872.
    expect(ag.icc!).toBeCloseTo(0.9872, 3);
    expect(ag.fit!.slope).toBeGreaterThan(0.9);
  });

  it("acuerdo perfecto y casos límite", () => {
    const same = agreement([10, 20, 30].map((v) => ({ a: v, b: v })))!;
    expect(same.bias).toBe(0);
    expect(same.icc).toBe(1);
    expect(agreement([{ a: 1, b: 1 }])).toBeNull();
    expect(t95(4)).toBe(2.776);
    expect(t95(100)).toBeCloseTo(1.984, 3);
  });

  it("lectura en lenguaje claro", () => {
    const f = (v: number) => v.toFixed(1);
    const many = (bias: number, spread: number) =>
      agreement(Array.from({ length: 24 }, (_, i) => ({ a: 30 + i + bias + (i % 2 ? spread : -spread), b: 30 + i })))!;
    expect(verdict(many(0.2, 0.5), 2, f).title).toBe("Intercambiables");
    expect(verdict(many(2.5, 0.5), 2, f).title).toBe("Sesgo constante: se puede corregir");
    expect(verdict(many(0.2, 2), 2, f).title).toBe("Sin sesgo importante, pero mucha dispersión");
    expect(verdict(many(3, 3), 2, f).title).toBe("No son intercambiables");
    expect(verdict(agreement([{ a: 1, b: 1 }, { a: 2, b: 2.1 }])!, 2, f).text).toMatch(/orientativo/);
  });
});
