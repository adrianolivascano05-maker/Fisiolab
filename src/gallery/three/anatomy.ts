// Convenio anatómico de las figuras con guion (CONVENIO.md): de la descripción (`script`) a los ángulos del
// esqueleto, la postura natural de lo que el guion no menciona, los límites fisiológicos y la medida de los
// ángulos sobre el modelo ya colocado (para comprobar que la animación enseña lo que dice la descripción).
import { Euler, Quaternion } from "three";
import type { BodyKey, BodyPose, FigureSpec, Joint3D } from "../figure";
import { restValue } from "../posture";
import { mentioned, poseAt, scriptKeys, type Key, type Shift } from "../script";
import { sgn, type BodyAngles, type JA, type Limb, type Pose3 } from "./rig";

export { restValue };
const LIMB_JOINTS = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"] as const;

const KEYS = new WeakMap<FigureSpec, Key[]>();
/** Poses clave del guion de una figura, con la postura natural en lo que no se dice. */
export function keysOf(spec: FigureSpec): Key[] {
  let k = KEYS.get(spec);
  if (!k) {
    k = scriptKeys(spec.script!, (key, dof) => restValue(spec, key, dof));
    KEYS.set(spec, k);
  }
  return k;
}

const MENTIONED = new WeakMap<FigureSpec, Map<BodyKey, Set<keyof Joint3D>>>();
const said = (spec: FigureSpec) => {
  let m = MENTIONED.get(spec);
  if (!m) {
    m = mentioned(spec.script!);
    MENTIONED.set(spec, m);
  }
  return m;
};

/** Pose anatómica completa en el progreso u: lo del guion y, en lo demás, la postura natural. */
export function anatPose(spec: FigureSpec, u: number): { pose: Required<Record<BodyKey, Joint3D>>; shift: Shift | null } {
  const { pose, shift } = poseAt(keysOf(spec), u);
  const full = {} as Required<Record<BodyKey, Joint3D>>;
  const keys: BodyKey[] = ["pelvis", "trunk", "neck", "jaw", ...(["r", "l"] as const).flatMap((s) => LIMB_JOINTS.map((j) => `${s}_${j}` as BodyKey))];
  for (const k of keys) {
    const j: Joint3D = {};
    for (const d of ["flex", "abd", "rot", "lat", "pron", "inv"] as const) j[d] = pose[k]?.[d] ?? restValue(spec, k, d);
    full[k] = j;
  }
  return { pose: full, shift };
}

/** Ángulos del esqueleto en el progreso u de una figura con guion. */
export function anatAngles(spec: FigureSpec, u: number): BodyAngles {
  const { pose } = anatPose(spec, u);
  const m = said(spec);
  const free = (k: BodyKey) => !m.has(k);
  const A: BodyAngles = {
    anat: true,
    pelvis: { flex: pose.pelvis.flex!, lat: pose.pelvis.lat!, rot: pose.pelvis.rot! },
    trunkFlex: pose.trunk.flex!,
    trunkLat: pose.trunk.lat!,
    trunkRot: pose.trunk.rot!,
    neckFlex: pose.neck.flex!,
    neckLat: pose.neck.lat!,
    neckYaw: -pose.neck.rot!,
    jaw: Math.max(0, pose.jaw.flex!),
    r: {} as Limb,
    l: {} as Limb,
  };
  const lean = pose.pelvis.flex! + pose.trunk.flex!;
  for (const s of ["r", "l"] as const) {
    const L = A[s];
    for (const j of LIMB_JOINTS) {
      const v = pose[`${s}_${j}`];
      const ja: JA = { flex: v.flex!, abd: v.abd! };
      if (j === "shoulder" || j === "hip" || j === "knee") ja.rot = v.rot!;
      if (j === "ankle") ja.inv = v.inv!;
      L[j] = ja;
    }
    // Pronación del antebrazo: el esqueleto gira la mano desde la palma hacia delante (supinación completa).
    L.wrist.twist = -sgn(s) * (90 + pose[`${s}_elbow`].pron!);
    // Lo que el guion no menciona cuelga con la gravedad: los brazos, aunque el tronco se incline; las piernas
    // de pie, aunque la pelvis bascule.
    if (free(`${s}_shoulder`) && (spec.posture === "standing" || spec.posture === "sitting")) L.shoulder.flex += spec.posture === "sitting" ? lean * 0.6 : lean;
    if (free(`${s}_hip`) && spec.posture === "standing") {
      L.hip.flex += pose.pelvis.flex!;
      L.hip.abd -= sgn(s) * pose.pelvis.lat!;
    }
    if (spec.posture === "prone" && free(`${s}_ankle`) && L.knee.flex < 30) L.ankle.flex = -55;
  }
  return A;
}

// ---------- Límites fisiológicos ----------

/**
 * Rango (grados) de cada grado de libertad en el convenio (valores de manuales de goniometría, algo
 * redondeados hacia arriba para no rechazar maniobras de fin de rango). Las pruebas comprueban que ningún
 * guion se sale de ellos.
 */
export const LIMITS: Record<string, Partial<Record<keyof Joint3D, [number, number]>>> = {
  pelvis: { flex: [-30, 95], lat: [-15, 15], rot: [-50, 50] },
  trunk: { flex: [-30, 90], lat: [-40, 40], rot: [-50, 50] },
  neck: { flex: [-75, 55], lat: [-45, 45], rot: [-85, 85] },
  jaw: { flex: [0, 35] },
  shoulder: { flex: [-60, 180], abd: [-50, 180], rot: [-95, 90] },
  elbow: { flex: [-5, 150], abd: [-12, 12], pron: [-90, 90] },
  wrist: { flex: [-80, 90], abd: [-40, 25] },
  hip: { flex: [-30, 130], abd: [-35, 50], rot: [-50, 45] },
  knee: { flex: [-8, 155], abd: [-12, 12], rot: [-40, 40] },
  ankle: { flex: [-55, 35], inv: [-25, 40] },
};

/** Lo que se sale de los límites en las poses clave del guion. */
export function limitViolations(spec: FigureSpec): string[] {
  if (!spec.script) return [];
  const out: string[] = [];
  keysOf(spec).forEach((key, i) => {
    for (const [k, j] of Object.entries(key.pose) as [BodyKey, Joint3D][]) {
      const lim = LIMITS[k.replace(/^[rl]_/, "")];
      for (const [d, v] of Object.entries(j) as [keyof Joint3D, number][]) {
        const r = lim?.[d];
        if (!r) out.push(`${k}.${d} no existe en el convenio`);
        else if (v < r[0] - 1e-9 || v > r[1] + 1e-9) out.push(`pose ${i}: ${k}.${d} = ${v} fuera de [${r[0]}, ${r[1]}]`);
      }
    }
  });
  return out;
}

// ---------- Medida sobre el modelo ----------

/** Giro de cada articulación del paciente tal como ha quedado el modelo (relativo a su segmento de arriba). */
export function jointRotations(p: Pose3): Record<string, Quaternion> {
  const rel = (a: Quaternion, b: Quaternion) => a.clone().invert().multiply(b);
  const out: Record<string, Quaternion> = {
    pelvis: rel(p.root.q, p.pelvisQ),
    trunk: rel(p.pelvisQ, p.trunkQ),
    neck: rel(p.trunkQ, p.head.q),
  };
  for (const s of ["r", "l"] as const) {
    const sg = p.seg;
    out[`${s}_shoulder`] = rel(p.trunkQ, sg[`${s}_upperarm`].q);
    out[`${s}_elbow`] = rel(sg[`${s}_upperarm`].q, sg[`${s}_forearm`].q);
    out[`${s}_wrist`] = rel(sg[`${s}_forearm`].q, sg[`${s}_hand`].q);
    out[`${s}_hip`] = rel(p.pelvisQ, sg[`${s}_thigh`].q);
    out[`${s}_knee`] = rel(sg[`${s}_thigh`].q, sg[`${s}_shank`].q);
    out[`${s}_ankle`] = rel(sg[`${s}_shank`].q, sg[`${s}_foot`].q);
  }
  return out;
}

/** Ángulo (grados) entre dos giros. */
export const quatAngle = (a: Quaternion, b: Quaternion) => (2 * Math.acos(Math.min(1, Math.abs(a.dot(b)) / (a.length() * b.length() || 1))) * 180) / Math.PI;

/**
 * Ángulos anatómicos medidos sobre el modelo (convenio de CONVENIO.md), deshaciendo el orden en que el
 * esqueleto compone cada articulación. Cerca de 90° de abducción del hombro, la flexión y la rotación se
 * confunden (bloqueo de cardán): ahí conviene comparar giros completos con `quatAngle`.
 */
export function measureAngles(p: Pose3): BodyPose {
  const R = jointRotations(p);
  const e = (q: Quaternion, order: "XZY" | "YXZ") => {
    const x = new Euler().setFromQuaternion(q, order);
    return { x: (x.x * 180) / Math.PI, y: (x.y * 180) / Math.PI, z: (x.z * 180) / Math.PI };
  };
  const out: BodyPose = {};
  const ax = (k: string) => e(R[k]!, "XZY");
  const pv = ax("pelvis");
  out.pelvis = { flex: pv.x, lat: pv.z, rot: -pv.y };
  const tr = ax("trunk");
  out.trunk = { flex: tr.x, lat: tr.z, rot: -tr.y };
  const nk = ax("neck");
  out.neck = { flex: nk.x, lat: nk.z, rot: -nk.y };
  for (const s of ["r", "l"] as const) {
    const g = sgn(s);
    const sh = ax(`${s}_shoulder`);
    out[`${s}_shoulder`] = { flex: -sh.x, abd: g * sh.z, rot: -g * sh.y };
    const el = ax(`${s}_elbow`);
    const wr = e(R[`${s}_wrist`]!, "YXZ");
    out[`${s}_elbow`] = { flex: -el.x, abd: g * el.z, pron: -g * wr.y - 90 };
    out[`${s}_wrist`] = { flex: -wr.x, abd: g * wr.z };
    const hp = ax(`${s}_hip`);
    out[`${s}_hip`] = { flex: -hp.x, abd: g * hp.z, rot: -g * hp.y };
    const kn = ax(`${s}_knee`);
    out[`${s}_knee`] = { flex: kn.x, abd: g * kn.z, rot: -g * kn.y };
    const an = ax(`${s}_ankle`);
    out[`${s}_ankle`] = { flex: -an.x, inv: -g * an.z };
  }
  return out;
}
