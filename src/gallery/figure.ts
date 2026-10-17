// Ilustraciones propias de los tests, generadas a partir de una descripción: postura y ángulos del
// paciente, dónde pone las manos el examinador, flechas de fuerza o movimiento y zona del síntoma.
// Estilo de silueta minimalista con proporciones humanas reales (cabeza con perfil, tronco con pecho,
// lordosis y glúteo, músculos con su forma, manos y pies de su tamaño), el examinador colocado solo
// junto a la camilla o al paciente, encuadre cercano cuando basta una parte del cuerpo, y la maniobra
// animada en bucle (colocación → maniobra → qué buscar → vuelta). Puro (sin React ni imports de valores): devuelve SVG
// como texto, así funciona también en Node para revisar las figuras.

/** Ángulos en grados. En vista lateral: hombro = flexión, cadera = flexión, rodilla = flexión,
 *  codo = flexión, tobillo = flexión dorsal (+) o plantar (−), tronco = inclinación hacia delante,
 *  cuello = flexión. En vista frontal: hombro = abducción, cadera = abducción, rodilla = valgo (+),
 *  codo = flexión hacia la cabeza (posición 90/90), tronco = inclinación lateral a la derecha (+),
 *  cuello = inclinación lateral a la derecha (+). */
export type JointKey =
  | "trunk"
  | "neck"
  | "r_shoulder"
  | "r_elbow"
  | "r_wrist"
  | "r_hip"
  | "r_knee"
  | "r_ankle"
  | "l_shoulder"
  | "l_elbow"
  | "l_wrist"
  | "l_hip"
  | "l_knee"
  | "l_ankle";

export type Posture = "standing" | "sitting" | "supine" | "prone" | "sidelying" | "hooklying" | "quadruped" | "longsitting";

/** Punto de anclaje: una articulación ("r_knee", "pelvis", "head", "neck", "lumbar", "thoracic") o un
 *  punto a lo largo de un segmento ("r_shank@0.8": al 80 % de la pierna desde la rodilla). Segmentos:
 *  trunk, neck, r_upperarm, r_forearm, r_hand, r_thigh, r_shank, r_foot (y los l_). */
export type Anchor = string;

/** Dirección anatómica (respecto al cuerpo, sea cual sea la postura). En vista lateral: anterior,
 *  posterior, cranial, caudal. En vista frontal: medial, lateral (del lado del punto), cranial, caudal. */
export type Direction = "anterior" | "posterior" | "cranial" | "caudal" | "medial" | "lateral";

export type Arrow =
  | { at: Anchor; dir: Direction; kind?: "force" | "move"; label?: string; len?: number }
  | { at: Anchor; rotate: "cw" | "ccw"; label?: string };

export type FigureSpec = {
  view: "side" | "front";
  posture: Posture;
  /** Vista lateral: qué lado se ve de cerca (por defecto el derecho). */
  near?: "r" | "l";
  joints?: Partial<Record<JointKey, number>>;
  /** Posición final del movimiento: la animación va de `joints` a `to` y vuelve. */
  to?: Partial<Record<JointKey, number>>;
  /** Dónde pone las manos el examinador (se dibuja entero y sus brazos llegan a estos puntos). */
  hands?: Anchor[];
  /** "none": sin examinador aunque haya manos (p. ej. el paciente se explora a sí mismo). */
  examiner?: "auto" | "none";
  arrows?: Arrow[];
  /** Zona de dolor o síntoma que busca el test. */
  pain?: Anchor[];
  caption?: string;
};

type V = { x: number; y: number };
const rad = (d: number) => (d * Math.PI) / 180;
/** Dirección con ángulo medido desde "abajo" hacia "delante" (+x). */
const dir = (phi: number): V => ({ x: Math.sin(rad(phi)), y: Math.cos(rad(phi)) });
const add = (a: V, b: V, k = 1): V => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: V) => Math.hypot(a.x, a.y);
const unit = (a: V): V => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const lerp = (a: V, b: V, t: number): V => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const f1 = (n: number) => +n.toFixed(1);

/** Proporciones de un adulto de ~175 unidades de altura (tablas antropométricas de Drillis y Contini). */
const L = { trunk: 50, neck: 6, head: 11.5, upperarm: 31, forearm: 26, hand: 17, thigh: 43, shank: 42, foot: 24, shoulderHalf: 17, hipHalf: 9 };

/** Ángulos de partida de cada postura y cómo se coloca el cuerpo en el dibujo. */
const postures: Record<Posture, { joints: Partial<Record<JointKey, number>>; rot: number; mirror?: boolean; lying?: boolean }> = {
  standing: { joints: {}, rot: 0 },
  sitting: { joints: { r_hip: 90, l_hip: 90, r_knee: 90, l_knee: 90 }, rot: 0 },
  longsitting: { joints: { r_hip: 90, l_hip: 90 }, rot: 0, lying: true },
  supine: { joints: {}, rot: -90, lying: true },
  hooklying: { joints: { r_hip: 45, l_hip: 45, r_knee: 90, l_knee: 90 }, rot: -90, lying: true },
  prone: { joints: {}, rot: 90, mirror: true, lying: true },
  sidelying: { joints: {}, rot: -90, lying: true },
  // Manos bajo los hombros y rodillas bajo las caderas: tronco algo más alto por delante.
  quadruped: { joints: { trunk: 75, r_shoulder: 75, l_shoulder: 75, r_wrist: 90, l_wrist: 90, r_hip: 75, l_hip: 75, r_knee: 90, l_knee: 90, r_ankle: -90, l_ankle: -90 }, rot: 0 },
};

type Seg = { name: string; a: V; b: V; side: "near" | "far" | "mid" };
type Pose = { points: Record<string, V>; segs: Seg[]; head: V; up: V; fwd: V; across: V };

/** Ángulos mezclando la posición inicial y la final (m = 0 inicio, 1 final). */
function anglesAt(spec: FigureSpec, m: number) {
  const base = postures[spec.posture].joints;
  return (k: JointKey) => {
    const a0 = spec.joints?.[k] ?? base[k] ?? 0;
    const a1 = spec.to?.[k] ?? a0;
    return a0 + (a1 - a0) * m;
  };
}

function sidePose(spec: FigureSpec, m: number): Pose {
  const a = anglesAt(spec, m);
  const near = spec.near ?? "r";
  const far = near === "r" ? "l" : "r";
  const points: Record<string, V> = {};
  const segs: Seg[] = [];
  const pelvis = { x: 0, y: 0 };
  const phiTrunk = 180 - a("trunk");
  const shoulder = add(pelvis, dir(phiTrunk), L.trunk);
  const phiNeck = phiTrunk - a("neck");
  const neckTop = add(shoulder, dir(phiNeck), L.neck);
  const head = add(neckTop, dir(phiNeck), L.head);
  Object.assign(points, { pelvis, shoulder, neck: neckTop, head });
  segs.push({ name: "trunk", a: pelvis, b: shoulder, side: "mid" }, { name: "neck", a: shoulder, b: neckTop, side: "mid" });
  for (const s of [far, near] as const) {
    const side = s === near ? "near" : "far";
    const phiUa = phiTrunk - 180 + a(`${s}_shoulder`);
    const el = add(shoulder, dir(phiUa), L.upperarm);
    const phiFa = phiUa + a(`${s}_elbow`);
    const wr = add(el, dir(phiFa), L.forearm);
    const hd = add(wr, dir(phiFa + a(`${s}_wrist`)), L.hand);
    const phiTh = phiTrunk - 180 + a(`${s}_hip`);
    const kn = add(pelvis, dir(phiTh), L.thigh);
    const phiSh = phiTh - a(`${s}_knee`);
    const an = add(kn, dir(phiSh), L.shank);
    const ft = add(an, dir(phiSh + 90 + a(`${s}_ankle`)), L.foot);
    Object.assign(points, {
      [`${s}_shoulder`]: shoulder,
      [`${s}_elbow`]: el,
      [`${s}_wrist`]: wr,
      [`${s}_handtip`]: hd,
      [`${s}_hip`]: pelvis,
      [`${s}_knee`]: kn,
      [`${s}_ankle`]: an,
      [`${s}_foottip`]: ft,
    });
    segs.push(
      { name: `${s}_thigh`, a: pelvis, b: kn, side },
      { name: `${s}_shank`, a: kn, b: an, side },
      { name: `${s}_foot`, a: an, b: ft, side },
      { name: `${s}_upperarm`, a: shoulder, b: el, side },
      { name: `${s}_forearm`, a: el, b: wr, side },
      { name: `${s}_hand`, a: wr, b: hd, side },
    );
  }
  return { points, segs, head, up: dir(phiNeck), fwd: dir(phiNeck - 90), across: { x: 0, y: 0 } };
}

function frontPose(spec: FigureSpec, m: number): Pose {
  const a = anglesAt(spec, m);
  const points: Record<string, V> = {};
  const segs: Seg[] = [];
  const pelvis = { x: 0, y: 0 };
  // +x es la izquierda del paciente (lo vemos de frente); inclinación a la derecha = hacia −x.
  const phiTrunk = 180 + a("trunk");
  const top = add(pelvis, dir(phiTrunk), L.trunk);
  const across = dir(phiTrunk - 90);
  const phiNeck = phiTrunk + a("neck");
  const neckTop = add(top, dir(phiNeck), L.neck);
  const head = add(neckTop, dir(phiNeck), L.head);
  Object.assign(points, { pelvis, shoulder: top, neck: neckTop, head });
  segs.push({ name: "trunk", a: pelvis, b: top, side: "mid" }, { name: "neck", a: top, b: neckTop, side: "mid" });
  const thighScale = spec.posture === "sitting" ? 0.35 : 1;
  for (const s of ["r", "l"] as const) {
    const sign = s === "r" ? -1 : 1;
    const sh = add(top, across, sign * L.shoulderHalf);
    const hip = add(pelvis, across, sign * L.hipHalf);
    const phiUa = phiTrunk - 180 + sign * a(`${s}_shoulder`);
    const el = add(sh, dir(phiUa), L.upperarm);
    const phiFa = phiUa + sign * a(`${s}_elbow`);
    const wr = add(el, dir(phiFa), L.forearm);
    const hd = add(wr, dir(phiFa + sign * a(`${s}_wrist`)), L.hand);
    const phiTh = phiTrunk - 180 + sign * a(`${s}_hip`);
    const kn = add(hip, dir(phiTh), L.thigh * thighScale);
    const phiSh = phiTh + sign * a(`${s}_knee`);
    const an = add(kn, dir(phiSh), L.shank);
    const ft = add(an, dir(phiSh), 5);
    Object.assign(points, {
      [`${s}_shoulder`]: sh,
      [`${s}_elbow`]: el,
      [`${s}_wrist`]: wr,
      [`${s}_handtip`]: hd,
      [`${s}_hip`]: hip,
      [`${s}_knee`]: kn,
      [`${s}_ankle`]: an,
      [`${s}_foottip`]: ft,
    });
    segs.push(
      { name: `${s}_thigh`, a: hip, b: kn, side: "near" },
      { name: `${s}_shank`, a: kn, b: an, side: "near" },
      { name: `${s}_foot`, a: an, b: ft, side: "near" },
      { name: `${s}_upperarm`, a: sh, b: el, side: "near" },
      { name: `${s}_forearm`, a: el, b: wr, side: "near" },
      { name: `${s}_hand`, a: wr, b: hd, side: "near" },
    );
  }
  return { points, segs, head, up: dir(phiNeck), fwd: { x: 0, y: 0 }, across };
}

const segEnds: Record<string, [string, string]> = {
  upperarm: ["shoulder", "elbow"],
  forearm: ["elbow", "wrist"],
  hand: ["wrist", "handtip"],
  thigh: ["hip", "knee"],
  shank: ["knee", "ankle"],
  foot: ["ankle", "foottip"],
};
/** Segmentos que se mueven con cada uno (lo que cuelga de él). */
const distal: Record<string, string[]> = {
  upperarm: ["upperarm", "forearm", "hand"],
  forearm: ["forearm", "hand"],
  hand: ["hand"],
  thigh: ["thigh", "shank", "foot"],
  shank: ["shank", "foot"],
  foot: ["foot"],
};
const jointSeg: Record<string, string> = { elbow: "forearm", wrist: "hand", knee: "shank", ankle: "foot", handtip: "hand", foottip: "foot" };

/** Coordenadas de un anclaje en la pose. */
export function anchorPoint(p: Pose, anchor: Anchor): V | null {
  const [name, t] = anchor.split("@");
  if (!name) return null;
  if (t !== undefined) {
    const k = Number(t);
    if (name === "trunk") return lerp(p.points.pelvis!, p.points.shoulder!, k);
    if (name === "neck") return lerp(p.points.shoulder!, p.points.neck!, k);
    const seg = p.segs.find((s) => s.name === name);
    return seg ? lerp(seg.a, seg.b, k) : null;
  }
  if (name === "head") return p.head;
  if (name === "lumbar") return lerp(p.points.pelvis!, p.points.shoulder!, 0.15);
  if (name === "thoracic") return lerp(p.points.pelvis!, p.points.shoulder!, 0.65);
  const m = name.match(/^(r|l)_(\w+)$/);
  if (m && (m[2] === "hand" || m[2] === "foot")) {
    const seg = p.segs.find((s) => s.name === name);
    return seg ? lerp(seg.a, seg.b, 0.5) : null;
  }
  if (m && jointSeg[m[2]!]) {
    // Una articulación sigue al segmento que sale de ella (si se desplaza, el punto también).
    const seg = p.segs.find((s) => s.name === `${m[1]}_${jointSeg[m[2]!]}`);
    if (seg) return m[2] === "handtip" || m[2] === "foottip" ? seg.b : seg.a;
  }
  return p.points[name] ?? null;
}

/** Dirección local de una dirección anatómica. */
function localDir(spec: FigureSpec, d: Direction, anchor: Anchor, p: Pose, m: number): V {
  const tr = anglesAt(spec, m)("trunk");
  const trunkPhi = spec.view === "side" ? 180 - tr : 180 + tr;
  const up = dir(trunkPhi);
  const fwd = spec.view === "side" ? dir(trunkPhi - 90) : { x: 0, y: 0 };
  if (d === "cranial") return up;
  if (d === "caudal") return { x: -up.x, y: -up.y };
  if (d === "anterior") return fwd;
  if (d === "posterior") return { x: -fwd.x, y: -fwd.y };
  const right = anchor.startsWith("r_");
  const pt = anchorPoint(p, anchor) ?? { x: 0, y: 0 };
  const towardLeft = dir(trunkPhi - 90);
  const sign = right ? 1 : anchor.startsWith("l_") ? -1 : pt.x < 0 ? 1 : -1;
  return d === "medial" ? { x: towardLeft.x * sign, y: towardLeft.y * sign } : { x: -towardLeft.x * sign, y: -towardLeft.y * sign };
}

/** Fuerza perpendicular al dibujo: +1 hacia quien mira (⊙), −1 alejándose (⊗), 0 en el plano. */
function outOfPlane(spec: FigureSpec, d: Direction, anchor: Anchor): number {
  if (spec.view === "front") return d === "anterior" ? 1 : d === "posterior" ? -1 : 0;
  if (d !== "medial" && d !== "lateral") return 0;
  const near = spec.near ?? "r";
  const isNear = !anchor.startsWith(near === "r" ? "l_" : "r_");
  return (d === "lateral") === isNear ? 1 : -1;
}

// ---------- Momentos de la animación ----------

/** Fases del bucle: colocación, maniobra, qué buscar y vuelta. */
export const phases = [
  { id: "setup", label: "Colocación", from: 0, to: 0.22 },
  { id: "move", label: "Maniobra", from: 0.22, to: 0.6 },
  { id: "look", label: "Qué buscar", from: 0.6, to: 0.86 },
  { id: "back", label: "Vuelta", from: 0.86, to: 1 },
] as const;

/** Estado de la animación en el instante t (0-1). */
export function timeline(t: number) {
  const reach = t < 0.2 ? ease(t / 0.2) : t > 0.93 ? 1 - ease((t - 0.93) / 0.07) : 1;
  const m = t < 0.25 ? 0 : t < 0.55 ? ease((t - 0.25) / 0.3) : t < 0.78 ? 1 : t < 0.93 ? 1 - ease((t - 0.78) / 0.15) : 0;
  const arrows = t > 0.2 && t < 0.82 ? Math.min(1, (t - 0.2) / 0.06, (0.82 - t) / 0.06) : 0;
  const pain = t > 0.5 && t < 0.88 ? Math.min(1, (t - 0.5) / 0.08, (0.88 - t) / 0.06) : 0;
  return { reach, m, arrows, pain, pulse: 0.5 + 0.5 * Math.sin(t * Math.PI * 14) };
}

// ---------- Escena: paciente, mobiliario y examinador en coordenadas del dibujo ----------

type Scene = {
  pose: Pose;
  tf: (v: V) => V;
  tfv: (v: V) => V;
  lying: boolean;
  top: boolean;
};

function makeScene(spec: FigureSpec, m: number, nudge: number): Scene {
  const build = spec.view === "side" ? sidePose : frontPose;
  const pose = build(spec, m);
  // Fuerzas sobre un segmento: lo desplazan un poco durante la maniobra (cajones, deslizamientos).
  if (nudge > 0) {
    for (const ar of spec.arrows ?? []) {
      if ("rotate" in ar || (ar.kind ?? "force") !== "force" || outOfPlane(spec, ar.dir, ar.at) !== 0) continue;
      const nm = ar.at.split("@")[0]!;
      const mm = nm.match(/^(r|l)_(\w+)$/);
      if (!mm) continue;
      const segName = segEnds[mm[2]!] ? mm[2]! : jointSeg[mm[2]!];
      if (!segName) continue;
      const d = localDir(spec, ar.dir, ar.at, pose, m);
      const k = 3.2 * nudge;
      for (const s of pose.segs) {
        const sm = s.name.match(/^(r|l)_(\w+)$/);
        if (sm && sm[1] === mm[1] && distal[segName]!.includes(sm[2]!)) {
          s.a = add(s.a, d, k);
          s.b = add(s.b, d, k);
        }
      }
    }
  }
  const pst = postures[spec.posture];
  const rot = rad(pst.rot);
  const tfv = (v: V): V => {
    const r = { x: v.x * Math.cos(rot) - v.y * Math.sin(rot), y: v.x * Math.sin(rot) + v.y * Math.cos(rot) };
    return pst.mirror ? { x: -r.x, y: r.y } : r;
  };
  return { pose, tf: tfv, tfv, lying: !!pst.lying, top: !!pst.lying && spec.view === "front" && spec.posture !== "sidelying" };
}

type Furniture = { floor: number; table?: { x0: number; x1: number; y: number }; tableTop?: { x0: number; x1: number; y0: number; y1: number }; chair?: { x: number; seat: number; back: number } };

/** Mobiliario a partir del cuerpo en las posiciones inicial y final (estable durante la animación). */
function furniture(spec: FigureSpec, a: Scene, b: Scene): Furniture {
  const pts = [a, b].flatMap((s) => Object.values(s.pose.points).map(s.tf));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  if (a.top) {
    // Vista desde arriba: camilla como un rectángulo bajo todo el cuerpo.
    return { floor: Math.max(...ys) + 30, tableTop: { x0: minX - 14, x1: maxX + 14, y0: Math.min(...ys) - 18, y1: Math.max(...ys) + 18 } };
  }
  if (a.lying) {
    const trunk = [a.pose.points.pelvis!, a.pose.points.shoulder!, a.pose.head].map(a.tf);
    const y = Math.max(...trunk.map((p) => p.y)) + 11;
    return { floor: y + 52, table: { x0: minX - 12, x1: maxX + 12, y } };
  }
  const foot = [a, b].flatMap((s) => ["r_ankle", "l_ankle", "r_foottip", "l_foottip", "r_knee", "l_knee"].map((k) => s.tf(s.pose.points[k]!)));
  const floor = Math.max(...foot.map((p) => p.y)) + 4;
  if (spec.posture === "sitting" && spec.view === "side") {
    const pel = a.tf(a.pose.points.pelvis!);
    const fwd = a.tfv({ x: 1, y: 0 });
    return { floor, chair: { x: pel.x, seat: pel.y + 9, back: fwd.x >= 0 ? -1 : 1 } };
  }
  if (spec.posture === "sitting") return { floor, table: { x0: a.tf(a.pose.points.pelvis!).x - 26, x1: a.tf(a.pose.points.pelvis!).x + 26, y: a.tf(a.pose.points.pelvis!).y + 6 } };
  return { floor };
}

type Examiner =
  | { mode: "behind"; shoulders: [V, V]; head: V; hip: V; arms: { s: V; e: V; h: V }[] }
  | { mode: "profile"; facing: 1 | -1; hip: V; shoulder: V; head: V; legs: { k: V; a: V; toe: V }[]; arms: { s: V; e: V; h: V }[] }
  | { mode: "top"; shoulders: [V, V]; head: V; arms: { s: V; e: V; h: V }[] }
  | { mode: "arms"; arms: { s: V; e: V; h: V }[] };

const UA = L.upperarm;
const FA = L.forearm;

/**
 * Plano cercano: solo los antebrazos y las manos del examinador, que entran desde fuera del encuadre
 * (desde arriba si está detrás de la camilla, desde un lado si está de pie, desde abajo si se ve desde
 * arriba). El brazo se alarga fuera de cuadro; el antebrazo visible mantiene su medida.
 */
function closeArms(spec: FigureSpec, sc: Scene, targets: V[], view: { x0: number; x1: number; y0: number; y1: number }, reach: number): Examiner | null {
  if (!targets.length || spec.examiner === "none") return null;
  const body = ["pelvis", "shoulder", "head"].map((k) => sc.tf(k === "head" ? sc.pose.head : sc.pose.points[k]!));
  const bodyX = body.reduce((s, p) => s + p.x, 0) / body.length;
  const mean = targets.reduce((s, p) => s + p.x, 0) / targets.length;
  const sorted = [...targets].sort((a, b) => a.x - b.x);
  const both = targets.length > 1 && Math.min(...targets.map((p) => p.x)) < bodyX - 8 && Math.max(...targets.map((p) => p.x)) > bodyX + 8;
  const fromTop = (sc.lying && !sc.top) || (spec.view === "front" && both);
  const fromBottom = sc.top;
  const arms = sorted.map((t, i) => {
    const spread = sorted.length > 1 ? (i === 0 ? -1 : 1) : mean < (view.x0 + view.x1) / 2 ? -1 : 1;
    let s: V;
    if (fromTop) s = { x: t.x + spread * 22, y: view.y0 - 40 };
    else if (fromBottom) s = { x: t.x + spread * 22, y: view.y1 + 40 };
    else {
      const side = mean >= bodyX ? 1 : -1;
      s = { x: side > 0 ? view.x1 + 40 : view.x0 - 40, y: t.y - 30 + i * 18 };
    }
    const dist = len(sub(t, s));
    const ua = Math.max(L.upperarm, dist * 1.04 - L.forearm);
    const goal = lerp(lerp(s, t, 0.55), t, reach);
    return ik(s, goal, (e) => (fromTop ? -e.y : fromBottom ? e.y : -e.y) + spread * e.x * 0.6 * (fromTop || fromBottom ? 1 : 0), ua, L.forearm);
  });
  return { mode: "arms", arms };
}

/** Codo de un brazo de dos segmentos que llega de s a t; el codo hacia el lado que diga `prefer`. */
function ik(s: V, t: V, prefer: (e: V) => number, UA = L.upperarm, FA = L.forearm): { s: V; e: V; h: V } {
  const d = sub(t, s);
  const dist = len(d);
  const reach = UA + FA - 0.5;
  const dd = Math.min(dist, reach);
  const u = unit(d);
  const cosA = Math.max(-1, Math.min(1, (UA * UA + dd * dd - FA * FA) / (2 * UA * dd || 1)));
  const A = Math.acos(cosA);
  const cand = [A, -A].map((ang) => add(s, { x: u.x * Math.cos(ang) - u.y * Math.sin(ang), y: u.x * Math.sin(ang) + u.y * Math.cos(ang) }, UA));
  const e = prefer(cand[0]!) >= prefer(cand[1]!) ? cand[0]! : cand[1]!;
  return { s, e, h: t };
}

function placeExaminer(spec: FigureSpec, sc: Scene, fur: Furniture, targets: V[], reach: number): Examiner | null {
  if (!targets.length || spec.examiner === "none") return null;
  const mean = { x: targets.reduce((s, p) => s + p.x, 0) / targets.length, y: targets.reduce((s, p) => s + p.y, 0) / targets.length };
  const sorted = [...targets].sort((a, b) => a.x - b.x);
  if (sc.top) {
    // Desde arriba: de pie junto al borde de la camilla, más cerca de quien mira.
    const y = (fur.tableTop?.y1 ?? mean.y) + 16;
    const cx = mean.x;
    const shoulders: [V, V] = [
      { x: cx - 17, y },
      { x: cx + 17, y },
    ];
    const rest = [
      { x: cx - 20, y: y + 4 },
      { x: cx + 20, y: y + 4 },
    ];
    const goal = sorted.length === 1 ? [sorted[0]!.x < cx ? sorted[0]! : null, sorted[0]!.x >= cx ? sorted[0]! : null] : [sorted[0]!, sorted[sorted.length - 1]!];
    const arms = shoulders.map((s, i) => {
      const g = goal[i] ? lerp(rest[i]!, goal[i]!, reach) : rest[i]!;
      return ik(s, g, (e) => (i === 0 ? -e.x : e.x) + e.y * 0.3);
    });
    return { mode: "top", shoulders, head: { x: cx, y: y + 2 }, arms };
  }
  if (sc.lying) {
    // Detrás de la camilla, de frente a quien mira, inclinado sobre el paciente.
    const tableY = fur.table?.y ?? mean.y;
    const cx = Math.min(Math.max(mean.x, (fur.table?.x0 ?? -1e9) + 20), (fur.table?.x1 ?? 1e9) - 20);
    const sy = Math.min(...targets.map((p) => p.y)) - 36;
    const shoulders: [V, V] = [
      { x: cx - 17, y: sy },
      { x: cx + 17, y: sy + 1 },
    ];
    const rest = shoulders.map((s, i) => ({ x: s.x + (i ? 6 : -6), y: s.y + 50 }));
    const goal = sorted.length === 1 ? [sorted[0]!.x < cx ? sorted[0]! : null, sorted[0]!.x >= cx ? sorted[0]! : null] : [sorted[0]!, sorted[sorted.length - 1]!];
    const arms = shoulders.map((s, i) => {
      const g = goal[i] ? lerp(rest[i]!, goal[i]!, reach) : rest[i]!;
      return ik(s, g, (e) => (i === 0 ? -e.x : e.x) - e.y * 0.2);
    });
    return { mode: "behind", shoulders, head: { x: cx, y: sy - 19 }, hip: { x: cx, y: Math.max(tableY + 2, sy + 20) }, arms };
  }
  // De pie (o de rodillas si las manos van bajas), de perfil, al lado del paciente donde están las manos.
  const body = ["pelvis", "shoulder", "head"].map((k) => sc.tf(k === "head" ? sc.pose.head : sc.pose.points[k]!));
  const bodyX = body.reduce((s, p) => s + p.x, 0) / body.length;
  if (spec.view === "front" && targets.length > 1 && Math.min(...targets.map((p) => p.x)) < bodyX - 8 && Math.max(...targets.map((p) => p.x)) > bodyX + 8) {
    // Manos a los dos lados del paciente: el examinador está detrás de él, de frente a quien mira.
    const shY = Math.min(sc.tf(sc.pose.points.shoulder!).y, ...targets.map((p) => p.y)) - 24;
    const cx = bodyX;
    const shoulders: [V, V] = [
      { x: cx - 19, y: shY },
      { x: cx + 19, y: shY },
    ];
    const rest = shoulders.map((q, i) => ({ x: q.x + (i ? 6 : -6), y: q.y + 50 }));
    const goal = [sorted[0]!, sorted[sorted.length - 1]!];
    const arms = shoulders.map((q, i) => ik(q, lerp(rest[i]!, goal[i]!, reach), (e) => (i === 0 ? -e.x : e.x) + e.y * 0.3));
    return { mode: "behind", shoulders, head: { x: cx, y: shY - 19 }, hip: { x: cx, y: fur.floor - 30 }, arms };
  }
  const side: 1 | -1 = mean.x >= bodyX ? 1 : -1;
  const trunkEdge = side > 0 ? Math.max(...body.map((p) => p.x)) : Math.min(...body.map((p) => p.x));
  const floor = fur.floor;
  const kneel = Math.max(...targets.map((p) => p.y)) > floor - 28;
  const hipY = kneel ? floor - 46 : floor - 88;
  let hx = side > 0 ? Math.max(mean.x + 36, trunkEdge + 40) : Math.min(mean.x - 36, trunkEdge - 40);
  if (fur.chair) hx = side > 0 ? Math.max(hx, fur.chair.x + 30) : Math.min(hx, fur.chair.x - 30);
  // Inclina el tronco hacia el paciente hasta que llega a todos los puntos.
  let lean = 0;
  let shoulder = { x: hx, y: hipY - L.trunk };
  for (lean = 0; lean <= 70; lean += 5) {
    shoulder = { x: hx - side * L.trunk * Math.sin(rad(lean)), y: hipY - L.trunk * Math.cos(rad(lean)) };
    if (targets.every((p) => len(sub(p, shoulder)) <= UA + FA - 1)) break;
  }
  const hip = { x: hx, y: hipY };
  const headDir = unit(sub(shoulder, hip));
  const head = add(shoulder, headDir, L.neck + L.head);
  // Piernas: de pie, una un poco adelantada; de rodillas, la de delante con el pie apoyado.
  const fw = -side; // hacia el paciente
  const legs = kneel
    ? [
        { k: { x: hx + side * 4, y: floor - 5 }, a: { x: hx + side * 46, y: floor - 5 }, toe: { x: hx + side * 58, y: floor - 2 } },
        { k: { x: hx + fw * 40, y: hipY - 4 }, a: { x: hx + fw * 40, y: floor - 3 }, toe: { x: hx + fw * 58, y: floor - 2 } },
      ]
    : [
        { k: { x: hx - fw * 4, y: hipY + 43 }, a: { x: hx - fw * 6, y: floor - 3 }, toe: { x: hx + fw * 14, y: floor - 2 } },
        { k: { x: hx + fw * 5, y: hipY + 43 }, a: { x: hx + fw * 5, y: floor - 3 }, toe: { x: hx + fw * 25, y: floor - 2 } },
      ];
  const rest = [add(hip, { x: -side * 6, y: -4 }), add(hip, { x: -side * 2, y: -2 })];
  const goal = [targets[0]!, targets[1] ?? null];
  const arms = [0, 1].map((i) => {
    const g = goal[i] ? lerp(rest[i]!, goal[i]!, reach) : rest[i]!;
    return ik(shoulder, g, (e) => e.y - side * e.x * 0.5);
  });
  return { mode: "profile", facing: (side > 0 ? -1 : 1) as 1 | -1, hip, shoulder, head, legs, arms };
}

// ---------- Dibujo ----------

const C = {
  skin: "var(--fig-skin, #ecd2bd)",
  skinFar: "var(--fig-skin-far, #d6b59c)",
  shirt: "var(--fig-shirt, #d9b95a)",
  shirtFar: "var(--fig-shirt-far, #bf9f40)",
  shorts: "var(--fig-shorts, #0e3b2e)",
  shortsFar: "var(--fig-shorts-far, #0a2a21)",
  line: "var(--fig-line, #4a3a2f)",
  hair: "var(--fig-hair, #3b2d25)",
  scrubs: "var(--fig-scrubs, #1f6f54)",
  scrubsFar: "var(--fig-scrubs-far, #185a44)",
  exLine: "var(--fig-ex-line, #0e3b2e)",
  shoe: "var(--fig-shoe, #2b2b2e)",
  table: "var(--fig-table, #e7dac4)",
  tableEdge: "var(--fig-table-edge, #c4b292)",
  floor: "var(--fig-floor, #ebe0cd)",
  force: "var(--fig-force, #1f6f54)",
  move: "var(--fig-move, #8a8172)",
  pain: "var(--fig-pain, #c0392b)",
  text: "var(--fig-text, #1b1b1d)",
  bg: "var(--fig-bg, #f2e8d8)",
};

/** Perfil de un segmento: [t a lo largo (0-1), semiancho anterior, semiancho posterior]. */
type Profile = [number, number, number][];

const prof: Record<string, { side: Profile; front: Profile }> = {
  thigh: {
    side: [[0, 8.5, 9.5], [0.25, 8.3, 8], [0.6, 7.2, 6.4], [0.9, 5.6, 5.4], [1, 5.2, 5.2]],
    front: [[0, 9, 7.5], [0.3, 8.2, 7.2], [0.7, 6.6, 5.8], [1, 5.2, 5]],
  },
  shank: {
    side: [[0, 5.1, 5.1], [0.2, 4.4, 6.7], [0.5, 3.8, 4.9], [0.85, 2.9, 3.2], [1, 2.9, 3]],
    front: [[0, 5.2, 5], [0.25, 5.4, 5.8], [0.6, 4.1, 4.1], [1, 3, 3]],
  },
  upperarm: {
    side: [[0, 6.4, 6], [0.25, 5.1, 4.9], [0.6, 4.7, 4.5], [1, 3.7, 3.8]],
    front: [[0, 6.8, 4.6], [0.3, 5.4, 4.4], [0.7, 4.5, 4], [1, 3.7, 3.6]],
  },
  forearm: {
    side: [[0, 3.8, 3.9], [0.25, 4.1, 4.1], [0.7, 3.1, 3], [1, 2.4, 2.4]],
    front: [[0, 3.9, 3.9], [0.25, 4.2, 4], [0.7, 3.1, 3], [1, 2.4, 2.4]],
  },
  hand: {
    side: [[0, 2.5, 2.5], [0.35, 3.4, 3], [0.75, 3.1, 2.6], [1, 2, 1.8]],
    front: [[0, 2.6, 2.6], [0.35, 3.5, 3.2], [0.75, 3.2, 2.8], [1, 2, 1.8]],
  },
  neck: {
    side: [[-0.2, 4.6, 4.4], [1.1, 4, 4]],
    front: [[-0.2, 5.4, 5.4], [1.1, 4.5, 4.5]],
  },
  torso: {
    side: [[-0.13, 7, 7], [-0.03, 8, 11], [0.12, 8.5, 11.6], [0.3, 8, 8.6], [0.5, 7.8, 8.2], [0.72, 10, 9.4], [0.9, 9.4, 8.6], [1.04, 7, 6.2]],
    front: [[-0.12, 9, 9], [0, 12.5, 12.5], [0.25, 11.2, 11.2], [0.42, 10.4, 10.4], [0.65, 11.6, 11.6], [0.85, 13.6, 13.6], [1, 15.5, 15.5], [1.07, 8, 8]],
  },
};

/** Contorno cerrado de un segmento con su perfil (puntos en orden), con extremos redondeados. */
function shapeOf(a: V, b: V, profile: Profile, antVec: V, from = -Infinity, to = Infinity): V[] {
  const v = sub(b, a);
  const Ls = len(v) || 1;
  const d = { x: v.x / Ls, y: v.y / Ls };
  const proj = antVec.x * d.x + antVec.y * d.y;
  let ant = { x: antVec.x - d.x * proj, y: antVec.y - d.y * proj };
  ant = len(ant) > 1e-6 ? unit(ant) : { x: -d.y, y: d.x };
  const rows = profile.filter(([t]) => t >= from && t <= to);
  // Cortes rectos (ropa) al principio o al final.
  const at = (t: number) => {
    const i = profile.findIndex(([u]) => u >= t);
    if (i <= 0) return profile[0]!;
    const p0 = profile[i - 1]!;
    const p1 = profile[i]!;
    const r = (t - p0[0]) / (p1[0] - p0[0] || 1);
    return [t, p0[1] + (p1[1] - p0[1]) * r, p0[2] + (p1[2] - p0[2]) * r] as [number, number, number];
  };
  if (from > -Infinity && rows[0]?.[0] !== from) rows.unshift(at(from));
  if (to < Infinity && rows.at(-1)?.[0] !== to) rows.push(at(to));
  const pt = (t: number, w: number) => add(add(a, d, t * Ls), ant, w);
  const left = rows.map(([t, wa]) => pt(t, wa));
  const right = rows.map(([t, , wp]) => pt(t, -wp));
  const cap = (t: number, wa: number, wp: number, outward: number): V[] => {
    const c = add(pt(t, (wa - wp) / 2), d, 0);
    const r = (wa + wp) / 2;
    const out: V[] = [];
    for (let i = 1; i < 4; i++) {
      const ang = (Math.PI * i) / 4;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      // De la cara anterior a la posterior pasando por la punta.
      out.push(add(add(c, ant, r * cos * (outward > 0 ? 1 : -1) * (outward > 0 ? 1 : -1)), d, outward * r * sin));
    }
    return outward > 0 ? out : out.reverse();
  };
  const first = rows[0]!;
  const last = rows.at(-1)!;
  const capB = to < Infinity ? [] : cap(last[0], last[1], last[2], 1);
  const capA = from > -Infinity ? [] : cap(first[0], first[1], first[2], -1);
  return [...left, ...capB, ...right.reverse(), ...capA];
}

/** Camino suave y cerrado por los puntos (Catmull-Rom → Bézier). */
function smooth(pts: V[]): string {
  const n = pts.length;
  if (n < 3) return "";
  const P = (i: number) => pts[(i + n) % n]!;
  let dd = `M${f1(P(0).x)} ${f1(P(0).y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    dd += `C${f1(c1.x)} ${f1(c1.y)} ${f1(c2.x)} ${f1(c2.y)} ${f1(p2.x)} ${f1(p2.y)}`;
  }
  return dd + "Z";
}

/** Contorno sin suavizar (cortes rectos de la ropa). */
function poly(pts: V[]): string {
  return pts.length ? `M${pts.map((p) => `${f1(p.x)} ${f1(p.y)}`).join("L")}Z` : "";
}

type Shape = { d: string; fill: string; line?: string };
/** Un grupo de formas: primero todos los contornos gruesos, luego los rellenos (silueta continua). */
function group(shapes: Shape[], lw: number, extra: Shape[] = []): string {
  const outline = shapes.filter((s) => s.line).map((s) => `<path d="${s.d}" fill="${s.line}" stroke="${s.line}" stroke-width="${f1(lw)}" stroke-linejoin="round"/>`);
  const fills = shapes.map((s) => `<path d="${s.d}" fill="${s.fill}"/>`);
  const over = extra.map((s) => `<path d="${s.d}" fill="${s.fill}"/>`);
  return outline.join("") + fills.join("") + over.join("");
}

const circlePts = (c: V, rx: number, ry: number, rotV: V = { x: 1, y: 0 }, n = 14): V[] => {
  const u = unit(rotV);
  const w = { x: -u.y, y: u.x };
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return add(add(c, u, rx * Math.cos(a)), w, ry * Math.sin(a));
  });
};

/** Cabeza de perfil: cráneo, frente, nariz, labios y mentón; pelo aparte. */
function headSide(c: V, up: V, fwd: V, r: number): { head: V[]; hair: V[]; eye: V; ear: V } {
  const P = (fx: number, uy: number) => add(add(c, fwd, fx * r), up, uy * r);
  const skull: V[] = [];
  for (const a of [-115, -150, 180, 150, 120, 90, 60, 32]) skull.push(P(0.98 * Math.cos(rad(a)), 0.98 * Math.sin(rad(a))));
  const face = [P(0.97, 0.12), P(1.13, -0.16), P(0.98, -0.3), P(1.02, -0.46), P(0.93, -0.66), P(0.62, -0.94), P(0.2, -0.98)];
  const hair: V[] = [];
  for (const a of [215, 180, 150, 120, 90, 60, 38]) hair.push(P(1.04 * Math.cos(rad(a)), 1.04 * Math.sin(rad(a))));
  for (const a of [45, 80, 120, 160, 200]) hair.push(P(0.78 * Math.cos(rad(a)) - 0.05, 0.62 * Math.sin(rad(a)) + 0.22));
  return { head: [...skull, ...face], hair, eye: P(0.62, 0.12), ear: P(-0.08, -0.05) };
}

type Layer = { shapes: Shape[]; over: Shape[] };
const layer = (): Layer => ({ shapes: [], over: [] });
type Built = { farLegs: Layer; farArms: Layer; body: Layer; nearLegs: Layer; nearArms: Layer; marks: string[] };

/** Formas del paciente en coordenadas del cuerpo; `T` las lleva a píxeles. */
function buildPatient(spec: FigureSpec, sc: Scene, T: (v: V) => V, k: number): Built {
  const b: Built = { farLegs: layer(), farArms: layer(), body: layer(), nearLegs: layer(), nearArms: layer(), marks: [] };
  const front = spec.view === "front";
  const pose = sc.pose;
  const seg = (name: string) => pose.segs.find((s) => s.name === name)!;
  const D = (pts: V[]) => smooth(pts.map(T));
  const Dp = (pts: V[]) => poly(pts.map(T));
  const limbAnt = (s: Seg, side: "r" | "l") => {
    if (!front) return { x: unit(sub(s.b, s.a)).y, y: -unit(sub(s.b, s.a)).x };
    // De frente: la cara "anterior" del perfil es la lateral.
    const lat = side === "r" ? { x: -pose.across.x, y: -pose.across.y } : pose.across;
    return lat;
  };
  const view = front ? "front" : "side";
  const addLimb = (side: "r" | "l", where: "far" | "near") => {
    const far = where === "far";
    const skin = far ? C.skinFar : C.skin;
    const legs = far ? b.farLegs : b.nearLegs;
    const arms = far ? b.farArms : b.nearArms;
    for (const part of ["thigh", "shank", "upperarm", "forearm", "hand"] as const) {
      const s = seg(`${side}_${part}`);
      const ant = limbAnt(s, side);
      const dst = part === "thigh" || part === "shank" ? legs : arms;
      dst.shapes.push({ d: D(shapeOf(s.a, s.b, prof[part]![view], ant)), fill: skin, line: C.line });
      if (part === "upperarm") arms.over.push({ d: Dp(shapeOf(s.a, s.b, prof.upperarm![view], ant, -Infinity, 0.42)), fill: far ? C.shirtFar : C.shirt });
      if (part === "thigh") legs.over.push({ d: Dp(shapeOf(s.a, s.b, prof.thigh![view], ant, -Infinity, 0.45)), fill: far ? C.shortsFar : C.shorts });
    }
    // Rodilla y codo: rellenan la unión.
    legs.shapes.push({ d: D(circlePts(seg(`${side}_shank`).a, 5.1, 5.1)), fill: skin, line: C.line });
    arms.shapes.push({ d: D(circlePts(seg(`${side}_forearm`).a, 3.8, 3.8)), fill: skin, line: C.line });
    // Pie: de lado con talón, planta y dedos; de frente, visto por delante.
    const f = seg(`${side}_foot`);
    const sh = seg(`${side}_shank`);
    const shd = unit(sub(sh.b, sh.a));
    if (front) {
      legs.shapes.push({ d: D(circlePts(add(sh.b, shd, 3.5), 5.5, 3.6, shd)), fill: C.shoe, line: C.line });
    } else {
      const fd = unit(sub(f.b, f.a));
      // La planta mira hacia donde apunta la pierna.
      const sole = shd;
      const A = f.a;
      const pts = [add(add(A, fd, -3.5), sole, -2), add(add(A, fd, -5.5), sole, 3), add(add(A, fd, -3), sole, 6.3), add(add(A, fd, 8), sole, 6.4), add(add(A, fd, 17), sole, 5.6), add(add(A, fd, 20), sole, 3.6), add(add(A, fd, 16), sole, 1.2), add(add(A, fd, 7), sole, -1.2), add(add(A, fd, 2), sole, -3.2)];
      legs.shapes.push({ d: D(pts), fill: C.shoe, line: C.line });
    }
  };
  if (front) {
    addLimb("r", "near");
    addLimb("l", "near");
  } else {
    addLimb(spec.near === "l" ? "r" : "l", "far");
    addLimb(spec.near === "l" ? "l" : "r", "near");
  }
  // Tronco con camiseta y pantalón corto; cuello y cabeza.
  const tr = seg("trunk");
  // De lado, el tronco apunta hacia arriba: su cara anterior queda a −90° de "arriba".
  const up = unit(sub(tr.b, tr.a));
  const antTrunk = front ? pose.across : { x: -up.y, y: up.x };
  b.body.shapes.push({ d: D(shapeOf(tr.a, tr.b, prof.torso![view], antTrunk)), fill: C.shirt, line: C.line });
  b.body.over.push({ d: Dp(shapeOf(tr.a, tr.b, prof.torso![view], antTrunk, -Infinity, 0.2)), fill: C.shorts });
  const nk = seg("neck");
  b.body.shapes.push({ d: D(shapeOf(nk.a, nk.b, prof.neck![view], antTrunk)), fill: C.skin, line: C.line });
  const r = L.head;
  const hu = unit(pose.up);
  if (front) {
    const across = { x: -hu.y, y: hu.x };
    b.body.shapes.push({ d: D(circlePts(pose.head, r * 0.86, r, hu)), fill: C.skin, line: C.line });
    const hairPts = [...Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI * (i / 8);
      return add(add(pose.head, across, Math.cos(a) * r * 0.92), hu, Math.sin(a) * r * 1.04);
    }), add(add(pose.head, across, -r * 0.7), hu, r * 0.25), add(pose.head, hu, r * 0.55), add(add(pose.head, across, r * 0.7), hu, r * 0.25)];
    b.body.over.push({ d: D(hairPts), fill: C.hair });
    for (const sgn of [-1, 1]) {
      const e = T(add(add(pose.head, across, sgn * r * 0.34), hu, -r * 0.08));
      b.marks.push(`<circle cx="${f1(e.x)}" cy="${f1(e.y)}" r="${f1(0.95 * k)}" fill="${C.line}"/>`);
    }
  } else {
    const fw = unit(pose.fwd);
    const h = headSide(pose.head, hu, fw, r);
    b.body.shapes.push({ d: D(h.head), fill: C.skin, line: C.line });
    b.body.over.push({ d: D(h.hair), fill: C.hair });
    const e = T(h.eye);
    const ear = T(h.ear);
    b.marks.push(`<circle cx="${f1(e.x)}" cy="${f1(e.y)}" r="${f1(0.95 * k)}" fill="${C.line}"/>`, `<circle cx="${f1(ear.x)}" cy="${f1(ear.y)}" r="${f1(1.8 * k)}" fill="${C.skinFar}"/>`);
  }
  return b;
}

/** Examinador: misma silueta, con pijama, en coordenadas del dibujo (ya giradas). */
function buildExaminer(ex: Examiner, T: (v: V) => V, k: number): { back: Shape[]; backOver: Shape[]; arms: Shape[]; armsOver: Shape[]; marks: string[] } {
  const back: Shape[] = [];
  const backOver: Shape[] = [];
  const arms: Shape[] = [];
  const armsOver: Shape[] = [];
  const marks: string[] = [];
  const D = (pts: V[]) => smooth(pts.map(T));
  const Dp = (pts: V[]) => poly(pts.map(T));
  const arm = (a: { s: V; e: V; h: V }, far = false) => {
    const ant = { x: 0, y: -1 };
    const ua = shapeOf(a.s, a.e, prof.upperarm!.front, ant);
    arms.push({ d: D(ua), fill: far ? C.scrubsFar : C.scrubs, line: C.exLine });
    const fa = shapeOf(a.e, a.h, prof.forearm!.front, ant);
    arms.push({ d: D(fa), fill: far ? C.skinFar : C.skin, line: C.line });
    armsOver.push({ d: Dp(shapeOf(a.s, a.e, prof.upperarm!.front, ant, -Infinity, 0.55)), fill: far ? C.scrubsFar : C.scrubs });
    arms.push({ d: D(circlePts(a.e, 3.8, 3.8)), fill: far ? C.skinFar : C.skin, line: C.line });
    // Mano: un poco más allá del punto de contacto, en la dirección del antebrazo.
    const hd = unit(sub(a.h, a.e));
    arms.push({ d: D(shapeOf(add(a.h, hd, -6), add(a.h, hd, 9), prof.hand!.front, { x: -hd.y, y: hd.x })), fill: far ? C.skinFar : C.skin, line: C.line });
  };
  const r = L.head;
  if (ex.mode === "arms") {
    for (const a of ex.arms) arm(a);
    return { back, backOver, arms, armsOver, marks };
  }
  if (ex.mode === "top") {
    for (const a of ex.arms) arm(a);
    const c = lerp(ex.shoulders[0], ex.shoulders[1], 0.5);
    back.push({ d: D(circlePts(c, 22, 9)), fill: C.scrubs, line: C.exLine });
    back.push({ d: D(circlePts(ex.head, r * 0.85, r * 0.95, { x: 0, y: 1 })), fill: C.hair, line: C.line });
    return { back, backOver, arms, armsOver, marks };
  }
  if (ex.mode === "behind") {
    const [sl, sr] = ex.shoulders;
    const top = lerp(sl, sr, 0.5);
    const up = unit(sub(top, ex.hip));
    const across = { x: -up.y, y: up.x };
    back.push({ d: D(shapeOf(ex.hip, top, prof.torso!.front, across)), fill: C.scrubs, line: C.exLine });
    const neckTop = add(top, up, L.neck);
    back.push({ d: D(shapeOf(top, neckTop, prof.neck!.front, across)), fill: C.skin, line: C.line });
    // Cuello en V del pijama.
    backOver.push({ d: Dp([add(add(top, across, -5), up, 1.5), add(top, up, -6), add(add(top, across, 5), up, 1.5)]), fill: C.skin });
    back.push({ d: D(circlePts(ex.head, r * 0.86, r, up)), fill: C.skin, line: C.line });
    const hairPts = Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI * (i / 8);
      return add(add(ex.head, across, Math.cos(a) * r * 0.92), up, Math.sin(a) * r * 1.04);
    });
    backOver.push({ d: D([...hairPts, add(ex.head, up, r * 0.4)]), fill: C.hair });
    for (const sgn of [-1, 1]) {
      const e = T(add(add(ex.head, across, sgn * r * 0.34), up, -r * 0.08));
      marks.push(`<circle cx="${f1(e.x)}" cy="${f1(e.y)}" r="${f1(0.95 * k)}" fill="${C.line}"/>`);
    }
    for (const a of ex.arms) arm(a);
    return { back, backOver, arms, armsOver, marks };
  }
  // De perfil.
  const fwd = { x: ex.facing, y: 0 };
  for (const [i, leg] of ex.legs.entries()) {
    const fill = i === 0 ? C.scrubsFar : C.scrubs;
    const lfwd = unit(sub(leg.toe, leg.a));
    back.push({ d: D(shapeOf(ex.hip, leg.k, prof.thigh!.side, fwd)), fill, line: C.exLine });
    back.push({ d: D(shapeOf(leg.k, leg.a, prof.shank!.side, fwd)), fill, line: C.exLine });
    back.push({ d: D(circlePts(leg.k, 5.4, 5.4)), fill, line: C.exLine });
    const sole = { x: lfwd.y * ex.facing * -1 || 0, y: 1 };
    const A = leg.a;
    back.push({ d: D([add(add(A, lfwd, -3.5), sole, -2), add(add(A, lfwd, -5), sole, 3), add(A, sole, 4), add(add(A, lfwd, 17), sole, 3.6), add(add(A, lfwd, 19), sole, 1.5), add(add(A, lfwd, 8), sole, -1.5)]), fill: C.shoe, line: C.line });
  }
  const up = unit(sub(ex.shoulder, ex.hip));
  const antT = len(sub(fwd, { x: 0, y: 0 })) ? fwd : { x: -up.y, y: up.x };
  back.push({ d: D(shapeOf(ex.hip, ex.shoulder, prof.torso!.side, antT)), fill: C.scrubs, line: C.exLine });
  const neckTop = add(ex.shoulder, up, L.neck);
  back.push({ d: D(shapeOf(ex.shoulder, neckTop, prof.neck!.side, antT)), fill: C.skin, line: C.line });
  const fwdHead = unit({ x: -up.y * -ex.facing, y: up.x * -ex.facing });
  const hf = Math.sign(fwdHead.x) === ex.facing ? fwdHead : { x: -fwdHead.x, y: -fwdHead.y };
  const h = headSide(ex.head, up, hf, r);
  back.push({ d: D(h.head), fill: C.skin, line: C.line });
  backOver.push({ d: D(h.hair), fill: C.hair });
  const e = T(h.eye);
  marks.push(`<circle cx="${f1(e.x)}" cy="${f1(e.y)}" r="${f1(0.95 * k)}" fill="${C.line}"/>`);
  arm(ex.arms[1]!, true);
  arm(ex.arms[0]!);
  return { back, backOver, arms, armsOver, marks };
}

function drawFurniture(fur: Furniture, P: (v: V) => V, k: number, out: string[]) {
  if (fur.tableTop) {
    const a = P({ x: fur.tableTop.x0, y: fur.tableTop.y0 });
    const b = P({ x: fur.tableTop.x1, y: fur.tableTop.y1 });
    out.push(`<rect x="${f1(a.x)}" y="${f1(a.y)}" width="${f1(b.x - a.x)}" height="${f1(b.y - a.y)}" rx="${f1(6 * k)}" fill="${C.table}" stroke="${C.tableEdge}" stroke-width="1.2"/>`);
    return;
  }
  const fy = P({ x: 0, y: fur.floor }).y;
  out.push(`<rect x="-10" y="${f1(fy)}" width="${W + 20}" height="${f1(Math.max(0, H - fy + 10))}" fill="${C.floor}"/>`);
  if (fur.table) {
    const a = P({ x: fur.table.x0, y: fur.table.y });
    const b = P({ x: fur.table.x1, y: fur.table.y });
    const th = 6 * k;
    const bx0 = a.x + 12 * k;
    const bx1 = b.x - 12 * k;
    out.push(`<rect x="${f1(bx0)}" y="${f1(a.y + th)}" width="${f1(Math.max(0, bx1 - bx0))}" height="${f1(Math.max(0, fy - a.y - th))}" fill="${C.table}" stroke="${C.tableEdge}" stroke-width="1"/>`);
    out.push(`<rect x="${f1(a.x)}" y="${f1(a.y)}" width="${f1(b.x - a.x)}" height="${f1(th)}" rx="${f1(3 * k)}" fill="${C.table}" stroke="${C.tableEdge}" stroke-width="1.2"/>`);
  }
  if (fur.chair) {
    const s = P({ x: fur.chair.x, y: fur.chair.seat });
    const dx = fur.chair.back;
    const x0 = s.x + dx * 12 * k;
    const x1 = s.x - dx * 24 * k;
    out.push(`<rect x="${f1(x0 - 2 * k)}" y="${f1(s.y - 46 * k)}" width="${f1(4 * k)}" height="${f1(46 * k)}" rx="${f1(2 * k)}" fill="${C.table}" stroke="${C.tableEdge}" stroke-width="1"/>`);
    out.push(`<rect x="${f1(Math.min(x0, x1))}" y="${f1(s.y)}" width="${f1(Math.abs(x1 - x0))}" height="${f1(4 * k)}" rx="${f1(2 * k)}" fill="${C.table}" stroke="${C.tableEdge}" stroke-width="1"/>`);
    for (const x of [x0, x1]) out.push(`<rect x="${f1(x - 1.5 * k)}" y="${f1(s.y + 4 * k)}" width="${f1(3 * k)}" height="${f1(Math.max(0, fy - s.y - 4 * k))}" fill="${C.table}" stroke="${C.tableEdge}" stroke-width="1"/>`);
  }
}

export const W = 240;
export const H = 180;

type Camera = { k: number; ox: number; oy: number; close: boolean; view: { x0: number; x1: number; y0: number; y1: number } };
const cameras = new Map<string, Camera>();

/**
 * Encuadre fijo para toda la animación. Si el examinador trabaja sobre una zona, plano cercano de esa
 * zona (con sus manos y lo que se mueve); si no, el cuerpo entero.
 */
function camera(spec: FigureSpec): Camera {
  const key = JSON.stringify(spec);
  const hit = cameras.get(key);
  if (hit) return hit;
  const a = makeScene(spec, 0, 0);
  const b = makeScene(spec, 1, 1);
  const fur = furniture(spec, a, b);
  const all: V[] = [];
  const roi: V[] = [];
  for (const s of [a, b]) {
    all.push(...Object.values(s.pose.points).map(s.tf), s.tf(s.pose.head));
    const anchors = [...(spec.hands ?? []), ...(spec.pain ?? []), ...(spec.arrows ?? []).map((x) => x.at)];
    roi.push(...anchors.map((h) => anchorPoint(s.pose, h)).filter((p): p is V => !!p).map(s.tf));
    const targets = (spec.hands ?? []).map((h) => anchorPoint(s.pose, h)).filter((p): p is V => !!p).map(s.tf);
    const ex = placeExaminer(spec, s, fur, targets, 1);
    if (ex) {
      if (ex.mode !== "arms") all.push(ex.head);
      all.push(...ex.arms.flatMap((x) => [x.s, x.e, x.h]));
      if (ex.mode === "profile") all.push(ex.hip, ...ex.legs.flatMap((l) => [l.k, l.a, l.toe]));
    }
  }
  // Lo que se mueve entre el inicio y el final también entra en el plano.
  for (const sg of a.pose.segs) {
    const o = b.pose.segs.find((x) => x.name === sg.name)!;
    if (len(sub(o.b, sg.b)) > 2) roi.push(a.tf(sg.a), a.tf(sg.b), b.tf(o.b));
  }
  if (fur.table) all.push({ x: fur.table.x0, y: fur.table.y }, { x: fur.table.x1, y: fur.table.y });
  if (fur.tableTop) all.push({ x: fur.tableTop.x0, y: fur.tableTop.y0 }, { x: fur.tableTop.x1, y: fur.tableTop.y1 });
  if (!fur.tableTop) all.push({ x: all[0]!.x, y: fur.floor + 4 });
  const box = (pts: V[], pad: number) => {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad };
  };
  const full = box(all, 12);
  let use = full;
  let close = false;
  if (spec.hands?.length && spec.examiner !== "none" && roi.length) {
    const r = box(roi, 34);
    // Tamaño mínimo del plano: lo bastante para ver la articulación y el segmento vecino.
    const minW = 150;
    const wNeed = Math.max(r.x1 - r.x0, minW, ((r.y1 - r.y0) * W) / H);
    const hNeed = (wNeed * H) / W;
    const cx = (r.x0 + r.x1) / 2;
    const cy = (r.y0 + r.y1) / 2;
    const cand = { x0: cx - wNeed / 2, x1: cx + wNeed / 2, y0: cy - hNeed / 2, y1: cy + hNeed / 2 };
    const fullW = Math.max(full.x1 - full.x0, ((full.y1 - full.y0) * W) / H);
    if (wNeed < fullW * 0.78) {
      use = cand;
      close = true;
    }
  }
  const k = Math.min(W / (use.x1 - use.x0), H / (use.y1 - use.y0), 2.4);
  const ox = (W - (use.x1 - use.x0) * k) / 2 - use.x0 * k;
  const oy = (H - (use.y1 - use.y0) * k) / 2 - use.y0 * k;
  const cam = { k, ox, oy, close, view: { x0: -ox / k, x1: (W - ox) / k, y0: -oy / k, y1: (H - oy) / k } };
  if (cameras.size > 400) cameras.clear();
  cameras.set(key, cam);
  return cam;
}

/**
 * Un fotograma de la animación (t de 0 a 1). Con `still`, la imagen fija de la maniobra: posición
 * final, flechas y síntoma visibles y la posición inicial en discontinua.
 */
export function renderFrame(spec: FigureSpec, title: string, uid: string, t: number, still = false): string {
  const tl = still ? { reach: 1, m: 1, arrows: 1, pain: 1, pulse: 1 } : timeline(t);
  const cam = camera(spec);
  const k = cam.k;
  const sc = makeScene(spec, tl.m, tl.arrows * (spec.to ? 0 : 1));
  const fur = furniture(spec, makeScene(spec, 0, 0), makeScene(spec, 1, 1));
  const toPx = (v: V): V => ({ x: v.x * k + cam.ox, y: v.y * k + cam.oy });
  const P = (v: V) => toPx(sc.tf(v));
  const lw = Math.max(1.6, 2.2 * Math.min(k, 1.4));

  const furOut: string[] = [];
  drawFurniture(fur, toPx, k, furOut);

  const targets = (spec.hands ?? []).map((h) => anchorPoint(sc.pose, h)).filter((p): p is V => !!p).map(sc.tf);
  const ex = cam.close ? closeArms(spec, sc, targets, cam.view, tl.reach) : placeExaminer(spec, sc, fur, targets, tl.reach);
  const exB = ex ? buildExaminer(ex, toPx, k) : null;
  const pat = buildPatient(spec, sc, P, k);

  // Posición inicial en discontinua en la imagen fija.
  const ghost: string[] = [];
  if (still && spec.to) {
    const g = makeScene(spec, 0, 0);
    for (const s of g.pose.segs) {
      const o = sc.pose.segs.find((x) => x.name === s.name)!;
      if (len(sub(o.a, s.a)) + len(sub(o.b, s.b)) <= 0.5) continue;
      const a = toPx(g.tf(s.a));
      const b2 = toPx(g.tf(s.b));
      ghost.push(`<line x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b2.x)}" y2="${f1(b2.y)}" stroke="${C.move}" stroke-width="${f1(7 * k)}" stroke-linecap="round" opacity="0.18"/>`);
    }
  }

  // Síntoma: brillo que late en "qué buscar".
  const painOut: string[] = [];
  if (tl.pain > 0) {
    for (const a of spec.pain ?? []) {
      const p = anchorPoint(sc.pose, a);
      if (!p) continue;
      const q = P(p);
      const r = (7 + 2 * (still ? 0 : tl.pulse)) * k;
      painOut.push(`<circle cx="${f1(q.x)}" cy="${f1(q.y)}" r="${f1(r * 1.7)}" fill="url(#pg-${uid})" opacity="${f1(tl.pain)}"/>`);
    }
  }

  // Flechas.
  const arrowsOut: string[] = [];
  const labels: string[] = [];
  if (tl.arrows > 0) {
    const op = f1(tl.arrows);
    for (const ar of spec.arrows ?? []) {
      const p = anchorPoint(sc.pose, ar.at);
      if (!p) continue;
      const q = P(p);
      if ("rotate" in ar) {
        const r = 13 * Math.min(k, 1.6);
        const sweep = ar.rotate === "cw" ? 1 : 0;
        const a0 = rad(-155);
        const a1 = rad(-25);
        const s0 = { x: q.x + r * Math.cos(sweep ? a0 : a1), y: q.y + r * Math.sin(sweep ? a0 : a1) };
        const e0 = { x: q.x + r * Math.cos(sweep ? a1 : a0), y: q.y + r * Math.sin(sweep ? a1 : a0) };
        arrowsOut.push(`<path d="M${f1(s0.x)} ${f1(s0.y)}A${f1(r)} ${f1(r)} 0 0 ${sweep} ${f1(e0.x)} ${f1(e0.y)}" fill="none" stroke="${C.force}" stroke-width="2.8" stroke-linecap="round" marker-end="url(#ah-${uid})" opacity="${op}"/>`);
        if (ar.label) labels.push(`<text x="${f1(q.x)}" y="${f1(q.y - r - 5)}" text-anchor="middle" opacity="${op}">${esc(ar.label)}</text>`);
        continue;
      }
      const oop = outOfPlane(spec, ar.dir, ar.at);
      if (oop !== 0) {
        const r = 6.5;
        const c = { x: q.x + 11, y: q.y - 11 };
        arrowsOut.push(`<circle cx="${f1(c.x)}" cy="${f1(c.y)}" r="${f1(r)}" fill="${C.bg}" stroke="${C.force}" stroke-width="2" opacity="${op}"/>`);
        if (oop > 0) arrowsOut.push(`<circle cx="${f1(c.x)}" cy="${f1(c.y)}" r="${f1(r * 0.32)}" fill="${C.force}" opacity="${op}"/>`);
        else {
          const e = r * 0.55;
          arrowsOut.push(`<path d="M${f1(c.x - e)} ${f1(c.y - e)}L${f1(c.x + e)} ${f1(c.y + e)}M${f1(c.x - e)} ${f1(c.y + e)}L${f1(c.x + e)} ${f1(c.y - e)}" stroke="${C.force}" stroke-width="2" opacity="${op}"/>`);
        }
        if (ar.label) labels.push(`<text x="${f1(c.x)}" y="${f1(c.y - r - 4)}" text-anchor="middle" opacity="${op}">${esc(ar.label)}</text>`);
        continue;
      }
      const dv = unit(sc.tfv(localDir(spec, ar.dir, ar.at, sc.pose, tl.m)));
      const L0 = (ar.len ?? 22) * Math.min(k, 1.5);
      const kind = ar.kind ?? "force";
      const push = still ? 0 : (tl.pulse - 0.5) * 3;
      const gap = 8;
      const from = kind === "force" ? add(q, dv, -(L0 + gap) + push) : add(q, dv, gap);
      const to = kind === "force" ? add(q, dv, -gap + push) : add(q, dv, L0 + gap);
      arrowsOut.push(
        kind === "force"
          ? `<line x1="${f1(from.x)}" y1="${f1(from.y)}" x2="${f1(to.x)}" y2="${f1(to.y)}" stroke="${C.force}" stroke-width="3.2" stroke-linecap="round" marker-end="url(#ah-${uid})" opacity="${op}"/>`
          : `<line x1="${f1(from.x)}" y1="${f1(from.y)}" x2="${f1(to.x)}" y2="${f1(to.y)}" stroke="${C.move}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="4 4" marker-end="url(#am-${uid})" opacity="${op}"/>`,
      );
      if (ar.label) {
        const at = kind === "force" ? from : to;
        labels.push(`<text x="${f1(at.x - dv.x * 5)}" y="${f1(at.y - dv.y * 5 + (dv.y > 0.3 ? -3 : 9))}" text-anchor="middle" opacity="${op}">${esc(ar.label)}</text>`);
      }
    }
  }
  const clamp = (l: string) =>
    l.replace(/x="([-\d.]+)" y="([-\d.]+)"/, (_m, x: string, y: string) => {
      const half = (l.replace(/<[^>]+>/g, "").length * 4.4) / 2 + 3;
      return `x="${Math.min(W - half, Math.max(half, Number(x))).toFixed(1)}" y="${Math.min(H - 4, Math.max(11, Number(y))).toFixed(1)}"`;
    });
  const labelOut = labels.map((l) => clamp(l).replace("<text ", `<text font-size="9" font-weight="600" letter-spacing="0.2" fill="${C.text}" paint-order="stroke" stroke="${C.bg}" stroke-width="3.5" stroke-linejoin="round" `));

  const defs =
    `<defs>` +
    `<marker id="ah-${uid}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3.6" markerHeight="3.6" orient="auto-start-reverse"><path d="M1 1L9 5L1 9Q2.5 5 1 1z" fill="${C.force}"/></marker>` +
    `<marker id="am-${uid}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M1 1L9 5L1 9Q2.5 5 1 1z" fill="${C.move}"/></marker>` +
    `<radialGradient id="pg-${uid}"><stop offset="0" stop-color="#ff4d3d" stop-opacity="0.6"/><stop offset="0.6" stop-color="#ff4d3d" stop-opacity="0.25"/><stop offset="1" stop-color="#ff4d3d" stop-opacity="0"/></radialGradient>` +
    `</defs>`;

  const g = (l: Layer) => group(l.shapes, lw, l.over);
  // De frente: piernas, tronco y brazos; de lado: miembros lejanos, tronco y miembros cercanos.
  const patient =
    spec.view === "front"
      ? g(pat.nearLegs) + g(pat.body) + pat.marks.join("") + g(pat.nearArms)
      : g(pat.farArms) + g(pat.farLegs) + g(pat.body) + pat.marks.join("") + g(pat.nearLegs) + g(pat.nearArms);
  const exBack = exB ? group(exB.back, lw, exB.backOver) + exB.marks.join("") : "";
  const exArms = exB ? group(exB.arms, lw, exB.armsOver) : "";
  const behind = ex?.mode === "behind" || ex?.mode === "top";
  // En plano cercano los brazos van por encima de todo; las manos tocan al paciente.
  const body = behind ? [exBack, ...furOut, ...ghost, patient, exArms] : [...furOut, ...ghost, patient, exBack, exArms];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${defs}${body.join("")}${painOut.join("")}${arrowsOut.join("")}${labelOut.join("")}</svg>`;
}

/** Imagen fija de la maniobra (para listas, impresión y quien prefiere menos movimiento). */
export function renderFigure(spec: FigureSpec, title: string, uid = "f"): string {
  return renderFrame(spec, title, uid, 0.6, true);
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
