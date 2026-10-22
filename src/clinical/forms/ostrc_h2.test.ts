import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form } from "./ostrc_h2";

const items = form.sections.flatMap((s) => s.items);

describe("OSTRC-H2", () => {
  it("4 preguntas con los puntos de cada respuesta", () => {
    expect(items.map((it) => it.id)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(items.map((it) => it.options!.map((o) => o.value))).toEqual([
      [0, 8, 17, 25],
      [0, 6, 13, 19, 25],
      [0, 6, 13, 19, 25],
      [0, 8, 17, 25],
    ]);
    expect(items[0].options![0].label).toBe("Participación completa sin problemas de salud");
  });

  it("sin problemas en la pregunta 1 → 0, aunque no conteste las demás", () => {
    expect(form.score({ p1: 0 })).toEqual({ score: 0, text: "Sin problemas de salud en la última semana" });
    // Lo demás se rellena con 0 (lógica v2): no cuenta aunque se haya marcado.
    expect(form.score({ p1: 0, p2: 25, p3: 19, p4: 17 }).score).toBe(0);
  });

  it("lo peor en todo → 100, problema importante", () => {
    const r = form.score({ p1: 25, p2: 25, p3: 25, p4: 25 });
    expect(r.score).toBe(100);
    expect(r.text).toMatch(/^Problema importante/);
    expect(r.text).toMatch(/lesión o enfermedad, la zona o los síntomas y los días sin poder entrenar/);
  });

  it("caso mixto: 17 (participación reducida) + 6 + 13 + 8 = 44, importante por la pregunta 3", () => {
    const r = form.score({ p1: 17, p2: 6, p3: 13, p4: 8 });
    expect(r.score).toBe(44);
    expect(r.text).toMatch(/^Problema importante/);
  });

  it("problema importante en su límite: «en moderada medida» (13) en la 2 o la 3 sí; «en poca medida» (6) no", () => {
    const minor = form.score({ p1: 8, p2: 6, p3: 6, p4: 17 });
    expect(minor.score).toBe(37);
    expect(minor.text).toMatch(/^Problema de salud no importante/);
    // Síntomas intensos solos no lo hacen importante.
    expect(form.score({ p1: 8, p2: 0, p3: 0, p4: 25 }).text).toMatch(/^Problema de salud no importante/);
    expect(form.score({ p1: 8, p2: 13, p3: 6, p4: 17 }).text).toMatch(/^Problema importante/);
    expect(form.score({ p1: 8, p2: 6, p3: 13, p4: 17 }).text).toMatch(/^Problema importante/);
  });

  it("respuestas que faltan: sin la 1 no calcula; con problema, hacen falta las 4", () => {
    expect(() => form.score({})).toThrow(/Falta la pregunta 1/);
    expect(() => form.score({ p2: 0, p3: 0, p4: 0 })).toThrow(RangeError);
    expect(() => form.score({ p1: 8, p2: 6, p3: 6 })).toThrow(/Faltan 1 de las 4/);
  });

  it("la fuente empieza por las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("ostrc_h2")!.refs!)).toBe(true);
  });
});
