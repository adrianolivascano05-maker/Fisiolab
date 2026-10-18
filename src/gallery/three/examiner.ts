// El examinador en 3D: dónde se pone (junto a la camilla, delante, detrás o a un lado del paciente), cuánto
// se inclina o se agacha para llegar, y sus brazos, que se mueven como brazos de verdad: la escápula sube y
// se adelanta con el brazo, el hombro no rota más de lo que rota, el codo solo se dobla (y no del todo), el
// antebrazo prona y supina sin pasarse y la muñeca no sale de sus límites. El codo sigue una trayectoria
// suave durante toda la maniobra (se elige a la vez para varios momentos), la mano llega a la toma desde
// fuera de la superficie y los dedos se apoyan en la piel (ni dentro ni en el aire). Nada del examinador se
// mete en el paciente, en la camilla, en su propio cuerpo ni en su otro brazo, en ningún momento.
// Buscar todo esto cuesta: las colocaciones de las figuras de la galería están precalculadas en plans.json
// (node scripts/gallery3d-plans.mjs) y solo se buscan si la figura cambia.
import { Matrix4, Quaternion, Vector3 } from "three";
import type { Anchor, FigureSpec } from "../figure";
import { extremeU, mixAt, planKeys } from "../script";
import { keysOf } from "./anatomy";
import { planKey } from "./cameras";
import { bodySDF, handPoints, skinPoints, tableD, type BodySDF } from "./collide";
import { patientPose, type Layout, type Table } from "./layout";
import stored from "./plans.json";
import {
  anatDir,
  anchorInfo,
  anchorSide,
  bendPoint,
  DIM,
  fingerPads,
  FINGERS,
  fk,
  KNUCKLE_Y,
  limbFace,
  LYING,
  sgn,
  surfaceRadius,
  surfaceSamples,
  thumbPad,
  thumbPoint,
  type AnchorInfo,
  type BodyAngles,
  type HandState,
  type Pose3,
  type Side,
} from "./rig";

/** Punto de apoyo de una mano: dónde toca (p, en la superficie), hacia dónde mira la palma (−n), el eje y
 *  el radio del segmento en ese punto (a, axis, r) y la toma. */
export type Contact = { anchor: Anchor; p: Vector3; n: Vector3; part: string; a: Vector3; axis: Vector3; r: number; grip: GripKind; frame: Quaternion };
type GripKind = "press" | "grasp" | "tips";

/**
 * Un brazo: qué mano del test lleva y hacia dónde apunta el codo a lo largo de la maniobra (grados alrededor
 * de la línea hombro-muñeca, en momentos repartidos por igual de m = 0 a m = 1). La orientación de la mano va
 * referida al segmento que toca, para que se mueva con él: `spin`, con la palma o las yemas, el ángulo de los
 * dedos sobre la superficie desde el eje del segmento; abarcando, el giro de la palma alrededor del segmento;
 * `wrap`, abarcando, hacia qué lado del segmento (ángulo en su sección) rodean los dedos. `ap`: por dónde
 * llega la mano a la toma (0, desde fuera de la superficie; 1, desde el hombro; 2, desde arriba).
 */
export type ArmPlan = {
  side: Side;
  hand: number;
  pole: number[];
  spin: number;
  wrap?: number;
  /** Al final, si se desplaza. */
  spin1?: number;
  wrap1?: number;
  ap?: number;
  /** La toma, desplazada unos centímetros a lo largo del segmento (para no pisar la articulación de al lado). */
  slide?: number;
};

/** Orientación de la mano de un brazo en el momento m (pasa poco a poco de la del principio a la del final). */
export function handAt(arm: Pick<ArmPlan, "spin" | "wrap" | "spin1" | "wrap1">, m: number): { spin: number; wrap?: number } {
  const k = ease(m);
  const spin = arm.spin1 === undefined ? arm.spin : arm.spin + angleDiff(arm.spin, arm.spin1) * k;
  const wrap = arm.wrap === undefined ? undefined : arm.wrap1 === undefined ? arm.wrap : arm.wrap + angleDiff(arm.wrap, arm.wrap1) * k;
  return { spin, ...(wrap !== undefined ? { wrap } : {}) };
}

/** Hacia dónde apunta el codo en el momento m (curva suave por los valores del plan). */
export function poleAt(arm: Pick<ArmPlan, "pole">, m: number): number {
  const P = arm.pole;
  const n = P.length;
  if (n === 1) return P[0]!;
  const f = Math.min(n - 1, Math.max(0, m * (n - 1)));
  const i = Math.min(n - 2, Math.floor(f));
  const u = f - i;
  const p = (k: number) => P[Math.min(n - 1, Math.max(0, k))]!;
  const t0 = (p(i + 1) - p(i - 1)) / 2;
  const t1 = (p(i + 2) - p(i)) / 2;
  return (2 * u ** 3 - 3 * u ** 2 + 1) * p(i) + (u ** 3 - 2 * u ** 2 + u) * t0 + (-2 * u ** 3 + 3 * u ** 2) * p(i + 1) + (u ** 3 - u ** 2) * t1;
}

export type ExaminerPlan = {
  rootXZ: Vector3;
  yaw: number;
  stance: Stance;
  lean: number;
  angles: BodyAngles;
  lift: number;
  arms: ArmPlan[];
  /** Postura del brazo que no toca (si solo toca con una mano). */
  free?: number;
  /** Si desde un solo sitio no llega al principio y al final, dónde está al final: se desplaza durante la maniobra. */
  alt?: ExaminerPlan;
};

const Yv = new Vector3(0, 1, 0);
const flat = (v: Vector3) => new Vector3(v.x, 0, v.z);
const limbZero = () => ({ flex: 0, abd: 0 });
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export type Stance = "stand" | "sit" | "squat" | "deep" | "kneel" | "heels";

/** Posturas del brazo que no toca: colgando, algo separado y doblado, o con el antebrazo delante de la cintura. */
const FREE = [
  { flex: 3, abd: 13, rot: 0, elbow: 14 },
  { flex: 0, abd: 22, rot: 0, elbow: 42 },
  { flex: 14, abd: 14, rot: 58, elbow: 96 },
];

function stanceAngles(kind: Stance, lean: number, neck: number, free = 0): BodyAngles {
  // Los brazos cuelgan con la gravedad aunque el tronco se incline.
  const f = FREE[free] ?? FREE[0]!;
  const L = (s: Side) => ({
    shoulder: { flex: lean + f.flex, abd: f.abd, rot: f.rot },
    elbow: { flex: f.elbow, abd: 0 },
    wrist: { flex: 0, abd: 0, twist: -sgn(s) * 75 },
    hip: { flex: lean, abd: 5 },
    knee: { flex: 4, abd: 0 },
    ankle: limbZero(),
  });
  const A: BodyAngles = { trunkFlex: lean, trunkLat: 0, neckFlex: neck, neckLat: 0, neckYaw: 0, jaw: 0, r: L("r"), l: L("l") };
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
  const t = ease(k);
  const mix = (x: number, y: number) => x + (y - x) * t;
  let dy = b.yaw - a.yaw;
  while (dy > Math.PI) dy -= 2 * Math.PI;
  while (dy < -Math.PI) dy += 2 * Math.PI;
  const A = a.angles;
  const B = b.angles;
  const limb = (s: Side) => {
    const out = { ...A[s] };
    for (const j of Object.keys(out) as (keyof BodyAngles["r"])[]) {
      const x = A[s][j];
      const y = B[s][j];
      out[j] = { flex: mix(x.flex, y.flex), abd: mix(x.abd, y.abd), ...(x.rot !== undefined ? { rot: mix(x.rot, y.rot ?? 0) } : {}), ...(x.twist !== undefined ? { twist: mix(x.twist, y.twist ?? 0) } : {}) };
    }
    return out;
  };
  const angles: BodyAngles = { ...A, trunkFlex: mix(A.trunkFlex, B.trunkFlex), neckFlex: mix(A.neckFlex, B.neckFlex), r: limb("r"), l: limb("l") };
  // Si se desplaza, da pasos cortos: levanta un pie (el talón hacia atrás, sin adelantar la rodilla hacia la
  // camilla) y luego el otro.
  const dist = a.rootXZ.distanceTo(b.rootXZ);
  if (dist > 12 && t > 0 && t < 1) {
    const ph = t * Math.max(2, Math.ceil(dist / 30));
    const leg: Side = Math.floor(ph) % 2 === 0 ? "r" : "l";
    const up = Math.sin(Math.PI * (ph - Math.floor(ph)));
    angles[leg].hip.flex += 8 * up;
    angles[leg].knee.flex += 34 * up;
    angles[leg].ankle.flex += 10 * up;
  }
  return { ...a, rootXZ: a.rootXZ.clone().lerp(b.rootXZ, t), yaw: a.yaw + dy * t, angles, lift: mix(a.lift, b.lift) };
}

// ---------- Colocaciones precalculadas ----------

type StoredArm = { s: Side; h: number; p: number[]; sp: number; w?: number; sp1?: number; w1?: number; ap?: number; sl?: number };
type StoredPlan = { r: [number, number]; y: number; s: Stance; l: number; n: number; h: number; f?: number; a: StoredArm[]; alt?: StoredPlan };
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
    ...(p.free ? { f: p.free } : {}),
    a: p.arms.map((x) => ({
      s: x.side,
      h: x.hand,
      p: x.pole.map((v) => Math.round(v)),
      sp: x.spin,
      ...(x.wrap !== undefined ? { w: x.wrap } : {}),
      ...(x.spin1 !== undefined ? { sp1: x.spin1 } : {}),
      ...(x.wrap1 !== undefined ? { w1: x.wrap1 } : {}),
      ...(x.ap ? { ap: x.ap } : {}),
      ...(x.slide ? { sl: x.slide } : {}),
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
    angles: stanceAngles(s.s, s.l, s.n, s.f ?? 0),
    lift: s.h,
    ...(s.f ? { free: s.f } : {}),
    arms: s.a.map((a) => ({
      side: a.s,
      hand: a.h,
      pole: a.p,
      spin: a.sp,
      ...(a.w !== undefined ? { wrap: a.w } : {}),
      ...(a.sp1 !== undefined ? { spin1: a.sp1 } : {}),
      ...(a.w1 !== undefined ? { wrap1: a.w1 } : {}),
      ...(a.ap ? { ap: a.ap } : {}),
      ...(a.sl ? { slide: a.sl } : {}),
    })),
    ...(s.alt ? { alt: unpack(s.alt) } : {}),
  };
}

// ---------- Dónde se coloca ----------

/**
 * Momentos de la maniobra en los que se eligen los codos (y se comprueba que todo está libre): cinco repartidos
 * por igual o, con guion, las poses clave y el punto medio entre cada dos.
 */
const keysFor = (spec: FigureSpec) => planKeys(spec.script);
/** Cuánto se ha alejado el paciente de la partida en el progreso m (lo que reparte la colocación y la mano del examinador entre su principio y su final). */
export const mixFor = (spec: FigureSpec, m: number) => (spec.script ? mixAt(keysOf(spec), m) : m);

/**
 * Decide dónde se coloca y cómo mueve los brazos. Devuelve null si el test no lleva manos del examinador.
 * Usa la colocación guardada si la hay.
 */
export function planExaminer(spec: FigureSpec, L: Layout, fresh = false): ExaminerPlan | null {
  const hands = (spec.hands ?? []).slice(0, 2);
  if (!hands.length || spec.examiner === "none") return null;
  const saved = fresh ? undefined : PLANS[planKey(spec)];
  if (saved) return unpack(saved);
  const ctx = context(spec, L);
  const plan = place(ctx);
  const arms = refineArms(ctx, plan);
  return { ...plan, arms, ...(plan.alt ? { alt: { ...plan.alt, arms } } : {}) };
}

function place(ctx: Ctx): ExaminerPlan {
  const both = search(ctx, ctx.poses.map((_, i) => i));
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
  // Ningún sitio sin meterse en nada: el que menos.
  if (!pr && !both.found) return search(ctx, [0, 1], undefined, undefined, false, true).plan;
  if (!pr || (both.found && pr.arms + 1.5 >= both.arms)) return both.plan;
  const { start, end } = pr;
  const arms = start.arms.map((a) => {
    const b = end.arms.find((x) => x.side === a.side);
    return { ...a, pole: [a.pole[0]!, b?.pole[b.pole.length - 1] ?? a.pole[a.pole.length - 1]!], ...(b ? { spin1: b.spin, ...(b.wrap !== undefined ? { wrap1: b.wrap } : {}) } : {}) };
  });
  return { ...start, arms, alt: { ...end, arms } };
}

/** El paciente en los momentos clave (con el empuje de las fuerzas, salvo al principio, cuando llegan las manos). */
type Key = { m: number; mix: number; pose: Pose3; sdf: BodySDF };
type Ctx = { spec: FigureSpec; table: Table | null; hands: Anchor[]; key: Key[]; poses: Pose3[]; sdf: BodySDF[]; midPose: Pose3; mid: BodySDF; /** Cada octavo de la maniobra (lo que se mueve deprisa, como un pie, barre mucho espacio). */ dense: BodySDF[] };
function context(spec: FigureSpec, L: Layout): Ctx {
  const key = keysFor(spec).map((m) => {
    const pose = patientPose(L, m, m > 0 ? 1 : 0);
    return { m, mix: mixFor(spec, m), pose, sdf: bodySDF(pose) };
  });
  const k0 = key[0]!;
  // El final de la maniobra: la pose más alejada de la partida (con guion, antes de la vuelta).
  const end = spec.script ? extremeU(keysOf(spec)) : 1;
  const p1 = patientPose(L, end, 1);
  const pm = patientPose(L, end / 2, 1);
  const dense = spec.script ? [] : [0.125, 0.375, 0.625, 0.875].map((m) => bodySDF(patientPose(L, m, 1)));
  // Con guion, además, el resto de las poses clave (p. ej. el giro hacia el otro lado): desde el sitio elegido
  // tiene que llegar a todas.
  const more = spec.script ? key.filter((k, i) => i % 2 === 0 && k.m > 0 && k.m < 1 && Math.abs(k.m - end) > 1e-6) : [];
  return { spec, table: L.table, hands: (spec.hands ?? []).slice(0, 2), key, poses: [k0.pose, p1, ...more.map((k) => k.pose)], sdf: [k0.sdf, bodySDF(p1), ...more.map((k) => k.sdf)], midPose: pm, mid: bodySDF(pm), dense: [...key.map((k) => k.sdf), ...dense] };
}

type Cand = { cost: number; turn: number; yawOff: number; st: (typeof STANCES)[number]; extra: number; lean: number };
type HandOpt = { spin: number; wrap?: number; extra: number };

function search(ctx: Ctx, which: number[], fixedArms?: ArmPlan[], other?: ExaminerPlan, standing = false, soft = false): { plan: ExaminerPlan; found: boolean; arms: number } {
  const { spec, table, hands } = ctx;
  const poses = which.map((i) => ctx.poses[i]!);
  const sdfs = which.map((i) => ctx.sdf[i]!);
  const pts = poses.flatMap((p) => hands.map((h) => anchorInfo(p, h)?.p).filter((v): v is Vector3 => !!v));
  const c = pts.reduce((a, b) => a.add(b), new Vector3()).multiplyScalar(1 / pts.length);
  const d = approach(spec, poses, c);
  const lying = LYING.includes(spec.posture);

  // Lo que el cuerpo del examinador no puede tocar: el paciente (en todos los momentos clave, si no se desplaza)
  // y la camilla.
  const all = which.length > 1 ? ctx.dense : sdfs;
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
      // anda). Agacharse o arrodillarse, solo para lo que está bajo (los pies de alguien de pie, la pierna de
      // alguien sentado).
      const usable = STANCES.filter((x) => (spec.place?.stance ? x.kind === spec.place.stance : (!(standing || other) || !["sit", "kneel", "heels"].includes(x.kind)) && c.y < STANCE_MAX_Y[x.kind]));
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
    let base = baseExaminerPose(plan);
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
    const tmp: ExaminerPlan = { ...plan, arms: arms.map((a) => ({ ...a, pole: [0], spin: 0 })) };
    const cts = poses.map((p) => contacts(spec, p, base, tmp));
    const reach = arms.every((arm) => {
      const S = shoulder0(base, arm.side);
      return cts.every((ct) => !ct[arm.hand] || handTarget(ct[arm.hand]!, S).W.distanceTo(S) <= DIM.upperarm + DIM.forearm - 0.6);
    });
    if (!reach) continue;
    // Las manos, lejos de su propia cara.
    if (!cts.every((ct) => ct.every((x) => x.p.distanceTo(base.head.p) > 17))) continue;
    // Cuerpo, cabeza y piernas (y el taburete) fuera del paciente y de la camilla; el brazo que no toca, también.
    // (Si ninguna colocación lo consigue, se busca la que menos se mete: `soft`.)
    const body = [...skinPoints(base, (part) => !/upperarm|forearm|hand/.test(part), 2), ...stoolPoints(plan)];
    let pen = 0;
    for (const sp of body) {
      const margin = /torso|head|neck/.test(sp.part) ? 2.5 : 1.4;
      const dp = Math.min(...all.map((f) => f(sp.p).d));
      pen += Math.max(0, margin - dp) + (table ? Math.max(0, margin * 0.5 - tableD(table, sp.p)) : 0);
    }
    if (pen > 0 && !soft) continue;
    const freeSide: Side | null = arms.length === 1 ? (arms[0]!.side === "r" ? "l" : "r") : null;
    if (freeSide) {
      const opt = FREE.findIndex((_, i) => {
        const p = fk(new Vector3(plan.rootXZ.x, plan.lift, plan.rootXZ.z), yawQ(yaw), stanceAngles(plan.stance, plan.lean, plan.angles.neckFlex, i));
        const own = bodySDF(p);
        return skinPoints(p, (part) => part.startsWith(`${freeSide}_`) && /upperarm|forearm|hand/.test(part), 2).every(
          (sp) => free(sp.p, 0.8) && (/upperarm/.test(sp.part) || own(sp.p, (q) => q.startsWith(`${freeSide}_`) || q === "neck").d > 0),
        );
      });
      if (opt < 0) continue;
      if (opt > 0) {
        plan.free = opt;
        plan.angles = stanceAngles(plan.stance, plan.lean, plan.angles.neckFlex, opt);
        base = baseExaminerPose(plan);
      }
    }
    // La cabeza, sin pegarse a la persona.
    const headGap = Math.min(...all.map((f) => f(base.head.p).d));
    if (headGap <= 12 && !soft) continue;
    pen += Math.max(0, 12 - headGap);
    // Si se desplaza entre dos sitios, el camino también tiene que estar libre.
    if (other) {
      const path = [0.2, 0.4, 0.6, 0.8].flatMap((k) => skinPoints(baseExaminerPose({ ...plan, alt: other }, k), (part) => !/upperarm|forearm|hand/.test(part), 2));
      if (!path.every((sp) => [...ctx.sdf, ctx.mid].every((f) => f(sp.p).d > 0.8) && (!table || tableD(table, sp.p) > 0.8))) continue;
    }
    // Brazos: el mejor codo y giro de cada mano (choques, articulaciones dentro de sus límites, naturalidad).
    tried++;
    const own = bodySDF(base);
    const ownSkip = armSkip(arms.map((a) => a.side));
    // Si se desplaza, cómo está a mitad de camino (este sitio es el principio si se busca el momento 0).
    const blend = other ? (which[0] === 0 ? baseExaminerPose({ ...plan, alt: other }, 0.5) : baseExaminerPose({ ...other, alt: plan }, 0.5)) : null;
    const blendOwn = blend ? bodySDF(blend) : null;
    let armsCost = 0;
    const armPlans: ArmPlan[] = [];
    for (const arm of arms) {
      const ctOf = (k: number) => cts[k]![arm.hand]!;
      if (!ctOf(0)) continue;
      const env = (patient: BodySDF): ArmEnv => ({ base, S0: shoulder0(base, arm.side), side: arm.side, patient, own, ownSkip, table });
      const midCt = poses.length > 1 ? contacts(spec, ctx.midPose, base, tmp)[arm.hand] : undefined;
      const otherArm = other?.arms.find((a) => a.side === arm.side);
      const blendCt = blend ? contacts(spec, ctx.midPose, blend, tmp)[arm.hand] : undefined;
      // Orientaciones de la mano que se prueban, referidas al segmento (la natural primero). Si es el segundo
      // sitio de un examinador que se desplaza, parecidas a la del primero (la mano no da media vuelta por el camino).
      const near = otherArm ? (o: HandOpt) => Math.abs(angleDiff(o.spin, otherArm.spin)) <= 60 : () => true;
      const all0 = handOptions(ctOf(0), shoulder0(base, arm.side));
      const options = all0.filter(near).length ? all0.filter(near) : all0;
      // Codo al principio y al final; a mitad de maniobra va de uno a otro, así que también se comprueba.
      const tryArm = (opts: HandOpt[], step: number) => {
        let pick: { cost: number; pole: [number, number]; spin: number; wrap?: number } = { cost: Infinity, pole: [0, 0], spin: 0 };
        const ths: number[] = [];
        for (let th = -180; th < 180; th += step) ths.push(th);
        for (const o of opts) {
          const cs = poses.map((_, k) => ths.map((th) => armCost(env(sdfs[k]!), ctOf(k), o, th).c));
          const top = (cc: number[]) => ths.map((_, i) => i).sort((a, b) => cc[a]! - cc[b]!).slice(0, 4);
          let bestPair = { c: Infinity, pole: [0, 0] as [number, number] };
          if (poses.length === 1) {
            for (const i of top(cs[0]!)) {
              // Desplazándose: el codo va de un sitio al otro y a mitad de camino también tiene que estar bien.
              let mid = 0;
              if (blend && blendOwn && blendCt && otherArm) {
                const mine: ArmPlan = { ...arm, pole: [ths[i]!], spin: o.spin, ...(o.wrap !== undefined ? { wrap: o.wrap } : {}) };
                const [st, en] = which[0] === 0 ? [mine, otherArm] : [otherArm, mine];
                const both = { spin: st.spin, ...(st.wrap !== undefined ? { wrap: st.wrap } : {}), spin1: en.spin, ...(en.wrap !== undefined ? { wrap1: en.wrap } : {}) };
                const p0 = st.pole[0]!;
                const p1 = en.pole[en.pole.length - 1]!;
                const benv: ArmEnv = { base: blend, S0: shoulder0(blend, arm.side), side: arm.side, patient: ctx.mid, own: blendOwn, ownSkip, table };
                mid = armCost(benv, blendCt, handAt(both, 0.5), p0 + angleDiff(p0, p1) / 2).c;
              }
              const c2 = cs[0]![i]! + mid;
              if (c2 < bestPair.c) bestPair = { c: c2, pole: [ths[i]!, ths[i]!] };
            }
          } else {
            for (const i of top(cs[0]!)) {
              for (const j of top(cs[1]!)) {
                const dd2 = angleDiff(ths[i]!, ths[j]!);
                const mid = midCt ? armCost(env(ctx.mid), midCt, o, ths[i]! + dd2 / 2).c : 0;
                const c2 = cs[0]![i]! + cs[1]![j]! + mid + Math.abs(dd2) * 0.004;
                if (c2 < bestPair.c) bestPair = { c: c2, pole: [ths[i]!, ths[i]! + dd2] };
              }
            }
          }
          const tot = o.extra + bestPair.c;
          if (tot < pick.cost) pick = { cost: tot, pole: bestPair.pole, spin: o.spin, ...(o.wrap !== undefined ? { wrap: o.wrap } : {}) };
        }
        return pick;
      };
      // Primero la orientación natural; si el brazo queda mal, las demás.
      let pick = tryArm(options.slice(0, 1), 45);
      if (pick.cost > 0.8) {
        const full = tryArm(options.slice(1), 45);
        if (full.cost < pick.cost) pick = full;
      }
      armsCost += pick.cost;
      armPlans.push({ ...arm, pole: pick.pole, spin: pick.spin, ...(pick.wrap !== undefined ? { wrap: pick.wrap } : {}) });
    }
    const total = cd.cost + armsCost * 6 + pen * 40;
    if (total >= best.total) continue;
    plan.arms = armPlans;
    best = { total, plan, arms: armsCost };
  }
  if (best.plan) return { plan: best.plan, found: true, arms: best.arms };
  const yaw = Math.atan2(-d.x, -d.z);
  const arms = fixedArms ?? [{ side: "r" as Side, hand: 0 }, ...(hands.length > 1 ? [{ side: "l" as Side, hand: 1 }] : [])];
  const plan: ExaminerPlan = { rootXZ: c.clone().setY(0).addScaledVector(d, 40), yaw, stance: "stand", lean: 40, angles: stanceAngles("stand", 40, 30), lift: 0, arms: arms.map((a) => ({ side: a.side, hand: a.hand, pole: [0], spin: 0 })) };
  plan.lift = groundLift(plan);
  return { plan, found: false, arms: Infinity };
}

/** Orientaciones de la mano que vale la pena probar (la natural, la primera). */
function handOptions(c0: Contact, S: Vector3): HandOpt[] {
  if (c0.grip !== "grasp") {
    const natural = fingerAngle(c0, fingers(c0, S));
    return [0, -30, 30, -60, 60, -90, 90, 180].map((d) => ({ spin: Math.round(natural + d), extra: Math.abs(d) * 0.01 }));
  }
  return [0, -30, 30, -60, 60, -90, 90].flatMap((sp) => [false, true].map((other) => ({ spin: sp, wrap: wrapAngle(c0, S, sp, other), extra: Math.abs(sp) * 0.01 + (other ? 0.2 : 0) })));
}

/** Hombro del examinador sin el movimiento de la escápula (de ahí parte el brazo). */
const shoulder0 = (pose: Pose3, s: Side) => pose.pt[`${s}_shoulder`]!.clone().sub(pose.girdle[s]);

/** Partes del propio cuerpo que un brazo no comprueba: los brazos que se mueven (se comprueban entre ellos). */
const armSkip = (moving: Side[]) => {
  const set = new Set(["neck", ...moving.flatMap((s) => [`${s}_upperarm`, `${s}_forearm`, `${s}_hand`])]);
  return (part: string) => set.has(part);
};

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
  // Lo que pide la figura (si la colocación automática no es la que se usa en clínica).
  const from = spec.place?.from;
  if (from) {
    const f = dirOf(from === "front" ? new Vector3(0, 0, 1) : from === "behind" ? new Vector3(0, 0, -1) : new Vector3(sgn(side), 0, 0));
    if (f) return f;
  }
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
  } else {
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

// ---------- El brazo ----------

/** Brazo resuelto: hombro (ya movido por la escápula), codo, muñeca, orientación de cada parte y pronación. */
type ArmState = { S: Vector3; E: Vector3; W: Vector3; uaQ: Quaternion; faQ: Quaternion; handQ: Quaternion; twist: number; reach: number };

/**
 * Brazo que va del hombro (sin escápula, S0) a la muñeca W con la mano orientada `handQ` y el codo hacia
 * `theta`. La escápula se mueve según hacia dónde va el brazo (y eso cambia un poco el brazo: dos pasadas).
 */
function solveArm(S0: Vector3, W: Vector3, handQ: Quaternion, theta: number, trunkQ: Quaternion, side: Side): ArmState {
  let S = S0;
  let ik = armIK(S, W, poleDir(S, W, theta, trunkQ));
  for (let i = 0; i < 2; i++) {
    S = S0.clone().add(girdle(ik.E.clone().sub(S).normalize(), trunkQ, side));
    ik = armIK(S, W, poleDir(S, W, theta, trunkQ));
  }
  const rel = ik.faQ.clone().invert().multiply(handQ);
  if (rel.w < 0) rel.set(-rel.x, -rel.y, -rel.z, -rel.w);
  return { S, E: ik.E, W: ik.W, uaQ: ik.uaQ, faQ: ik.faQ, handQ, twist: deg(2 * Math.atan2(rel.y, rel.w)), reach: W.distanceTo(S) };
}

/** Desplazamiento del hombro con la escápula (el mismo modelo que el paciente, rig.girdleOffset). */
function girdle(d: Vector3, trunkQ: Quaternion, s: Side): Vector3 {
  const l = d.clone().applyQuaternion(trunkQ.clone().invert());
  const lat = l.x * sgn(s);
  const t = Math.min(1, Math.max(0, (Math.acos(clamp1(-l.y)) - 0.6) / 2.1));
  const up = 3.2 * t * t * (3 - 2 * t);
  const fwd = Math.max(0, l.z) * 2.2 + Math.max(0, -lat) * 1.3 - Math.max(0, -l.z) * 1.4;
  const med = -0.7 * (Math.max(0, l.z) + Math.max(0, -lat));
  return new Vector3(sgn(s) * med, up, fwd).applyQuaternion(trunkQ);
}

/** Cuánto molesta pasar de `comfy` grados, y mucho más pasar de `limit` (el tope de la articulación). */
const soft = (x: number, comfy: number, limit: number) => Math.max(0, x - comfy) * 0.02 + Math.max(0, x - limit) * 0.25;

/** Ángulos del hombro (grados): elevación, cuánto va hacia atrás o cruzado por delante, y rotación (interna +). */
export function shoulderAngles(st: { S: Vector3; E: Vector3; uaQ: Quaternion }, trunkQ: Quaternion, side: Side) {
  const inv = trunkQ.clone().invert();
  // En coordenadas del tronco, con x hacia fuera (el brazo derecho, como el izquierdo en espejo).
  const mir = (v: Vector3) => {
    const l = v.applyQuaternion(inv);
    l.x *= sgn(side);
    return l;
  };
  const d = mir(st.E.clone().sub(st.S).normalize());
  const z = mir(new Vector3(0, 0, 1).applyQuaternion(st.uaQ));
  // Rotación 0: la del brazo que sube desde colgando sin girar sobre sí mismo (antebrazo hacia delante).
  const ref = new Vector3(0, 0, 1).applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), d));
  return {
    elev: deg(Math.acos(clamp1(-d.y))),
    back: deg(Math.asin(Math.max(0, -d.z))),
    cross: deg(Math.asin(Math.max(0, -d.x))),
    rot: deg(Math.atan2(new Vector3().crossVectors(ref, z).dot(d), ref.dot(z))),
  };
}

/** Lo poco natural de un brazo: cada articulación cerca o más allá de su tope. */
function comfort(st: ArmState, trunkQ: Quaternion, side: Side, grip: GripKind): number {
  const sh = shoulderAngles(st, trunkQ, side);
  let c = soft(sh.back, 30, 50) + soft(sh.cross, 35, 60) + soft(sh.elev, 115, 160);
  // Rotación del hombro: interna hasta unos 85°, externa hasta unos 65° (más cómodo cerca del centro).
  if (sh.elev < 165) c += soft(sh.rot, 45, 85) + soft(-sh.rot, 30, 65);
  // El codo no se dobla del todo.
  const f = deg(Math.acos(clamp1(st.E.clone().sub(st.S).normalize().dot(st.W.clone().sub(st.E).normalize()))));
  c += soft(f, 130, 148);
  const w = wristAngles(st.faQ, st.handQ, side);
  c += wristExcess(w, grip) * 0.1 + (Math.max(0, Math.abs(w.flex) - 45) + Math.max(0, w.dev - 18) + Math.max(0, -w.dev - 12)) * 0.01;
  // Pronosupinación: más cómoda en medio (pulgar arriba).
  c += Math.max(0, Math.abs(w.pron - 85) - 65) * 0.015;
  // Codo por encima del hombro: poco natural si no hace falta.
  c += Math.max(0, st.E.y - st.S.y - 4) * 0.03;
  return c;
}

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
  const ext = grip === "press" ? 85 : 70;
  let x = Math.max(0, w.flex - 80) + Math.max(0, -w.flex - ext) + Math.max(0, w.dev - 32) + Math.max(0, -w.dev - 22);
  if (w.pron < -12 && w.pron > -168) x += Math.min(-12 - w.pron, w.pron + 168);
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

// ---------- Choques del brazo ----------

/** Lo que un brazo tiene alrededor: el examinador (su cuerpo), el paciente, la camilla y el otro brazo. */
type ArmEnv = { base: Pose3; S0: Vector3; side: Side; patient: BodySDF; own: BodySDF; ownSkip: (part: string) => boolean; table: Table | null; other?: Caps | null };
/** Brazo como cápsulas (brazo, antebrazo y mano): [extremo, extremo, radio]. */
type Caps = [Vector3, Vector3, number][];

const capsOf = (st: ArmState): Caps => [
  [st.S.clone(), st.E.clone(), 4.4],
  [st.E.clone(), st.W.clone(), 3.4],
  [st.W.clone(), st.W.clone().add(new Vector3(0, -15, 0).applyQuaternion(st.handQ)), 2.6],
];

/** Distancia entre dos segmentos. */
function segDist(p1: Vector3, q1: Vector3, p2: Vector3, q2: Vector3): number {
  const d1 = q1.clone().sub(p1);
  const d2 = q2.clone().sub(p2);
  const r = p1.clone().sub(p2);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);
  let s = 0;
  let t = 0;
  if (a < 1e-9 && e < 1e-9) return r.length();
  if (a < 1e-9) t = Math.min(1, Math.max(0, f / e));
  else {
    const c = d1.dot(r);
    if (e < 1e-9) s = Math.min(1, Math.max(0, -c / a));
    else {
      const b = d1.dot(d2);
      const den = a * e - b * b;
      s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.min(1, Math.max(0, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.min(1, Math.max(0, (b - c) / a));
      }
    }
  }
  return p1.clone().addScaledVector(d1, s).sub(p2.clone().addScaledVector(d2, t)).length();
}

/** Cuánto se meten dos brazos uno en otro (cm sumados). */
function capsHit(a: Caps, b: Caps): number {
  let x = 0;
  for (const [p1, q1, r1] of a) for (const [p2, q2, r2] of b) x += Math.max(0, r1 + r2 - segDist(p1, q1, p2, q2));
  return x;
}

/** Forma de la mano para comprobar choques: abierta mientras llega o con la toma típica ya apoyada. */
const handShape = (ct: Contact, curl: number, open: boolean, side: Side) =>
  handPoints(open ? { curl, grip: ct.grip, fingers: OPEN[ct.grip].fingers, thumb: OPEN[ct.grip].thumb } : { curl, grip: ct.grip, thumb: THUMB_GRIP[ct.grip] }, side, 3);
const THUMB_GRIP: Record<GripKind, number> = { press: 6, grasp: 45, tips: 30 };

/** Cuánto se mete un brazo resuelto en el paciente, la camilla, el propio cuerpo y el otro brazo. */
function armHits(env: ArmEnv, st: ArmState, ct: Contact, curl: number, open = false): number {
  const { patient, own, ownSkip, table } = env;
  let x = 0;
  const hit = (p: Vector3, r: number, contactOk: boolean, ownSlack = 0) => {
    const hp = patient(p);
    if (hp.d < r && !(contactOk && hp.part === ct.part)) x += r - hp.d;
    const dm = own(p, ownSkip).d;
    if (dm < r - ownSlack) x += (r - ownSlack - dm) * 1.2;
    if (table) x += Math.max(0, r - tableD(table, p));
  };
  // Cerca del hombro el brazo está pegado al tronco (el deltoides lo cubre): solo cuenta si se mete de verdad.
  hit(st.S.clone().lerp(st.E, 0.3), 4.6, false, 2);
  for (const t of [0.45, 0.65, 0.9]) hit(st.S.clone().lerp(st.E, t), 4.9, false);
  hit(st.E, 4.0, false);
  for (const t of [0.2, 0.45, 0.7, 0.9]) hit(st.E.clone().lerp(st.W, t), 4.5 - 1.6 * t, ct.grip === "grasp" && t > 0.8 && !open);
  // La mano entera (palma, dedos y pulgar): sobre la piel de lo que toca, no dentro de lo demás.
  const p = new Vector3();
  for (const hp0 of handShape(ct, curl, open, env.side)) {
    p.copy(hp0.p).applyQuaternion(st.handQ).add(st.W);
    const hp = patient(p);
    if (open) x += Math.max(0, 0.3 - hp.d);
    else x += Math.max(0, (hp.part === ct.part ? -1.2 : -0.2) - hp.d);
    const dm = own(p, ownSkip).d;
    if (dm < 0.4) x += (0.4 - dm) * 1.2;
    if (table) x += Math.max(0, 0.4 - tableD(table, p));
  }
  if (env.other) x += capsHit(capsOf(st), env.other) * 1.5;
  return x;
}

/** Cuánto se separa la mano de la toma antes de llegar (cm). */
const HOVER = 8;
/** Con las yemas (palpar, percutir) la mano llega desde más cerca. */
const hoverOf = (grip: GripKind) => (grip === "tips" ? 4.5 : HOVER);
const APPROACHES = 8;

/**
 * Por dónde llega la mano a la toma (ver ArmPlan.ap): dirección desde la toma hacia donde está antes.
 * 0, de fuera de la superficie y algo hacia el hombro; 1, hacia el hombro; 2, desde arriba; 3, justo desde
 * fuera de la superficie; 4, desde fuera y por el lado de la muñeca; 5, deslizándose en el plano de la mano
 * desde la muñeca (para meterla entre el paciente y la camilla); 6, deslizándose de lado; 7, desde abajo.
 */
function approachDir(ap: number, handQ: Quaternion, W: Vector3, S: Vector3): Vector3 {
  // La palma mira a +z de la mano (hacia la piel); fuera es −z. Los dedos, hacia −y.
  const out = new Vector3(0, 0, -1).applyQuaternion(handQ);
  const back = S.clone().sub(W).normalize();
  if (ap === 1) return back;
  if (ap === 2) return new Vector3(0, 1, 0).addScaledVector(out, 0.4).normalize();
  if (ap === 3) return out;
  if (ap === 4) return out.addScaledVector(new Vector3(0, 1, 0).applyQuaternion(handQ), 0.7).normalize();
  if (ap === 5) return new Vector3(0, 1, 0).applyQuaternion(handQ);
  if (ap === 7) return new Vector3(0, -1, 0).addScaledVector(out, 0.4).normalize();
  if (ap === 6) {
    // Hacia el lado de la mano que queda más cerca del hombro.
    const x = new Vector3(1, 0, 0).applyQuaternion(handQ);
    return x.dot(back) >= 0 ? x : x.negate();
  }
  return out.addScaledVector(back, 0.4).normalize();
}

/**
 * Coste de un brazo con el codo hacia `theta` y la mano en la toma: choques, articulaciones cerca de su tope
 * y que no llegue. Con `hover`, también la llegada de la mano (se elige por dónde: `ap`).
 */
function armCost(env: ArmEnv, ct: Contact, hand: { spin: number; wrap?: number }, theta: number, hover = false): { c: number; ap: number; st: ArmState } {
  const tg = handTarget(ct, env.S0, hand);
  const tq = env.base.trunkQ;
  const st = solveArm(env.S0, tg.W, tg.q, theta, tq, env.side);
  let c = comfort(st, tq, env.side, ct.grip);
  // La muñeca tiene que llegar a su sitio (con la mano así girada puede quedar más lejos).
  c += Math.max(0, st.reach - (DIM.upperarm + DIM.forearm - 0.6)) * 4;
  // Los choques pesan más que la comodidad: antes un brazo algo forzado que uno metido en algo.
  c += armHits(env, st, ct, tg.curl) * 2.5;
  let ap = 0;
  if (hover) {
    let bestH = Infinity;
    for (let a = 0; a < APPROACHES; a++) {
      const v = approachDir(a, tg.q, tg.W, env.S0);
      let h = a * 0.1;
      for (const f of [1, 0.5, 0.2]) {
        const sh = solveArm(env.S0, tg.W.clone().addScaledVector(v, hoverOf(ct.grip) * f), tg.q, theta, tq, env.side);
        h += comfort(sh, tq, env.side, ct.grip) * 0.4 + armHits(env, sh, ct, tg.curl, ct.grip === "grasp") * 2.5;
      }
      if (h < bestH) {
        bestH = h;
        ap = a;
      }
    }
    c += bestH;
  }
  return { c, ap, st };
}

// ---------- Codos a lo largo de la maniobra ----------

const GRID = Array.from({ length: 24 }, (_, i) => -180 + i * 15);

/**
 * Codo de cada brazo en los momentos clave de la maniobra, elegidos a la vez (programación dinámica): el
 * mejor en cada momento sin saltos de un momento a otro, y sin chocar con el otro brazo. Con la colocación
 * fija, también se prueban otras orientaciones de la mano.
 */
function refineArms(ctx: Ctx, plan: ExaminerPlan): ArmPlan[] {
  const moving = plan.arms.map((a) => a.side);
  const frames = ctx.key.map((k) => {
    const base = baseExaminerPose(plan, k.mix);
    return { m: k.m, mix: k.mix, base, own: bodySDF(base), patient: k.sdf, cts: contacts(ctx.spec, k.pose, base, plan) };
  });
  let arms = plan.arms.map((a) => ({ ...a }));
  const caps = new Map<Side, Caps[]>();
  const passes = arms.length > 1 ? 2 : 1;
  type Opt = { spin: number; wrap?: number; spin1?: number; wrap1?: number; extra: number };
  for (let pass = 0; pass < passes; pass++) {
    arms = arms.map((arm) => {
      const ct0 = frames[0]!.cts[arm.hand];
      if (!ct0) return arm;
      const otherCaps = caps.get(arm.side === "r" ? "l" : "r");
      const env = (k: number): ArmEnv => {
        const fr = frames[k]!;
        return { base: fr.base, S0: shoulder0(fr.base, arm.side), side: arm.side, patient: fr.patient, own: fr.own, ownSkip: armSkip(moving), table: ctx.table, other: otherCaps?.[k] ?? null };
      };
      // Orientaciones de la mano: la elegida y, si no se desplaza, las mejores de las demás.
      let opts: Opt[] = [{ spin: arm.spin, ...(arm.wrap !== undefined ? { wrap: arm.wrap } : {}), ...(arm.spin1 !== undefined ? { spin1: arm.spin1 } : {}), ...(arm.wrap1 !== undefined ? { wrap1: arm.wrap1 } : {}), extra: 0 }];
      if (!plan.alt) {
        const S = shoulder0(frames[0]!.base, arm.side);
        const coarse = (o: HandOpt) => o.extra + [0, frames.length - 1].reduce((sum, k) => sum + Math.min(...GRID.filter((_, i) => i % 2 === 0).map((th) => armCost(env(k), frames[k]!.cts[arm.hand]!, o, th).c)), 0);
        const others = handOptions(ct0, S)
          .filter((o) => o.spin !== arm.spin || o.wrap !== arm.wrap)
          .map((o) => ({ o, c: coarse(o) }))
          .sort((a, b) => a.c - b.c)
          .slice(0, 3)
          .map((x) => x.o);
        opts = [...opts, ...others];
      }
      let best: { total: number; arm: ArmPlan; caps: Caps[] } | null = null;
      for (const o of opts) {
        // Coste de cada codo en cada momento.
        const C = frames.map((fr, k) => {
          const ct = fr.cts[arm.hand]!;
          return GRID.map((th) => armCost(env(k), ct, handAt(o, fr.mix), th, k === 0));
        });
        // Programación dinámica: de un momento al siguiente, el codo gira poco. Con guion, el último momento es
        // la vuelta a la partida: el codo tiene que acabar donde empezó (si no, saltaría al repetirse el bucle).
        const K = frames.length;
        const run = (j0: number) => {
          const V: number[][] = [C[0]!.map((x, j) => (j0 < 0 || j === j0 ? x.c : Infinity))];
          const from: number[][] = [GRID.map(() => -1)];
          for (let k = 1; k < K; k++) {
            const row: number[] = [];
            const fr: number[] = [];
            for (let j = 0; j < GRID.length; j++) {
              let bv = Infinity;
              let bi = 0;
              for (let i = 0; i < GRID.length; i++) {
                const d = Math.abs(angleDiff(GRID[i]!, GRID[j]!));
                const v = V[k - 1]![i]! + 0.0015 * d * d + (d > 45 ? 4 : 0);
                if (v < bv) {
                  bv = v;
                  bi = i;
                }
              }
              row.push(bv + C[k]![j]!.c);
              fr.push(bi);
            }
            V.push(row);
            from.push(fr);
          }
          const end = j0 < 0 ? V[K - 1]!.reduce((bi, v, i, a) => (v < a[bi]! ? i : bi), 0) : j0;
          return { total: V[K - 1]![end]!, end, from };
        };
        let dp = run(-1);
        if (ctx.spec.script)
          for (let j0 = 0; j0 < GRID.length; j0++) {
            const r = run(j0);
            if (j0 === 0 || r.total < dp.total) dp = r;
          }
        let j = dp.end;
        const total = dp.total + o.extra;
        if (best && total >= best.total) continue;
        const idx: number[] = [];
        for (let k = K - 1; k >= 0; k--) {
          idx.unshift(j);
          j = dp.from[k]![j]!;
        }
        // Ángulos sin saltos de 360° (con guion, el último apunta igual que el primero: el bucle se cierra).
        const pole: number[] = [GRID[idx[0]!]!];
        for (let k = 1; k < K; k++) pole.push(pole[k - 1]! + angleDiff(GRID[idx[k - 1]!]!, GRID[idx[k]!]!));
        const { extra: _extra, ...hand } = o;
        const ap = C[0]![idx[0]!]!.ap;
        best = { total, arm: { side: arm.side, hand: arm.hand, ...hand, pole, ...(ap ? { ap } : {}), ...(arm.slide ? { slide: arm.slide } : {}) }, caps: idx.map((i, k) => capsOf(C[k]![i]!.st)) };
      }
      if (!best) return arm;
      caps.set(arm.side, best.caps);
      return best.arm;
    });
  }
  return arms;
}

/** Dónde cae una mano (su contacto, con la cara de la toma) a lo largo de una dirección, de media. */
function avgAlong(spec: FigureSpec, poses: Pose3[], i: number, dir: Vector3) {
  const v = poses.map((p) => contacts(spec, p, null, null)[i]?.p.dot(dir) ?? 0);
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/**
 * La misma colocación, con el examinador movido (cm hacia delante y hacia su derecha), inclinado algo más o
 * menos y con la cabeza algo más o menos agachada.
 */
export function nudgePlan(plan: ExaminerPlan, fwd: number, right: number, dLean: number, dNeck = 0): ExaminerPlan {
  const lean = Math.max(0, plan.lean + dLean);
  const f = new Vector3(0, 0, 1).applyQuaternion(yawQ(plan.yaw));
  const r = new Vector3(-1, 0, 0).applyQuaternion(yawQ(plan.yaw));
  const out: ExaminerPlan = { ...plan, rootXZ: plan.rootXZ.clone().addScaledVector(f, fwd).addScaledVector(r, right), lean, angles: stanceAngles(plan.stance, lean, plan.angles.neckFlex + dNeck, plan.free ?? 0) };
  out.lift = groundLift(out);
  return out;
}

/** Altura para que lo más bajo (planta o rodilla) toque el suelo. */
function groundLift(plan: ExaminerPlan): number {
  const p = fk(new Vector3(plan.rootXZ.x, 0, plan.rootXZ.z), yawQ(plan.yaw), plan.angles);
  const low = surfaceSamples(p, (part) => /foot|shank|thigh/.test(part)).reduce((m, s) => Math.min(m, s.p.y), Infinity);
  return -low;
}

// ---------- Tomas ----------

/** Contactos de las manos sobre el paciente en esta pose. */
export function contacts(spec: FigureSpec, pose: Pose3, examiner: Pose3 | null, plan: ExaminerPlan | null): Contact[] {
  const hands = (spec.hands ?? []).slice(0, 2);
  return hands.map((h, i) => {
    const grip = spec.grips?.[i] ?? null;
    const kind: GripKind = grip?.kind ?? "press";
    // Abarcar el tobillo o la muñeca es coger la pierna o el antebrazo justo por encima (no el pie ni la mano;
    // la mano mide unos 8 cm de ancho: centrada así, no los pisa). La mano sobre el hombro se apoya en la
    // cintura escapular (acromion), que no gira con el brazo.
    const sh = kind !== "grasp" ? h.match(/^(r|l)_shoulder$/) : null;
    // Abarcar el codo o la rodilla es coger justo por debajo (si no, la mano se mete en el brazo o el muslo doblados).
    const grasped = h.replace(/^(r|l)_ankle$/, "$1_shank@0.84").replace(/^(r|l)_wrist$/, "$1_forearm@0.8").replace(/^(r|l)_elbow$/, "$1_forearm@0.15").replace(/^(r|l)_knee$/, "$1_shank@0.12");
    const info = sh ? shoulderTop(pose, sh[1] as Side) : anchorInfo(pose, kind === "grasp" ? grasped : h);
    if (!info) return { anchor: h, p: new Vector3(), n: new Vector3(0, 1, 0), part: "", a: new Vector3(), axis: new Vector3(0, 1, 0), r: 1, grip: kind, frame: new Quaternion() };
    // La cara de la toma, la del cuerpo; pero si en un miembro esa dirección va a lo largo del segmento (la cara
    // posterior de una pierna levantada en vertical), la del propio segmento (la pantorrilla).
    const limbSide = anchorSide(h);
    let n: Vector3 | null = null;
    if (grip?.face) {
      const body = anatDir(pose, grip.face, h, info);
      const along = Math.abs(body.dot(info.axis)) > 0.8;
      n = (along && info.limb && limbSide && !/foot/.test(info.part) ? limbFace(info, grip.face, limbSide) : null) ?? body;
    }
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
    const slide = plan?.arms.find((a) => a.hand === i)?.slide;
    if (slide) info.p.addScaledVector(info.axis, slide);
    const r = surfaceRadius(info, n);
    return { anchor: h, p: info.p.clone().addScaledVector(n, r), n, part: info.part, a: info.p.clone(), axis: info.axis.clone(), r, grip: kind, frame: info.frame.clone() };
  });
}

/** El hombro como apoyo: la cintura escapular (la espina de la escápula, por detrás y hacia dentro de la articulación). */
function shoulderTop(pose: Pose3, s: Side): AnchorInfo {
  const q = pose.trunkQ;
  return {
    p: pose.pt[`${s}_shoulder`]!.clone().add(new Vector3(-sgn(s) * 3, -0.5, -3.5).applyQuaternion(q)),
    part: "torso",
    axis: new Vector3(0, 1, 0).applyQuaternion(q),
    frame: q.clone(),
    sec: { xp: 5.2, xn: 5.2, zp: 5.2, zn: 5.2 },
    limb: false,
  };
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

/** Puntos de la cara de la palma (mano izquierda; x en espejo para la derecha). */
const PALM_PTS: [number, number, number][] = [-3.1, -1, 1, 3.1].flatMap((x) => [
  [x, -2.5, 1.75] as [number, number, number],
  [x, -5, 1.95] as [number, number, number],
  [x, -7.3, 1.7] as [number, number, number],
  [x, -8.8, 1.35] as [number, number, number],
]);

/** Mano abierta mientras llega a la toma (flexión de los dedos y del pulgar, grados). */
const OPEN: Record<GripKind, { fingers: number[]; thumb: number }> = {
  press: { fingers: [6, 6, 8, 10], thumb: 0 },
  grasp: { fingers: [40, 40, 40, 40], thumb: -8 },
  tips: { fingers: [35, 35, 40, 45], thumb: 10 },
};

/**
 * La mano apoyada de verdad: la palma inclinada y a ras de la piel (ni dentro ni separada, también donde la
 * superficie cambia de grosor, como de la rodilla al muslo) y cada dedo y el pulgar doblados hasta tocarla
 * (rodeándola si abarca).
 */
export function fitHand(ct: Contact, tg: { W: Vector3; q: Quaternion; curl: number }, sdf: BodySDF, side: Side): { W: Vector3; q: Quaternion; fingers: number[]; thumb: number; thumbAt?: GripKind } {
  const W = tg.W.clone();
  const q = tg.q.clone();
  const r = sgn(side);
  const world = (l: Vector3) => l.applyQuaternion(q).add(W);
  // Distancia de una zona de la palma a la piel: un mínimo suave (el mínimo a secas salta de un punto a otro y
  // la mano daría tirones de un instante al siguiente).
  const palm = (pred: (x: number, y: number) => boolean) => {
    const ds = PALM_PTS.filter(([x, y]) => pred(r * x, y)).map(([x, y, z]) => sdf(world(new Vector3(r * x, y, z))).d);
    const lo = Math.min(...ds);
    return lo - 0.5 * Math.log(ds.reduce((a, d) => a + Math.exp(-(d - lo) / 0.5), 0));
  };
  if (ct.grip !== "tips") {
    let moved = 0;
    let tiltX = 0;
    let tiltY = 0;
    const C = new Vector3(0, -5.5, 1.8);
    for (let it = 0; it < 4; it++) {
      // Inclinar: el talón de la mano y los nudillos, y los dos bordes, a la misma distancia de la piel.
      const ax = Math.max(-0.35 - tiltX, Math.min(0.35 - tiltX, -Math.atan2(palm((_, y) => y < -6.5) - palm((_, y) => y > -4), 5.5) * 0.8));
      const ay = Math.max(-0.35 - tiltY, Math.min(0.35 - tiltY, -Math.atan2(palm((x) => x > 0) - palm((x) => x < 0), 6.2) * 0.8));
      if (Math.abs(ax) + Math.abs(ay) > 0.01) {
        const c0 = C.clone().applyQuaternion(q).add(W);
        q.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), ax)).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ay));
        W.copy(c0).sub(C.clone().applyQuaternion(q));
        tiltX += ax;
        tiltY += ay;
      }
      // Y acercar o separar la mano hasta que la palma toque.
      const zW = new Vector3(0, 0, 1).applyQuaternion(q);
      const step = Math.max(-6 - moved, Math.min(3 - moved, palm(() => true) - 0.15));
      W.addScaledVector(zW, step);
      moved += step;
      if (Math.abs(step) < 0.05 && Math.abs(ax) + Math.abs(ay) < 0.01) break;
    }
  }
  // Primer ángulo (de lo más abierto a lo más cerrado) en que los puntos tocan la piel.
  const touch = (pts: (b: number) => Vector3[], lo: number, hi: number, miss: number) => {
    const d = (b: number) => Math.min(...pts(b).map((p) => sdf(world(p)).d));
    if (d(lo) < 0.12) return lo;
    let prev = lo;
    for (let b = lo + 8; b <= hi + 1e-6; b += 8) {
      if (d(b) < 0.12) {
        let a = prev;
        let c = b;
        for (let i = 0; i < 5; i++) {
          const mid = (a + c) / 2;
          if (d(mid) < 0.12) c = mid;
          else a = mid;
        }
        return (a + c) / 2;
      }
      prev = b;
    }
    return miss;
  };
  const range = ct.grip === "grasp" ? [-10, 250, 250] : ct.grip === "tips" ? [20, 210, 70] : [-14, 110, 14];
  const out = FINGERS.map((_, i) => touch((b) => fingerPads(side, i, b), range[0]!, range[1]!, range[2]!));
  const tr = ct.grip === "grasp" ? [-40, 110, 45] : ct.grip === "tips" ? [-10, 90, 30] : [-20, 60, 6];
  const thumb = touch((b) => [thumbPad(side, ct.grip, tg.curl, b)], tr[0]!, tr[1]!, tr[2]!);
  // Si al otro lado no cabe el pulgar (se metería en algo hasta abierto del todo), va junto a los dedos.
  const into = (at: GripKind, b: number) => Math.min(...[3, 6, 9.5].map((d) => sdf(world(thumbPoint(side, at, tg.curl, b, d))).d));
  if (ct.grip !== "press" && into(ct.grip, thumb) < -0.6) {
    const alt = touch((b) => [thumbPad(side, "press", tg.curl, b)], -20, 60, 6);
    if (into("press", alt) > into(ct.grip, thumb)) return { W, q, fingers: out, thumb: alt, thumbAt: "press" };
  }
  return { W, q, fingers: out, thumb };
}

/**
 * Dedos y pulgar de una mano que todavía no ha llegado (en W): cada uno, de abierto (`open`) hacia su forma en
 * la toma (`fit`), hasta donde toque la piel.
 */
function fingersOn(ct: Contact, W: Vector3, q: Quaternion, sdf: BodySDF, side: Side, curl: number, open: { fingers: number[]; thumb: number }, fit: { fingers: number[]; thumb: number; thumbAt?: GripKind }) {
  const world = (l: Vector3) => l.applyQuaternion(q).add(W);
  const stop = (pts: (b: number) => Vector3[], from: number, to: number) => {
    if (to <= from) return to;
    const d = (b: number) => Math.min(...pts(b).map((p) => sdf(world(p)).d));
    if (d(from) < 0.12) return from;
    let prev = from;
    for (let b = from + 10; ; b += 10) {
      const bb = Math.min(b, to);
      if (d(bb) < 0.12) {
        let a = prev;
        let c = bb;
        for (let i = 0; i < 4; i++) {
          const mid = (a + c) / 2;
          if (d(mid) < 0.12) c = mid;
          else a = mid;
        }
        return a;
      }
      if (bb >= to) return to;
      prev = bb;
    }
  };
  // Desde la mano abierta del todo: así ningún dedo empieza metido en la piel.
  const lo = ct.grip === "grasp" ? -10 : ct.grip === "tips" ? 20 : -14;
  const fingers = fit.fingers.map((f, i) => stop((b) => fingerPads(side, i, b), Math.min(lo, f), Math.max(f, open.fingers[i]!)));
  const at = fit.thumbAt ?? ct.grip;
  const thumb = stop((b) => [thumbPad(side, at, curl, b)], Math.min(-40, fit.thumb), Math.max(fit.thumb, open.thumb));
  return { fingers, thumb };
}

/**
 * Pose del examinador en este momento: la mano llega desde fuera de la superficie (reach 0: separada, a
 * punto de tomar; 1: apoyada) y los dedos se cierran sobre la piel. `pat`: el paciente en este momento (para
 * apoyar bien las manos); `gaps`, si se pasa, recibe lo que le falta a cada muñeca para llegar.
 */
export function examinerPose(plan: ExaminerPlan, cts: Contact[], reachAll: number, m = 1, pat?: Pose3 | null, gaps?: Partial<Record<Side, number>>, mix = m, handsReach?: number[]): Pose3 {
  const pose = baseExaminerPose(plan, mix);
  const sdf = pat ? bodySDF(pat) : null;
  const hands: Partial<Record<Side, HandState>> = { ...pose.hands };
  for (const arm of plan.arms) {
    const ct = cts[arm.hand];
    if (!ct) continue;
    // Cada mano llega (o se separa) a su ritmo si el guion suelta alguna.
    const reach = handsReach?.[arm.hand] ?? reachAll;
    const land = ease(Math.min(1, Math.max(0, reach) / 0.6));
    const s = arm.side;
    const S0 = shoulder0(pose, s);
    const tg = handTarget(ct, S0, handAt(arm, mix));
    const open = OPEN[ct.grip];
    const fit: ReturnType<typeof fitHand> = sdf ? fitHand(ct, tg, sdf, s) : { W: tg.W, q: tg.q, fingers: open.fingers.map((f) => f + 20), thumb: open.thumb + 15 };
    let W = fit.W;
    let shape: HandState = { curl: tg.curl, grip: ct.grip, fingers: fit.fingers, thumb: fit.thumb, ...(fit.thumbAt ? { thumbAt: fit.thumbAt } : {}) };
    if (reach < 1) {
      const v = approachDir(arm.ap ?? 0, fit.q, fit.W, S0);
      W = fit.W.clone().addScaledVector(v, hoverOf(ct.grip) * (1 - land));
      if (sdf) {
        // Mientras llega (o se va), cada dedo va hacia su forma final, pero se queda donde toca la piel.
        const rest = (at: Vector3) => fingersOn(ct, at, fit.q, sdf, s, tg.curl, open, fit);
        shape = { ...shape, ...rest(W) };
        // Y si aun así la mano tocara algo antes de tiempo, espera algo más fuera (solo si así toca menos).
        const own = bodySDF(pose);
        const skip = armSkip(plan.arms.map((a) => a.side));
        const deepAt = (at: Vector3, st: HandState) => {
          let deep = 0;
          for (const hp of handPoints(st, s, 2)) {
            const q = hp.p.clone().applyQuaternion(fit.q).add(at);
            const h = sdf(q);
            deep = Math.max(deep, (h.part === ct.part ? -0.8 : 0.2) - h.d, 0.2 - own(q, skip).d);
          }
          return deep;
        };
        let deep = deepAt(W, shape);
        for (let it = 0; it < 3 && deep > 0.02; it++) {
          const W2 = W.clone().addScaledVector(v, deep + 0.15);
          const shape2 = { ...shape, ...rest(W2) };
          const deep2 = deepAt(W2, shape2);
          if (deep2 >= deep) break;
          W = W2;
          shape = shape2;
          deep = deep2;
        }
      } else {
        shape = { ...shape, fingers: open.fingers, thumb: open.thumb };
      }
    }
    const st = solveArm(S0, W, fit.q, poleAt(arm, m), pose.trunkQ, s);
    // Lo que le falta a la muñeca para llegar (si el brazo no da más de sí).
    if (gaps) gaps[s] = st.W.distanceTo(W);
    hands[s] = shape;
    pose.seg[`${s}_upperarm`] = { p: st.S.clone(), q: st.uaQ };
    pose.seg[`${s}_forearm`] = { p: st.E.clone(), q: st.faQ };
    pose.seg[`${s}_hand`] = { p: st.W.clone(), q: fit.q.clone() };
    pose.pt[`${s}_shoulder`] = st.S.clone();
    pose.pt[`${s}_elbow`] = st.E.clone();
    pose.pt[`${s}_wrist`] = st.W.clone();
    pose.pt[`${s}_handtip`] = st.W.clone().add(new Vector3(0, -DIM.hand, 0).applyQuaternion(fit.q));
    pose.girdle[s] = st.S.clone().sub(S0);
    pose.twist[s] = st.twist;
  }
  pose.hands = hands;
  return pose;
}
