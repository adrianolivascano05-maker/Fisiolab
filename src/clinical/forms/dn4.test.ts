import { describe, expect, it } from "vitest";
import { form } from "./dn4";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const POSITIVE = "Cribado positivo de dolor neuropático (4 o más)";
const NEGATIVE = "Cribado negativo de dolor neuropático (menos de 4)";

describe("DN4", () => {
  it("10 ítems de sí (1) o no (0): 7 de entrevista y 3 de exploración", () => {
    expect(ids).toEqual(Array.from({ length: 10 }, (_, i) => `i${i + 1}`));
    expect(form.sections.map((s) => s.items.length)).toEqual([3, 4, 2, 1]);
    for (const s of form.sections) for (const i of s.items) expect(i.options).toEqual([{ value: 1, label: "Sí" }, { value: 0, label: "No" }]);
    // Las preguntas 3 y 4 (ítems 8 a 10) son de exploración: lo dice su apartado.
    expect(form.sections.slice(2).every((s) => s.title.startsWith("Exploración (la rellena el fisioterapeuta)"))).toBe(true);
    expect(form.sections.slice(2).flatMap((s) => s.items.map((i) => i.id))).toEqual(["i8", "i9", "i10"]);
  });
  it("no en todo → 0, negativo; sí en todo → 10, positivo", () => {
    expect(form.score(all(0))).toEqual({ score: 0, text: NEGATIVE });
    expect(form.score(all(1))).toEqual({ score: 10, text: POSITIVE });
  });
  it("caso mixto: quemazón, hormigueo y entumecimiento (ítems 1, 4 y 6) → 3, negativo", () => {
    const a = all(0);
    a.i1 = 1;
    a.i4 = 1;
    a.i6 = 1;
    expect(form.score(a)).toEqual({ score: 3, text: NEGATIVE });
  });
  it("límite: 4 ya es cribado positivo (con la hipoestesia al tacto, ítem 8)", () => {
    const a = { ...all(0), i1: 1, i4: 1, i6: 1, i8: 1 };
    expect(form.score(a)).toEqual({ score: 4, text: POSITIVE });
  });
  it("si falta alguna respuesta (también las de exploración) no calcula: no se imputan blancos", () => {
    const a = all(1);
    delete a.i10;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 10/);
    const b = all(0);
    delete b.i8;
    delete b.i9;
    delete b.i10;
    expect(() => form.score(b)).toThrow(/Faltan 3 de las 10/);
  });
});
