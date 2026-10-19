import { describe, expect, it } from "vitest";
import { form } from "./pcs";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("PCS", () => {
  it("13 ítems de 0 a 4", () => {
    expect(ids).toHaveLength(13);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
  });
  it("nada en todo → 0; todo el tiempo en todo → 52, con las subescalas al máximo", () => {
    const best = form.score(all(0));
    expect(best.score).toBe(0);
    expect(best.text).toMatch(/^Por debajo/);
    const worst = form.score(all(4));
    expect(worst.score).toBe(52);
    expect(worst.subscores).toEqual([
      { name: "Rumiación", score: 16, max: 16 },
      { name: "Magnificación", score: 12, max: 12 },
      { name: "Indefensión", score: 24, max: 24 },
    ]);
    expect(worst.text).toMatch(/^Catastrofismo clínicamente relevante/);
  });
  it("caso mixto: cada frase vale su número módulo 5 → 1+2+3+4+0+1+2+3+4+0+1+2+3 = 26", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = (i + 1) % 5));
    const r = form.score(a);
    expect(r.score).toBe(26);
    // Rumiación 8-11: 3+4+0+1; magnificación 6, 7, 13: 1+2+3; indefensión 1-5 y 12: 1+2+3+4+0+2.
    expect(r.subscores).toEqual([
      { name: "Rumiación", score: 8, max: 16 },
      { name: "Magnificación", score: 6, max: 12 },
      { name: "Indefensión", score: 12, max: 24 },
    ]);
    expect(r.text).toMatch(/^Por debajo/);
  });
  it("30 ya es catastrofismo clínicamente relevante", () => {
    const a = all(2);
    a.i1 = 4;
    a.i2 = 4;
    expect(form.score(a).score).toBe(30);
    expect(form.score(a).text).toMatch(/^Catastrofismo clínicamente relevante/);
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(1);
    delete a.i13;
    expect(() => form.score(a)).toThrow(/Faltan 1/);
  });
});
