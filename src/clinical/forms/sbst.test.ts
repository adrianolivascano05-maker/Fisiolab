import { describe, expect, it } from "vitest";
import { form, points9 } from "./sbst";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const LOW = "Riesgo bajo (total de 0 a 3)";
const MEDIUM = "Riesgo medio (total de 4 o más y subescala psicosocial de 3 o menos)";
const HIGH = "Riesgo alto (total de 4 o más y subescala psicosocial de 4 o 5)";

/** Ítems 1-8 con su valor y el 9 con su respuesta (0-4). */
const make = (first8: number[], nine: number): Answers => ({ ...Object.fromEntries(first8.map((v, i) => [`i${i + 1}`, v])), i9: nine });

describe("SBST", () => {
  it("9 ítems: del 1 al 8, En desacuerdo = 0 y De acuerdo = 1; el 9 con cinco respuestas que puntúan 0, 0, 0, 1 y 1", () => {
    expect(ids).toEqual(["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8", "i9"]);
    for (const i of items.slice(0, 8)) expect(i.options).toEqual([
      { value: 0, label: "En desacuerdo" },
      { value: 1, label: "De acuerdo" },
    ]);
    expect(items[8].options!.map((o) => o.label)).toEqual(["Nada", "Un poco", "Moderadamente", "Mucho", "Muchísimo"]);
    expect(items[8].options!.map((o) => points9(o.value))).toEqual([0, 0, 0, 1, 1]);
  });
  it("todo en desacuerdo y «Nada» → 0, riesgo bajo; todo de acuerdo y «Muchísimo» → 9, psicosocial 5, riesgo alto", () => {
    expect(form.score(make([0, 0, 0, 0, 0, 0, 0, 0], 0))).toEqual({
      score: 0,
      subscores: [{ name: "Subescala psicosocial", score: 0, max: 5 }],
      text: LOW,
    });
    expect(form.score(make([1, 1, 1, 1, 1, 1, 1, 1], 4))).toEqual({
      score: 9,
      subscores: [{ name: "Subescala psicosocial", score: 5, max: 5 }],
      text: HIGH,
    });
  });
  it("«Moderadamente» en el 9 no puntúa; «Mucho» sí", () => {
    expect(form.score(make([0, 0, 0, 0, 0, 0, 0, 0], 2)).score).toBe(0);
    expect(form.score(make([0, 0, 0, 0, 0, 0, 0, 0], 3)).score).toBe(1);
  });
  it("caso mixto: de acuerdo con 1, 3, 4, 6 y 7 y «Mucho» en el 9 → total 6; psicosocial 6 + 7 + 9 = 3 → riesgo medio", () => {
    const r = form.score(make([1, 0, 1, 1, 0, 1, 1, 0], 3));
    expect(r.score).toBe(6);
    expect(r.subscores).toEqual([{ name: "Subescala psicosocial", score: 3, max: 5 }]);
    expect(r.text).toBe(MEDIUM);
  });
  it("tramos en su límite: total 3 es bajo aunque la psicosocial sea 3; total 4 con psicosocial 3 es medio y con 4, alto", () => {
    // Total 3, todo psicosocial (6, 7 y 8).
    expect(form.score(make([0, 0, 0, 0, 0, 1, 1, 1], 0))).toMatchObject({ score: 3, text: LOW });
    // Total 4: ítem 1 + psicosocial 3 (5, 6 y 7).
    expect(form.score(make([1, 0, 0, 0, 1, 1, 1, 0], 0))).toMatchObject({ score: 4, text: MEDIUM });
    // Total 4, todo psicosocial (5, 6, 7 y «Mucho» en el 9).
    expect(form.score(make([0, 0, 0, 0, 1, 1, 1, 0], 3))).toMatchObject({ score: 4, text: HIGH });
    // Total 7 con psicosocial 3 (5, 6 y 7): sigue siendo medio.
    expect(form.score(make([1, 1, 1, 1, 1, 1, 1, 0], 0))).toMatchObject({ score: 7, text: MEDIUM });
  });
  it("si falta algún ítem no calcula el riesgo", () => {
    const a = make([1, 0, 1, 1, 0, 1, 1, 0], 3);
    delete a.i9;
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 9/);
    delete a.i2;
    expect(() => form.score(a)).toThrow(/Faltan 2 de las 9/);
  });
});
