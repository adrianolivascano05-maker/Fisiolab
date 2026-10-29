import { describe, expect, it } from "vitest";
import { form } from "./dass21";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const D = [3, 5, 10, 13, 16, 17, 21];
const A = [2, 4, 7, 9, 15, 19, 20];
const E = [1, 6, 8, 11, 12, 14, 18];


describe("DASS-21", () => {
  it("21 ítems de 0 a 3, 7 por subescala", () => {
    expect(ids).toHaveLength(21);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3]);
    expect([...D, ...A, ...E].sort((x, y) => x - y)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
  });
  it("sin nota total: no me ha pasado en todo → 0 en cada subescala; mucho en todo → 42 en cada una", () => {
    expect(form.score(all(0))).toEqual({
      score: null,
      subscores: [
        { name: "Depresión", score: 0 },
        { name: "Ansiedad", score: 0 },
        { name: "Estrés", score: 0 },
      ],
    });
    const worst = form.score(all(3));
    expect(worst.subscores!.map((s) => s.score)).toEqual([42, 42, 42]);
  });
  it("caso mixto: cada frase vale su número módulo 4 → depresión 9 × 2 = 18, ansiedad 12 × 2 = 24, estrés 10 × 2 = 20", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = (i + 1) % 4));
    // Depresión (3, 5, 10, 13, 16, 17, 21): 3+1+2+1+0+1+1 = 9. Ansiedad (2, 4, 7, 9, 15, 19, 20): 2+0+3+1+3+3+0 = 12.
    // Estrés (1, 6, 8, 11, 12, 14, 18): 1+2+0+3+0+2+2 = 10.
    expect(form.score(a)).toEqual({
      score: null,
      subscores: [
        { name: "Depresión", score: 18 },
        { name: "Ansiedad", score: 24 },
        { name: "Estrés", score: 20 },
      ],
    });
  });
  it("si falta una frase de una subescala, esa subescala no se calcula", () => {
    const a = all(1);
    delete a.i13; // depresión
    expect(form.score(a)).toEqual({
      score: null,
      subscores: [
        { name: "Ansiedad", score: 14 },
        { name: "Estrés", score: 14 },
      ],
    });
  });
  it("sin ninguna subescala completa no calcula", () => {
    const a = all(2);
    delete a.i3;
    delete a.i2;
    delete a.i1;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 3 de las 21/);
    expect(() => form.score({})).toThrow(/Faltan 21 de las 21/);
  });
});
