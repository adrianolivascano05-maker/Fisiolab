import { describe, expect, it } from "vitest";
import { form } from "./rmdq";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("RMDQ", () => {
  it("24 frases: marcada = 1, sin marcar = 0", () => {
    expect(ids).toHaveLength(24);
    for (const i of items) expect(i.options!.map((o) => o.value)).toEqual([1, 0]);
  });
  it("ninguna frase marcada → 0; todas → 24", () => {
    expect(form.score(all(0))).toEqual({ score: 0 });
    expect(form.score(all(1))).toEqual({ score: 24 });
  });
  it("caso mixto: marcadas la 2, 3, 13, 17 y 18 (y el resto «No me describe») → 5", () => {
    const a = all(0);
    for (const n of [2, 3, 13, 17, 18]) a[`i${n}`] = 1;
    expect(form.score(a).score).toBe(5);
  });
  it("una frase sin marcar cuenta como 0: sin respuestas, la nota es 0; con 3 marcadas y el resto en blanco, 3", () => {
    expect(form.score({}).score).toBe(0);
    expect(form.score({ i1: 1, i10: 1, i24: 1 }).score).toBe(3);
  });
});
