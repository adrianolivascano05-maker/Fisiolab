import { describe, expect, it } from "vitest";
import { form } from "./abc";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("ABC", () => {
  it("16 ítems de 0 a 100 de 10 en 10, cada respuesta con su texto", () => {
    expect(ids).toHaveLength(16);
    for (const s of form.sections)
      for (const i of s.items) {
        expect(i.options!.map((o) => o.value)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
        expect(i.options![0].label).toBe("0 % (ninguna confianza)");
        expect(i.options![10].label).toBe("100 % (confianza total)");
      }
  });
  it("todo a 0 → 0 %; todo a 100 → 100 %, sin interpretación (el punto de corte de caídas está sin verificar)", () => {
    expect(form.score(all(0))).toEqual({ score: 0 });
    expect(form.score(all(100))).toEqual({ score: 100 });
  });
  it("caso mixto: ocho a 80 y ocho a 50 → 1040/16 = 65 %; y uno de 50 a 60 → 1050/16 = 65,6 %", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = i < 8 ? 80 : 50));
    expect(form.score(a).score).toBe(65);
    a.i16 = 60;
    expect(form.score(a).score).toBe(65.6);
  });
  it("los ítems en blanco no cuentan: media de los contestados", () => {
    // 15 contestados: catorce a 70 y uno a 40 → 1020/15 = 68 %.
    const a = all(70);
    delete a.i16;
    a.i1 = 40;
    expect(form.score(a).score).toBe(68);
    expect(form.score({ i3: 30 }).score).toBe(30);
  });
  it("sin ninguna respuesta no calcula", () => {
    expect(() => form.score({})).toThrow(RangeError);
    expect(() => form.score({})).toThrow(/Faltan las 16/);
  });
});
