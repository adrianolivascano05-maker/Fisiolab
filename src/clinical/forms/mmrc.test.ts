import { describe, expect, it } from "vitest";
import { form } from "./mmrc";

const items = form.sections.flatMap((s) => s.items);

describe("mMRC", () => {
  it("un solo ítem con los grados 0 a 4", () => {
    expect(items).toHaveLength(1);
    expect(items[0].options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
  });
  it("la nota es el número del grado: 0 lo mejor, 4 lo peor", () => {
    expect(form.score({ g: 0 })).toEqual({ score: 0, text: "Grado mMRC 0 (grado 1 en la escala MRC original, de 1 a 5)" });
    expect(form.score({ g: 4 })).toEqual({ score: 4, text: "Grado mMRC 4 (grado 5 en la escala MRC original, de 1 a 5)" });
  });
  it("caso intermedio: pararse a respirar a los 100 metros es el grado 3 (MRC 4)", () => {
    const g = items[0].options!.find((o) => o.label.startsWith("Tengo que pararme a respirar después de andar unos 100 metros"))!.value;
    expect(form.score({ g })).toEqual({ score: 3, text: "Grado mMRC 3 (grado 4 en la escala MRC original, de 1 a 5)" });
  });
  it("sin respuesta no calcula", () => {
    expect(() => form.score({})).toThrow(RangeError);
    expect(() => form.score({ g: null })).toThrow(/Falta la respuesta/);
  });
});
