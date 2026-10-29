import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form } from "./marx";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("Marx", () => {
  it("4 actividades de 0 a 4", () => {
    expect(ids).toHaveLength(4);
    for (const s of form.sections) for (const i of s.items) expect(i.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
  });
  it("menos de una vez al mes en todo → 0; 4 o más veces por semana en todo → 16", () => {
    expect(form.score(all(0)).score).toBe(0);
    expect(form.score(all(4)).score).toBe(16);
  });
  it("caso mixto: corre 4 o más veces por semana (4), cambia de dirección 2-3 (3), frena 1 a la semana (2), no pivota (0) → 9", () => {
    const r = form.score({ i1: 4, i2: 3, i3: 2, i4: 0 });
    expect(r.score).toBe(9);
  });
  it("si falta alguna respuesta no calcula (sin prorrateo)", () => {
    const a = all(2);
    delete a.i4;
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 4/);
  });
  it("la fuente lleva las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("marx")!.refs!)).toBe(true);
  });
});
