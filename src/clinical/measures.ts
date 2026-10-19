// El dato principal de cada medición (el que se ve en la lista) y su serie por tipo, para las tarjetas
// visuales del resumen.
import { fmt, testTitle } from "../app/format";
import type { TestSummary } from "../data/repo";

export type MainValue = { value: number; text: string; unit: string; prefix?: string };

/** Lo que resume una medición: altura, tiempo, ángulo, velocidad… o null si aún no está marcada. */
export function mainValue(t: TestSummary): MainValue | null {
  const v = (value: number | null, digits: number, unit: string, prefix?: string): MainValue | null =>
    value === null ? null : { value, text: fmt(value, digits), unit, ...(prefix ? { prefix } : {}) };
  if (t.type === "sprint_linear" || t.type.startsWith("cod_")) return v(t.timeS, 2, "s");
  if (t.type === "running") return v(t.contactMs, 0, "ms", "contacto");
  if (t.type === "nordic") return v(t.angleDeg, 0, "°");
  if (t.type === "vbt") return v(t.barVelocity, 2, "m/s");
  if (t.movement !== null) return v(t.angleDeg, 0, "°");
  if (t.distanceCm !== null) return v(t.distanceCm, 0, "cm");
  if (t.type === "rj_10_5") return v(t.rsi, 2, "", "RSI");
  return v(t.heightCm, 1, "cm");
}

export type Trend = { title: string; latest: TestSummary; value: MainValue; previous: MainValue | null; series: number[]; count: number };

/** Una tarjeta por medición distinta (tipo, lado, movimiento o ejercicio), la más reciente primero. */
export function trends(tests: TestSummary[]): Trend[] {
  const groups = new Map<string, TestSummary[]>();
  for (const t of tests) {
    const key = testTitle(t);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const out: Trend[] = [];
  for (const [title, list] of groups) {
    const marked = list.filter((t) => mainValue(t) !== null);
    if (!marked.length) continue;
    const latest = marked[0]!;
    out.push({
      title,
      latest,
      value: mainValue(latest)!,
      previous: marked[1] ? mainValue(marked[1]) : null,
      series: marked.slice(0, 8).reverse().map((t) => mainValue(t)!.value),
      count: marked.length,
    });
  }
  return out.sort((a, b) => b.latest.performedAt.localeCompare(a.latest.performedAt));
}
