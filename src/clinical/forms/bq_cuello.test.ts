import { describe, expect, it } from "vitest";
import { form } from "./bq_cuello";
import { form as lumbar } from "./bq_lumbar";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("BQ-C", () => {
  it("7 escalas de 0 a 10, con los mismos extremos que la versión lumbar", () => {
    expect(ids).toHaveLength(7);
    const lumbarItems = lumbar.sections.flatMap((s) => s.items);
    items.forEach((i, n) => expect(i.scale).toEqual(lumbarItems[n].scale));
  });
  it("habla del dolor de cuello, con los ejemplos de actividades diarias de la versión de cuello", () => {
    expect(form.instructions).toBe(
      "Las siguientes escalas sirven para medir cómo está su dolor de cuello y cómo le está afectando. Rodee con un círculo el número que mejor describa cómo se siente, pensando en la última semana.",
    );
    expect(items[0].text).toBe("Durante la última semana, de media, ¿cómo puntuaría su dolor de cuello?");
    expect(items[1].text).toBe(
      "Durante la última semana, ¿cuánto le ha impedido el dolor de cuello realizar sus actividades diarias (tareas de casa, lavarse, vestirse, levantar peso, leer, conducir)?",
    );
    for (const i of items) expect(i.text).not.toMatch(/espalda/);
    // Los ítems 4 y 5 (ansiedad y depresión) son iguales en las dos versiones.
    const lumbarItems = lumbar.sections.flatMap((s) => s.items);
    expect(items[3].text).toBe(lumbarItems[3].text);
    expect(items[4].text).toBe(lumbarItems[4].text);
  });
  it("todo 0 → 0; todo 10 → 70", () => {
    expect(form.score(all(0))).toEqual({ score: 0 });
    expect(form.score(all(10))).toEqual({ score: 70 });
  });
  it("caso mixto: 3 + 2 + 1 + 0 + 4 + 5 + 6 = 21", () => {
    expect(form.score({ i1: 3, i2: 2, i3: 1, i4: 0, i5: 4, i6: 5, i7: 6 }).score).toBe(21);
  });
  it("si falta un ítem no calcula", () => {
    const a = all(2);
    delete a.i1;
    delete a.i4;
    expect(() => form.score(a)).toThrow(/Faltan 2 de las 7 respuestas: el BQ-C/);
  });
});
