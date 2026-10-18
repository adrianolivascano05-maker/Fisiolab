// Nombres clínicos de lo que hace un guion (convenio de three/CONVENIO.md): etiquetas cortas para las flechas
// («RI 35°», «Rotación derecha 55°») y frases con grados para el texto bajo la figura. Se escriben solas a
// partir de los ángulos, así que no pueden contradecir a la animación. Puro.
import type { BodyKey, BodyPose, FigureSpec, Joint3D } from "./figure";
import type { Key } from "./script";

type Dof = keyof Joint3D;

const JOINT: Record<string, string> = {
  pelvis: "pelvis",
  trunk: "tronco",
  neck: "cuello",
  jaw: "mandíbula",
  shoulder: "hombro",
  elbow: "codo",
  wrist: "muñeca",
  hip: "cadera",
  knee: "rodilla",
  ankle: "tobillo",
};

/** Nombre del movimiento en el sentido del signo (+ o −) de cada grado de libertad. */
function motion(joint: string, dof: Dof, sign: number, short: boolean): string {
  const axial = joint === "trunk" || joint === "neck" || joint === "pelvis";
  const pick = (pos: string, neg: string) => (sign >= 0 ? pos : neg);
  switch (dof) {
    case "flex":
      if (joint === "ankle") return pick("Flexión dorsal", "Flexión plantar");
      if (joint === "wrist") return pick("Flexión palmar", "Extensión");
      if (joint === "pelvis") return pick("Anteversión", "Retroversión");
      if (joint === "jaw") return "Apertura";
      return pick("Flexión", "Extensión");
    case "abd":
      if (joint === "wrist") return pick(short ? "Desv. radial" : "Desviación radial", short ? "Desv. cubital" : "Desviación cubital");
      if (joint === "knee" || joint === "elbow") return pick("Valgo", "Varo");
      return pick("Abducción", "Aducción");
    case "rot":
      if (axial) return pick("Rotación derecha", "Rotación izquierda");
      return short ? pick("RI", "RE") : pick("Rotación interna", "Rotación externa");
    case "lat":
      if (joint === "pelvis") return pick("Desciende la pelvis derecha", "Desciende la pelvis izquierda");
      return pick(short ? "Inclinación der." : "Inclinación a la derecha", short ? "Inclinación izq." : "Inclinación a la izquierda");
    case "pron":
      return pick("Pronación", "Supinación");
    case "inv":
      return pick("Inversión", "Eversión");
  }
}

const sideName = (s: string) => (s === "r" ? "derecha" : "izquierda");
const sideShort = (s: string) => (s === "r" ? "D" : "I");

/** «cadera derecha», «cuello». */
export function jointName(k: BodyKey): string {
  const m = k.match(/^(r|l)_(\w+)$/);
  if (!m) return JOINT[k] ?? k;
  const j = JOINT[m[2]!] ?? m[2]!;
  // Concordancia: «codo derecho», «hombro derecho»… y «cadera derecha», «muñeca derecha»…
  const fem = j === "cadera" || j === "rodilla" || j === "muñeca";
  return `${j} ${fem ? sideName(m[1]!) : m[1] === "r" ? "derecho" : "izquierdo"}`;
}

/** Lo que cambia de una pose a otra (grados de libertad que se mueven más de 2°), ordenado de más a menos. */
export function changes(a: BodyPose, b: BodyPose): { joint: BodyKey; dof: Dof; from: number; to: number }[] {
  const out: { joint: BodyKey; dof: Dof; from: number; to: number }[] = [];
  for (const [k, jb] of Object.entries(b) as [BodyKey, Joint3D][]) {
    const ja = a[k] ?? {};
    for (const [d, v] of Object.entries(jb) as [Dof, number][]) {
      const v0 = ja[d] ?? v;
      if (Math.abs(v - v0) > 2) out.push({ joint: k, dof: d, from: v0, to: v });
    }
  }
  return out.sort((x, y) => Math.abs(y.to - y.from) - Math.abs(x.to - x.from));
}

const deg = (v: number) => `${Math.round(Math.abs(v))}°`;

/**
 * Un cambio en pocas palabras. Si el movimiento se aleja de la posición de referencia, el ángulo final
 * («RI 35°»); si vuelve hacia ella o la cruza, hasta dónde llega («Extensión hasta 90° de flexión»).
 */
export function changeText(c: { joint: BodyKey; dof: Dof; from: number; to: number }, short = true): string {
  const joint = c.joint.replace(/^[rl]_/, "");
  const dir = Math.sign(c.to - c.from);
  const name = motion(joint, c.dof, dir, short);
  if (c.dof === "flex" && joint === "jaw") return `${name} ${deg(c.to)}`;
  if (Math.abs(c.to) < 1) return `${name} hasta 0°`;
  if (Math.sign(c.to) === dir) return Math.sign(c.from) === -dir && Math.abs(c.from) >= 1 ? `${name} hasta ${deg(c.to)}` : `${name} ${deg(c.to)}`;
  return `${name} hasta ${deg(c.to)} de ${motion(joint, c.dof, Math.sign(c.to), short).toLowerCase()}`;
}

/** Etiqueta de la flecha de recorrido de un paso (la del guion o la que sale de los ángulos). */
export function stepLabel(spec: FigureSpec, keys: Key[], i: number): string {
  const st = spec.script?.steps[i];
  if (st?.label) return st.label;
  const ch = changes(keys[i]!.pose, keys[i + 1]!.pose);
  // (Sin repetir: cadera y rodilla que se extienden hasta 0° son una sola «Extensión hasta 0°».)
  const texts = [...new Set(ch.map((c) => changeText(c)))].slice(0, 2);
  const first = ch.filter((c, k) => ch.findIndex((x) => changeText(x) === changeText(c)) === k).slice(0, 2);
  // Si son de dos articulaciones, se dice de cuál es cada una («Rodilla: flexión 120° · cadera: flexión 115°»).
  if (first.length === 2 && first[0]!.joint.replace(/^[rl]_/, "") !== first[1]!.joint.replace(/^[rl]_/, "")) {
    const named = first.map((c) => `${JOINT[c.joint.replace(/^[rl]_/, "")] ?? c.joint}: ${changeText(c).toLowerCase()}`);
    return `${named[0]![0]!.toUpperCase()}${named[0]!.slice(1)} · ${named[1]}`;
  }
  return texts.join(" + ");
}

/** Línea técnica de un paso con todas las articulaciones que cambian: «Cadera derecha: aducción 15°». */
export function stepTechnical(keys: Key[], i: number): string {
  const ch = changes(keys[i]!.pose, keys[i + 1]!.pose);
  const by = new Map<BodyKey, string[]>();
  for (const c of ch) by.set(c.joint, [...(by.get(c.joint) ?? []), changeText(c, false).toLowerCase()]);
  const parts = [...by].map(([k, v]) => {
    const n = jointName(k);
    return `${n[0]!.toUpperCase()}${n.slice(1)}: ${v.join(", ")}`;
  });
  const sh = keys[i + 1]!.shift;
  const sh0 = keys[i]!.shift;
  if (sh && (!sh0 || sh0.cm !== sh.cm)) parts.push(`desplazamiento ${SEG[sh.seg.slice(2)] ?? sh.seg} ${DIR[sh.dir]} ${String(sh.cm).replace(".", ",")} cm`);
  if (!sh && sh0) parts.push("se suelta el desplazamiento");
  const line = parts.join(" · ");
  return line && line[0]!.toUpperCase() + line.slice(1);
}

const SEG: Record<string, string> = { upperarm: "del brazo", forearm: "del antebrazo", hand: "de la mano", thigh: "del muslo", shank: "de la tibia", foot: "del pie" };
const DIR: Record<string, string> = { anterior: "hacia delante", posterior: "hacia atrás", cranial: "hacia la cabeza", caudal: "hacia los pies", medial: "hacia dentro", lateral: "hacia fuera" };

/** «Lado derecho», «Lado izquierdo», «Bilateral». */
export const sideLabel = (side: "r" | "l" | "both") => (side === "both" ? "Bilateral" : `Lado ${side === "r" ? "derecho" : "izquierdo"}`);
export const sideLetter = (side: "r" | "l" | "both") => (side === "both" ? "D+I" : sideShort(side));

/** El mismo texto para el otro lado: derecha ↔ izquierda (para ver el test en espejo). */
export function mirrorText(s: string): string {
  const swap: Record<string, string> = { derecha: "izquierda", izquierda: "derecha", derecho: "izquierdo", izquierdo: "derecho", derechas: "izquierdas", izquierdas: "derechas", derechos: "izquierdos", izquierdos: "derechos", der: "izq", izq: "der" };
  return s.replace(/\b(derech[ao]s?|izquierd[ao]s?|der|izq)\b/gi, (w) => {
    const r = swap[w.toLowerCase()] ?? w;
    return w[0] === w[0]!.toUpperCase() ? r[0]!.toUpperCase() + r.slice(1) : r;
  });
}

/** Lo que afirma una etiqueta escrita a mano: qué grado de libertad y en qué sentido (convenio). */
export type Claim = { dof: Dof; sign: number; axial?: boolean; what: string };
export function labelClaims(label: string): Claim[] {
  const out: Claim[] = [];
  const has = (re: RegExp) => re.test(label);
  if (has(/\bRI\b|rotaci[oó]n interna/i)) out.push({ dof: "rot", sign: 1, what: "rotación interna" });
  if (has(/\bRE\b|rotaci[oó]n externa/i)) out.push({ dof: "rot", sign: -1, what: "rotación externa" });
  if (has(/rotaci[oó]n (a la )?derecha|gira a la derecha/i)) out.push({ dof: "rot", sign: 1, axial: true, what: "giro a la derecha" });
  if (has(/rotaci[oó]n (a la )?izquierda|gira a la izquierda/i)) out.push({ dof: "rot", sign: -1, axial: true, what: "giro a la izquierda" });
  if (has(/pronaci[oó]n/i)) out.push({ dof: "pron", sign: 1, what: "pronación" });
  if (has(/supinaci[oó]n/i)) out.push({ dof: "pron", sign: -1, what: "supinación" });
  if (has(/inversi[oó]n/i)) out.push({ dof: "inv", sign: 1, what: "inversión" });
  if (has(/eversi[oó]n/i)) out.push({ dof: "inv", sign: -1, what: "eversión" });
  if (has(/\babducci[oó]n/i)) out.push({ dof: "abd", sign: 1, what: "abducción" });
  if (has(/\baducci[oó]n/i)) out.push({ dof: "abd", sign: -1, what: "aducción" });
  if (has(/\bvalgo\b/i)) out.push({ dof: "abd", sign: 1, what: "valgo" });
  if (has(/\bvaro\b/i)) out.push({ dof: "abd", sign: -1, what: "varo" });
  if (has(/flexi[oó]n dorsal/i)) out.push({ dof: "flex", sign: 1, what: "flexión dorsal" });
  else if (has(/flexi[oó]n plantar/i)) out.push({ dof: "flex", sign: -1, what: "flexión plantar" });
  else if (has(/\bextensi[oó]n|\bextiende/i)) out.push({ dof: "flex", sign: -1, what: "extensión" });
  else if (has(/\bflexi[oó]n|\bflexiona/i)) out.push({ dof: "flex", sign: 1, what: "flexión" });
  return out;
}

/** Lo que una etiqueta afirma y el paso no hace (vacío si todo cuadra). */
export function labelMismatches(label: string, ch: { joint: BodyKey; dof: Dof; from: number; to: number }[]): string[] {
  const axial = (k: BodyKey) => k === "neck" || k === "trunk" || k === "pelvis";
  return labelClaims(label)
    .filter((c) => !ch.some((x) => x.dof === c.dof && Math.sign(x.to - x.from) === c.sign && (c.dof !== "rot" || axial(x.joint) === !!c.axial)))
    .map((c) => `«${label}» dice ${c.what} y el paso no la hace`);
}
