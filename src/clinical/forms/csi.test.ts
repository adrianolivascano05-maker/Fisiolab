import { describe, expect, it } from "vitest";
import { form } from "./csi";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
/** Respuestas que suman `n`: de 4 en 4 desde la primera. */
const total = (n: number): Answers => Object.fromEntries(ids.map((id, i) => [id, Math.min(4, Math.max(0, n - 4 * i))]));

describe("CSI", () => {
  it("25 ítems de 0 a 4", () => {
    expect(ids).toHaveLength(25);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
  });
  it("nunca en todo → 0, subclínico; siempre en todo → 100, extremo", () => {
    expect(form.score(all(0))).toEqual({ score: 0, text: "Nivel subclínico" });
    expect(form.score(all(4))).toEqual({ score: 100, text: "Nivel extremo · Sugiere sensibilización central (40 o más)" });
  });
  it("caso mixto: 0, 1, 2, 3, 4 cinco veces → 50, grave", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = i % 5));
    expect(form.score(a)).toEqual({ score: 50, text: "Nivel grave · Sugiere sensibilización central (40 o más)" });
  });
  it("bandas: 29 subclínico, 30-39 leve, 40-49 moderado, 50-59 grave, 60 extremo", () => {
    expect(form.score(total(29)).text).toBe("Nivel subclínico");
    expect(form.score(total(30)).text).toBe("Nivel leve");
    expect(form.score(total(39)).text).toBe("Nivel leve");
    expect(form.score(total(40)).text).toBe("Nivel moderado · Sugiere sensibilización central (40 o más)");
    expect(form.score(total(49)).text).toMatch(/^Nivel moderado/);
    expect(form.score(total(59)).text).toMatch(/^Nivel grave/);
    expect(form.score(total(60)).text).toMatch(/^Nivel extremo/);
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(2);
    delete a.i24;
    expect(() => form.score(a)).toThrow(/Faltan 1/);
  });
});
