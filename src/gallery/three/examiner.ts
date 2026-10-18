// El examinador en 3D: dónde se pone (junto a la camilla, delante, detrás o a un lado del paciente), cuánto
// se inclina o se agacha para llegar, y sus brazos, que van a las manos del test con cinemática inversa.
// Las manos se apoyan en la superficie del paciente (no dentro), con la palma hacia él y en el lado
// contrario a la fuerza que hacen. Ni su cuerpo ni sus brazos se meten en el paciente ni en la camilla, el
// codo va hacia donde la muñeca queda en una postura posible, y si desde un sitio no llega a todo, se mueve.
// Buscar el sitio cuesta (comprueba muchos choques): las colocaciones de las figuras de la galería están
// precalculadas en plans.json (node scripts/gallery3d-plans.mjs) y solo se buscan si la figura cambia.
import { Matrix4, Quaternion, Vector3 } from "three";
import type { Anchor, FigureSpec } from "../figure";
import { cameraKey } from "./cameras";
import { bodySDF, skinPoints, tableD, type BodySDF } from "./collide";
import type { Table } from "./layout";
import stored from "./plans.json";
import { anatDir, anchorInfo, anchorSide, bendPoint, DIM, fk, HAND_REST_CURL, KNUCKLE_Y, LYING, sgn, surfaceRadius, surfaceSamples, type BodyAngles, type Pose3, type Side } from "./rig";

/** Punto de apoyo de una mano: dónde toca (p, en la superficie), hacia dónde mira la palma (−n), el eje y
 *  el radio del segmento en ese punto (a, axis, r) y la toma. */
export type Contact = { anchor: Anchor; p: Vector3; n: Vector3; part: string; a: Vector3; axis: Vector3; r: number; grip: GripKind; frame: Quaternion };
type GripKind = "press" | "grasp" | "tips";

/**
 * Un brazo: qué mano del test lleva y hacia dónde apunta el codo (grados alrededor de la línea hombro-muñeca,
 * al principio y al final de la maniobra). La orientación de la mano va referida al segmento que toca, para
 * que se mueva con él: `spin`, con la palma o las yemas, el ángulo de los dedos sobre la superficie desde el
 * eje del segmento; abarcando, el giro de la palma alrededor del segmento; `wrap`, abarcando, hacia qué lado
 * del segmento (ángulo en su sección) rodean los dedos.
 */
export type ArmPlan = { side: Side; hand: number; pole: [number, number]; spin: number; wrap?: number; /** Al final, si se desplaza. */ spin1?: number; wrap1?: number };

/** Orientación de la mano de un brazo en el momento m (pasa poco a poco de la del principio a la del final). */
export function handAt(arm: ArmPlan, m: number): { spin: number; wrap?: number } {
  const k = m <= 0 ? 0 : m >= 1 ? 1 : m * m * (3 - 2 * m);
  const spin = arm.spin1 === undefined ? arm.spin : arm.spin + angleDiff(arm.spin, arm.spin1) * k;
  const wrap = arm.wrap === undefined ? undefined : arm.wrap1 === undefined ? arm.wrap : arm.wrap + angleDiff(arm.wrap, arm.wrap1) * k;
  return { spin, ...(wrap !== undefined ? { wrap } : {}) };
}

export type ExaminerPlan = {
  rootXZ: Vector3;
  yaw: number;
  stance: Stance;
  lean: number;
  angles: BodyAngles;
  lift: number;
  arms: ArmPlan[];
  /** Si desde un solo sitio no llega al principio y al final, dónde está al final: se desplaza durante la maniobra. */
  alt?: ExaminerPlan;
};

const Yv = new Vector3(0, 1, 0);
const flat = (v: Vector3) => new Vector3(v.x, 0, v.z);
const limbZero = () => ({ flex: 0, abd: 0 });
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export type Stance = "stand" | "sit" | "squat" | "deep" | "kneel" | "heels";
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
  if (kind === "sit") {
    // Sentado en un taburete, rodillas algo separadas.
    for (const s of ["r", "l"] as const) {
      A[s].hip.flex = lean + 88;
      A[s].knee.flex = 88;
      A[s].ankle.flex = 0;
      A[s].hip.abd = 22;
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

const STANCES: { kind: Stance; cost: number; maxLean: number }[] = [
  { kind: "stand", cost: 0, maxLean: 60 },
  { kind: "sit", cost: 14, maxLean: 45 },
  { kind: "squat", cost: 18, maxLean: 60 },
  { kind: "deep", cost: 34, maxLean: 60 },
  { kind: "kneel", cost: 40, maxLean: 85 },
  { kind: "heels", cost: 46, maxLean: 85 },
];

/** Altura máxima (cm) de las manos del test para cada postura. */
const STANCE_MAX_Y: Record<Stance, number> = { stand: Infinity, sit: Infinity, squat: 100, deep: 90, kneel: 60, heels: 60 };

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
  // Si se desplaza, da pasos: levanta un pie y luego el otro.
  const dist = a.rootXZ.distanceTo(b.rootXZ);
  if (dist > 12 && t > 0 && t < 1) {
    const ph = t * Math.max(2, Math.ceil(dist / 30));
    const leg: Side = Math.floor(ph) % 2 === 0 ? "r" : "l";
    const up = Math.sin(Math.PI * (ph - Math.floor(ph)));
    angles[leg].hip.flex += 22 * up;
    angles[leg].knee.flex += 40 * up;
    angles[leg].ankle.flex += 12 * up;
  }
  return { ...a, rootXZ: a.rootXZ.clone().lerp(b.rootXZ, t), yaw: a.yaw + dy * t, angles, lift: mix(a.lift, b.lift) };
}

// ---------- Colocaciones precalculadas ----------

type StoredArm = { s: Side; h: number; p: [number, number]; sp: number; w?: number; sp1?: number; w1?: number };
type StoredPlan = { r: [number, number]; y: number; s: Stance; l: number; n: number; h: number; a: StoredArm[]; alt?: StoredPlan };
const PLANS = stored as unknown as Record<string, StoredPlan>;

const r2 = (v: number, d = 2) => +v.toFixed(d);
/** Colocación en forma compacta, para guardarla en plans.json. */
export function packPlan(p: ExaminerPlan): StoredPlan {
  return {
    r: [r2(p.rootXZ.x), r2(p.rootXZ.z)],
    y: r2(p.yaw, 4),
    s: p.stance,
    l: p.lean,
    n: r2(p.angles.neckFlex, 1),
    h: r2(p.lift),
    a: p.arms.map((x) => ({
      s: x.side,
      h: x.hand,
      p: x.pole,
      sp: x.spin,
      ...(x.wrap !== undefined ? { w: x.wrap } : {}),
      ...(x.spin1 !== undefined ? { sp1: x.spin1 } : {}),
      ...(x.wrap1 !== undefined ? { w1: x.wrap1 } : {}),
    })),
    ...(p.alt ? { alt: packPlan(p.alt) } : {}),
  };
}
function unpack(s: StoredPlan): ExaminerPlan {
  return {
    rootXZ: new Vector3(s.r[0], 0, s.r[1]),
    yaw: s.y,
    stance: s.s,
    lean: s.l,
    angles: stanceAngles(s.s, s.l, s.n),
    lift: s.h,
    arms: s.a.map((a) => ({ side: a.s, hand: a.h, pole: a.p, spin: a.sp, ...(a.w !== undefined ? { wrap: a.w } : {}), ...(a.sp1 !== undefined ? { spin1: a.sp1 } : {}), ...(a.w1 !== undefined ? { wrap1: a.w1 } : {}) })),
    ...(s.alt ? { alt: unpack(s.alt) } : {}),
  };
}

/**
 * Decide dónde se coloca. `poses`: el paciente al principio, a mitad (opcional) y al final de la maniobra.
 * Devuelve null si el test no lleva manos del examinador. Usa la colocación guardada si la hay.
 */
export function planExaminer(spec: FigureSpec, poses: Pose3[], table: Table | null, fresh = false): ExaminerPlan | null {
  const hands = (spec.hands ?? []).slice(0, 2);
  if (!hands.length || spec.examiner === "none") return null;
  const saved = fresh ? undefined : PLANS[cameraKey(spec)];
  if (saved) return unpack(saved);
  const ctx = context(spec, poses, table);
  const both = search(ctx, [0, 1]);
  // Desde un solo sitio no llega a todo, o solo con los brazos en mala postura: un sitio para el final de la
  // maniobra y otro para el principio (con cada mano en el mismo brazo, y sin atravesar nada por el camino).
  if (both.found && both.arms < 2.5) return both.plan;
  const pair = (first: number, second: number) => {
    const a = search(ctx, [first], undefined, undefined, true);
    if (!a.found) return null;
    // La segunda colocación, con cada mano en el mismo brazo.
    const b = search(ctx, [second], a.plan.arms, a.plan);
    return b.found ? { ...(first === 1 ? { start: b.plan, end: a.plan } : { start: a.plan, end: b.plan }), arms: a.arms + b.arms } : null;
  };
  const prs = [pair(1, 0), pair(0, 1)].filter((x) => !!x).sort((x, y) => x.arms - y.arms);
  const pr = prs[0];
  if (!pr || (both.found && pr.arms + 1.5 >= both.arms)) return both.plan;
  const { start, end } = pr;
  const arms = start.arms.map((a) => {
    const b = end.arms.find((x) => x.side === a.side);
    return { ...a, pole: [a.pole[0], b?.pole[1] ?? a.pole[1]] as [number, number], ...(b ? { spin1: b.spin, ...(b.wrap !== undefined ? { wrap1: b.wrap } : {}) } : {}) };
  });
  return { ...start, arms, alt: { ...end, arms } };
}

/** Lo que la búsqueda necesita del paciente: poses y distancia a su piel (también a mitad de maniobra). */
type Ctx = { spec: FigureSpec; poses: Pose3[]; sdf: BodySDF[]; midPose: Pose3; mid: BodySDF; table: Table | null; hands: Anchor[] };
function context(spec: FigureSpec, poses: Pose3[], table: Table | null): Ctx {
  const p0 = poses[0]!;
  const p1 = poses[poses.length - 1]!;
  const midPose = poses.length > 2 ? poses[1]! : interpPose(p0, p1);
  return { spec, poses: [p0, p1], sdf: [bodySDF(p0), bodySDF(p1)], midPose, mid: bodySDF(midPose), table, hands: (spec.hands ?? []).slice(0, 2) };
}

/** Pose a mitad de camino entre dos (solo para comprobar choques). */
function interpPose(a: Pose3, b: Pose3): Pose3 {
  const xf = (x: { p: Vector3; q: Quaternion }, y: { p: Vector3; q: Quaternion }) => ({ p: x.p.clone().lerp(y.p, 0.5), q: x.q.clone().slerp(y.q, 0.5) });
  const seg = {} as Pose3["seg"];
  for (const k of Object.keys(a.seg) as (keyof Pose3["seg"])[]) seg[k] = xf(a.seg[k], b.seg[k]);
  const pt: Record<string, Vector3> = {};
  for (const k of Object.keys(a.pt)) pt[k] = a.pt[k]!.clone().lerp(b.pt[k]!, 0.5);
  return { ...a, root: xf(a.root, b.root), trunkQ: a.trunkQ.clone().slerp(b.trunkQ, 0.5), pelvisQ: a.pelvisQ.clone().slerp(b.pelvisQ, 0.5), spine: a.spine.map((f, i) => xf(f, b.spine[i]!)), neck: xf(a.neck, b.neck), head: xf(a.head, b.head), seg, pt };
}


type Cand = { cost: number; turn: number; yawOff: number; st: (typeof STANCES)[number]; extra: number; lean: number };

function search(ctx: Ctx, which: number[], fixedArms?: ArmPlan[], other?: ExaminerPlan, standing = false): { plan: ExaminerPlan; found: boolean; arms: number } {
  const { spec, table, hands } = ctx;
  const poses = which.map((i) => ctx.poses[i]!);
  const sdfs = which.map((i) => ctx.sdf[i]!);
  const pts = poses.flatMap((p) => hands.map((h) => anchorInfo(p, h)?.p).filter((v): v is Vector3 => !!v));
  const c = pts.reduce((a, b) => a.add(b), new Vector3()).multiplyScalar(1 / pts.length);
  const d = approach(spec, poses, c);
  const lying = LYING.includes(spec.posture);

  // Lo que el cuerpo del examinador no puede tocar: el paciente (también a mitad de maniobra) y la camilla.
  const all = [...sdfs, ...(which.length > 1 ? [ctx.mid] : [])];
  const free = (p: Vector3, margin: number) => all.every((f) => f(p).d > margin) && (!table || tableD(table, p) > margin * 0.5);
  // Al paciente tumbado, el examinador puede tenerle un brazo fuera de la camilla al lado.
  const samples = poses.flatMap((p) => surfaceSamples(p, (part) => !(lying && /upperarm|forearm|hand/.test(part))));

  const cands: Cand[] = [];
  const minDist = new Map<number, number>();
  for (const turn of [0, 30, -30, 60, -60, 90, -90, 120, -120]) {
    const dd = d.clone().applyAxisAngle(Yv, rad(turn));
    // Distancia mínima: fuera de la camilla y sin pisar al paciente.
    let md = lying ? 20 : 14;
    const along = (v: Vector3) => {
      const r = flat(v.clone().sub(c));
      const a2 = r.dot(dd);
      return { a: a2, off: r.addScaledVector(dd, -a2).length() };
    };
    for (const sm of samples) {
      const { a: a2, off } = along(sm.p);
      if (off < 22 && sm.p.y > 4) md = Math.max(md, a2 + 11);
    }
    if (table) for (const x of [table.x0, table.x1]) for (const z of [table.z0, table.z1]) md = Math.max(md, along(new Vector3(x, 0, z)).a + 11);
    minDist.set(turn, md);
    for (const yawOff of [0, 25, -25]) {
      // Si va a desplazarse entre dos sitios, de pie o agachado (el taburete no le sigue y de rodillas no se
      // anda). Agacharse o arrodillarse,
      // solo para lo que está bajo (los pies de alguien de pie, la pierna de alguien sentado).
      const usable = STANCES.filter((x) => (!(standing || other) || !["sit", "kneel", "heels"].includes(x.kind)) && c.y < STANCE_MAX_Y[x.kind]);
      for (const st of usable) {
        for (let extra = 0; extra <= 54; extra += 6) {
          for (let lean = 0; lean <= st.maxLean; lean += 5) {
            cands.push({ cost: (Math.abs(turn) / 30) * 9 + Math.abs(yawOff) * 0.12 + st.cost + lean * 0.7 + lean * lean * 0.006 + extra * 0.6, turn, yawOff, st, extra, lean });
          }
        }
      }
    }
  }
  cands.sort((a, b) => a.cost - b.cost);

  let best: { total: number; plan: ExaminerPlan | null; arms: number } = { total: Infinity, plan: null, arms: 0 };
  let tried = 0;
  for (const cd of cands) {
    // Se evalúan los brazos de unas cuantas colocaciones; si ninguna queda bien, de más.
    if (cd.cost >= best.total || tried > (best.total - cd.cost > 60 ? 160 : 40)) break;
    const dd = d.clone().applyAxisAngle(Yv, rad(cd.turn));
    const yaw = Math.atan2(-dd.x, -dd.z) + rad(cd.yawOff);
    const plan: ExaminerPlan = { rootXZ: c.clone().setY(0).addScaledVector(dd, minDist.get(cd.turn)! + cd.extra), yaw, stance: cd.st.kind, lean: cd.lean, angles: stanceAngles(cd.st.kind, cd.lean, 0), lift: 0, arms: [] };
    plan.lift = groundLift(plan);
    // Mirada hacia las manos (antes de comprobar choques: la cabeza se mueve con el cuello).
    const head0 = baseExaminerPose(plan).head.p;
    const to = c.clone().sub(head0);
    plan.angles.neckFlex = Math.max(-15, Math.min(45, deg(Math.atan2(-to.y, Math.hypot(to.x, to.z))) - cd.lean));
    const base = baseExaminerPose(plan);
    const right = new Vector3(-1, 0, 0).applyQuaternion(yawQ(yaw));
    // Cada mano al punto de su lado.
    const order = hands.map((_, i) => i).sort((x, y) => avgAlong(spec, poses, y, right) - avgAlong(spec, poses, x, right));
    const arms =
      fixedArms?.map((a) => ({ side: a.side, hand: a.hand })) ??
      (order.length === 2
        ? [
            { side: "r" as Side, hand: order[0]! },
            { side: "l" as Side, hand: order[1]! },
          ]
        : [{ side: (avgAlong(spec, poses, 0, right) - flat(base.root.p).dot(right) >= -4 ? "r" : "l") as Side, hand: 0 }]);
    // Cada mano tiene que llegar de verdad a su punto (muñeca a la distancia del brazo).
    const tmp: ExaminerPlan = { ...plan, arms: arms.map((a) => ({ ...a, pole: [0, 0], spin: 0 })) };
    const cts = poses.map((p) => contacts(spec, p, base, tmp));
    const reach = arms.every((arm) => {
      const S = base.pt[`${arm.side}_shoulder`]!;
      return cts.every((ct) => !ct[arm.hand] || handTarget(ct[arm.hand]!, S).W.distanceTo(S) <= DIM.upperarm + DIM.forearm - 0.6);
    });
    if (!reach) continue;
    // Cuerpo, cabeza y piernas (y el taburete) fuera del paciente y de la camilla.
    const body = [...skinPoints(base, (part) => !/upperarm|forearm|hand/.test(part), 2), ...stoolPoints(plan)];
    if (!body.every((sp) => free(sp.p, /torso|head|neck/.test(sp.part) ? 2.5 : 0.8))) continue;
    // La cabeza, sin pegarse a la persona.
    if (!all.every((f) => f(base.head.p).d > 12)) continue;
    // Si se desplaza entre dos sitios, el camino también tiene que estar libre.
    if (other) {
      const path = [0.33, 0.66].flatMap((k) => skinPoints(baseExaminerPose({ ...plan, alt: other }, k), (part) => !/upperarm|forearm|hand/.test(part), 2.5));
      if (!path.every((sp) => [...ctx.sdf, ctx.mid].every((f) => f(sp.p).d > 0.5) && (!table || tableD(table, sp.p) > 0.3))) continue;
    }
    // Brazos: el mejor codo y giro de cada mano (choques, muñeca, naturalidad).
    tried++;
    const own = bodySDF(base);
    // Si se desplaza, cómo está a mitad de camino (este sitio es el principio si se busca el momento 0).
    const blend = other ? (which[0] === 0 ? baseExaminerPose({ ...plan, alt: other }, 0.5) : baseExaminerPose({ ...other, alt: plan }, 0.5)) : null;
    const blendOwn = blend ? bodySDF(blend) : null;
    let armsCost = 0;
    const armPlans: ArmPlan[] = [];
    for (const arm of arms) {
      const S = base.pt[`${arm.side}_shoulder`]!;
      const ctOf = (k: number) => cts[k]![arm.hand]!;
      if (!ctOf(0)) continue;
      const midCt = poses.length > 1 ? contacts(spec, ctx.midPose, base, tmp)[arm.hand] : undefined;
      const otherArm = other?.arms.find((a) => a.side === arm.side);
      const blendCt = blend ? contacts(spec, ctx.midPose, blend, tmp)[arm.hand] : undefined;
      // Primero lo normal (mano sin girar, codo cada 45°); si no queda bien, se prueba todo.
      // Orientaciones de la mano que se prueban, referidas al segmento (la natural primero).
      const c0 = ctOf(0);
      const grasp = c0.grip === "grasp";
      const natural = grasp ? 0 : fingerAngle(c0, fingers(c0, S));
      const options = (full: boolean): { spin: number; wrap?: number; extra: number }[] => {
        if (!grasp) return (full ? [0, -30, 30, -60, 60, -90, 90, 180] : [0]).map((d) => ({ spin: Math.round(natural + d), extra: Math.abs(d) * 0.01 }));
        return (full ? [0, -30, 30, -60, 60] : [0]).flatMap((sp) =>
          (full ? [false, true] : [false]).map((other) => ({ spin: sp, wrap: wrapAngle(c0, S, sp, other), extra: Math.abs(sp) * 0.01 + (other ? 0.2 : 0) })),
        );
      };
      // Codo al principio y al final; a mitad de maniobra va de uno a otro, así que también se comprueba.
      const tryArm = (opts: { spin: number; wrap?: number; extra: number }[], step: number) => {
        let pick: { cost: number; pole: [number, number]; spin: number; wrap?: number } = { cost: Infinity, pole: [0, 0], spin: 0 };
        const ths: number[] = [];
        for (let th = -180; th < 180; th += step) ths.push(th);
        for (const o of opts) {
          const cs = poses.map((_, k) => ths.map((th) => armCost(ctOf(k), S, base, arm.side, o, th, sdfs[k]!, own, table)));
          const best = (c: number[]) => ths.map((_, i) => i).sort((a, b) => c[a]! - c[b]!).slice(0, 4);
          let bestPair = { c: Infinity, pole: [0, 0] as [number, number] };
          if (poses.length === 1) {
            for (const i of best(cs[0]!)) {
              // Desplazándose: el codo va de un sitio al otro y a mitad de camino también tiene que estar bien.
              let mid = 0;
              if (blend && blendCt && otherArm) {
                const mine: ArmPlan = { ...arm, pole: [ths[i]!, ths[i]!], spin: o.spin, ...(o.wrap !== undefined ? { wrap: o.wrap } : {}) };
                const [st, en] = which[0] === 0 ? [mine, otherArm] : [otherArm, mine];
                const both: ArmPlan = { ...st, pole: [st.pole[0], en.pole[1]], spin1: en.spin, ...(en.wrap !== undefined ? { wrap1: en.wrap } : {}) };
                mid = armCost(blendCt, blend.pt[`${arm.side}_shoulder`]!, blend, arm.side, handAt(both, 0.5), st.pole[0] + angleDiff(st.pole[0], en.pole[1]) / 2, ctx.mid, blendOwn!, table);
              }
              const c = cs[0]![i]! + mid;
              if (c < bestPair.c) bestPair = { c, pole: [ths[i]!, ths[i]!] };
            }
          } else {
            for (const i of best(cs[0]!)) {
              for (const j of best(cs[1]!)) {
                const d = angleDiff(ths[i]!, ths[j]!);
                const mid = midCt ? armCost(midCt, S, base, arm.side, o, ths[i]! + d / 2, ctx.mid, own, table) : 0;
                const c = cs[0]![i]! + cs[1]![j]! + mid + Math.abs(d) * 0.004;
                if (c < bestPair.c) bestPair = { c, pole: [ths[i]!, ths[j]!] };
              }
            }
          }
          const tot = o.extra + bestPair.c;
          if (tot < pick.cost) pick = { cost: tot, pole: bestPair.pole, spin: o.spin, ...(o.wrap !== undefined ? { wrap: o.wrap } : {}) };
        }
        return pick;
      };
      let pick = tryArm(options(false), 45);
      if (pick.cost > 0.3) {
        const full = tryArm(options(true), 30);
        if (full.cost < pick.cost) pick = full;
      }
      armsCost += pick.cost;
      armPlans.push({ ...arm, pole: pick.pole, spin: pick.spin, ...(pick.wrap !== undefined ? { wrap: pick.wrap } : {}) });
    }
    const total = cd.cost + armsCost * 6;
    if (total >= best.total) continue;
    plan.arms = armPlans;
    best = { total, plan, arms: armsCost };
  }
  if (best.plan) return { plan: best.plan, found: true, arms: best.arms };
  const yaw = Math.atan2(-d.x, -d.z);
  const arms = fixedArms ?? [{ side: "r" as Side, hand: 0 }, ...(hands.length > 1 ? [{ side: "l" as Side, hand: 1 }] : [])];
  const plan: ExaminerPlan = { rootXZ: c.clone().setY(0).addScaledVector(d, 40), yaw, stance: "stand", lean: 40, angles: stanceAngles("stand", 40, 30), lift: 0, arms: arms.map((a) => ({ side: a.side, hand: a.hand, pole: [0, 0], spin: 0 })) };
  plan.lift = groundLift(plan);
  return { plan, found: false, arms: Infinity };
}

/** Taburete bajo el examinador sentado: centro del asiento y su altura (o null si no está sentado). */
export function stoolOf(plan: ExaminerPlan, m = 1): { x: number; z: number; h: number } | null {
  if (plan.stance !== "sit") return null;
  const p = baseExaminerPose(plan, m);
  const back = new Vector3(0, 0, -4).applyQuaternion(p.root.q).add(p.root.p);
  // El asiento, justo debajo de los glúteos y los muslos.
  const low = Math.min(...skinPoints(p, (part) => part === "torso" || /thigh/.test(part)).filter((x) => x.p.distanceTo(p.root.p) < 26).map((x) => x.p.y));
  return { x: back.x, z: back.z, h: low };
}

function stoolPoints(plan: ExaminerPlan): { part: string; p: Vector3 }[] {
  const st = stoolOf(plan);
  if (!st) return [];
  const out: { part: string; p: Vector3 }[] = [];
  for (const y of [st.h - 2, st.h * 0.5, 4]) for (let i = 0; i < 8; i++) out.push({ part: "stool", p: new Vector3(st.x + 17 * Math.cos((i * Math.PI) / 4), y, st.z + 17 * Math.sin((i * Math.PI) / 4)) });
  return out;
}

/** Desde dónde se acerca (vector horizontal del centro de las manos hacia el examinador). */
function approach(spec: FigureSpec, poses: Pose3[], c: Vector3): Vector3 {
  const hands = (spec.hands ?? []).slice(0, 2);
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
  let d: Vector3 | null = null;
  const armish = hands.every((h) => /_(shoulder|upperarm|elbow|forearm|wrist|hand|handtip)/.test(h) || FACE.test(h) || /^(thoracic|trunk)/.test(h));
  if (lying) {
    if (headish && spec.posture !== "sidelying") d = dirOf(new Vector3(0, 1, 0));
    else if (spec.posture === "sidelying") d = dirOf(new Vector3(0, 0, -1));
    else d = dirOf(new Vector3(sgn(side), 0, 0));
  }
  // Depresor lingual (sale por el lado derecho de la boca): el examinador delante y a ese lado.
  else if (hands.includes("depressor")) d = dirOf(new Vector3(-0.8, 0, 1));
  // El mentón o la boca: delante y algo a un lado.
  else if (hands.some((h) => h === "jaw" || h === "mouth")) d = dirOf(new Vector3(-0.6, 0, 1));
  // Los dos brazos a la vez: delante del paciente (se ven sus manos); cabeza y tronco: detrás.
  else if (sides.includes("r") && sides.includes("l") && hands.every((h) => /_(upperarm|elbow|forearm|wrist|hand)/.test(h))) d = dirOf(new Vector3(0, 0, 1));
  else if (midline || (sides.includes("r") && sides.includes("l"))) d = dirOf(new Vector3(0, 0, -1));
  else if (armish) {
    // Un brazo: al lado y algo por detrás; si la mano del paciente está delante de su pecho, por delante.
    const front = hands.some((h) => /_(forearm|wrist|hand)/.test(h) && (anchorInfo(p0, h)?.p.clone().sub(p0.pt.chest!).applyQuaternion(q.clone().invert()).z ?? 0) > 7);
    d = dirOf(new Vector3(sgn(side), 0, front ? 0.9 : -0.45));
  }
  else {
    const v = flat(c.clone().sub(p0.root.p));
    d = v.length() > 12 ? v.normalize() : dirOf(new Vector3(sgn(side), 0, 0.4));
    // Pierna de alguien sentado o de pie: el examinador a un lado, para que se vea el pie por delante.
    if (hands.every((h) => /_(knee|shank|ankle|foot|thigh)/.test(h))) d = dirOf(new Vector3(sgn(side), 0, spec.posture === "sitting" ? 0.5 : 0.3));
  }
  d ??= new Vector3(0, 0, 1);
  // De pie o sentado: el examinador, del lado hacia el que miran las caras donde apoya las manos.
  if (!lying && spec.grips?.some((g) => g?.face)) {
    const n = contacts(spec, p0, null, null).reduce((acc, ct) => acc.add(flat(ct.n)), new Vector3()).multiplyScalar(1 / hands.length);
    if (n.length() > 0.5) d.addScaledVector(n.normalize(), 1.2).normalize();
  }
  return d;
}

const angleDiff = (a: number, b: number) => {
  let x = b - a;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
};

/**
 * Coste de un brazo con el codo hacia `theta` y la mano girada `spin`: el brazo dentro del paciente, de la
 * camilla o del propio cuerpo, la muñeca fuera de sus límites y el codo por encima del hombro o hacia dentro.
 */
function armCost(ct: Contact, S: Vector3, base: Pose3, side: Side, hand: { spin: number; wrap?: number }, theta: number, patient: BodySDF, own: BodySDF, table: Table | null): number {
  const tg = handTarget(ct, S, hand);
  const ik = armIK(S, tg.W, poleDir(S, tg.W, theta, base.trunkQ));
  let c = wristExcess(wristAngles(ik.faQ, tg.q, side), ct.grip) * 0.08;
  // La muñeca tiene que llegar a su sitio (con la mano así girada puede quedar más lejos).
  c += Math.max(0, tg.W.distanceTo(S) - (DIM.upperarm + DIM.forearm - 0.6)) * 3;
  const notMine = (part: string) => !/torso|head|neck|thigh/.test(part);
  const hit = (p: Vector3, r: number, nearHand: boolean) => {
    let x = 0;
    const hp = patient(p);
    if (hp.d - r < 0 && !(nearHand && hp.part === ct.part)) x += r - hp.d;
    const dm = own(p, notMine).d - r;
    if (dm < 0) x += -dm;
    if (table) x += Math.max(0, r - tableD(table, p));
    return x;
  };
  // La mano entera (dedos y talón de la mano) sobre la piel, no dentro de otras partes.
  for (const [x, y] of HAND_PTS) {
    const [by, bz] = bendPoint(y, 0, tg.curl);
    const p = new Vector3(x, by, bz).applyQuaternion(tg.q).add(ik.W);
    c += Math.max(0, 0.6 - patient(p).d) * 0.8;
  }
  for (const t of [0.3, 0.55, 0.8, 1]) c += hit(S.clone().lerp(ik.E, t), 4, false) * 0.8;
  for (const t of [0.2, 0.45, 0.7]) c += hit(ik.E.clone().lerp(ik.W, t), 3.2, t > 0.6) * 0.8;
  // Codo por encima del hombro o metido hacia el centro del cuerpo: poco natural.
  c += Math.max(0, ik.E.y - S.y - 4) * 0.04;
  const lat = new Vector3(sgn(side), 0, 0).applyQuaternion(base.trunkQ);
  c += Math.max(0, -ik.E.clone().sub(S).dot(lat) - 6) * 0.03;
  return c;
}

/** Puntos de la mano para ver si se mete en el paciente: [x, y] en el plano de la mano (antes de doblar los dedos). */
const HAND_PTS: [number, number][] = [-3.2, -1, 1, 3.2].flatMap((x) => [-2, -8, -13, -17.5].map((y) => [x, y] as [number, number]));

/** Ángulos de la muñeca: flexión (+ hacia la palma), desviación (+ cubital) y pronación (0 palma arriba, 180 abajo). */
export function wristAngles(faQ: Quaternion, handQ: Quaternion, side: Side) {
  const rel = faQ.clone().invert().multiply(handQ);
  if (rel.w < 0) rel.set(-rel.x, -rel.y, -rel.z, -rel.w);
  const tau = 2 * Math.atan2(rel.y, rel.w);
  const sw = new Quaternion().setFromAxisAngle(Yv, -tau).multiply(rel);
  const f = new Vector3(0, -1, 0).applyQuaternion(sw);
  let pron = deg(-sgn(side) * tau);
  while (pron > 180) pron -= 360;
  while (pron <= -180) pron += 360;
  return { flex: deg(Math.atan2(f.z, -f.y)), dev: deg(Math.atan2(-sgn(side) * f.x, -f.y)), pron };
}

/** Grados que la muñeca pasa de lo posible (la palma que empuja admite más extensión). */
export function wristExcess(w: { flex: number; dev: number; pron: number }, grip: GripKind | "rest"): number {
  const ext = grip === "press" ? 88 : 72;
  let x = Math.max(0, w.flex - 80) + Math.max(0, -w.flex - ext) + Math.max(0, w.dev - 32) + Math.max(0, -w.dev - 22);
  if (w.pron < -15 && w.pron > -165) x += Math.min(-15 - w.pron, w.pron + 165);
  return x;
}

/**
 * Hacia dónde apunta el codo: `theta` grados alrededor de la línea hombro-muñeca. El 0 es el codo hacia
 * atrás del brazo colgando, llevado con el brazo hasta su dirección (así no salta al cambiar esta).
 */
function poleDir(S: Vector3, W: Vector3, theta: number, trunkQ: Quaternion): Vector3 {
  const u = W.clone().sub(S).normalize();
  const down = new Vector3(0, -1, 0).applyQuaternion(trunkQ);
  const ref = new Vector3(0, 0, -1).applyQuaternion(trunkQ).applyQuaternion(new Quaternion().setFromUnitVectors(down, u));
  return ref.addScaledVector(u, -ref.dot(u)).normalize().applyAxisAngle(u, rad(theta));
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
    // Abarcar el tobillo o la muñeca es coger la pierna o el antebrazo justo por encima (no el pie ni la mano).
    const info = anchorInfo(pose, kind === "grasp" ? h.replace(/^(r|l)_ankle$/, "$1_shank@0.9").replace(/^(r|l)_wrist$/, "$1_forearm@0.9") : h);
    if (!info) return { anchor: h, p: new Vector3(), n: new Vector3(0, 1, 0), part: "", a: new Vector3(), axis: new Vector3(0, 1, 0), r: 1, grip: kind, frame: new Quaternion() };
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
    return { anchor: h, p: info.p.clone().addScaledVector(n, r), n, part: info.part, a: info.p.clone(), axis: info.axis.clone(), r, grip: kind, frame: info.frame.clone() };
  });
}

/** Hacia dónde apuntan los dedos de forma natural: siguiendo el antebrazo, pegados a la superficie. */
function fingers(ct: Contact, S: Vector3) {
  const perp = (v: Vector3) => v.addScaledVector(ct.n, -v.dot(ct.n));
  let fd = perp(ct.p.clone().sub(S));
  // Si el brazo llega justo de frente, los dedos hacia abajo (o hacia un lado si la palma mira abajo).
  if (fd.lengthSq() < 4) fd = perp(new Vector3(0, -1, 0));
  if (fd.lengthSq() < 1e-3) fd = perp(new Vector3(1, 0, 0));
  return fd.normalize();
}

/** Eje del segmento sobre la superficie del contacto (la referencia de los ángulos de la mano). */
function surfaceAxis(ct: Contact) {
  const a = ct.axis.clone().addScaledVector(ct.n, -ct.axis.dot(ct.n));
  if (a.lengthSq() < 1e-3) {
    const x = new Vector3(1, 0, 0).applyQuaternion(ct.frame);
    a.copy(x).addScaledVector(ct.n, -x.dot(ct.n));
  }
  return a.normalize();
}

/** Ángulo (grados, alrededor de la normal) de una dirección sobre la superficie, desde el eje del segmento. */
function fingerAngle(ct: Contact, fd: Vector3) {
  const a = surfaceAxis(ct);
  return deg(Math.atan2(new Vector3().crossVectors(a, fd).dot(ct.n), a.dot(fd)));
}

/** Lado (ángulo en la sección del segmento) hacia el que rodean los dedos al abarcar: lejos del hombro, o el otro. */
function wrapAngle(ct: Contact, S: Vector3, spin: number, other: boolean) {
  const n = spin ? ct.n.clone().applyAxisAngle(ct.axis, rad(spin)) : ct.n;
  const t = new Vector3().crossVectors(ct.axis, n);
  if (t.dot(ct.a.clone().sub(S)) < 0) t.negate();
  if (other) t.negate();
  const l = t.applyQuaternion(ct.frame.clone().invert());
  return Math.round(deg(Math.atan2(l.z, l.x)));
}

const basis = (bx: Vector3, by: Vector3, bz: Vector3) => new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(bx, by, bz));

/**
 * Dónde va la muñeca y cómo se orienta la mano para cada toma (mano: dedos hacia −y, palma hacia +z):
 * - press: el centro de la palma sobre el contacto, dedos siguiendo el antebrazo, mano casi plana.
 * - grasp: la palma en la cara elegida y los dedos rodeando el segmento (el eje del segmento en el centro
 *   de la curva de los dedos).
 * - tips: los dedos doblados y las yemas sobre el punto.
 * `hand`: la orientación elegida para este brazo (ArmPlan); sin ella, la natural.
 */
export function handTarget(ct: Contact, S: Vector3, hand?: { spin: number; wrap?: number }): { W: Vector3; q: Quaternion; curl: number } {
  if (ct.grip === "grasp") {
    // La palma, en la cara elegida girada `spin` grados alrededor del segmento.
    const n = hand?.spin ? ct.n.clone().applyAxisAngle(ct.axis, rad(hand.spin)) : ct.n;
    const z = n.clone().negate();
    let t = new Vector3().crossVectors(ct.axis, n);
    if (t.lengthSq() < 1e-4) t = fingers(ct, S);
    t.normalize();
    // Los dedos rodean el segmento por el lado elegido (referido al segmento: no salta durante la maniobra);
    // si no se ha elegido, por el lado de fuera, lejos del examinador.
    const side = hand?.wrap !== undefined ? new Vector3(Math.cos(rad(hand.wrap)), 0, Math.sin(rad(hand.wrap))).applyQuaternion(ct.frame) : ct.a.clone().sub(S);
    if (t.dot(side) < 0) t.negate();
    const R = Math.min(10, Math.max(3.5, ct.r + 1.3));
    const y = t.clone().negate();
    const q = basis(new Vector3().crossVectors(y, z), y, z);
    return { W: ct.a.clone().addScaledVector(t, KNUCKLE_Y).addScaledVector(n, R), q, curl: R };
  }
  const z = ct.n.clone().negate();
  const fd = hand ? surfaceAxis(ct).applyAxisAngle(ct.n, rad(hand.spin)) : fingers(ct, S);
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
  const mm = m <= 0 ? 0 : m >= 1 ? 1 : m * m * (3 - 2 * m);
  for (const arm of plan.arms) {
    const ct = cts[arm.hand];
    if (!ct) continue;
    const s = arm.side;
    const S = pose.pt[`${s}_shoulder`]!;
    const target = handTarget(ct, S, handAt(arm, m));
    const restW = pose.pt[`${s}_wrist`]!.clone();
    const W = restW.clone().lerp(target.W, reach);
    const theta = arm.pole[0] + angleDiff(arm.pole[0], arm.pole[1]) * mm;
    const ik = armIK(S, W, poleDir(S, target.W, theta, pose.trunkQ));
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

