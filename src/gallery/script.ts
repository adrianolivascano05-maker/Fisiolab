// Guion de una figura (`script`): poses clave, la pose en cada punto de la maniobra y el reloj de la animación
// (cuánto dura cada paso, sus pausas, cuándo llegan las manos y cuándo se ven las marcas y el dolor). Puro: sin
// three ni React, igual para la escena, el dibujo plano y las pruebas.
//
// La maniobra se recorre con un progreso u de 0 a 1 que nunca vuelve atrás: la partida (u = 0), el final de
// cada paso y, al final, otra vez la partida (la vuelta se añade sola). Entre dos poses clave los ángulos
// cambian en línea recta; el reloj reparte el tiempo con una curva de mínimo jerk (arranca y frena suave,
// como un movimiento humano).
import { phases as legacyPhases, timeline, type BodyKey, type BodyPose, type Direction, type FigureSpec, type Joint3D, type Script, type SegName, type Step } from "./figure";

export type Shift = { seg: SegName; dir: Direction; cm: number };
/** Pose clave: ángulos de todo lo que el guion menciona y desplazamiento de un segmento (si lo hay). */
export type Key = { pose: BodyPose; shift: Shift | null };

const DOFS: (keyof Joint3D)[] = ["flex", "abd", "rot", "lat", "pron", "inv"];
export const STEP_DUR = 1.6;
export const STEP_HOLD = 0.6;
const SETUP = 1.6;
const LOOK = 1.8;
const BACK = 1.4;
const LEAVE = 0.9;
const END = 0.4;

/** Curva de mínimo jerk: posición de 0 a 1 con velocidad y aceleración nulas al principio y al final. */
export const minJerk = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (10 + x * (-15 + 6 * x)));
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Articulaciones y grados de libertad que el guion menciona en algún momento. */
export function mentioned(script: Script): Map<BodyKey, Set<keyof Joint3D>> {
  const out = new Map<BodyKey, Set<keyof Joint3D>>();
  const add = (p?: BodyPose) => {
    for (const [k, j] of Object.entries(p ?? {}) as [BodyKey, Joint3D][]) {
      const set = out.get(k) ?? new Set();
      for (const d of DOFS) if (j[d] !== undefined) set.add(d);
      out.set(k, set);
    }
  };
  add(script.start);
  for (const st of script.steps) add(st.to);
  return out;
}

const copy = (p: BodyPose): BodyPose => Object.fromEntries(Object.entries(p).map(([k, j]) => [k, { ...j }]));

/**
 * Poses clave del guion: la partida, el final de cada paso y la vuelta a la partida. `rest(k, dof)` da el
 * valor de lo que la partida no dice (la postura natural); así todas las poses clave tienen los mismos
 * grados de libertad.
 */
export function scriptKeys(script: Script, rest: (k: BodyKey, dof: keyof Joint3D) => number = () => 0): Key[] {
  const all = mentioned(script);
  const start: BodyPose = {};
  for (const [k, dofs] of all) {
    const j: Joint3D = {};
    for (const d of dofs) j[d] = script.start?.[k]?.[d] ?? rest(k, d);
    start[k] = j;
  }
  const keys: Key[] = [{ pose: start, shift: null }];
  let cur = start;
  let shift: Shift | null = null;
  for (const st of script.steps) {
    cur = copy(cur);
    for (const [k, j] of Object.entries(st.to ?? {}) as [BodyKey, Joint3D][]) for (const d of DOFS) if (j[d] !== undefined) cur[k]![d] = j[d];
    if (st.shift) shift = st.shift.cm ? { ...st.shift } : null;
    keys.push({ pose: cur, shift });
  }
  keys.push({ pose: copy(start), shift: null });
  return keys;
}

/** Segmentos de la maniobra: uno por paso más la vuelta. */
export const segments = (script: Script) => script.steps.length + 1;

/** Pose (y desplazamiento) en el progreso u: en línea recta entre las dos poses clave de alrededor. */
export function poseAt(keys: Key[], u: number): Key {
  const S = keys.length - 1;
  const f = Math.min(S, Math.max(0, u * S));
  const i = Math.min(S - 1, Math.floor(f));
  const x = f - i;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const pose: BodyPose = {};
  for (const [k, ja] of Object.entries(a.pose) as [BodyKey, Joint3D][]) {
    const jb = b.pose[k] ?? ja;
    const j: Joint3D = {};
    for (const d of DOFS) if (ja[d] !== undefined) j[d] = ja[d]! + ((jb[d] ?? ja[d]!) - ja[d]!) * x;
    pose[k] = j;
  }
  let shift: Shift | null = null;
  const sa = a.shift;
  const sb = b.shift;
  if (sa || sb) {
    const ref = (sb ?? sa)!;
    const ca = sa && sa.seg === ref.seg && sa.dir === ref.dir ? sa.cm : 0;
    const cb = sb && sb.seg === ref.seg && sb.dir === ref.dir ? sb.cm : 0;
    const cm = ca + (cb - ca) * x;
    if (cm) shift = { ...ref, cm };
  }
  return { pose, shift };
}

/** Cuánto se aparta cada pose clave de la partida (grados; cada cm de desplazamiento, 10°). */
function distances(keys: Key[]): number[] {
  const k0 = keys[0]!;
  return keys.map((k) => {
    let d = 0;
    for (const [name, j] of Object.entries(k.pose) as [BodyKey, Joint3D][]) for (const dof of DOFS) if (j[dof] !== undefined) d = Math.max(d, Math.abs(j[dof]! - (k0.pose[name]?.[dof] ?? 0)));
    return Math.max(d, (k.shift?.cm ?? 0) * 10);
  });
}

/** Progreso de la pose clave más alejada de la partida (la que mejor enseña la maniobra). */
export function extremeU(keys: Key[]): number {
  const d = distances(keys);
  let best = 0;
  for (let i = 1; i < d.length - 1; i++) if (d[i]! > d[best]! + 1e-6) best = i;
  return best / (keys.length - 1);
}

/**
 * Cuánto se ha alejado el paciente de la partida en el progreso u (0 en la partida, 1 en la pose clave más
 * alejada): con esto se reparte lo que hace el examinador entre su colocación del principio y la del final.
 */
export function mixAt(keys: Key[], u: number): number {
  const d = distances(keys);
  const max = Math.max(...d) || 1;
  const S = keys.length - 1;
  const f = Math.min(S, Math.max(0, u * S));
  const i = Math.min(S - 1, Math.floor(f));
  const x = f - i;
  return (d[i]! + (d[i + 1]! - d[i]!) * x) / max;
}

/** Momentos en los que se planifica al examinador: las poses clave y el punto medio entre cada dos. */
export function planKeys(script: Script | undefined): number[] {
  if (!script) return [0, 0.25, 0.5, 0.75, 1];
  const n = 2 * segments(script);
  return Array.from({ length: n + 1 }, (_, j) => j / n);
}

// ---------- Reloj ----------

export type PhaseId = (typeof legacyPhases)[number]["id"];
/** Estado de la animación en un instante. m: progreso de la maniobra (u); mix: cuánto se ha alejado de la
 *  partida; reach: manos del examinador apoyadas (0 lejos, 1 en la toma); arrows: opacidad de las marcas del
 *  paso; pain: opacidad del dolor; step: paso en curso (−1 fuera de la maniobra). */
export type Moment = {
  m: number;
  mix: number;
  reach: number;
  arrows: number;
  pain: number;
  pulse: number;
  step: number;
  phase: PhaseId;
  /** Paso cuyas marcas se ven (el último durante «qué buscar»). */
  markStep: number;
  /** Cuánto está apoyada cada mano (si alguna suelta durante la maniobra; si no, todas como `reach`). */
  hands?: number[];
};

export type Clock = {
  /** Segundos de una vuelta completa. */
  duration: number;
  /** Estado en el instante t (fracción de la vuelta, 0-1). */
  at: (t: number) => Moment;
  /** Fases, en fracción de la vuelta. */
  phases: { id: PhaseId; from: number; to: number }[];
  /** Cada paso: desde que empieza a moverse hasta el final de su pausa (fracción de la vuelta). */
  steps: { from: number; to: number; moveTo: number }[];
};

const LEGACY_MS = 7000;

/** Reloj de una figura: el del guion o, si no lo tiene, el de siempre (7 s, ida y vuelta). */
export function clockOf(spec: FigureSpec, keys?: Key[]): Clock {
  const script = spec.script;
  if (!script) {
    const phaseOf = (t: number) => (legacyPhases.find((p) => t >= p.from && t < p.to) ?? legacyPhases[legacyPhases.length - 1]!).id;
    return {
      duration: LEGACY_MS / 1000,
      at: (t) => {
        const tl = timeline(t);
        return { ...tl, mix: tl.m, step: tl.m > 0 && tl.m < 1 ? 0 : -1, markStep: 0, phase: phaseOf(t) };
      },
      phases: legacyPhases.map((p) => ({ id: p.id, from: p.from, to: p.to })),
      steps: [],
    };
  }
  const ks = keys ?? scriptKeys(script);
  const S = segments(script);
  // Tiempos en segundos.
  const spans: { s: number; m: number; e: number; step: Step }[] = [];
  let t = SETUP;
  for (const st of script.steps) {
    const dur = st.dur ?? STEP_DUR;
    const hold = st.hold ?? STEP_HOLD;
    // (El final de un paso es exactamente el principio del siguiente: sumar en otro orden deja huecos de redondeo.)
    const e = t + dur + hold;
    spans.push({ s: t, m: t + dur, e, step: st });
    t = e;
  }
  const moveEnd = t;
  const lookEnd = moveEnd + (script.look ?? LOOK);
  const backEnd = lookEnd + BACK;
  const leaveEnd = backEnd + LEAVE;
  const total = leaveEnd + END;
  const painFrom = Math.min(...spans.filter((x) => x.step.pain).map((x) => x.s), moveEnd - 0.3);
  const painTo = spans.find((x) => x.step.painEnd && x.s > painFrom)?.s ?? lookEnd - 0.1;
  const released = spans.flatMap((sp) => (sp.step.release ?? []).map((hand) => ({ hand, at: sp.s })));
  const fade = (x: number, a: number, b: number, w = 0.25) => Math.max(0, Math.min(1, (x - a + w) / w, (b + w - x) / w));
  const at = (tt: number): Moment => {
    const x = ((tt % 1) + 1) % 1 * total;
    let u = 0;
    let step = -1;
    let markStep = -1;
    let arrows = 0;
    if (x >= SETUP && x < moveEnd) {
      const i = spans.findIndex((sp) => x < sp.e);
      const sp = spans[i]!;
      step = markStep = i;
      u = (i + minJerk((x - sp.s) / (sp.m - sp.s))) / S;
      // Las marcas de cada paso, mientras dura (y su pausa); la del último sigue durante «qué buscar».
      arrows = fade(x, sp.s, i === spans.length - 1 ? lookEnd - 0.3 : sp.e - 0.05, 0.2);
    } else if (x >= moveEnd && x < lookEnd) {
      u = (S - 1) / S;
      markStep = spans.length - 1;
      arrows = fade(x, moveEnd - 1, lookEnd - 0.3, 0.25);
    } else if (x >= lookEnd && x < backEnd) {
      u = (S - 1 + minJerk((x - lookEnd) / BACK)) / S;
    } else if (x >= backEnd) u = 1;
    const reach = x < SETUP ? smooth((x - 0.25) / (SETUP - 0.45)) : x < backEnd ? 1 : 1 - smooth((x - backEnd) / LEAVE);
    const pain = fade(x, painFrom, painTo, 0.3);
    const phase: PhaseId = x < SETUP ? "setup" : x < moveEnd ? "move" : x < lookEnd ? "look" : "back";
    // Una mano que suelta se separa al empezar su paso y vuelve a la toma al empezar la vuelta.
    const hands = released.length
      ? [0, 1].map((h) => {
          const r = released.find((x) => x.hand === h);
          if (!r || x < r.at) return reach;
          const away = 1 - smooth((x - r.at) / 0.45);
          return x < lookEnd ? away * reach : Math.min(reach, smooth((x - lookEnd) / 0.5));
        })
      : undefined;
    return { m: u, mix: mixAt(ks, u), reach, arrows, pain, pulse: 0.5 + 0.5 * Math.sin(x * Math.PI * 2 * 1.1), step, markStep, phase, ...(hands ? { hands } : {}) };
  };
  return {
    duration: total,
    at,
    phases: [
      { id: "setup", from: 0, to: SETUP / total },
      { id: "move", from: SETUP / total, to: moveEnd / total },
      { id: "look", from: moveEnd / total, to: lookEnd / total },
      { id: "back", from: lookEnd / total, to: 1 },
    ],
    steps: spans.map((sp) => ({ from: sp.s / total, to: sp.e / total, moveTo: sp.m / total })),
  };
}

/** Instantes que conviene revisar de una figura: toda la vuelta cada `step` y los extremos de cada paso. */
export function sampleTimes(clock: Clock, step = 0.025): number[] {
  const ts = new Set<number>();
  for (let t = 0; t < 1 - 1e-9; t += step) ts.add(+t.toFixed(4));
  for (const sp of clock.steps) {
    ts.add(+sp.moveTo.toFixed(4));
    ts.add(+((sp.from + sp.moveTo) / 2).toFixed(4));
  }
  return [...ts].sort((a, b) => a - b);
}
