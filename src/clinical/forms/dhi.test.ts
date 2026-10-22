import { describe, expect, it } from "vitest";
import { form } from "./dhi";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));
const P = [1, 4, 8, 11, 13, 17, 25];
const E = [2, 9, 10, 15, 18, 20, 21, 22, 23];
const F = [3, 5, 6, 7, 12, 14, 16, 19, 24];

/** Total exacto (par) con «Sí» y «A veces» desde la pregunta 1. */
const totalOf = (n: number): Answers => {
  const a = all(0);
  let left = n;
  for (const id of ids) {
    const v = Math.min(4, left);
    a[id] = v;
    left -= v;
  }
  return a;
};

describe("DHI", () => {
  it("25 preguntas: Sí 4, A veces 2, No 0; las subescalas se reparten 7 + 9 + 9", () => {
    expect(ids).toHaveLength(25);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([4, 2, 0]);
    expect(P.length + E.length + F.length).toBe(25);
    expect(new Set([...P, ...E, ...F]).size).toBe(25);
  });
  it("todo «No» → 0, leve; todo «Sí» → 100, grave, con las subescalas al máximo", () => {
    expect(form.score(all(0))).toEqual({
      score: 0,
      subscores: [
        { name: "Física (P)", score: 0, max: 28 },
        { name: "Emocional (E)", score: 0, max: 36 },
        { name: "Funcional (F)", score: 0, max: 36 },
      ],
      text: "Discapacidad por mareo leve (0-30)",
    });
    const worst = form.score(all(4));
    expect(worst.score).toBe(100);
    expect(worst.subscores).toEqual([
      { name: "Física (P)", score: 28, max: 28 },
      { name: "Emocional (E)", score: 36, max: 36 },
      { name: "Funcional (F)", score: 36, max: 36 },
    ]);
    expect(worst.text).toBe("Discapacidad por mareo grave (61-100)");
  });
  it("caso mixto: «Sí» en las físicas, «A veces» en las emocionales y «No» en las funcionales → 28 + 18 + 0 = 46, moderada", () => {
    const a: Answers = {};
    for (const n of P) a[`i${n}`] = 4;
    for (const n of E) a[`i${n}`] = 2;
    for (const n of F) a[`i${n}`] = 0;
    const r = form.score(a);
    expect(r.score).toBe(46);
    expect(r.subscores!.map((s) => s.score)).toEqual([28, 18, 0]);
    expect(r.text).toBe("Discapacidad por mareo moderada (31-60)");
  });
  it("tramos de Whitney: 30 leve, 32 moderada, 60 moderada, 62 grave (el total siempre es par)", () => {
    expect(form.score(totalOf(30)).score).toBe(30);
    expect(form.score(totalOf(30)).text).toMatch(/leve/);
    expect(form.score(totalOf(32)).text).toMatch(/moderada/);
    expect(form.score(totalOf(60)).score).toBe(60);
    expect(form.score(totalOf(60)).text).toMatch(/moderada/);
    expect(form.score(totalOf(62)).text).toMatch(/grave/);
  });
  it("si falta alguna respuesta no calcula (el total queda incompleto)", () => {
    const a = all(2);
    delete a.i25;
    expect(() => form.score(a)).toThrow(RangeError);
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 25/);
  });
});
