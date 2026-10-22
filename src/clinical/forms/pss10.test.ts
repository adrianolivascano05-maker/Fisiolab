import { describe, expect, it } from "vitest";
import { form } from "./pss10";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const REVERSED = ["i4", "i5", "i7", "i8"];

describe("PSS-10", () => {
  it("10 ítems de 0 a 4 que empiezan por «En el último mes, ¿con qué frecuencia…»", () => {
    expect(ids).toHaveLength(10);
    for (const i of items) {
      expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
      expect(i.text).toMatch(/^En el último mes, ¿con qué frecuencia .+\?$/);
    }
    expect(items[0].text).toBe("En el último mes, ¿con qué frecuencia se ha sentido afectado por algo que ha ocurrido inesperadamente?");
  });
  it("lo menos estresante → 0; lo más estresante → 40 (4, 5, 7 y 8 invertidos)", () => {
    const best = all(0);
    for (const id of REVERSED) best[id] = 4;
    expect(form.score(best)).toEqual({ score: 0 });
    const worst = all(4);
    for (const id of REVERSED) worst[id] = 0;
    expect(form.score(worst)).toEqual({ score: 40 });
  });
  it("nunca en todo → 16 (los invertidos valen 4 cada uno); muy a menudo en todo → 24", () => {
    expect(form.score(all(0)).score).toBe(16);
    expect(form.score(all(4)).score).toBe(24);
  });
  it("caso mixto: cada pregunta vale su número módulo 5 → directos 1+2+3+1+4+0 = 11, invertidos 0+4+2+1 = 7 → 18", () => {
    // Directos: 1, 2, 3, 6, 9 y 10 → 1, 2, 3, 1, 4, 0. Invertidos: 4, 5, 7 y 8 marcados 4, 0, 2, 3 → 0, 4, 2, 1.
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = (i + 1) % 5));
    expect(form.score(a).score).toBe(18);
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(2);
    delete a.i5;
    delete a.i9;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 2 de las 10/);
  });
});
