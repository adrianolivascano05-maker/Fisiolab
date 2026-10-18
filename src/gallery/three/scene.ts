// Las dos personas en un instante de la animación: el paciente en su momento de la maniobra y el
// examinador con las manos en su sitio. Puro (sin WebGL): lo usan la escena 3D, las pruebas y la auditoría
// de choques, así que lo que se comprueba es exactamente lo que se ve.
import type { FigureSpec } from "../figure";
import { baseExaminerPose, contacts, examinerPose, type Contact, type ExaminerPlan } from "./examiner";
import { patientPose, type Layout } from "./layout";
import type { Pose3, Side } from "./rig";

/** Instante de la animación: momento de la maniobra (m), manos llegando (reach) y empuje de las fuerzas. */
export type Moment = { m: number; reach: number; arrows: number };

export function scenePoses(spec: FigureSpec, L: Layout, plan: ExaminerPlan | null, tl: Moment): { pat: Pose3; ex: Pose3 | null; cts: Contact[]; gaps: Partial<Record<Side, number>> } {
  const pat = patientPose(L, tl.m, tl.arrows);
  const gaps: Partial<Record<Side, number>> = {};
  if (!plan) return { pat, ex: null, cts: contacts(spec, pat, null, null), gaps };
  const cts = contacts(spec, pat, baseExaminerPose(plan, tl.m), plan);
  const ex = examinerPose(plan, cts, tl.reach, tl.m, pat, gaps);
  return { pat, ex, cts, gaps };
}
