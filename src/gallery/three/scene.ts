// Las dos personas en un instante de la animación: el paciente en su pose y el examinador con las manos en
// sus tomas. Lo usan la escena, las pruebas y la búsqueda de la colocación (que todos vean lo mismo).
import type { FigureSpec } from "../figure";
import type { Moment as ClockMoment } from "../script";
import { baseExaminerPose, contacts, examinerPose, type Contact, type ExaminerPlan } from "./examiner";
import { patientPose, type Layout } from "./layout";
import type { Pose3, Side } from "./rig";

/** Instante de la animación: progreso de la maniobra (m), cuánto se ha alejado de la partida (mix), manos
 *  llegando (reach) y empuje de las fuerzas (arrows, solo en las figuras sin guion). */
export type Moment = Pick<ClockMoment, "m" | "reach" | "arrows"> & { mix?: number; hands?: number[] };

export function scenePoses(spec: FigureSpec, L: Layout, plan: ExaminerPlan | null, tl: Moment): { pat: Pose3; ex: Pose3 | null; cts: Contact[]; gaps: Partial<Record<Side, number>> } {
  const pat = patientPose(L, tl.m, tl.arrows);
  const gaps: Partial<Record<Side, number>> = {};
  if (!plan) return { pat, ex: null, cts: contacts(spec, pat, null, null), gaps };
  const mix = tl.mix ?? tl.m;
  const cts = contacts(spec, pat, baseExaminerPose(plan, mix), plan);
  const ex = examinerPose(plan, cts, tl.reach, tl.m, pat, gaps, mix, tl.hands);
  return { pat, ex, cts, gaps };
}
