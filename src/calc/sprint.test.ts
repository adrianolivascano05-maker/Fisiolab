import { describe, expect, it } from "vitest";
import { modelDistance, parseGates, segments, sprintProfile, validSplits } from "./sprint";

/** Tiempo para llegar a x metros con el modelo (bisección). */
function timeAt(vmax: number, tau: number, x: number) {
  let lo = 0;
  let hi = 30;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (modelDistance(vmax, tau, mid) < x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

describe("sprint", () => {
  it("recupera vmax y τ de tiempos exactos del modelo", () => {
    const splits = [5, 10, 20, 30].map((d) => ({ distanceM: d, timeS: timeAt(9, 1.2, d) }));
    const p = sprintProfile(splits);
    expect(p.vmax).toBeCloseTo(9, 3);
    expect(p.tau).toBeCloseTo(1.2, 3);
    expect(p.f0).toBeCloseTo(7.5, 2);
    expect(p.pmax).toBeCloseTo(16.875, 2);
    expect(p.slope).toBeCloseTo(-7.5 / 9, 3);
    expect(p.r2).toBeCloseTo(1, 6);
  });

  it("tramos con su velocidad media", () => {
    const s = segments([{ distanceM: 10, timeS: 1.9 }, { distanceM: 20, timeS: 3.1 }]);
    expect(s[0]).toMatchObject({ fromM: 0, toM: 10, timeS: 1.9 });
    expect(s[1]!.timeS).toBeCloseTo(1.2, 10);
    expect(s[1]!.velocity).toBeCloseTo(10 / 1.2, 10);
  });

  it("valida pasos y distancias", () => {
    expect(validSplits([{ distanceM: 10, timeS: 2 }, { distanceM: 20, timeS: 1.5 }])).toBe(false);
    expect(validSplits([{ distanceM: 10, timeS: 2 }, { distanceM: 20, timeS: 3.2 }])).toBe(true);
    expect(() => sprintProfile([{ distanceM: 10, timeS: 2 }, { distanceM: 20, timeS: 3.2 }])).toThrow(/3 tiempos/);
    expect(parseGates("5, 10, 20, 30")).toEqual([5, 10, 20, 30]);
    expect(parseGates("5 10 20")).toEqual([5, 10, 20]);
    expect(parseGates("2,5, 5, 10")).toEqual([2.5, 5, 10]);
    expect(parseGates("10, 5")).toBeNull();
    expect(parseGates("")).toBeNull();
    expect(parseGates("0, 10")).toBeNull();
  });
});
