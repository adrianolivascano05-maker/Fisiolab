import { describe, expect, it } from "vitest";
import { form } from "./jfls8";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("JFLS-8", () => {
  it("8 escalas de 0 (sin limitación) a 10 (limitación grave)", () => {
    expect(ids).toHaveLength(8);
    for (const i of items) expect(i.scale).toEqual({ from: 0, to: 10, ends: ["Sin limitación", "Limitación grave"] });
  });
  it("todo 0 → 0; todo 10 → 10", () => {
    expect(form.score(all(0))).toEqual({ score: 0 });
    expect(form.score(all(10))).toEqual({ score: 10 });
  });
  it("caso mixto: (8 + 6 + 1 + 2 + 0 + 5 + 3 + 0) / 8 = 25 / 8 = 3,125 → 3,1", () => {
    expect(form.score({ i1: 8, i2: 6, i3: 1, i4: 2, i5: 0, i6: 5, i7: 3, i8: 0 }).score).toBe(3.1);
  });
  it("es la media de los respondidos: con 2 en blanco, (8 + 6 + 1 + 2 + 0 + 5) / 6 = 22 / 6 = 3,67 → 3,7", () => {
    expect(form.score({ i1: 8, i2: 6, i3: 1, i4: 2, i5: 0, i6: 5 }).score).toBe(3.7);
  });
  it("con 3 o más en blanco no calcula", () => {
    const a = all(4);
    delete a.i1;
    delete a.i2;
    expect(form.score(a).score).toBe(4);
    delete a.i3;
    expect(() => form.score(a)).toThrow(/Faltan 3 de las 8 respuestas/);
    expect(() => form.score({})).toThrow(/Faltan 8 de las 8/);
  });
});
