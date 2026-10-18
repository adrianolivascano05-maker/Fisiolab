// Dónde va el paciente (de pie en el suelo, tumbado en la camilla, sentado en su borde o inclinado sobre
// ella) y su pose en cada momento de la maniobra. Puro: sirve igual para la escena y para las pruebas.
import { Quaternion, Vector3 } from "three";
import type { FigureSpec } from "../figure";
import { anatAngles, anatPose, keysOf } from "./anatomy";
import { mentioned as scriptMentions } from "../script";
import { bodySDF, skinPoints, tableD } from "./collide";
import { anatDir, anchorInfo, fk, LYING, patientAngles, postureQ, surfaceSamples, upSide, type BodyAngles, type Nudges, type Pose3, type SegKey, type Side } from "./rig";

export type Table = { x0: number; x1: number; z0: number; z1: number; top: number };
/** Ajuste (grados) del hombro de cada brazo del paciente para que no se meta en su cuerpo ni en la camilla. */
type ArmFix = { flex: number; abd: number };
export type Layout = {
  spec: FigureSpec;
  rootQ: Quaternion;
  rootP: Vector3;
  fixedRoot: boolean;
  table: Table | null;
  arms: Record<Side, ArmFix>;
  /** De pie con guion: el pie que apoya (o los dos) y dónde está su tobillo al principio (no se desliza si el cuerpo gira o se agacha). */
  planted?: { side: Side | "both"; at: Vector3; ball?: Vector3; heel?: number } | null;
};

/** Ángulos del paciente en el momento m: los del guion, si lo tiene, o los de la descripción de siempre. */
export const anglesOf = (spec: FigureSpec, m: number): BodyAngles => (spec.script ? anatAngles(spec, m) : patientAngles(spec, m));
const leanOf = (A: BodyAngles) => A.trunkFlex + (A.pelvis?.flex ?? 0);

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
  const bent = posture === "standing" && !!spec.hands?.length && leanOf(anglesOf(spec, 0)) >= 60 && leanOf(anglesOf(spec, 1)) >= 60;
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
    const p0 = fk(new Vector3(), rootQ, anglesOf(spec, 0));
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
    const pose = fk(L.rootP, rootQ, anglesOf(spec, 0));
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
      // Con guion, si en algún momento la cabeza baja de la camilla (extensión del cuello), la camilla acaba en
      // los hombros y el examinador la sostiene por fuera.
      if (spec.script) {
        const ks = keysOf(spec).length;
        const headDips = Array.from({ length: ks }, (_, i) => fk(L.rootP, rootQ, anglesOf(spec, i / (ks - 1)))).some((q) =>
          surfaceSamples(q, (part) => part === "head").some((x) => x.p.y < top - 1),
        );
        if (headDips) {
          const nb = pose.pt.neckBase!;
          if (pose.pt.head!.x < pose.root.p.x) t.x0 = Math.max(t.x0, nb.x - 2);
          else t.x1 = Math.min(t.x1, nb.x + 2);
        }
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
    // Lo que fija el guion no se toca (los ángulos del guion son la verdad).
    if (spec.script && scriptMentions(spec.script).has(key)) continue;
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
export function patientPose(L: Layout, m: number, nudge: number, edit?: (A: BodyAngles) => void): Pose3 {
  const spec = L.spec;
  const A = anglesOf(spec, m);
  for (const sd of ["r", "l"] as const) {
    A[sd].shoulder.flex += L.arms[sd].flex;
    A[sd].shoulder.abd += L.arms[sd].abd;
  }
  // (Para las marcas: la pose con una articulación algo más girada, sin cambiar nada más.)
  edit?.(A);
  let root = L.rootP;
  if (!L.fixedRoot) {
    // De pie: los pies (o pies y manos a cuatro patas) en el suelo en cada momento.
    const p = fk(new Vector3(), L.rootQ, A);
    const low = Math.min(...surfaceSamples(p, (part) => /foot/.test(part) || (spec.posture === "quadruped" && /hand|shank/.test(part))).map((s) => s.p.y));
    root = new Vector3(0, -low, 0);
    // Con guion, el pie que apoya no se desliza aunque el cuerpo gire sobre él (Thessaly); con los dos pies en
    // el suelo, el punto medio de los tobillos (sentadillas). De puntillas, el pie pivota sobre la bola (las
    // cabezas de los metatarsianos), no sobre el tobillo.
    if (spec.script && spec.posture === "standing") {
      const ankle = (q: Pose3, sd: Side | "both") => (sd === "both" ? q.pt.r_ankle!.clone().lerp(q.pt.l_ankle!, 0.5) : q.pt[`${sd}_ankle`]!.clone());
      const ball = (q: Pose3, sd: Side) => new Vector3(0, -5.6, 13).applyQuaternion(q.seg[`${sd}_foot`].q).add(q.pt[`${sd}_ankle`]!);
      if (L.planted === undefined) {
        L.planted = null;
        // El pie que apoya es el que queda abajo cuando más se separan (la pierna levantada de Thessaly, un paso);
        // si nunca se separan, los dos.
        const foot = (q: Pose3, sd: Side) => Math.min(...surfaceSamples(q, (part) => part === `${sd}_foot`).map((x) => x.p.y));
        let side: Side | "both" = "both";
        let most = 3;
        for (let i = 0; i <= 8; i++) {
          const q = patientPose(L, i / 8, 0);
          const d = foot(q, "r") - foot(q, "l");
          if (Math.abs(d) > most) {
            most = Math.abs(d);
            side = d < 0 ? "r" : "l";
          }
        }
        const p0 = patientPose(L, 0, 0);
        L.planted = side === "both" ? { side, at: ankle(p0, side) } : { side, at: ankle(p0, side), ball: ball(p0, side), heel: p0.pt[`${side}_heel`]!.y - foot(p0, side) };
      }
      const pl = L.planted;
      if (pl) {
        let d = pl.at.clone().sub(ankle(p, pl.side).add(root));
        if (pl.side !== "both" && pl.ball) {
          // Cuánto se ha levantado el talón respecto al principio (0: pie plano; desde 3 cm, apoyo en la bola).
          const heelUp = p.pt[`${pl.side}_heel`]!.y - low - pl.heel!;
          const w = Math.max(0, Math.min(1, (heelUp - 0.5) / 2.5));
          if (w > 0) d.lerp(pl.ball.clone().sub(ball(p, pl.side).add(root)), w);
        }
        root.x += d.x;
        root.z += d.z;
      }
    }
  }
  let pose = fk(root, L.rootQ, A);
  if (spec.script) {
    // Desplazamiento de un segmento (cajones, Lachman): lo dice el guion, no las flechas.
    const sh = anatPose(spec, m).shift;
    const info = sh ? anchorInfo(pose, `${sh.seg}@0.5`) : null;
    if (sh && info) pose = fk(root, L.rootQ, A, { [sh.seg]: anatDir(pose, sh.dir, `${sh.seg}@0.5`, info).multiplyScalar(sh.cm) });
    return pose;
  }
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
