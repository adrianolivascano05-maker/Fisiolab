import { describe, expect, it } from "vitest";
import { QUESTIONNAIRES } from "../questionnaires";
import { form, recodePain } from "./promis_10";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const GPH = "Salud física global (GPH)";
const GMH = "Salud mental global (GMH)";

/** Todos los ítems de 1 a 5 con el mismo valor y el dolor (0-10) aparte. */
const all = (v: number, pain: number): Answers => ({ ...Object.fromEntries(ids.map((id) => [id, v])), g07: pain });

describe("PROMIS-10", () => {
  it("10 ítems en el orden del cuestionario: nueve de 5 a 1 y el dolor de 0 a 10", () => {
    expect(ids).toEqual(["g01", "g02", "g03", "g04", "g05", "g09", "g06", "g10", "g08", "g07"]);
    for (const i of items.filter((it) => it.id !== "g07")) expect(i.options!.map((o) => o.value)).toEqual([5, 4, 3, 2, 1]);
    expect(items.find((i) => i.id === "g07")!.scale).toMatchObject({ from: 0, to: 10 });
  });
  it("las escalas son las subescalas del catálogo", () => {
    expect(QUESTIONNAIRES.find((q) => q.id === "promis_10")!.subscales).toEqual([GPH, GMH]);
  });
  it("recodificación del dolor: 0 → 5; 1-3 → 4; 4-6 → 3; 7-9 → 2; 10 → 1", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(recodePain)).toEqual([5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1]);
  });
  it("todo lo mejor (y sin dolor) → 20 y 20; todo lo peor (y dolor 10) → 4 y 4, sin nota total", () => {
    expect(form.score(all(5, 0))).toEqual({
      score: null,
      subscores: [
        { name: GPH, score: 20 },
        { name: GMH, score: 20 },
      ],
      text: "Puntuaciones brutas (4-20): para la puntuación T, usar la tabla oficial de HealthMeasures.",
    });
    expect(form.score(all(1, 10)).subscores!.map((s) => s.score)).toEqual([4, 4]);
  });
  it("caso mixto calculado a mano", () => {
    // GPH: salud física (g03) 3 + actividades físicas (g06) 4 + dolor 5 → 3 + fatiga (g08) 2 = 12.
    // GMH: calidad de vida (g02) 4 + salud mental (g04) 2 + satisfacción social (g05) 3 + problemas emocionales (g10) 1 = 10.
    // Salud general (g01) y rol social (g09) no entran en ninguna escala.
    const a: Answers = { g01: 1, g02: 4, g03: 3, g04: 2, g05: 3, g09: 5, g06: 4, g10: 1, g08: 2, g07: 5 };
    expect(form.score(a).subscores).toEqual([
      { name: GPH, score: 12 },
      { name: GMH, score: 10 },
    ]);
    expect(form.score({ ...a, g01: 5, g09: 1 }).subscores).toEqual(form.score(a).subscores);
  });
  it("si falta un ítem de una escala, esa escala no se calcula", () => {
    const noPain = all(3, 5);
    delete noPain.g07;
    expect(form.score(noPain).subscores).toEqual([{ name: GMH, score: 12 }]);
    const noMood = all(3, 5);
    delete noMood.g10;
    expect(form.score(noMood).subscores).toEqual([{ name: GPH, score: 12 }]);
  });
  it("si no se puede calcular ninguna escala no calcula", () => {
    expect(() => form.score({ g01: 3, g09: 3, g03: 3, g02: 3 })).toThrow(RangeError);
    expect(() => form.score({})).toThrow(/Faltan respuestas/);
  });
});
