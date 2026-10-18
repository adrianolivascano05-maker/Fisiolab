// Choques entre cuerpos: distancia (con signo) de un punto a la piel de una persona, aproximada con las
// mismas secciones que dan forma a la malla, y puntos repartidos por su piel. Sirve para que el
// examinador no se meta en el paciente ni en la camilla y para comprobarlo en las pruebas.
import { Quaternion, Vector3 } from "three";
import type { Table } from "./layout";
import { bentFinger, fingerBends, FINGERS, FOOT, forearmTwist, HAND_REST_CURL, HEAD, KNUCKLE_Y, LIMB, limbBump, limbSection, profileAt, sgn, SPINE_Y0, THUMB, THUMB_JOINTS, thumbFrame, TORSO, torsoBump, torsoSection, type HandState, type Pose3, type Section, type Side } from "./rig";

type Seg = "upperarm" | "forearm" | "thigh" | "shank";
const SEGS: Seg[] = ["upperarm", "forearm", "thigh", "shank"];
const SIDES: Side[] = ["r", "l"];
const TORSO_Y = [TORSO[0]![0], TORSO[TORSO.length - 1]![0]] as const;
const HEAD_Y = [HEAD[0]![0], HEAD[HEAD.length - 1]![0]] as const;

/** Radio de una superelipse (exponente e) en la dirección unitaria (cx, cz). */
function superR(cx: number, cz: number, sec: Section, e: number) {
  const a = cx >= 0 ? sec.xp : sec.xn;
  const b = cz >= 0 ? sec.zp : sec.zn;
  if (e === 2) return 1 / Math.sqrt((cx / a) ** 2 + (cz / b) ** 2);
  return 1 / ((Math.abs(cx) / a) ** e + (Math.abs(cz) / b) ** e) ** (1 / e);
}

/** Distancia a un tubo de sección variable: radial (x, z) y, fuera de sus extremos, a lo largo (y). */
function tubeD(x: number, z: number, beyond: number, sec: Section, e: number) {
  const h = Math.hypot(x, z);
  const radial = h < 1e-6 ? -sec.xp : h - superR(x / h, z / h, sec, e);
  if (beyond <= 0) return radial;
  return radial > 0 ? Math.hypot(radial, beyond) : beyond;
}

/** Tabla de secciones a lo largo de un perfil (interpolar una tabla es mucho más rápido que la curva). */
function table(rows: number[][], x0: number, x1: number, step: number, out: (v: number[]) => Section) {
  const n = Math.ceil((x1 - x0) / step) + 1;
  const secs = Array.from({ length: n }, (_, i) => out(profileAt(rows, x0 + i * step)));
  const tmp: Section = { xp: 0, xn: 0, zp: 0, zn: 0 };
  return (x: number): Section => {
    const f = Math.min(n - 1.0001, Math.max(0, (x - x0) / step));
    const i = Math.floor(f);
    const u = f - i;
    const a = secs[i]!;
    const b = secs[i + 1]!;
    tmp.xp = a.xp + (b.xp - a.xp) * u;
    tmp.xn = a.xn + (b.xn - a.xn) * u;
    tmp.zp = a.zp + (b.zp - a.zp) * u;
    tmp.zn = a.zn + (b.zn - a.zn) * u;
    return tmp;
  };
}
const TORSO_SEC = table(TORSO, TORSO_Y[0], TORSO_Y[1], 0.25, ([a, f, b]) => ({ xp: a!, xn: a!, zp: f!, zn: b! }));
/** Cabeza: semiancho, semifondo y centro en z (en zn guarda el centro). */
const HEAD_SEC = table(HEAD, HEAD_Y[0], HEAD_Y[1], 0.2, ([a, f, b]) => ({ xp: a!, xn: a!, zp: (f! - b!) / 2, zn: (f! + b!) / 2 }));
const LIMB_SEC = Object.fromEntries(
  SIDES.flatMap((s) =>
    SEGS.map((n) => {
      const r = LIMB[n].rings;
      return [`${s}_${n}`, table(r, r[0]![0], r[r.length - 1]![0], 0.01, ([lat, med, ant, post]) => (s === "l" ? { xp: lat!, xn: med!, zp: ant!, zn: post! } : { xp: med!, xn: lat!, zp: ant!, zn: post! }))];
    }),
  ),
) as Record<string, (t: number) => Section>;

/** Mano relajada o doblada: se deshace la curva de los dedos y se mide a la mano plana. */
const HAND = { y0: -18.6, y1: 0.6, sec: { xp: 4.1, xn: 4.1, zp: 1.6, zn: 1.6 } };
function handD(l: Vector3, curl: number) {
  let { y, z } = l;
  if (y < KNUCKLE_Y || z > curl) {
    const phi = Math.atan2(KNUCKLE_Y - y, curl - z);
    if (phi > 0) {
      const rho = Math.hypot(y - KNUCKLE_Y, z - curl);
      y = KNUCKLE_Y - phi * curl;
      z = curl - rho;
    }
  }
  const beyond = y < HAND.y0 ? HAND.y0 - y : y > HAND.y1 ? y - HAND.y1 : 0;
  return tubeD(l.x, z, beyond, HAND.sec, 2.6);
}

function footD(l: Vector3) {
  const z0 = FOOT[0]![0];
  const z1 = FOOT[FOOT.length - 1]![0];
  const zc = Math.min(z1, Math.max(z0, l.z));
  const [a, top, bot] = profileAt(FOOT, zc) as [number, number, number];
  const s = (top - bot) / 2;
  return tubeD(l.x, l.y - (top + bot) / 2, Math.abs(l.z - zc), { xp: a, xn: a, zp: s, zn: s }, 2.4);
}

export type Hit = { d: number; part: string };
export type BodySDF = (p: Vector3, skip?: (part: string) => boolean) => Hit;

/** Función de distancia a la piel de una persona en una pose (negativa dentro). */
export function bodySDF(pose: Pose3): BodySDF {
  const inv = (q: Quaternion) => q.clone().invert();
  // Cada 2 cm de columna: su marco y su eje (para ver deprisa qué rodajas tocan el punto).
  const spine = pose.spine
    .filter((_, i) => i % 2 === 0)
    .map((f, k) => ({ y: SPINE_Y0 + 2 * k, p: f.p, qi: inv(f.q), up: new Vector3(0, 1, 0).applyQuaternion(f.q) }));
  const spineC = pose.spine[Math.round(20 - SPINE_Y0)]!.p;
  const segs = SIDES.flatMap((s) =>
    SEGS.map((n) => {
      const x = pose.seg[`${s}_${n}`];
      const L = LIMB[n].len;
      // Esfera que contiene el segmento (para descartarlo sin calcular nada si está lejos).
      return { s, n, part: `${s}_${n}`, p: x.p, qi: inv(x.q), c: new Vector3(0, -L / 2, 0).applyQuaternion(x.q).add(x.p), R: L / 2 + L * 0.15 + 10, sec: LIMB_SEC[`${s}_${n}`]! };
    }),
  );
  const hands = SIDES.map((s) => {
    const x = pose.seg[`${s}_hand`];
    return { part: `${s}_hand`, p: x.p, qi: inv(x.q), curl: pose.hands?.[s]?.curl ?? HAND_REST_CURL, c: new Vector3(0, -9, 0).applyQuaternion(x.q).add(x.p), R: 15 };
  });
  const feet = SIDES.map((s) => {
    const x = pose.seg[`${s}_foot`];
    return { part: `${s}_foot`, p: x.p, qi: inv(x.q), c: new Vector3(0, -3, 7).applyQuaternion(x.q).add(x.p), R: 17 };
  });
  const head = { p: pose.head.p, qi: inv(pose.head.q) };
  const neck = { p: pose.neck.p, qi: inv(pose.neck.q) };
  // Caja que lo contiene todo (para descartar rápido lo que está lejos).
  const lo = new Vector3(Infinity, Infinity, Infinity);
  const hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const v of [...Object.values(pose.pt), ...pose.spine.map((f) => f.p)]) {
    lo.min(v);
    hi.max(v);
  }
  lo.subScalar(22);
  hi.addScalar(22);
  const l = new Vector3();
  const d = new Vector3();
  return (p, skip) => {
    if (p.x < lo.x || p.y < lo.y || p.z < lo.z || p.x > hi.x || p.y > hi.y || p.z > hi.z) return { d: 30, part: "" };
    let best: Hit = { d: Infinity, part: "" };
    const take = (dd: number, part: string) => {
      if (dd < best.d) best = { d: dd, part };
    };
    // Lejos de la esfera de una parte: no puede estar más cerca que lo ya encontrado.
    const far = (c: Vector3, R: number) => d.copy(p).sub(c).length() - R > best.d;
    for (const g of segs) {
      if (skip?.(g.part) || far(g.c, g.R)) continue;
      l.copy(p).sub(g.p).applyQuaternion(g.qi);
      const L = LIMB[g.n];
      const t = -l.y / L.len;
      const t0 = L.rings[0]![0];
      const t1 = L.rings[L.rings.length - 1]![0];
      const tc = Math.min(t1, Math.max(t0, t));
      if (g.n === "forearm") {
        // En el marco del antebrazo torcido por la pronación.
        const a = (forearmTwist(pose, g.s, tc) * Math.PI) / 180;
        const x = l.x * Math.cos(a) - l.z * Math.sin(a);
        l.z = l.x * Math.sin(a) + l.z * Math.cos(a);
        l.x = x;
      }
      take(tubeD(l.x, l.z, Math.abs(t - tc) * L.len, g.sec(tc), 2) - limbBump(g.n, g.s, tc, l.x, l.z), g.part);
    }
    for (const h of hands) {
      if (skip?.(h.part) || far(h.c, h.R)) continue;
      take(handD(l.copy(p).sub(h.p).applyQuaternion(h.qi), h.curl), h.part);
    }
    for (const f of feet) {
      if (skip?.(f.part) || far(f.c, f.R)) continue;
      take(footD(l.copy(p).sub(f.p).applyQuaternion(f.qi)), f.part);
    }
    if (!skip?.("torso") && !far(spineC, 62)) {
      let dd = Infinity;
      for (const f of spine) {
        d.copy(p).sub(f.p);
        const ly = d.dot(f.up);
        if (Math.abs(ly) > 1.6 && !(f === spine[0] && ly < 0) && !(f === spine[spine.length - 1] && ly > 0)) continue;
        l.copy(d).applyQuaternion(f.qi);
        const y = f.y + l.y;
        const yc = Math.min(TORSO_Y[1], Math.max(TORSO_Y[0], y));
        dd = Math.min(dd, tubeD(l.x, l.z, Math.abs(y - yc), TORSO_SEC(yc), 2.35) - torsoBump(l.x, yc, l.z));
      }
      take(dd, "torso");
    }
    if (!skip?.("head") && !far(head.p, 16)) {
      l.copy(p).sub(head.p).applyQuaternion(head.qi);
      const yc = Math.min(HEAD_Y[1], Math.max(HEAD_Y[0], l.y));
      const h = HEAD_SEC(yc);
      const sec = { xp: h.xp, xn: h.xp, zp: h.zp, zn: h.zp };
      take(tubeD(l.x, l.z - h.zn, Math.abs(l.y - yc), sec, 2.15), "head");
    }
    if (!skip?.("neck") && !far(neck.p, 14)) {
      l.copy(p).sub(neck.p).applyQuaternion(neck.qi);
      const yc = Math.min(10, Math.max(-1.5, l.y));
      take(tubeD(l.x, l.z - 0.3, Math.abs(l.y - yc), { xp: 5.1, xn: 5.1, zp: 5.2, zn: 5.6 }, 2), "neck");
    }
    return best;
  };
}

/** Distancia (con signo) a la camilla: el tablero y el bastidor de debajo. */
export function tableD(t: Table, p: Vector3) {
  const dx = Math.max(t.x0 - p.x, p.x - t.x1);
  const dz = Math.max(t.z0 - p.z, p.z - t.z1);
  const dy = Math.max(t.top - 13 - p.y, p.y - t.top);
  const o = Math.max(dx, dy, dz);
  if (o <= 0) return o;
  return Math.hypot(Math.max(0, dx), Math.max(0, dy), Math.max(0, dz));
}

export type SkinPoint = { part: string; p: Vector3; /** Cara de la palma o de las yemas (para las tomas). */ grip?: boolean };

/** Puntos repartidos por la piel (más densos que las muestras para encuadrar). */
export function skinPoints(pose: Pose3, parts?: (part: string) => boolean, coarse = 1): SkinPoint[] {
  const out: SkinPoint[] = [];
  const want = (part: string) => !parts || parts(part);
  const ring = (part: string, c: Vector3, q: Quaternion, sec: Section, e: number, n: number, zc = 0, bump?: (x: number, z: number) => number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      let r = superR(cx, cz, sec, e);
      if (bump) r += bump(cx * r, cz * r);
      out.push({ part, p: new Vector3(cx * r, 0, zc + cz * r).applyQuaternion(q).add(c) });
    }
  };
  if (want("torso")) {
    for (let y = -13; y <= 56; y += 3.5 * coarse) {
      const f = pose.spine[Math.round(y - SPINE_Y0)]!;
      ring("torso", f.p, f.q, torsoSection(y), 2.35, Math.round(14 / coarse), 0, (x, z) => torsoBump(x, y, z));
    }
  }
  if (want("head")) {
    for (let y = -10.5; y <= 12.5; y += 2.5 * coarse) {
      const [a, zf, zb] = profileAt(HEAD, y) as [number, number, number];
      const s = (zf - zb) / 2;
      ring("head", pose.head.p.clone().add(new Vector3(0, y, 0).applyQuaternion(pose.head.q)), pose.head.q, { xp: a, xn: a, zp: s, zn: s }, 2.15, Math.round(12 / coarse), (zf + zb) / 2);
    }
  }
  if (want("neck")) for (const y of [1, 4.5, 8]) ring("neck", pose.neck.p.clone().add(new Vector3(0, y, 0).applyQuaternion(pose.neck.q)), pose.neck.q, { xp: 5.1, xn: 5.1, zp: 5.2, zn: 5.6 }, 2, 8, 0.3);
  for (const s of SIDES) {
    for (const n of SEGS) {
      const part = `${s}_${n}`;
      if (!want(part)) continue;
      const x = pose.seg[part as `${Side}_${Seg}`];
      for (let t = 0.05; t <= 1.001; t += 0.1 * coarse) {
        const q = n === "forearm" ? x.q.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (forearmTwist(pose, s, t) * Math.PI) / 180)) : x.q;
        ring(part, x.p.clone().add(new Vector3(0, -LIMB[n].len * t, 0).applyQuaternion(x.q)), q, limbSection(n, s, t), 2, Math.round(10 / coarse), 0, (px, pz) => limbBump(n, s, t, px, pz));
      }
    }
    if (want(`${s}_hand`)) {
      const h = pose.seg[`${s}_hand`];
      for (const lp of handPoints(pose.hands?.[s] ?? { curl: HAND_REST_CURL, grip: "rest" }, s, coarse)) out.push({ part: `${s}_hand`, p: lp.p.clone().applyQuaternion(h.q).add(h.p), grip: lp.grip });
    }
    if (want(`${s}_foot`)) {
      const f = pose.seg[`${s}_foot`];
      for (let z = -5.5; z <= 19; z += 3 * coarse) {
        const [a, top, bot] = profileAt(FOOT, z) as [number, number, number];
        const sz = (top - bot) / 2;
        const c = new Vector3(0, (top + bot) / 2, z);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const r = superR(Math.cos(ang), Math.sin(ang), { xp: a, xn: a, zp: sz, zn: sz }, 2.4);
          out.push({ part: `${s}_foot`, p: new Vector3(Math.cos(ang) * r, Math.sin(ang) * r, 0).add(c).applyQuaternion(f.q).add(f.p) });
        }
      }
    }
  }
  return out;
}

const HAND_CACHE = new Map<string, HandPoint[]>();
/** Punto de la mano: dónde (en la mano), si es de la cara que toca y de qué parte es (palma, dedo 0-3 o pulgar). */
export type HandPoint = { p: Vector3; grip: boolean; of: string };
/**
 * Puntos de la mano como se dibuja (palma, cada dedo doblado por sus articulaciones y el pulgar), en
 * coordenadas de la mano; `grip`, los de la cara de la palma y de las yemas.
 */
export function handPoints(st: HandState, s: Side, coarse = 1): HandPoint[] {
  const bends = fingerBends(st);
  const thumb = st.thumb ?? 18;
  const key = `${s}|${coarse}|${st.grip}|${st.thumbAt ?? ""}|${st.curl.toFixed(1)}|${bends.map((b) => b.toFixed(0)).join(",")}|${thumb.toFixed(0)}`;
  const hit = HAND_CACHE.get(key);
  if (hit) return hit;
  const out: HandPoint[] = [];
  let of = "palm";
  const put = (v: Vector3, grip: boolean) => out.push({ p: v, grip, of });
  if (coarse >= 3) {
    // Pocos puntos (para buscar posturas): la cara de la palma, el medio y la yema de cada dedo y el pulgar.
    for (const y of [-2.2, -7]) for (const x of [-2.6, 2.6]) put(new Vector3(x, y, 1.7), true);
    bends.forEach((b, i) => {
      const [x0, len, r0, spread] = FINGERS[i]!;
      const f = bentFinger(KNUCKLE_Y, len, b);
      const tan = Math.tan((spread * Math.PI) / 180);
      of = `f${i}`;
      for (const d of [0.5 * len, len - 0.4]) {
        const [y, zz] = f(d, 0.8 * r0);
        put(new Vector3(sgn(s) * (x0 + d * tan), y, zz - 0.1), true);
      }
    });
    const tf = thumbFrame(st.thumbAt ?? st.grip, st.curl, s);
    const tc = bentFinger(THUMB.y0, THUMB.len, thumb, THUMB_JOINTS);
    of = "thumb";
    for (const d of [6, THUMB.len - 0.5]) {
      const [y, zz] = tc(d, 0.9);
      put(new Vector3(0, y, zz).applyQuaternion(tf.q).add(tf.p), true);
    }
    HAND_CACHE.set(key, out);
    return out;
  }
  for (let y = -1; y >= -8.6; y -= 1.9 * coarse) for (const x of [-3.4, -1.2, 1.2, 3.4]) for (const z of [1.6, -1.4]) put(new Vector3(x, y, z), z > 0);
  bends.forEach((b, i) => {
    const [x0, len, r0, spread] = FINGERS[i]!;
    const f = bentFinger(KNUCKLE_Y, len, b);
    const tan = Math.tan((spread * Math.PI) / 180);
    of = `f${i}`;
    for (let d = 0.6; d < len; d += 1.6 * coarse) {
      for (const z of [0.8 * r0, -0.8 * r0]) {
        const [y, zz] = f(d, z);
        put(new Vector3(sgn(s) * (x0 + d * tan), y, zz - 0.1), z > 0);
      }
    }
  });
  const tf = thumbFrame(st.thumbAt ?? st.grip, st.curl, s);
  const tc = bentFinger(THUMB.y0, THUMB.len, thumb, THUMB_JOINTS);
  of = "thumb";
  for (let d = 3.5; d < THUMB.len; d += 1.8 * coarse) {
    for (const z of [0.9, -0.9]) {
      const [y, zz] = tc(d, z);
      put(new Vector3(0, y, zz).applyQuaternion(tf.q).add(tf.p), z > 0);
    }
  }
  if (HAND_CACHE.size > 2000) HAND_CACHE.clear();
  HAND_CACHE.set(key, out);
  return out;
}
