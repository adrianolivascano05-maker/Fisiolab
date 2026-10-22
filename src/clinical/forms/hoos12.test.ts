import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form as hoos } from "./hoos";
import { form } from "./hoos12";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((it) => it.id));
const fill = (value: number | null): Answers => Object.fromEntries(ids.map((id) => [id, value]));
const hoosItems = hoos.sections.flatMap((s) => s.items);

describe("HOOS-12", () => {
  it("12 ítems del HOOS de la app (dolor 4, función 4, calidad de vida 4), con su texto y sus respuestas tal cual", () => {
    expect(form.sections.map((s) => [s.title, s.items.map((it) => it.id)])).toEqual([
      ["Dolor", ["p1", "p7", "p4", "p5"]],
      ["Función", ["a4", "a3", "a7", "sp4"]],
      ["Calidad de vida", ["q1", "q2", "q3", "q4"]],
    ]);
    for (const it of form.sections.flatMap((s) => s.items)) {
      expect(it).toBe(hoosItems.find((h) => h.id === it.id));
      expect(it.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
    }
    expect(form.instructions).toBe(hoos.instructions);
    expect(form.sections[0].items.map((it) => it.text)).toEqual([
      "¿Con qué frecuencia le duele la cadera?",
      "Sentado o tumbado",
      "Al caminar sobre una superficie plana",
      "Al subir o bajar escaleras",
    ]);
    expect(form.sections[1].items.map((it) => it.text)).toEqual([
      "Estar de pie",
      "Levantarse estando sentado",
      "Entrar o salir de un coche",
      "Caminar sobre una superficie irregular",
    ]);
  });
  it("las subescalas y el resumen son las del catálogo", () => {
    expect(getKind("hoos12")!.subscales).toEqual(["Dolor", "Función", "Calidad de vida", "Resumen"]);
  });
  it("todo lo mejor (0) → 100 en todo; todo lo peor (4) → 0 en todo", () => {
    expect(form.score(fill(0)).subscores!.map((s) => [s.name, s.score])).toEqual([
      ["Dolor", 100],
      ["Función", 100],
      ["Calidad de vida", 100],
      ["Resumen", 100],
    ]);
    expect(form.score(fill(4)).subscores!.map((s) => s.score)).toEqual([0, 0, 0, 0]);
  });
  it("caso mixto: el resumen sale de las subescalas sin redondear", () => {
    // Dolor 1, 1, 0 (p5 en blanco) → media 2/3 → 83,33 → 83,3; función 4, 4, 4, 4 → 0; calidad de vida 1, 1, 1, 1
    // → 75. Resumen: (83,33 + 0 + 75) / 3 = 52,78 → 52,8.
    const a: Answers = { p1: 1, p7: 1, p4: 0, a4: 4, a3: 4, a7: 4, sp4: 4, q1: 1, q2: 1, q3: 1, q4: 1 };
    expect(form.score(a).subscores).toEqual([
      { name: "Dolor", score: 83.3 },
      { name: "Función", score: 0 },
      { name: "Calidad de vida", score: 75 },
      { name: "Resumen", score: 52.8 },
    ]);
  });
  it("con 3 en blanco en una subescala la omite y no hay resumen; sin respuestas, no calcula", () => {
    const a = fill(2);
    delete a.q1;
    delete a.q2;
    delete a.q3;
    expect(form.score(a).subscores).toEqual([
      { name: "Dolor", score: 50 },
      { name: "Función", score: 50 },
    ]);
    expect(() => form.score({})).toThrow(/Faltan 12 de las 12/);
  });
  it("la fuente lleva las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("hoos12")!.refs!)).toBe(true);
  });
});
