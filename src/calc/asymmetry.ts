/** Asimetría entre piernas: (mejor − peor) / mejor · 100, y qué lado rinde menos. */
export function asymmetry(left: number, right: number): { pct: number; weaker: "left" | "right" | "equal" } {
  if (!(left > 0) || !(right > 0)) throw new RangeError("Hacen falta los dos lados");
  const best = Math.max(left, right);
  const pct = ((best - Math.min(left, right)) / best) * 100;
  return { pct, weaker: left === right ? "equal" : left < right ? "left" : "right" };
}
