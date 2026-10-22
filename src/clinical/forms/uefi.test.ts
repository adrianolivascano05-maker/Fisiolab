import { describe, expect, it } from "vitest";
import { form } from "./uefi";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("UEFI", () => {
  it("20 ítems de 0 a 4", () => {
    expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => `i${i + 1}`));
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
    expect(form.sections[0].items[0].options![0].label).toBe("Dificultad extrema o incapaz de hacerlo");
  });
  it("ninguna dificultad en todo → 80; incapaz en todo → 0", () => {
    expect(form.score(all(4))).toEqual({ score: 80 });
    expect(form.score(all(0))).toEqual({ score: 0 });
  });
  it("caso mixto: diez a 4, cinco a 2, cinco a 1 → 40 + 10 + 5 = 55", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = i < 10 ? 4 : i < 15 ? 2 : 1));
    expect(form.score(a).score).toBe(55);
  });
  it("con 1 o 2 en blanco prorratea (suma × 20 / respondidas)", () => {
    // 19 respondidas a 3 → 57 × 20 / 19 = 60.
    const a = all(3);
    delete a.i8;
    expect(form.score(a).score).toBe(60);
    // 18 respondidas: diez a 4 y ocho a 1 = 48 → 48 × 20 / 18 = 53,3.
    const b: Answers = {};
    ids.slice(0, 18).forEach((id, i) => (b[id] = i < 10 ? 4 : 1));
    expect(form.score(b).score).toBe(53.3);
  });
  it("con 3 o más en blanco no calcula", () => {
    const a = all(2);
    delete a.i1;
    delete a.i2;
    delete a.i20;
    expect(() => form.score(a)).toThrow(/Faltan 3 de las 20 respuestas/);
    expect(() => form.score({})).toThrow(RangeError);
  });
});
