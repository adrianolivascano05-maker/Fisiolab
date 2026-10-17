// El examinador en 3D: dónde se pone (junto a la camilla, delante, detrás o a un lado del paciente), cuánto
// se inclina o se agacha para llegar, y sus brazos, que van a las manos del test con cinemática inversa.
// Las manos se apoyan en la superficie del paciente (no dentro), con la palma hacia él y en el lado
// contrario a la fuerza que hacen.
import { Matrix4, Quaternion, Vector3 } from "three";
import type { Anchor, FigureSpec } from "../figure";
import type { Table } from "./layout";
import { anatDir, anchorInfo, anchorSide, bendPoint, DIM, fk, HAND_REST_CURL, KNUCKLE_Y, LYING, sgn, surfaceRadius, surfaceSamples, type BodyAngles, type Pose3, type Side } from "./rig";


/** Punto de apoyo de una mano: dónde toca (p, en la superficie), hacia dónde mira la palma (−n), el eje y
 *  el radio del segmento en ese punto (a, axis, r) y la toma. */
export type Contact = { anchor: Anchor; p: Vector3; n: Vector3; part: string; a: Vector3; axis: Vector3; r: number; grip: GripKind };
type GripKind = "press" | "grasp" | "tips";

export type ExaminerPlan = {
  rootXZ: Vector3;
  yaw: number;
  angles: BodyAngles;
  lift: number;
  arms: { side: Side; hand: number }[];
  /** Si desde un solo sitio no llega al principio y al final, dónde está al final: se desplaza durante la maniobra. */
  alt?: ExaminerPlan;
};

const Yv = new Vector3(0, 1, 0);
const flat = (v: Vector3) => new Vector3(v.x, 0, v.z);
const limbZero = () => ({ flex: 0, abd: 0 });

type Stance = "stand" | "squat" | "deep" | "kneel" | "heels";
function stanceAngles(kind: Stance, lean: number, neck: number): BodyAngles {
  const L = () => ({ shoulder: { flex: 4, abd: 8 }, elbow: { flex: 14, abd: 0 }, wrist: limbZero(), hip: { flex: lean, abd: 5 }, knee: { flex: 4, abd: 0 }, ankle: limbZero() });
  const A: BodyAngles = { trunkFlex: lean, trunkLat: 0, neckFlex: neck, neckLat: 0, neckYaw: 0, jaw: 0, r: L(), l: L() };
  if (kind === "squat" || kind === "deep") {
    const kf = kind === "squat" ? 50 : 95;
    for (const s of ["r", "l"] as const) {
      A[s].hip.flex = lean + kf / 2;
      A[s].knee.flex = kf;
      A[s].ankle.flex = kf / 2;
      A[s].hip.abd = 9;
    }
  }
  if (kind === "heels") {
    // De rodillas, sentado sobre los talones.
    for (const s of ["r", "l"] as const) {
      A[s].hip.flex = lean + 50;
      A[s].knee.flex = 140;
      A[s].ankle.flex = -80;
      A[s].hip.abd = 10;
    }
  }
  if (kind === "kneel") {
    A.r.hip.flex = lean;
    A.r.knee.flex = 90;
    A.r.ankle.flex = -35;
    A.l.hip.flex = lean + 90;
    A.l.knee.flex = 90;
    A.l.ankle.flex = 0;
  }
  return A;
}

const STANCES: { kind: Stance; cost: number }[] = [
  { kind: "stand", cost: 0 },
  { kind: "squat", cost: 18 },
  { kind: "deep", cost: 34 },
  { kind: "kneel", cost: 40 },
  { kind: "heels", cost: 46 },
];

/** Base de una postura con el examinador mirando en dirección `yaw`. */
const yawQ = (yaw: number) => new Quaternion().setFromAxisAngle(Yv, yaw);

/** Pose del examinador con los brazos en reposo, apoyado en el suelo. */
export function baseExaminerPose(plan: ExaminerPlan, m = 1): Pose3 {
  const p = plan.alt ? blendPlan(plan, plan.alt, m) : plan;
  return fk(new Vector3(p.rootXZ.x, p.lift, p.rootXZ.z), yawQ(p.yaw), p.angles);
}

/** Posición intermedia entre dos colocaciones del examinador (k = 0 la primera, 1 la segunda). */
function blendPlan(a: ExaminerPlan, b: ExaminerPlan, k: number): ExaminerPlan {
  const t = k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
  const mix = (x: number, y: number) => x + (y - x) * t;
  let dy = b.yaw - a.yaw;
  while (dy > Math.PI) dy -= 2 * Math.PI;
  while (dy < -Math.PI) dy += 2 * Math.PI;
  const A = a.angles;
  const B = b.angles;
  const limb = (s: Side) => {
    const out = { ...A[s] };
    for (const j of Object.keys(out) as (keyof BodyAngles["r"])[]) out[j] = { flex: mix(A[s][j].flex, B[s][j].flex), abd: mix(A[s][j].abd, B[s][j].abd) };
    return out;
  };
  const angles: BodyAngles = { ...A, trunkFlex: mix(A.trunkFlex, B.trunkFlex), neckFlex: mix(A.neckFlex, B.neckFlex), r: limb("r"), l: limb("l") };
  return { rootXZ: a.rootXZ.clone().lerp(b.rootXZ, t), yaw: a.yaw + dy * t, angles, lift: mix(a.lift, b.lift), arms: b.arms };
}

/**
 * Decide dónde se coloca. `poses`: el paciente al principio y al final de la maniobra.
 * Devuelve null si el test no lleva manos del examinador.
 */
export function planExaminer(spec: FigureSpec, poses: Pose3[], table: Table | null): ExaminerPlan | null {
  const hands = (spec.hands ?? []).slice(0, 2);
  if (!hands.length || spec.examiner === "none") return null;
  const both = search(spec, poses, table);
  if (both.found) return both.plan;
  // Desde un solo sitio no llega a todo: un sitio para el final de la maniobra y otro para el principio.
  const end = search(spec, [poses[poses.length - 1]!], table);
  const start = end.found ? search(spec, [poses[0]!], table, end.plan.arms) : null;
  return start?.found ? { ...start.plan, alt: end.plan } : both.plan;
}

function search(spec: FigureSpec, poses: Pose3[], table: Table | null, fixedArms?: ExaminerPlan["arms"]): { plan: ExaminerPlan; found: boolean } {
  const hands = (spec.hands ?? []).slice(0, 2);
  const pts = poses.flatMap((p) => hands.map((h) => anchorInfo(p, h)?.p).filter((v): v is Vector3 => !!v));
  const c = pts.reduce((a, b) => a.add(b), new Vector3()).multiplyScalar(1 / pts.length);
  const p0 = poses[0]!;
  const q = p0.trunkQ;
  const dirOf = (v: Vector3) => {
    const f = flat(v.clone().applyQuaternion(q));
    return f.lengthSq() > 0.01 ? f.normalize() : null;
  };
  const lying = LYING.includes(spec.posture);
  const sides = hands.map(anchorSide);
  const side: Side = sides.filter((s) => s === "l").length > sides.filter((s) => s === "r").length ? "l" : "r";
  const FACE = /^(head|neck|jaw|mouth|depressor|[rl]_tmj)/;
  const headish = hands.every((h) => FACE.test(h));
  const midline = sides.every((s) => s === null);

  // Desde dónde se acerca (vector horizontal del centro de las manos hacia el examinador).
  let d: Vector3 | null = null;
  const armish = hands.every((h) => /_(shoulder|upperarm|elbow|forearm|wrist|hand|handtip)/.test(h) || FACE.test(h) || /^(thoracic|trunk)/.test(h));
  if (lying) {
    if (headish && spec.posture !== "sidelying") d = dirOf(new Vector3(0, 1, 0));
    else if (spec.posture === "sidelying") d = dirOf(new Vector3(0, 0, -1));
    else d = dirOf(new Vector3(sgn(side), 0, 0));
  }
  // Depresor lingual (sale por el lado derecho de la boca): el examinador delante y a ese lado.
  else if (hands.includes("depressor")) d = dirOf(new Vector3(-0.8, 0, 1));
  // Los dos brazos a la vez: delante del paciente (se ven sus manos); cabeza y tronco: detrás.
  else if (sides.includes("r") && sides.includes("l") && hands.every((h) => /_(upperarm|elbow|forearm|wrist|hand)/.test(h))) d = dirOf(new Vector3(0, 0, 1));
  else if (midline || (sides.includes("r") && sides.includes("l"))) d = dirOf(new Vector3(0, 0, -1));
  else if (armish) d = dirOf(new Vector3(sgn(side), 0, -0.45));
  else {
    const v = flat(c.clone().sub(p0.root.p));
    d = v.length() > 12 ? v.normalize() : dirOf(new Vector3(sgn(side), 0, 0.4));
    // Pierna de alguien sentado o de pie: el examinador a un lado, para que se vea el pie por delante.
    if (hands.every((h) => /_(knee|shank|ankle|foot|thigh)/.test(h))) d = dirOf(new Vector3(sgn(side), 0, spec.posture === "sitting" ? 0.5 : 0.3));
  }
  d ??= new Vector3(0, 0, 1);

  // El examinador puede ponerse junto a un brazo que sale de la camilla.
  const samples = poses.flatMap((p) => surfaceSamples(p, (part) => !(lying && /upperarm|forearm|hand/.test(part))));
  const trunks = poses.map((p) => surfaceSamples(p, (part) => part === "torso" || part === "head"));
  // La cabeza del examinador puede acercarse a lo que sujeta, pero no meterse en el resto del cuerpo.
  const held = new Set(poses.flatMap((p) => hands.map((h) => anchorInfo(p, h)?.part ?? "")));
  const bodies = poses.map((p) => surfaceSamples(p, (part) => !/hand|forearm/.test(part)));
  const best: { cost: number; plan: ExaminerPlan | null } = { cost: Infinity, plan: null };
  // Primero la dirección natural; si no llega, girando alrededor del paciente.
  for (const turn of [0, 30, -30, 60, -60, 90, -90]) {
    const dd = d.clone().applyAxisAngle(Yv, (turn * Math.PI) / 180);
    const turnCost = (Math.abs(turn) / 30) * 9;
    if (turnCost >= best.cost) break;
    // Distancia mínima: fuera de la camilla y sin pisar al paciente.
    let minDist = lying ? 22 : 16;
    const along = (v: Vector3) => {
      const r = flat(v.clone().sub(c));
      const a2 = r.dot(dd);
      return { a: a2, off: r.addScaledVector(dd, -a2).length() };
    };
    for (const sm of samples) {
      const { a: a2, off } = along(sm.p);
      if (off < 24 && sm.p.y > 4) minDist = Math.max(minDist, a2 + 13);
    }
    if (table) for (const x of [table.x0, table.x1]) for (const z of [table.z0, table.z1]) minDist = Math.max(minDist, along(new Vector3(x, 0, z)).a + 13);
    const yaw = Math.atan2(-dd.x, -dd.z);
    const right = new Vector3(-1, 0, 0).applyQuaternion(yawQ(yaw));
    for (const st of STANCES) {
      for (let extra = 0; extra <= 54; extra += 6) {
        for (let lean = 0; lean <= (st.kind === "heels" || st.kind === "kneel" ? 85 : 60); lean += 5) {
          const cost = turnCost + st.cost + lean * 0.7 + extra * 0.6;
          if (cost >= best.cost) break;
          const plan: ExaminerPlan = { rootXZ: c.clone().setY(0).addScaledVector(dd, minDist + extra), yaw, angles: stanceAngles(st.kind, lean, 0), lift: 0, arms: [] };
          plan.lift = groundLift(plan);
          const base = baseExaminerPose(plan);
          // Brazos: cada mano al punto de su lado.
          const order = hands.map((_, i) => i).sort((x, y) => avgAlong(spec, poses, y, right) - avgAlong(spec, poses, x, right));
          const arms =
            fixedArms ??
            (order.length === 2
              ? [
                  { side: "r" as Side, hand: order[0]! },
                  { side: "l" as Side, hand: order[1]! },
                ]
              : [{ side: (avgAlong(spec, poses, 0, right) - flat(base.root.p).dot(right) >= -4 ? "r" : "l") as Side, hand: 0 }]);
          // Cada mano tiene que llegar de verdad a su punto (muñeca a la distancia del brazo).
          const tmp: ExaminerPlan = { ...plan, arms };
          const ok = poses.every((p) => {
            const cts = contacts(spec, p, base, tmp);
            return arms.every((arm) => {
              const ct = cts[arm.hand];
              if (!ct) return true;
              const S = base.pt[`${arm.side}_shoulder`]!;
              return handTarget(ct, S).W.distanceTo(S) <= DIM.upperarm + DIM.forearm - 0.6;
            });
          });
          if (!ok) continue;
          // La cabeza y el tronco del examinador no pueden meterse en el paciente.
          const clear = trunks.every((tr) => [base.head.p, base.pt.chest!].every((v) => tr.every((sm) => sm.p.distanceTo(v) > 15))) && bodies.every((b) => b.every((sm) => sm.p.distanceTo(base.head.p) > (held.has(sm.part) ? 5 : 10)));
          if (!clear) continue;
          // Mirada hacia las manos.
          const to = c.clone().sub(base.head.p);
          const down = Math.atan2(-to.y, Math.hypot(to.x, to.z)) * (180 / Math.PI);
          plan.angles.neckFlex = Math.max(-15, Math.min(45, down - lean));
          plan.arms = arms;
          best.cost = cost;
          best.plan = plan;
          break;
        }
      }
    }
  }
  if (best.plan) return { plan: best.plan, found: true };
  const yaw = Math.atan2(-d.x, -d.z);
  const plan: ExaminerPlan = { rootXZ: c.clone().setY(0).addScaledVector(d, 40), yaw, angles: stanceAngles("stand", 40, 30), lift: 0, arms: fixedArms ?? [{ side: "r", hand: 0 }, ...(hands.length > 1 ? [{ side: "l" as Side, hand: 1 }] : [])] };
  plan.lift = groundLift(plan);
  return { plan, found: false };
}

/** Dónde cae una mano (su contacto, con la cara de la toma) a lo largo de una dirección, de media. */
function avgAlong(spec: FigureSpec, poses: Pose3[], i: number, dir: Vector3) {
  const v = poses.map((p) => contacts(spec, p, null, null)[i]?.p.dot(dir) ?? 0);
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** Altura para que lo más bajo (planta o rodilla) toque el suelo. */
function groundLift(plan: ExaminerPlan): number {
  const p = fk(new Vector3(plan.rootXZ.x, 0, plan.rootXZ.z), yawQ(plan.yaw), plan.angles);
  const low = surfaceSamples(p, (part) => /foot|shank|thigh/.test(part)).reduce((m, s) => Math.min(m, s.p.y), Infinity);
  return -low;
}

/** Contactos de las manos sobre el paciente en esta pose. */
export function contacts(spec: FigureSpec, pose: Pose3, examiner: Pose3 | null, plan: ExaminerPlan | null): Contact[] {
  const hands = (spec.hands ?? []).slice(0, 2);
  return hands.map((h, i) => {
    const grip = spec.grips?.[i] ?? null;
    const kind: GripKind = grip?.kind ?? "press";
    const info = anchorInfo(pose, h);
    if (!info) return { anchor: h, p: new Vector3(), n: new Vector3(0, 1, 0), part: "", a: new Vector3(), axis: new Vector3(0, 1, 0), r: 1, grip: kind };
    let n: Vector3 | null = grip?.face ? anatDir(pose, grip.face, h, info) : null;
    // Si hay una flecha en ese punto, la mano empuja desde el lado contrario.
    const [hn, ht] = h.split("@");
    for (const ar of n ? [] : (spec.arrows ?? [])) {
      if ("rotate" in ar) continue;
      const [an, at] = ar.at.split("@");
      const same = ar.at === h || (an === hn && Math.abs(Number(at ?? 0.5) - Number(ht ?? 0.5)) < 0.3);
      if (!same) continue;
      n = anatDir(pose, ar.dir, ar.at, info).negate();
      break;
    }
    if (!n) {
      const arm = plan?.arms.find((a) => a.hand === i);
      const from = examiner && arm ? examiner.pt[`${arm.side}_shoulder`]! : info.p.clone().add(new Vector3(0, 30, 0));
      n = from.clone().sub(info.p);
      if (info.limb) n.addScaledVector(info.axis, -n.dot(info.axis));
      n.normalize();
    }
    const r = surfaceRadius(info, n);
    return { anchor: h, p: info.p.clone().addScaledVector(n, r), n, part: info.part, a: info.p.clone(), axis: info.axis.clone(), r, grip: kind };
  });
}

/** Hacia dónde apuntan los dedos: siguiendo el antebrazo, pegados a la superficie. */
function fingers(ct: Contact, S: Vector3) {
  const perp = (v: Vector3) => v.addScaledVector(ct.n, -v.dot(ct.n));
  let fd = perp(ct.p.clone().sub(S));
  // Si el brazo llega justo de frente, los dedos hacia abajo (o hacia un lado si la palma mira abajo).
  if (fd.lengthSq() < 4) fd = perp(new Vector3(0, -1, 0));
  if (fd.lengthSq() < 1e-3) fd = perp(new Vector3(1, 0, 0));
  return fd.normalize();
}

const basis = (bx: Vector3, by: Vector3, bz: Vector3) => new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(bx, by, bz));

/**
 * Dónde va la muñeca y cómo se orienta la mano para cada toma (mano: dedos hacia −y, palma hacia +z):
 * - press: el centro de la palma sobre el contacto, dedos siguiendo el antebrazo, mano casi plana.
 * - grasp: la palma en la cara elegida y los dedos rodeando el segmento (el eje del segmento en el centro
 *   de la curva de los dedos).
 * - tips: los dedos doblados y las yemas sobre el punto.
 */
export function handTarget(ct: Contact, S: Vector3): { W: Vector3; q: Quaternion; curl: number } {
  const z = ct.n.clone().negate();
  if (ct.grip === "grasp") {
    let t = new Vector3().crossVectors(ct.axis, ct.n);
    if (t.lengthSq() < 1e-4) t = fingers(ct, S);
    t.normalize();
    // Los dedos rodean el segmento por el lado de fuera (lejos del examinador).
    if (t.dot(ct.a.clone().sub(S)) < 0) t.negate();
    const R = Math.min(10, Math.max(3.5, ct.r + 1.3));
    const y = t.clone().negate();
    const q = basis(new Vector3().crossVectors(y, z), y, z);
    return { W: ct.a.clone().addScaledVector(t, KNUCKLE_Y).addScaledVector(ct.n, R), q, curl: R };
  }
  const fd = fingers(ct, S);
  const y = fd.clone().negate();
  const q = basis(new Vector3().crossVectors(y, z), y, z);
  if (ct.grip === "tips") {
    const curl = 8;
    const [ty, tz] = bendPoint(-18.4, 0.8, curl);
    const tip = new Vector3(0, ty, tz).applyQuaternion(q);
    return { W: ct.p.clone().addScaledVector(ct.n, 0.5).sub(tip), q, curl };
  }
  return { W: ct.p.clone().addScaledVector(fd, -5.5).addScaledVector(ct.n, 1.7), q, curl: 60 };
}

/** Codo de un brazo de dos segmentos que llega del hombro S a la muñeca W, hacia el lado de `pole`. */
function armIK(S: Vector3, W: Vector3, pole: Vector3) {
  const a = DIM.upperarm;
  const b = DIM.forearm;
  const dv = W.clone().sub(S);
  const L = Math.min(a + b - 0.4, Math.max(Math.abs(a - b) + 1, dv.length()));
  const u = dv.lengthSq() > 1e-6 ? dv.normalize() : new Vector3(0, -1, 0);
  const x = (a * a - b * b + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const pv = pole.clone().addScaledVector(u, -pole.dot(u));
  if (pv.lengthSq() < 1e-6) pv.set(0, 0, -1).addScaledVector(u, -u.z);
  pv.normalize();
  const E = S.clone().addScaledVector(u, x).addScaledVector(pv, h);
  const Wc = S.clone().addScaledVector(u, L);
  const f1 = E.clone().sub(S).normalize();
  const f2 = Wc.clone().sub(E).normalize();
  const y1 = f1.clone().negate();
  let z1 = f2.clone().addScaledVector(f1, -f2.dot(f1));
  if (z1.lengthSq() < 1e-4) z1 = pv.clone().negate();
  z1.normalize();
  const x1 = new Vector3().crossVectors(y1, z1);
  const y2 = f2.clone().negate();
  const z2 = new Vector3().crossVectors(x1, y2).normalize();
  return { E, W: Wc, uaQ: basis(x1, y1, z1), faQ: basis(x1.clone(), y2, z2) };
}

/**
 * Pose del examinador en este momento: brazos de la posición de reposo (reach = 0) a las manos sobre
 * el paciente (reach = 1).
 */
export function examinerPose(plan: ExaminerPlan, cts: Contact[], reach: number, m = 1): Pose3 {
  const pose = baseExaminerPose(plan, m);
  for (const arm of plan.arms) {
    const ct = cts[arm.hand];
    if (!ct) continue;
    const s = arm.side;
    const S = pose.pt[`${s}_shoulder`]!;
    const target = handTarget(ct, S);
    const restW = pose.pt[`${s}_wrist`]!.clone();
    const W = restW.clone().lerp(target.W, reach);
    const pole = new Vector3(sgn(s) * 0.8, -1, -0.45).applyQuaternion(pose.trunkQ);
    const ik = armIK(S, W, pole);
    const restQ = pose.seg[`${s}_hand`].q.clone();
    pose.hands = { ...pose.hands, [s]: { curl: HAND_REST_CURL + (target.curl - HAND_REST_CURL) * reach, grip: reach > 0.5 ? ct.grip : "rest" } };
    pose.seg[`${s}_upperarm`] = { p: S.clone(), q: ik.uaQ };
    pose.seg[`${s}_forearm`] = { p: ik.E, q: ik.faQ };
    pose.seg[`${s}_hand`] = { p: ik.W, q: restQ.slerp(target.q, reach) };
    pose.pt[`${s}_elbow`] = ik.E.clone();
    pose.pt[`${s}_wrist`] = ik.W.clone();
    pose.pt[`${s}_handtip`] = ik.W.clone().add(new Vector3(0, -DIM.hand, 0).applyQuaternion(pose.seg[`${s}_hand`].q));
  }
  return pose;
}
