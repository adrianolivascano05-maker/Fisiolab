import { describe, expect, it } from "vitest";
import { likelihoodRatios, lrMeaning, postTest } from "./evidence";

describe("evidencia", () => {
  it("razones de verosimilitud a partir de sensibilidad y especificidad", () => {
    const lr = likelihoodRatios({ sens: 85, spec: 94, source: "", citation: "" });
    expect(lr.pos).toBeCloseTo(14.17, 2);
    expect(lr.neg).toBeCloseTo(0.16, 2);
    expect(likelihoodRatios({ lrPos: 3.2, source: "", citation: "" })).toEqual({ pos: 3.2, neg: null });
    expect(likelihoodRatios({ sens: 50, spec: 100, source: "", citation: "" }).pos).toBeNull();
  });

  it("probabilidad tras el test", () => {
    expect(postTest(50, 1)).toBeCloseTo(50, 6);
    expect(postTest(30, 10)).toBeCloseTo(81.08, 2); // odds 0,4286 × 10 = 4,286
    expect(postTest(30, 0.1)).toBeCloseTo(4.11, 2);
  });

  it("lectura en lenguaje claro", () => {
    expect(lrMeaning(12, true)).toMatch(/casi confirma/);
    expect(lrMeaning(0.15, false)).toMatch(/ayuda a descartar/);
  });
});
