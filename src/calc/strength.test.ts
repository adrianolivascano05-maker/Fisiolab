import { describe, expect, it } from "vitest";
import { exercises, getExercise, loadVelocityProfile, meanVelocity, summarizeSet, velocityAtLoad } from "./strength";

describe("velocidad de la barra", () => {
  it("velocidad media = recorrido / tiempo de subida", () => {
    // 55 cm en 120 fotogramas a 240 fps = 0,5 s → 1,10 m/s
    expect(meanVelocity(0.55, 120 / 240)).toBeCloseTo(1.1, 10);
    expect(() => meanVelocity(0, 1)).toThrow(RangeError);
    expect(() => meanVelocity(0.5, 0)).toThrow(RangeError);
  });

  it("serie: la más rápida, la media y la pérdida de velocidad", () => {
    const s = summarizeSet([0.9, 1.0, 0.95, 0.8]);
    expect(s.best).toBe(1.0);
    expect(s.mean).toBeCloseTo(0.9125, 10);
    expect(s.velocityLossPct).toBeCloseTo(20, 10);
    expect(summarizeSet([0.7]).velocityLossPct).toBeNull();
    expect(() => summarizeSet([])).toThrow(RangeError);
  });
});

describe("perfil carga-velocidad", () => {
  it("recupera la recta y el 1RM de datos exactos", () => {
    // v = 1,45 − 0,011 · carga → 1RM a 0,30 m/s = 104,5 kg
    const pts = [40, 60, 80, 100].map((loadKg) => ({ loadKg, velocity: 1.45 - 0.011 * loadKg }));
    const p = loadVelocityProfile(pts, 0.3);
    expect(p.slope).toBeCloseTo(-0.011, 10);
    expect(p.intercept).toBeCloseTo(1.45, 10);
    expect(p.r2).toBeCloseTo(1, 10);
    expect(p.oneRmKg).toBeCloseTo(104.545, 2);
    expect(p.l0Kg).toBeCloseTo(131.818, 2);
    expect(velocityAtLoad(p, p.oneRmKg)).toBeCloseTo(0.3, 10);
  });

  it("rechaza perfiles sin sentido", () => {
    expect(() => loadVelocityProfile([{ loadKg: 60, velocity: 0.8 }, { loadKg: 60, velocity: 0.7 }], 0.3)).toThrow(/dos cargas/);
    expect(() => loadVelocityProfile([{ loadKg: 40, velocity: 0.7 }, { loadKg: 60, velocity: 0.8 }], 0.3)).toThrow(/no baja/);
    expect(() => loadVelocityProfile([{ loadKg: 40, velocity: 0.2 }, { loadKg: 60, velocity: 0.1 }], 0.3)).toThrow(/umbral/);
    expect(() => loadVelocityProfile([{ loadKg: 40, velocity: 1 }, { loadKg: 60, velocity: 0.8 }], 0)).toThrow(RangeError);
  });

  it("catálogo de ejercicios", () => {
    expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length);
    expect(getExercise("squat")?.mvt).toBe(0.3);
    expect(getExercise("bench_press")?.mvt).toBe(0.17);
    for (const e of exercises) expect(e.mvt).toBeGreaterThan(0);
  });
});
