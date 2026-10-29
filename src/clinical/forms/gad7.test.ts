import { describe, expect, it } from "vitest";
import { form } from "./gad7";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("GAD-7", () => {
  it("7 ítems de 0 a 3", () => {
    expect(ids).toHaveLength(7);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3]);
  });
  it("nunca en todo → 0, mínima; casi todos los días en todo → 21, grave", () => {
    expect(form.score(all(0))).toEqual({ score: 0 });
    expect(form.score(all(3))).toEqual({ score: 21 });
  });
  it("caso mixto: 3+2+2+1+1+0+0 → 9, leve; con uno más → 10, moderada", () => {
    const a: Answers = { i1: 3, i2: 2, i3: 2, i4: 1, i5: 1, i6: 0, i7: 0 };
    expect(form.score(a)).toEqual({ score: 9 });
    expect(form.score({ ...a, i6: 3, i7: 3 }).score).toBe(15);
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(2);
    delete a.i3;
    delete a.i7;
    expect(() => form.score(a)).toThrow(/Faltan 2/);
  });
});
