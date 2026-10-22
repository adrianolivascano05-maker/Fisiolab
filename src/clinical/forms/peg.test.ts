import { describe, expect, it } from "vitest";
import { form } from "./peg";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("PEG", () => {
  it("3 ítems de 0 a 10 con sus extremos", () => {
    expect(ids).toEqual(["i1", "i2", "i3"]);
    expect(items.map((i) => i.scale)).toEqual([
      { from: 0, to: 10, ends: ["Sin dolor", "El peor dolor que pueda imaginar"] },
      { from: 0, to: 10, ends: ["No interfiere", "Interfiere por completo"] },
      { from: 0, to: 10, ends: ["No interfiere", "Interfiere por completo"] },
    ]);
  });
  it("0 en todo → 0; 10 en todo → 10, sin interpretación (no hay cortes verificados)", () => {
    expect(form.score(all(0))).toEqual({ score: 0 });
    expect(form.score(all(10))).toEqual({ score: 10 });
  });
  it("caso mixto: dolor 3, disfrute 4, actividad 6 → 13/3 = 4,33 → 4,3", () => {
    expect(form.score({ i1: 3, i2: 4, i3: 6 })).toEqual({ score: 4.3 });
  });
  it("redondeo hacia arriba: 7, 8 y 8 → 23/3 = 7,67 → 7,7", () => {
    expect(form.score({ i1: 7, i2: 8, i3: 8 }).score).toBe(7.7);
  });
  it("si falta alguna respuesta no calcula", () => {
    expect(() => form.score({ i1: 5, i2: 5 })).toThrow(RangeError);
    expect(() => form.score({ i1: 5, i2: 5 })).toThrow(/Faltan 1 de las 3/);
    expect(() => form.score({})).toThrow(/Faltan 3 de las 3/);
  });
});
