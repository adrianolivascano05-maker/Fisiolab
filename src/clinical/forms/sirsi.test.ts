import { describe, expect, it } from "vitest";
import { form as aclRsi } from "./acl_rsi";
import { form } from "./sirsi";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const aclItems = aclRsi.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("SIRSI", () => {
  it("los 12 ítems del ACL-RSI, con los mismos ids y escalas de 0 a 10, cambiando «la rodilla» por «el hombro»", () => {
    expect(ids).toEqual(aclItems.map((i) => i.id));
    expect(ids).toHaveLength(12);
    items.forEach((item, n) => {
      expect(item.scale).toEqual(aclItems[n].scale);
      expect(item.scale).toMatchObject({ from: 0, to: 10 });
      expect(item.text).toBe(aclItems[n].text.replaceAll("la rodilla", "el hombro"));
      expect(item.text).not.toMatch(/rodilla/);
    });
    expect(items.filter((i) => i.text.includes("el hombro")).map((i) => i.id)).toEqual(["i2", "i4", "i5", "i6", "i7", "i8", "i9"]);
    // El ACL-RSI no cambia.
    expect(aclItems.filter((i) => i.text.includes("la rodilla"))).toHaveLength(7);
  });
  it("todo a 10 → 100 %; todo a 0 → 0 %", () => {
    expect(form.score(all(10)).score).toBe(100);
    expect(form.score(all(0)).score).toBe(0);
  });
  it("caso mixto: 10, 9, 8 … 1, 0 y 5 → 60/120 = 50 %; y 1 de más → 61/120 = 50,8 %", () => {
    const a: Answers = {};
    [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 5].forEach((v, i) => (a[ids[i]] = v));
    expect(form.score(a)).toEqual({ score: 50 });
    a.i11 = 1;
    expect(form.score(a).score).toBe(50.8);
  });
  it("lo marcado puntúa tal cual también en los de redacción negativa (2, 3, 6, 7, 9 y 10)", () => {
    const a = all(0);
    for (const id of ["i2", "i3", "i6", "i7", "i9", "i10"]) a[id] = 10;
    expect(form.score(a).score).toBe(50);
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(6);
    delete a.i7;
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 12 respuestas: el SIRSI/);
    expect(() => form.score({})).toThrow(RangeError);
  });
});
