import { describe, expect, it } from "vitest";
import { form } from "./prtee";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("PRTEE", () => {
  it("15 ítems de 0 a 10: 5 de dolor y 10 de función (6 específicas y 4 habituales), y solo los de función admiten «No aplica»", () => {
    expect(ids).toEqual(Array.from({ length: 15 }, (_, i) => `i${i + 1}`));
    expect(form.sections.map((s) => s.items.length)).toEqual([5, 6, 4]);
    for (const i of items) expect(i.scale).toMatchObject({ from: 0, to: 10 });
    expect(items.filter((i) => i.na).map((i) => i.id)).toEqual(ids.slice(5));
  });
  it("todo a 0 → 0; todo a 10 → 100, con dolor y función a 50", () => {
    expect(form.score(all(0)).score).toBe(0);
    expect(form.score(all(10))).toEqual({
      score: 100,
      subscores: [
        { name: "Dolor", score: 50, max: 50 },
        { name: "Función", score: 50, max: 50 },
      ],
    });
  });
  it("caso mixto: dolor 1+3+5+0+9 = 18; función seis a 6 y cuatro a 3 = 48 ÷ 2 = 24; total 42", () => {
    const a: Answers = { i1: 1, i2: 3, i3: 5, i4: 0, i5: 9 };
    for (let n = 6; n <= 11; n++) a[`i${n}`] = 6;
    for (let n = 12; n <= 15; n++) a[`i${n}`] = 3;
    const r = form.score(a);
    expect(r.score).toBe(42);
    expect(r.subscores).toEqual([
      { name: "Dolor", score: 18, max: 50 },
      { name: "Función", score: 24, max: 50 },
    ]);
  });
  it("un ítem de función sin responder (o «No aplica») vale la media de los demás de función", () => {
    // Igual que el caso mixto pero sin la 12: función 6×6 + 3×3 = 45 en 9 ítems → media 5 → 5 × 10 ÷ 2 = 25; total 43.
    const a: Answers = { i1: 1, i2: 3, i3: 5, i4: 0, i5: 9 };
    for (let n = 6; n <= 11; n++) a[`i${n}`] = 6;
    for (let n = 13; n <= 15; n++) a[`i${n}`] = 3;
    expect(form.score(a).score).toBe(43);
    expect(form.score({ ...a, i12: null }).subscores![1]).toEqual({ name: "Función", score: 25, max: 50 });
  });
  it("con dos de función sin responder, o alguna de dolor, no calcula", () => {
    const a = all(4);
    a.i6 = null;
    a.i7 = null;
    expect(() => form.score(a)).toThrow(/Faltan 2 de las 10 respuestas de función/);
    const b = all(4);
    delete b.i5;
    delete b.i1;
    expect(() => form.score(b)).toThrow(/Faltan 2 de las 5 respuestas de dolor/);
    expect(() => form.score({})).toThrow(RangeError);
  });
});
