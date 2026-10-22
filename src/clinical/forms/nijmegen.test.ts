import { describe, expect, it } from "vitest";
import { form } from "./nijmegen";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const HIGH = "Sugestivo de síndrome de hiperventilación (23 o más)";
const LOW = "Por debajo del punto de corte de síndrome de hiperventilación (23)";

describe("Nijmegen", () => {
  it("16 síntomas de 0 a 4", () => {
    expect(ids).toHaveLength(16);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
  });
  it("nunca en todo → 0; muy a menudo en todo → 64", () => {
    expect(form.score(all(0))).toEqual({ score: 0, text: LOW });
    expect(form.score(all(4))).toEqual({ score: 64, text: HIGH });
  });
  it("caso mixto: cada síntoma vale su número módulo 5 → (1+2+3+4+0) × 3 + 1 = 31", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = (i + 1) % 5));
    expect(form.score(a)).toEqual({ score: 31, text: HIGH });
  });
  it("punto de corte: 22 todavía no, 23 ya es sugestivo", () => {
    // Siete a 3 y uno a 1 → 22; ese último a 2 → 23.
    const a = all(0);
    ids.slice(0, 7).forEach((id) => (a[id] = 3));
    a.i8 = 1;
    expect(form.score(a)).toEqual({ score: 22, text: LOW });
    a.i8 = 2;
    expect(form.score(a)).toEqual({ score: 23, text: HIGH });
  });
  it("si falta alguna respuesta no calcula", () => {
    const a = all(1);
    delete a.i16;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 16/);
  });
});
