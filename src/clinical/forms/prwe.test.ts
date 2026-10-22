import { describe, expect, it } from "vitest";
import { form } from "./prwe";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("PRWE", () => {
  it("15 ítems de 0 a 10: 5 de dolor y 10 de función (6 específicas y 4 habituales), y solo los de función admiten «No aplica»", () => {
    expect(ids).toEqual(Array.from({ length: 15 }, (_, i) => `i${i + 1}`));
    expect(form.sections.map((s) => s.items.length)).toEqual([5, 6, 4]);
    for (const i of items) expect(i.scale).toMatchObject({ from: 0, to: 10 });
    expect(items.filter((i) => i.na).map((i) => i.id)).toEqual(ids.slice(5));
    expect(items[4].scale!.ends).toEqual(["Nunca", "Siempre"]);
  });
  it("todo a 0 → 0; todo a 10 → 100, con dolor y función a 50", () => {
    expect(form.score(all(0))).toEqual({
      score: 0,
      subscores: [
        { name: "Dolor", score: 0, max: 50 },
        { name: "Función", score: 0, max: 50 },
      ],
    });
    expect(form.score(all(10))).toEqual({
      score: 100,
      subscores: [
        { name: "Dolor", score: 50, max: 50 },
        { name: "Función", score: 50, max: 50 },
      ],
    });
  });
  it("caso mixto: dolor 2+4+6+8+3 = 23; función 1+2+…+10 = 55 ÷ 2 = 27,5; total 50,5", () => {
    const a: Answers = { i1: 2, i2: 4, i3: 6, i4: 8, i5: 3 };
    for (let n = 6; n <= 15; n++) a[`i${n}`] = n - 5;
    const r = form.score(a);
    expect(r.score).toBe(50.5);
    expect(r.subscores).toEqual([
      { name: "Dolor", score: 23, max: 50 },
      { name: "Función", score: 27.5, max: 50 },
    ]);
  });
  it("un ítem de función sin responder (o «No aplica») vale la media de los demás de función", () => {
    // Función 6-14 = 1..9 (media 5) y la 15 en blanco → 5 × 10 ÷ 2 = 25; dolor 23 → 48.
    const a: Answers = { i1: 2, i2: 4, i3: 6, i4: 8, i5: 3 };
    for (let n = 6; n <= 14; n++) a[`i${n}`] = n - 5;
    expect(form.score(a).score).toBe(48);
    expect(form.score({ ...a, i15: null }).score).toBe(48);
    // Redondeo: dolor 0 y nueve de función que suman 40 → 40/9 × 10 ÷ 2 = 22,2.
    const b: Answers = { ...all(0), i6: 10, i7: 10, i8: 10, i9: 10 };
    delete b.i10;
    expect(form.score(b).score).toBe(22.2);
  });
  it("con dos de función sin responder, o alguna de dolor, no calcula", () => {
    const a = all(5);
    delete a.i14;
    a.i15 = null;
    expect(() => form.score(a)).toThrow(/Faltan 2 de las 10 respuestas de función/);
    const b = all(5);
    delete b.i3;
    expect(() => form.score(b)).toThrow(/Faltan 1 de las 5 respuestas de dolor/);
    expect(() => form.score({})).toThrow(RangeError);
  });
});
