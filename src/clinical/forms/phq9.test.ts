import { describe, expect, it } from "vitest";
import { form } from "./phq9";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const WARNING = " · Pregunta 9 positiva: valora hoy su seguridad y deriva a su médico.";

describe("PHQ-9", () => {
  it("9 ítems de 0 a 3", () => {
    expect(ids).toHaveLength(9);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3]);
  });
  it("nunca en todo → 0, mínima; casi todos los días en todo → 27, grave", () => {
    expect(form.score(all(0))).toEqual({ score: 0, text: "Gravedad de los síntomas depresivos: mínima" });
    const worst = form.score(all(3));
    expect(worst.score).toBe(27);
    expect(worst.text).toMatch(/^Gravedad de los síntomas depresivos: grave/);
  });
  it("caso mixto: 3+2+2+1+1+1+0+0 y pregunta 9 a 0 → 10, moderada, sin aviso", () => {
    const a: Answers = { i1: 3, i2: 2, i3: 2, i4: 1, i5: 1, i6: 1, i7: 0, i8: 0, i9: 0 };
    expect(form.score(a)).toEqual({ score: 10, text: "Gravedad de los síntomas depresivos: moderada" });
  });
  it("bandas: 4, 5, 9, 14, 15, 19 y 20", () => {
    const at = (n: number) => {
      const a = all(0);
      ids.slice(0, 8).forEach((id, i) => (a[id] = Math.min(3, Math.max(0, n - 3 * i))));
      return form.score(a).text;
    };
    expect(at(4)).toMatch(/mínima$/);
    expect(at(5)).toMatch(/leve$/);
    expect(at(9)).toMatch(/leve$/);
    expect(at(14)).toMatch(/: moderada$/);
    expect(at(15)).toMatch(/moderadamente grave$/);
    expect(at(19)).toMatch(/moderadamente grave$/);
    expect(at(20)).toMatch(/: grave$/);
  });
  it("pregunta 9 por encima de 0 → aviso de seguridad, aunque la nota sea baja", () => {
    const a = all(0);
    a.i9 = 1;
    expect(form.score(a)).toEqual({ score: 1, text: `Gravedad de los síntomas depresivos: mínima${WARNING}` });
    expect(form.score(all(3)).text).toBe(`Gravedad de los síntomas depresivos: grave${WARNING}`);
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(1);
    delete a.i9;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 1/);
  });
});
