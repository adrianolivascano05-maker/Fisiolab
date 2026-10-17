import { describe, expect, it } from "vitest";
import { angleSeries, choosePreset, inPlaneFraction, movementWindow, spread, toConfig } from "./auto";
import { presets } from "./joints";
import type { FramePose, Landmark3D } from "./types";

/** De pie mirando a la cámara, con el brazo derecho en abducción o en flexión. */
function standing(deg: number, kind: "abd" | "flex"): Landmark3D[] {
  const pts: Landmark3D[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  const set = (i: number, x: number, y: number, z = 0) => (pts[i] = { x, y, z, visibility: 1 });
  set(11, 0.2, -0.5);
  set(12, -0.2, -0.5);
  set(23, 0.1, 0);
  set(24, -0.1, 0);
  set(7, 0.08, -0.7);
  set(8, -0.08, -0.7);
  const r = (deg * Math.PI) / 180;
  if (kind === "abd") set(14, -0.2 - 0.3 * Math.sin(r), -0.5 + 0.3 * Math.cos(r));
  else set(14, -0.2, -0.5 + 0.3 * Math.cos(r), 0.3 * Math.sin(r));
  return pts;
}

const pose = (world: Landmark3D[], frame: number): FramePose => ({
  frame,
  timeS: frame / 30,
  world,
  image: world.map((p) => ({ x: 0.5 + p.x, y: 0.5 + p.y, z: p.z, visibility: 1 })),
});

/** 10 fotogramas quieto, sube a `peak` en 20, baja en 20 y 10 quieto. */
function movement(kind: "abd" | "flex", peak = 90): FramePose[] {
  const deg = (f: number) => (f < 10 ? 0 : f < 30 ? ((f - 10) / 20) * peak : f < 50 ? ((50 - f) / 20) * peak : 0);
  return Array.from({ length: 60 }, (_, f) => pose(standing(deg(f), kind), f));
}

const size = { w: 1, h: 1 };
const preset = (id: string) => presets.find((p) => p.id === id)!;

describe("autocompletado", () => {
  it("reconoce una abducción y una flexión de hombro derecho", () => {
    expect(choosePreset(movement("abd"), size)?.preset.id).toBe("sh_abd_r");
    const flex = choosePreset(movement("flex"), size)!;
    expect(flex.preset.id).toBe("sh_flex_r");
    expect(flex.amplitude).toBeCloseTo(90, 4);
  });

  it("sin movimiento no elige nada", () => {
    expect(choosePreset(movement("abd", 3), size)).toBeNull();
  });

  it("descarta los fotogramas con el segmento fuera del plano", () => {
    const p = pose(standing(90, "abd"), 0);
    expect(inPlaneFraction(p, toConfig(preset("sh_abd_r")))).toBeCloseTo(1, 6);
    expect(inPlaneFraction(p, toConfig(preset("sh_flex_r")))).toBeCloseTo(0, 6);
    expect(angleSeries([p], toConfig(preset("sh_flex_r")), size)).toEqual([]);
  });

  it("encuentra inicio, pico y fin del movimiento", () => {
    const s = angleSeries(movement("abd"), toConfig(preset("sh_abd_r")), size);
    expect(movementWindow(s)).toEqual({ start: 12, peak: 30, end: 48 });
    expect(movementWindow(s.slice(0, 8))).toBeNull();
  });

  it("reparte fotogramas sin saltarse el último", () => {
    expect(spread(0, 10, 4)).toEqual([0, 3, 6, 9, 10]);
    expect(spread(5, 7, 100)).toEqual([5, 6, 7]);
  });
});
