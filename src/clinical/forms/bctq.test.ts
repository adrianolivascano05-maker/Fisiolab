import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form } from "./bctq";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const SSS = "Gravedad de síntomas (SSS)";
const FSS = "Estado funcional (FSS)";

describe("BCTQ", () => {
  it("19 ítems de 1 a 5: 11 de síntomas y 8 de función", () => {
    expect(ids).toEqual(Array.from({ length: 19 }, (_, i) => `i${i + 1}`));
    expect(form.sections.map((s) => s.items.length)).toEqual([11, 8]);
    for (const i of items) expect(i.options!.map((o) => o.value)).toEqual([1, 2, 3, 4, 5]);
    expect(items[0].options![0].label).toBe("No tengo dolor por la noche");
    expect(items[18].options![4].label).toBe("No puedo hacerlo en absoluto por los síntomas de la mano o la muñeca");
  });
  it("las dos escalas se guardan aparte, con los nombres y el rango (1-5) del catálogo", () => {
    expect(getKind("bctq")).toMatchObject({ min: 1, max: 5, better: "lower", subscales: [SSS, FSS] });
  });
  it("sin nota total: todo a 1 → 1 y 1; todo a 5 → 5 y 5", () => {
    expect(form.score(all(1))).toEqual({
      score: null,
      subscores: [
        { name: SSS, score: 1 },
        { name: FSS, score: 1 },
      ],
    });
    expect(form.score(all(5)).subscores).toEqual([
      { name: SSS, score: 5 },
      { name: FSS, score: 5 },
    ]);
  });
  it("caso mixto: síntomas 1,2,3,4,5,1,2,3,4,5,1 = 31/11 = 2,8; función 2,2,3,3,4,4,5,5 = 28/8 = 3,5", () => {
    const a: Answers = {};
    for (let n = 1; n <= 11; n++) a[`i${n}`] = ((n - 1) % 5) + 1;
    [2, 2, 3, 3, 4, 4, 5, 5].forEach((v, i) => (a[`i${i + 12}`] = v));
    expect(form.score(a).subscores).toEqual([
      { name: SSS, score: 2.8 },
      { name: FSS, score: 3.5 },
    ]);
  });
  it("media de las respondidas con 9 de 11 y 7 de 8; con menos, esa escala no sale", () => {
    // Síntomas sin la 10 ni la 11: 1,2,3,4,5,1,2,3,4 = 25/9 = 2,8; función sin la 19: 2,2,3,3,4,4,5 = 23/7 = 3,3.
    const a: Answers = {};
    for (let n = 1; n <= 9; n++) a[`i${n}`] = ((n - 1) % 5) + 1;
    [2, 2, 3, 3, 4, 4, 5].forEach((v, i) => (a[`i${i + 12}`] = v));
    expect(form.score(a).subscores).toEqual([
      { name: SSS, score: 2.8 },
      { name: FSS, score: 3.3 },
    ]);
    const b: Answers = { ...all(3) };
    delete b.i1;
    delete b.i2;
    delete b.i3;
    expect(form.score(b).subscores).toEqual([{ name: FSS, score: 3 }]);
    const c: Answers = { ...all(2) };
    delete c.i12;
    delete c.i13;
    expect(form.score(c).subscores).toEqual([{ name: SSS, score: 2 }]);
  });
  it("si no se puede calcular ninguna de las dos escalas no calcula", () => {
    const a = all(3);
    for (const id of ["i1", "i2", "i3", "i12", "i13"]) delete a[id];
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score({})).toThrow(/Faltan respuestas/);
  });
});
