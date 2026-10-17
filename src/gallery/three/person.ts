// Maniquí 3D: paciente o examinador, con formas de persona (tronco con pecho, cintura y glúteos, músculos
// de brazos y piernas, manos y pies de su tamaño, cabeza con ojos, nariz, orejas y boca que se abre) y ropa
// sencilla. Cada pieza
// es una malla propia que se coloca con la pose del esqueleto (rig.ts); el tronco se curva con la columna.
import { BoxGeometry, BufferGeometry, CapsuleGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, Vector3 } from "three";
import { DEPRESSOR, faceZ, HEAD, jawPoint, LIMB, LIMBS, LIPS_Y, profileAt, sgn, spineAt, TORSO, type LimbSeg, type Pose3, type Section, type SegKey, type Side } from "./rig";

export type Look = "patient" | "examiner";

const PALETTE = {
  patient: { skin: "#e6c2a3", hair: "#3b2d25", top: "#d9b95a", bottom: "#0e3b2e", shoe: null as string | null },
  examiner: { skin: "#c4957a", hair: "#241c18", top: "#1f6f54", bottom: "#185a44", shoe: "#2b2b2e" },
};

type Ring = { y: number; sec: Section; xc?: number; zc?: number; e?: number; inflate?: number };
type Paint = (p: Vector3, ringIndex: number) => Color;

const sc = (c: number, e: number) => Math.sign(c) * Math.abs(c) ** (2 / e);

function ringPoint(r: Ring, a: number): [number, number] {
  const e = r.e ?? 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const k = r.inflate ?? 1;
  return [(r.xc ?? 0) + sc(c, e) * (c > 0 ? r.sec.xp : r.sec.xn) * k, (r.zc ?? 0) + sc(s, e) * (s > 0 ? r.sec.zp : r.sec.zn) * k];
}

/**
 * Superficie barrida: anillos a lo largo de y (o de z, para el pie) cerrados en los extremos. Devuelve
 * la geometría y, para el tronco, los puntos de cada anillo en reposo.
 */
function loft(rings: Ring[], N: number, paint: Paint, alongZ = false, capPad = 0.5): { geo: BufferGeometry; rest: [number, number][][] } {
  const pos: number[] = [];
  const col: number[] = [];
  const rest: [number, number][][] = [];
  const put = (x: number, y: number, z: number, i: number) => {
    const v = alongZ ? new Vector3(-x, z, y) : new Vector3(x, y, z);
    pos.push(v.x, v.y, v.z);
    const c = paint(v, i);
    col.push(c.r, c.g, c.b);
  };
  rings.forEach((r, i) => {
    const pts: [number, number][] = [];
    for (let j = 0; j < N; j++) {
      const [x, z] = ringPoint(r, (j / N) * Math.PI * 2);
      pts.push([x, z]);
      put(x, r.y, z, i);
    }
    rest.push(pts);
  });
  const first = rings[0]!;
  const last = rings[rings.length - 1]!;
  const dir = Math.sign(last.y - first.y);
  put(first.xc ?? 0, first.y - dir * capPad, first.zc ?? 0, 0);
  put(last.xc ?? 0, last.y + dir * capPad, last.zc ?? 0, rings.length - 1);
  const idx: number[] = [];
  const R = rings.length;
  // Orden de los triángulos para que las normales miren hacia fuera.
  const flip = dir < 0;
  const tri = (a: number, b: number, c: number) => (flip ? idx.push(a, c, b) : idx.push(a, b, c));
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < N; j++) {
      const a = i * N + j;
      const b = i * N + ((j + 1) % N);
      const c = (i + 1) * N + j;
      const d = (i + 1) * N + ((j + 1) % N);
      tri(a, c, b);
      tri(b, c, d);
    }
  }
  const p0 = R * N;
  const p1 = R * N + 1;
  for (let j = 0; j < N; j++) {
    tri(p0, j, (j + 1) % N);
    tri(p1, (R - 1) * N + ((j + 1) % N), (R - 1) * N + j);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, rest };
}

/** Valores de t desde a hasta b con paso dado, más los cortes pedidos (dos anillos muy juntos en cada uno). */
function steps(a: number, b: number, step: number, cuts: number[] = []): number[] {
  const out: number[] = [];
  for (let t = a; t < b - 1e-6; t += step) out.push(t);
  out.push(b);
  for (const c of cuts) if (c > a && c < b) out.push(c - 0.004, c + 0.004);
  return [...new Set(out.map((v) => +v.toFixed(4)))].sort((x, y) => x - y);
}

type Cloth = { top: Color; bottom: Color; skin: Color; hair: Color; shoe: Color | null; sleeve: number; legCut: number; look: Look };

function limbGeometry(seg: Exclude<LimbSeg, "hand" | "foot">, s: Side, cl: Cloth): BufferGeometry {
  const L = LIMB[seg];
  const t0 = L.rings[0]![0];
  const t1 = L.rings[L.rings.length - 1]![0];
  const cut = seg === "upperarm" ? cl.sleeve : seg === "thigh" ? cl.legCut : seg === "shank" && cl.legCut > 1 ? 2 : -1;
  const covered = (t: number) => (seg === "upperarm" ? t < cl.sleeve : seg === "thigh" ? t < cl.legCut : seg === "shank" ? cl.legCut > 1 : false);
  const ts = steps(t0, t1, 1.1 / L.len, cut > 0 && cut < 1 ? [cut] : []);
  const rings: Ring[] = ts.map((t) => {
    const [lat, med, ant, post] = profileAt(L.rings, t) as [number, number, number, number];
    const sec = s === "l" ? { xp: lat, xn: med, zp: ant, zn: post } : { xp: med, xn: lat, zp: ant, zn: post };
    return { y: -t * L.len, sec, inflate: covered(t) ? (seg === "shank" || seg === "thigh" ? 1.06 : 1.08) : 1 };
  });
  const color = (seg === "upperarm" ? cl.top : cl.bottom) as Color;
  return loft(rings, 22, (_p, i) => (covered(ts[i]!) ? color : cl.skin)).geo;
}

function handGroup(s: Side, skin: Color, mat: MeshStandardMaterial): Object3D {
  // Mano relajada: palma hacia +z, dedos hacia −y algo flexionados, pulgar en el lado radial.
  const rows: [number, number, number, number][] = [
    [0.6, 2.7, 1.8, -1.8],
    [-1.5, 3.3, 1.9, -1.9],
    [-5.5, 4.1, 1.8, -1.5],
    [-9.2, 4.2, 1.3, -1.3],
    [-11, 3.9, 1.15, -1.15],
    [-15, 3.5, 1.0, -1.0],
    [-17.6, 2.8, 0.95, -0.9],
    [-18.6, 1.4, 0.7, -0.6],
  ];
  const ys = steps(-18.6, 0.6, 0.7).reverse();
  const rings: Ring[] = ys.map((y) => {
    const [a, zf, zb] = profileAt([...rows].reverse(), y) as [number, number, number];
    return { y, sec: { xp: a, xn: a, zp: (zf - zb) / 2, zn: (zf - zb) / 2 }, zc: (zf + zb) / 2, e: 2.6 };
  });
  const geo = loft(rings, 20, () => skin).geo;
  // Dedos doblados hacia la palma a partir de los nudillos.
  const pos = geo.attributes.position as Float32BufferAttribute;
  const y0 = -9.2;
  const R = 13;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y >= y0) continue;
    const z = pos.getZ(i);
    const phi = (y0 - y) / R;
    pos.setY(i, y0 - (R - z) * Math.sin(phi));
    pos.setZ(i, R - (R - z) * Math.cos(phi));
  }
  geo.computeVertexNormals();
  const g = new Group();
  const palm = new Mesh(geo, mat);
  const thumb = new Mesh(colorAttr(new CapsuleGeometry(1.2, 3.8, 4, 10), skin), mat);
  const r = sgn(s); // lado radial: lateral en posición anatómica
  thumb.position.set(r * 3.7, -5.6, 1.5);
  thumb.rotation.set(0.45, 0, r * 0.4);
  g.add(palm, thumb);
  return g;
}

function footGeometry(paint: Color): BufferGeometry {
  // A lo largo del pie (z), desde el talón a los dedos: [z, semiancho, arriba, abajo] respecto al tobillo.
  const rows: [number, number, number, number][] = [
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
  const zs = steps(-6.4, 19.9, 0.9);
  const rings: Ring[] = zs.map((z) => {
    const [a, top, bot] = profileAt(rows, z) as [number, number, number];
    return { y: z, sec: { xp: a, xn: a, zp: (top - bot) / 2, zn: (top - bot) / 2 }, zc: (top + bot) / 2, e: 2.4 };
  });
  return loft(rings, 20, () => paint, true, 0.4).geo;
}

function headGeometry(skin: Color, hair: Color, look: Look): BufferGeometry {
  // Malla fina: el borde del pelo y la mandíbula se ven de cerca.
  const ys = steps(HEAD[0]![0], HEAD[HEAD.length - 1]![0], 0.4);
  const rings: Ring[] = ys.map((y) => {
    const [a, zf, zb] = profileAt(HEAD, y) as [number, number, number];
    return { y, sec: { xp: a, xn: a, zp: (zf - zb) / 2, zn: (zf - zb) / 2 }, zc: (zf + zb) / 2, e: 2.15 };
  });
  const line = look === "patient" ? 4.2 : 3.6;
  return loft(rings, 64, (p) => (p.y - p.z * 0.58 > line || (p.y > 10.8 && p.z < 3) ? hair : skin)).geo;
}

/** 0 en a, 1 en b, con transición suave (a puede ser mayor que b). */
const ramp = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const colorAttr = (geo: BufferGeometry, c: Color) => {
  geo.setAttribute("color", new Float32BufferAttribute(new Array(geo.attributes.position!.count).fill(0).flatMap(() => [c.r, c.g, c.b]), 3));
  return geo;
};

export class Person {
  readonly group = new Group();
  /** Mallas con la parte del cuerpo que representan (para saber qué tapa qué). */
  readonly parts = new Map<Object3D, string>();
  private readonly mat: MeshStandardMaterial;
  private readonly torso: Mesh;
  private readonly torsoRings: { y: number; pts: [number, number][] }[];
  private readonly torsoCaps: number[];
  private readonly seg = {} as Record<SegKey, Object3D>;
  private readonly neck: Object3D;
  private readonly head: Object3D;
  private readonly headMesh: Mesh;
  private readonly headRest: Float32Array;
  private readonly jawW: Float32Array;
  private readonly mouth: Mesh;
  private readonly teeth: Mesh[];
  private jaw = NaN;

  constructor(readonly look: Look) {
    const P = PALETTE[look];
    const cl: Cloth = {
      skin: new Color(P.skin),
      hair: new Color(P.hair),
      top: new Color(P.top),
      bottom: new Color(P.bottom),
      shoe: P.shoe ? new Color(P.shoe) : null,
      sleeve: look === "patient" ? 0.36 : 0.42,
      legCut: look === "patient" ? 0.4 : 2,
      look,
    };
    this.mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
    const mat = this.mat;
    const add = (o: Object3D, part: string, parent: Object3D = this.group) => {
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
    const ys = steps(TORSO[0]![0], TORSO[TORSO.length - 1]![0], 1.1, look === "patient" ? [14, 52.5] : [8, 53.5]);
    const waist = 14;
    const rings: Ring[] = ys.map((y) => {
      const [a, ant, post] = profileAt(TORSO, y) as [number, number, number];
      const clothed = y < (look === "patient" ? 52.5 : 53.5);
      return { y, sec: { xp: a, xn: a, zp: ant, zn: post }, e: 2.5, inflate: clothed ? 1.012 : 1 };
    });
    const torsoPaint: Paint = (p) => {
      if (look === "patient") return p.y > 52.5 ? cl.skin : p.y < waist ? cl.bottom : cl.top;
      return p.y > 53.5 ? cl.skin : p.y < 8 ? cl.bottom : cl.top;
    };
    const t = loft(rings, 36, torsoPaint);
    this.torsoRings = rings.map((r, i) => ({ y: r.y, pts: t.rest[i]! }));
    this.torsoCaps = [rings[0]!.y - 0.5, rings[rings.length - 1]!.y + 0.5];
    this.torso = add(new Mesh(t.geo, mat), "torso") as Mesh;
    this.torso.frustumCulled = false;

    // Cuello y cabeza.
    const neckRings: Ring[] = steps(-1.5, 10, 1).map((y) => ({ y, sec: { xp: 5.1, xn: 5.1, zp: 5.2, zn: 5.6 }, zc: 0.3 }));
    this.neck = add(new Mesh(loft(neckRings, 20, () => cl.skin).geo, mat), "neck");
    const head = new Group();
    this.headMesh = new Mesh(headGeometry(cl.skin, cl.hair, look), mat);
    head.add(this.headMesh);
    // La parte baja de la cara gira con la mandíbula: peso 0 por encima de los labios, 1 por debajo.
    const hp = this.headMesh.geometry.attributes.position as Float32BufferAttribute;
    this.headRest = Float32Array.from(hp.array as Float32Array);
    this.jawW = new Float32Array(hp.count);
    for (let i = 0; i < hp.count; i++) this.jawW[i] = ramp(LIPS_Y + 0.25, LIPS_Y - 0.55, hp.getY(i)) * ramp(-2, 3, hp.getZ(i));
    // Boca: interior oscuro (una línea con la boca cerrada) y dientes que asoman al abrirla.
    const sphere = (c: string) => new Mesh(colorAttr(new SphereGeometry(1, 18, 12), new Color(c)), mat);
    this.mouth = sphere("#4a2224");
    this.teeth = [sphere("#f2ede4"), sphere("#f2ede4")];
    head.add(this.mouth, ...this.teeth);
    const nose = new Mesh(colorAttr(new SphereGeometry(1, 12, 10), cl.skin), mat);
    nose.scale.set(1.15, 2.1, 1.5);
    nose.position.set(0, -1.6, 9.2);
    nose.rotation.x = -0.25;
    head.add(nose);
    // Ojos: dos puntos, para saber hacia dónde mira.
    for (const x of [-1, 1]) {
      const eye = new Mesh(colorAttr(new SphereGeometry(0.62, 10, 8), new Color("#2a211c")), mat);
      eye.scale.set(1, 1.15, 0.6);
      eye.position.set(x * 2.75, 1.4, 8.55);
      head.add(eye);
    }
    for (const x of [-1, 1]) {
      const ear = new Mesh(colorAttr(new SphereGeometry(1, 12, 10), cl.skin), mat);
      ear.scale.set(0.9, 2.6, 1.7);
      ear.position.set(x * 7.4, -0.5, -0.6);
      head.add(ear);
    }
    this.head = add(head, "head");
    this.setJaw(0);

    // Brazos y piernas, con esferas en codos y rodillas para que la flexión no deje huecos.
    for (const s of ["r", "l"] as const) {
      for (const n of LIMBS) {
        const g = new Group();
        if (n === "hand") g.add(handGroup(s, cl.skin, mat));
        else if (n === "foot") g.add(new Mesh(footGeometry(cl.shoe ?? cl.skin), mat));
        else g.add(new Mesh(limbGeometry(n, s, cl), mat));
        if (n === "thigh" || n === "upperarm") {
          const r = n === "thigh" ? 5.0 : 3.55;
          const c = n === "thigh" ? (cl.legCut > 1 ? cl.bottom : cl.skin) : cl.skin;
          const ball = new Mesh(colorAttr(new SphereGeometry(r, 18, 14), c), mat);
          ball.position.y = -LIMB[n].len;
          g.add(ball);
        }
        if (n === "forearm" || n === "shank") {
          const r = n === "forearm" ? 2.3 : 2.9;
          const c = n === "shank" && cl.legCut > 1 ? cl.bottom : cl.skin;
          const ball = new Mesh(colorAttr(new SphereGeometry(r, 14, 10), c), mat);
          ball.position.y = -LIMB[n].len;
          if (n === "forearm") ball.scale.set(1.15, 1, 0.8);
          g.add(ball);
        }
        if (n === "hand") {
          // Mano algo girada hacia el cuerpo (más natural que la palma de frente).
          g.children[0]!.rotation.y = this.look === "patient" ? -sgn(s) * 0.7 : 0;
        }
        this.seg[`${s}_${n}`] = add(g, `${s}_${n}`);
      }
    }
  }

  /** Coloca todas las piezas en la pose. */
  apply(pose: Pose3) {
    for (const k of Object.keys(this.seg) as SegKey[]) {
      const o = this.seg[k];
      o.position.copy(pose.seg[k].p);
      o.quaternion.copy(pose.seg[k].q);
    }
    this.neck.position.copy(pose.neck.p);
    this.neck.quaternion.copy(pose.neck.q);
    this.head.position.copy(pose.head.p);
    this.head.quaternion.copy(pose.head.q);
    this.setJaw(pose.jaw);

    const pos = this.torso.geometry.attributes.position as Float32BufferAttribute;
    const arr = pos.array as Float32Array;
    const v = new Vector3();
    let k = 0;
    for (const r of this.torsoRings) {
      const f = spineAt(pose, r.y);
      for (const [x, z] of r.pts) {
        v.set(x, 0, z).applyQuaternion(f.q).add(f.p);
        arr[k++] = v.x;
        arr[k++] = v.y;
        arr[k++] = v.z;
      }
    }
    for (const y of this.torsoCaps) {
      const f = spineAt(pose, y);
      arr[k++] = f.p.x;
      arr[k++] = f.p.y;
      arr[k++] = f.p.z;
    }
    pos.needsUpdate = true;
    this.torso.geometry.computeVertexNormals();
    this.torso.geometry.computeBoundingSphere();
    this.torso.geometry.computeBoundingBox();
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
    const lip = (y: number) => new Vector3(0, y, faceZ(y));
    const up = lip(LIPS_Y + 0.15);
    const low = jawPoint(lip(LIPS_Y - 0.35), deg);
    const span = low.clone().sub(up);
    const gap = span.length();
    const open = Math.max(0, gap - 0.5);
    const dir = span.clone().normalize();
    const phi = Math.atan2(-dir.z, -dir.y);
    const out = new Vector3(0, -Math.sin(phi), Math.cos(phi));
    this.mouth.position.copy(up).lerp(low, 0.5).addScaledVector(out, 0.12);
    this.mouth.rotation.x = phi;
    this.mouth.scale.set(2.3 - open * 0.08, 0.17 + gap / 2 - 0.25, 0.3);
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
    this.mat.dispose();
  }
}
