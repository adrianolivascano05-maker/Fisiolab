import { describe, expect, it } from "vitest";
import { form } from "./midas";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const five = (...days: number[]): Answers => Object.fromEntries(days.map((d, i) => [`i${i + 1}`, d]));
const grade = (total: number) => form.score(five(total, 0, 0, 0, 0)).text;

describe("MIDAS", () => {
  it("5 preguntas que puntúan (días de 0 a 90) y A (días) y B (0 a 10), que no puntúan", () => {
    expect(ids).toEqual(["i1", "i2", "i3", "i4", "i5", "a", "b"]);
    for (const i of items.slice(0, 6)) expect(i.input).toEqual({ min: 0, max: 90, unit: "días" });
    expect(items[6].scale).toEqual({ from: 0, to: 10, ends: ["Sin dolor", "El peor dolor posible"] });
  });
  it("todo 0 → 0; 90 días en las cinco → 450", () => {
    expect(form.score(five(0, 0, 0, 0, 0)).score).toBe(0);
    expect(form.score(five(90, 90, 90, 90, 90)).score).toBe(450);
  });
  it("caso mixto: 2 + 5 + 3 + 4 + 1 = 15 días; A (20 días) y B (7) no suman y van aparte", () => {
    const r = form.score({ ...five(2, 5, 3, 4, 1), a: 20, b: 7 });
    expect(r.score).toBe(15);
    expect(r.subscores).toEqual([
      { name: "A. Días con dolor de cabeza (no puntúa)", score: 20, max: 90 },
      { name: "B. Intensidad media del dolor (no puntúa)", score: 7, max: 10 },
    ]);
    expect(r.text).toBe("Grado III (11–20): discapacidad moderada (orientativo, sin verificar)");
  });
  it("A y B son opcionales: sin ellas también calcula", () => {
    expect(form.score(five(2, 5, 3, 4, 1))).toEqual({ score: 15, text: "Grado III (11–20): discapacidad moderada (orientativo, sin verificar)" });
    expect(form.score({ ...five(2, 5, 3, 4, 1), b: 4 }).subscores).toEqual([{ name: "B. Intensidad media del dolor (no puntúa)", score: 4, max: 10 }]);
  });
  it("grados orientativos en su límite: 5 → I, 6 → II, 10 → II, 11 → III, 20 → III, 21 → IV", () => {
    expect(grade(5)).toMatch(/^Grado I \(0–5\)/);
    expect(grade(6)).toMatch(/^Grado II \(6–10\)/);
    expect(grade(10)).toMatch(/^Grado II /);
    expect(grade(11)).toMatch(/^Grado III \(11–20\)/);
    expect(grade(20)).toMatch(/^Grado III /);
    expect(grade(21)).toMatch(/^Grado IV \(21 o más\)/);
    for (const n of [0, 6, 11, 21]) expect(grade(n)).toMatch(/\(orientativo, sin verificar\)$/);
  });
  it("si falta alguna de las preguntas 1 a 5 no calcula, aunque estén A y B", () => {
    const a: Answers = { ...five(2, 5, 3, 4, 1), a: 20, b: 7 };
    delete a.i3;
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 5/);
  });
  it("cada respuesta de la 1 a la 5 tiene que estar entre 0 y 90 días", () => {
    expect(() => form.score(five(91, 0, 0, 0, 0))).toThrow(/entre 0 y 90/);
    expect(() => form.score(five(0, 0, -1, 0, 0))).toThrow(/entre 0 y 90/);
  });
});
