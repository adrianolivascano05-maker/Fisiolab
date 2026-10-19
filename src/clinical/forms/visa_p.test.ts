import { describe, expect, it } from "vitest";
import { form } from "./visa_p";
import type { Answers } from "./types";

const ids = form.sections.flatMap((s) => s.items.map((i) => i.id));
const base = (v: number): Answers => ({ 1: v, 2: v, 3: v, 4: v, 5: v, 6: v });

describe("VISA-P", () => {
  it("8 preguntas, la 8 en tres versiones con «No aplica»", () => {
    expect(ids).toEqual(["1", "2", "3", "4", "5", "6", "7", "8a", "8b", "8c"]);
    expect(form.sections[1].items.every((i) => i.na)).toBe(true);
  });
  it("lo mejor → 100; lo peor → 0", () => {
    expect(form.score({ ...base(10), 7: 10, "8a": 30, "8b": null, "8c": null }).score).toBe(100);
    expect(form.score({ ...base(0), 7: 0, "8a": null, "8b": null, "8c": 0 }).score).toBe(0);
  });
  it("sin la pregunta 8, con dos versiones de la 8 o con huecos no calcula", () => {
    expect(() => form.score({ ...base(5), 7: 4 })).toThrow(/pregunta 8/);
    expect(() => form.score({ ...base(5), 7: 4, "8a": 7, "8b": 4 })).toThrow(/solo se puede/);
    const a: Answers = { ...base(5), 7: 4, "8b": 10 };
    delete a[3];
    expect(() => form.score(a)).toThrow(RangeError);
  });
  it("caso mixto: 7+6+5+4+3+2 = 27, pregunta 7 = 7, 8b = 14 → 48", () => {
    const a: Answers = { 1: 7, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 7, "8a": null, "8b": 14, "8c": null };
    expect(form.score(a).score).toBe(48);
  });
});
