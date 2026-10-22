import { describe, expect, it } from "vitest";
import { form } from "./sarc_f";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const POSITIVE = /^Cribado positivo \(4 o más\)/;
const NEGATIVE = "Cribado negativo (menos de 4)";

describe("SARC-F", () => {
  it("5 preguntas de 0 a 2", () => {
    expect(ids).toEqual(["i1", "i2", "i3", "i4", "i5"]);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2]);
  });
  it("ninguna dificultad ni caídas → 0, negativo; todo al máximo → 10, positivo", () => {
    expect(form.score(all(0))).toEqual({ score: 0, text: NEGATIVE });
    expect(form.score(all(2)).score).toBe(10);
    expect(form.score(all(2)).text).toMatch(POSITIVE);
  });
  it("caso mixto: fuerza 2, caminar 0, silla 1, escaleras 2, caídas 1 → 6, positivo", () => {
    const r = form.score({ i1: 2, i2: 0, i3: 1, i4: 2, i5: 1 });
    expect(r.score).toBe(6);
    expect(r.text).toMatch(POSITIVE);
  });
  it("punto de corte: 3 es negativo, 4 ya es positivo", () => {
    expect(form.score({ i1: 1, i2: 1, i3: 1, i4: 0, i5: 0 })).toEqual({ score: 3, text: NEGATIVE });
    expect(form.score({ i1: 1, i2: 1, i3: 1, i4: 1, i5: 0 }).text).toMatch(POSITIVE);
  });
  it("si falta alguna respuesta no calcula (el cribado queda incompleto)", () => {
    const a = all(1);
    delete a.i5;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 5/);
  });
});
