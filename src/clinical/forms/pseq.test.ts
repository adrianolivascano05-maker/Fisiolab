import { describe, expect, it } from "vitest";
import { form } from "./pseq";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("PSEQ", () => {
  it("10 ítems en escala de 0 a 6", () => {
    expect(ids).toHaveLength(10);
    for (const s of form.sections) for (const i of s.items) expect(i.scale).toMatchObject({ from: 0, to: 6 });
  });
  it("totalmente seguro en todo → 60; nada seguro en todo → 0", () => {
    expect(form.score(all(6)).score).toBe(60);
    expect(form.score(all(0)).score).toBe(0);
  });
  it("caso mixto: cada frase vale su número menos 1, hasta 6 → 0+1+2+3+4+5+6+6+6+6 = 39", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = Math.min(6, i)));
    expect(form.score(a).score).toBe(39);
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(3);
    delete a.i1;
    delete a.i10;
    delete a.i5;
    expect(() => form.score(a)).toThrow(/Faltan 3/);
  });
});
