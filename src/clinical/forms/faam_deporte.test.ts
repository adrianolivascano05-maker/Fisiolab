import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form } from "./faam_deporte";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number | null): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("FAAM Deporte", () => {
  it("8 ítems de 4 (ninguna dificultad) a 0 (no puedo hacerlo), con «No aplica»", () => {
    expect(ids).toHaveLength(8);
    for (const it of form.sections.flatMap((s) => s.items)) {
      expect(it.options!.map((o) => o.value)).toEqual([4, 3, 2, 1, 0]);
      expect(it.na).toBe(true);
    }
    expect(form.sections[0].items[0].options!.at(-1)!.label).toBe("No puedo hacerlo");
  });

  it("ninguna dificultad en todo → 100 %; no puedo hacerlo en todo → 0 %", () => {
    expect(form.score(all(4)).score).toBe(100);
    expect(form.score(all(0)).score).toBe(0);
  });

  it("caso mixto: 2 «No aplica» y 6 contestados (4 + 3 + 3 + 2 + 2 + 1 = 15) → 15/24 = 62,5 %", () => {
    const a: Answers = { i1: null, i2: null, i3: 4, i4: 3, i5: 3, i6: 2, i7: 2, i8: 1 };
    expect(form.score(a).score).toBe(62.5);
    // Uno sin responder cuenta igual que «No aplica»: 7 contestados (2 + 6 × 3 = 20) → 20/28 = 71,4 %.
    const b: Answers = { ...all(3), i1: 2 };
    delete b.i8;
    expect(form.score(b).score).toBe(71.4);
  });

  it("sin ninguna respuesta válida no calcula", () => {
    expect(() => form.score(all(null))).toThrow(RangeError);
    expect(() => form.score({})).toThrow(/al menos una/);
  });

  it("la fuente empieza por las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("faam_deporte")!.refs!)).toBe(true);
    expect(getKind("faam_deporte")!.unit).toBe("%");
  });
});
