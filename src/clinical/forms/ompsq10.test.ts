import { describe, expect, it } from "vitest";
import { form } from "./ompsq10";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("Örebro corto", () => {
  it("10 ítems: la duración puntúa de 1 a 10 y el resto es una escala de 0 a 10", () => {
    expect(ids).toHaveLength(10);
    expect(items[0].options!.map((o) => o.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const i of items.slice(1)) expect(i.scale).toMatchObject({ from: 0, to: 10 });
  });
  it("lo peor → 100, riesgo alto; lo mejor → 1 (la duración más corta), riesgo bajo", () => {
    const worst: Answers = { ...all(10), i3: 0, i4: 0, i8: 0 };
    expect(form.score(worst)).toEqual({ score: 100, text: "Riesgo alto de discapacidad persistente" });
    const best: Answers = { ...all(0), i1: 1, i3: 10, i4: 10, i8: 10 };
    expect(form.score(best)).toEqual({ score: 1, text: "Riesgo bajo de discapacidad persistente" });
  });
  it("las preguntas 3, 4 y 8 (trabajo ligero, dormir, tareas en 3 meses) puntúan al revés", () => {
    const base = all(5);
    expect(form.score(base).score).toBe(50);
    for (const id of ["i3", "i4", "i8"]) {
      expect(form.score({ ...base, [id]: 10 }).score).toBe(45);
      expect(form.score({ ...base, [id]: 0 }).score).toBe(55);
    }
    // Las demás, tal cual.
    for (const id of ["i2", "i5", "i6", "i7", "i9", "i10"]) expect(form.score({ ...base, [id]: 10 }).score).toBe(55);
  });
  it("caso mixto: 3+6+(10−7)+(10−4)+5+2+8+(10−9)+6+3 = 43, riesgo bajo; 50 ya es alto", () => {
    const a: Answers = { i1: 3, i2: 6, i3: 7, i4: 4, i5: 5, i6: 2, i7: 8, i8: 9, i9: 6, i10: 3 };
    expect(form.score(a)).toEqual({ score: 43, text: "Riesgo bajo de discapacidad persistente" });
    expect(form.score({ ...a, i6: 9 })).toEqual({ score: 50, text: "Riesgo alto de discapacidad persistente" });
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(5);
    delete a.i1;
    delete a.i8;
    expect(() => form.score(a)).toThrow(/Faltan 2/);
  });
});
