import { describe, expect, it } from "vitest";
import { angle2D, angle3D, bodyFrame, measureFrame, OneEuroFilter, projectOnPlane, smoothPoses, summarizeKeyframes, type MeasureConfig } from "./geometry";
import type { FramePose, Landmark3D } from "./types";

const close = (a: number | null, b: number, d = 6) => expect(a).toBeCloseTo(b, d);

/** Persona de pie mirando a la cámara (puntos 3D: x derecha de la imagen, y abajo, z hacia la cámara). */
function standing(armDeg: number, rotateYDeg = 0): Landmark3D[] {
  const pts: Landmark3D[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  const set = (i: number, x: number, y: number, z = 0) => (pts[i] = { x, y, z, visibility: 1 });
  // Su derecha queda a la izquierda de la imagen (x negativa).
  set(11, 0.2, -0.5);
  set(12, -0.2, -0.5);
  set(23, 0.1, 0);
  set(24, -0.1, 0);
  set(7, 0.08, -0.7);
  set(8, -0.08, -0.7);
  // Brazo derecho de 0,3 m abducido armDeg desde el costado.
  const r = (armDeg * Math.PI) / 180;
  set(14, -0.2 - 0.3 * Math.sin(r), -0.5 + 0.3 * Math.cos(r));
  // Giro de todo el cuerpo alrededor de la vertical (grabación en diagonal).
  if (rotateYDeg) {
    const a = (rotateYDeg * Math.PI) / 180;
    for (const p of pts) {
      const { x, z } = p;
      p.x = x * Math.cos(a) + z * Math.sin(a);
      p.z = -x * Math.sin(a) + z * Math.cos(a);
    }
  }
  return pts;
}

const pose = (world: Landmark3D[], frame = 0): FramePose => ({
  frame,
  timeS: frame / 30,
  world,
  image: world.map((p) => ({ x: 0.5 + p.x, y: 0.5 + p.y, z: p.z, visibility: p.visibility })),
});

const abduction: MeasureConfig = {
  plane: "frontal",
  reference: { type: "axial_body", start: "mid_shoulder", end: "mid_hip" },
  movement: { start: "r_shoulder", end: "r_elbow" },
};

describe("ángulos", () => {
  it("2D con atan2, normalizado a 0-180", () => {
    close(angle2D({ x: 0, y: -1 }, { x: 1, y: 0 }), 90);
    close(angle2D({ x: 0, y: -1 }, { x: 0, y: 1 }), 180);
    close(angle2D({ x: 1, y: 0 }, { x: 1, y: -1 }), 45);
    close(angle2D({ x: 1, y: 0 }, { x: 1, y: 1 }), 45);
  });

  it("3D con el producto escalar y proyección sobre un plano", () => {
    close(angle3D([1, 0, 0], [0, 1, 0]), 90);
    expect(angle3D([0, 0, 0], [1, 0, 0])).toBeNull();
    expect(projectOnPlane([1, 2, 3], [0, 0, 1])).toEqual([1, 2, 0]);
  });

  it("ejes del cuerpo", () => {
    const f = bodyFrame(standing(0))!;
    expect(f.up.map((v) => Number(v.toFixed(6)))).toEqual([0, -1, 0]);
    expect(f.ml.map((v) => Number(v.toFixed(6)))).toEqual([-1, 0, 0]);
    expect(Math.abs(f.ap[2])).toBeCloseTo(1, 6);
  });
});

describe("medición de un fotograma", () => {
  it("abducción de hombro de frente: plano frontal y pantalla coinciden", () => {
    for (const deg of [0, 45, 90, 150]) {
      close(measureFrame(pose(standing(deg)), abduction, { w: 1, h: 1 }), deg, 4);
      close(measureFrame(pose(standing(deg)), { ...abduction, plane: "screen" }, { w: 1, h: 1 }), deg, 4);
    }
  });

  it("grabado en diagonal: el plano frontal compensa el acortamiento y la pantalla no", () => {
    // 45° de abducción girado 50°: en la imagen el brazo se acorta y parece 32,7°.
    const p = pose(standing(45, 50));
    close(measureFrame(p, abduction, { w: 1, h: 1 }), 45, 4);
    close(measureFrame(p, { ...abduction, plane: "screen" }, { w: 1, h: 1 }), (Math.atan(Math.cos((50 * Math.PI) / 180)) * 180) / Math.PI, 4);
  });

  it("plomada y visibilidad", () => {
    const cfg: MeasureConfig = { plane: "screen", reference: { type: "plumb_line" }, movement: { start: "r_shoulder", end: "r_elbow" } };
    close(measureFrame(pose(standing(90)), cfg, { w: 1, h: 1 }), 90, 4);
    const hidden = pose(standing(90));
    hidden.image[14] = { ...hidden.image[14]!, visibility: 0.1 };
    expect(measureFrame(hidden, cfg, { w: 1, h: 1 })).toBeNull();
  });
});

describe("resumen y filtro", () => {
  it("ángulo inicial, máximo y Δθ", () => {
    const k = (a: number, i: number) => ({ frameNumber: i, timestampSeconds: i / 30, angleDegrees: a });
    expect(summarizeKeyframes([k(10, 0), k(40, 1), k(95, 2), k(60, 3)])).toEqual({ initial: 10, max: 95, delta: 85 });
    expect(summarizeKeyframes([])).toBeNull();
  });

  it("One Euro: quita el temblor de un punto quieto y sigue un movimiento rápido", () => {
    const f = new OneEuroFilter(1, 0.02);
    const noisy = Array.from({ length: 60 }, (_, i) => 0.5 + (i % 2 ? 0.01 : -0.01));
    const out = noisy.map((v, i) => f.filter(v, i / 30));
    const spread = Math.max(...out.slice(30)) - Math.min(...out.slice(30));
    expect(spread).toBeLessThan(0.006);
    const g = new OneEuroFilter(1, 50);
    let last = 0;
    for (let i = 0; i < 30; i++) last = g.filter(i < 10 ? 0 : 1, i / 30);
    expect(last).toBeGreaterThan(0.95);
  });

  it("suaviza todos los puntos en orden de fotograma", () => {
    const poses = [2, 0, 1].map((f) => pose(standing(f * 10), f));
    const s = smoothPoses(poses);
    expect(s.map((p) => p.frame)).toEqual([0, 1, 2]);
    expect(s[0]!.world[14]).toEqual(poses[1]!.world[14]);
  });
});
