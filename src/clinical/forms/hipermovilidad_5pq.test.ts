import { describe, expect, it } from "vitest";
import { form } from "./hipermovilidad_5pq";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("5PQ", () => {
  it("5 preguntas: Sí 1, No 0", () => {
    expect(ids).toEqual(["i1", "i2", "i3", "i4", "i5"]);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([1, 0]);
  });
  it("todo «No» → 0; todo «Sí» → 5", () => {
    expect(form.score(all(0))).toEqual({ score: 0 });
    expect(form.score(all(1))).toEqual({ score: 5 });
  });
  it("caso mixto: sí a las palmas y al pulgar, no a lo demás → 2", () => {
    expect(form.score({ i1: 1, i2: 1, i3: 0, i4: 0, i5: 0 })).toEqual({ score: 2 });
  });
  it("con respuestas sin contestar puntúa las contestadas y dice cuántas se contestaron", () => {
    expect(form.score({ i1: 1, i2: 1, i3: 0, i4: 0 })).toEqual({ score: 2, subscores: [{ name: "Respuestas contestadas", score: 4, max: 5 }] });
    expect(form.score({ i1: 1, i2: 0, i3: 0 })).toEqual({ score: 1, subscores: [{ name: "Respuestas contestadas", score: 3, max: 5 }] });
  });
  it("sin ninguna respuesta no puntúa", () => {
    expect(() => form.score({})).toThrow(RangeError);
    expect(() => form.score({})).toThrow(/Faltan las 5/);
  });
});
