// Dónde va el paciente (de pie en el suelo, tumbado en la camilla, sentado en su borde o inclinado sobre
// ella) y su pose en cada momento de la maniobra. Puro: sirve igual para la escena y para las pruebas.
import { Quaternion, Vector3 } from "three";
import type { FigureSpec } from "../figure";
import { bodySDF, skinPoints, tableD } from "./collide";
import { anatDir, anchorInfo, fk, LYING, patientAngles, postureQ, surfaceSamples, upSide, type Nudges, type Pose3, type SegKey, type Side } from "./rig";

export type Table = { x0: number; x1: number; z0: number; z1: number; top: number };
/** Ajuste (grados) del hombro de cada brazo del paciente para que no se meta en su cuerpo ni en la camilla. */
type ArmFix = { flex: number; abd: number };
export type Layout = { spec: FigureSpec; rootQ: Quaternion; rootP: Vector3; fixedRoot: boolean; table: Table | null; arms: Record<Side, ArmFix> };

const TABLE_TOP = { lying: 66, sitting: 56 };
const JOINT_SEG: Record<string, string> = { elbow: "forearm", wrist: "hand", knee: "shank", ankle: "foot", handtip: "hand", foottip: "foot", hand: "hand", foot: "foot" };

/** Segmento que una fuerza desplaza un poco (como en la figura plana). */
function nudgeSeg(anchor: string): SegKey | null {
  const [name] = anchor.split("@");
  const m = name?.match(/^(r|l)_(\w+)$/);
  if (!m) return null;
  const seg = ["upperarm", "forearm", "hand", "thigh", "shank", "foot"].includes(m[2]!) ? m[2]! : JOINT_SEG[m[2]!];
  return seg ? (`${m[1]}_${seg}` as SegKey) : null;
}

export function layoutPatient(spec: FigureSpec): Layout {
  const posture = spec.posture;
  const rootQ = postureQ(posture, posture === "sidelying" ? upSide(spec) : "l");
  const L: Layout = { spec, rootQ, rootP: new Vector3(), fixedRoot: false, table: null, arms: { r: { flex: 0, abd: 0 }, l: { flex: 0, abd: 0 } } };
  const lying = LYING.includes(posture);
  const bent = posture === "standing" && !!spec.hands?.length && patientAngles(spec, 0).trunkFlex >= 60 && patientAngles(spec, 1).trunkFlex >= 60;
  if (bent) {
    // Tumbado boca abajo sobre la camilla con los pies en el suelo.
    const pose = patientPose(L, 0, 0);
    L.rootP.copy(pose.root.p);
    L.fixedRoot = true;
    const torso = surfaceSamples(pose, (part) => part === "torso");
    const top = Math.min(...torso.filter((s) => s.p.z > pose.root.p.z + 10).map((s) => s.p.y));
    const z0 = pose.root.p.z + 14;
    L.table = { x0: -34, x1: 34, z0, z1: z0 + 150, top };
  }
  if (lying || posture === "sitting") {
    const p0 = fk(new Vector3(), rootQ, patientAngles(spec, 0));
    const top = lying ? TABLE_TOP.lying : TABLE_TOP.sitting;
    // De lado, también apoyan el hombro y la cadera de abajo.
    const down = posture === "sidelying" ? (upSide(spec) === "l" ? "r" : "l") : null;
    const support = lying
      ? skinPoints(p0, (part) => part === "torso" || part === "head" || (posture === "longsitting" && /thigh|shank/.test(part)) || (!!down && (part === `${down}_upperarm` || part === `${down}_thigh`)))
      : skinPoints(p0, (part) => /thigh/.test(part));
    // Sentado apoyan los muslos (los glúteos se aplastan contra el tablero y quedan dentro de él).
    const low = Math.min(...support.map((s) => s.p.y)) + (lying ? 0 : 0.3);
    L.rootP.set(0, top - low, 0);
    L.fixedRoot = true;
    const pose = fk(L.rootP, rootQ, patientAngles(spec, 0));
    const all = surfaceSamples(pose);
    if (lying) {
      // La camilla llega hasta donde apoya el cuerpo (una pierna que cuelga queda fuera); boca abajo, los
      // pies quedan fuera, por el extremo.
      const prone = posture === "prone";
      const resting = all.filter((s) => s.p.y < top + 14 && !/hand|forearm/.test(s.part) && !(prone && /foot/.test(s.part)));
      const xs = resting.map((s) => s.p.x);
      const torso = all.filter((s) => s.part === "torso").map((s) => s.p.z);
      const zc = torso.reduce((a, b) => a + b, 0) / torso.length;
      const t: Table = { x0: Math.min(...xs) - 8, x1: Math.max(...xs) + (prone ? -1 : 8), z0: zc - 33, z1: zc + 33, top };
      // Una pierna que cuelga (Gaenslen, choque posterior): si la otra no apoya más abajo, el paciente queda
      // con las nalgas en el extremo de la camilla; si no, al borde de ese lado.
      for (const sd of ["r", "l"] as const) {
        const hangs = surfaceSamples(pose, (part) => part === `${sd}_shank` || part === `${sd}_foot`).some((x) => x.p.y < top - 1 && x.p.x > t.x0 && x.p.x < t.x1);
        if (!hangs) continue;
        const hip = pose.pt[`${sd}_hip`]!;
        const other = sd === "r" ? "l" : "r";
        const otherRests = surfaceSamples(pose, (part) => part === `${other}_shank` || part === `${other}_foot`).some((x) => x.p.y < top + 14 && x.p.x > hip.x + 10);
        if (!otherRests) t.x1 = Math.min(t.x1, hip.x + 4);
        else if (hip.z > zc) t.z1 = Math.min(t.z1, hip.z - 3);
        else t.z0 = Math.max(t.z0, hip.z + 3);
      }
      L.table = t;
    } else {
      // Sentado en el borde: el hueco de la rodilla en el canto, con las pantorrillas por delante de él.
      const calves = skinPoints(pose, (part) => /shank|foot/.test(part)).filter((x) => x.p.y < top + 1).map((x) => x.p.z);
      const front = Math.min(pose.pt.r_knee!.z - 2, ...calves.map((z) => z - 0.8));
      L.table = { x0: -75, x1: 75, z0: front - 64, z1: front, top };
    }
  }
  settleArms(L);
  return L;
}

/**
 * Los brazos que la figura no coloca (o en el plano que el dibujo plano no enseña) se separan o se adelantan
 * lo justo para que la mano y el antebrazo no se metan en el tronco, las piernas o la camilla en ningún
 * momento de la maniobra.
 */
function settleArms(L: Layout) {
  const spec = L.spec;
  for (const s of ["r", "l"] as const) {
    const key = `${s}_shoulder` as const;
    if (spec.pose3d?.[key] || spec.to3d?.[key]) continue;
    const mentioned = spec.joints?.[key] !== undefined || spec.to?.[key] !== undefined;
    const canAbd = spec.view === "side" || !mentioned;
    const canFlex = spec.view === "front" || !mentioned;
    const inside = (fix: ArmFix) => {
      L.arms[s] = fix;
      let worst = 0;
      for (const [m, nudge] of [[0, 0], [0, 1], [0.25, 1], [0.5, 1], [0.75, 1], [1, 1]] as const) {
        const pose = patientPose(L, m, nudge);
        const sdf = bodySDF(pose);
        for (const sp of skinPoints(pose, (part) => part === `${s}_forearm` || part === `${s}_hand`, 2)) {
          worst = Math.max(worst, -sdf(sp.p, (q) => !/torso|head|thigh|shank/.test(q)).d);
          if (L.table) worst = Math.max(worst, -tableD(L.table, sp.p));
        }
      }
      return worst;
    };
    if (inside({ flex: 0, abd: 0 }) <= 1.2) continue;
    const cands: ArmFix[] = [];
    for (const abd of canAbd ? [0, 8, 16, 24, 32, 40, -8, -16] : [0]) for (const flex of canFlex ? [0, 10, 20, 30, 40, 50, 60] : [0]) cands.push({ flex, abd });
    cands.sort((a, b) => Math.abs(a.abd) + 1.2 * a.flex - (Math.abs(b.abd) + 1.2 * b.flex));
    let best = { fix: { flex: 0, abd: 0 }, d: Infinity };
    for (const c of cands.slice(1)) {
      const d = inside(c);
      if (d < best.d) best = { fix: c, d };
      if (d <= 0.8) break;
    }
    L.arms[s] = best.fix;
  }
}

/** Pose del paciente en el momento m (0-1), con el pequeño desplazamiento de las fuerzas (`nudge`, 0-1). */
export function patientPose(L: Layout, m: number, nudge: number): Pose3 {
  const spec = L.spec;
  const A = patientAngles(spec, m);
  for (const sd of ["r", "l"] as const) {
    A[sd].shoulder.flex += L.arms[sd].flex;
    A[sd].shoulder.abd += L.arms[sd].abd;
  }
  let root = L.rootP;
  if (!L.fixedRoot) {
    // De pie: los pies (o pies y manos a cuatro patas) en el suelo en cada momento.
    const p = fk(new Vector3(), L.rootQ, A);
    const low = Math.min(...surfaceSamples(p, (part) => /foot/.test(part) || (spec.posture === "quadruped" && /hand|shank/.test(part))).map((s) => s.p.y));
    root = new Vector3(0, -low, 0);
  }
  let pose = fk(root, L.rootQ, A);
  if (nudge > 0 && !spec.to) {
    const nudges: Nudges = {};
    for (const ar of spec.arrows ?? []) {
      if ("rotate" in ar || (ar.kind ?? "force") !== "force") continue;
      const seg = nudgeSeg(ar.at);
      const info = anchorInfo(pose, ar.at);
      if (!seg || !info) continue;
      const v = anatDir(pose, ar.dir, ar.at, info).multiplyScalar(2.6 * nudge);
      nudges[seg] = (nudges[seg] ?? new Vector3()).add(v);
    }
    pose = fk(root, L.rootQ, A, nudges);
  }
  return pose;
}
