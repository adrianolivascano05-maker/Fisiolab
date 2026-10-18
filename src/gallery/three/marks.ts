// Marcas de las figuras con guion: la flecha de recorrido de cada paso (el camino real que sigue un punto del
// segmento que se mueve, calculado con el propio esqueleto: su sentido no puede contradecir al movimiento ni
// cambiar al girar la cámara), «el examinador empuja» (azul) y «el paciente empuja y el examinador no le deja»
// (naranja, con tope; isométrico). Todas con un contorno claro para verse sobre cualquier fondo.
import { BackSide, BoxGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, TubeGeometry, Vector3, type BufferGeometry } from "three";
import type { BodyKey, FigureSpec, Joint3D, Mark } from "../figure";
import { changes, stepLabel } from "../describe";
import type { Key } from "../script";
import { keysOf } from "./anatomy";
import { patientPose, type Layout } from "./layout";
import { anatDir, anchorInfo, sgn, spineAt, surfaceRadius, type BodyAngles, type Pose3, type Side } from "./rig";

export const MARK_COLORS = { push: "#1f5fe0", resist: "#e07400", path: "#262d38", outline: "#ffffff" };

type Dof = keyof Joint3D;
export type BuiltMark = {
  kind: "path" | "push" | "resist";
  group: Group;
  mats: MeshStandardMaterial[];
  label: string;
  /** Dónde va la etiqueta (fija para las de recorrido; se recoloca en cada instante para las demás). */
  labelAt: Vector3;
  /** Para comprobar el sentido: puntos del recorrido dibujado y la articulación, el grado de libertad y el signo que representa. */
  path?: { pts: Vector3[]; joint: BodyKey; dof: Dof; sign: number; virtual: boolean };
  /** Puntos de la flecha que las etiquetas no deben tapar (la punta y la mitad). */
  keep?: Vector3[];
  /** Marcas sujetas al cuerpo: se recolocan en cada instante. */
  update?: (pat: Pose3, contactsAt: Vector3[], toCam: Vector3, pulse: number) => void;
  /** Dirección de la flecha recta (para que la cámara no la mire de punta). */
  dir?: (pat: Pose3) => Vector3;
};

const mat = (color: string, side?: typeof BackSide) => new MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: side ? 0.6 : 0.18, transparent: true, ...(side ? { side } : {}) });

/** Puntos de referencia del segmento que mueve una articulación (se usa el que más se desplaza). */
function landmarks(joint: BodyKey): ((p: Pose3) => Vector3)[] {
  const m = joint.match(/^(r|l)_(\w+)$/);
  if (!m) {
    if (joint === "neck") return [(p) => new Vector3(0, -0.5, 11).applyQuaternion(p.head.q).add(p.head.p)];
    if (joint === "jaw") return [(p) => anchorInfo(p, "jaw")!.p];
    // Tronco y pelvis: los hombros, el esternón y la parte de delante de la pelvis.
    return [(p) => p.pt.r_shoulder!.clone(), (p) => p.pt.l_shoulder!.clone(), (p) => new Vector3(0, 0, 11).applyQuaternion(p.trunkQ).add(spineAt(p, 40).p), (p) => new Vector3(0, 4, 13).applyQuaternion(p.pelvisQ).add(p.root.p)];
  }
  const s = m[1] as Side;
  const pt = (k: string) => (p: Pose3) => p.pt[`${s}_${k}`]!.clone();
  // Borde del pulgar de la mano y quinto metatarsiano del pie (giran mucho en la pronosupinación y la inversión).
  const radial = (p: Pose3) => new Vector3(sgn(s) * 4.2, -6.5, 0.5).applyQuaternion(p.seg[`${s}_hand`].q).add(p.seg[`${s}_hand`].p);
  const fifth = (p: Pose3) => new Vector3(-sgn(s) * 4.4, -4.5, 14).applyQuaternion(p.seg[`${s}_foot`].q).add(p.seg[`${s}_foot`].p);
  switch (m[2]) {
    case "shoulder":
      return [pt("elbow"), pt("wrist"), pt("handtip")];
    case "elbow":
      return [pt("wrist"), pt("handtip"), radial];
    case "wrist":
      return [pt("handtip"), radial];
    case "hip":
      return [pt("knee"), pt("ankle"), pt("foottip")];
    case "knee":
      return [pt("ankle"), pt("foottip"), pt("heel")];
    default:
      return [pt("foottip"), fifth, pt("heel")];
  }
}

/** Centro de giro de una articulación (para separar la flecha del cuerpo hacia fuera). */
function center(p: Pose3, joint: BodyKey): Vector3 {
  const m = joint.match(/^(r|l)_(\w+)$/);
  if (m) return p.pt[joint]!.clone();
  if (joint === "neck" || joint === "jaw") return p.neck.p.clone();
  return p.root.p.clone();
}

const len = (pts: Vector3[]) => pts.reduce((a, q, i) => a + (i ? q.distanceTo(pts[i - 1]!) : 0), 0);

/** Sitio para la etiqueta de una flecha curva: junto a su arranque, hacia fuera (la punta queda libre). */
function beside(pts: Vector3[], c: Vector3): Vector3 {
  const a = pts[0]!;
  const out = a.clone().sub(c);
  // Y algo hacia atrás, en sentido contrario a la flecha.
  const back = a.clone().sub(pts[Math.min(pts.length - 1, 3)]!);
  const p = a.clone();
  if (out.lengthSq() > 1e-6) p.addScaledVector(out.normalize(), 5);
  if (back.lengthSq() > 1e-6) p.addScaledVector(back.normalize(), 4);
  return p;
}

/** Recorrido de un punto entre dos progresos de la maniobra (o con la articulación girada a mano). */
function track(joint: BodyKey, lm: (p: Pose3) => Vector3, poses: Pose3[]): Vector3[] {
  return poses.map((p) => {
    const q = lm(p);
    // La cabeza: el recorrido de la nariz, llevado por encima de la cabeza (ahí no lo tapa nada).
    if (joint === "neck") return q.addScaledVector(new Vector3(0, 1, 0).applyQuaternion(p.trunkQ), 15);
    // El cuerpo entero que gira de pie sobre un pie: el recorrido de la pelvis, en el suelo (gira sobre ese pie).
    if (joint === "pelvis" && p.root.q.equals(new Quaternion())) return q.setY(1.5);
    const c = center(p, joint);
    const out = q.clone().sub(c);
    // Algo separada del cuerpo para que no se meta en él.
    return out.lengthSq() > 1e-6 ? q.addScaledVector(out.normalize(), 3.2) : q;
  });
}

/** Flecha curva por unos puntos: tubo, punta y contorno. */
function curved(pts: Vector3[], color: string, radius: number, stop = false): { group: Group; mats: MeshStandardMaterial[]; geos: BufferGeometry[] } {
  const group = new Group();
  const m = mat(color);
  const o = mat(MARK_COLORS.outline, BackSide);
  const head = 6;
  // El tubo acaba donde empieza la punta.
  let acc = 0;
  const total = len(pts);
  const body: Vector3[] = [pts[0]!.clone()];
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i]!.distanceTo(pts[i - 1]!);
    if (acc + d > total - head) {
      body.push(pts[i - 1]!.clone().lerp(pts[i]!, Math.max(0, (total - head - acc) / d)));
      break;
    }
    acc += d;
    body.push(pts[i]!.clone());
  }
  const tip = pts[pts.length - 1]!;
  const base = body[body.length - 1]!;
  const dir = tip.clone().sub(base).normalize();
  const geos: BufferGeometry[] = [];
  if (body.length >= 2 && len(body) > 0.5) {
    const curve = new CatmullRomCurve3(body);
    const g = new TubeGeometry(curve, Math.max(8, body.length * 3), radius, 10, false);
    const go = new TubeGeometry(curve, Math.max(8, body.length * 3), radius + 0.75, 10, false);
    group.add(new Mesh(g, m), new Mesh(go, o));
    geos.push(g, go);
  }
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
  const cone = new ConeGeometry(radius * 2.8, head, 18);
  const coneO = new ConeGeometry(radius * 2.8 + 0.8, head + 1.4, 18);
  const c = new Mesh(cone, m);
  const co = new Mesh(coneO, o);
  for (const x of [c, co]) {
    x.quaternion.copy(q);
    x.position.copy(base).addScaledVector(dir, head / 2);
  }
  group.add(c, co);
  geos.push(cone, coneO);
  if (stop) {
    // Tope: el movimiento no llega a hacerse.
    const bar = new BoxGeometry(radius * 7, radius * 1.4, radius * 7);
    const barO = new BoxGeometry(radius * 7 + 1, radius * 1.4 + 1, radius * 7 + 1);
    const b = new Mesh(bar, m);
    const bo = new Mesh(barO, o);
    for (const x of [b, bo]) {
      x.quaternion.copy(q);
      x.position.copy(tip).addScaledVector(dir, 1.2);
    }
    group.add(b, bo);
    geos.push(bar, barO);
  }
  return { group, mats: [m, o], geos };
}

/** Flecha recta (empuja o resiste) que se recoloca en cada instante. */
function straight(color: string, stop: boolean): { group: Group; mats: MeshStandardMaterial[]; geos: BufferGeometry[]; set: (tail: Vector3, tip: Vector3) => void } {
  const group = new Group();
  const m = mat(color);
  const o = mat(MARK_COLORS.outline, BackSide);
  const shaft = new CylinderGeometry(0.85, 0.85, 1, 12);
  const shaftO = new CylinderGeometry(1.4, 1.4, 1, 12);
  const head = new ConeGeometry(2.6, 6, 18);
  const headO = new ConeGeometry(3.2, 7.2, 18);
  const bar = new BoxGeometry(7, 1.2, 7);
  const barO = new BoxGeometry(8, 2.2, 8);
  const parts = [new Mesh(shaft, m), new Mesh(shaftO, o), new Mesh(head, m), new Mesh(headO, o), ...(stop ? [new Mesh(bar, m), new Mesh(barO, o)] : [])];
  group.add(...parts);
  const set = (tail: Vector3, tip: Vector3) => {
    const d = tip.clone().sub(tail);
    const L = d.length();
    d.normalize();
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d);
    const shaftEnd = tip.clone().addScaledVector(d, -6);
    const sl = Math.max(0.5, tail.distanceTo(shaftEnd));
    for (const p of parts) p.quaternion.copy(q);
    for (const p of parts.slice(0, 2)) {
      p.scale.set(1, sl, 1);
      p.position.copy(tail).lerp(shaftEnd, 0.5);
    }
    for (const p of parts.slice(2, 4)) p.position.copy(tip).addScaledVector(d, -3);
    for (const p of parts.slice(4)) p.position.copy(tip).addScaledVector(d, 0.6);
    void L;
  };
  return { group, mats: [m, o], geos: [shaft, shaftO, head, headO, bar, barO], set };
}

/** Cambia un grado de libertad en los ángulos del esqueleto (para el recorrido que se intenta en un isométrico). */
function bump(A: BodyAngles, joint: BodyKey, dof: Dof, d: number) {
  const m = joint.match(/^(r|l)_(\w+)$/);
  if (!m) {
    if (joint === "neck") {
      if (dof === "rot") A.neckYaw -= d;
      else if (dof === "lat") A.neckLat += d;
      else A.neckFlex += d;
    } else if (joint === "trunk") {
      if (dof === "rot") A.trunkRot = (A.trunkRot ?? 0) + d;
      else if (dof === "lat") A.trunkLat += d;
      else A.trunkFlex += d;
    } else if (joint === "pelvis" && A.pelvis) {
      const k = dof === "rot" ? "rot" : dof === "lat" ? "lat" : "flex";
      A.pelvis[k] += d;
    }
    return;
  }
  const s = m[1] as Side;
  const j = m[2] as keyof BodyAngles["r"];
  if (dof === "pron") A[s].wrist.twist = (A[s].wrist.twist ?? 0) - sgn(s) * d;
  else if (dof === "inv") A[s].ankle.inv = (A[s].ankle.inv ?? 0) + d;
  else if (dof === "rot") A[s][j].rot = (A[s][j].rot ?? 0) + d;
  else if (dof === "flex" || dof === "abd") A[s][j][dof] += d;
}

/** Recorrido que hace (o haría, si se le dejara) un punto al mover una articulación: el más largo de sus puntos de referencia. */
function bestTrack(joint: BodyKey, poses: Pose3[]): Vector3[] {
  let best: Vector3[] = [];
  for (const lm of landmarks(joint)) {
    const t = track(joint, lm, poses);
    if (len(t) > len(best)) best = t;
  }
  return best;
}

/** Signo del cambio principal de una articulación en un paso (para comprobar el sentido de la flecha). */
function mainChange(keys: Key[], i: number, joint: BodyKey): { dof: Dof; sign: number } | null {
  const ch = changes(keys[i]!.pose, keys[i + 1]!.pose).filter((c) => c.joint === joint);
  return ch[0] ? { dof: ch[0].dof, sign: Math.sign(ch[0].to - ch[0].from) } : null;
}

/** Las marcas de cada paso de una figura con guion (y las de toda la maniobra, en el índice −1). */
export function buildMarks(spec: FigureSpec, L: Layout): { steps: BuiltMark[][]; always: BuiltMark[]; geos: BufferGeometry[] } {
  const script = spec.script!;
  const keys = keysOf(spec);
  const S = keys.length - 1;
  const geos: BufferGeometry[] = [];
  const steps: BuiltMark[][] = [];
  script.steps.forEach((st, i) => {
    const out: BuiltMark[] = [];
    // Recorrido: de las articulaciones que cambian (una por cadena: la más alejada del tronco).
    if (st.path !== false) {
      const ch = changes(keys[i]!.pose, keys[i + 1]!.pose);
      const joints = (st.path ?? [...new Set(ch.map((c) => c.joint))]) as BodyKey[];
      const order: Record<string, number> = { pelvis: 0, trunk: 1, neck: 2, jaw: 3, shoulder: 1, elbow: 2, wrist: 3, hip: 1, knee: 2, ankle: 3 };
      const chain = (k: string) => (k.match(/^(r|l)_(shoulder|elbow|wrist)$/) ? `${k[0]}arm` : k.match(/^(r|l)_(hip|knee|ankle)$/) ? `${k[0]}leg` : "axial");
      const pick = new Map<string, BodyKey>();
      for (const k of joints) {
        const c = chain(k);
        const prev = pick.get(c);
        if (!prev || order[k.replace(/^[rl]_/, "")]! > order[prev.replace(/^[rl]_/, "")]!) pick.set(c, k);
      }
      // Con varias cadenas, primero la del tronco y como mucho dos flechas.
      const poses = Array.from({ length: 25 }, (_, j) => patientPose(L, (i + j / 24) / S, 0));
      // (El punto de referencia de la articulación más alejada recoge también lo que mueven las de más arriba.)
      const tracks = [...pick.values()].map((k) => ({ k, pts: bestTrack(k, poses) }));
      tracks.sort((a, b) => len(b.pts) - len(a.pts));
      const label = stepLabel(spec, keys, i);
      tracks.slice(0, 2).forEach(({ k, pts }, n) => {
        if (len(pts) < 3) return;
        const c = curved(pts, MARK_COLORS.path, 1.1);
        geos.push(...c.geos);
        const mc = mainChange(keys, i, k);
        out.push({ kind: "path", group: c.group, mats: c.mats, label: n === 0 ? label : "", labelAt: beside(pts, center(poses[12]!, k)), keep: [pts[pts.length - 1]!, pts[Math.floor(pts.length / 2)]!, pts[Math.floor((3 * pts.length) / 4)]!], ...(mc ? { path: { pts, joint: k, dof: mc.dof, sign: mc.sign, virtual: false } } : {}) });
      });
    }
    for (const mk of st.marks ?? []) out.push(markOf(L, mk, (i + 1) / S, geos));
    steps.push(out);
  });
  const always = (spec.marks ?? []).map((mk) => markOf(L, mk, 0, geos));
  return { steps, always, geos };
}

/** Una marca de empuje o de resistencia. `u`: momento de la maniobra en el que se dibuja (para las curvas). */
function markOf(L: Layout, mk: Mark, u: number, geos: BufferGeometry[]): BuiltMark {
  const color = mk.kind === "push" ? MARK_COLORS.push : MARK_COLORS.resist;
  const label = mk.label ?? (mk.kind === "push" ? "El examinador empuja" : "El paciente empuja; el examinador resiste");
  if ("joint" in mk) {
    // Isométrico de una articulación: el recorrido que haría si se le dejara (25°), con tope.
    const poses = Array.from({ length: 13 }, (_, j) => patientPose(L, u, 0, (A) => bump(A, mk.joint, mk.dof, (mk.sign * 25 * j) / 12)));
    const pts = bestTrack(mk.joint, poses);
    const c = curved(pts, color, 1.1, true);
    geos.push(...c.geos);
    return { kind: "resist", group: c.group, mats: c.mats, label, labelAt: beside(pts, center(poses[0]!, mk.joint)), keep: [pts[pts.length - 1]!, pts[Math.floor(pts.length / 2)]!], path: { pts, joint: mk.joint, dof: mk.dof, sign: mk.sign, virtual: true } };
  }
  const a = straight(color, mk.kind === "resist");
  geos.push(...a.geos);
  const built: BuiltMark = { kind: mk.kind, group: a.group, mats: a.mats, label, labelAt: new Vector3() };
  built.dir = (pat) => {
    const info = anchorInfo(pat, mk.at);
    return info ? anatDir(pat, mk.dir, mk.at, info) : new Vector3(0, 1, 0);
  };
  built.update = (pat, contactsAt, toCam, pulse) => {
    const info = anchorInfo(pat, mk.at);
    if (!info) return;
    const d = anatDir(pat, mk.dir, mk.at, info);
    const Lr = 15;
    let tip: Vector3;
    let tail: Vector3;
    if (mk.kind === "push") {
      // Llega desde fuera hasta la piel, en el sentido de la fuerza.
      const out = d.clone().negate();
      tip = info.p.clone().addScaledVector(out, surfaceRadius(info, out) + 1.5 - (pulse - 0.5) * 1.6);
      tail = tip.clone().addScaledVector(d, -Lr);
    } else {
      // Sale de la piel hacia donde empuja el paciente y choca con un tope.
      tail = info.p.clone().addScaledVector(d, surfaceRadius(info, d) + 1.5);
      tip = tail.clone().addScaledVector(d, Lr - 3);
    }
    // A un lado si una mano está justo ahí (empuja a un lado, resiste al otro, para que no se pisen).
    if (contactsAt.some((c) => c.distanceTo(tip) < 7 || c.distanceTo(tail) < 7)) {
      const side = toCam.clone().cross(d);
      if (side.lengthSq() < 1e-4) side.set(0, 1, 0).cross(d);
      side.normalize().multiplyScalar(mk.kind === "push" ? 6.5 : -6.5);
      tip.add(side);
      tail.add(side);
    }
    a.set(tail, tip);
    built.labelAt.copy(mk.kind === "push" ? tail.clone().addScaledVector(d, -4) : tip.clone().addScaledVector(d, 5));
  };
  return built;
}

/**
 * Sentido de una flecha de recorrido tal como está dibujada: +1 si va en el sentido positivo del grado de
 * libertad que representa (convenio), −1 si en el contrario, 0 si no se puede decir. Se calcula comparando el
 * desplazamiento de la punta con el que produce, en el esqueleto, un pequeño giro positivo de esa articulación.
 */
export function drawnSense(L: Layout, u: number, mark: NonNullable<BuiltMark["path"]>): number {
  const { pts, joint, dof } = mark;
  const n = pts.length;
  const drawn = pts[n - 1]!.clone().sub(pts[Math.max(0, n - 4)]!);
  // Dónde está el punto al final del recorrido y hacia dónde iría con +3° de esa articulación.
  const lmBest = landmarks(joint)
    .map((lm) => ({ lm, d: track(joint, lm, [patientPose(L, u, 0)])[0]!.distanceTo(pts[n - 1]!) }))
    .sort((a, b) => a.d - b.d)[0]!.lm;
  const a = track(joint, lmBest, [patientPose(L, u, 0)])[0]!;
  const b = track(joint, lmBest, [patientPose(L, u, 0, (A) => bump(A, joint, dof, 3))])[0]!;
  const pos = b.sub(a);
  if (pos.length() < 1e-4 || drawn.length() < 1e-4) return 0;
  const c = pos.normalize().dot(drawn.normalize());
  return Math.abs(c) < 0.2 ? 0 : Math.sign(c);
}
