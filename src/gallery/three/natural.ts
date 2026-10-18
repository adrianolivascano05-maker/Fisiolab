// Capa «natural»: lo que hace que las personas parezcan vivas sin cambiar la maniobra. Respiración (solo la
// piel del tronco, no el esqueleto), el examinador mirando a sus manos y los dedos que no hacen nada con algo
// de vida. Nunca toca las articulaciones del paciente (lo comprueba una prueba: con la capa activada y sin
// ella, los ángulos del paciente son idénticos en todos los instantes). Se puede desactivar.
import { Quaternion, Vector3 } from "three";
import { HAND_REST_CURL, type Pose3 } from "./rig";

export type Natural = {
  /** Respiración (0-1) del paciente y del examinador (desfasadas). */
  breath: { patient: number; examiner: number };
};

/** Capa natural en el segundo `sec` de la animación (la misma en cada vuelta, sin azar). */
export function naturalAt(sec: number): Natural {
  const b = (period: number, phase: number) => 0.5 - 0.5 * Math.cos(((sec + phase) / period) * Math.PI * 2);
  return { breath: { patient: b(4.2, 0), examiner: b(3.8, 1.3) } };
}

/**
 * Aplica la capa natural a las poses de un instante. El paciente solo cambia en lo que no es una articulación
 * medida (la curvatura de los dedos de las manos que no hacen nada); el examinador, además, mira a sus manos.
 * Devuelve poses nuevas (no cambia las que recibe).
 */
export function applyNatural(pat: Pose3, ex: Pose3 | null, sec: number, contacts: Vector3[]): { pat: Pose3; ex: Pose3 | null } {
  const p2: Pose3 = { ...pat, hands: { ...pat.hands } };
  // Dedos relajados del paciente con un leve vaivén (cada mano a su ritmo).
  for (const s of ["r", "l"] as const) {
    if (pat.hands?.[s]) continue;
    const k = Math.sin(sec * (s === "r" ? 0.9 : 0.7) + (s === "r" ? 0 : 2)) * 1.2;
    p2.hands![s] = { curl: HAND_REST_CURL - 3 + k, grip: "rest" };
  }
  if (!ex || !contacts.length) return { pat: p2, ex };
  // El examinador mira hacia sus manos (como mucho 28° más de lo que ya mira), con la cabeza y algo el cuello.
  const target = contacts.reduce((a, c) => a.add(c), new Vector3()).multiplyScalar(1 / contacts.length);
  const fwd = new Vector3(0, 0, 1).applyQuaternion(ex.head.q);
  const want = target.clone().sub(ex.head.p).normalize();
  const turn = new Quaternion().setFromUnitVectors(fwd, want);
  const ang = 2 * Math.acos(Math.min(1, Math.abs(turn.w)));
  const lim = (28 * Math.PI) / 180;
  const k = ang > lim ? lim / ang : 1;
  const part = new Quaternion().slerp(turn, k);
  const headQ = part.clone().multiply(ex.head.q);
  // La cabeza gira alrededor de la base del cuello.
  const head = ex.head.p.clone().sub(ex.neck.p).applyQuaternion(part).add(ex.neck.p);
  return { pat: p2, ex: { ...ex, head: { p: head, q: headQ }, neck: { p: ex.neck.p, q: new Quaternion().slerp(part, 0.5).multiply(ex.neck.q) } } };
}
