import { describe, expect, it } from "vitest";
import { form } from "./lefs";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("LEFS", () => {
  it("20 ítems de 0 a 4", () => {
    expect(ids).toHaveLength(20);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
  });
  it("sin dificultad en todo → 80; incapaz en todo → 0", () => {
    expect(form.score(all(4)).score).toBe(80);
    expect(form.score(all(0)).score).toBe(0);
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(3);
    delete a.i5;
    delete a.i20;
    expect(() => form.score(a)).toThrow(/Faltan 2/);
  });
  it("caso mixto: diez a 4, cinco a 2, cinco a 1 → 55", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = i < 10 ? 4 : i < 15 ? 2 : 1));
    expect(form.score(a).score).toBe(55);
  });
});
