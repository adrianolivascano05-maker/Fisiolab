import { describe, expect, it } from "vitest";
import { form } from "./ipaq";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
/** Días y minutos al día de intensa, moderada y caminar; [0] = ningún día, sin minutos. */
type Act = [number, number?];
const week = (vig: Act, mod: Act, walk: Act, extra: Answers = {}): Answers => {
  const a: Answers = { i1: vig[0], i3: mod[0], i5: walk[0], ...extra };
  if (vig[1] !== undefined) a.i2 = vig[1];
  if (mod[1] !== undefined) a.i4 = mod[1];
  if (walk[1] !== undefined) a.i6 = walk[1];
  return a;
};

describe("IPAQ corto", () => {
  it("7 ítems: días (0-7) y minutos de cada actividad, y minutos sentado", () => {
    expect(items.map((it) => it.id)).toEqual(["i1", "i2", "i3", "i4", "i5", "i6", "i7"]);
    for (const id of ["i1", "i3", "i5"]) expect(items.find((it) => it.id === id)!.scale).toMatchObject({ from: 0, to: 7 });
    for (const id of ["i2", "i4", "i6"]) expect(items.find((it) => it.id === id)!.input).toEqual({ min: 0, max: 960, unit: "min" });
    expect(items.find((it) => it.id === "i7")!.input).toMatchObject({ min: 0, unit: "min" });
  });

  it("ningún día de nada → 0, Bajo (los minutos se pueden dejar en blanco)", () => {
    expect(form.score(week([0], [0], [0]))).toEqual({ score: 0 });
  });

  it("lo máximo: 7 días × 180 min de todo → 19 278, Alto; más de 180 min cuenta como 180", () => {
    // 8 × 180 × 7 + 4 × 180 × 7 + 3,3 × 180 × 7 = 10 080 + 5 040 + 4 158.
    expect(form.score(week([7, 180], [7, 180], [7, 180]))).toEqual({ score: 19278 });
    expect(form.score(week([7, 960], [7, 960], [7, 960]))).toEqual({ score: 19278 });
  });

  it("caso mixto calculado a mano; el tiempo sentado no puntúa", () => {
    // Intensa 8 × 45 × 2 = 720; moderada 200 → 180, 4 × 180 × 3 = 2 160; caminar 3,3 × 25 × 6 = 495. Total 3 375.
    // 11 días en total y ≥ 3 000 → Alto (solo 2 días de intensa: no entra por la primera regla).
    const a = week([2, 45], [3, 200], [6, 25]);
    expect(form.score(a)).toEqual({ score: 3375 });
    expect(form.score({ ...a, i7: 480 })).toEqual(form.score(a));
  });

  it("menos de 10 min al día cuenta como nada, también sus días", () => {
    expect(form.score(week([0], [0], [7, 9]))).toEqual({ score: 0 });
    // Moderada 4 × 40 = 640; el día de 5 min caminando no suma para llegar a 5 días → Bajo.
    expect(form.score(week([0], [4, 40], [1, 5]))).toEqual({ score: 640 });
  });

  it("se redondea a entero", () => {
    expect(form.score(week([0], [0], [5, 29])).score).toBe(479); // 3,3 × 29 × 5 = 478,5
  });





  it("sin los días, o con días y sin minutos, lanza RangeError", () => {
    expect(() => form.score({})).toThrow(RangeError);
    expect(() => form.score({ i1: 0, i3: 0 })).toThrow(/cuántos días/);
    expect(() => form.score({ i1: 0, i3: 0, i5: null })).toThrow(RangeError);
    expect(() => form.score(week([2], [0], [0]))).toThrow(/Falta cuánto.*intensa/);
    expect(() => form.score(week([0], [3], [0]))).toThrow(/Falta cuánto.*moderada/);
    expect(() => form.score(week([0], [0], [4]))).toThrow(/Falta cuánto tiempo caminó/);
  });
});
