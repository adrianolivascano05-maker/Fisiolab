import { describe, expect, it } from "vitest";
import { ndi, odi, quickdash, spadi, tsk11 } from "./sheets";
import type { Answers, QuestionForm } from "./types";

const all = (f: QuestionForm, v: number, skip: string[] = []): Answers =>
  Object.fromEntries(f.sections.flatMap((s) => s.items).filter((i) => !skip.includes(i.id)).map((i) => [i.id, v]));

describe("hojas de respuestas", () => {
  it("NDI: 0-50 y prorrateo con un apartado sin contestar", () => {
    expect(ndi.score(all(ndi, 0))).toEqual({ score: 0, text: "Sin discapacidad" });
    expect(ndi.score(all(ndi, 5)).score).toBe(50);
    // 9 apartados con 2: 18 / 45 × 50 = 20
    expect(ndi.score(all(ndi, 2, ["n10"]))).toEqual({ score: 20, text: "Discapacidad moderada" });
    expect(() => ndi.score(all(ndi, 2, ["n9", "n10"]))).toThrow(RangeError);
  });
  it("Oswestry: porcentaje sobre los apartados contestados", () => {
    expect(odi.score(all(odi, 5)).score).toBe(100);
    // 8 apartados con 1: 8 / 40 = 20 %
    expect(odi.score(all(odi, 1, ["o8", "o9"]))).toEqual({ score: 20, text: "Limitación mínima" });
    expect(() => odi.score(all(odi, 1, ["o1", "o8", "o9"]))).toThrow(RangeError);
  });
  it("QuickDASH: ((media) − 1) × 25 con 10 de 11", () => {
    expect(quickdash.score(all(quickdash, 1)).score).toBe(0);
    expect(quickdash.score(all(quickdash, 5, ["d11"])).score).toBe(100);
    expect(quickdash.score(all(quickdash, 3)).score).toBe(50);
    expect(() => quickdash.score(all(quickdash, 3, ["d1", "d2"]))).toThrow(RangeError);
  });
  it("SPADI: media de dolor y discapacidad, «No aplica» en discapacidad", () => {
    expect(spadi.score(all(spadi, 0)).score).toBe(0);
    const a = { ...all(spadi, 10), sf1: null, sf2: null };
    expect(spadi.score(a).score).toBe(100);
    const b = { ...all(spadi, 5), sd1: 10 }; // dolor 30/50 = 60 %, discapacidad 50 %
    expect(spadi.score(b)).toEqual({ score: 55, subscores: [{ name: "Dolor", score: 60 }, { name: "Discapacidad", score: 50 }] });
    expect(() => spadi.score({ ...all(spadi, 5), sf1: null, sf2: null, sf3: null })).toThrow(RangeError);
  });
  it("TSK-11: suma de 11 a 44, todas obligatorias", () => {
    expect(tsk11.score(all(tsk11, 1)).score).toBe(11);
    expect(tsk11.score(all(tsk11, 4)).score).toBe(44);
    expect(() => tsk11.score(all(tsk11, 2, ["t3"]))).toThrow(RangeError);
  });
});
