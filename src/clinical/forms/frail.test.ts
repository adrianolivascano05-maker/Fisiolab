import { describe, expect, it } from "vitest";
import { form } from "./frail";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const DISEASES = ids.filter((id) => id.startsWith("e"));

/** Respuestas con `sick` enfermedades marcadas «Sí» y el peso de ahora y de hace un año. */
const make = (o: { f1: number; f2: number; f3: number; sick: number; now: number; yearAgo: number }): Answers => {
  const a: Answers = { f1: o.f1, f2: o.f2, f3: o.f3, w1: o.now, w2: o.yearAgo };
  DISEASES.forEach((id, i) => (a[id] = i < o.sick ? 1 : 0));
  return a;
};
const robust = { f1: 5, f2: 0, f3: 0, sick: 0, now: 70, yearAgo: 70 };

describe("FRAIL", () => {
  it("fatiga con 5 respuestas, resistencia y deambulación Sí/No, 11 enfermedades Sí/No y dos pesos en kg", () => {
    expect(ids).toHaveLength(3 + 11 + 2);
    expect(items[0].options!.map((o) => o.label)).toEqual(["Siempre", "Casi siempre", "Algunas veces", "Pocas veces", "Nunca"]);
    expect(items[0].options!.map((o) => o.value)).toEqual([1, 2, 3, 4, 5]);
    for (const id of ["f2", "f3", ...DISEASES]) expect(items.find((i) => i.id === id)!.options!.map((o) => o.value)).toEqual([1, 0]);
    expect(DISEASES).toHaveLength(11);
    for (const id of ["w1", "w2"]) expect(items.find((i) => i.id === id)!.input!.unit).toBe("kg");
  });
  it("nada de nada → 0; todos los componentes → 5", () => {
    expect(form.score(make(robust))).toEqual({ score: 0 });
    expect(form.score(make({ f1: 1, f2: 1, f3: 1, sick: 11, now: 60, yearAgo: 70 }))).toEqual({ score: 5 });
  });
  it("fatiga: «Siempre» y «Casi siempre» puntúan 1; «Algunas veces», «Pocas veces» y «Nunca», 0", () => {
    const fatigue = (f1: number) => form.score(make({ ...robust, f1 })).score;
    expect([1, 2, 3, 4, 5].map(fatigue)).toEqual([1, 1, 0, 0, 0]);
  });
  it("enfermedades: 4 marcadas puntúan 0; 5 ya puntúan 1", () => {
    expect(form.score(make({ ...robust, sick: 4 })).score).toBe(0);
    expect(form.score(make({ ...robust, sick: 5 })).score).toBe(1);
  });
  it("pérdida de peso: justo el 5 % no puntúa; más del 5 %, sí", () => {
    // De 100 a 95 kg: (100 − 95) ÷ 100 × 100 = 5 % → 0. De 100 a 94,9 kg: 5,1 % → 1.
    expect(form.score(make({ ...robust, now: 95, yearAgo: 100 })).score).toBe(0);
    expect(form.score(make({ ...robust, now: 94.9, yearAgo: 100 })).score).toBe(1);
    // Con decimales: de 80,2 a 76,19 kg es exactamente el 5 % → 0; a 76,18 kg ya pasa → 1.
    expect(form.score(make({ ...robust, now: 76.19, yearAgo: 80.2 })).score).toBe(0);
    expect(form.score(make({ ...robust, now: 76.18, yearAgo: 80.2 })).score).toBe(1);
    // Si ha ganado peso, no puntúa.
    expect(form.score(make({ ...robust, now: 80, yearAgo: 70 })).score).toBe(0);
  });
  it("caso mixto: casi siempre cansado (1) + le cuesta subir escaleras (1) + camina bien (0) + 3 enfermedades (0) + de 72 a 68 kg, 5,6 % (1) → 3", () => {
    expect(form.score(make({ f1: 2, f2: 1, f3: 0, sick: 3, now: 68, yearAgo: 72 }))).toEqual({ score: 3 });
  });
  it("si falta un componente no calcula, y dice cuál", () => {
    const a = make(robust);
    delete a.w2;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan respuestas en 1 de los 5 componentes \(pérdida de peso\)/);
    const b = make(robust);
    delete b.f1;
    delete b.e7;
    expect(() => form.score(b)).toThrow(/2 de los 5 componentes \(fatiga, enfermedades\)/);
  });
});
