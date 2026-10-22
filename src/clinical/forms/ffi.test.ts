import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form } from "./ffi";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = (title?: string) => form.sections.filter((s) => !title || s.title === title).flatMap((s) => s.items.map((it) => it.id));
const fill = (v: number | null, only = ids()): Answers => Object.fromEntries(only.map((id) => [id, v]));
const SUBSCALES = ["Total", "Dolor", "Discapacidad", "Limitación de actividad"];

describe("FFI", () => {
  it("23 ítems de 0 a 10 con «No aplica»: dolor 9, discapacidad 9, limitación de actividad 5", () => {
    expect(items).toHaveLength(23);
    expect(new Set(ids()).size).toBe(23);
    expect(form.sections.map((s) => [s.title, s.items.length])).toEqual([
      ["Dolor", 9],
      ["Discapacidad", 9],
      ["Limitación de actividad", 5],
    ]);
    for (const it of items) {
      expect(it.scale).toMatchObject({ from: 0, to: 10 });
      expect(it.na).toBe(true);
    }
    expect(getKind("ffi")!.subscales).toEqual(SUBSCALES);
  });

  it("todo a 0 → 0 en cada subescala y en el total; todo a 10 → 100", () => {
    expect(form.score(fill(0))).toEqual({ score: null, subscores: SUBSCALES.map((name) => ({ name, score: 0 })) });
    expect(form.score(fill(10)).subscores).toEqual(SUBSCALES.map((name) => ({ name, score: 100 })));
  });

  it("caso mixto: cada subescala sobre lo contestado; el total, media de las tres", () => {
    const a: Answers = {
      // Dolor: 7 contestados (p7 y p8 «No aplica», sin plantillas): 8 + 6 + 4 + 2 + 5 + 3 + 7 = 35 → 35/70 = 50.
      p1: 8,
      p2: 6,
      p3: 4,
      p4: 2,
      p5: 5,
      p6: 3,
      p7: null,
      p8: null,
      p9: 7,
      // Discapacidad: los 9, suman 10 → 10/90 = 11,1.
      ...Object.fromEntries(ids("Discapacidad").map((id, i) => [id, [1, 2, 3, 0, 0, 1, 2, 0, 1][i]])),
      // Limitación de actividad: 3 contestados (l1 y l2 sin responder): 0 + 0 + 5 → 5/30 = 16,7.
      l3: 0,
      l4: 0,
      l5: 5,
    };
    // Total: (50 + 11,11 + 16,67) / 3 = 25,9.
    expect(form.score(a).subscores).toEqual([
      { name: "Total", score: 25.9 },
      { name: "Dolor", score: 50 },
      { name: "Discapacidad", score: 11.1 },
      { name: "Limitación de actividad", score: 16.7 },
    ]);
  });

  it("respuestas que faltan: sin ninguna en una subescala, esa subescala y el total no salen; sin ninguna, no calcula", () => {
    const a = { ...fill(5), ...fill(null, ids("Limitación de actividad")) };
    expect(form.score(a).subscores).toEqual([
      { name: "Dolor", score: 50 },
      { name: "Discapacidad", score: 50 },
    ]);
    expect(() => form.score(fill(null))).toThrow(RangeError);
    expect(() => form.score({})).toThrow(/FFI necesita al menos una/);
  });

  it("la fuente empieza por las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("ffi")!.refs!)).toBe(true);
  });
});
