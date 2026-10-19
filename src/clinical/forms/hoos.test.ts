import { describe, expect, it } from "vitest";
import { form } from "./hoos";
import type { Answers } from "./types";

const ids = (title?: string) =>
  form.sections.filter((s) => !title || s.title === title).flatMap((s) => s.items.map((it) => it.id));
const fill = (value: number | null, only = ids()): Answers => Object.fromEntries(only.map((id) => [id, value]));
const SUBSCALES = ["Dolor", "Síntomas", "AVD", "Deporte y ocio", "Calidad de vida"];

describe("HOOS", () => {
  it("40 ítems con ids únicos, repartidos como en el original", () => {
    expect(ids()).toHaveLength(40);
    expect(new Set(ids()).size).toBe(40);
    expect(form.sections.map((s) => [s.title, s.items.length])).toEqual([
      ["Síntomas", 5],
      ["Dolor", 10],
      ["AVD", 17],
      ["Deporte y ocio", 4],
      ["Calidad de vida", 4],
    ]);
    for (const s of form.sections) for (const it of s.items) expect(it.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
  });

  it("todo lo mejor: 100 en cada subescala, en el orden del catálogo", () => {
    expect(form.score(fill(0))).toEqual({ score: null, subscores: SUBSCALES.map((name) => ({ name, score: 100 })) });
  });

  it("todo lo peor: 0 en cada subescala", () => {
    expect(form.score(fill(4)).subscores!.map((s) => s.score)).toEqual([0, 0, 0, 0, 0]);
  });

  it("con la mitad justa contestada sí se calcula; con menos, se omite", () => {
    // Deporte y ocio: 2 de 4 vale; Síntomas: 2 de 5 no.
    const r = form.score({ sp1: 2, sp2: 2, s1: 0, s2: 0 });
    expect(r.subscores).toEqual([{ name: "Deporte y ocio", score: 50 }]);
  });

  it("sin respuestas (o todo «No aplica»), lanza RangeError", () => {
    expect(() => form.score({})).toThrow(RangeError);
    expect(() => form.score(fill(null))).toThrow(RangeError);
  });
});
