import { describe, expect, it } from "vitest";
import { form } from "./acl_rsi";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("ACL-RSI", () => {
  it("12 ítems de 0 a 10", () => {
    expect(ids).toHaveLength(12);
    for (const i of form.sections[0].items) expect(i.scale).toMatchObject({ from: 0, to: 10 });
  });
  it("todo a 10 → 100 %; todo a 0 → 0 %", () => {
    expect(form.score(all(10)).score).toBe(100);
    expect(form.score(all(0)).score).toBe(0);
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(5);
    delete a.i12;
    expect(() => form.score(a)).toThrow(/Faltan 1/);
  });
  it("caso mixto: seis a 7 y seis a 4 → 66/120 = 55 %; y 1 de más → 55,8 %", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = i < 6 ? 7 : 4));
    expect(form.score(a).score).toBe(55);
    a.i12 = 5;
    expect(form.score(a).score).toBe(55.8);
  });
});
