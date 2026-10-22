import { describe, expect, it } from "vitest";
import { form } from "./iciq_ui_sf";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const item = (id: string) => items.find((i) => i.id === id)!;
const SITUATIONS = items.filter((i) => i.id.startsWith("s"));

describe("ICIQ-UI SF", () => {
  it("3 preguntas que puntúan (0-5, 0/2/4/6 y escala 0-10) y 8 situaciones Sí/No que no puntúan", () => {
    expect(items).toHaveLength(3 + 8);
    expect(item("i1").options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(item("i2").options!.map((o) => o.value)).toEqual([0, 2, 4, 6]);
    expect(item("i3").scale).toMatchObject({ from: 0, to: 10, ends: ["Nada", "Mucho"] });
    expect(SITUATIONS).toHaveLength(8);
    for (const s of SITUATIONS) expect(s.options!.map((o) => o.value)).toEqual([1, 0]);
  });
  it("sin pérdidas → 0, sin tramo de gravedad; todo al máximo → 21, muy grave", () => {
    expect(form.score({ i1: 0, i2: 0, i3: 0 })).toEqual({ score: 0 });
    expect(form.score({ i1: 5, i2: 6, i3: 10 })).toEqual({ score: 21, text: "Incontinencia muy grave (19-21)" });
  });
  it("caso mixto: dos o tres veces a la semana (2) + muy poca cantidad (2) + impacto 4 → 8, moderada", () => {
    expect(form.score({ i1: 2, i2: 2, i3: 4 })).toEqual({ score: 8, text: "Incontinencia moderada (6-12)" });
  });
  it("las situaciones no cambian la nota", () => {
    const a: Answers = { i1: 2, i2: 2, i3: 4 };
    for (const s of SITUATIONS) a[s.id] = 1;
    expect(form.score(a).score).toBe(8);
  });
  it("tramos de Klovning en sus límites: 1, 5, 6, 12, 13, 18 y 19", () => {
    const text = (i3: number) => form.score({ i1: 0, i2: 0, i3 }).text;
    expect(text(1)).toBe("Incontinencia leve (1-5)");
    expect(text(5)).toBe("Incontinencia leve (1-5)");
    expect(text(6)).toBe("Incontinencia moderada (6-12)");
    expect(text(10)).toBe("Incontinencia moderada (6-12)");
    expect(form.score({ i1: 2, i2: 0, i3: 10 }).text).toBe("Incontinencia moderada (6-12)");
    expect(form.score({ i1: 3, i2: 0, i3: 10 }).text).toBe("Incontinencia grave (13-18)");
    expect(form.score({ i1: 2, i2: 6, i3: 10 }).text).toBe("Incontinencia grave (13-18)");
    expect(form.score({ i1: 3, i2: 6, i3: 10 }).text).toBe("Incontinencia muy grave (19-21)");
  });
  it("si falta una pregunta que puntúa no calcula; las situaciones pueden quedar en blanco", () => {
    expect(() => form.score({ i1: 3, i3: 5 })).toThrow(RangeError);
    expect(() => form.score({ i1: 3, i3: 5 })).toThrow(/Faltan 1 de las 3/);
    expect(form.score({ i1: 1, i2: 2, i3: 0 }).score).toBe(3);
  });
});
