import { describe, expect, it } from "vitest";
import { form } from "./phq9";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("PHQ-9", () => {
  it("9 ítems de 0 a 3", () => {
    expect(ids).toHaveLength(9);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3]);
  });
  it("nunca en todo → 0, mínima; casi todos los días en todo → 27, grave", () => {
    expect(form.score(all(0))).toEqual({ score: 0 });
    const worst = form.score(all(3));
    expect(worst.score).toBe(27);
  });
  it("caso mixto: 3+2+2+1+1+1+0+0 y pregunta 9 a 0 → 10, moderada, sin aviso", () => {
    const a: Answers = { i1: 3, i2: 2, i3: 2, i4: 1, i5: 1, i6: 1, i7: 0, i8: 0, i9: 0 };
    expect(form.score(a)).toEqual({ score: 10 });
  });
  it("pregunta 9 por encima de 0: cuenta en la nota, sin ningún aviso", () => {
    const a = all(0);
    a.i9 = 1;
    expect(form.score(a)).toEqual({ score: 1 });
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(1);
    delete a.i9;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 1/);
  });
});
