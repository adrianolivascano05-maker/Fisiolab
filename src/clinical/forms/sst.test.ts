import { describe, expect, it } from "vitest";
import { form } from "./sst";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("SST", () => {
  it("12 preguntas de sí (1) o no (0)", () => {
    expect(ids).toHaveLength(12);
    for (const s of form.sections)
      for (const i of s.items) expect(i.options).toEqual([
        { value: 1, label: "Sí" },
        { value: 0, label: "No" },
      ]);
  });
  it("sí en todas → 12 (100 %); no en todas → 0 (0 %)", () => {
    expect(form.score(all(1))).toEqual({ score: 12, subscores: [{ name: "Porcentaje de «sí»", score: 100 }] });
    expect(form.score(all(0))).toEqual({ score: 0, subscores: [{ name: "Porcentaje de «sí»", score: 0 }] });
  });
  it("caso mixto: sí en las 7 primeras y no en las 5 últimas → 7, y 7/12 = 58,3 %", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = i < 7 ? 1 : 0));
    expect(form.score(a)).toEqual({ score: 7, subscores: [{ name: "Porcentaje de «sí»", score: 58.3 }] });
  });
  it("con alguna en blanco no da la nota de 0 a 12, solo el % de «sí» sobre las respondidas", () => {
    // 10 respondidas con 7 «sí» → 70 %.
    const a: Answers = {};
    ids.slice(0, 10).forEach((id, i) => (a[id] = i < 7 ? 1 : 0));
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow("Faltan 2 de las 12 respuestas: el SST necesita todas para dar la nota de 0 a 12. Sobre las 10 respondidas, 70 % de «sí».");
    // 11 respondidas con 1 «sí» → 9,1 %.
    const b: Answers = { ...all(0), i1: 1 };
    delete b.i12;
    expect(() => form.score(b)).toThrow(/Sobre las 11 respondidas, 9,1 % de «sí»/);
    expect(() => form.score({})).toThrow(/^Faltan 12 de las 12 respuestas: el SST necesita todas para dar la nota de 0 a 12\.$/);
  });
});
