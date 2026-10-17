// Ilustraciones propias de los tests, generadas a partir de una descripción: postura y ángulos del
// paciente, dónde pone las manos el examinador, flechas de fuerza o movimiento y zona del síntoma.
// Dibuja a los dos personajes con cuerpo (cabeza, tronco, extremidades con volumen, manos, pies y
// ropa), el examinador colocado solo junto a la camilla o al paciente, y anima la maniobra en bucle
// (colocación → maniobra → qué buscar → vuelta). Puro (sin React ni imports de valores): devuelve SVG
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

const L = { trunk: 52, neck: 7, head: 10.5, upperarm: 28, forearm: 25, hand: 9, thigh: 40, shank: 38, foot: 14, shoulderHalf: 15, hipHalf: 8 };

/** Ángulos de partida de cada postura y cómo se coloca el cuerpo en el dibujo. */
const postures: Record<Posture, { joints: Partial<Record<JointKey, number>>; rot: number; mirror?: boolean; lying?: boolean }> = {
  standing: { joints: {}, rot: 0 },
  sitting: { joints: { r_hip: 90, l_hip: 90, r_knee: 90, l_knee: 90 }, rot: 0 },
  longsitting: { joints: { r_hip: 90, l_hip: 90 }, rot: 0, lying: true },
  supine: { joints: {}, rot: -90, lying: true },
  hooklying: { joints: { r_hip: 45, l_hip: 45, r_knee: 90, l_knee: 90 }, rot: -90, lying: true },
  prone: { joints: {}, rot: 90, mirror: true, lying: true },
  sidelying: { joints: {}, rot: -90, lying: true },
  quadruped: { joints: { trunk: 90, r_shoulder: 90, l_shoulder: 90, r_hip: 90, l_hip: 90, r_knee: 90, l_knee: 90 }, rot: 0 },
};

type Seg = { name: string; a: V; b: V; side: "near" | "far" | "mid" };
type Pose = { points: Record<string, V>; segs: Seg[]; head: V; up: V; fwd: V };

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
  return { points, segs, head, up: dir(phiNeck), fwd: dir(phiNeck - 90) };
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
    const ft = add(an, dir(phiSh + sign * 75), L.foot * 0.55);
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
  return { points, segs, head, up: dir(phiNeck), fwd: { x: 0, y: 0 } };
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
  return { pose, tf: tfv, tfv, lying: !!pst.lying, top: !!pst.lying && spec.view === "front" };
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
  | { mode: "top"; shoulders: [V, V]; head: V; arms: { s: V; e: V; h: V }[] };

const UA = 30;
const FA = 27;

/** Codo de un brazo de dos segmentos que llega de s a t; el codo hacia el lado que diga `prefer`. */
function ik(s: V, t: V, prefer: (e: V) => number): { s: V; e: V; h: V } {
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
  const kneel = Math.max(...targets.map((p) => p.y)) > floor - 45;
  const hipY = kneel ? floor - 40 : floor - 78;
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
  const head = add(shoulder, headDir, 7 + L.head);
  const legs = kneel
    ? [
        { k: { x: hx - side * 2, y: floor - 2 }, a: { x: hx + side * 32, y: floor - 4 }, toe: { x: hx + side * 40, y: floor - 1 } },
        { k: { x: hx - side * 30, y: hipY + 6 }, a: { x: hx - side * 30, y: floor - 4 }, toe: { x: hx - side * 42, y: floor - 3 } },
      ]
    : [
        { k: { x: hx + side * 3, y: hipY + 40 }, a: { x: hx + side * 4, y: floor - 4 }, toe: { x: hx - side * 10, y: floor - 3 } },
        { k: { x: hx - side * 2, y: hipY + 40 }, a: { x: hx - side * 4, y: floor - 4 }, toe: { x: hx - side * 18, y: floor - 3 } },
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
  skin: "var(--fig-skin, #f0c6a2)",
  skinFar: "var(--fig-skin-far, #d9a982)",
  skinLine: "var(--fig-skin-line, #a26f4b)",
  shirt: "var(--fig-shirt, #6f8fb3)",
  shirtFar: "var(--fig-shirt-far, #56769a)",
  shorts: "var(--fig-shorts, #3d4a5c)",
  shortsFar: "var(--fig-shorts-far, #2e3947)",
  clothLine: "var(--fig-cloth-line, #26303d)",
  hair: "var(--fig-hair, #4a3426)",
  scrubs: "var(--fig-scrubs, #2c8a83)",
  scrubsFar: "var(--fig-scrubs-far, #1f6964)",
  scrubsLine: "var(--fig-scrubs-line, #174d49)",
  shoe: "var(--fig-shoe, #2b2b2b)",
  table: "var(--fig-table, #cfd6de)",
  tableLine: "var(--fig-table-line, #8d99a6)",
  pad: "var(--fig-pad, #e3e8ee)",
  floor: "var(--fig-floor, #c3cad2)",
  force: "var(--fig-force, #0e6672)",
  move: "var(--fig-move, #7d8a97)",
  pain: "var(--fig-pain, #d64545)",
  text: "var(--fig-text, #1f2933)",
  bg: "var(--fig-bg, #ffffff)",
};

/** Extremidad con volumen: cápsula de grosor ra en a y rb en b. */
function capsule(a: V, b: V, ra: number, rb: number, fill: string, line: string, extra = "") {
  const d = unit(sub(b, a));
  const n = { x: -d.y, y: d.x };
  const p1 = add(a, n, ra);
  const p2 = add(b, n, rb);
  const p3 = add(b, n, -rb);
  const p4 = add(a, n, -ra);
  return `<path d="M${f1(p1.x)} ${f1(p1.y)}L${f1(p2.x)} ${f1(p2.y)}A${f1(rb)} ${f1(rb)} 0 0 0 ${f1(p3.x)} ${f1(p3.y)}L${f1(p4.x)} ${f1(p4.y)}A${f1(ra)} ${f1(ra)} 0 0 0 ${f1(p1.x)} ${f1(p1.y)}Z" fill="${fill}" stroke="${line}" stroke-width="1.1" stroke-linejoin="round" ${extra}/>`;
}

function ellipse(c: V, rx: number, ry: number, angleDeg: number, fill: string, line: string, extra = "") {
  return `<ellipse cx="${f1(c.x)}" cy="${f1(c.y)}" rx="${f1(rx)}" ry="${f1(ry)}" transform="rotate(${f1(angleDeg)} ${f1(c.x)} ${f1(c.y)})" fill="${fill}" stroke="${line}" stroke-width="1.1" ${extra}/>`;
}

const deg = (v: V) => (Math.atan2(v.y, v.x) * 180) / Math.PI;

type Draw = { back: string[]; mid: string[]; front: string[]; over: string[] };

/** Paciente con volumen y ropa. Escala k: unidades del cuerpo → píxeles. */
function drawPatient(spec: FigureSpec, sc: Scene, P: (v: V) => V, k: number, out: string[]) {
  const segW: Record<string, [number, number]> = {
    upperarm: [5, 4],
    forearm: [4, 3.1],
    thigh: [7.5, 5.2],
    shank: [5, 3.4],
  };
  const front = spec.view === "front";
  const order = (s: Seg) => (s.side === "far" ? 0 : s.side === "mid" ? 1 : 2);
  const segs = [...sc.pose.segs].sort((x, y) => order(x) - order(y));
  const drawSeg = (s: Seg) => {
    const m = s.name.match(/^(r|l)_(\w+)$/);
    const far = s.side === "far";
    const skin = far ? C.skinFar : C.skin;
    const a = P(s.a);
    const b = P(s.b);
    if (!m) return;
    const part = m[2]!;
    if (part === "hand") {
      const c = lerp(a, b, 0.45);
      out.push(ellipse(c, (L.hand / 2 + 0.5) * k, 2.8 * k, deg(sub(b, a)), skin, C.skinLine));
      return;
    }
    if (part === "foot") {
      // Zapatilla: del talón (algo por detrás del tobillo) a la punta.
      const d = unit(sub(b, a));
      const heel = add(a, d, -3 * k);
      out.push(capsule(heel, b, 3.2 * k, 2.4 * k, C.shoe, C.shoe));
      return;
    }
    const [wa, wb] = segW[part] ?? [4, 3];
    out.push(capsule(a, b, wa * k, wb * k, skin, C.skinLine));
    // Ropa: manga corta y pantalón corto.
    if (part === "upperarm") out.push(capsule(a, lerp(a, b, 0.45), (wa + 0.6) * k, (wa + 0.2) * k, far ? C.shirtFar : C.shirt, C.clothLine));
    if (part === "thigh") out.push(capsule(a, lerp(a, b, 0.5), (wa + 0.6) * k, (wa * 0.8 + 0.6) * k, far ? C.shortsFar : C.shorts, C.clothLine));
  };
  // Lado lejano detrás del tronco.
  for (const s of segs.filter((s) => s.side === "far")) drawSeg(s);
  const pel = P(sc.pose.points.pelvis!);
  const sho = P(sc.pose.points.shoulder!);
  if (front) {
    const across = unit({ x: -(sho.y - pel.y), y: sho.x - pel.x });
    const hw = L.hipHalf + 3.5;
    const sw = L.shoulderHalf + 2;
    const pts = [add(pel, across, -hw * k), add(pel, across, hw * k), add(sho, across, sw * k), add(sho, across, -sw * k)];
    // Piernas antes que el tronco (las caderas quedan bajo el pantalón).
    for (const s of segs.filter((s) => s.side !== "far" && /thigh|shank|foot/.test(s.name))) drawSeg(s);
    const neck = P(sc.pose.points.neck!);
    out.push(capsule(sho, neck, 3.4 * k, 3 * k, C.skin, C.skinLine));
    out.push(`<path d="M${pts.map((p) => `${f1(p.x)} ${f1(p.y)}`).join("L")}Z" fill="${C.shirt}" stroke="${C.clothLine}" stroke-width="1.1" stroke-linejoin="round"/>`);
    const shortsTop = lerp(pel, sho, 0.18);
    const sp = [add(pel, across, -(hw + 0.5) * k), add(pel, across, (hw + 0.5) * k), add(shortsTop, across, (hw + 1) * k), add(shortsTop, across, -(hw + 1) * k)];
    out.push(`<path d="M${sp.map((p) => `${f1(p.x)} ${f1(p.y)}`).join("L")}Z" fill="${C.shorts}" stroke="${C.clothLine}" stroke-width="1.1" stroke-linejoin="round"/>`);
    for (const s of segs.filter((s) => s.side !== "far" && !/thigh|shank|foot/.test(s.name) && s.name !== "trunk" && s.name !== "neck")) drawSeg(s);
  } else {
    // Tronco de perfil: algo más ancho en la pelvis (glúteo) y el pecho.
    out.push(capsule(pel, sho, 10.5 * k, 9.5 * k, C.shirt, C.clothLine));
    out.push(capsule(pel, lerp(pel, sho, 0.22), 11 * k, 10.5 * k, C.shorts, C.clothLine));
    const neck = P(sc.pose.points.neck!);
    out.push(capsule(sho, neck, 3.6 * k, 3.2 * k, C.skin, C.skinLine));
    for (const s of segs.filter((s) => s.side === "near")) drawSeg(s);
  }
  // Cabeza: con pelo, oreja y nariz de perfil; con cara de frente o desde arriba.
  const h = P(sc.pose.head);
  const up = unit(sc.tfv(sc.pose.up));
  const r = L.head * k;
  out.push(`<circle cx="${f1(h.x)}" cy="${f1(h.y)}" r="${f1(r)}" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="1.1"/>`);
  if (front) {
    const across = { x: -up.y, y: up.x };
    const hairC = add(h, up, r * 0.35);
    out.push(ellipse(hairC, r * 1.02, r * 0.72, deg(across), C.hair, C.hair));
    for (const s of [-1, 1]) {
      const e = add(add(h, across, s * r * 0.38), up, -r * 0.1);
      out.push(`<circle cx="${f1(e.x)}" cy="${f1(e.y)}" r="${f1(r * 0.09)}" fill="${C.text}"/>`);
    }
    const mo = add(h, up, -r * 0.5);
    const ma = add(mo, across, -r * 0.22);
    const mb = add(mo, across, r * 0.22);
    out.push(`<path d="M${f1(ma.x)} ${f1(ma.y)}Q${f1(mo.x - up.x * r * 0.12)} ${f1(mo.y - up.y * r * 0.12)} ${f1(mb.x)} ${f1(mb.y)}" stroke="${C.skinLine}" stroke-width="1" fill="none"/>`);
  } else {
    const fwd = unit(sc.tfv(sc.pose.fwd));
    const back = { x: -fwd.x, y: -fwd.y };
    const hc = add(add(h, back, r * 0.3), up, r * 0.3);
    out.push(ellipse(hc, r * 0.95, r * 0.72, deg(fwd), C.hair, C.hair));
    const nose = add(add(h, fwd, r * 1.12), up, -r * 0.08);
    const n1 = add(add(h, fwd, r * 0.9), up, r * 0.15);
    const n2 = add(add(h, fwd, r * 0.85), up, -r * 0.3);
    out.push(`<path d="M${f1(n1.x)} ${f1(n1.y)}L${f1(nose.x)} ${f1(nose.y)}L${f1(n2.x)} ${f1(n2.y)}" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="1"/>`);
    const eye = add(add(h, fwd, r * 0.55), up, r * 0.18);
    out.push(`<circle cx="${f1(eye.x)}" cy="${f1(eye.y)}" r="${f1(r * 0.09)}" fill="${C.text}"/>`);
    out.push(ellipse(add(h, back, r * 0.05), r * 0.2, r * 0.28, deg(fwd), C.skinFar, C.skinLine));
  }
}

function drawExaminerBody(ex: Examiner, k: number, d: Draw) {
  const hand = (arm: { e: V; h: V }) => ellipse(arm.h, 5 * k, 3.4 * k, deg(sub(arm.h, arm.e)), C.skin, C.skinLine);
  if (ex.mode === "top") {
    for (const a of ex.arms) {
      d.mid.push(capsule(a.s, a.e, 4.6 * k, 4 * k, C.scrubs, C.scrubsLine));
      d.over.push(capsule(a.e, a.h, 3.8 * k, 3 * k, C.skin, C.skinLine), hand(a));
    }
    const c = lerp(ex.shoulders[0], ex.shoulders[1], 0.5);
    d.mid.push(ellipse(c, 21 * k, 8 * k, 0, C.scrubs, C.scrubsLine));
    d.mid.push(`<circle cx="${f1(ex.head.x)}" cy="${f1(ex.head.y)}" r="${f1(9.5 * k)}" fill="${C.hair}" stroke="${C.hair}"/>`);
    return;
  }
  if (ex.mode === "behind") {
    const [sl, sr] = ex.shoulders;
    const neckBase = lerp(sl, sr, 0.5);
    const hl = { x: ex.hip.x - 12 * k, y: ex.hip.y };
    const hr = { x: ex.hip.x + 12 * k, y: ex.hip.y };
    d.back.push(`<path d="M${f1(sl.x - 3 * k)} ${f1(sl.y)}L${f1(sr.x + 3 * k)} ${f1(sr.y)}L${f1(hr.x)} ${f1(hr.y)}L${f1(hl.x)} ${f1(hl.y)}Z" fill="${C.scrubs}" stroke="${C.scrubsLine}" stroke-width="1.1" stroke-linejoin="round"/>`);
    // Cuello en V del pijama.
    d.back.push(`<path d="M${f1(neckBase.x - 5 * k)} ${f1(neckBase.y)}L${f1(neckBase.x)} ${f1(neckBase.y + 8 * k)}L${f1(neckBase.x + 5 * k)} ${f1(neckBase.y)}" fill="${C.skin}" stroke="${C.scrubsLine}" stroke-width="1"/>`);
    const h = ex.head;
    d.back.push(capsule(neckBase, add(h, { x: 0, y: 6 * k }), 3.6 * k, 3.4 * k, C.skin, C.skinLine));
    d.back.push(`<circle cx="${f1(h.x)}" cy="${f1(h.y)}" r="${f1(10.5 * k)}" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="1.1"/>`);
    d.back.push(ellipse({ x: h.x, y: h.y - 5 * k }, 10.8 * k, 6.5 * k, 0, C.hair, C.hair));
    for (const s of [-1, 1]) d.back.push(`<circle cx="${f1(h.x + s * 3.6 * k)}" cy="${f1(h.y + 1 * k)}" r="${f1(0.9 * k)}" fill="${C.text}"/>`);
    for (const a of ex.arms) {
      d.back.push(capsule(a.s, a.e, 5 * k, 4.2 * k, C.scrubs, C.scrubsLine));
      d.over.push(capsule(a.e, a.h, 4 * k, 3.1 * k, C.skin, C.skinLine), hand(a));
    }
    return;
  }
  // De perfil: piernas, tronco, cabeza y los dos brazos (el lejano detrás).
  const f = ex.facing;
  for (const [i, leg] of ex.legs.entries()) {
    const fill = i === 0 ? C.scrubsFar : C.scrubs;
    d.mid.push(capsule(ex.hip, leg.k, 7 * k, 5.4 * k, fill, C.scrubsLine), capsule(leg.k, leg.a, 5.4 * k, 4 * k, fill, C.scrubsLine), capsule(leg.a, leg.toe, 3.2 * k, 2.4 * k, C.shoe, C.shoe));
  }
  const far = ex.arms[1]!;
  d.mid.push(capsule(far.s, far.e, 4.6 * k, 4 * k, C.scrubsFar, C.scrubsLine));
  d.over.push(capsule(far.e, far.h, 3.8 * k, 3 * k, C.skinFar, C.skinLine), ellipse(far.h, 5 * k, 3.4 * k, deg(sub(far.h, far.e)), C.skinFar, C.skinLine));
  d.mid.push(capsule(ex.hip, ex.shoulder, 10.5 * k, 9.5 * k, C.scrubs, C.scrubsLine));
  const up = unit(sub(ex.shoulder, ex.hip));
  const perp = { x: -up.y, y: up.x };
  const fwd = Math.sign(perp.x || f) === f ? perp : { x: -perp.x, y: -perp.y };
  const neckTop = add(ex.shoulder, up, 7 * k);
  d.mid.push(capsule(ex.shoulder, neckTop, 3.6 * k, 3.2 * k, C.skin, C.skinLine));
  const h = ex.head;
  const r = 10.5 * k;
  d.mid.push(`<circle cx="${f1(h.x)}" cy="${f1(h.y)}" r="${f1(r)}" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="1.1"/>`);
  d.mid.push(ellipse(add(add(h, fwd, -r * 0.3), up, r * 0.3), r * 0.95, r * 0.72, deg(fwd), C.hair, C.hair));
  const nose = add(h, fwd, r * 1.1);
  const n1 = add(add(h, fwd, r * 0.9), up, r * 0.15);
  const n2 = add(add(h, fwd, r * 0.85), up, -r * 0.3);
  d.mid.push(`<path d="M${f1(n1.x)} ${f1(n1.y)}L${f1(nose.x)} ${f1(nose.y)}L${f1(n2.x)} ${f1(n2.y)}" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="1"/>`);
  const eye = add(add(h, fwd, r * 0.55), up, r * 0.18);
  d.mid.push(`<circle cx="${f1(eye.x)}" cy="${f1(eye.y)}" r="${f1(r * 0.09)}" fill="${C.text}"/>`);
  const near = ex.arms[0]!;
  d.over.push(capsule(near.s, near.e, 4.8 * k, 4.2 * k, C.scrubs, C.scrubsLine), capsule(near.e, near.h, 3.9 * k, 3.1 * k, C.skin, C.skinLine), hand(near));
}

function drawFurniture(fur: Furniture, P: (v: V) => V, k: number, W: number, H: number, out: string[]) {
  const fy = P({ x: 0, y: fur.floor }).y;
  if (fur.tableTop) {
    const a = P({ x: fur.tableTop.x0, y: fur.tableTop.y0 });
    const b = P({ x: fur.tableTop.x1, y: fur.tableTop.y1 });
    out.push(`<rect x="${f1(a.x)}" y="${f1(a.y)}" width="${f1(b.x - a.x)}" height="${f1(b.y - a.y)}" rx="${f1(4 * k)}" fill="${C.pad}" stroke="${C.tableLine}" stroke-width="1.4"/>`);
    return;
  }
  out.push(`<rect x="0" y="${f1(fy)}" width="${W}" height="${f1(Math.max(0, H - fy))}" fill="${C.floor}" opacity="0.35"/>`, `<line x1="0" y1="${f1(fy)}" x2="${W}" y2="${f1(fy)}" stroke="${C.floor}" stroke-width="1.5"/>`);
  if (fur.table) {
    const a = P({ x: fur.table.x0, y: fur.table.y });
    const b = P({ x: fur.table.x1, y: fur.table.y });
    const th = 6 * k;
    out.push(`<rect x="${f1(a.x)}" y="${f1(a.y)}" width="${f1(b.x - a.x)}" height="${f1(th)}" rx="${f1(2 * k)}" fill="${C.pad}" stroke="${C.tableLine}" stroke-width="1.2"/>`);
    // Camilla de consulta: colchoneta y base maciza hasta el suelo.
    const bx0 = a.x + 10 * k;
    const bx1 = b.x - 10 * k;
    out.push(`<rect x="${f1(bx0)}" y="${f1(a.y + th)}" width="${f1(Math.max(0, bx1 - bx0))}" height="${f1(Math.max(0, fy - a.y - th))}" fill="${C.table}" stroke="${C.tableLine}" stroke-width="1"/>`);
    out.push(`<line x1="${f1(bx0 + 4 * k)}" y1="${f1(a.y + th + 10 * k)}" x2="${f1(bx1 - 4 * k)}" y2="${f1(a.y + th + 10 * k)}" stroke="${C.tableLine}" stroke-width="0.8" opacity="0.6"/>`);
    out.push(`<rect x="${f1(a.x)}" y="${f1(a.y)}" width="${f1(b.x - a.x)}" height="${f1(th)}" rx="${f1(2 * k)}" fill="${C.pad}" stroke="${C.tableLine}" stroke-width="1.2"/>`);
  }
  if (fur.chair) {
    const s = P({ x: fur.chair.x, y: fur.chair.seat });
    const dx = fur.chair.back;
    const x0 = s.x + dx * 12 * k;
    const x1 = s.x - dx * 22 * k;
    out.push(`<rect x="${f1(Math.min(x0, x1))}" y="${f1(s.y)}" width="${f1(Math.abs(x1 - x0))}" height="${f1(4 * k)}" rx="${f1(1.5 * k)}" fill="${C.table}" stroke="${C.tableLine}" stroke-width="1.2"/>`);
    out.push(`<rect x="${f1(x0 - 2 * k)}" y="${f1(s.y - 44 * k)}" width="${f1(4 * k)}" height="${f1(44 * k)}" rx="${f1(1.5 * k)}" fill="${C.table}" stroke="${C.tableLine}" stroke-width="1.2"/>`);
    for (const x of [x0, x1]) out.push(`<rect x="${f1(x - 1.5 * k)}" y="${f1(s.y + 4 * k)}" width="${f1(3 * k)}" height="${f1(Math.max(0, fy - s.y - 4 * k))}" fill="${C.table}" stroke="${C.tableLine}" stroke-width="1"/>`);
  }
}

export const W = 240;
export const H = 180;

type Camera = { k: number; ox: number; oy: number };
const cameras = new Map<string, Camera>();

/** Encuadre fijo para toda la animación: abarca paciente, examinador y mobiliario. */
function camera(spec: FigureSpec): Camera {
  const key = JSON.stringify(spec);
  const hit = cameras.get(key);
  if (hit) return hit;
  const a = makeScene(spec, 0, 0);
  const b = makeScene(spec, 1, 1);
  const fur = furniture(spec, a, b);
  const pts: V[] = [];
  for (const s of [a, b]) {
    pts.push(...Object.values(s.pose.points).map(s.tf), s.tf(s.pose.head));
    const targets = (spec.hands ?? []).map((h) => anchorPoint(s.pose, h)).filter((p): p is V => !!p).map(s.tf);
    const ex = placeExaminer(spec, s, fur, targets, 1);
    if (ex) {
      pts.push(ex.head, ...ex.arms.flatMap((x) => [x.s, x.e, x.h]));
      if (ex.mode === "profile") pts.push(ex.hip, ...ex.legs.flatMap((l) => [l.k, l.a, l.toe]));
    }
  }
  if (fur.table) pts.push({ x: fur.table.x0, y: fur.table.y }, { x: fur.table.x1, y: fur.table.y });
  if (fur.tableTop) pts.push({ x: fur.tableTop.x0, y: fur.tableTop.y0 }, { x: fur.tableTop.x1, y: fur.tableTop.y1 });
  if (!fur.tableTop) pts.push({ x: pts[0]!.x, y: fur.floor + 4 });
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = 14;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const k = Math.min(W / (maxX - minX), H / (maxY - minY), 1.6);
  const cam = { k, ox: (W - (maxX - minX) * k) / 2 - minX * k, oy: (H - (maxY - minY) * k) / 2 - minY * k };
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
  const d: Draw = { back: [], mid: [], front: [], over: [] };

  // Mobiliario y examinador (en píxeles).
  const furOut: string[] = [];
  drawFurniture(fur, (v) => toPx(v), 1 * k, W, H, furOut);
  const targets = (spec.hands ?? []).map((h) => anchorPoint(sc.pose, h)).filter((p): p is V => !!p).map(sc.tf);
  const ex = placeExaminer(spec, sc, fur, targets, tl.reach);
  if (ex) {
    const px = (v: V) => toPx(v);
    const exPx: Examiner =
      ex.mode === "profile"
        ? { ...ex, hip: px(ex.hip), shoulder: px(ex.shoulder), head: px(ex.head), legs: ex.legs.map((l) => ({ k: px(l.k), a: px(l.a), toe: px(l.toe) })), arms: ex.arms.map((a) => ({ s: px(a.s), e: px(a.e), h: px(a.h) })) }
        : ex.mode === "behind"
          ? { ...ex, shoulders: [px(ex.shoulders[0]), px(ex.shoulders[1])], head: px(ex.head), hip: px(ex.hip), arms: ex.arms.map((a) => ({ s: px(a.s), e: px(a.e), h: px(a.h) })) }
          : { ...ex, shoulders: [px(ex.shoulders[0]), px(ex.shoulders[1])], head: px(ex.head), arms: ex.arms.map((a) => ({ s: px(a.s), e: px(a.e), h: px(a.h) })) };
    drawExaminerBody(exPx, k, d);
  }

  const patient: string[] = [];
  drawPatient(spec, sc, P, k, patient);

  // Posición inicial en discontinua en la imagen fija.
  const ghost: string[] = [];
  if (still && spec.to) {
    const g = makeScene(spec, 0, 0);
    const moved = g.pose.segs.filter((s) => {
      const o = sc.pose.segs.find((x) => x.name === s.name)!;
      return len(sub(o.a, s.a)) + len(sub(o.b, s.b)) > 0.5;
    });
    for (const s of moved) {
      const a = toPx(g.tf(s.a));
      const b = toPx(g.tf(s.b));
      ghost.push(`<line x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}" stroke="${C.move}" stroke-width="${f1(5 * k)}" stroke-linecap="round" stroke-dasharray="3 3" opacity="0.55"/>`);
    }
  }

  // Síntoma: brillo rojo que late en "qué buscar".
  const painOut: string[] = [];
  if (tl.pain > 0) {
    for (const a of spec.pain ?? []) {
      const p = anchorPoint(sc.pose, a);
      if (!p) continue;
      const q = P(p);
      const r = (8 + 2 * (still ? 0 : tl.pulse)) * k;
      painOut.push(
        `<circle cx="${f1(q.x)}" cy="${f1(q.y)}" r="${f1(r * 1.6)}" fill="url(#pg-${uid})" opacity="${f1(tl.pain)}"/>`,
        `<circle cx="${f1(q.x)}" cy="${f1(q.y)}" r="${f1(r)}" fill="none" stroke="${C.pain}" stroke-width="1.6" opacity="${f1(tl.pain)}"/>`,
      );
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
        const r = 14 * k;
        const sweep = ar.rotate === "cw" ? 1 : 0;
        const a0 = rad(-155);
        const a1 = rad(-25);
        const s0 = { x: q.x + r * Math.cos(sweep ? a0 : a1), y: q.y + r * Math.sin(sweep ? a0 : a1) };
        const e0 = { x: q.x + r * Math.cos(sweep ? a1 : a0), y: q.y + r * Math.sin(sweep ? a1 : a0) };
        arrowsOut.push(`<path d="M${f1(s0.x)} ${f1(s0.y)}A${f1(r)} ${f1(r)} 0 0 ${sweep} ${f1(e0.x)} ${f1(e0.y)}" fill="none" stroke="${C.force}" stroke-width="3" marker-end="url(#ah-${uid})" opacity="${op}"/>`);
        if (ar.label) labels.push(`<text x="${f1(q.x)}" y="${f1(q.y - r - 5)}" text-anchor="middle" opacity="${op}">${esc(ar.label)}</text>`);
        continue;
      }
      const oop = outOfPlane(spec, ar.dir, ar.at);
      if (oop !== 0) {
        const r = 6.5 * k;
        const c = { x: q.x + 12 * k, y: q.y - 12 * k };
        arrowsOut.push(`<circle cx="${f1(c.x)}" cy="${f1(c.y)}" r="${f1(r)}" fill="${C.bg}" stroke="${C.force}" stroke-width="2.2" opacity="${op}"/>`);
        if (oop > 0) arrowsOut.push(`<circle cx="${f1(c.x)}" cy="${f1(c.y)}" r="${f1(r * 0.32)}" fill="${C.force}" opacity="${op}"/>`);
        else {
          const e = r * 0.6;
          arrowsOut.push(`<path d="M${f1(c.x - e)} ${f1(c.y - e)}L${f1(c.x + e)} ${f1(c.y + e)}M${f1(c.x - e)} ${f1(c.y + e)}L${f1(c.x + e)} ${f1(c.y - e)}" stroke="${C.force}" stroke-width="2.2" opacity="${op}"/>`);
        }
        if (ar.label) labels.push(`<text x="${f1(c.x)}" y="${f1(c.y - r - 4)}" text-anchor="middle" opacity="${op}">${esc(ar.label)}</text>`);
        continue;
      }
      const dv = unit(sc.tfv(localDir(spec, ar.dir, ar.at, sc.pose, tl.m)));
      const L0 = (ar.len ?? 22) * k;
      const kind = ar.kind ?? "force";
      const push = still ? 0 : (tl.pulse - 0.5) * 3 * k;
      const from = kind === "force" ? add(q, dv, -(L0 + 7 * k) + push) : add(q, dv, 7 * k);
      const to = kind === "force" ? add(q, dv, -7 * k + push) : add(q, dv, L0 + 7 * k);
      arrowsOut.push(
        kind === "force"
          ? `<line x1="${f1(from.x)}" y1="${f1(from.y)}" x2="${f1(to.x)}" y2="${f1(to.y)}" stroke="${C.force}" stroke-width="3.4" stroke-linecap="round" marker-end="url(#ah-${uid})" opacity="${op}"/>`
          : `<line x1="${f1(from.x)}" y1="${f1(from.y)}" x2="${f1(to.x)}" y2="${f1(to.y)}" stroke="${C.move}" stroke-width="2.4" stroke-dasharray="5 3" marker-end="url(#am-${uid})" opacity="${op}"/>`,
      );
      if (ar.label) {
        const at = kind === "force" ? from : to;
        labels.push(`<text x="${f1(at.x - dv.x * 4)}" y="${f1(at.y - dv.y * 4 + (dv.y > 0.3 ? -3 : 9))}" text-anchor="middle" opacity="${op}">${esc(ar.label)}</text>`);
      }
    }
  }
  const clamp = (l: string) =>
    l.replace(/x="([-\d.]+)" y="([-\d.]+)"/, (_m, x: string, y: string) => {
      const half = (l.replace(/<[^>]+>/g, "").length * 4.6) / 2 + 2;
      return `x="${Math.min(W - half, Math.max(half, Number(x))).toFixed(1)}" y="${Math.min(H - 3, Math.max(10, Number(y))).toFixed(1)}"`;
    });
  const labelOut = labels.map((l) => clamp(l).replace("<text ", `<text font-size="9" font-weight="700" fill="${C.text}" paint-order="stroke" stroke="${C.bg}" stroke-width="3.2" `));

  const defs =
    `<defs>` +
    `<marker id="ah-${uid}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${C.force}"/></marker>` +
    `<marker id="am-${uid}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${C.move}"/></marker>` +
    `<radialGradient id="pg-${uid}"><stop offset="0" stop-color="#ff5a4a" stop-opacity="0.55"/><stop offset="1" stop-color="#ff5a4a" stop-opacity="0"/></radialGradient>` +
    `</defs>`;
  // Orden: fondo y suelo, examinador por detrás, mobiliario, paciente, manos del examinador, señales.
  const lyingBehind = ex?.mode === "behind";
  const body = lyingBehind
    ? [...d.back, ...furOut, ...ghost, ...patient, ...d.mid, ...d.over]
    : [...furOut, ...d.back, ...ghost, ...patient, ...d.mid, ...d.over];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${defs}${body.join("")}${painOut.join("")}${arrowsOut.join("")}${labelOut.join("")}</svg>`;
}

/** Imagen fija de la maniobra (para listas, impresión y quien prefiere menos movimiento). */
export function renderFigure(spec: FigureSpec, title: string, uid = "f"): string {
  return renderFrame(spec, title, uid, 0.6, true);
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
