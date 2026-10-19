import { describe, expect, it } from "vitest";
import { form } from "./koos";
import type { Answers } from "./types";

const ids = (title?: string) =>
  form.sections.filter((s) => !title || s.title === title).flatMap((s) => s.items.map((it) => it.id));
const fill = (value: number | null, only = ids()): Answers => Object.fromEntries(only.map((id) => [id, value]));
const SUBSCALES = ["Dolor", "Síntomas", "AVD", "Deporte y ocio", "Calidad de vida"];

describe("KOOS", () => {
  it("42 ítems con ids únicos, repartidos como en el original", () => {
    expect(ids()).toHaveLength(42);
    expect(new Set(ids()).size).toBe(42);
    expect(form.sections.map((s) => [s.title, s.items.length])).toEqual([
      ["Síntomas", 7],
      ["Dolor", 9],
      ["AVD", 17],
      ["Deporte y ocio", 5],
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

  it("«Siempre» puntúa 0 en S4 y S5 (estirar y doblar del todo)", () => {
    const s4 = form.sections[0].items.find((it) => it.id === "s4")!;
    expect(s4.options!.find((o) => o.label === "Siempre")!.value).toBe(0);
  });

  it("media de lo contestado y redondeo a un decimal", () => {
    // Síntomas: 4 de 7 contestados (1, 1, 2, 0) → media 1 → 75.
    const r = form.score({ s1: 1, s2: 1, s3: 2, s4: 0, q1: 1, q2: 2, q3: 2 });
    expect(r.subscores).toEqual([
      { name: "Síntomas", score: 75 },
      { name: "Calidad de vida", score: 58.3 },
    ]);
  });

  it("se omite la subescala con menos de la mitad contestada", () => {
    // Síntomas: 3 de 7 contestados (s4 «No aplica», s1-s3 sin responder).
    const a: Answers = { ...fill(0), s4: null };
    delete a.s1;
    delete a.s2;
    delete a.s3;
    expect(form.score(a).subscores!.map((s) => s.name)).toEqual(["Dolor", "AVD", "Deporte y ocio", "Calidad de vida"]);
  });

  it("sin respuestas, lanza RangeError", () => {
    expect(() => form.score({})).toThrow(RangeError);
    expect(() => form.score(fill(null))).toThrow(RangeError);
  });
});
