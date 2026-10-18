// Último repaso de la colocación del examinador, con la animación de verdad: si en algún instante algo se
// mete en otra cosa (lo que mide la auditoría) o una articulación pasa de su tope, se prueban pequeñas
// variantes de cada brazo (por dónde llega la mano, cómo gira y hacia dónde apunta el codo) y se queda la mejor. Cuesta unos segundos por
// figura: lo usa la tabla precalculada (scripts/gallery3d-plans.mjs), no la escena.
import type { FigureSpec } from "../figure";
import { figureFaults } from "./audit";
import { nudgePlan, type ArmPlan, type ExaminerPlan } from "./examiner";
import type { Layout } from "./layout";

/**
 * Cuánto falla una colocación a lo largo de la animación: cm de lo que se mete en algo y grados de lo que las
 * articulaciones de los brazos pasan de sus topes (10° cuentan como 1 cm).
 */
export function planScore(spec: FigureSpec, L: Layout, plan: ExaminerPlan): number {
  const { issues, joints } = figureFaults(spec, L, plan);
  return issues.reduce((a, is) => a + is.depth, 0) + [...joints.values()].reduce((a, d) => a + d / 10, 0);
}

const withArm = (plan: ExaminerPlan, i: number, arm: ArmPlan): ExaminerPlan => {
  const arms = plan.arms.map((a, k) => (k === i ? arm : a));
  return { ...plan, arms, ...(plan.alt ? { alt: { ...plan.alt, arms } } : {}) };
};

/** Variantes de un brazo: por dónde llega la mano, el codo girado, la mano girada (o abarcando por el otro lado) y la
 *  toma algo desplazada a lo largo del segmento. */
function variants(arm: ArmPlan): ArmPlan[][] {
  const turn = (d: number) => ({ ...arm, pole: arm.pole.map((p) => p + d) });
  const spin = (d: number) => ({ ...arm, spin: arm.spin + d, ...(arm.spin1 !== undefined ? { spin1: arm.spin1 + d } : {}) });
  const flip = (): ArmPlan => ({ ...arm, ...(arm.wrap !== undefined ? { wrap: arm.wrap + 180 } : {}), ...(arm.wrap1 !== undefined ? { wrap1: arm.wrap1 + 180 } : {}) });
  const slide = (d: number) => ({ ...arm, slide: (arm.slide ?? 0) + d });
  // Al final de la maniobra, la mano algo girada respecto al principio (va rodando sobre el segmento, como al
  // acompañar un giro grande del brazo o la pierna del paciente); si ya lo estaba, más parecida a la del principio.
  const s1 = arm.spin1 ?? arm.spin;
  const end: ArmPlan[] = [
    ...(arm.spin1 !== undefined ? [{ ...arm, spin1: arm.spin, ...(arm.wrap !== undefined ? { wrap1: arm.wrap } : {}) }] : []),
    ...[-60, -30, 30, 60].map((d) => ({ ...arm, spin1: s1 + d, ...(arm.wrap !== undefined ? { wrap1: (arm.wrap1 ?? arm.wrap) + d } : {}) })),
  ];
  return [
    [0, 1, 2, 3, 4, 5, 6, 7].filter((ap) => ap !== (arm.ap ?? 0)).map((ap) => ({ ...arm, ap })),
    [-60, -30, -15, 15, 30, 60].map(turn),
    [-90, -60, -30, 30, 60, 90].map(spin).concat(arm.wrap !== undefined ? [flip()] : []),
    [-3, 3, -6, 6, -9, 9, -12, 12].map(slide),
    end,
  ];
}

export function polishPlan(spec: FigureSpec, L: Layout, plan: ExaminerPlan): ExaminerPlan {
  let best = plan;
  let score = planScore(spec, L, plan);
  for (let round = 0; round < 3 && score > 0; round++) {
    let improved = false;
    for (let i = 0; i < best.arms.length && score > 0; i++) {
      for (let g = 0; g < 5; g++) {
        // Cada grupo, a partir del brazo como haya quedado con los anteriores.
        for (const v of variants(best.arms[i]!)[g]!) {
          const cand = withArm(best, i, v);
          const sc = planScore(spec, L, cand);
          if (sc < score - 0.05) {
            best = cand;
            score = sc;
            improved = true;
          }
        }
      }
    }
    // El examinador entero, algo más cerca, lejos o a un lado, más o menos inclinado o con la cabeza más alta.
    if (!best.alt && score > 0) {
      for (const [f, r, l, n] of [[-5, 0, 0, 0], [5, 0, 0, 0], [0, -5, 0, 0], [0, 5, 0, 0], [0, 0, -5, 0], [0, 0, 5, 0], [-8, 0, 5, 0], [-8, 0, -5, 0], [0, 0, 0, -15], [0, 0, 0, -30], [-8, 0, 0, -20]] as const) {
        const cand = nudgePlan(best, f, r, l, n);
        const sc = planScore(spec, L, cand);
        if (sc < score - 0.05) {
          best = cand;
          score = sc;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return best;
}
