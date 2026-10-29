import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form } from "./lysholm";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
/** La opción n-ésima de cada apartado (0 = la mejor; si el apartado tiene menos, la última). */
const nth = (n: number): Answers => Object.fromEntries(items.map((it) => [it.id, it.options![Math.min(n, it.options!.length - 1)].value]));

describe("Lysholm", () => {
  it("8 apartados con sus pesos: cojera 5, apoyo 5, bloqueo 15, inestabilidad 25, dolor 25, hinchazón 10, escaleras 10, cuclillas 5", () => {
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    expect(items.map((it) => it.options!.map((o) => o.value))).toEqual([
      [5, 3, 0],
      [5, 2, 0],
      [15, 10, 6, 2, 0],
      [25, 20, 15, 10, 5, 0],
      [25, 20, 15, 10, 5, 0],
      [10, 6, 2, 0],
      [10, 6, 2, 0],
      [5, 4, 2, 0],
    ]);
  });
  it("la mejor opción en todo → 100; la peor en todo → 0", () => {
    expect(form.score(nth(0)).score).toBe(100);
    expect(form.score(nth(9)).score).toBe(0);
  });
  it("caso mixto: la segunda opción en todo → 3+2+10+20+20+6+6+4 = 71, sin categorías", () => {
    const r = form.score(nth(1));
    expect(r.score).toBe(71);
  });
  it("si falta algún apartado no calcula (sin prorrateo)", () => {
    const a = nth(0);
    delete a.i4;
    delete a.i8;
    expect(() => form.score(a)).toThrow(/Faltan 2 de las 8/);
  });
  it("la fuente lleva las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("lysholm")!.refs!)).toBe(true);
  });
});
