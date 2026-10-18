// Choques entre cuerpos: distancia (con signo) de un punto a la piel de una persona, aproximada con las
// mismas secciones que dan forma a la malla, y puntos repartidos por su piel. Sirve para que el
// examinador no se meta en el paciente ni en la camilla y para comprobarlo en las pruebas.
import { Quaternion, Vector3 } from "three";
import type { Table } from "./layout";
import { bendPoint, FOOT, HAND_REST_CURL, HEAD, KNUCKLE_Y, LIMB, limbSection, profileAt, SPINE_Y0, TORSO, torsoSection, type Pose3, type Section, type Side } from "./rig";

type Seg = "upperarm" | "forearm" | "thigh" | "shank";
const SEGS: Seg[] = ["upperarm", "forearm", "thigh", "shank"];
const SIDES: Side[] = ["r", "l"];
const TORSO_Y = [TORSO[0]![0], TORSO[TORSO.length - 1]![0]] as const;
const HEAD_Y = [HEAD[0]![0], HEAD[HEAD.length - 1]![0]] as const;

/** Radio de una superelipse (exponente e) en la dirección unitaria (cx, cz). */
function superR(cx: number, cz: number, sec: Section, e: number) {
  const a = cx >= 0 ? sec.xp : sec.xn;
  const b = cz >= 0 ? sec.zp : sec.zn;
  return 1 / ((Math.abs(cx) / a) ** e + (Math.abs(cz) / b) ** e) ** (1 / e);
}

/** Distancia a un tubo de sección variable: radial (x, z) y, fuera de sus extremos, a lo largo (y). */
function tubeD(x: number, z: number, beyond: number, sec: Section, e: number) {
  const h = Math.hypot(x, z);
  const radial = h < 1e-6 ? -sec.xp : h - superR(x / h, z / h, sec, e);
  if (beyond <= 0) return radial;
  return radial > 0 ? Math.hypot(radial, beyond) : beyond;
}

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
  const spine = pose.spine.filter((_, i) => i % 2 === 0).map((f, k) => ({ y: SPINE_Y0 + 2 * k, p: f.p, qi: inv(f.q) }));
  const segs = SIDES.flatMap((s) => SEGS.map((n) => ({ s, n, part: `${s}_${n}`, p: pose.seg[`${s}_${n}`].p, qi: inv(pose.seg[`${s}_${n}`].q) })));
  const hands = SIDES.map((s) => ({ part: `${s}_hand`, p: pose.seg[`${s}_hand`].p, qi: inv(pose.seg[`${s}_hand`].q), curl: pose.hands?.[s]?.curl ?? HAND_REST_CURL }));
  const feet = SIDES.map((s) => ({ part: `${s}_foot`, p: pose.seg[`${s}_foot`].p, qi: inv(pose.seg[`${s}_foot`].q) }));
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
  return (p, skip) => {
    if (p.x < lo.x || p.y < lo.y || p.z < lo.z || p.x > hi.x || p.y > hi.y || p.z > hi.z) return { d: 30, part: "" };
    let best: Hit = { d: Infinity, part: "" };
    const take = (d: number, part: string) => {
      if (d < best.d) best = { d, part };
    };
    if (!skip?.("torso")) {
      let d = Infinity;
      for (const f of spine) {
        l.copy(p).sub(f.p).applyQuaternion(f.qi);
        if (Math.abs(l.y) > 1.6) continue;
        const y = f.y + l.y;
        const yc = Math.min(TORSO_Y[1], Math.max(TORSO_Y[0], y));
        d = Math.min(d, tubeD(l.x, l.z, Math.abs(y - yc), torsoSection(yc), 2.35));
      }
      take(d, "torso");
    }
    if (!skip?.("head")) {
      l.copy(p).sub(head.p).applyQuaternion(head.qi);
      const yc = Math.min(HEAD_Y[1], Math.max(HEAD_Y[0], l.y));
      const [a, zf, zb] = profileAt(HEAD, yc) as [number, number, number];
      const s = (zf - zb) / 2;
      take(tubeD(l.x, l.z - (zf + zb) / 2, Math.abs(l.y - yc), { xp: a, xn: a, zp: s, zn: s }, 2.15), "head");
    }
    if (!skip?.("neck")) {
      l.copy(p).sub(neck.p).applyQuaternion(neck.qi);
      const yc = Math.min(10, Math.max(-1.5, l.y));
      take(tubeD(l.x, l.z - 0.3, Math.abs(l.y - yc), { xp: 5.1, xn: 5.1, zp: 5.2, zn: 5.6 }, 2), "neck");
    }
    for (const g of segs) {
      if (skip?.(g.part)) continue;
      l.copy(p).sub(g.p).applyQuaternion(g.qi);
      const L = LIMB[g.n];
      const t = -l.y / L.len;
      const t0 = L.rings[0]![0];
      const t1 = L.rings[L.rings.length - 1]![0];
      const tc = Math.min(t1, Math.max(t0, t));
      take(tubeD(l.x, l.z, Math.abs(t - tc) * L.len, limbSection(g.n, g.s, tc), 2), g.part);
    }
    for (const h of hands) {
      if (skip?.(h.part)) continue;
      take(handD(l.copy(p).sub(h.p).applyQuaternion(h.qi), h.curl), h.part);
    }
    for (const f of feet) {
      if (skip?.(f.part)) continue;
      take(footD(l.copy(p).sub(f.p).applyQuaternion(f.qi)), f.part);
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
  const ring = (part: string, c: Vector3, q: Quaternion, sec: Section, e: number, n: number, zc = 0) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      const r = superR(cx, cz, sec, e);
      out.push({ part, p: new Vector3(cx * r, 0, zc + cz * r).applyQuaternion(q).add(c) });
    }
  };
  if (want("torso")) {
    for (let y = -13; y <= 56; y += 3.5 * coarse) {
      const f = pose.spine[Math.round(y - SPINE_Y0)]!;
      ring("torso", f.p, f.q, torsoSection(y), 2.35, Math.round(14 / coarse));
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
        ring(part, x.p.clone().add(new Vector3(0, -LIMB[n].len * t, 0).applyQuaternion(x.q)), x.q, limbSection(n, s, t), 2, Math.round(10 / coarse));
      }
    }
    if (want(`${s}_hand`)) {
      const h = pose.seg[`${s}_hand`];
      const curl = pose.hands?.[s]?.curl ?? HAND_REST_CURL;
      for (let y = -1; y >= -18; y -= 1.5) {
        for (const x of [-3.4, -1.2, 1.2, 3.4]) {
          for (const z of [1.5, -1.5]) {
            const [by, bz] = bendPoint(y, z, curl);
            out.push({ part: `${s}_hand`, p: new Vector3(x * (y < -15 ? 0.7 : 1), by, bz).applyQuaternion(h.q).add(h.p), grip: z > 0 });
          }
        }
      }
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
