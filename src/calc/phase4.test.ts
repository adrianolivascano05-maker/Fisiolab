import { describe, expect, it } from "vitest";
import { codDeficit, getCodTest, turnAsymmetry } from "./cod";
import { summarizeRunning } from "./running";

describe("cambio de dirección", () => {
  it("déficit y asimetría entre giros", () => {
    expect(codDeficit(2.45, 1.85)).toBeCloseTo(0.6, 10);
    const a = turnAsymmetry(2.5, 2.4);
    expect(a.pct).toBeCloseTo(4.1667, 3);
    expect(a.slower).toBe("left");
    expect(turnAsymmetry(2.4, 2.4).slower).toBe("equal");
    expect(() => turnAsymmetry(0, 2)).toThrow(RangeError);
    expect(getCodTest("cod_505")?.sided).toBe(true);
    expect(getCodTest("cod_illinois")?.sided).toBe(false);
  });
});

describe("carrera", () => {
  it("contacto, vuelo, frecuencia, factor de apoyo y asimetría", () => {
    // Pasos de 0,35 s: contactos 0,20 (izq.) y 0,22 (dcha.) alternos.
    const contacts = [0, 0.35, 0.7, 1.05, 1.4];
    const takeoffs = [0.2, 0.57, 0.9, 1.27, 1.6];
    const r = summarizeRunning(contacts, takeoffs, "left", 12);
    expect(r.steps.map((s) => s.side)).toEqual(["left", "right", "left", "right", "left"]);
    expect(r.contactS).toBeCloseTo((0.2 * 3 + 0.22 * 2) / 5, 10);
    expect(r.flightS).toBeCloseTo((0.15 + 0.13 + 0.15 + 0.13) / 4, 10);
    expect(r.frequencySpm).toBeCloseTo(60 / 0.35, 6);
    expect(r.dutyFactor).toBeCloseTo(r.contactS / 0.7, 10);
    expect(r.stepLengthM).toBeCloseTo((12 / 3.6) * 0.35, 10);
    expect(r.left).toBeCloseTo(0.2, 10);
    expect(r.right).toBeCloseTo(0.22, 10);
    expect(r.asymmetryPct).toBeCloseTo((0.02 / 0.22) * 100, 6);
    expect(summarizeRunning(contacts, takeoffs, "right").stepLengthM).toBeNull();
  });

  it("valida el marcado", () => {
    expect(() => summarizeRunning([0, 0.35, 0.7], [0.2, 0.57, 0.9], "left")).toThrow(/al menos 4/);
    expect(() => summarizeRunning([0, 0.35, 0.7, 1.05], [0.2, 0.3, 0.9, 1.27], "left")).toThrow(/despegue/);
  });
});
