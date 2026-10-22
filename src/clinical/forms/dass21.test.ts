import { describe, expect, it } from "vitest";
import { form } from "./dass21";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const D = [3, 5, 10, 13, 16, 17, 21];
const A = [2, 4, 7, 9, 15, 19, 20];
const E = [1, 6, 8, 11, 12, 14, 18];
const PREFIX = "Orientativo, sin verificar (categorías del manual de los autores): ";

/** Todo a 0 salvo una subescala, cuyas frases suman `raw` (0-21): su nota es `raw` × 2. */
function only(ns: number[], raw: number): Answers {
  const a = all(0);
  let left = raw;
  for (const n of ns) {
    a[`i${n}`] = Math.min(3, left);
    left -= a[`i${n}`]!;
  }
  return a;
}
const textAt = (ns: number[], score: number) => form.score(only(ns, score / 2)).text;

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
      text: `${PREFIX}depresión normal · ansiedad normal · estrés normal`,
    });
    const worst = form.score(all(3));
    expect(worst.subscores!.map((s) => s.score)).toEqual([42, 42, 42]);
    expect(worst.text).toBe(`${PREFIX}depresión extremadamente grave · ansiedad extremadamente grave · estrés extremadamente grave`);
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
      text: `${PREFIX}depresión moderada · ansiedad extremadamente grave · estrés moderado`,
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
      text: `${PREFIX}ansiedad moderada · estrés normal`,
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
  it("categorías de depresión en sus límites (notas pares): 8, 10, 12, 14, 20, 22, 26 y 28", () => {
    expect(textAt(D, 8)).toMatch(/depresión normal ·/);
    expect(textAt(D, 10)).toMatch(/depresión leve ·/);
    expect(textAt(D, 12)).toMatch(/depresión leve ·/);
    expect(textAt(D, 14)).toMatch(/depresión moderada ·/);
    expect(textAt(D, 20)).toMatch(/depresión moderada ·/);
    expect(textAt(D, 22)).toMatch(/depresión grave ·/);
    expect(textAt(D, 26)).toMatch(/depresión grave ·/);
    expect(textAt(D, 28)).toMatch(/depresión extremadamente grave ·/);
  });
  it("categorías de ansiedad en sus límites: 6, 8, 10, 14, 16, 18 y 20", () => {
    expect(textAt(A, 6)).toMatch(/ansiedad normal ·/);
    expect(textAt(A, 8)).toMatch(/ansiedad leve ·/);
    expect(textAt(A, 10)).toMatch(/ansiedad moderada ·/);
    expect(textAt(A, 14)).toMatch(/ansiedad moderada ·/);
    expect(textAt(A, 16)).toMatch(/ansiedad grave ·/);
    expect(textAt(A, 18)).toMatch(/ansiedad grave ·/);
    expect(textAt(A, 20)).toMatch(/ansiedad extremadamente grave ·/);
  });
  it("categorías de estrés en sus límites: 14, 16, 18, 20, 24, 26, 32 y 34", () => {
    expect(textAt(E, 14)).toMatch(/estrés normal$/);
    expect(textAt(E, 16)).toMatch(/estrés leve$/);
    expect(textAt(E, 18)).toMatch(/estrés leve$/);
    expect(textAt(E, 20)).toMatch(/estrés moderado$/);
    expect(textAt(E, 24)).toMatch(/estrés moderado$/);
    expect(textAt(E, 26)).toMatch(/estrés grave$/);
    expect(textAt(E, 32)).toMatch(/estrés grave$/);
    expect(textAt(E, 34)).toMatch(/estrés extremadamente grave$/);
  });
});
