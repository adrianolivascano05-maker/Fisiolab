import { describe, expect, it } from "vitest";
import { form as gad7 } from "./gad7";
import { form } from "./phq4";
import { form as phq9 } from "./phq9";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const itemOf = (f: typeof form, id: string) => f.sections.flatMap((s) => s.items).find((i) => i.id === id)!;

describe("PHQ-4", () => {
  it("4 ítems de 0 a 3: los 2 primeros del GAD-7 y los 2 primeros del PHQ-9, con su texto y sus respuestas", () => {
    expect(ids).toEqual(["i1", "i2", "i3", "i4"]);
    for (const i of items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3]);
    expect(items.map((i) => i.text)).toEqual([itemOf(gad7, "i1").text, itemOf(gad7, "i2").text, itemOf(phq9, "i1").text, itemOf(phq9, "i2").text]);
    expect(items[0].options).toEqual(itemOf(gad7, "i1").options);
    expect(form.instructions).toBe(
      "Piense en las últimas 2 semanas. En cada pregunta, marque con qué frecuencia le ha pasado. No hay respuestas buenas ni malas; responda a todas.",
    );
    expect(form.sections[0].intro).toBe("Durante las últimas 2 semanas, ¿con qué frecuencia le ha pasado lo siguiente?");
  });
  it("nunca en todo → 0, negativo; casi todos los días en todo → 12, los dos positivos", () => {
    expect(form.score(all(0))).toEqual({
      score: 0,
      subscores: [
        { name: "Ansiedad (GAD-2)", score: 0, max: 6 },
        { name: "Depresión (PHQ-2)", score: 0, max: 6 },
      ],
    });
    const worst = form.score(all(3));
    expect(worst.score).toBe(12);
    expect(worst.subscores!.map((s) => s.score)).toEqual([6, 6]);
  });
  it("caso mixto: nervioso 2 + preocupación 1 = GAD-2 de 3 (positivo); interés 1 + decaído 1 = PHQ-2 de 2 → total 5, leve", () => {
    const r = form.score({ i1: 2, i2: 1, i3: 1, i4: 1 });
    expect(r.score).toBe(5);
    expect(r.subscores).toEqual([
      { name: "Ansiedad (GAD-2)", score: 3, max: 6 },
      { name: "Depresión (PHQ-2)", score: 2, max: 6 },
    ]);
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(1);
    delete a.i4;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 4/);
  });
});
