import { describe, expect, it } from "vitest";
import { asymmetry } from "./asymmetry";
import { dynamicReboundIndex, G, heightFromFlightTime, samozino, verticalStiffness } from "./jump";
import { fvProfile, heightFromProfile, linearRegression, optimalSlope } from "./profile";
import { computeRepeated } from "./repeated";

describe("rigidez vertical (Dalleau 2004)", () => {
  it("coincide con su derivación de la onda seno: Fmax / Δy", () => {
    const m = 70;
    const tc = 0.15;
    const tf = 0.35;
    const fmax = m * G * (Math.PI / 2) * (tf / tc + 1);
    const dy = (fmax * tc * tc) / (m * Math.PI * Math.PI) - (G * tc * tc) / 8;
    expect(verticalStiffness(m, tc, tf)).toBeCloseTo(fmax / dy, 6);
  });
  it("valores del orden publicado (decenas de kN/m)", () => {
    expect(verticalStiffness(70, 0.15, 0.35) / 1000).toBeCloseTo(40.2, 1);
  });
});

describe("DRI (Brooks)", () => {
  it("(0,30 + 0,30) / (9,81 · 0,2²) = 1,529", () => {
    expect(dynamicReboundIndex(0.3, 0.3, 0.2)).toBeCloseTo(1.529, 3);
  });
});

describe("10/5", () => {
  it("media de los 5 mejores RSI y el primer salto sin contacto", () => {
    // 7 saltos a 240 fps: vuelo 120 fotogramas (30,66 cm); contactos 40, 48, 60, 36, 50, 44 fotogramas.
    const contacts = [40, 48, 60, 36, 50, 44];
    const takeoffs = [100];
    const landings = [220];
    for (const c of contacts) {
      takeoffs.push(landings.at(-1)! + c);
      landings.push(takeoffs.at(-1)! + 120);
    }
    const out = computeRepeated(takeoffs, landings, 240);
    expect(out.jumps).toHaveLength(7);
    expect(out.jumps[0]!.contactS).toBeNull();
    const h = heightFromFlightTime(0.5);
    const best5 = [36, 40, 44, 48, 50].map((c) => h / (c / 240));
    expect(out.rsiBest5).toBeCloseTo(best5.reduce((a, b) => a + b) / 5, 6);
    expect(out.best5).not.toContain(4); // el contacto de 60 fotogramas (salto 4) queda fuera
    expect(out.warnings).toEqual([]);
  });
  it("con menos de 6 saltos no da resultado y lo dice", () => {
    const out = computeRepeated([0, 160], [120, 280], 240);
    expect(out.rsiBest5).toBeNull();
    expect(out.warnings[0]).toMatch(/al menos 6/);
  });
});

describe("perfil fuerza-velocidad", () => {
  it("regresión exacta en puntos alineados", () => {
    const r = linearRegression([
      { velocity: 1, force: 20 },
      { velocity: 2, force: 10 },
    ]);
    expect([r.slope, r.intercept, r.r2]).toEqual([-10, 30, 1]);
  });

  it("recupera F0, V0 y Pmax de saltos generados con el mismo modelo", () => {
    // Perfil «real» F0 = 32 N/kg, V0 = 3,2 m/s; saltos con 0, 20 y 40 kg de carga para 70 kg y hpo 0,4 m.
    const f0 = 32;
    const v0 = 3.2;
    const body = 70;
    const hpo = 0.4;
    const points = [0, 20, 40].map((load) => {
      // Con carga, la fuerza por kg de masa movida es F0·body/(body+load) y la pendiente igual escalada.
      const k = body / (body + load);
      const h = heightFromProfile(f0 * k, (-f0 / v0) * k, hpo);
      const s = samozino({ massKg: body + load, heightM: h, pushOffDistanceM: hpo });
      return { velocity: s.velocityMS, force: s.forceN / body };
    });
    const p = fvProfile(points, hpo);
    expect(p.f0).toBeCloseTo(f0, 3);
    expect(p.v0).toBeCloseTo(v0, 3);
    expect(p.pmax).toBeCloseTo((f0 * v0) / 4, 3);
    expect(p.r2).toBeCloseTo(1, 6);
  });

  it("el óptimo da el salto más alto con la misma potencia", () => {
    const pmax = 25;
    const hpo = 0.4;
    const s = optimalSlope(pmax, hpo);
    const h = (sl: number) => heightFromProfile(Math.sqrt(-4 * sl * pmax), sl, hpo);
    expect(s).toBeGreaterThan(-16);
    expect(s).toBeLessThan(-12);
    expect(h(s)).toBeGreaterThan(h(s - 3));
    expect(h(s)).toBeGreaterThan(h(s + 3));
  });

  it("orientación: pendiente menos inclinada que la óptima = déficit de fuerza", () => {
    const p = fvProfile(
      [
        { velocity: 1.0, force: 25 },
        { velocity: 1.6, force: 20 },
      ],
      0.4,
    );
    expect(p.ratioPct!).toBeLessThan(100);
    expect(p.orientation).toBe("force_deficit");
  });

  it("rechaza saltos con la misma velocidad", () => {
    expect(() => fvProfile([{ velocity: 1, force: 20 }, { velocity: 1, force: 21 }], 0.4)).toThrow(/cargas distintas/);
  });
});

describe("asimetría", () => {
  it("30 y 27 cm: 10 % menos la pierna izquierda", () => {
    expect(asymmetry(27, 30)).toEqual({ pct: 10, weaker: "left" });
  });
});
