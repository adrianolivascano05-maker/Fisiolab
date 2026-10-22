import { describe, expect, it } from "vitest";
import { form } from "./bq_lumbar";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("BQ-L", () => {
  it("7 escalas de 0 a 10, con el extremo peor en el 10", () => {
    expect(ids).toHaveLength(7);
    for (const i of items) expect(i.scale).toMatchObject({ from: 0, to: 10 });
    expect(items[0].scale!.ends).toEqual(["Sin dolor", "El peor dolor posible"]);
    expect(items[6].scale!.ends).toEqual(["Lo controlo por completo", "No lo controlo en absoluto"]);
  });
  it("habla del dolor de espalda, con los ejemplos de actividades diarias de la versión lumbar", () => {
    expect(form.instructions).toMatch(/su dolor de espalda/);
    expect(items[1].text).toBe(
      "Durante la última semana, ¿cuánto le ha impedido el dolor de espalda realizar sus actividades diarias (tareas de casa, lavarse, vestirse, caminar, subir escaleras, entrar o salir de la cama o de una silla)?",
    );
    expect(items[6].text).toBe("Durante la última semana, ¿cuánto ha podido controlar (reducir o aliviar) por sí mismo/a su dolor de espalda?");
  });
  it("todo 0 → 0; todo 10 → 70", () => {
    expect(form.score(all(0))).toEqual({ score: 0 });
    expect(form.score(all(10))).toEqual({ score: 70 });
  });
  it("caso mixto: 6 + 4 + 3 + 5 + 2 + 7 + 8 = 35 (el ítem 7 no se invierte)", () => {
    expect(form.score({ i1: 6, i2: 4, i3: 3, i4: 5, i5: 2, i6: 7, i7: 8 }).score).toBe(35);
  });
  it("si falta un ítem no calcula", () => {
    const a = all(5);
    delete a.i7;
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 7 respuestas: el BQ-L/);
  });
});
