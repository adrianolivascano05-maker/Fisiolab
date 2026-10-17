import { describe, expect, it } from "vitest";
import { detectReps, type BarSample } from "./barDetect";
import { detectJump, jumpSample, refineFrames, type JumpSample } from "./jumpDetect";
import type { Landmark3D } from "./types";

const FPS = 240;
const LEG = 0.25; // pierna de 0,9 m que ocupa un cuarto de la imagen
const K = LEG / 0.9; // metros → unidades de imagen
const GROUND = 0.9;
const G = 9.81;

/** Pies a `hM` metros del suelo, con el temblor de un modelo de pose (±1 px a 960 px). */
const at = (frame: number, hM: number, hip = 0.6): JumpSample => ({ frame, foot: GROUND - hM * K + ((frame * 7919) % 3 - 1) * 0.001, hip, leg: LEG });

/** Altura en un vuelo de `T` s que empezó en `t0`. */
const flight = (t: number, T: number) => Math.max(0, (G * T) / 2 * t - (G / 2) * t * t);

/** CMJ: quieto, baja la cadera desde el 60, despega en 200, vuela 0,5 s (120 fotogramas) y aterriza en 320. */
function cmj(): JumpSample[] {
  return Array.from({ length: 480 }, (_, f) => {
    const hip = f < 60 ? 0.6 : f < 140 ? 0.6 + ((f - 60) / 80) * 0.06 : f < 200 ? 0.66 - ((f - 140) / 60) * 0.08 : 0.58;
    return at(f, f >= 200 && f < 320 ? flight((f - 200) / FPS, 0.5) : 0, hip);
  });
}

const near = (got: number[], want: number[], tol = 2) => {
  expect(got.length).toBe(want.length);
  got.forEach((g, i) => expect(Math.abs(g - want[i]!), `marca ${i}: ${g} frente a ${want[i]}`).toBeLessThanOrEqual(tol));
};

describe("despegue y aterrizaje", () => {
  it("CMJ: inicio del movimiento, despegue y aterrizaje", () => {
    const d = detectJump("cmj", cmj(), FPS);
    if (!("marks" in d)) throw new Error(d.error);
    expect(d.marks.map((m) => m.event)).toEqual(["movement_start", "takeoff", "landing"]);
    near(d.marks.map((m) => m.frame), [60, 200, 320]);
  });

  it("muestreado a saltos y afinado después alrededor de cada marca", () => {
    const full = cmj();
    const coarse = full.filter((s) => s.frame % 8 === 0);
    const first = detectJump("sj", coarse, FPS);
    if (!("marks" in first)) throw new Error(first.error);
    const extra = refineFrames(first.marks, new Set(coarse.map((s) => s.frame)), 8, 479);
    const d = detectJump("sj", [...coarse, ...full.filter((s) => extra.includes(s.frame))], FPS);
    if (!("marks" in d)) throw new Error(d.error);
    near(d.marks.map((m) => m.frame), [200, 320]);
  });

  it("caída desde 30 cm: contacto, despegue y aterrizaje", () => {
    const drop = Math.sqrt((2 * 0.3) / G) * FPS; // ≈ 59 fotogramas cayendo
    const samples = Array.from({ length: 400 }, (_, f) => {
      if (f < 40) return at(f, 0.3); // en el cajón
      if (f < 40 + drop) return at(f, 0.3 - (G / 2) * ((f - 40) / FPS) ** 2);
      if (f < 150) return at(f, 0); // contacto
      if (f < 250) return at(f, flight((f - 150) / FPS, 100 / FPS));
      return at(f, 0);
    });
    const d = detectJump("dj", samples, FPS);
    if (!("marks" in d)) throw new Error(d.error);
    expect(d.marks.map((m) => m.event)).toEqual(["contact", "takeoff", "landing"]);
    near(d.marks.map((m) => m.frame), [Math.ceil(40 + drop), 150, 250]);
  });

  it("saltos repetidos: una pareja de marcas por salto", () => {
    const samples = Array.from({ length: 900 }, (_, f) => {
      const k = f % 150;
      return at(f, f >= 30 && k >= 30 && k < 110 ? flight((k - 30) / FPS, 80 / FPS) : 0);
    });
    const d = detectJump("rj_10_5", samples, FPS);
    if (!("marks" in d)) throw new Error(d.error);
    near(d.marks.filter((m) => m.event === "takeoff").map((m) => m.frame), [30, 180, 330, 480, 630, 780]);
    near(d.marks.filter((m) => m.event === "landing").map((m) => m.frame), [110, 260, 410, 560, 710, 860]);
    expect(d.marks.filter((m) => m.event === "landing").map((m) => m.seriesIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("sin persona o sin salto: lo dice", () => {
    expect(detectJump("cmj", Array.from({ length: 50 }, (_, f) => ({ frame: f, foot: null, hip: null, leg: null })), FPS)).toHaveProperty("error");
    expect(detectJump("cmj", Array.from({ length: 50 }, (_, f) => at(f, 0)), FPS)).toHaveProperty("error");
  });

  it("de la pose: el punto más bajo de los pies visibles", () => {
    const pts: Landmark3D[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 }));
    pts[31] = { x: 0.5, y: 0.92, z: 0, visibility: 1 };
    pts[32] = { x: 0.5, y: 0.97, z: 0, visibility: 0.2 }; // tapado: no cuenta
    pts[27] = { x: 0.5, y: 0.8, z: 0, visibility: 1 };
    pts[23] = { x: 0.5, y: 0.55, z: 0, visibility: 1 };
    const s = jumpSample(3, pts);
    expect(s.foot).toBe(0.92);
    expect(s.hip).toBe(0.55);
    expect(s.leg).toBeCloseTo(0.25, 6);
  });
});

describe("repeticiones de fuerza", () => {
  it("sentadilla: empieza arriba y marca cada subida", () => {
    // 3 repeticiones de 2 s a 60 fps: baja 0,8 s, abajo 0,2 s, sube 0,6 s, arriba 0,4 s.
    const samples: BarSample[] = [];
    for (let f = 0; f < 60 * 7; f++) {
      const t = (f / 60) % 2;
      let y = 0.3;
      if (f < 360) {
        if (t < 0.8) y = 0.3 + 0.25 * (t / 0.8);
        else if (t < 1.0) y = 0.55;
        else if (t < 1.6) y = 0.55 - 0.25 * ((t - 1.0) / 0.6);
      }
      samples.push({ frame: f, y: y + (f % 2 ? 0.001 : -0.001) });
    }
    const d = detectReps(samples);
    if (!("marks" in d)) throw new Error(d.error);
    // Sube del fotograma 60 al 96 en cada repetición (cada 120).
    near(d.marks.filter((m) => m.event === "bar_start").map((m) => m.frame), [61, 181, 301]);
    near(d.marks.filter((m) => m.event === "bar_end").map((m) => m.frame), [95, 215, 335]);
  });

  it("sin movimiento: lo dice", () => {
    expect(detectReps(Array.from({ length: 40 }, (_, f) => ({ frame: f, y: 0.4 })))).toHaveProperty("error");
  });
});
