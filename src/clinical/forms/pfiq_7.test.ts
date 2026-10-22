import { describe, expect, it } from "vitest";
import { form } from "./pfiq_7";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const column = (prefix: string) => ids.filter((id) => id.startsWith(prefix));
const subs = (a: number, b: number, c: number) => [
  { name: "UIQ-7", score: a, max: 100 },
  { name: "CRAIQ-7", score: b, max: 100 },
  { name: "POPIQ-7", score: c, max: 100 },
];

describe("PFIQ-7", () => {
  it("7 preguntas × 3 columnas = 21 respuestas de 0 a 3", () => {
    expect(ids).toHaveLength(21);
    expect(form.sections.map((s) => [s.title, s.items.length])).toEqual([
      ["Vejiga u orina", 7],
      ["Intestino o recto", 7],
      ["Vagina o pelvis", 7],
    ]);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3]);
  });
  it("«Nada» en todo → 0; «Bastante» en todo → 300 (100 por subescala)", () => {
    expect(form.score(all(0))).toEqual({ score: 0, subscores: subs(0, 0, 0) });
    expect(form.score(all(3))).toEqual({ score: 300, subscores: subs(100, 100, 100) });
  });
  it("caso mixto calculado a mano", () => {
    // Vejiga: todo a 2 → 2 × 100/3 = 66,67. Intestino: todo a 0 → 0.
    // Vagina: 3+3+0+0+0+0+0 = 6 → 6/7 × 100/3 = 28,57. Total 66,67 + 0 + 28,57 = 95,24 → 95,2.
    const a: Answers = {};
    for (const id of column("u")) a[id] = 2;
    for (const id of column("c")) a[id] = 0;
    for (const id of column("p")) a[id] = 0;
    a.p1 = 3;
    a.p2 = 3;
    expect(form.score(a)).toEqual({ score: 95.2, subscores: subs(66.7, 0, 28.6) });
  });
  it("las respuestas en blanco se excluyen de la media de su columna", () => {
    // Vejiga con solo u1 = 3 → 100; las otras dos columnas a 0.
    const a = all(0);
    for (const id of column("u").slice(1)) delete a[id];
    a.u1 = 3;
    expect(form.score(a)).toEqual({ score: 100, subscores: subs(100, 0, 0) });
  });
  it("si una columna queda entera en blanco no calcula", () => {
    const a = all(1);
    for (const id of column("c")) delete a[id];
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/falta CRAIQ-7/);
  });
});
