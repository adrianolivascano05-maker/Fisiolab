import { describe, expect, it } from "vitest";
import { form } from "./tmd_pain_screener";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const POSITIVE = /^Cribado positivo según el protocolo DC\/TMD .*orientativo, sin verificar\)$/;
const NEGATIVE = /^Por debajo del punto de corte .*orientativo, sin verificar\)$/;

describe("TMD Pain Screener", () => {
  it("6 ítems: el 1 de 0 a 2 y del 2 al 6, No = 0 y Sí = 1", () => {
    expect(ids).toEqual(["i1", "i2", "i3", "i4", "i5", "i6"]);
    expect(items[0].options).toEqual([
      { value: 0, label: "Sin dolor" },
      { value: 1, label: "El dolor va y viene" },
      { value: 2, label: "El dolor está siempre presente" },
    ]);
    for (const i of items.slice(1)) expect(i.options).toEqual([
      { value: 0, label: "No" },
      { value: 1, label: "Sí" },
    ]);
  });
  it("sin dolor y todo «No» → 0; dolor siempre presente y todo «Sí» → 7", () => {
    const none: Answers = { i1: 0, i2: 0, i3: 0, i4: 0, i5: 0, i6: 0 };
    expect(form.score(none).score).toBe(0);
    expect(form.score(none).text).toMatch(NEGATIVE);
    const worst: Answers = { i1: 2, i2: 1, i3: 1, i4: 1, i5: 1, i6: 1 };
    expect(form.score(worst).score).toBe(7);
    expect(form.score(worst).text).toMatch(POSITIVE);
  });
  it("caso mixto: el dolor va y viene (1) + rigidez al despertar (1) + masticar (1) + apretar los dientes (1) = 4", () => {
    expect(form.score({ i1: 1, i2: 1, i3: 1, i4: 0, i5: 1, i6: 0 }).score).toBe(4);
  });
  it("orientativo: 2 queda por debajo del corte y 3 ya es cribado positivo", () => {
    const two: Answers = { i1: 2, i2: 0, i3: 0, i4: 0, i5: 0, i6: 0 };
    expect(form.score(two)).toMatchObject({ score: 2, text: expect.stringMatching(NEGATIVE) });
    expect(form.score({ ...two, i6: 1 })).toMatchObject({ score: 3, text: expect.stringMatching(POSITIVE) });
  });
  it("si falta algún ítem no calcula", () => {
    expect(() => form.score({ i1: 1, i2: 1, i3: 1, i4: 1, i5: 1 })).toThrow(/Faltan 1 de las 6/);
    expect(() => form.score({})).toThrow(/Faltan 6 de las 6/);
  });
});
