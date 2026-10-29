import { describe, expect, it } from "vitest";
import { form } from "./bipq";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const REVERSED = ["i3", "i4", "i7"];
const NAMES = ["Consecuencias", "Duración", "Control", "Eficacia del tratamiento", "Síntomas", "Preocupación", "Comprensión", "Impacto emocional"];

describe("Brief IPQ", () => {
  it("8 ítems puntuables de 0 a 10 con sus extremos (la pregunta 9, de texto libre, no se incluye)", () => {
    expect(ids).toEqual(["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8"]);
    for (const i of items) expect(i.scale).toMatchObject({ from: 0, to: 10 });
    expect(items[2].scale!.ends).toEqual(["Ningún control", "Control total"]);
    expect(items[6].scale!.ends).toEqual(["No lo entiendo nada", "Lo entiendo muy claramente"]);
  });
  it("lo menos amenazante → 0; lo más amenazante → 80 (3, 4 y 7 invertidos)", () => {
    const best = all(0);
    for (const id of REVERSED) best[id] = 10;
    expect(form.score(best).score).toBe(0);
    const worst = all(10);
    for (const id of REVERSED) worst[id] = 0;
    expect(form.score(worst).score).toBe(80);
  });
  it("todo a 0 → 30 (los invertidos valen 10 cada uno); todo a 10 → 50", () => {
    expect(form.score(all(0)).score).toBe(30);
    expect(form.score(all(10)).score).toBe(50);
  });
  it("caso mixto: 7+5+6+9+2 = 29 directos y (10−3)+(10−8)+(10−4) = 15 invertidos → 44; cada ítem suelto, sin invertir", () => {
    const a: Answers = { i1: 7, i2: 5, i3: 3, i4: 8, i5: 6, i6: 9, i7: 4, i8: 2 };
    const r = form.score(a);
    expect(r.score).toBe(44);
    expect(r.subscores).toEqual(NAMES.map((name, i) => ({ name, score: a[`i${i + 1}`], max: 10 })));
  });
  it("si falta algún ítem del 1 al 8 no calcula el total", () => {
    const a = all(5);
    delete a.i3;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 8/);
    expect(() => form.score({})).toThrow(/Faltan 8 de las 8/);
  });
});
