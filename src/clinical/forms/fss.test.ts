import { describe, expect, it } from "vitest";
import { form } from "./fss";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("FSS", () => {
  it("9 frases en escala de 1 a 7", () => {
    expect(ids).toHaveLength(9);
    for (const s of form.sections) for (const i of s.items) expect(i.scale).toEqual({ from: 1, to: 7, ends: ["Muy en desacuerdo", "Muy de acuerdo"] });
  });
  it("todo a 1 → 1; todo a 7 → 7, sin interpretación (el punto de corte está sin verificar)", () => {
    expect(form.score(all(1))).toEqual({ score: 1 });
    expect(form.score(all(7))).toEqual({ score: 7 });
  });
  it("caso mixto: 1+2+3+4+5+6+7+1+2 = 31 → 31/9 = 3,44 → 3,4", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = (i % 7) + 1));
    expect(form.score(a)).toEqual({ score: 3.4 });
  });
  it("con 1 sin contestar, media de los 8 contestados", () => {
    // 5+5+5+5+5+5+6+6 = 42 → 42/8 = 5,25 → 5,3.
    const a = all(5);
    delete a.i9;
    a.i7 = 6;
    a.i8 = 6;
    expect(form.score(a)).toEqual({ score: 5.3 });
  });
  it("con 2 o más sin contestar no calcula", () => {
    const a = all(4);
    delete a.i1;
    delete a.i2;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 2 de las 9/);
  });
});
