import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form as koos } from "./koos";
import { form } from "./koos12";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((it) => it.id));
const fill = (value: number | null): Answers => Object.fromEntries(ids.map((id) => [id, value]));
const koosItems = koos.sections.flatMap((s) => s.items);

describe("KOOS-12", () => {
  it("12 ítems del KOOS de la app (dolor 4, función 4, calidad de vida 4), con su texto y sus respuestas tal cual", () => {
    expect(form.sections.map((s) => [s.title, s.items.map((it) => it.id)])).toEqual([
      ["Dolor", ["p1", "p8", "p5", "p6"]],
      ["Función", ["a4", "a3", "a7", "sp4"]],
      ["Calidad de vida", ["q1", "q2", "q3", "q4"]],
    ]);
    for (const it of form.sections.flatMap((s) => s.items)) {
      expect(it).toBe(koosItems.find((k) => k.id === it.id));
      expect(it.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
    }
    expect(form.instructions).toBe(koos.instructions);
    expect(form.sections[1].items.map((it) => it.text)).toEqual([
      "Estar de pie",
      "Levantarse estando sentado",
      "Entrar o salir de un coche",
      "Girar o pivotar sobre la rodilla lesionada",
    ]);
  });
  it("las subescalas y el resumen son las del catálogo", () => {
    expect(getKind("koos12")!.subscales).toEqual(["Dolor", "Función", "Calidad de vida", "Resumen"]);
  });
  it("todo lo mejor (0) → 100 en todo; todo lo peor (4) → 0 en todo", () => {
    expect(form.score(fill(0))).toEqual({
      score: null,
      subscores: ["Dolor", "Función", "Calidad de vida", "Resumen"].map((name) => ({ name, score: 100 })),
    });
    expect(form.score(fill(4)).subscores!.map((s) => s.score)).toEqual([0, 0, 0, 0]);
  });
  it("caso mixto: cada subescala es 100 − media × 25, y el resumen la media de las tres", () => {
    // Dolor 1, 0, 2, 1 → media 1 → 75; función 0, 1, 2, 3 → media 1,5 → 62,5; calidad de vida 2, 2, 3, 3 → media 2,5
    // → 37,5. Resumen: (75 + 62,5 + 37,5) / 3 = 58,33 → 58,3.
    const a: Answers = { p1: 1, p8: 0, p5: 2, p6: 1, a4: 0, a3: 1, a7: 2, sp4: 3, q1: 2, q2: 2, q3: 3, q4: 3 };
    expect(form.score(a).subscores).toEqual([
      { name: "Dolor", score: 75 },
      { name: "Función", score: 62.5 },
      { name: "Calidad de vida", score: 37.5 },
      { name: "Resumen", score: 58.3 },
    ]);
  });
  it("con 2 en blanco en una subescala la calcula con lo contestado; con 3, la omite y no hay resumen", () => {
    // Dolor con p1 = 1 y p8 = 0 (p5 sin responder, p6 «No aplica») → media 0,5 → 87,5.
    const a: Answers = { ...fill(0), p1: 1, p6: null };
    delete a.p5;
    expect(form.score(a).subscores!.find((s) => s.name === "Dolor")!.score).toBe(87.5);
    expect(form.score(a).subscores!.map((s) => s.name)).toContain("Resumen");
    delete a.p8;
    expect(form.score(a).subscores!.map((s) => s.name)).toEqual(["Función", "Calidad de vida"]);
  });
  it("sin respuestas, no calcula", () => {
    expect(() => form.score({})).toThrow(/Faltan 12 de las 12/);
    expect(() => form.score(fill(null))).toThrow(RangeError);
  });
  it("la fuente lleva las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("koos12")!.refs!)).toBe(true);
  });
});
