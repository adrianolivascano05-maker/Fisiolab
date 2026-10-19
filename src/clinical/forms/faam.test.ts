import { describe, expect, it } from "vitest";
import { form } from "./faam";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number | null): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("FAAM AVD", () => {
  it("21 ítems con «No aplica»", () => {
    expect(ids).toHaveLength(21);
    expect(form.sections.flatMap((s) => s.items).every((i) => i.na)).toBe(true);
  });
  it("sin dificultad en todo → 100 %; incapaz en todo → 0 %", () => {
    expect(form.score(all(4)).score).toBe(100);
    expect(form.score(all(0)).score).toBe(0);
  });
  it("con menos de 17 respuestas válidas no calcula", () => {
    const a = all(4);
    for (const id of ids.slice(0, 5)) a[id] = null;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score({})).toThrow(/al menos 17/);
  });
  it("caso mixto: 2 «No aplica», 19 contestados que suman 60 → 60/76 = 78,9 %", () => {
    const a = all(3); // 19 × 3 = 57
    a.i1 = null;
    a.i2 = null;
    a.i3 = 4;
    a.i4 = 4;
    a.i5 = 4; // 57 + 3 = 60
    expect(form.score(a).score).toBe(78.9);
  });
});
