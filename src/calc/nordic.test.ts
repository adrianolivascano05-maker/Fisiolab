import { describe, expect, it } from "vitest";
import { ABOVE_KNEE_MASS, nordicPhoto, nordicTorque } from "./nordic";
import { photoAngle } from "./rom";

describe("nórdico", () => {
  it("masa por encima de las rodillas", () => {
    expect(ABOVE_KNEE_MASS).toBeCloseTo(0.878, 10);
  });

  it("momento en la rotura: 0 de pie, máximo tumbado y repartido entre las dos piernas", () => {
    // 80 kg, 180 cm, 60°: 0,878 · 80 · 9,81 · 0,322 · 1,8 · sen 60° = 345,9 N·m; 172,9 por pierna
    const t = nordicTorque(80, 180, 60);
    expect(t.totalNm).toBeCloseTo(345.87, 1);
    expect(t.perLegNm).toBeCloseTo(172.9, 1);
    expect(t.perLegNmKg).toBeCloseTo(2.162, 3);
    expect(nordicTorque(80, 180, 0).totalNm).toBe(0);
    expect(nordicTorque(80, 180, 90).totalNm).toBeCloseTo(345.87 / Math.sin(Math.PI / 3), 1);
    expect(() => nordicTorque(0, 180, 60)).toThrow(RangeError);
    expect(() => nordicTorque(80, 180, 95)).toThrow(RangeError);
  });

  it("ángulo sobre el fotograma: rodilla abajo, cadera arriba e inclinada", () => {
    const rad = (55 * Math.PI) / 180;
    expect(photoAngle(nordicPhoto, [{ x: 100, y: 400 }, { x: 100 + 200 * Math.sin(rad), y: 400 - 200 * Math.cos(rad) }])).toBeCloseTo(55, 10);
  });
});
