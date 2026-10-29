import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form } from "./iprrs";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("I-PRRS", () => {
  it("6 ítems de 0 a 100 de 10 en 10, con los extremos y el centro dichos", () => {
    expect(ids).toHaveLength(6);
    for (const it of items) expect(it.options!.map((o) => o.value)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const labels = items[0].options!.map((o) => o.label);
    expect(labels[0]).toBe("0 de 100 (ninguna confianza)");
    expect(labels[1]).toBe("10 de 100");
    expect(labels[5]).toBe("50 de 100 (confianza moderada)");
    expect(labels[10]).toBe("100 de 100 (confianza total)");
  });

  it("todo a 100 → 60; todo a 0 → 0", () => {
    expect(form.score(all(100)).score).toBe(60);
    expect(form.score(all(0)).score).toBe(0);
  });

  it("caso mixto: 80 + 60 + 70 + 50 + 90 + 40 = 390 → 390 / 10 = 39", () => {
    const a: Answers = { i1: 80, i2: 60, i3: 70, i4: 50, i5: 90, i6: 40 };
    expect(form.score(a).score).toBe(39);
  });

  it("sin prorrateo: si falta alguna respuesta no calcula", () => {
    const a = all(50);
    delete a.i6;
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 6/);
    expect(() => form.score({})).toThrow(RangeError);
  });

  it("la fuente empieza por las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("iprrs")!.refs!)).toBe(true);
  });
});
