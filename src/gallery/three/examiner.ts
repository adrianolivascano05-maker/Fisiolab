// El examinador en 3D: dónde se pone (junto a la camilla, delante, detrás o a un lado del paciente), cuánto
// se inclina o se agacha para llegar, y sus brazos, que van a las manos del test con cinemática inversa.
// Las manos se apoyan en la superficie del paciente (no dentro), con la palma hacia él y en el lado
// contrario a la fuerza que hacen.
import { Matrix4, Quaternion, Vector3 } from "three";
import type { Anchor, FigureSpec } from "../figure";
import type { Table } from "./layout";
import { anatDir, anchorInfo, anchorSide, DIM, fk, LYING, sgn, surfaceRadius, surfaceSamples, type BodyAngles, type Pose3, type Side } from "./rig";


/** Punto de apoyo de una mano: dónde toca, hacia dónde mira la palma (−n) y hacia dónde van los dedos. */
export type Contact = { anchor: Anchor; p: Vector3; n: Vector3; part: string };

export type ExaminerPlan = { rootXZ: Vector3; yaw: number; angles: BodyAngles; lift: number; arms: { side: Side; hand: number }[] };

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
export function baseExaminerPose(plan: ExaminerPlan): Pose3 {
  return fk(new Vector3(plan.rootXZ.x, plan.lift, plan.rootXZ.z), yawQ(plan.yaw), plan.angles);
}

/**
 * Decide dónde se coloca. `poses`: el paciente al principio y al final de la maniobra.
 * Devuelve null si el test no lleva manos del examinador.
 */
export function planExaminer(spec: FigureSpec, poses: Pose3[], table: Table | null): ExaminerPlan | null {
  const hands = (spec.hands ?? []).slice(0, 2);
  if (!hands.length || spec.examiner === "none") return null;
  const pts = poses.flatMap((p) => hands.map((h) => anchorInfo(p, h)?.p).filter((v): v is Vector3 => !!v));
  if (!pts.length) return null;
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
          const order = hands.map((_, i) => i).sort((x, y) => avgAlong(poses, hands[y]!, right) - avgAlong(poses, hands[x]!, right));
          const arms =
            order.length === 2
              ? [
                  { side: "r" as Side, hand: order[0]! },
                  { side: "l" as Side, hand: order[1]! },
                ]
              : [{ side: (avgAlong(poses, hands[0]!, right) - flat(base.root.p).dot(right) >= -4 ? "r" : "l") as Side, hand: 0 }];
          // Cada mano tiene que llegar de verdad a su punto (muñeca a la distancia del brazo).
          const tmp: ExaminerPlan = { ...plan, arms };
          const ok = poses.every((p) => {
            const cts = contacts(spec, p, base, tmp);
            return arms.every((arm) => {
              const ct = cts[arm.hand];
              if (!ct) return true;
              const S = base.pt[`${arm.side}_shoulder`]!;
              return wristTarget(ct, S).distanceTo(S) <= DIM.upperarm + DIM.forearm - 0.6;
            });
          });
          if (!ok) continue;
          // La cabeza y el tronco del examinador no pueden meterse en el paciente.
          const clear = trunks.every((tr) => [base.head.p, base.pt.chest!].every((v) => tr.every((sm) => sm.p.distanceTo(v) > 15))) && bodies.every((b) => b.every((sm) => sm.p.distanceTo(base.head.p) > 10));
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
  if (best.plan) return best.plan;
  const yaw = Math.atan2(-d.x, -d.z);
  const plan: ExaminerPlan = { rootXZ: c.clone().setY(0).addScaledVector(d, 40), yaw, angles: stanceAngles("stand", 40, 30), lift: 0, arms: [{ side: "r", hand: 0 }, ...(hands.length > 1 ? [{ side: "l" as Side, hand: 1 }] : [])] };
  plan.lift = groundLift(plan);
  return plan;
}

function avgAlong(poses: Pose3[], h: Anchor, dir: Vector3) {
  const v = poses.map((p) => anchorInfo(p, h)?.p.dot(dir) ?? 0);
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
    const info = anchorInfo(pose, h);
    if (!info) return { anchor: h, p: new Vector3(), n: new Vector3(0, 1, 0), part: "" };
    let n: Vector3 | null = null;
    // Si hay una flecha en ese punto, la mano empuja desde el lado contrario.
    const [hn, ht] = h.split("@");
    for (const ar of spec.arrows ?? []) {
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
    return { anchor: h, p: info.p.clone().addScaledVector(n, r), n, part: info.part };
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

/** Muñeca para que el centro de la palma quede sobre el contacto (8 cm antes, a 1,7 cm de la superficie). */
function wristTarget(ct: Contact, S: Vector3) {
  return ct.p.clone().addScaledVector(fingers(ct, S), -8).addScaledVector(ct.n, 1.7);
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
  const basis = (bx: Vector3, by: Vector3, bz: Vector3) => new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(bx, by, bz));
  return { E, W: Wc, uaQ: basis(x1, y1, z1), faQ: basis(x1.clone(), y2, z2) };
}

/**
 * Pose del examinador en este momento: brazos de la posición de reposo (reach = 0) a las manos sobre
 * el paciente (reach = 1).
 */
export function examinerPose(plan: ExaminerPlan, cts: Contact[], reach: number): Pose3 {
  const pose = baseExaminerPose(plan);
  for (const arm of plan.arms) {
    const ct = cts[arm.hand];
    if (!ct) continue;
    const s = arm.side;
    const S = pose.pt[`${s}_shoulder`]!;
    const fd = fingers(ct, S);
    const Wt = wristTarget(ct, S);
    const restW = pose.pt[`${s}_wrist`]!.clone();
    const W = restW.clone().lerp(Wt, reach);
    const pole = new Vector3(sgn(s) * 0.8, -1, -0.45).applyQuaternion(pose.trunkQ);
    const ik = armIK(S, W, pole);
    const yh = fd.clone().negate();
    const zh = ct.n.clone().negate();
    const xh = new Vector3().crossVectors(yh, zh);
    const handQ = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(xh, yh, zh));
    const restQ = pose.seg[`${s}_hand`].q.clone();
    pose.seg[`${s}_upperarm`] = { p: S.clone(), q: ik.uaQ };
    pose.seg[`${s}_forearm`] = { p: ik.E, q: ik.faQ };
    pose.seg[`${s}_hand`] = { p: ik.W, q: restQ.slerp(handQ, reach) };
    pose.pt[`${s}_elbow`] = ik.E.clone();
    pose.pt[`${s}_wrist`] = ik.W.clone();
    pose.pt[`${s}_handtip`] = ik.W.clone().add(new Vector3(0, -DIM.hand, 0).applyQuaternion(pose.seg[`${s}_hand`].q));
  }
  return pose;
}
