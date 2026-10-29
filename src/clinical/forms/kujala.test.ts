import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form } from "./kujala";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
/** La opción n-ésima de cada apartado (0 = la mejor; si el apartado tiene menos, la última). */
const nth = (n: number): Answers => Object.fromEntries(items.map((it) => [it.id, it.options![Math.min(n, it.options!.length - 1)].value]));

describe("Kujala / AKPS", () => {
  it("13 apartados con los puntos del original", () => {
    expect(ids).toHaveLength(13);
    expect(new Set(ids).size).toBe(13);
    expect(items.map((it) => it.options!.map((o) => o.value))).toEqual([
      [5, 3, 0],
      [5, 3, 0],
      [5, 3, 2, 0],
      [10, 8, 5, 0],
      [5, 4, 3, 2, 0],
      [10, 8, 6, 3, 0],
      [10, 7, 2, 0],
      [10, 8, 6, 4, 0],
      [10, 8, 6, 3, 0],
      [10, 8, 6, 4, 0],
      [10, 6, 4, 2, 0],
      [5, 3, 0],
      [5, 3, 0],
    ]);
  });
  it("la mejor opción en todo → 100; la peor en todo → 0", () => {
    expect(form.score(nth(0)).score).toBe(100);
    expect(form.score(nth(9)).score).toBe(0);
  });
  it("caso mixto: la segunda opción en todo → 3+3+3+8+4+8+7+8+8+8+6+3+3 = 72", () => {
    const r = form.score(nth(1));
    expect(r.score).toBe(72);
  });
  it("si falta algún apartado no calcula (no hay prorrateo publicado)", () => {
    const a = nth(0);
    delete a.i13;
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 13/);
    expect(() => form.score({})).toThrow(RangeError);
  });
  it("la fuente lleva las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("kujala")!.refs!)).toBe(true);
  });
});
