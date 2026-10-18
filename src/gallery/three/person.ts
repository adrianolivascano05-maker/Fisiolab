// Persona 3D: paciente o examinador con formas humanas (tronco con pecho, cintura y glúteos, músculos de
// brazos y piernas que se doblan sin costuras en codos y rodillas, manos con dedos, pies con dedos, cara con
// ojos, cejas, nariz, labios, orejas y pelo con volumen) y ropa sencilla. El tronco, el cuello y los
// miembros se rehacen en cada pose siguiendo el esqueleto (rig.ts); manos, pies y cabeza son piezas rígidas.
import { BoxGeometry, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, SRGBColorSpace, Vector3 } from "three";
import { bendPoint, DEPRESSOR, FOOT, HAND_REST_CURL, HEAD, jawPoint, KNUCKLE_Y, LIMB, LIPS_Y, profileAt, sgn, spineAt, TORSO, type HandState, type Pose3, type Section, type Side } from "./rig";

export type Look = "patient" | "examiner";

const PALETTE = {
  patient: { skin: "#e6c2a3", palm: "#efd3bd", lip: "#c98676", hair: "#4a3426", top: "#d9b95a", bottom: "#0e3b2e", shoe: null as string | null, sole: "#e9e4da" },
  examiner: { skin: "#c4957a", palm: "#d9b29b", lip: "#a6665a", hair: "#221a16", top: "#1f6f54", bottom: "#185a44", shoe: "#2b2b2e", sole: "#e9e4da" },
};

type Ring = { y: number; sec: Section; xc?: number; zc?: number; e?: number; inflate?: number };
type Paint = (p: Vector3, ringIndex: number) => Color;
type Frame = { p: Vector3; q: Quaternion };

const sc = (c: number, e: number) => Math.sign(c) * Math.abs(c) ** (2 / e);
const g = (u: number) => Math.exp(-u * u);
/** 0 en a, 1 en b, con transición suave (a puede ser mayor que b). */
const ramp = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function ringPoint(r: Ring, a: number): [number, number] {
  const e = r.e ?? 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const k = r.inflate ?? 1;
  return [(r.xc ?? 0) + sc(c, e) * (c > 0 ? r.sec.xp : r.sec.xn) * k, (r.zc ?? 0) + sc(s, e) * (s > 0 ? r.sec.zp : r.sec.zn) * k];
}

/**
 * Malla de anillos de puntos (cada anillo, N puntos alrededor), cerrada en los extremos con un punto.
 * `dir`: si los anillos avanzan hacia +eje (1) o −eje (−1), para que las normales miren hacia fuera.
 * Cada anillo repite su primer punto al final (costura de la textura); `v`: coordenada de textura de cada anillo.
 */
function tube(rings: Vector3[][], caps: [Vector3, Vector3], paint: Paint, dir: number, v?: number[]): BufferGeometry {
  const N = rings[0]!.length;
  const M = N + 1;
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const put = (p: Vector3, i: number, u: number, vv: number) => {
    pos.push(p.x, p.y, p.z);
    const c = paint(p, i);
    col.push(c.r, c.g, c.b);
    uv.push(u, vv);
  };
  rings.forEach((r, i) => {
    for (let j = 0; j <= N; j++) put(r[j % N]!, i, j / N, v?.[i] ?? 0);
  });
  put(caps[0], 0, 0.5, v?.[0] ?? 0);
  put(caps[1], rings.length - 1, 0.5, v?.[rings.length - 1] ?? 0);
  const idx: number[] = [];
  const R = rings.length;
  const flip = dir < 0;
  const tri = (a: number, b: number, c: number) => (flip ? idx.push(a, c, b) : idx.push(a, b, c));
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < N; j++) {
      const a = i * M + j;
      const b = i * M + j + 1;
      const c = (i + 1) * M + j;
      const d = (i + 1) * M + j + 1;
      tri(a, c, b);
      tri(b, c, d);
    }
  }
  const p0 = R * M;
  const p1 = R * M + 1;
  for (let j = 0; j < N; j++) {
    tri(p0, j, j + 1);
    tri(p1, (R - 1) * M + j + 1, (R - 1) * M + j);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new Float32BufferAttribute(col, 3));
  geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  smoothNormals(geo, R, M);
  return geo;
}

/** Normales, iguales a los dos lados de la costura (si no, se ve una arista). */
function smoothNormals(geo: BufferGeometry, R: number, M: number) {
  geo.computeVertexNormals();
  const n = geo.attributes.normal as Float32BufferAttribute;
  const a = n.array as Float32Array;
  for (let i = 0; i < R; i++) {
    const p = i * M * 3;
    const q = (i * M + M - 1) * 3;
    for (let k = 0; k < 3; k++) a[p + k] = a[q + k] = (a[p + k]! + a[q + k]!) / 2;
  }
  for (let i = 0; i < R; i++) {
    const p = i * M * 3;
    const l = Math.hypot(a[p]!, a[p + 1]!, a[p + 2]!) || 1;
    for (let k = 0; k < 3; k++) a[p + k] = a[(i * M + M - 1) * 3 + k] = a[p + k]! / l;
  }
  n.needsUpdate = true;
}

/** Superficie barrida: anillos a lo largo de y (o de z con `alongZ`). */
function loft(rings: Ring[], N: number, paint: Paint, alongZ = false, capPad = 0.5, v?: number[]): BufferGeometry {
  const at = (x: number, y: number, z: number) => (alongZ ? new Vector3(-x, z, y) : new Vector3(x, y, z));
  const pts = rings.map((r) =>
    Array.from({ length: N }, (_, j) => {
      const [x, z] = ringPoint(r, (j / N) * Math.PI * 2);
      return at(x, r.y, z);
    }),
  );
  const first = rings[0]!;
  const last = rings[rings.length - 1]!;
  const dir = Math.sign(last.y - first.y);
  const caps: [Vector3, Vector3] = [at(first.xc ?? 0, first.y - dir * capPad, first.zc ?? 0), at(last.xc ?? 0, last.y + dir * capPad, last.zc ?? 0)];
  return tube(pts, caps, paint, alongZ ? -dir : dir, v);
}

/** Valores de t desde a hasta b con paso dado, más los cortes pedidos (dos anillos muy juntos en cada uno). */
function steps(a: number, b: number, step: number, cuts: number[] = []): number[] {
  const out: number[] = [];
  for (let t = a; t < b - 1e-6; t += step) out.push(t);
  out.push(b);
  for (const c of cuts) if (c > a && c < b) out.push(c - 0.004, c + 0.004);
  return [...new Set(out.map((v) => +v.toFixed(4)))].sort((x, y) => x - y);
}

const colorAttr = (geo: BufferGeometry, c: Color | ((p: Vector3) => Color)) => {
  const p = geo.attributes.position!;
  const v = new Vector3();
  const out: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const k = typeof c === "function" ? c(v.fromBufferAttribute(p, i)) : c;
    out.push(k.r, k.g, k.b);
  }
  geo.setAttribute("color", new Float32BufferAttribute(out, 3));
  return geo;
};

/**
 * Piel que se rehace en cada pose: anillos en reposo (x, z) que se colocan con el marco que toca a cada
 * uno (la columna en el tronco, la cadena hombro-codo-muñeca en el brazo...).
 */
class Skin {
  readonly mesh: Mesh;
  private readonly keys: number[];
  private readonly pts: [number, number][][];
  private readonly caps: { key: number; x: number; z: number }[];
  constructor(rings: Ring[], N: number, paint: Paint, mat: MeshStandardMaterial, capPad = 0.5, v?: number[]) {
    this.mesh = new Mesh(loft(rings, N, paint, false, capPad, v), mat);
    this.mesh.frustumCulled = false;
    this.keys = rings.map((r) => r.y);
    this.pts = rings.map((r) => Array.from({ length: N + 1 }, (_, j) => ringPoint(r, ((j % N) / N) * Math.PI * 2)));
    const first = rings[0]!;
    const last = rings[rings.length - 1]!;
    const dir = Math.sign(last.y - first.y);
    this.caps = [
      { key: first.y - dir * capPad, x: first.xc ?? 0, z: first.zc ?? 0 },
      { key: last.y + dir * capPad, x: last.xc ?? 0, z: last.zc ?? 0 },
    ];
  }

  place(frame: (key: number, out: Frame) => void) {
    const pos = this.mesh.geometry.attributes.position as Float32BufferAttribute;
    const arr = pos.array as Float32Array;
    const f: Frame = { p: new Vector3(), q: new Quaternion() };
    const v = new Vector3();
    let k = 0;
    const put = () => {
      v.applyQuaternion(f.q).add(f.p);
      arr[k++] = v.x;
      arr[k++] = v.y;
      arr[k++] = v.z;
    };
    this.keys.forEach((key, i) => {
      frame(key, f);
      for (const [x, z] of this.pts[i]!) {
        v.set(x, 0, z);
        put();
      }
    });
    for (const c of this.caps) {
      frame(c.key, f);
      v.set(c.x, 0, c.z);
      put();
    }
    pos.needsUpdate = true;
    const geo = this.mesh.geometry;
    smoothNormals(geo, this.keys.length, this.pts[0]!.length);
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
  }
}

/** Texturas pintadas una vez por sesión (cabeza y tronco de cada persona). */
const TEXTURES = new Map<string, CanvasTexture | null>();
function painted(key: string, w: number, h: number, fn: (u: number, v: number) => Color): CanvasTexture | null {
  if (TEXTURES.has(key)) return TEXTURES.get(key)!;
  let tex: CanvasTexture | null = null;
  try {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    if (ctx) {
      const img = ctx.createImageData(w, h);
      const rgb = { r: 0, g: 0, b: 0 };
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          fn((i + 0.5) / w, 1 - (j + 0.5) / h).getRGB(rgb, SRGBColorSpace);
          const o = (j * w + i) * 4;
          img.data[o] = Math.round(rgb.r * 255);
          img.data[o + 1] = Math.round(rgb.g * 255);
          img.data[o + 2] = Math.round(rgb.b * 255);
          img.data[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      tex = new CanvasTexture(cv);
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = 4;
    }
  } catch {
    tex = null;
  }
  TEXTURES.set(key, tex);
  return tex;
}

type Cloth = { top: Color; bottom: Color; skin: Color; palm: Color; lip: Color; hair: Color; shoe: Color | null; sole: Color; sleeve: number; legCut: number; look: Look };
type LimbName = "upperarm" | "forearm" | "thigh" | "shank";

function limbRings(seg: LimbName, s: Side, cl: Cloth): { rings: Ring[]; paint: Paint } {
  const L = LIMB[seg];
  const t0 = L.rings[0]![0];
  const t1 = L.rings[L.rings.length - 1]![0];
  const cut = seg === "upperarm" ? cl.sleeve : seg === "thigh" ? cl.legCut : -1;
  const covered = (t: number) => (seg === "upperarm" ? t < cl.sleeve : seg === "thigh" ? t < cl.legCut : seg === "shank" ? cl.legCut > 1 : false);
  const ts = steps(t0, t1, 1 / L.len, cut > 0 && cut < 1 ? [cut] : []);
  const rings: Ring[] = ts.map((t) => {
    const [lat, med, ant, post] = profileAt(L.rings, t) as [number, number, number, number];
    const sec = s === "l" ? { xp: lat, xn: med, zp: ant, zn: post } : { xp: med, xn: lat, zp: ant, zn: post };
    return { y: -t * L.len, sec, inflate: covered(t) ? (seg === "upperarm" ? 1.035 : 1.04) : 1 };
  });
  const color = seg === "upperarm" ? cl.top : cl.bottom;
  return { rings, paint: (_p, i) => (covered(ts[i]!) ? color : cl.skin) };
}

/** Cómo se dobla cada articulación: ancho de la zona que se curva (cm a cada lado). */
const BEND = { elbow: 4.5, knee: 6, wrist: 2.4, ankle: 3.2 };

/** Parte de giro de q alrededor de y quitada: solo la flexión (para curvar la muñeca sin retorcerla). */
function swingOnly(parent: Quaternion, child: Quaternion): Quaternion {
  const rel = parent.clone().invert().multiply(child);
  const tw = new Quaternion(0, rel.y, 0, rel.w);
  if (tw.lengthSq() < 1e-9) return child.clone();
  tw.normalize();
  return parent.clone().multiply(rel.multiply(tw.invert()));
}

/**
 * Marco a lo largo de un brazo o una pierna (x: cm desde el hombro o la cadera). Rígido en cada segmento;
 * cerca del codo, la rodilla, la muñeca y el tobillo gira poco a poco del segmento de arriba al de abajo,
 * para que la piel se doble sin costura.
 */
function chainFrame(pose: Pose3, s: Side, arm: boolean, x: number, out: Frame) {
  const up = pose.seg[`${s}_${arm ? "upperarm" : "thigh"}`];
  const lo = pose.seg[`${s}_${arm ? "forearm" : "shank"}`];
  const end = pose.seg[`${s}_${arm ? "hand" : "foot"}`];
  const L1 = LIMB[arm ? "upperarm" : "thigh"].len;
  const L2 = LIMB[arm ? "forearm" : "shank"].len;
  const w = arm ? BEND.elbow : BEND.knee;
  const k = ramp(L1 - w, L1 + w, x);
  const E1 = new Vector3(0, -L1, 0).applyQuaternion(up.q).add(up.p);
  const gap = lo.p.clone().sub(E1);
  if (x <= L1) out.p.set(0, -x, 0).applyQuaternion(up.q).add(up.p).addScaledVector(gap, k);
  else out.p.set(0, -(x - L1), 0).applyQuaternion(lo.q).add(lo.p).addScaledVector(gap, k - 1);
  out.q.copy(up.q).slerp(lo.q, k);
  // Hombro: lo más alto del deltoides sigue en parte al tronco (no asoma como una hombrera al levantar el brazo).
  if (arm && x < 6) out.q.copy(pose.trunkQ).slerp(up.q, 0.45 + 0.55 * ramp(-3, 6, x));
  const wd = arm ? BEND.wrist : BEND.ankle;
  const k2 = ramp(L1 + L2 - wd, L1 + L2 + wd, x);
  if (k2 > 0) {
    const E2 = new Vector3(0, -L2, 0).applyQuaternion(lo.q).add(lo.p);
    out.p.addScaledVector(end.p.clone().sub(E2), k2);
    out.q.slerp(swingOnly(lo.q, end.q), k2 * 0.5);
  }
}

// ---------- Manos ----------

/** Dedos: [lado del pulgar (+) o del meñique (−), largo desde el nudillo, radio, separación en grados]. */
const FINGERS: [number, number, number, number][] = [
  [2.9, 8.5, 0.95, -3],
  [0.95, 9.4, 0.98, 0],
  [-1.0, 8.9, 0.92, 2.5],
  [-2.85, 7.0, 0.8, 6],
];
/** Curvatura de cada dedo respecto a la de la mano (relajada: el meñique más doblado). */
const FINGER_CURL: Record<HandState["grip"], number[]> = {
  rest: [1.05, 1, 0.9, 0.78],
  press: [1, 1, 1, 1],
  grasp: [1, 1, 1, 1],
  tips: [1, 1, 0.94, 0.86],
};

type HandParts = { group: Group; mesh: Mesh; rest: Float32Array; finger: Int8Array; thumb: Mesh; state: string };

function handParts(s: Side, cl: Cloth, mat: MeshStandardMaterial): HandParts {
  // Palma hacia +z, dedos hacia −y (se doblan con setHand), pulgar en el lado radial (r·x).
  const r = sgn(s);
  const palmRows: [number, number, number, number][] = [
    [1.8, 2.2, 1.2, -1.3],
    [0.6, 2.6, 1.5, -1.6],
    [-0.8, 3.1, 1.8, -1.8],
    [-3.5, 3.9, 2.0, -1.6],
    [-6.5, 4.2, 1.75, -1.4],
    [-8.6, 4.2, 1.35, -1.25],
    [-9.9, 3.8, 0.95, -1.0],
  ];
  const ys = steps(-9.9, 1.8, 0.55).reverse();
  const palmRings: Ring[] = ys.map((y) => {
    const [a, zf, zb] = profileAt([...palmRows].reverse(), y) as [number, number, number];
    return { y, sec: { xp: a, xn: a, zp: (zf - zb) / 2, zn: (zf - zb) / 2 }, zc: (zf + zb) / 2, e: 2.6 };
  });
  const tone = (p: Vector3, fingerTip?: number) => {
    // Palma y yemas más claras; uñas en el dorso de la punta de los dedos.
    if (fingerTip !== undefined && p.y < fingerTip + 1.25 && p.z < -0.2) return cl.skin.clone().lerp(new Color("#f3dcd2"), 0.45);
    return p.z > 0.55 ? cl.palm : cl.skin;
  };
  const geos: { geo: BufferGeometry; finger: number }[] = [{ geo: loft(palmRings, 22, (p) => tone(p)), finger: -1 }];
  FINGERS.forEach(([x0, len, r0, spread], fi) => {
    const tip = KNUCKLE_Y - len;
    const rows: [number, number][] = [
      [KNUCKLE_Y + 0.9, r0 * 1.05],
      [KNUCKLE_Y, r0 * 1.08],
      [KNUCKLE_Y - 1.2, r0],
      [KNUCKLE_Y - 0.45 * len, r0 * 0.95],
      [KNUCKLE_Y - 0.75 * len, r0 * 0.87],
      [tip + 0.7, r0 * 0.82],
      [tip + 0.2, r0 * 0.55],
      [tip, r0 * 0.12],
    ];
    const tan = Math.tan((spread * Math.PI) / 180);
    const fy = steps(tip, KNUCKLE_Y + 0.9, 0.5).reverse();
    const rings: Ring[] = fy.map((y) => {
      const rr = profileAt([...rows].reverse(), y)[0]!;
      return { y, sec: { xp: rr, xn: rr, zp: rr * 0.88, zn: rr * 0.88 }, xc: r * (x0 + Math.max(0, KNUCKLE_Y - y) * tan), zc: -0.1 };
    });
    geos.push({ geo: loft(rings, 12, (p) => tone(p, tip), false, 0.05), finger: fi });
  });
  // Eminencia hipotenar (la tenar va con el pulgar).
  for (const [p, k] of [[new Vector3(-r * 2.7, -4.8, 0.6), new Vector3(1.2, 2.5, 0.85)]] as const) {
    const sph = new SphereGeometry(1, 14, 10);
    sph.applyMatrix4(new Matrix4().makeScale(k.x, k.y, k.z).setPosition(p));
    geos.push({ geo: colorAttr(sph, cl.palm), finger: -1 });
  }
  const geo = merge(geos.map((x) => x.geo));
  const finger = new Int8Array(geo.attributes.position!.count);
  let o = 0;
  for (const x of geos) {
    const n = x.geo.attributes.position!.count;
    finger.fill(x.finger, o, o + n);
    o += n;
  }
  const rest = Float32Array.from((geo.attributes.position as Float32BufferAttribute).array as Float32Array);
  const group = new Group();
  const mesh = new Mesh(geo, mat);
  // Pulgar: tubo que sale de la eminencia tenar; se orienta según la toma.
  // Desde la base del primer metacarpiano (dentro de la eminencia tenar) hasta la punta.
  const thumbRows: [number, number][] = [
    [1.0, 0.5],
    [0.3, 1.25],
    [-1.2, 1.6],
    [-3.0, 1.5],
    [-4.6, 1.22],
    [-5.6, 1.12],
    [-7.6, 0.98],
    [-9.1, 0.84],
    [-9.65, 0.52],
    [-9.85, 0.1],
  ];
  const thumbRings: Ring[] = steps(-9.85, 1.0, 0.45)
    .reverse()
    .map((y) => {
      const rr = profileAt([...thumbRows].reverse(), y)[0]!;
      return { y, sec: { xp: rr, xn: rr, zp: rr * 0.85, zn: rr * 0.85 } };
    });
  const thumb = new Mesh(loft(thumbRings, 14, (p) => tone(p, -9.85), false, 0.05), mat);
  group.add(mesh, thumb);
  const parts: HandParts = { group, mesh, rest, finger, thumb, state: "" };
  setHand(parts, s, { curl: HAND_REST_CURL, grip: "rest" });
  return parts;
}

/** Une varias geometrías con posición y color (indexadas). */
function merge(geos: BufferGeometry[]): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  let o = 0;
  for (const g0 of geos) {
    const p = g0.attributes.position!;
    const c = g0.attributes.color!;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      col.push(c.getX(i), c.getY(i), c.getZ(i));
    }
    const ix = g0.index;
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + o);
    else for (let i = 0; i < p.count; i++) idx.push(i + o);
    o += p.count;
    g0.dispose();
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const basis = (x: Vector3, y: Vector3, z: Vector3) => new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));

/** Dónde nace el pulgar y hacia dónde va en cada toma (mano izquierda; la derecha, en espejo). */
function thumbPose(grip: HandState["grip"], curl: number): { base: Vector3; dir: Vector3 } {
  switch (grip) {
    case "press":
      return { base: new Vector3(2.4, -1.2, 0.4), dir: new Vector3(0.42, -0.9, 0.1) };
    case "tips":
      return { base: new Vector3(2.4, -1.2, 0.6), dir: new Vector3(0.1, -0.8, 0.58) };
    case "grasp": {
      // Por el otro lado del segmento que abarcan los dedos: tangente a su contorno.
      const B = new Vector3(2.4, -1.2, 0.8);
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

/** Dobla los dedos (radio `curl`) y coloca el pulgar según la toma. */
function setHand(h: HandParts, s: Side, st: HandState) {
  const key = `${st.curl.toFixed(1)}|${st.grip}`;
  if (key === h.state) return;
  h.state = key;
  const pos = h.mesh.geometry.attributes.position as Float32BufferAttribute;
  const arr = pos.array as Float32Array;
  const fac = FINGER_CURL[st.grip];
  for (let i = 0; i < pos.count; i++) {
    const f = h.finger[i]!;
    const [y, z] = bendPoint(h.rest[i * 3 + 1]!, h.rest[i * 3 + 2]!, st.curl * (f < 0 ? 1 : fac[f]!));
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
  }
  pos.needsUpdate = true;
  h.mesh.geometry.computeVertexNormals();
  h.mesh.geometry.computeBoundingSphere();
  const r = sgn(s);
  const t = thumbPose(st.grip, st.curl);
  const dir = new Vector3(r * t.dir.x, t.dir.y, t.dir.z).normalize();
  const y = dir.clone().negate();
  // La yema mira a los dedos (hacia la palma y el lado cubital).
  const z = new Vector3(-r * 0.7, 0, 0.7);
  z.addScaledVector(y, -z.dot(y)).normalize();
  h.thumb.quaternion.copy(basis(new Vector3().crossVectors(y, z), y, z));
  h.thumb.position.set(r * t.base.x, t.base.y, t.base.z);
}

// ---------- Pies ----------

function footGeometry(s: Side, cl: Cloth): BufferGeometry {
  const shod = !!cl.shoe;
  // Calzado: la horma entera (FOOT) con suela clara. Descalzo: el pie hasta los metatarsianos y los dedos aparte.
  const rows: [number, number, number, number][] = shod
    ? FOOT
    : [...FOOT.filter((r) => r[0] <= 13.5), [14.8, 4.35, -4.2, -6.9], [15.7, 3.4, -4.6, -6.6], [16.1, 1.6, -5.0, -6.2]];
  const z0 = rows[0]![0];
  const z1 = rows[rows.length - 1]![0];
  const zs = steps(z0, z1, 0.8);
  const rings: Ring[] = zs.map((z) => {
    const [a, top, bot] = profileAt(rows, z) as [number, number, number];
    return { y: z, sec: { xp: a, xn: a, zp: (top - bot) / 2, zn: (top - bot) / 2 }, zc: (top + bot) / 2, e: 2.4, inflate: shod ? 1.07 : 1 };
  });
  const body = loft(rings, 22, (p) => (shod ? (p.y < -6.3 ? cl.sole : cl.shoe!) : cl.skin), true, 0.4);
  if (shod) return body;
  // Dedos: [hacia medial, inicio, punta, radio]; el gordo, más grueso.
  const med = -sgn(s);
  const toes: [number, number, number, number][] = [
    [2.35, 13.6, 20.0, 1.3],
    [0.55, 14.4, 19.2, 0.82],
    [-0.95, 14.2, 18.5, 0.76],
    [-2.3, 13.8, 17.5, 0.7],
    [-3.45, 13.2, 16.3, 0.62],
  ];
  const parts = [body];
  for (const [mx, za, zb, rr] of toes) {
    const zr = steps(za, zb, 0.45);
    const tRings: Ring[] = zr.map((z) => {
      const u = (z - za) / (zb - za);
      const k = u < 0.75 ? 1 - 0.12 * u : Math.sqrt(Math.max(0, 1 - ((u - 0.75) / 0.25) ** 2)) * 0.9 + 0.02;
      const rad = rr * k;
      return { y: z, sec: { xp: rad, xn: rad, zp: rad * 0.8, zn: rad * 0.8 }, xc: -med * mx, zc: -7 + rr * 0.8 + 0.05 - 0.25 * u * u };
    });
    parts.push(loft(tRings, 10, (p) => (p.z > zb - 1.2 && p.y > -7 + rr * 1.15 ? cl.skin.clone().lerp(new Color("#f3dcd2"), 0.4) : cl.skin), true, 0.05));
  }
  return merge(parts);
}

// ---------- Cabeza ----------

const HEAD_N = 128;
/** Perfil de la cabeza a una altura (se repite mucho al pintar la textura: se recuerda la última). */
let lastRow: { y: number; v: [number, number, number] } = { y: NaN, v: [0, 0, 0] };
function headRow(y: number): [number, number, number] {
  if (y !== lastRow.y) lastRow = { y, v: profileAt(HEAD, y) as [number, number, number] };
  return lastRow.v;
}
const headE = (s: number) => (s > 0 ? 2.2 : 2.1);

/** Rasgos de la cara: cuánto sale (+) o se hunde (−) la piel en ese punto de la cabeza. */
function relief(x: number, y: number, z: number): number {
  const front = ramp(0.5, 4.5, z);
  if (front <= 0) return 0;
  const ax = Math.abs(x);
  let d = 0;
  d -= 0.55 * g((ax - 3.1) / 1.5) * g((y - 1.25) / 1.0); // cuencas de los ojos
  d += 0.3 * g((y - 3.35) / 0.75) * g((ax - 2.3) / 2.6); // arco de las cejas
  d += 0.38 * g((ax - 5.1) / 1.3) * g((y + 0.9) / 1.4); // pómulos
  d -= 0.2 * g((ax - 4.7) / 1.2) * g((y + 4.4) / 1.3); // mejillas
  d += 0.16 * g(ax / 2.0) * g((y - LIPS_Y - 0.65) / 0.45); // labio superior
  d += 0.2 * g(ax / 1.8) * g((y - LIPS_Y + 0.75) / 0.5); // labio inferior
  d -= 0.18 * g(ax / 2.2) * g((y - LIPS_Y + 2.0) / 0.5); // surco del mentón
  d += 0.42 * g(ax / 2.1) * g((y + 10.2) / 0.9); // mentón
  d -= 0.28 * g((ax - 6.7) / 1.1) * g((y - 4.6) / 1.8); // sienes
  return d * front;
}

/** Punto de la piel de la cabeza (en reposo) a la altura y y el ángulo a (90° = delante). */
function headPoint(y: number, a: number): Vector3 {
  const [w, zf, zb] = headRow(y);
  const zc = (zf + zb) / 2;
  const sz = (zf - zb) / 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const e = headE(s);
  const x = sc(c, e) * w;
  const z = zc + sc(s, e) * sz;
  const n = new Vector3(x / (w * w), 0, (z - zc) / (sz * sz)).normalize();
  return new Vector3(x, y, z).addScaledVector(n, relief(x, y, z));
}

/** Superficie de la cara en (x, y), por delante. */
function faceAt(x: number, y: number): Vector3 {
  const [w, zf, zb] = headRow(y);
  const u = Math.min(0.999, Math.abs(x) / w);
  const e = headE(1);
  const z = (zf + zb) / 2 + ((zf - zb) / 2) * (1 - u ** e) ** (1 / e);
  return new Vector3(x, y, z + relief(x, y, z));
}

/** Línea del pelo: altura según el ángulo desde delante (0) hasta la nuca (180). */
const HAIRLINE: Record<Look, [number, number][]> = {
  patient: [
    [0, 8.3],
    [28, 7.9],
    [50, 6.1],
    [63, 3.0],
    [73, -0.4],
    [80, -1.0],
    [85, 2.2],
    [106, 2.6],
    [120, -1.6],
    [145, -4.6],
    [180, -6.0],
  ],
  examiner: [
    [0, 7.9],
    [22, 8.1],
    [48, 5.9],
    [63, 2.9],
    [73, -0.2],
    [80, -0.8],
    [85, 2.2],
    [106, 2.6],
    [120, -1.4],
    [145, -4.3],
    [180, -5.6],
  ],
};

/** Línea del pelo tabulada cada medio grado (se consulta muchas veces al pintar). */
const HAIR_TABLE = new Map<Look, Float32Array>();
function hairline(look: Look, phi: number) {
  let t = HAIR_TABLE.get(look);
  if (!t) {
    t = Float32Array.from({ length: 361 }, (_, i) => profileAt(HAIRLINE[look], i / 2)[0]!);
    HAIR_TABLE.set(look, t);
  }
  const f = Math.min(359.999, Math.max(0, phi * 2));
  const i = Math.floor(f);
  return t[i]! + (t[i + 1]! - t[i]!) * (f - i);
}

/** Pelo en un punto de la cabeza: cuánto abulta y cuánto color de pelo lleva (0-1). */
function hairAt(p: Vector3, look: Look): { h: number; c: number } {
  const [, zf, zb] = headRow(p.y);
  const phi = (Math.atan2(Math.abs(p.x), p.z - (zf + zb) / 2) * 180) / Math.PI;
  // Simétrica en la línea media (delante y en la nuca).
  const lineAt = (f: number) => hairline(look, f < 0 ? -f : f > 180 ? 360 - f : f);
  const line = lineAt(phi);
  // Distancia a la línea medida en perpendicular a ella (en las patillas la línea es casi vertical).
  const R = Math.max(2, Math.hypot(p.x, p.z - (zf + zb) / 2));
  const slope = (lineAt(phi + 1) - lineAt(phi - 1)) / 2 / ((R * Math.PI) / 180);
  const above = (p.y - line) / Math.sqrt(1 + slope * slope);
  const full = look === "patient" ? 1.0 + 0.35 * ramp(4, 10, p.y) : 0.7 + 0.25 * ramp(5, 10, p.y);
  return { h: full * ramp(-0.3, 2.2, above), c: ramp(-0.45, 0.35, above) };
}

/** Normal aproximada del cráneo (para dar volumen al pelo). */
const skullNormal = (p: Vector3) => new Vector3(p.x / 59, (p.y - 0.5) / 156, (p.z + 0.3) / 92).normalize();

/** Cejas: trazo arqueado [x desde la línea media, y, grosor]. */
const BROW: [number, number, number][] = [
  [1.3, 3.3, 0.25],
  [2.3, 3.55, 0.24],
  [3.3, 3.62, 0.19],
  [4.2, 3.5, 0.15],
  [4.9, 3.2, 0.09],
];

/** Color de la piel de la cara y del pelo en un punto de la cabeza (en reposo). */
function headColor(p: Vector3, cl: Cloth): Color {
  const front = ramp(1, 5, p.z);
  const ax = Math.abs(p.x);
  const lip = Math.min(1, g(ax / 2.0) * (g((p.y - LIPS_Y - 0.6) / 0.42) + g((p.y - LIPS_Y + 0.72) / 0.48))) * front;
  const ch = 0.15 * g((ax - 4.4) / 1.5) * g((p.y + 2.5) / 1.7) * front;
  const out = cl.skin.clone().lerp(new Color("#d98c7e"), ch).lerp(cl.lip, lip * 0.5);
  if (p.z > 3) {
    let d = Infinity;
    for (let i = 0; i < BROW.length - 1; i++) {
      const [x0, y0, w0] = BROW[i]!;
      const [x1, y1, w1] = BROW[i + 1]!;
      const t = Math.min(1, Math.max(0, ((ax - x0) * (x1 - x0) + (p.y - y0) * (y1 - y0)) / ((x1 - x0) ** 2 + (y1 - y0) ** 2)));
      d = Math.min(d, Math.hypot(ax - x0 - t * (x1 - x0), p.y - y0 - t * (y1 - y0)) - (w0 + t * (w1 - w0)));
    }
    out.lerp(cl.hair, 0.85 * ramp(0.06, -0.06, d));
  }
  const hair = cl.hair.clone().lerp(new Color("#ffffff"), 0.05 * ramp(8, 13, p.y));
  return out.lerp(hair, hairAt(p, cl.look).c);
}

function headGeometry(cl: Cloth): { geo: BufferGeometry; map: CanvasTexture | null } {
  const y0 = HEAD[0]![0];
  const y1 = HEAD[HEAD.length - 1]![0];
  // Anillos más juntos en la coronilla, donde la cabeza se cierra deprisa.
  const ys = [...new Set([...steps(y0, 11, 0.3), ...steps(11, y1, 0.1)])];
  const rings = ys.map((y) => Array.from({ length: HEAD_N }, (_, j) => headPoint(y, (j / HEAD_N) * Math.PI * 2)));
  const capB = new Vector3(0, y0 - 0.4, (HEAD[0]![2] + HEAD[0]![3]) / 2);
  const last = HEAD[HEAD.length - 1]!;
  const capT = new Vector3(0, y1 + 0.12, (last[2] + last[3]) / 2);
  // Colores en una textura (bordes limpios en el pelo, las cejas y los labios).
  const map = painted(`head-${cl.look}`, 384, 192, (u, v) => headColor(headPoint(y0 + v * (y1 - y0), u * Math.PI * 2), cl));
  // El pelo abulta sobre la piel (la misma malla, sin costura en la línea del pelo).
  const rest = new Map<Vector3, Vector3>();
  const grow = (p: Vector3) => {
    const q = p.clone().addScaledVector(skullNormal(p), hairAt(p, cl.look).h);
    rest.set(q, p);
    return q;
  };
  const white = new Color(1, 1, 1);
  const geo = tube(
    rings.map((r) => r.map(grow)),
    [grow(capB), grow(capT)],
    (p) => (map ? white : headColor(rest.get(p) ?? p, cl)),
    1,
    ys.map((y) => (y - y0) / (y1 - y0)),
  );
  return { geo, map };
}

function noseGeometry(skin: Color): BufferGeometry {
  // [y, semiancho, cuánto sale de la cara]
  const rows: [number, number, number][] = [
    [2.4, 0.55, 0.1],
    [1.0, 0.55, 0.42],
    [-0.5, 0.62, 0.85],
    [-2.0, 0.8, 1.35],
    [-3.0, 1.05, 1.72],
    [-3.6, 1.38, 1.75],
    [-4.1, 1.48, 1.3],
    [-4.4, 1.2, 0.65],
    [-4.55, 0.7, 0.2],
  ];
  const rv = [...rows].reverse();
  const rings: Ring[] = steps(-4.55, 2.4, 0.25)
    .reverse()
    .map((y) => {
      const [hw, pr] = profileAt(rv, y) as [number, number];
      const z0 = faceAt(0, y).z;
      return { y, sec: { xp: hw, xn: hw, zp: pr / 2 + 0.4, zn: pr / 2 + 0.4 }, zc: z0 + pr / 2 - 0.4, e: 2.2 };
    });
  return loft(rings, 18, () => skin, false, 0.15);
}

function sphereAt(c: Color, r: number, p: Vector3, k: Vector3, wSeg = 16, hSeg = 12): BufferGeometry {
  const geo = new SphereGeometry(r, wSeg, hSeg);
  geo.applyMatrix4(new Matrix4().makeScale(k.x, k.y, k.z).setPosition(p));
  return colorAttr(geo, c);
}

export class Person {
  readonly group = new Group();
  /** Mallas con la parte del cuerpo que representan (para saber qué tapa qué). */
  readonly parts = new Map<Object3D, string>();
  private readonly mat: MeshStandardMaterial;
  private readonly torsoMat: MeshStandardMaterial;
  private readonly headMat: MeshStandardMaterial;
  private readonly torso: Skin;
  private readonly neck: Skin;
  private readonly limbs: { skin: Skin; s: Side; arm: boolean; off: number }[] = [];
  private readonly ends = {} as Record<`${Side}_${"hand" | "foot"}`, Object3D>;
  private readonly head: Object3D;
  private readonly headMesh: Mesh;
  private readonly headRest: Float32Array;
  private readonly jawW: Float32Array;
  private readonly lipUp: Vector3;
  private readonly lipLow: Vector3;
  private readonly mouth: Mesh;
  private readonly teeth: Mesh[];
  private jaw = NaN;
  private readonly handsParts = {} as Record<Side, HandParts>;

  constructor(readonly look: Look) {
    const P = PALETTE[look];
    const cl: Cloth = {
      skin: new Color(P.skin),
      palm: new Color(P.palm),
      lip: new Color(P.lip),
      hair: new Color(P.hair),
      top: new Color(P.top),
      bottom: new Color(P.bottom),
      shoe: P.shoe ? new Color(P.shoe) : null,
      sole: new Color(P.sole),
      sleeve: look === "patient" ? 0.36 : 0.42,
      legCut: look === "patient" ? 0.4 : 2,
      look,
    };
    this.mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
    const mat = this.mat;
    const add = <T extends Object3D>(o: T, part: string, parent: Object3D = this.group): T => {
      parent.add(o);
      o.traverse((c) => {
        if (c instanceof Mesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          this.parts.set(c, part);
        }
      });
      return o;
    };

    // Tronco: se rehace en cada pose siguiendo la columna.
    const neckline = 52.5;
    const waist = look === "patient" ? 14 : 8;
    const ys = [...new Set([...steps(TORSO[0]![0], 46, 0.9, [waist]), ...steps(46, TORSO[TORSO.length - 1]![0], 0.35)])];
    const rings: Ring[] = ys.map((y) => {
      const [a, ant, post] = profileAt(TORSO, y) as [number, number, number];
      return { y, sec: { xp: a, xn: a, zp: ant, zn: post }, e: 2.35, inflate: y < neckline ? 1.012 : 1 };
    });
    // Escote redondo en el paciente y de pico en el pijama del examinador, con su ribete; bajo de la
    // camiseta y cinturilla; bolsillo del pijama.
    const neckD = (p: Vector3) => {
      if (p.y < 44) return Infinity;
      const c = p.z > -0.8 ? 8.2 : 6.6;
      const round = p.y > 50.5 ? (Math.sqrt((p.x / 9) ** 2 + ((p.z + 0.8) / c) ** 2) - 1) * 7.5 : Infinity;
      const vee = look === "examiner" && p.z > 2 ? (Math.abs(p.x) - (1.2 + (p.y - 45.5) * 0.85)) * 0.76 : Infinity;
      return Math.min(round, vee);
    };
    const torsoColor = (p: Vector3) => {
      if (p.y < waist) return cl.bottom.clone().multiplyScalar(p.y > waist - 2.2 ? 0.84 : 1);
      const top = cl.top.clone();
      if (p.y < waist + 1.3) top.multiplyScalar(0.9);
      if (look === "examiner" && p.z > 4 && Math.abs(p.x - 7) < 3.6 && p.y > 31 && p.y < 38.5) {
        const edge = Math.min(3.6 - Math.abs(p.x - 7), p.y - 31, 38.5 - p.y);
        if (edge < 0.25 || (p.y > 37.6 && p.y < 37.9)) top.multiplyScalar(0.84);
      }
      const d = p.y > neckline + 3 ? -1 : neckD(p);
      if (d < 0.9) top.multiplyScalar(0.86);
      return top.lerp(cl.skin, ramp(0.06, -0.06, d));
    };
    const ty0 = ys[0]!;
    const ty1 = ys[ys.length - 1]!;
    let row = { y: NaN, v: [0, 0, 0] };
    const tmap = painted(`torso-${look}`, 384, 256, (u, v) => {
      const y = ty0 + v * (ty1 - ty0);
      if (y !== row.y) row = { y, v: profileAt(TORSO, y) };
      const [a, ant, post] = row.v as [number, number, number];
      const [x, z] = ringPoint({ y, sec: { xp: a, xn: a, zp: ant, zn: post }, e: 2.35 }, u * Math.PI * 2);
      return torsoColor(new Vector3(x, y, z));
    });
    const white = new Color(1, 1, 1);
    this.torsoMat = tmap ? new MeshStandardMaterial({ map: tmap, roughness: 0.86, metalness: 0 }) : mat;
    this.torso = new Skin(rings, 48, (p) => (tmap ? white : torsoColor(p)), this.torsoMat, 0.5, ys.map((y) => (y - ty0) / (ty1 - ty0)));
    add(this.torso.mesh, "torso");

    // Cuello: ancho abajo (trapecios y esternocleidomastoideos), se mete bajo la mandíbula.
    const neckRows: [number, number, number, number][] = [
      [-4, 8.0, 5.0, 5.3],
      [-1.5, 6.4, 4.9, 5.6],
      [1.5, 5.3, 4.8, 5.4],
      [5, 5.0, 4.7, 5.1],
      [8, 5.0, 4.4, 4.9],
      [10.5, 5.2, 3.4, 4.2],
    ];
    const neckRings: Ring[] = steps(-4, 10.5, 0.8).map((y) => {
      const [a, f, b] = profileAt(neckRows, y) as [number, number, number];
      return { y, sec: { xp: a, xn: a, zp: f, zn: b }, zc: 0.3 + 0.13 * Math.max(0, y) };
    });
    this.neck = new Skin(neckRings, 24, () => cl.skin, mat);
    add(this.neck.mesh, "neck");

    // Cabeza: piel con los rasgos, pelo con volumen, ojos, cejas, nariz, orejas y boca que se abre.
    const head = new Group();
    const hg = headGeometry(cl);
    this.headMat = hg.map ? new MeshStandardMaterial({ map: hg.map, roughness: 0.72, metalness: 0 }) : mat;
    this.headMesh = new Mesh(hg.geo, this.headMat);
    head.add(this.headMesh);
    const hp = this.headMesh.geometry.attributes.position as Float32BufferAttribute;
    this.headRest = Float32Array.from(hp.array as Float32Array);
    // La parte baja de la cara gira con la mandíbula: peso 0 por encima de los labios, 1 por debajo.
    this.jawW = new Float32Array(hp.count);
    for (let i = 0; i < hp.count; i++) this.jawW[i] = ramp(LIPS_Y + 0.25, LIPS_Y - 0.55, hp.getY(i)) * ramp(-2, 3, hp.getZ(i));
    this.lipUp = faceAt(0, LIPS_Y + 0.15);
    this.lipLow = faceAt(0, LIPS_Y - 0.35);
    const sphere = (c: string) => new Mesh(colorAttr(new SphereGeometry(1, 18, 12), new Color(c)), mat);
    this.mouth = sphere("#4a2224");
    this.teeth = [sphere("#f2ede4"), sphere("#f2ede4")];
    head.add(this.mouth, ...this.teeth);
    const feat: BufferGeometry[] = [noseGeometry(cl.skin)];
    const lidC = cl.skin.clone().multiplyScalar(0.96);
    for (const x of [-1, 1]) {
      // Ojo: globo blanco, iris oscuro y párpados de piel.
      const c = faceAt(x * 3.1, 1.25);
      const eye = new Vector3(x * 3.1, 1.25, c.z - 0.72);
      feat.push(sphereAt(new Color("#f1ece4"), 1.05, eye, new Vector3(1.38, 0.86, 1)));
      feat.push(sphereAt(new Color("#3a2a21"), 0.55, eye.clone().add(new Vector3(-x * 0.05, -0.03, 1.02)), new Vector3(1, 1, 0.3), 14, 10));
      feat.push(sphereAt(lidC, 1.08, eye.clone().add(new Vector3(0, 0.44, 0.06)), new Vector3(1.42, 0.6, 1)));
      feat.push(sphereAt(lidC, 1.06, eye.clone().add(new Vector3(0, -0.56, 0.02)), new Vector3(1.36, 0.42, 1)));
      // Oreja con su concha.
      feat.push(sphereAt(cl.skin, 1, new Vector3(x * 7.25, -0.5, -0.8), new Vector3(0.62, 2.6, 1.5)));
      feat.push(sphereAt(cl.skin.clone().multiplyScalar(0.88), 1, new Vector3(x * 7.6, -0.7, -0.55), new Vector3(0.3, 1.45, 0.85), 10, 8));
    }
    head.add(new Mesh(merge(feat), mat));
    this.head = add(head, "head");
    this.setJaw(0);

    // Brazos y piernas (piel continua de hombro a muñeca y de cadera a tobillo), manos y pies.
    for (const s of ["r", "l"] as const) {
      for (const n of ["upperarm", "forearm", "thigh", "shank"] as const) {
        const { rings: lr, paint } = limbRings(n, s, cl);
        const skin = new Skin(lr, 22, paint, mat);
        const arm = n === "upperarm" || n === "forearm";
        this.limbs.push({ skin, s, arm, off: n === "forearm" ? LIMB.upperarm.len : n === "shank" ? LIMB.thigh.len : 0 });
        add(skin.mesh, `${s}_${n}`);
      }
      const hand = new Group();
      const hp2 = handParts(s, cl, mat);
      this.handsParts[s] = hp2;
      // Mano algo girada hacia el cuerpo en el paciente (más natural que la palma de frente).
      hp2.group.rotation.y = look === "patient" ? -sgn(s) * 0.7 : 0;
      hand.add(hp2.group);
      this.ends[`${s}_hand`] = add(hand, `${s}_hand`);
      this.ends[`${s}_foot`] = add(new Mesh(footGeometry(s, cl), mat), `${s}_foot`);
    }
  }

  /** Coloca todas las piezas en la pose. */
  apply(pose: Pose3) {
    for (const k of Object.keys(this.ends) as (keyof typeof this.ends)[]) {
      const o = this.ends[k];
      o.position.copy(pose.seg[k].p);
      o.quaternion.copy(pose.seg[k].q);
    }
    this.head.position.copy(pose.head.p);
    this.head.quaternion.copy(pose.head.q);
    this.setJaw(pose.jaw);
    for (const s of ["r", "l"] as const) setHand(this.handsParts[s], s, pose.hands?.[s] ?? { curl: HAND_REST_CURL, grip: "rest" });
    this.torso.place((y, f) => {
      const x = spineAt(pose, y);
      f.p.copy(x.p);
      f.q.copy(x.q);
    });
    // Cuello: abajo con el tórax, en medio con el cuello y arriba con la cabeza.
    this.neck.place((y, f) => {
      f.p.set(0, y, 0).applyQuaternion(y < 0 ? pose.trunkQ : pose.neck.q).add(pose.neck.p);
      f.q.copy(pose.trunkQ).slerp(pose.neck.q, ramp(-4, 1.5, y)).slerp(pose.head.q, ramp(6, 10.5, y) * 0.6);
    });
    for (const l of this.limbs) l.skin.place((key, f) => chainFrame(pose, l.s, l.arm, l.off - key, f));
    this.group.updateMatrixWorld(true);
  }

  /** Abre la boca: gira la mandíbula y coloca labios y dientes. */
  private setJaw(deg: number) {
    if (deg === this.jaw) return;
    this.jaw = deg;
    const pos = this.headMesh.geometry.attributes.position as Float32BufferAttribute;
    const arr = pos.array as Float32Array;
    const rest = this.headRest;
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      const k = i * 3;
      const w = this.jawW[i]!;
      if (w === 0 || deg === 0) {
        arr[k + 1] = rest[k + 1]!;
        arr[k + 2] = rest[k + 2]!;
        continue;
      }
      const p = jawPoint(v.set(rest[k]!, rest[k + 1]!, rest[k + 2]!), deg * w);
      arr[k + 1] = p.y;
      arr[k + 2] = p.z;
    }
    pos.needsUpdate = true;
    this.headMesh.geometry.computeVertexNormals();
    this.headMesh.geometry.computeBoundingSphere();
    // La abertura va de un labio al otro; la boca (y los dientes) se apoyan delante de esa línea.
    const up = this.lipUp.clone();
    const low = jawPoint(this.lipLow.clone(), deg);
    const span = low.clone().sub(up);
    const gap = span.length();
    const open = Math.max(0, gap - 0.5);
    const dir = span.clone().normalize();
    const phi = Math.atan2(-dir.z, -dir.y);
    const out = new Vector3(0, -Math.sin(phi), Math.cos(phi));
    this.mouth.position.copy(up).lerp(low, 0.5).addScaledVector(out, 0.1);
    this.mouth.rotation.x = phi;
    this.mouth.scale.set(2.2 - open * 0.08, 0.13 + gap / 2 - 0.25, 0.3);
    const t = Math.min(1, Math.max(0, (open - 0.4) / 1.2));
    const [top, bottom] = this.teeth as [Mesh, Mesh];
    top.visible = bottom.visible = t > 0.02;
    for (const [m, at, sign] of [
      [top, up, 1],
      [bottom, low, -1],
    ] as const) {
      m.position.copy(at).addScaledVector(dir, sign * 0.55).addScaledVector(out, 0.28);
      m.rotation.x = phi;
      m.scale.set(sign > 0 ? 1.5 : 1.35, 0.42 * t, 0.2);
    }
  }

  /** Depresor lingual entre los molares derechos (va con la cabeza). */
  addDepressor() {
    const { inner, outer } = DEPRESSOR;
    const dir = outer.clone().sub(inner);
    const stick = new Mesh(colorAttr(new BoxGeometry(1.8, 0.22, dir.length()), new Color("#e2c48f")), this.mat);
    stick.position.copy(inner.clone().lerp(outer, 0.5));
    stick.rotation.y = Math.atan2(dir.x, dir.z);
    stick.castShadow = true;
    this.head.add(stick);
    this.parts.set(stick, "head");
  }

  /** Para que el examinador no se pegue: piezas para elegir cámara y comprobar si algo tapa. */
  meshes(): Mesh[] {
    return [...this.parts.keys()].filter((o): o is Mesh => o instanceof Mesh);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    // Las texturas se comparten entre figuras: solo se liberan los materiales.
    for (const m of new Set([this.mat, this.torsoMat, this.headMat])) m.dispose();
  }
}
