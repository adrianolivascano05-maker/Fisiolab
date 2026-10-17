// Ilustraciones propias de los tests: una figura humana esquemática generada a partir de una postura,
// unos ángulos articulares, las manos del examinador, flechas de fuerza o movimiento y la zona de dolor.
// Puro (sin React ni imports): devuelve el SVG como texto. Así todas las imágenes son coherentes, ocupan
// poco y no tienen derechos de terceros.

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

/** Punto de anclaje: una articulación ("r_knee", "pelvis", "head", "neck") o un punto a lo largo de un
 *  segmento ("r_shank@0.8": al 80 % de la pierna desde la rodilla). Segmentos: trunk, neck, r_upperarm,
 *  r_forearm, r_hand, r_thigh, r_shank, r_foot (y los l_). */
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
  /** Posición final del movimiento, dibujada en discontinua (solo lo que cambia). */
  to?: Partial<Record<JointKey, number>>;
  /** Manos del examinador. */
  hands?: Anchor[];
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
const lerp = (a: V, b: V, t: number): V => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

const L = { trunk: 52, neck: 7, head: 9, upperarm: 28, forearm: 25, hand: 8, thigh: 40, shank: 38, foot: 13, shoulderHalf: 15, hipHalf: 8 };

/** Ángulos de partida de cada postura y cómo se coloca el cuerpo en el dibujo. */
const postures: Record<Posture, { joints: Partial<Record<JointKey, number>>; rot: number; mirror?: boolean; surface: "floor" | "table" | "chair" | "none" }> = {
  standing: { joints: {}, rot: 0, surface: "floor" },
  sitting: { joints: { r_hip: 90, l_hip: 90, r_knee: 90, l_knee: 90 }, rot: 0, surface: "chair" },
  longsitting: { joints: { r_hip: 90, l_hip: 90 }, rot: 0, surface: "table" },
  supine: { joints: {}, rot: -90, surface: "table" },
  hooklying: { joints: { r_hip: 45, l_hip: 45, r_knee: 90, l_knee: 90 }, rot: -90, surface: "table" },
  prone: { joints: {}, rot: 90, mirror: true, surface: "table" },
  sidelying: { joints: {}, rot: -90, surface: "table" },
  quadruped: { joints: { trunk: 90, r_shoulder: 90, l_shoulder: 90, r_hip: 90, l_hip: 90, r_knee: 90, l_knee: 90 }, rot: 0, surface: "floor" },
};

type Segment = { name: string; a: V; b: V; side: "near" | "far" | "mid"; width: number };
type Pose = { points: Record<string, V>; segments: Segment[]; head: V };

/** Ángulos finales: los de la postura con los del test encima. */
function anglesOf(spec: FigureSpec, extra?: Partial<Record<JointKey, number>>) {
  const base = postures[spec.posture].joints;
  return (k: JointKey) => extra?.[k] ?? spec.joints?.[k] ?? base[k] ?? 0;
}

function sidePose(spec: FigureSpec, extra?: Partial<Record<JointKey, number>>): Pose {
  const a = anglesOf(spec, extra);
  const near = spec.near ?? "r";
  const far = near === "r" ? "l" : "r";
  const points: Record<string, V> = {};
  const segments: Segment[] = [];
  const pelvis = { x: 0, y: 0 };
  points.pelvis = pelvis;
  const phiTrunk = 180 - a("trunk");
  const shoulder = add(pelvis, dir(phiTrunk), L.trunk);
  points.shoulder = shoulder;
  segments.push({ name: "trunk", a: pelvis, b: shoulder, side: "mid", width: 13 });
  const phiNeck = phiTrunk - a("neck");
  const neckTop = add(shoulder, dir(phiNeck), L.neck);
  points.neck = neckTop;
  segments.push({ name: "neck", a: shoulder, b: neckTop, side: "mid", width: 6 });
  const head = add(neckTop, dir(phiNeck), L.head);
  points.head = head;

  for (const s of [far, near] as const) {
    const side = s === near ? "near" : "far";
    const w = side === "near" ? 1 : 0.85;
    const sh = shoulder;
    points[`${s}_shoulder`] = sh;
    const phiUa = phiTrunk - 180 + a(`${s}_shoulder`);
    const el = add(sh, dir(phiUa), L.upperarm);
    const phiFa = phiUa + a(`${s}_elbow`);
    const wr = add(el, dir(phiFa), L.forearm);
    const hd = add(wr, dir(phiFa + a(`${s}_wrist`)), L.hand);
    Object.assign(points, { [`${s}_elbow`]: el, [`${s}_wrist`]: wr, [`${s}_handtip`]: hd });
    const hip = pelvis;
    points[`${s}_hip`] = hip;
    const phiTh = phiTrunk - 180 + a(`${s}_hip`);
    const kn = add(hip, dir(phiTh), L.thigh);
    const phiSh = phiTh - a(`${s}_knee`);
    const an = add(kn, dir(phiSh), L.shank);
    const ft = add(an, dir(phiSh + 90 + a(`${s}_ankle`)), L.foot);
    Object.assign(points, { [`${s}_knee`]: kn, [`${s}_ankle`]: an, [`${s}_foottip`]: ft });
    segments.push(
      { name: `${s}_thigh`, a: hip, b: kn, side, width: 10 * w },
      { name: `${s}_shank`, a: kn, b: an, side, width: 8 * w },
      { name: `${s}_foot`, a: an, b: ft, side, width: 6 * w },
      { name: `${s}_upperarm`, a: sh, b: el, side, width: 7.5 * w },
      { name: `${s}_forearm`, a: el, b: wr, side, width: 6.5 * w },
      { name: `${s}_hand`, a: wr, b: hd, side, width: 5.5 * w },
    );
  }
  // El brazo lejano va detrás del tronco y el cercano delante: se ordena al dibujar.
  return { points, segments, head };
}

function frontPose(spec: FigureSpec, extra?: Partial<Record<JointKey, number>>): Pose {
  const a = anglesOf(spec, extra);
  const points: Record<string, V> = {};
  const segments: Segment[] = [];
  const pelvis = { x: 0, y: 0 };
  points.pelvis = pelvis;
  // +x es la izquierda del paciente (lo vemos de frente); inclinación a la derecha = hacia −x.
  const phiTrunk = 180 + a("trunk");
  const top = add(pelvis, dir(phiTrunk), L.trunk);
  const across = dir(phiTrunk - 90); // hacia la izquierda del paciente
  const neckTop = add(top, dir(phiTrunk + a("neck")), L.neck);
  const head = add(neckTop, dir(phiTrunk + a("neck")), L.head);
  Object.assign(points, { shoulder: top, neck: neckTop, head });
  segments.push({ name: "trunk", a: pelvis, b: top, side: "mid", width: 17 }, { name: "neck", a: top, b: neckTop, side: "mid", width: 7 });
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
    const ft = add(an, dir(phiSh + sign * 70), L.foot * 0.6);
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
    segments.push(
      { name: `${s}_thigh`, a: hip, b: kn, side: "near", width: 10 },
      { name: `${s}_shank`, a: kn, b: an, side: "near", width: 8 },
      { name: `${s}_foot`, a: an, b: ft, side: "near", width: 6 },
      { name: `${s}_upperarm`, a: sh, b: el, side: "near", width: 7.5 },
      { name: `${s}_forearm`, a: el, b: wr, side: "near", width: 6.5 },
      { name: `${s}_hand`, a: wr, b: hd, side: "near", width: 5.5 },
    );
  }
  return { points, segments, head };
}

const segEnds: Record<string, [string, string]> = {
  trunk: ["pelvis", "shoulder"],
  neck: ["shoulder", "neck"],
  upperarm: ["shoulder", "elbow"],
  forearm: ["elbow", "wrist"],
  hand: ["wrist", "handtip"],
  thigh: ["hip", "knee"],
  shank: ["knee", "ankle"],
  foot: ["ankle", "foottip"],
};

/** Coordenadas de un anclaje en la pose (sin transformar). */
export function anchorPoint(p: Pose, anchor: Anchor): V | null {
  const [name, t] = anchor.split("@");
  if (!name) return null;
  if (t !== undefined) {
    const k = Number(t);
    if (name === "trunk") return lerp(p.points.pelvis!, p.points.shoulder!, k);
    if (name === "neck") return lerp(p.points.shoulder!, p.points.neck!, k);
    const m = name.match(/^(r|l)_(upperarm|forearm|hand|thigh|shank|foot)$/);
    if (!m) return null;
    const [from, to] = segEnds[m[2]!]!;
    const a = p.points[`${m[1]}_${from}`];
    const b = p.points[`${m[1]}_${to}`];
    return a && b ? lerp(a, b, k) : null;
  }
  if (name === "head") return p.head;
  if (name === "lumbar") return lerp(p.points.pelvis!, p.points.shoulder!, 0.15);
  if (name === "thoracic") return lerp(p.points.pelvis!, p.points.shoulder!, 0.65);
  if (name === "r_hand" || name === "l_hand") return p.points[`${name.slice(0, 2)}handtip`] ?? null;
  if (name === "r_foot" || name === "l_foot") return lerp(p.points[`${name.slice(0, 2)}ankle`]!, p.points[`${name.slice(0, 2)}foottip`]!, 0.5);
  return p.points[name] ?? null;
}

/** Fuerza perpendicular al dibujo: +1 hacia quien mira (⊙), −1 alejándose (⊗), 0 en el plano. */
function outOfPlane(spec: FigureSpec, d: Direction, anchor: Anchor): number {
  if (spec.view === "front") return d === "anterior" ? 1 : d === "posterior" ? -1 : 0;
  if (d !== "medial" && d !== "lateral") return 0;
  // Vista lateral: vemos el lado cercano; su cara lateral mira hacia nosotros.
  const near = spec.near ?? "r";
  const isNear = !anchor.startsWith(near === "r" ? "l_" : "r_");
  return (d === "lateral") === isNear ? 1 : -1;
}

/** Dirección local (antes de girar el cuerpo) de una dirección anatómica. */
function localDir(spec: FigureSpec, d: Direction, anchor: Anchor, p: Pose): V {
  const trunkPhi = spec.view === "side" ? 180 - anglesOf(spec)("trunk") : 180 + anglesOf(spec)("trunk");
  const up = dir(trunkPhi);
  const fwd = spec.view === "side" ? dir(trunkPhi - 90) : { x: 0, y: 0 };
  if (d === "cranial") return up;
  if (d === "caudal") return { x: -up.x, y: -up.y };
  if (d === "anterior") return fwd;
  if (d === "posterior") return { x: -fwd.x, y: -fwd.y };
  // Medial/lateral: hacia o desde la línea media según el lado del punto.
  const right = anchor.startsWith("r_");
  const pt = anchorPoint(p, anchor) ?? { x: 0, y: 0 };
  const towardLeft = dir(trunkPhi - 90);
  const sign = right ? 1 : anchor.startsWith("l_") ? -1 : pt.x < 0 ? 1 : -1;
  return d === "medial" ? { x: towardLeft.x * sign, y: towardLeft.y * sign } : { x: -towardLeft.x * sign, y: -towardLeft.y * sign };
}

const W = 200;
const H = 150;

/** SVG de la figura. Los colores son variables CSS (--fig-*) con valores por defecto. */
export function renderFigure(spec: FigureSpec, title: string, uid = "f"): string {
  const build = spec.view === "side" ? sidePose : frontPose;
  const pose = build(spec);
  const ghost = spec.to ? build(spec, spec.to) : null;
  const pst = postures[spec.posture];
  const rot = rad(pst.rot);
  const tf = (v: V): V => {
    const r = { x: v.x * Math.cos(rot) - v.y * Math.sin(rot), y: v.x * Math.sin(rot) + v.y * Math.cos(rot) };
    return pst.mirror ? { x: -r.x, y: r.y } : r;
  };
  const tfDir = (v: V): V => tf(v);

  // Encaje: todos los puntos (y la pose final) dentro del dibujo con margen.
  const all = [...Object.values(pose.points), ...(ghost ? Object.values(ghost.points) : [])].map(tf);
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const pad = 22;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const k = Math.min(W / (maxX - minX), H / (maxY - minY), spec.view === "front" ? 1.05 : 1.3);
  const ox = (W - (maxX - minX) * k) / 2 - minX * k;
  const oy = (H - (maxY - minY) * k) / 2 - minY * k;
  const P = (v: V): V => {
    const t = tf(v);
    return { x: +(t.x * k + ox).toFixed(1), y: +(t.y * k + oy).toFixed(1) };
  };
  const out: string[] = [];
  const line = (a: V, b: V, attrs: string) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${attrs}/>`;

  // Superficie: suelo, camilla o silla, bajo el punto más bajo del cuerpo.
  const lowest = Math.max(...Object.values(pose.points).map((p) => P(p).y));
  if (pst.surface === "floor" || pst.surface === "table") {
    const y = +(lowest + (pst.surface === "table" ? 6 * k : 3 * k)).toFixed(1);
    out.push(line({ x: 8, y }, { x: W - 8, y }, `stroke="var(--fig-surface, #c3cad2)" stroke-width="${pst.surface === "table" ? 5 : 2}" stroke-linecap="round"`));
    if (pst.surface === "table") out.push(line({ x: 22, y }, { x: 22, y: H - 4 }, `stroke="var(--fig-surface, #c3cad2)" stroke-width="3"`), line({ x: W - 22, y }, { x: W - 22, y: H - 4 }, `stroke="var(--fig-surface, #c3cad2)" stroke-width="3"`));
  } else if (pst.surface === "chair") {
    const seat = P(pose.points.pelvis!);
    const y = +(seat.y + 7 * k).toFixed(1);
    out.push(line({ x: seat.x - 18 * k, y }, { x: seat.x + 22 * k, y }, `stroke="var(--fig-surface, #c3cad2)" stroke-width="4" stroke-linecap="round"`));
    out.push(line({ x: seat.x + 18 * k, y }, { x: seat.x + 18 * k, y: lowest + 3 * k }, `stroke="var(--fig-surface, #c3cad2)" stroke-width="3"`));
  }

  const drawPose = (p: Pose, ghostMode: boolean) => {
    const order = (s: Segment) => (s.side === "far" ? 0 : s.side === "mid" ? 1 : 2);
    for (const s of [...p.segments].sort((x, y) => order(x) - order(y))) {
      const a = P(s.a);
      const b = P(s.b);
      if (ghostMode) {
        out.push(line(a, b, `stroke="var(--fig-ghost, #7d8a97)" stroke-width="${(s.width * k * 0.5).toFixed(1)}" stroke-linecap="round" stroke-dasharray="3 3" fill="none" opacity="0.8"`));
      } else {
        const color = s.side === "far" ? "var(--fig-far, #b5bfc9)" : "var(--fig-body, #55626f)";
        out.push(line(a, b, `stroke="${color}" stroke-width="${(s.width * k).toFixed(1)}" stroke-linecap="round"`));
      }
    }
    const h = P(p.head);
    out.push(
      ghostMode
        ? `<circle cx="${h.x}" cy="${h.y}" r="${(L.head * k).toFixed(1)}" fill="none" stroke="var(--fig-ghost, #7d8a97)" stroke-dasharray="3 3"/>`
        : `<circle cx="${h.x}" cy="${h.y}" r="${(L.head * k).toFixed(1)}" fill="var(--fig-body, #55626f)"/>`,
    );
  };

  // Pose final: solo los segmentos que se mueven.
  if (ghost) {
    const moved: Pose = {
      ...ghost,
      segments: ghost.segments.filter((s) => {
        const o = pose.segments.find((x) => x.name === s.name)!;
        return Math.hypot(o.a.x - s.a.x, o.a.y - s.a.y) + Math.hypot(o.b.x - s.b.x, o.b.y - s.b.y) > 0.5;
      }),
      head: ghost.head,
    };
    const headMoved = Math.hypot(ghost.head.x - pose.head.x, ghost.head.y - pose.head.y) > 0.5;
    const tmp: string[] = [];
    const save = out.length;
    drawPose(moved, true);
    if (!headMoved) out.splice(out.length - 1, 1);
    tmp.push(...out.splice(save));
    out.push(...tmp);
  }
  drawPose(pose, false);

  // Dolor o síntoma.
  for (const a of spec.pain ?? []) {
    const p = anchorPoint(pose, a);
    if (!p) continue;
    const q = P(p);
    out.push(`<circle cx="${q.x}" cy="${q.y}" r="${(9 * k).toFixed(1)}" fill="var(--fig-pain, #d64545)" fill-opacity="0.28" stroke="var(--fig-pain, #d64545)" stroke-width="1.5"/>`);
  }
  // Manos del examinador.
  for (const a of spec.hands ?? []) {
    const p = anchorPoint(pose, a);
    if (!p) continue;
    const q = P(p);
    out.push(`<ellipse cx="${q.x}" cy="${q.y}" rx="${(7 * k).toFixed(1)}" ry="${(4.5 * k).toFixed(1)}" fill="var(--fig-hand, #e3a873)" stroke="var(--fig-hand-edge, #8a5a2b)" stroke-width="1.2"/>`);
  }
  // Flechas.
  const labels: string[] = [];
  for (const ar of spec.arrows ?? []) {
    const p = anchorPoint(pose, ar.at);
    if (!p) continue;
    const q = P(p);
    if ("rotate" in ar) {
      const r = 13 * k;
      const sweep = ar.rotate === "cw" ? 1 : 0;
      const a0 = rad(-150);
      const a1 = rad(-30);
      const s = { x: +(q.x + r * Math.cos(sweep ? a0 : a1)).toFixed(1), y: +(q.y + r * Math.sin(sweep ? a0 : a1)).toFixed(1) };
      const e = { x: +(q.x + r * Math.cos(sweep ? a1 : a0)).toFixed(1), y: +(q.y + r * Math.sin(sweep ? a1 : a0)).toFixed(1) };
      out.push(`<path d="M${s.x} ${s.y} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${e.x} ${e.y}" fill="none" stroke="var(--fig-force, #0e6672)" stroke-width="2.4" marker-end="url(#ah-${uid})"/>`);
      if (ar.label) labels.push(`<text x="${q.x}" y="${(q.y - r - 4).toFixed(1)}" text-anchor="middle">${esc(ar.label)}</text>`);
      continue;
    }
    const oop = outOfPlane(spec, ar.dir, ar.at);
    if (oop !== 0) {
      // ⊙ sale hacia quien mira; ⊗ entra (p. ej. empujar hacia la camilla en una vista desde arriba).
      const r = 6 * k;
      const c = { x: q.x + 11 * k, y: q.y - 11 * k };
      out.push(`<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r.toFixed(1)}" fill="var(--fig-bg, #fff)" stroke="var(--fig-force, #0e6672)" stroke-width="2"/>`);
      if (oop > 0) out.push(`<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${(r * 0.3).toFixed(1)}" fill="var(--fig-force, #0e6672)"/>`);
      else {
        const e = r * 0.6;
        out.push(line({ x: +(c.x - e).toFixed(1), y: +(c.y - e).toFixed(1) }, { x: +(c.x + e).toFixed(1), y: +(c.y + e).toFixed(1) }, `stroke="var(--fig-force, #0e6672)" stroke-width="2"`));
        out.push(line({ x: +(c.x - e).toFixed(1), y: +(c.y + e).toFixed(1) }, { x: +(c.x + e).toFixed(1), y: +(c.y - e).toFixed(1) }, `stroke="var(--fig-force, #0e6672)" stroke-width="2"`));
      }
      if (ar.label) labels.push(`<text x="${c.x.toFixed(1)}" y="${(c.y - r - 3).toFixed(1)}" text-anchor="middle">${esc(ar.label)}</text>`);
      continue;
    }
    const d = tfDir(localDir(spec, ar.dir, ar.at, pose));
    const len = (ar.len ?? 22) * k;
    const kind = ar.kind ?? "force";
    // La fuerza empuja hacia el punto; el movimiento sale de él.
    const from = kind === "force" ? { x: q.x - d.x * (len + 6 * k), y: q.y - d.y * (len + 6 * k) } : { x: q.x + d.x * 6 * k, y: q.y + d.y * 6 * k };
    const to = kind === "force" ? { x: q.x - d.x * 6 * k, y: q.y - d.y * 6 * k } : { x: q.x + d.x * (len + 6 * k), y: q.y + d.y * (len + 6 * k) };
    const f = { x: +from.x.toFixed(1), y: +from.y.toFixed(1) };
    const t = { x: +to.x.toFixed(1), y: +to.y.toFixed(1) };
    out.push(
      line(f, t, kind === "force" ? `stroke="var(--fig-force, #0e6672)" stroke-width="2.6" marker-end="url(#ah-${uid})"` : `stroke="var(--fig-move, #7d8a97)" stroke-width="2" stroke-dasharray="4 3" marker-end="url(#am-${uid})"`),
    );
    if (ar.label) {
      const lx = kind === "force" ? f.x : t.x;
      const ly = kind === "force" ? f.y : t.y;
      labels.push(`<text x="${lx.toFixed(1)}" y="${(ly + (d.y > 0.3 ? -4 : 10)).toFixed(1)}" text-anchor="middle">${esc(ar.label)}</text>`);
    }
  }
  // Etiquetas dentro del dibujo: se empujan desde los bordes para que no se corten.
  const clamp = (l: string) =>
    l.replace(/x="([-\d.]+)" y="([-\d.]+)"/, (_m, x: string, y: string) => {
      const half = (l.replace(/<[^>]+>/g, "").length * 4.4) / 2 + 2;
      return `x="${Math.min(W - half, Math.max(half, Number(x))).toFixed(1)}" y="${Math.min(H - 3, Math.max(9, Number(y))).toFixed(1)}"`;
    });
  out.push(...labels.map((l) => clamp(l).replace("<text ", '<text font-size="8" font-weight="600" fill="var(--fig-text, #1f2933)" paint-order="stroke" stroke="var(--fig-bg, #fff)" stroke-width="3" ')));

  const defs = `<defs><marker id="ah-${uid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--fig-force, #0e6672)"/></marker><marker id="am-${uid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--fig-move, #7d8a97)"/></marker></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${defs}${out.join("")}</svg>`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
