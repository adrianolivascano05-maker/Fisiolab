import { describe, expect, it } from "vitest";
import { form } from "./short_fes_i";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("Short FES-I", () => {
  it("7 ítems de 1 a 4", () => {
    expect(ids).toEqual(["i1", "i2", "i3", "i4", "i5", "i6", "i7"]);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([1, 2, 3, 4]);
  });
  it("nada preocupado/a en todo → 7; muy preocupado/a en todo → 28", () => {
    expect(form.score(all(1)).score).toBe(7);
    expect(form.score(all(4)).score).toBe(28);
  });
  it("caso mixto: 1+2+3+4+1+2+3 = 16", () => {
    const a: Answers = { i1: 1, i2: 2, i3: 3, i4: 4, i5: 1, i6: 2, i7: 3 };
    expect(form.score(a)).toEqual({ score: 16 });
  });
  it("en el límite: 8 y 9", () => {
    const a = all(1);
    a.i1 = 2;
    expect(form.score(a).score).toBe(8);
    a.i2 = 2;
    expect(form.score(a).score).toBe(9);
  });
  it("con 1 ítem sin contestar se prorratea: media de los 6 × 7, redondeada", () => {
    // 2+2+3+3+3+3 = 16 → 16/6 × 7 = 18,67 → 19.
    const a: Answers = { i1: 2, i2: 2, i3: 3, i4: 3, i5: 3, i6: 3 };
    expect(form.score(a).score).toBe(19);
    // 1+1+1+1+1+2 = 7 → 7/6 × 7 = 8,17 → 8, todavía por debajo del punto de corte.
    const b: Answers = { i1: 1, i2: 1, i3: 1, i4: 1, i5: 1, i7: 2 };
    expect(form.score(b).score).toBe(8);
  });
  it("con 2 o más sin contestar no calcula", () => {
    const a = all(2);
    delete a.i1;
    delete a.i7;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 2 de las 7/);
    expect(() => form.score({})).toThrow(/Faltan 7/);
  });
});
