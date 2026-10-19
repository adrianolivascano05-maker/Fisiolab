// Simetría entre lados con lo que ya mide la app: salto a una pierna, 5-0-5 girando con cada pierna y movilidad
// de cada lado. Índice de simetría (LSI) = lado peor / lado mejor × 100, con la última medición de cada lado.
import { fmt } from "../app/format";
import { getMovement, movementLabel } from "../calc/rom";
import type { TestSummary } from "../data/repo";

/** Referencia que se dibuja en las barras (la habitual en los criterios de vuelta al deporte). */
export const LSI_REFERENCE = 90;

export type SideValue = { value: number; text: string; at: string; testId: string };
export type SymmetryRow = { title: string; left: SideValue; right: SideValue; lsi: number; weaker: "left" | "right" | "equal"; lowerIsBetter: boolean };

type Spec = { key: (t: TestSummary) => string | null; title: (key: string) => string; value: (t: TestSummary) => number | null; text: (v: number) => string; lowerIsBetter: boolean };

const specs: Spec[] = [
  { key: (t) => (t.type === "single_leg" ? "single_leg" : null), title: () => "CMJ a una pierna", value: (t) => t.heightCm, text: (v) => `${fmt(v)} cm`, lowerIsBetter: false },
  { key: (t) => (t.type === "cod_505" ? "cod_505" : null), title: () => "5-0-5 (girando con cada pierna)", value: (t) => t.timeS, text: (v) => `${fmt(v, 2)} s`, lowerIsBetter: true },
  {
    key: (t) => (t.movement && getMovement(t.movement)?.sided ? `rom:${t.movement}` : null),
    title: (k) => movementLabel(getMovement(k.slice(4))!),
    value: (t) => t.angleDeg,
    text: (v) => `${fmt(v, 0)}°`,
    lowerIsBetter: false,
  },
];

/** Una fila por medición que tiene los dos lados medidos. */
export function symmetryRows(tests: TestSummary[]): SymmetryRow[] {
  const rows: SymmetryRow[] = [];
  for (const spec of specs) {
    const latest = new Map<string, { left?: SideValue; right?: SideValue }>();
    // `tests` viene de la más reciente a la más antigua: el primero de cada lado es el último medido.
    for (const t of tests) {
      const k = spec.key(t);
      const v = spec.value(t);
      if (!k || !t.side || v === null || !(v > 0)) continue;
      const e = latest.get(k) ?? {};
      if (!e[t.side]) e[t.side] = { value: v, text: spec.text(v), at: t.performedAt, testId: t.id };
      latest.set(k, e);
    }
    for (const [k, { left, right }] of latest) {
      if (!left || !right) continue;
      const lsi = (Math.min(left.value, right.value) / Math.max(left.value, right.value)) * 100;
      const weaker = left.value === right.value ? "equal" : spec.lowerIsBetter === left.value > right.value ? "left" : "right";
      rows.push({ title: spec.title(k), left, right, lsi, weaker, lowerIsBetter: spec.lowerIsBetter });
    }
  }
  return rows;
}
