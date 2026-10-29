import { describe, expect, it } from "vitest";
import { likelihoodRatios } from "./evidence";

describe("evidencia", () => {
  it("razones de verosimilitud a partir de sensibilidad y especificidad", () => {
    const lr = likelihoodRatios({ sens: 85, spec: 94, source: "", citation: "" });
    expect(lr.pos).toBeCloseTo(14.17, 2);
    expect(lr.neg).toBeCloseTo(0.16, 2);
    expect(likelihoodRatios({ lrPos: 3.2, source: "", citation: "" })).toEqual({ pos: 3.2, neg: null });
    expect(likelihoodRatios({ sens: 50, spec: 100, source: "", citation: "" }).pos).toBeNull();
  });
});
