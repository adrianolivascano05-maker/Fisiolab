import { describe, expect, it } from "vitest";
import { compareToBaseline, lowItems, wellnessTotal } from "./wellness";

const day = { fatigue: 4, sleep: 2, soreness: 3, stress: 5, mood: 1 };

describe("bienestar", () => {
  it("total de 5 a 25 y respuestas bajas", () => {
    expect(wellnessTotal(day)).toBe(15);
    expect(wellnessTotal({ fatigue: 5, sleep: 5, soreness: 5, stress: 5, mood: 5 })).toBe(25);
    expect(lowItems(day)).toEqual(["sleep", "mood"]);
  });

  it("compara con la media del paciente", () => {
    expect(compareToBaseline(20, [20, 21])).toBeNull();
    const b = compareToBaseline(17, [20, 21, 19, 20])!;
    expect(b.mean).toBe(20);
    expect(b.sd).toBeCloseTo(Math.sqrt(2 / 3), 10);
    expect(b.diff).toBe(-3);
    expect(b.low).toBe(true);
    expect(compareToBaseline(20, [20, 21, 19, 20])!.low).toBe(false);
    // Sin variación previa: cualquier bajada cuenta.
    expect(compareToBaseline(19, [20, 20, 20])).toMatchObject({ z: null, low: true });
    expect(compareToBaseline(20, [20, 20, 20])).toMatchObject({ z: null, low: false });
  });
});
