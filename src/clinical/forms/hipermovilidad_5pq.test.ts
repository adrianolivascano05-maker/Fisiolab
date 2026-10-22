import { describe, expect, it } from "vitest";
import { form } from "./hipermovilidad_5pq";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const POSITIVE = "Probable hipermovilidad (2 o más «sí»)";
const NEGATIVE = "Cribado negativo (menos de 2 «sí»)";

describe("5PQ", () => {
  it("5 preguntas: Sí 1, No 0", () => {
    expect(ids).toEqual(["i1", "i2", "i3", "i4", "i5"]);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([1, 0]);
  });
  it("todo «No» → 0, negativo; todo «Sí» → 5, positivo", () => {
    expect(form.score(all(0))).toEqual({ score: 0, text: NEGATIVE });
    expect(form.score(all(1))).toEqual({ score: 5, text: POSITIVE });
  });
  it("caso mixto: sí a las palmas y al pulgar, no a lo demás → 2, positivo justo en el punto de corte", () => {
    expect(form.score({ i1: 1, i2: 1, i3: 0, i4: 0, i5: 0 })).toEqual({ score: 2, text: POSITIVE });
  });
  it("punto de corte: 1 «sí» es negativo", () => {
    expect(form.score({ i1: 0, i2: 0, i3: 0, i4: 1, i5: 0 })).toEqual({ score: 1, text: NEGATIVE });
  });
  it("con respuestas sin contestar puntúa las contestadas y lo marca incompleto", () => {
    // Ya hay 2 «sí»: positivo aunque falte una.
    expect(form.score({ i1: 1, i2: 1, i3: 0, i4: 0 })).toEqual({ score: 2, text: `${POSITIVE} · Incompleto: falta 1 respuesta` });
    // 0 «sí» y falta una: aunque fuera «sí», no llegaría a 2 → negativo.
    expect(form.score({ i1: 0, i2: 0, i3: 0, i4: 0 })).toEqual({ score: 0, text: `${NEGATIVE} · Incompleto: falta 1 respuesta` });
    // 1 «sí» y faltan dos: no se puede descartar.
    const r = form.score({ i1: 1, i2: 0, i3: 0 });
    expect(r.score).toBe(1);
    expect(r.text).toBe("Por ahora, menos de 2 «sí»: con lo que falta no se puede descartar la hipermovilidad · Incompleto: faltan 2 respuestas");
  });
  it("sin ninguna respuesta no puntúa", () => {
    expect(() => form.score({})).toThrow(RangeError);
    expect(() => form.score({})).toThrow(/Faltan las 5/);
  });
});
