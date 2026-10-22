import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form } from "./tegner";

const items = form.sections.flatMap((s) => s.items);
const LEVELS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

describe("Tegner", () => {
  it("dos preguntas (antes de la lesión y ahora) con los 11 niveles, del 10 al 0", () => {
    expect(items.map((it) => it.id)).toEqual(["antes", "ahora"]);
    for (const it of items) {
      expect(it.options!.map((o) => o.value)).toEqual(LEVELS);
      expect(new Set(it.options!.map((o) => o.label)).size).toBe(11);
    }
  });
  it("cada nivel se guarda aparte, con los nombres de las subescalas del catálogo", () => {
    expect(getKind("tegner")!.subscales).toEqual(["Antes de la lesión", "Ahora"]);
    expect(form.score({ antes: 0, ahora: 0 })).toEqual({
      score: null,
      subscores: [
        { name: "Antes de la lesión", score: 0 },
        { name: "Ahora", score: 0 },
      ],
    });
    expect(form.score({ antes: 10, ahora: 10 }).subscores!.map((s) => s.score)).toEqual([10, 10]);
  });
  it("caso mixto: competía en tenis (7) y ahora corre por terreno llano 2 veces por semana (4) → 7 y 4", () => {
    expect(form.score({ antes: 7, ahora: 4 }).subscores).toEqual([
      { name: "Antes de la lesión", score: 7 },
      { name: "Ahora", score: 4 },
    ]);
  });
  it("con una sola de las dos, da solo esa", () => {
    expect(form.score({ ahora: 3 }).subscores).toEqual([{ name: "Ahora", score: 3 }]);
    expect(form.score({ antes: 6, ahora: null }).subscores).toEqual([{ name: "Antes de la lesión", score: 6 }]);
  });
  it("sin ninguna, no calcula", () => {
    expect(() => form.score({})).toThrow(/Faltan 2 de las 2/);
  });
  it("la fuente lleva las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("tegner")!.refs!)).toBe(true);
  });
});
