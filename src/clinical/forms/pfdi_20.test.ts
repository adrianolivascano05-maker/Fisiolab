import { describe, expect, it } from "vitest";
import { form } from "./pfdi_20";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const subs = (a: number, b: number, c: number) => [
  { name: "POPDI-6", score: a, max: 100 },
  { name: "CRADI-8", score: b, max: 100 },
  { name: "UDI-6", score: c, max: 100 },
];

describe("PFDI-20", () => {
  it("20 preguntas de 0 a 4, repartidas 6 + 8 + 6 como en el original", () => {
    expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => `i${i + 1}`));
    expect(form.sections.map((s) => [s.title, s.items.length])).toEqual([
      ["POPDI-6 (prolapso)", 6],
      ["CRADI-8 (colorrectoanal)", 8],
      ["UDI-6 (urinario)", 6],
    ]);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
  });
  it("«No» en todo → 0; «Sí, y me molesta bastante» en todo → 300 (100 por subescala)", () => {
    expect(form.score(all(0))).toEqual({ score: 0, subscores: subs(0, 0, 0) });
    expect(form.score(all(4))).toEqual({ score: 300, subscores: subs(100, 100, 100) });
  });
  it("caso mixto calculado a mano", () => {
    // POPDI-6: 1+2+0+0+3+0 = 6 → 6/6 × 25 = 25. CRADI-8: todo a 2 → 2 × 25 = 50.
    // UDI-6: 4+4+1+0+0+0 = 9 → 9/6 × 25 = 37,5. Total 25 + 50 + 37,5 = 112,5.
    const a: Answers = { i1: 1, i2: 2, i3: 0, i4: 0, i5: 3, i6: 0, i15: 4, i16: 4, i17: 1, i18: 0, i19: 0, i20: 0 };
    for (let i = 7; i <= 14; i++) a[`i${i}`] = 2;
    expect(form.score(a)).toEqual({ score: 112.5, subscores: subs(25, 50, 37.5) });
  });
  it("redondeo: la nota total se suma sin redondear las subescalas", () => {
    // POPDI-6: 1 de 6 a 1 → 1/6 × 25 = 4,1667; las otras a 0. Total 4,2.
    const a = all(0);
    a.i1 = 1;
    expect(form.score(a)).toEqual({ score: 4.2, subscores: subs(4.2, 0, 0) });
  });
  it("los ítems en blanco se excluyen de la media de su subescala", () => {
    // POPDI-6 con solo i1 = 4 e i2 = 2 contestados → 3 × 25 = 75; el resto a 0.
    const a = all(0);
    for (const id of ["i3", "i4", "i5", "i6"]) delete a[id];
    a.i1 = 4;
    a.i2 = 2;
    expect(form.score(a)).toEqual({ score: 75, subscores: subs(75, 0, 0) });
  });
  it("si una subescala queda entera en blanco no calcula", () => {
    const a = all(1);
    for (let i = 15; i <= 20; i++) delete a[`i${i}`];
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/falta UDI-6/);
    expect(() => form.score({})).toThrow(/falta POPDI-6, CRADI-8, UDI-6/);
  });
});
