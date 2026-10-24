// Geometría de la medición libre: ángulos 2D (pantalla) y 3D proyectados en un plano anatómico,
// filtro One Euro contra el temblor de los puntos y resumen de la medición. Funciones puras.
import { jointPoint } from "./joints";
import type { AnatomicalPlane, FramePose, KeyframeData, Landmark3D } from "./types";

export type V2 = { x: number; y: number };
export type V3 = [number, number, number];
const DEG = 180 / Math.PI;

const sub3 = (a: Landmark3D, b: Landmark3D): V3 => [a.x - b.x, a.y - b.y, a.z - b.z];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3) => Math.sqrt(dot(a, a));
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const minus = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a: V3): V3 | null => {
  const n = norm(a);
  return n > 1e-9 ? scale(a, 1 / n) : null;
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** θ = atan2(v) − atan2(u), llevado a [0°, 180°]. */
export function angle2D(u: V2, v: V2): number {
  let d = (Math.atan2(v.y, v.x) - Math.atan2(u.y, u.x)) * DEG;
  d = ((((d + 180) % 360) + 360) % 360) - 180; // (−180, 180]
  return Math.abs(d);
}

/** Ángulo entre dos vectores 3D: cos θ = u·v / (|u||v|). */
export function angle3D(u: V3, v: V3): number | null {
  const nu = norm(u);
  const nv = norm(v);
  if (nu < 1e-9 || nv < 1e-9) return null;
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (nu * nv)))) * DEG;
}

/** Proyección de v sobre el plano de normal n (unitaria). */
export function projectOnPlane(v: V3, n: V3): V3 {
  return minus(v, scale(n, dot(v, n)));
}

export type BodyFrame = { up: V3; ml: V3; ap: V3 };

/**
 * Ejes del cuerpo a partir de los puntos 3D: vertical (pelvis → hombros), mediolateral (cadera
 * izquierda → derecha, perpendicular a la vertical) y anteroposterior (perpendicular a ambos).
 * Hace de matriz de cambio: así el plano no depende de desde dónde se grabó.
 */
export function bodyFrame(world: Landmark3D[]): BodyFrame | null {
  const ls = world[11];
  const rs = world[12];
  const lh = world[23];
  const rh = world[24];
  if (!ls || !rs || !lh || !rh) return null;
  const mid = (a: Landmark3D, b: Landmark3D): Landmark3D => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
  const up = unit(sub3(mid(ls, rs), mid(lh, rh)));
  if (!up) return null;
  const mlRaw = sub3(rh, lh);
  const ml = unit(projectOnPlane(mlRaw, up));
  if (!ml) return null;
  return { up, ml, ap: cross(up, ml) };
}

/** Normal del plano anatómico: sagital ⟂ mediolateral, frontal ⟂ anteroposterior, transversal ⟂ vertical. */
export function planeNormal(frame: BodyFrame, plane: AnatomicalPlane): V3 {
  return plane === "sagittal" ? frame.ml : plane === "frontal" ? frame.ap : frame.up;
}

export type MeasureConfig = {
  plane: AnatomicalPlane | "screen";
  reference: { type: "plumb_line" } | { type: "axial_body"; start: string; end: string };
  movement: { start: string; end: string };
};

/** Por debajo de esta visibilidad, el fotograma no se mide (punto tapado o fuera de cuadro). */
const MIN_VISIBILITY = 0.3;

/**
 * Ángulo de un fotograma. En "screen", en la imagen (píxeles, plomada = vertical de la pantalla).
 * En un plano anatómico, con los puntos 3D proyectados en ese plano del cuerpo; la plomada es la
 * vertical de la cámara, también proyectada.
 */
export function measureFrame(pose: FramePose, cfg: MeasureConfig, size: { w: number; h: number }): number | null {
  const used = [cfg.movement.start, cfg.movement.end, ...(cfg.reference.type === "axial_body" ? [cfg.reference.start, cfg.reference.end] : [])];
  if (used.some((id) => (jointPoint(pose.image, id)?.visibility ?? 1) < MIN_VISIBILITY)) return null;

  if (cfg.plane === "screen") {
    const px = (id: string): V2 | null => {
      const p = jointPoint(pose.image, id);
      return p ? { x: p.x * size.w, y: p.y * size.h } : null;
    };
    const a = px(cfg.movement.start);
    const b = px(cfg.movement.end);
    if (!a || !b) return null;
    let u: V2 = { x: 0, y: -1 };
    if (cfg.reference.type === "axial_body") {
      const s = px(cfg.reference.start);
      const e = px(cfg.reference.end);
      if (!s || !e) return null;
      u = { x: e.x - s.x, y: e.y - s.y };
    }
    return angle2D(u, { x: b.x - a.x, y: b.y - a.y });
  }

  const frame = bodyFrame(pose.world);
  if (!frame) return null;
  const n = planeNormal(frame, cfg.plane);
  const w = (id: string) => jointPoint(pose.world, id);
  const a = w(cfg.movement.start);
  const b = w(cfg.movement.end);
  if (!a || !b) return null;
  let u: V3 = [0, -1, 0]; // Arriba en la cámara (en los puntos 3D, y crece hacia abajo).
  if (cfg.reference.type === "axial_body") {
    const s = w(cfg.reference.start);
    const e = w(cfg.reference.end);
    if (!s || !e) return null;
    u = sub3(e, s);
  }
  return angle3D(projectOnPlane(u, n), projectOnPlane(sub3(b, a), n));
}

/** Resumen: ángulo inicial (primer fotograma), máximo y amplitud Δθ = máx |θ − θinicial|. */
export function summarizeKeyframes(keyframes: KeyframeData[]): { initial: number; max: number; delta: number } | null {
  if (keyframes.length === 0) return null;
  const initial = keyframes[0]!.angleDegrees;
  let max = initial;
  let delta = 0;
  for (const k of keyframes) {
    max = Math.max(max, k.angleDegrees);
    delta = Math.max(delta, Math.abs(k.angleDegrees - initial));
  }
  return { initial, max, delta };
}

// ---------- Filtro One Euro (Casiez, Roussel y Vogel, 2012) ----------

class LowPass {
  private y: number | null = null;
  filter(x: number, alpha: number) {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }
  last() {
    return this.y;
  }
}

const alphaFor = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

/**
 * Suaviza una señal con frecuencia de corte adaptativa: mucho cuando el punto está casi quieto
 * (quita el temblor) y poco cuando se mueve deprisa (no añade retraso).
 */
export class OneEuroFilter {
  private x = new LowPass();
  private dx = new LowPass();
  private lastT: number | null = null;
  constructor(
    private minCutoff = 1.0,
    private beta = 0.02,
    private dCutoff = 1.0,
  ) {}
  filter(value: number, t: number): number {
    const prevT = this.lastT;
    this.lastT = t;
    if (prevT === null || t <= prevT) return this.x.filter(value, 1);
    const dt = t - prevT;
    const prev = this.x.last()!;
    const edx = this.dx.filter((value - prev) / dt, alphaFor(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, alphaFor(cutoff, dt));
  }
}

/** Aplica el filtro a cada coordenada de cada punto a lo largo de los fotogramas (en orden). */
export function smoothPoses(poses: FramePose[], minCutoff = 1.0, beta = 0.02): FramePose[] {
  const filters = new Map<string, OneEuroFilter>();
  const f = (key: string, value: number, t: number) => {
    let flt = filters.get(key);
    if (!flt) filters.set(key, (flt = new OneEuroFilter(minCutoff, beta)));
    return flt.filter(value, t);
  };
  return [...poses]
    .sort((a, b) => a.frame - b.frame)
    .map((p) => ({
      ...p,
      image: p.image.map((l, i) => ({ ...l, x: f(`i${i}x`, l.x, p.timeS), y: f(`i${i}y`, l.y, p.timeS), z: f(`i${i}z`, l.z, p.timeS) })),
      world: p.world.map((l, i) => ({ ...l, x: f(`w${i}x`, l.x, p.timeS), y: f(`w${i}y`, l.y, p.timeS), z: f(`w${i}z`, l.z, p.timeS) })),
    }));
}
