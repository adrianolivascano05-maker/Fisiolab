import { describe, expect, it } from "vitest";
import { form } from "./s_lanss";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
/** «No» (o «no se nota diferente») en todo, o la respuesta que puntúa en todo. */
const none = (): Answers => Object.fromEntries(ids.map((id) => [id, 0]));
const yes = (): Answers => Object.fromEntries(items.map((i) => [i.id, i.options![1].value]));
const POSITIVE = "Probable dolor de origen neuropático (12 o más)";
const NEGATIVE = "Por debajo del punto de corte de dolor neuropático (menos de 12)";

describe("S-LANSS", () => {
  it("7 ítems (5 de síntomas y 2 de autoexploración) con el peso de cada «sí»: 5, 5, 3, 2, 1, 5 y 3", () => {
    expect(ids).toEqual(["i1", "i2", "i3", "i4", "i5", "i6", "i7"]);
    expect(form.sections.map((s) => [s.title, s.items.length])).toEqual([
      ["Síntomas", 5],
      ["Autoexploración", 2],
    ]);
    expect(items.map((i) => i.options!.map((o) => o.value))).toEqual([
      [0, 5],
      [0, 5],
      [0, 3],
      [0, 2],
      [0, 1],
      [0, 5],
      [0, 3],
    ]);
  });
  it("no en todo → 0; sí (o diferente) en todo → 24", () => {
    expect(form.score(none())).toEqual({ score: 0, text: NEGATIVE });
    expect(form.score(yes())).toEqual({ score: 24, text: POSITIVE });
  });
  it("caso mixto: pinchazos (5), cambio de color (5) y calor (1) → 11, por debajo del corte", () => {
    const a = { ...none(), i1: 5, i2: 5, i5: 1 };
    expect(form.score(a)).toEqual({ score: 11, text: NEGATIVE });
  });
  it("límite: pinchazos (5), cambio de color (5) y ráfagas (2) → 12, ya probable dolor neuropático", () => {
    const a = { ...none(), i1: 5, i2: 5, i4: 2 };
    expect(form.score(a)).toEqual({ score: 12, text: POSITIVE });
  });
  it("las autoexploraciones suman: sensible al tacto (3) + roce (5) + presión (3) → 11", () => {
    const a = { ...none(), i3: 3, i6: 5, i7: 3 };
    expect(form.score(a).score).toBe(11);
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = yes();
    delete a.i7;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 7/);
  });
});
