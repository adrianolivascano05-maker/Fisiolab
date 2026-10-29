import { describe, expect, it } from "vitest";
import { form } from "./nijmegen";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("Nijmegen", () => {
  it("16 síntomas de 0 a 4", () => {
    expect(ids).toHaveLength(16);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
  });
  it("nunca en todo → 0; muy a menudo en todo → 64", () => {
    expect(form.score(all(0))).toEqual({ score: 0 });
    expect(form.score(all(4))).toEqual({ score: 64 });
  });
  it("caso mixto: cada síntoma vale su número módulo 5 → (1+2+3+4+0) × 3 + 1 = 31", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = (i + 1) % 5));
    expect(form.score(a)).toEqual({ score: 31 });
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(1);
    delete a.i16;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 16/);
  });
});
