import { describe, expect, it } from "vitest";
import { form } from "./fabq";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const WORK = ["i6", "i7", "i8", "i9", "i10", "i11", "i12", "i13", "i14", "i15", "i16"];

describe("FABQ", () => {
  it("16 ítems de 0 a 6; los de trabajo (6-16) admiten «No aplica»", () => {
    expect(ids).toEqual(Array.from({ length: 16 }, (_, i) => `i${i + 1}`));
    for (const i of items) expect(i.scale).toMatchObject({ from: 0, to: 6 });
    expect(items.filter((i) => i.na).map((i) => i.id)).toEqual(WORK);
  });
  it("sin nota total: completamente de acuerdo en todo → 24 y 42; en desacuerdo en todo → 0 y 0", () => {
    expect(form.score(all(6))).toEqual({
      score: null,
      subscores: [
        { name: "Actividad física", score: 24 },
        { name: "Trabajo", score: 42 },
      ],
    });
    expect(form.score(all(0)).subscores).toEqual([
      { name: "Actividad física", score: 0 },
      { name: "Trabajo", score: 0 },
    ]);
  });
  it("caso mixto: cada frase vale su número módulo 7 → actividad 2+3+4+5 = 14, trabajo 6+0+2+3+4+5+1 = 21", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = (i + 1) % 7));
    expect(form.score(a).subscores).toEqual([
      { name: "Actividad física", score: 14 },
      { name: "Trabajo", score: 21 },
    ]);
    // Las frases 1, 8, 13, 14 y 16 no puntúan: cambiarlas o dejarlas sin contestar no mueve la nota.
    const b: Answers = { ...a, i1: 6, i8: 6, i13: 6, i14: 6 };
    delete b.i16;
    expect(form.score(b)).toEqual(form.score(a));
  });
  it("si no trabaja («No aplica» en las de trabajo), solo sale actividad física", () => {
    const a = all(3);
    for (const id of WORK) a[id] = null;
    expect(form.score(a)).toEqual({ score: null, subscores: [{ name: "Actividad física", score: 12 }] });
  });
  it("con una frase puntuable sin contestar, esa subescala se omite", () => {
    const work = all(2);
    delete work.i15;
    expect(form.score(work).subscores).toEqual([{ name: "Actividad física", score: 8 }]);
    const activity = all(2);
    delete activity.i3;
    expect(form.score(activity).subscores).toEqual([{ name: "Trabajo", score: 14 }]);
  });
  it("si no se puede calcular ninguna subescala no calcula", () => {
    const a = all(4);
    delete a.i2;
    a.i7 = null;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score({})).toThrow(/Faltan respuestas/);
  });
});
