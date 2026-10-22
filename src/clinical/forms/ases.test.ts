import { describe, expect, it } from "vitest";
import { form } from "./ases";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const right = Array.from({ length: 10 }, (_, i) => `d${i + 2}`);
const left = Array.from({ length: 10 }, (_, i) => `i${i + 2}`);
const arm = (prefixIds: string[], values: number[]): Answers => Object.fromEntries(prefixIds.map((id, i) => [id, values[i]]));
const same = (v: number) => Array(10).fill(v) as number[];

describe("ASES", () => {
  it("el lado afectado, 1 de dolor (0-10) y las 10 actividades (0-3) para cada brazo", () => {
    expect(ids).toEqual(["lado", "p1", ...right, ...left]);
    expect(items[0].options!.map((o) => o.label)).toEqual(["El derecho", "El izquierdo"]);
    expect(items[1].scale).toEqual({ from: 0, to: 10, ends: ["Ningún dolor", "El peor dolor posible"] });
    for (const i of items.slice(2)) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3]);
    expect(form.sections[2].items.map((i) => i.text)).toEqual(form.sections[3].items.map((i) => i.text));
  });
  it("sin dolor y nada difícil → 100; el peor dolor e incapaz en todo → 0", () => {
    expect(form.score({ lado: 1, p1: 0, ...arm(right, same(3)), ...arm(left, same(3)) })).toEqual({
      score: 100,
      subscores: [
        { name: "Dolor", score: 50, max: 50 },
        { name: "Función", score: 50, max: 50 },
      ],
    });
    expect(form.score({ lado: 2, p1: 10, ...arm(right, same(0)), ...arm(left, same(0)) }).score).toBe(0);
  });
  it("caso mixto, hombro izquierdo: dolor 4 → (10 − 4) × 5 = 30; actividades 3+3+2+2+1+1+0+3+2+1 = 18 × 5/3 = 30; total 60", () => {
    const a: Answers = { lado: 2, p1: 4, ...arm(left, [3, 3, 2, 2, 1, 1, 0, 3, 2, 1]), ...arm(right, same(0)) };
    expect(form.score(a)).toEqual({
      score: 60,
      subscores: [
        { name: "Dolor", score: 30, max: 50 },
        { name: "Función", score: 30, max: 50 },
      ],
    });
    // El brazo no afectado no cuenta: cambiarlo o dejarlo en blanco no mueve la nota.
    expect(form.score({ ...a, ...arm(right, same(3)) }).score).toBe(60);
    expect(form.score({ lado: 2, p1: 4, ...arm(left, [3, 3, 2, 2, 1, 1, 0, 3, 2, 1]) }).score).toBe(60);
    // Con el derecho como afectado, puntúan las del derecho (todas a 0): solo queda el dolor.
    expect(form.score({ ...a, lado: 1 }).score).toBe(30);
  });
  it("con 8 o 9 actividades del lado afectado, prorratea con la media; con menos no calcula", () => {
    // 3+3+3+3+2+2+1+1 = 18 en 8 → media 2,25 × 10 × 5/3 = 37,5; dolor 4 → 30; total 67,5.
    const a: Answers = { lado: 2, p1: 4, ...arm(left.slice(0, 8), [3, 3, 3, 3, 2, 2, 1, 1]) };
    expect(form.score(a).score).toBe(67.5);
    const b: Answers = { lado: 1, p1: 4, ...arm(right.slice(0, 7), same(3)), ...arm(left, same(3)) };
    expect(() => form.score(b)).toThrow(/Faltan 3 de las 10 actividades del brazo derecho/);
  });
  it("sin el lado afectado o sin el dolor no calcula", () => {
    expect(() => form.score({ p1: 2, ...arm(right, same(3)), ...arm(left, same(3)) })).toThrow(/qué hombro/);
    expect(() => form.score({ lado: 1, ...arm(right, same(3)) })).toThrow(/dolor/);
    expect(() => form.score({})).toThrow(RangeError);
  });
});
