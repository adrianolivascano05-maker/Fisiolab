// Esqueleto del maniquí 3D: medidas reales (adulto de 175 cm), ángulos de cada articulación a partir de
// la descripción de la figura y cinemática directa. Cada segmento es rígido y gira en su articulación,
// así que nada se estira ni se deforma al moverse. Solo usa la matemática de three (funciona en Node).
//
// Ejes del cuerpo: x hacia la izquierda del paciente, y hacia la cabeza, z hacia delante. En el mundo,
// y es la vertical y el suelo está en y = 0. Unidades: centímetros.
import { Matrix4, Quaternion, Vector3 } from "three";
import type { Anchor, Direction, FigureSpec, JointKey, Posture } from "../figure";

export type Side = "r" | "l";
/** +1 en el lado izquierdo (x positivo), −1 en el derecho. */
export const sgn = (s: Side) => (s === "l" ? 1 : -1);
export type LimbSeg = "upperarm" | "forearm" | "hand" | "thigh" | "shank" | "foot";
export type SegKey = `${Side}_${LimbSeg}`;
export const LIMBS: LimbSeg[] = ["upperarm", "forearm", "hand", "thigh", "shank", "foot"];

/** Medidas (tablas antropométricas de Drillis y Contini, redondeadas). */
export const DIM = {
  hipHalf: 9,
  shoulderY: 49,
  shoulderHalf: 17.4,
  shoulderZ: -1.5,
  neckBase: new Vector3(0, 53.5, -2),
  neck: 7.5,
  headUp: new Vector3(0, 10.5, 1.5),
  upperarm: 31,
  forearm: 26,
  hand: 19,
  thigh: 43,
  shank: 42,
  /** Altura del tobillo sobre la planta. */
  ankleH: 7,
};

/** Perfil de un segmento: [t (0 = articulación de arriba, 1 = la de abajo), lateral, medial, anterior, posterior]. */
export type LimbRing = [number, number, number, number, number];
export const LIMB: Record<Exclude<LimbSeg, "hand" | "foot">, { len: number; rings: LimbRing[] }> = {
  upperarm: {
    len: DIM.upperarm,
    rings: [
      [-0.065, 1.3, 1.0, 1.4, 1.4],
      [-0.05, 2.9, 2.1, 3.0, 3.1],
      [-0.02, 4.1, 3.2, 4.3, 4.4],
      [0.03, 4.8, 3.9, 4.9, 5.0],
      [0.15, 5.0, 4.2, 4.9, 4.9],
      [0.38, 4.4, 4.1, 4.4, 4.4],
      [0.6, 4.1, 3.9, 4.6, 4.3],
      [0.85, 3.8, 3.7, 3.7, 3.9],
      [1, 3.8, 3.9, 3.3, 3.6],
      [1.06, 3.3, 3.3, 3.0, 3.2],
    ],
  },
  forearm: {
    len: DIM.forearm,
    rings: [
      [-0.07, 3.3, 3.3, 3.0, 3.3],
      [0, 3.8, 3.8, 3.4, 3.7],
      [0.18, 4.2, 4.0, 3.9, 3.7],
      [0.4, 3.8, 3.6, 3.5, 3.3],
      [0.7, 3.1, 2.9, 2.6, 2.5],
      [0.95, 2.8, 2.8, 1.95, 1.95],
      [1.05, 2.5, 2.5, 1.7, 1.7],
    ],
  },
  thigh: {
    len: DIM.thigh,
    rings: [
      [-0.14, 6.0, 4.0, 6.0, 6.5],
      [0, 8.8, 7.0, 8.2, 8.8],
      [0.25, 8.4, 7.2, 8.0, 7.8],
      [0.6, 7.1, 6.4, 7.0, 6.3],
      [0.85, 5.8, 5.8, 5.6, 5.3],
      [0.97, 5.2, 5.3, 5.3, 4.8],
      [1.05, 4.7, 4.7, 4.6, 4.6],
    ],
  },
  shank: {
    len: DIM.shank,
    rings: [
      [-0.05, 4.7, 4.7, 4.6, 4.4],
      [0.03, 5.1, 5.0, 5.0, 5.0],
      [0.22, 5.0, 5.5, 4.2, 6.4],
      [0.5, 4.0, 4.3, 3.7, 4.7],
      [0.8, 3.0, 3.1, 2.8, 3.2],
      [0.95, 3.3, 3.4, 2.7, 2.9],
      [1.06, 2.5, 2.5, 2.3, 2.3],
    ],
  },
};

/** Pie: secciones a lo largo de z (del talón a los dedos), [z, semiancho, arriba, abajo] respecto al tobillo. */
export const FOOT: [number, number, number, number][] = [
  [-6.4, 1.6, -3.0, -5.6],
  [-5.4, 3.0, -0.8, -6.9],
  [-3, 3.3, 2.8, -7],
  [2, 3.6, 0.8, -7],
  [8, 4.1, -2.4, -7],
  [13.5, 4.5, -3.8, -7],
  [17.2, 4.1, -4.6, -7],
  [19.2, 2.9, -5.2, -6.9],
  [19.9, 1.4, -5.6, -6.6],
];

/**
 * Relieve de músculos y huesos que se notan bajo la piel de brazos y piernas: [t, ancho en t, ángulo en la
 * sección (0 lateral, 90 anterior, 180 medial, 270 posterior), ancho angular (grados), cm hacia fuera].
 */
const LIMB_BUMPS: Record<keyof typeof LIMB, [number, number, number, number, number][]> = {
  upperarm: [
    [0.6, 0.17, 90, 32, 0.55], // bíceps
    [0.36, 0.17, 270, 38, 0.5], // tríceps
    [0.83, 0.07, 270, 30, -0.2], // tendón del tríceps
    [0.45, 0.06, 5, 18, -0.25], // inserción del deltoides
    [0.98, 0.035, 180, 24, 0.45], // epicóndilo medial
    [0.98, 0.035, 0, 22, 0.25], // epicóndilo lateral
  ],
  forearm: [
    [-0.01, 0.04, 270, 26, 0.5], // olécranon
    [0.18, 0.14, 25, 38, 0.55], // braquiorradial
    [0.22, 0.15, 140, 40, 0.4], // flexores
    [0.6, 0.25, 235, 18, -0.22], // borde del cúbito
    [0.96, 0.035, 210, 22, 0.35], // estiloides cubital
  ],
  thigh: [
    [0.5, 0.2, 90, 35, 0.45], // recto anterior
    [0.83, 0.07, 140, 30, 0.85], // vasto medial
    [0.5, 0.2, 20, 32, 0.45], // vasto lateral
    [0.6, 0.25, 330, 15, -0.3], // cintilla iliotibial
    [0.55, 0.2, 270, 40, 0.35], // isquiotibiales
    [0.99, 0.04, 270, 35, -0.5], // hueco poplíteo
    [0.2, 0.15, 180, 35, 0.45], // aductores
    [0.98, 0.035, 90, 26, 0.7], // rótula
  ],
  shank: [
    [0.04, 0.035, 90, 14, 0.3], // tendón rotuliano
    [0.05, 0.04, 55, 15, -0.35], // huecos a los lados del tendón
    [0.05, 0.04, 125, 15, -0.35],
    [0.1, 0.03, 90, 18, 0.35], // tuberosidad tibial
    [0.27, 0.12, 225, 38, 0.95], // gemelo medial
    [0.23, 0.1, 315, 34, 0.65], // gemelo lateral
    [0.5, 0.25, 125, 25, -0.2], // cara medial de la tibia, plana
    [0.86, 0.07, 235, 18, -0.35], // huecos a los lados del tendón de Aquiles
    [0.86, 0.07, 305, 18, -0.35],
    [0.97, 0.03, 180, 30, 0.55], // maléolo medial
    [1.02, 0.03, 0, 28, 0.55], // maléolo lateral
  ],
};

/** Relieve (cm) de un miembro a la altura t en la dirección (x, z) de su sección. */
export function limbBump(seg: keyof typeof LIMB, s: Side, t: number, x: number, z: number): number {
  const phi = (Math.atan2(z, x * sgn(s)) * 180) / Math.PI;
  let b = 0;
  for (const [tc, st, pc, sp, a] of LIMB_BUMPS[seg]) {
    const u = (t - tc) / st;
    if (u > 3 || u < -3) continue;
    let dp = phi - pc;
    dp -= 360 * Math.round(dp / 360);
    if (dp > 3 * sp || dp < -3 * sp) continue;
    b += a * Math.exp(-u * u - (dp / sp) ** 2);
  }
  return b;
}

const gs = (u: number) => Math.exp(-u * u);
const win = (a: number, b: number, w: number, x: number) => smooth(a - w, a + w, x) * (1 - smooth(b - w, b + w, x));

/** Relieve (cm) del tronco en un punto de su superficie (coordenadas del tronco): pecho, clavículas, escápulas, columna y glúteos. */
export function torsoBump(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  let b = 0;
  if (z > -1) {
    const f = smooth(-1, 3, z);
    // Pectorales (con su borde inferior más marcado), surco del esternón y horquilla esternal.
    b += 0.8 * gs((ax - 7.5) / 5.5) * gs((y - 40.5) / (y < 40.5 ? 2.8 : 5.5)) * f;
    b -= 0.3 * gs(ax / 1.3) * win(30, 46, 2, y) * f;
    b -= 0.55 * gs(ax / 1.5) * gs((y - 51.2) / 1.4) * f;
    // Clavículas: del esternón al hombro, algo hacia arriba.
    const u = Math.min(1, Math.max(0, (ax - 2.5) / 11.5));
    b += 0.35 * gs(Math.hypot(ax - (2.5 + 11.5 * u), y - (49.8 + 1.5 * u)) / 0.9) * f;
  }
  if (z < 1) {
    const f = smooth(1, -3, z);
    // Escápulas, surco de la columna, músculos erectores y glúteos con su pliegue.
    b += 0.6 * gs((ax - 9) / 4) * gs((y - 39.5) / 5.5) * f;
    b -= 0.55 * gs(ax / 1.5) * win(4, 46, 2, y) * f;
    b += 0.5 * gs((ax - 3.6) / 2.2) * gs((y - 10) / 9) * f;
    b += 1.4 * gs((ax - 6.5) / 5) * gs((y + 8) / 5.5) * f;
    b -= 0.35 * gs(ax / 1.2) * smooth(-1, -5, y) * f;
  }
  return b;
}

/** Tronco: [altura sobre las caderas, semiancho, hacia delante, hacia atrás]. */
export const TORSO: [number, number, number, number][] = [
  [-15.5, 2.5, 2, 3],
  [-13.5, 8.5, 6, 8.5],
  [-8, 15.2, 8, 11.5],
  [-2, 16.6, 8.8, 11],
  [5, 16.2, 9.2, 9.8],
  [12, 14.8, 9.3, 8.4],
  [18, 13.9, 9.2, 8],
  [26, 14.8, 9.8, 8.4],
  [34, 15.7, 11, 8.9],
  [41, 16.0, 11.4, 9.3],
  [46, 16.4, 10.2, 9.3],
  [50, 16.6, 7.6, 8.4],
  [52.6, 12.6, 6.0, 6.7],
  [55.5, 7.8, 4.8, 5.4],
  [57.5, 5.5, 4.2, 4.8],
  [58.5, 2.5, 2, 2.5],
];

/** Cabeza: [altura respecto al centro, semiancho, cara (z delante), nuca (z detrás)]. */
export const HEAD: [number, number, number, number][] = [
  [-11.3, 1.5, 6.3, 3.3],
  [-10.6, 3.5, 7.5, 1.0],
  [-8.8, 5.2, 8.3, -2.4],
  [-5.8, 6.3, 8.9, -6.3],
  [-2, 7.2, 9.3, -8.8],
  [2, 7.7, 9.3, -9.8],
  [6, 7.5, 8.4, -9.8],
  [9.5, 6.4, 6.8, -8.6],
  [11.6, 4.6, 4.6, -6.2],
  [12.6, 3.0, 2.7, -3.9],
  [13.1, 1.3, 1.0, -1.9],
];
export const HEAD_EXT = { x: 7.7, up: 13, down: 11.3, front: 9.4, back: 9.9 };

/** Eje de la mandíbula (las dos ATM, delante de las orejas), en coordenadas de la cabeza. */
export const JAW_PIVOT = { y: -1.6, z: 0.6 };
/** Altura de los labios (comisura) en la cara. */
export const LIPS_Y = -6.2;

/** Un punto de la cara que va con la mandíbula, girado `deg` grados (abrir la boca es positivo). */
export function jawPoint(v: Vector3, deg: number): Vector3 {
  const a = rad(deg);
  const y = v.y - JAW_PIVOT.y;
  const z = v.z - JAW_PIVOT.z;
  return new Vector3(v.x, JAW_PIVOT.y + y * Math.cos(a) - z * Math.sin(a), JAW_PIVOT.z + y * Math.sin(a) + z * Math.cos(a));
}

/** Superficie de la cara (z) en la línea media a una altura de la cabeza. */
export const faceZ = (y: number) => profileAt(HEAD, y)[1]!;

/** Depresor lingual entre los molares derechos: extremo de dentro y de fuera, en coordenadas de la cabeza. */
export const DEPRESSOR = { inner: new Vector3(-2, LIPS_Y - 0.05, 4), outer: new Vector3(-3.2, LIPS_Y - 0.05, 17) };

export type Xf = { p: Vector3; q: Quaternion };

/** Mano: muñeca en el origen, dedos hacia −y y palma hacia +z. Los dedos se doblan hacia la palma desde
 *  los nudillos con radio de curvatura R (grande: mano plana; pequeño: mano que abarca). */
export const KNUCKLE_Y = -9.2;
export const HAND_REST_CURL = 13;
export function bendPoint(y: number, z: number, R: number): [number, number] {
  if (y >= KNUCKLE_Y) return [y, z];
  const phi = (KNUCKLE_Y - y) / R;
  return [KNUCKLE_Y - (R - z) * Math.sin(phi), R - (R - z) * Math.cos(phi)];
}
export type HandState = {
  curl: number;
  grip: "press" | "grasp" | "tips" | "rest";
  /** Flexión total (grados) de cada dedo, del índice al meñique (si falta, la de `curl`). */
  fingers?: number[];
  /** Flexión del pulgar (grados, entre sus dos articulaciones). */
  thumb?: number;
  /** Dónde va el pulgar si no es donde lo pone la toma (p. ej. junto a los dedos si al otro lado no cabe). */
  thumbAt?: "press" | "grasp" | "tips" | "rest";
};

/** Dedos: [lado del pulgar (+) o del meñique (−), largo desde el nudillo, radio, separación en grados]. */
export const FINGERS: [number, number, number, number][] = [
  [2.9, 8.5, 0.95, -3],
  [0.95, 9.4, 0.98, 0],
  [-1.0, 8.9, 0.92, 2.5],
  [-2.85, 7.0, 0.8, 6],
];
/** Curvatura de cada dedo respecto a la de la mano (relajada: el meñique más doblado). */
export const FINGER_CURL: Record<HandState["grip"], number[]> = {
  rest: [1.05, 1, 0.9, 0.78],
  press: [1, 1, 1, 1],
  grasp: [1, 1, 1, 1],
  tips: [1, 1, 0.94, 0.86],
};
/** Flexión (grados) de cada dedo en una mano: la pedida o la que da el radio de curvatura `curl`. */
export function fingerBends(st: HandState): number[] {
  if (st.fingers) return st.fingers;
  const fac = FINGER_CURL[st.grip];
  return FINGERS.map(([, len], i) => deg(len / (st.curl * fac[i]!)));
}
/** Articulaciones de un dedo: dónde (fracción del largo desde el nudillo), qué parte de la flexión se lleva y
 *  en cuánto largo se curva (cm a cada lado). */
const FINGER_JOINTS: [number, number, number][] = [
  [0.03, 0.34, 0.8],
  [0.47, 0.42, 0.55],
  [0.77, 0.24, 0.45],
];
/** Pulgar: la articulación metacarpofalángica y la interfalángica (cm desde su base), y su largo. */
export const THUMB_JOINTS: [number, number, number][] = [
  [5.4, 0.45, 0.7],
  [8.2, 0.55, 0.55],
];
export const THUMB = { y0: 1.0, len: 10.85 };

/**
 * Dedo doblado `bend` grados repartidos entre sus articulaciones (falanges rectas, pliegues suaves). Devuelve
 * dónde queda un punto que en el dedo recto está a `s` cm de la base y a `z` cm de la línea media (+ hacia
 * la palma), en el plano (y, z) de la mano: [y, z], con la base en `y0` y el dedo hacia −y.
 */
export function bentFinger(y0: number, len: number, bend: number, joints: [number, number, number][] = FINGER_JOINTS) {
  // Se repiten mucho (cada fotograma, cada dedo): se guardan las últimas curvas.
  const b = Math.round(bend * 4) / 4;
  const key = `${y0}|${len}|${b}|${joints === FINGER_JOINTS ? "f" : "t"}`;
  let c = CURVES.get(key);
  if (!c) {
    if (CURVES.size > 3000) CURVES.clear();
    c = fingerCurve(y0, len, b, joints);
    CURVES.set(key, c);
  }
  return c;
}
const CURVES = new Map<string, (s: number, z: number) => [number, number]>();

function fingerCurve(y0: number, len: number, bend: number, joints: [number, number, number][]) {
  const phi = rad(bend);
  const ds = 0.1;
  const s0 = -1.5;
  const n = Math.ceil((len + 2 - s0) / ds) + 2;
  const Y = new Float64Array(n);
  const Zs = new Float64Array(n);
  const T = new Float64Array(n);
  const K = new Float64Array(n);
  const at = joints.map(([f, sh, w]) => ({ c: f <= 1 ? f * len : f, a: phi * sh, w }));
  const ang = (x: number) => {
    let t = 0;
    let k = 0;
    for (const j of at) {
      const u = (x - j.c) / j.w;
      if (u >= 1) t += j.a;
      else if (u > -1) {
        t += j.a * 0.5 * (1 + u + Math.sin(Math.PI * u) / Math.PI);
        k += (j.a * 0.5 * (1 + Math.cos(Math.PI * u))) / j.w;
      }
    }
    return [t, k] as const;
  };
  Y[0] = y0 - s0;
  for (let i = 0; i < n; i++) {
    const [t, k] = ang(s0 + i * ds);
    T[i] = t;
    K[i] = k;
    if (i === 0) continue;
    const tm = ang(s0 + (i - 0.5) * ds)[0];
    Y[i] = Y[i - 1]! - Math.cos(tm) * ds;
    Zs[i] = Zs[i - 1]! + Math.sin(tm) * ds;
  }
  return (s: number, z: number): [number, number] => {
    if (s <= s0) return [y0 - s, z];
    const f = Math.min(n - 1.001, (s - s0) / ds);
    const i = Math.floor(f);
    const u = f - i;
    const t = T[i]! + (T[i + 1]! - T[i]!) * u;
    const k = K[i]! + (K[i + 1]! - K[i]!) * u;
    // Del lado de dentro del pliegue la piel no puede pasar del centro de la curva.
    const zz = z > 0 && k > 1e-6 ? Math.min(z, 0.82 / k) : z;
    return [Y[i]! + (Y[i + 1]! - Y[i]!) * u + zz * Math.sin(t), Zs[i]! + (Zs[i + 1]! - Zs[i]!) * u + zz * Math.cos(t)];
  };
}
/** Dónde nace el pulgar y hacia dónde va en cada toma (mano izquierda; la derecha, en espejo). */
function thumbPose(grip: HandState["grip"], curl: number): { base: Vector3; dir: Vector3 } {
  switch (grip) {
    case "press":
      return { base: new Vector3(2.4, -1.2, 0.4), dir: new Vector3(0.42, -0.9, 0.1) };
    case "tips":
      return { base: new Vector3(2.4, -1.2, 0.6), dir: new Vector3(0.1, -0.8, 0.58) };
    case "grasp": {
      // Por el otro lado del segmento que abarcan los dedos: tangente a su contorno.
      const B = new Vector3(2.4, -1.2, 0.3);
      const cy = KNUCKLE_Y;
      const cz = curl;
      const rho = curl - 0.25;
      const dy = cy - B.y;
      const dz = cz - B.z;
      const d = Math.hypot(dy, dz);
      if (d <= rho + 0.2) return { base: B, dir: new Vector3(-0.15, -0.45, 0.88) };
      const a0 = Math.atan2(dz, dy);
      const al = Math.asin(rho / d);
      const cand = [a0 + al, a0 - al].map((a) => new Vector3(-0.22, Math.cos(a), Math.sin(a)));
      cand.sort((p, q) => q.z - p.z);
      return { base: B, dir: cand[0]! };
    }
    default:
      return { base: new Vector3(2.4, -1.2, 0.5), dir: new Vector3(0.3, -0.9, 0.3) };
  }
}

/** Marco del pulgar en la mano (su eje hacia −y, la yema hacia +z). */
export function thumbFrame(grip: HandState["grip"], curl: number, s: Side): Xf {
  const r = sgn(s);
  const t = thumbPose(grip, curl);
  const dir = new Vector3(r * t.dir.x, t.dir.y, t.dir.z).normalize();
  const y = dir.clone().negate();
  // La yema mira a los dedos (hacia la palma y el lado cubital).
  const z = new Vector3(-r * 0.7, 0, 0.7);
  z.addScaledVector(y, -z.dot(y)).normalize();
  return { p: new Vector3(r * t.base.x, t.base.y, t.base.z), q: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3().crossVectors(y, z), y, z)) };
}

/** Puntos de las yemas (y del medio de cada dedo) en la mano, para apoyarlos en una superficie. */
export function fingerPads(s: Side, i: number, bend: number): Vector3[] {
  const [x0, len, r0, spread] = FINGERS[i]!;
  const f = bentFinger(KNUCKLE_Y, len, bend);
  const tan = Math.tan(rad(spread));
  return [0.3 * len, 0.6 * len, len - 0.35].map((d) => {
    const [y, z] = f(d, 0.8 * r0);
    return new Vector3(sgn(s) * (x0 + d * tan), y, z - 0.1);
  });
}
export function thumbPad(s: Side, grip: HandState["grip"], curl: number, bend: number): Vector3 {
  return thumbPoint(s, grip, curl, bend, THUMB.len - 0.45, 0.75);
}
/** Un punto del pulgar a `d` cm de su base (en la cara de la yema). */
export function thumbPoint(s: Side, grip: HandState["grip"], curl: number, bend: number, d: number, z = 0.8): Vector3 {
  const fr = thumbFrame(grip, curl, s);
  const [y, zz] = bentFinger(THUMB.y0, THUMB.len, bend, THUMB_JOINTS)(d, z);
  return new Vector3(0, y, zz).applyQuaternion(fr.q).add(fr.p);
}

/** Ángulos de una articulación; `twist` (solo muñeca) gira el antebrazo sobre su eje antes de doblarla;
 *  `rot` (hombro y cadera) gira el segmento sobre su eje (rotación interna +). */
export type JA = { flex: number; abd: number; twist?: number; rot?: number };
type Limb = Record<"shoulder" | "elbow" | "wrist" | "hip" | "knee" | "ankle", JA>;
export type BodyAngles = { trunkFlex: number; trunkLat: number; neckFlex: number; neckLat: number; neckYaw: number; jaw: number; r: Limb; l: Limb };

export type Pose3 = {
  root: Xf;
  /** Orientación del tronco completo (la que usan los miembros y las direcciones anatómicas). */
  trunkQ: Quaternion;
  pelvisQ: Quaternion;
  /** Marcos a lo largo de la columna, de SPINE_Y0 cm hacia arriba, uno por centímetro. */
  spine: Xf[];
  neck: Xf;
  head: Xf;
  seg: Record<SegKey, Xf>;
  pt: Record<string, Vector3>;
  /** Apertura de la boca (grados de giro de la mandíbula). */
  jaw: number;
  /** Cómo están las manos (solo el examinador; si falta, relajadas). */
  hands?: Partial<Record<Side, HandState>>;
  /** Cuánto se ha desplazado cada hombro con la escápula (en el mundo). */
  girdle: Record<Side, Vector3>;
  /** Pronación del antebrazo: giro (grados) de la mano sobre el eje del antebrazo; el antebrazo se tuerce poco a poco. */
  twist: Record<Side, number>;
};

export const SPINE_Y0 = -16;
const SPINE_N = 77;

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
export const qAxis = (axis: Vector3, deg: number) => new Quaternion().setFromAxisAngle(axis, rad(deg));
export const qmul = (...qs: Quaternion[]) => qs.reduce((a, b) => a.multiply(b), new Quaternion());
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Giro de una articulación: primero flexión (eje x), después separación (eje z) hacia fuera. */
function jr(flex: number, abd: number, s: Side, flexSign = -1) {
  return qmul(qAxis(X, flexSign * flex), qAxis(Z, sgn(s) * abd));
}
const trunkRot = (flex: number, lat: number) => qmul(qAxis(X, flex), qAxis(Z, lat));

/** Base de una postura: cómo se coloca el cuerpo en el mundo. */
export function postureQ(posture: Posture, upSide: Side = "l"): Quaternion {
  const basis = (x: Vector3, y: Vector3, z: Vector3) => new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  switch (posture) {
    case "supine":
    case "hooklying":
      return basis(new Vector3(0, 0, -1), new Vector3(-1, 0, 0), new Vector3(0, 1, 0));
    case "prone":
      return basis(new Vector3(0, 0, 1), new Vector3(-1, 0, 0), new Vector3(0, -1, 0));
    case "sidelying":
      return upSide === "l"
        ? basis(new Vector3(0, 1, 0), new Vector3(-1, 0, 0), new Vector3(0, 0, 1))
        : basis(new Vector3(0, -1, 0), new Vector3(1, 0, 0), new Vector3(0, 0, 1));
    default:
      return new Quaternion();
  }
}

export const LYING: Posture[] = ["supine", "hooklying", "prone", "sidelying", "longsitting"];

/** Ángulos de partida de cada postura (en el plano sagital), los mismos que la figura plana. */
const BASE: Record<Posture, Partial<Record<JointKey, number>>> = {
  standing: {},
  sitting: { r_hip: 90, l_hip: 90, r_knee: 90, l_knee: 90 },
  longsitting: { r_hip: 90, l_hip: 90 },
  supine: {},
  hooklying: { r_hip: 45, l_hip: 45, r_knee: 90, l_knee: 90 },
  prone: {},
  sidelying: {},
  quadruped: { trunk: 75, r_shoulder: 75, l_shoulder: 75, r_wrist: 90, l_wrist: 90, r_hip: 75, l_hip: 75, r_knee: 90, l_knee: 90, r_ankle: -90, l_ankle: -90 },
};

/** En decúbito lateral, el lado que queda arriba: el de las manos, flechas y articulaciones que se mueven. */
export function upSide(spec: FigureSpec): Side {
  const keys = [...(spec.hands ?? []), ...(spec.arrows ?? []).map((a) => a.at), ...(spec.pain ?? []), ...Object.keys(spec.joints ?? {}), ...Object.keys(spec.to ?? {})];
  const r = keys.filter((k) => k.startsWith("r_")).length;
  const l = keys.filter((k) => k.startsWith("l_")).length;
  return r > l ? "r" : "l";
}

const ja = (flex = 0, abd = 0): JA => ({ flex, abd });
const limbZero = (): Limb => ({ shoulder: ja(), elbow: ja(), wrist: ja(), hip: ja(), knee: ja(), ankle: ja() });

/**
 * Ángulos del paciente en el momento m (0 = posición inicial, 1 = final). En vista lateral los ángulos
 * de la figura son del plano sagital; en vista frontal, del plano frontal (la postura pone la flexión).
 * Las articulaciones que la figura no menciona toman una postura natural (brazos sueltos, manos en los
 * muslos al sentarse, pies relajados boca abajo).
 */
export function patientAngles(spec: FigureSpec, m: number): BodyAngles {
  const side = spec.view === "side";
  const base = BASE[spec.posture];
  const mentioned = new Set<string>([...Object.keys(spec.joints ?? {}), ...Object.keys(spec.to ?? {})]);
  const val = (k: JointKey, useBase: boolean) => {
    const a0 = spec.joints?.[k] ?? (useBase ? (base[k] ?? 0) : 0);
    const a1 = spec.to?.[k] ?? a0;
    return a0 + (a1 - a0) * m;
  };
  const A: BodyAngles = { trunkFlex: 0, trunkLat: 0, neckFlex: 0, neckLat: 0, neckYaw: 0, jaw: Math.max(0, val("jaw", false)), r: limbZero(), l: limbZero() };
  if (side) {
    A.trunkFlex = val("trunk", true);
    A.neckFlex = val("neck", true);
  } else {
    A.trunkLat = val("trunk", false);
    A.neckLat = val("neck", false);
    A.trunkFlex = base.trunk ?? 0;
  }
  const joints = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"] as const;
  for (const s of ["r", "l"] as const) {
    for (const j of joints) {
      const k = `${s}_${j}` as JointKey;
      if (side) A[s][j].flex = val(k, true);
      else {
        A[s][j].flex = base[k] ?? 0;
        A[s][j].abd = val(k, false);
      }
    }
  }
  // Postura natural de lo que no se menciona.
  const free = (s: Side, j: (typeof joints)[number]) => !mentioned.has(`${s}_${j}`);
  const up = spec.posture === "sidelying" ? upSide(spec) : null;
  for (const s of ["r", "l"] as const) {
    const L = A[s];
    const set = (j: (typeof joints)[number], flex: number, abd: number) => {
      if (!free(s, j)) return;
      L[j].flex += flex;
      L[j].abd += abd;
    };
    switch (spec.posture) {
      case "standing":
        set("shoulder", A.trunkFlex, 10 + Math.min(10, A.trunkFlex * 0.15) - sgn(s) * A.trunkLat);
        set("elbow", 8, 0);
        set("hip", A.trunkFlex, 3 - sgn(s) * A.trunkLat);
        set("knee", 2, 0);
        break;
      case "sitting":
        set("shoulder", A.trunkFlex * 0.6, 9);
        set("elbow", 75, -7);
        set("hip", A.trunkFlex, 6);
        break;
      case "supine":
      case "hooklying":
      case "longsitting":
        set("shoulder", 0, spec.posture === "longsitting" ? 12 : 9);
        set("elbow", 6, 0);
        set("hip", 0, 4);
        break;
      case "prone":
        set("shoulder", 0, 9);
        set("elbow", 6, 0);
        set("hip", 0, 4);
        if (free(s, "ankle") && L.knee.flex < 30) L.ankle.flex = -55;
        break;
      case "sidelying":
        if (s !== up) {
          set("shoulder", 80, 0);
          set("elbow", 95, 0);
          set("hip", 25, 0);
          set("knee", 35, 0);
        } else {
          // El brazo de arriba, apoyado sobre el costado.
          set("shoulder", 8, 14);
          set("elbow", 15, 0);
          set("knee", 5, 0);
        }
        break;
      default:
        break;
    }
  }
  // Antebrazos relajados (pronación desde la palma hacia delante): de pie, la palma hacia el muslo; sentado,
  // hacia abajo sobre los muslos; tumbado, hacia el cuerpo.
  const PRON: Partial<Record<Posture, number>> = { standing: 70, sitting: 150, supine: 80, hooklying: 80, longsitting: 120, prone: 80, sidelying: 80, quadruped: 40 };
  for (const s of ["r", "l"] as const) if (free(s, "wrist")) A[s].wrist.twist = -sgn(s) * (PRON[spec.posture] ?? 40);
  // Ángulos 3D explícitos (lo que la vista plana no puede describir).
  for (const k of new Set([...Object.keys(spec.pose3d ?? {}), ...Object.keys(spec.to3d ?? {})]) as Set<JointKey>) {
    const m3 = k.match(/^(r|l)_(\w+)$/);
    if (!m3) continue;
    const j = A[m3[1] as Side][m3[2] as keyof Limb];
    const a0 = spec.pose3d?.[k] ?? {};
    const a1 = spec.to3d?.[k] ?? a0;
    const mix = (x?: number, y?: number) => (x ?? 0) + ((y ?? x ?? 0) - (x ?? 0)) * m;
    j.flex = mix(a0.flex, a1.flex);
    j.abd = mix(a0.abd, a1.abd);
    j.rot = mix(a0.rot, a1.rot);
  }
  // Muñeca doblada hacia atrás con el codo muy flexionado (Phalen): en la figura plana es flexión con el
  // antebrazo en pronación. Se gira el antebrazo para que la palma quede del lado cóncavo.
  if (side) {
    for (const s of ["r", "l"] as const) {
      const L = A[s];
      if (L.elbow.flex >= 100 && L.wrist.flex < -30) {
        L.wrist.twist = 180;
        L.wrist.flex = -L.wrist.flex;
      }
    }
  }
  if (spec.posture === "prone" && !mentioned.has("neck")) A.neckYaw = -80;
  if (spec.posture === "sidelying" && !mentioned.has("neck")) A.neckLat = up === "l" ? -12 : 12;
  return A;
}

/** Desplazamientos de un segmento y lo que cuelga de él (cajones, deslizamientos, tracciones). */
export type Nudges = Partial<Record<SegKey, Vector3>>;

const PROX: Record<LimbSeg, string> = { upperarm: "shoulder", forearm: "elbow", hand: "wrist", thigh: "hip", shank: "knee", foot: "ankle" };
const DISTAL: Record<LimbSeg, LimbSeg[]> = {
  upperarm: ["upperarm", "forearm", "hand"],
  forearm: ["forearm", "hand"],
  hand: ["hand"],
  thigh: ["thigh", "shank", "foot"],
  shank: ["shank", "foot"],
  foot: ["foot"],
};
const TIPS: Partial<Record<LimbSeg, string[]>> = { hand: ["handtip"], foot: ["foottip", "heel"] };

/**
 * Cintura escapular: al levantar el brazo el hombro sube (la escápula gira y se eleva); al llevarlo hacia
 * delante o cruzarlo por delante del cuerpo, se adelanta y se acerca al centro, y al llevarlo atrás, se
 * atrasa. `d`: dirección del brazo (hombro → codo) en el mundo. Devuelve el desplazamiento del hombro (cm).
 */
export function girdleOffset(d: Vector3, trunkQ: Quaternion, s: Side): Vector3 {
  const l = d.clone().applyQuaternion(trunkQ.clone().invert());
  const lat = l.x * sgn(s);
  const e = Math.acos(Math.max(-1, Math.min(1, -l.y)));
  const up = 3.2 * smooth(0.6, 2.7, e);
  const fwd = Math.max(0, l.z) * 2.2 + Math.max(0, -lat) * 1.3 - Math.max(0, -l.z) * 1.4;
  const med = -0.7 * (Math.max(0, l.z) + Math.max(0, -lat));
  return new Vector3(sgn(s) * med, up, fwd).applyQuaternion(trunkQ);
}

/** Cinemática directa: dónde queda cada parte con estos ángulos. */
export function fk(rootP: Vector3, rootQ: Quaternion, A: BodyAngles, nudges: Nudges = {}): Pose3 {
  const pelvisQ = qmul(rootQ.clone(), trunkRot(A.trunkFlex * 0.5, A.trunkLat * 0.5));
  const chestQ = qmul(rootQ.clone(), trunkRot(A.trunkFlex, A.trunkLat));
  const w = (y: number) => smooth(4, 34, y);
  const qAt = (y: number) => pelvisQ.clone().slerp(chestQ, w(y));
  const spine: Xf[] = [];
  const i0 = -SPINE_Y0;
  for (let i = 0; i < SPINE_N; i++) spine.push({ p: new Vector3(), q: qAt(SPINE_Y0 + i) });
  spine[i0]!.p.copy(rootP);
  for (let i = i0 + 1; i < SPINE_N; i++) spine[i]!.p.copy(spine[i - 1]!.p).add(Y.clone().applyQuaternion(qAt(SPINE_Y0 + i - 0.5)));
  for (let i = 0; i < i0; i++) spine[i]!.p.copy(rootP).add(new Vector3(0, SPINE_Y0 + i, 0).applyQuaternion(pelvisQ));
  const chestP = spine[i0 + DIM.shoulderY]!.p;
  const at = (p: Vector3, q: Quaternion, v: Vector3) => p.clone().add(v.clone().applyQuaternion(q));

  const neckQ = qmul(chestQ.clone(), qAxis(X, A.neckFlex * 0.6), qAxis(Z, A.neckLat * 0.6), qAxis(Y, A.neckYaw * 0.5));
  const headQ = qmul(chestQ.clone(), qAxis(X, A.neckFlex), qAxis(Z, A.neckLat), qAxis(Y, A.neckYaw));
  const neckBase = at(chestP, chestQ, new Vector3(0, DIM.neckBase.y - DIM.shoulderY, DIM.neckBase.z));
  const neckTop = at(neckBase, neckQ, new Vector3(0, DIM.neck, 0));
  const headC = at(neckTop, headQ, DIM.headUp);

  const seg = {} as Record<SegKey, Xf>;
  const pt: Record<string, Vector3> = { pelvis: rootP.clone(), neckBase, neck: neckTop, head: headC, chest: chestP.clone() };
  const girdle = {} as Record<Side, Vector3>;
  const twist = {} as Record<Side, number>;
  for (const s of ["r", "l"] as const) {
    const L = A[s];
    const uaQ = qmul(chestQ.clone(), jr(L.shoulder.flex, L.shoulder.abd, s), qAxis(Y, -sgn(s) * (L.shoulder.rot ?? 0)));
    girdle[s] = girdleOffset(new Vector3(0, -1, 0).applyQuaternion(uaQ), chestQ, s);
    twist[s] = L.wrist.twist ?? 0;
    const sh = at(chestP, chestQ, new Vector3(sgn(s) * DIM.shoulderHalf, 0, DIM.shoulderZ)).add(girdle[s]);
    const el = at(sh, uaQ, new Vector3(0, -DIM.upperarm, 0));
    const faQ = qmul(uaQ.clone(), jr(L.elbow.flex, L.elbow.abd, s));
    const wr = at(el, faQ, new Vector3(0, -DIM.forearm, 0));
    const hdQ = qmul(faQ.clone(), qAxis(Y, L.wrist.twist ?? 0), jr(L.wrist.flex, L.wrist.abd, s));
    const tip = at(wr, hdQ, new Vector3(0, -DIM.hand, 0));
    const hip = at(rootP, pelvisQ, new Vector3(sgn(s) * DIM.hipHalf, 0, 0));
    const thQ = qmul(chestQ.clone(), jr(L.hip.flex, L.hip.abd, s), qAxis(Y, -sgn(s) * (L.hip.rot ?? 0)));
    const kn = at(hip, thQ, new Vector3(0, -DIM.thigh, 0));
    const shQ = qmul(thQ.clone(), jr(L.knee.flex, L.knee.abd, s, 1));
    const an = at(kn, shQ, new Vector3(0, -DIM.shank, 0));
    const ftQ = qmul(shQ.clone(), qAxis(X, -L.ankle.flex));
    seg[`${s}_upperarm`] = { p: sh, q: uaQ };
    seg[`${s}_forearm`] = { p: el, q: faQ };
    seg[`${s}_hand`] = { p: wr, q: hdQ };
    seg[`${s}_thigh`] = { p: hip, q: thQ };
    seg[`${s}_shank`] = { p: kn, q: shQ };
    seg[`${s}_foot`] = { p: an, q: ftQ };
    Object.assign(pt, {
      [`${s}_shoulder`]: sh.clone(),
      [`${s}_elbow`]: el.clone(),
      [`${s}_wrist`]: wr.clone(),
      [`${s}_handtip`]: tip,
      [`${s}_hip`]: hip.clone(),
      [`${s}_knee`]: kn.clone(),
      [`${s}_ankle`]: an.clone(),
      [`${s}_foottip`]: at(an, ftQ, new Vector3(0, -5.6, 19)),
      [`${s}_heel`]: at(an, ftQ, new Vector3(0, -6.2, -5)),
    });
  }
  for (const [k, v] of Object.entries(nudges) as [SegKey, Vector3][]) {
    const [s, name] = k.split("_") as [Side, LimbSeg];
    for (const d of DISTAL[name]) {
      seg[`${s}_${d}`].p.add(v);
      pt[`${s}_${PROX[d]}`]!.add(v);
      for (const t of TIPS[d] ?? []) pt[`${s}_${t}`]!.add(v);
    }
  }
  return { root: { p: rootP.clone(), q: rootQ.clone() }, trunkQ: chestQ, pelvisQ, spine, neck: { p: neckBase, q: neckQ }, head: { p: headC, q: headQ }, seg, pt, jaw: A.jaw, girdle, twist };
}

/** Marco de la columna a una altura (interpolado). */
export function spineAt(pose: Pose3, y: number): Xf {
  const f = Math.min(SPINE_N - 1.001, Math.max(0, y - SPINE_Y0));
  const i = Math.floor(f);
  const k = f - i;
  const a = pose.spine[i]!;
  const b = pose.spine[i + 1]!;
  return { p: a.p.clone().lerp(b.p, k), q: a.q.clone().slerp(b.q, k) };
}

/** Interpolación suave (Hermite con tangentes de Catmull-Rom) de una tabla de perfiles. */
export function profileAt<T extends number[]>(rows: T[], x: number): number[] {
  const n = rows.length;
  if (x <= rows[0]![0]!) return rows[0]!.slice(1);
  if (x >= rows[n - 1]![0]!) return rows[n - 1]!.slice(1);
  let i = 0;
  while (rows[i + 1]![0]! < x) i++;
  const r0 = rows[i]!;
  const r1 = rows[i + 1]!;
  const h = r1[0]! - r0[0]!;
  const u = (x - r0[0]!) / h;
  const tan = (k: number, c: number) => {
    const a = rows[Math.max(0, k - 1)]!;
    const b = rows[Math.min(n - 1, k + 1)]!;
    return (b[c]! - a[c]!) / (b[0]! - a[0]!);
  };
  const out: number[] = [];
  for (let c = 1; c < r0.length; c++) {
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
    const h10 = u ** 3 - 2 * u ** 2 + u;
    const h01 = -2 * u ** 3 + 3 * u ** 2;
    const h11 = u ** 3 - u ** 2;
    out.push(h00 * r0[c]! + h10 * h * tan(i, c) + h01 * r1[c]! + h11 * h * tan(i + 1, c));
  }
  return out;
}

// ---------- Anclajes: puntos del cuerpo donde van las manos, las flechas y el síntoma ----------

/** Sección alrededor de un punto: semiejes hacia +x, −x, +z y −z del marco. */
export type Section = { xp: number; xn: number; zp: number; zn: number };
export type AnchorInfo = {
  p: Vector3;
  /** Parte del cuerpo (para saber qué malla puede tapar el punto sin ocultarlo). */
  part: string;
  /** Eje del segmento, de proximal a distal (o hacia la cabeza en el tronco y el cuello). */
  axis: Vector3;
  frame: Quaternion;
  sec: Section;
  /** La cabeza es un elipsoide: el contacto puede ir por arriba. */
  ellipsoid?: boolean;
  limb: boolean;
};

export function limbSection(seg: "upperarm" | "forearm" | "thigh" | "shank", s: Side, t: number): Section {
  const [lat, med, ant, post] = profileAt(LIMB[seg].rings, t) as [number, number, number, number];
  return s === "l" ? { xp: lat, xn: med, zp: ant, zn: post } : { xp: med, xn: lat, zp: ant, zn: post };
}
export function torsoSection(y: number): Section {
  const [a, ant, post] = profileAt(TORSO, y) as [number, number, number];
  return { xp: a, xn: a, zp: ant, zn: post };
}
const circle = (r: number): Section => ({ xp: r, xn: r, zp: r, zn: r });

export function anchorInfo(pose: Pose3, anchor: Anchor): AnchorInfo | null {
  const [name, tStr] = anchor.split("@");
  if (!name) return null;
  const down = (q: Quaternion) => new Vector3(0, -1, 0).applyQuaternion(q);
  const up = (q: Quaternion) => new Vector3(0, 1, 0).applyQuaternion(q);
  const trunk = (y: number, part = "torso"): AnchorInfo => {
    const f = spineAt(pose, y);
    return { p: f.p, part, axis: up(f.q), frame: f.q, sec: torsoSection(y), limb: false };
  };
  if (name === "pelvis") return trunk(0);
  if (name === "lumbar") return trunk(7.5);
  if (name === "thoracic") return trunk(32.5);
  if (name === "shoulder") return trunk(DIM.shoulderY);
  if (name === "trunk") return trunk(50 * Number(tStr ?? 0.5));
  if (name === "head") return { p: pose.head.p.clone(), part: "head", axis: up(pose.head.q), frame: pose.head.q, sec: circle(8), ellipsoid: true, limb: false };
  // Cara: puntos de la cabeza; el mentón y la boca bajan con la mandíbula.
  const face = (local: Vector3, r: number, axis = new Vector3(0, -1, 0)): AnchorInfo => ({
    p: pose.head.p.clone().add(local.applyQuaternion(pose.head.q)),
    part: "head",
    axis: axis.applyQuaternion(pose.head.q),
    frame: pose.head.q,
    sec: circle(r),
    limb: false,
  });
  if (name === "jaw") return face(jawPoint(new Vector3(0, -9.0, 6.2), pose.jaw), 1.8);
  if (name === "mouth") {
    const lower = jawPoint(new Vector3(0, LIPS_Y - 0.3, faceZ(LIPS_Y - 0.3) - 1.2), pose.jaw);
    return face(new Vector3(0, LIPS_Y + 0.2, faceZ(LIPS_Y) - 1.2).lerp(lower, 0.5), 1.2);
  }
  if (name === "r_tmj" || name === "l_tmj") return face(new Vector3(name === "r_tmj" ? -6.2 : 6.2, JAW_PIVOT.y - 0.4, JAW_PIVOT.z + 0.6), 1.5);
  if (name === "depressor") return face(DEPRESSOR.outer.clone().lerp(DEPRESSOR.inner, 0.08), 1, DEPRESSOR.outer.clone().sub(DEPRESSOR.inner).normalize());
  if (name === "neck") {
    const k = tStr === undefined ? 1 : Number(tStr);
    const p = pose.pt.neckBase!.clone().lerp(pose.pt.neck!, k);
    return { p, part: "neck", axis: up(pose.neck.q), frame: pose.neck.q, sec: circle(5.6), limb: false };
  }
  const m = name.match(/^(r|l)_(\w+)$/);
  if (!m) return null;
  const s = m[1] as Side;
  const what = m[2]!;
  const sg = (n: LimbSeg) => pose.seg[`${s}_${n}`];
  const segInfo = (n: LimbSeg, t: number): AnchorInfo => {
    const x = sg(n);
    if (n === "hand") {
      const p = x.p.clone().lerp(pose.pt[`${s}_handtip`]!, t);
      return { p, part: `${s}_hand`, axis: down(x.q), frame: x.q, sec: { xp: 4.2, xn: 4.2, zp: 1.7, zn: 1.7 }, limb: true };
    }
    if (n === "foot") {
      const tip = pose.pt[`${s}_foottip`]!;
      const p = x.p.clone().lerp(tip, t).add(new Vector3(0, 2, 0).applyQuaternion(x.q).multiplyScalar(t));
      const axis = tip.clone().sub(x.p).normalize();
      return { p, part: `${s}_foot`, axis, frame: x.q, sec: circle(3.4), limb: true };
    }
    const L = LIMB[n].len;
    // El antebrazo se tuerce hacia la muñeca con la pronación (como su piel).
    const frame = n === "forearm" ? x.q.clone().multiply(qAxis(Y, forearmTwist(pose, s, t))) : x.q;
    return { p: x.p.clone().add(down(x.q).multiplyScalar(L * t)), part: `${s}_${n}`, axis: down(x.q), frame, sec: limbSection(n, s, t), limb: true };
  };
  if (tStr !== undefined && (LIMBS as string[]).includes(what)) return segInfo(what as LimbSeg, Number(tStr));
  switch (what) {
    case "shoulder":
      return { ...segInfo("upperarm", 0.05), p: pose.pt[`${s}_shoulder`]!.clone() };
    case "elbow":
      return { ...segInfo("forearm", 0), p: pose.pt[`${s}_elbow`]!.clone() };
    case "wrist":
      return { ...segInfo("forearm", 1), part: `${s}_hand`, p: pose.pt[`${s}_wrist`]!.clone() };
    case "hand":
      return segInfo("hand", 0.5);
    case "handtip":
      return segInfo("hand", 0.95);
    case "hip":
      return { ...segInfo("thigh", 0), part: "torso", p: pose.pt[`${s}_hip`]!.clone() };
    case "knee":
      return { ...segInfo("shank", 0), p: pose.pt[`${s}_knee`]!.clone() };
    case "ankle":
      return { ...segInfo("shank", 1), part: `${s}_foot`, p: pose.pt[`${s}_ankle`]!.clone() };
    case "foot":
      return segInfo("foot", 0.5);
    case "foottip":
      return segInfo("foot", 0.95);
    default:
      return (LIMBS as string[]).includes(what) ? segInfo(what as LimbSeg, 0.5) : null;
  }
}

/** Giro (grados) del antebrazo a la altura t por la pronación: nada junto al codo, todo en la muñeca. */
export function forearmTwist(pose: Pose3, s: Side, t: number): number {
  return (pose.twist?.[s] ?? 0) * smooth(1 / DIM.forearm, 1, t);
}

/**
 * Cara de un segmento de un miembro en el mundo: anterior, posterior, medial y lateral son las del propio
 * segmento (la pantorrilla es la cara posterior de la pierna esté como esté la rodilla); craneal y caudal,
 * las del cuerpo.
 */
export function limbFace(info: AnchorInfo, d: Direction, s: Side): Vector3 | null {
  const local = { anterior: new Vector3(0, 0, 1), posterior: new Vector3(0, 0, -1), lateral: new Vector3(sgn(s), 0, 0), medial: new Vector3(-sgn(s), 0, 0) }[d as "anterior"];
  return local ? local.applyQuaternion(info.frame) : null;
}

/** Distancia del eje a la superficie en la dirección n (vector unitario en el mundo). */
export function surfaceRadius(info: AnchorInfo, n: Vector3): number {
  const l = n.clone().applyQuaternion(info.frame.clone().invert());
  if (info.ellipsoid) {
    const e = HEAD_EXT;
    const ax = e.x;
    const ay = l.y > 0 ? e.up : e.down;
    const az = l.z > 0 ? e.front : e.back;
    return 1 / Math.sqrt((l.x / ax) ** 2 + (l.y / ay) ** 2 + (l.z / az) ** 2);
  }
  const h = Math.hypot(l.x, l.z);
  if (h < 1e-3) return info.sec.xp;
  const nx = l.x / h;
  const nz = l.z / h;
  const ax = nx > 0 ? info.sec.xp : info.sec.xn;
  const bz = nz > 0 ? info.sec.zp : info.sec.zn;
  return 1 / Math.sqrt((nx / ax) ** 2 + (nz / bz) ** 2);
}

/** Lado de un anclaje (null en la línea media). */
export const anchorSide = (a: Anchor): Side | null => (a.startsWith("r_") ? "r" : a.startsWith("l_") ? "l" : null);

/**
 * Dirección anatómica en el mundo. Craneal, anterior y medial son las del tronco; en un miembro, si la
 * dirección cruza el segmento, se toma su componente perpendicular (el cajón anterior empuja la tibia
 * hacia su cara anterior aunque la rodilla esté doblada); si va casi a lo largo (tracción), se respeta.
 */
export function anatDir(pose: Pose3, d: Direction, anchor: Anchor, info: AnchorInfo): Vector3 {
  const q = pose.trunkQ;
  const s = anchorSide(anchor) ?? "r";
  const v = (() => {
    switch (d) {
      case "cranial":
        return new Vector3(0, 1, 0);
      case "caudal":
        return new Vector3(0, -1, 0);
      case "anterior":
        return new Vector3(0, 0, 1);
      case "posterior":
        return new Vector3(0, 0, -1);
      case "lateral":
        return new Vector3(sgn(s), 0, 0);
      case "medial":
        return new Vector3(-sgn(s), 0, 0);
    }
  })().applyQuaternion(q);
  if (info.limb) {
    const along = v.dot(info.axis);
    if (Math.abs(along) < 0.82) v.addScaledVector(info.axis, -along).normalize();
  }
  return v;
}

// ---------- Puntos de la superficie (para apoyar el cuerpo, encuadrar y separar al examinador) ----------

/** Muestras de la superficie de cada parte, en el mundo. */
export type Sample = { part: string; p: Vector3; /** Hacia fuera (aproximada; null si no se sabe). */ n: Vector3 | null };
export function surfaceSamples(pose: Pose3, parts?: (part: string) => boolean): Sample[] {
  const out: Sample[] = [];
  const ring = (part: string, c: Vector3, q: Quaternion, sec: Section, n = 8) => {
    if (parts && !parts(part)) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      const v = new Vector3(cx * (cx > 0 ? sec.xp : sec.xn), 0, cz * (cz > 0 ? sec.zp : sec.zn)).applyQuaternion(q);
      out.push({ part, p: c.clone().add(v), n: v.clone().normalize() });
    }
  };
  for (let y = -13; y <= 57; y += 5) {
    const f = spineAt(pose, y);
    ring("torso", f.p, f.q, torsoSection(y));
  }
  if (!parts || parts("head")) {
    for (const [y, a, zf, zb] of HEAD.filter((_, i) => i % 2 === 1)) {
      const c = pose.head.p.clone().add(new Vector3(0, y, (zf + zb) / 2).applyQuaternion(pose.head.q));
      ring("head", c, pose.head.q, { xp: a, xn: a, zp: (zf - zb) / 2, zn: (zf - zb) / 2 });
    }
    out.push({ part: "head", p: pose.head.p.clone().add(new Vector3(0, HEAD_EXT.up, -1).applyQuaternion(pose.head.q)), n: new Vector3(0, 1, 0).applyQuaternion(pose.head.q) });
  }
  for (const s of ["r", "l"] as const) {
    for (const n of ["upperarm", "forearm", "thigh", "shank"] as const) {
      const x = pose.seg[`${s}_${n}`];
      for (const t of [0.1, 0.5, 0.95]) {
        const c = x.p.clone().add(new Vector3(0, -LIMB[n].len * t, 0).applyQuaternion(x.q));
        ring(`${s}_${n}`, c, x.q, limbSection(n, s, t), 6);
      }
    }
    if (!parts || parts(`${s}_hand`)) {
      for (const t of [0.4, 0.95]) out.push({ part: `${s}_hand`, p: pose.seg[`${s}_hand`].p.clone().lerp(pose.pt[`${s}_handtip`]!, t), n: null });
    }
    if (!parts || parts(`${s}_foot`)) {
      const f = pose.seg[`${s}_foot`];
      for (const v of [new Vector3(0, -6.8, -4.5), new Vector3(-3.5, -6.8, 14), new Vector3(3.5, -6.8, 14), new Vector3(0, -6.5, 19), new Vector3(0, 2, -1)]) out.push({ part: `${s}_foot`, p: f.p.clone().add(v.applyQuaternion(f.q)), n: null });
    }
  }
  return out;
}
