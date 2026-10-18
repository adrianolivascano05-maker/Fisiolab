// Auditoría de choques de una figura a lo largo de toda la animación (no solo al principio y al final):
// el examinador contra el paciente, la camilla, su propio cuerpo y su otro brazo, y el paciente contra sí
// mismo y la camilla. La usan las pruebas (ningún instante con algo metido en otra cosa) y la búsqueda de
// la colocación del examinador.
import type { FigureSpec } from "../figure";
import { clockOf, sampleTimes, type Moment as ClockMoment } from "../script";
import { keysOf } from "./anatomy";
import { bodySDF, skinPoints, tableD } from "./collide";
import { shoulderAngles, wristAngles, wristExcess, type ExaminerPlan } from "./examiner";
import type { Layout } from "./layout";
import { scenePoses, type Moment } from "./scene";
import type { Pose3, Side } from "./rig";

export type Issue = { t: number; what: string; depth: number };

/** Cuánto (cm) se tolera que algo se meta en otra cosa: la piel cede un poco donde se apoya o se aprieta. */
export const TOLERANCE = {
  /** Cuerpo, cabeza y piernas del examinador; sus brazos fuera de la toma. */
  body: 0.6,
  /** La mano sobre la parte que toca (aprieta la piel). */
  grip: 1.4,
  /** La mano sobre otras partes del paciente. */
  hand: 0.8,
  table: 0.6,
  /** Un brazo del examinador con su propio cuerpo o con el otro brazo. */
  own: 0.6,
  /** El paciente consigo mismo (un antebrazo apoyado en el muslo hunde algo la ropa y la piel). */
  self: 1.5,
  /** Lo que le puede faltar a una muñeca para llegar a su toma. */
  reach: 1.0,
};

/** Instantes que se revisan de una figura: toda la vuelta (y, con guion, el final y la mitad de cada paso). */
export function auditMoments(spec: FigureSpec, step = 0.025): { t: number; tl: Moment & ClockMoment }[] {
  const clock = clockOf(spec, spec.script ? keysOf(spec) : undefined);
  return sampleTimes(clock, step).map((t) => ({ t, tl: clock.at(t) }));
}

const isArm = (p: string) => /upperarm|forearm/.test(p);
const isHand = (p: string) => /hand/.test(p);
const sideOf = (p: string) => p.slice(0, 1);

/** Problemas en un instante (lo más hondo de cada tipo). */
export function auditPoses(spec: FigureSpec, L: Layout, pat: Pose3, ex: Pose3 | null, contactParts: string[], t = 0): Issue[] {
  const out = new Map<string, Issue>();
  const add = (what: string, depth: number, tol: number) => {
    if (depth <= tol) return;
    const prev = out.get(what);
    if (!prev || prev.depth < depth) out.set(what, { t, what, depth: +depth.toFixed(2) });
  };
  const psdf = bodySDF(pat);
  // El paciente consigo mismo: brazos contra el tronco, la cabeza y las piernas; una pierna contra la otra.
  for (const sp of skinPoints(pat, (p) => /forearm|hand|shank|foot/.test(p), 2)) {
    const own = sideOf(sp.part);
    const leg = /shank|foot/.test(sp.part);
    const h = psdf(sp.p, (q) => q === "neck" || (leg ? !(/thigh|shank|foot/.test(q) && sideOf(q) !== own) : !/torso|head|thigh|shank/.test(q)));
    add(`paciente: ${sp.part} dentro de ${h.part}`, -h.d, TOLERANCE.self);
  }
  if (L.table) {
    const t0 = L.table;
    // Sentado, los glúteos se aplastan contra el tablero (quedan dentro, no se ven).
    const seated = spec.posture === "sitting";
    for (const sp of skinPoints(pat, undefined, 2)) add(`paciente: ${sp.part} dentro de la camilla`, -tableD(t0, sp.p), seated && sp.part === "torso" ? 7.5 : TOLERANCE.table + 0.6);
  }
  if (!ex) return [...out.values()];
  const esdf = bodySDF(ex);
  for (const sp of skinPoints(ex, undefined, 1.5)) {
    const h = psdf(sp.p);
    if (isHand(sp.part)) add(`examinador: ${sp.part} dentro de ${h.part}`, -h.d, contactParts.includes(h.part) ? TOLERANCE.grip : TOLERANCE.hand);
    else add(`examinador: ${sp.part} dentro de ${h.part}`, -h.d, TOLERANCE.body);
    // Una mano que se apoya en la camilla (debajo de una pierna o de la cabeza) aprieta un poco el colchón.
    if (L.table) add(`examinador: ${sp.part} dentro de la camilla`, -tableD(L.table, sp.p), isHand(sp.part) ? TOLERANCE.table + 0.6 : TOLERANCE.table);
    // Sus brazos y manos, fuera de su tronco, su cabeza, sus piernas y del otro brazo.
    if (isArm(sp.part) || isHand(sp.part)) {
      const s = sideOf(sp.part);
      // Junto al hombro el brazo sale del tronco (el deltoides lo cubre) y, cruzado por delante, se apoya en el
      // pecho y la axila: ahí se tolera algo más.
      const fromS = /upperarm/.test(sp.part) ? sp.p.distanceTo(ex.pt[`${s}_shoulder`]!) : Infinity;
      if (fromS < 11) continue;
      const o = esdf(sp.p, (q) => q === "neck" || q === `${s}_upperarm` || q === `${s}_forearm` || q === `${s}_hand`);
      // (Agachado o sentado, el antebrazo puede descansar en el propio muslo.)
      const tol = o.part === "torso" && fromS < 17 ? TOLERANCE.own + 1.6 * Math.min(1, (17 - fromS) / 5) : /forearm/.test(sp.part) && /thigh/.test(o.part) ? TOLERANCE.own + 0.8 : TOLERANCE.own;
      add(`examinador: ${sp.part} dentro de su ${o.part}`, -o.d, tol);
    }
  }
  return [...out.values()];
}

/**
 * Lo que los brazos del examinador pasan de los topes de sus articulaciones en una pose (grados): rotación del
 * hombro, hombro muy atrás o cruzado, codo doblado del todo y muñeca (flexión, desviación y pronosupinación).
 */
export function jointExcess(ex: Pose3, sides: Side[]): { what: string; deg: number }[] {
  const out: { what: string; deg: number }[] = [];
  for (const s of sides) {
    const st = { S: ex.pt[`${s}_shoulder`]!, E: ex.pt[`${s}_elbow`]!, uaQ: ex.seg[`${s}_upperarm`].q };
    const sh = shoulderAngles(st, ex.trunkQ, s);
    const w = wristAngles(ex.seg[`${s}_forearm`].q, ex.seg[`${s}_hand`].q, s);
    const elbow = st.E.clone().sub(st.S).normalize().angleTo(ex.pt[`${s}_wrist`]!.clone().sub(st.E).normalize()) * (180 / Math.PI);
    const add = (what: string, deg: number) => deg > 0 && out.push({ what: `${s} ${what}`, deg });
    if (sh.elev < 165) add("rotación del hombro", Math.max(sh.rot - 95, -75 - sh.rot));
    add("hombro hacia atrás", sh.back - 60);
    add("hombro cruzado", sh.cross - 70);
    add("codo", elbow - 152);
    add("muñeca", wristExcess(w, "press") - 15);
  }
  return out;
}

/** Todos los problemas de una figura a lo largo de la animación. */
export function auditFigure(spec: FigureSpec, L: Layout, plan: ExaminerPlan | null, step = 0.025): Issue[] {
  return figureFaults(spec, L, plan, step).issues;
}

/** Choques (lo más hondo de cada tipo) y lo que cada articulación pasa de su tope (lo más), en una sola pasada. */
export function figureFaults(spec: FigureSpec, L: Layout, plan: ExaminerPlan | null, step = 0.025): { issues: Issue[]; joints: Map<string, number> } {
  const worst = new Map<string, Issue>();
  const joints = new Map<string, number>();
  const sides = plan?.arms.map((a) => a.side) ?? [];
  for (const { t, tl } of auditMoments(spec, step)) {
    const { pat, ex, cts, gaps } = scenePoses(spec, L, plan, tl);
    const found = auditPoses(spec, L, pat, ex, cts.map((c) => c.part), t);
    // Con la mano apoyada, la muñeca tiene que llegar a su sitio.
    if (tl.reach >= 0.999) for (const [s, g] of Object.entries(gaps)) if (g > TOLERANCE.reach) found.push({ t, what: `examinador: la mano ${s} no llega a la toma`, depth: +g.toFixed(2) });
    for (const is of found) {
      const prev = worst.get(is.what);
      if (!prev || prev.depth < is.depth) worst.set(is.what, is);
    }
    if (ex) for (const j of jointExcess(ex, sides)) joints.set(j.what, Math.max(joints.get(j.what) ?? 0, j.deg));
  }
  return { issues: [...worst.values()].sort((a, b) => b.depth - a.depth), joints };
}
