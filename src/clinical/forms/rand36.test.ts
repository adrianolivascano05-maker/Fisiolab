import { describe, expect, it } from "vitest";
import { form } from "./rand36";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const SCALES = ["Función física", "Rol físico", "Dolor corporal", "Salud general", "Vitalidad", "Función social", "Rol emocional", "Salud mental"];
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

// La mejor y la peor respuesta (posición 1, 2, 3…) de cada ítem, sacadas a mano de las instrucciones de RAND.
const BEST: Record<number, number> = {};
const WORST: Record<number, number> = {};
const put = (nums: number[], best: number, worst: number) => nums.forEach((n) => ((BEST[n] = best), (WORST[n] = worst)));
put([1, 2, 20, 22, 34, 36], 1, 5);
put(range(3, 12), 3, 1);
put(range(13, 19), 2, 1);
put([21, 23, 26, 27, 30], 1, 6);
put([24, 25, 28, 29, 31], 6, 1);
put([32, 33, 35], 5, 1);
const answers = (pick: Record<number, number>): Answers => Object.fromEntries(range(1, 36).map((n) => [`i${n}`, pick[n]]));

describe("RAND-36", () => {
  it("36 ítems, i1…i36 en orden, con las respuestas numeradas desde 1", () => {
    expect(items.map((it) => it.id)).toEqual(range(1, 36).map((n) => `i${n}`));
    const sizes = Object.fromEntries(items.map((it) => [it.id, it.options!.length]));
    for (const n of range(1, 36)) {
      const expected = n >= 3 && n <= 12 ? 3 : n >= 13 && n <= 19 ? 2 : [21, 23, 24, 25, 26, 27, 28, 29, 30, 31].includes(n) ? 6 : 5;
      expect(sizes[`i${n}`], `ítem ${n}`).toBe(expected);
    }
    for (const it of items) expect(it.options!.map((o) => o.value)).toEqual(range(1, it.options!.length));
  });

  it("las mejores respuestas son las que se esperan por su texto", () => {
    const label = (n: number, pos: number) => items[n - 1].options!.find((o) => o.value === pos)!.label;
    expect(label(1, BEST[1])).toBe("Excelente");
    expect(label(3, BEST[3])).toBe("No, no me limita nada");
    expect(label(13, BEST[13])).toBe("No");
    expect(label(21, BEST[21])).toBe("Ninguno");
    expect(label(24, BEST[24])).toBe("Nunca"); // muy nervioso
    expect(label(23, BEST[23])).toBe("Siempre"); // lleno de vitalidad
    expect(label(32, BEST[32])).toBe("Nunca");
    expect(label(33, BEST[33])).toBe("Totalmente falsa"); // me pongo enfermo más fácilmente
    expect(label(36, BEST[36])).toBe("Totalmente cierta"); // mi salud es excelente
  });

  it("todo lo mejor: 100 en las ocho escalas, en el orden del catálogo", () => {
    expect(form.score(answers(BEST))).toEqual({ score: null, subscores: SCALES.map((name) => ({ name, score: 100 })) });
  });

  it("todo lo peor: 0 en las ocho escalas", () => {
    expect(form.score(answers(WORST)).subscores!.map((s) => s.score)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("caso mixto calculado a mano", () => {
    const a: Answers = {
      // Función física: 0, 50 y ocho a 100 → 850 / 10 = 85.
      i3: 1,
      i4: 2,
      ...Object.fromEntries(range(5, 12).map((n) => [`i${n}`, 3])),
      // Rol físico: sí, sí, no, no → 0, 0, 100, 100 → 50.
      i13: 1,
      i14: 1,
      i15: 2,
      i16: 2,
      // Rol emocional: no, sí, no → 100, 0, 100 → 66,7.
      i17: 2,
      i18: 1,
      i19: 2,
      // Función social: «Un poco» (75) y «Solo alguna vez» (75) → 75.
      i20: 2,
      i32: 4,
      // Dolor corporal: «Moderado» (40) y «Moderadamente» (50) → 45.
      i21: 4,
      i22: 3,
      // Vitalidad: vitalidad «Muchas veces» (60), energía «Algunas veces» (40), agotado «Algunas veces» (60),
      // cansado «Casi siempre» (20) → 180 / 4 = 45.
      i23: 3,
      i27: 4,
      i29: 4,
      i31: 2,
      // Salud mental: nervioso «Solo alguna vez» (80), bajo de ánimo «Nunca» (100), tranquilo «Casi siempre» (80),
      // triste «Solo alguna vez» (80), feliz «Muchas veces» (60) → 400 / 5 = 80.
      i24: 5,
      i25: 6,
      i26: 2,
      i28: 5,
      i30: 3,
      // Salud general: «Buena» (50), enfermo fácil «Bastante cierta» (25), tan sano «Bastante cierta» (75),
      // empeorar «Bastante falsa» (75), excelente «No lo sé» (50) → 275 / 5 = 55.
      i1: 3,
      i33: 2,
      i34: 2,
      i35: 4,
      i36: 3,
      // No puntúa.
      i2: 4,
    };
    expect(form.score(a).subscores).toEqual([
      { name: "Función física", score: 85 },
      { name: "Rol físico", score: 50 },
      { name: "Dolor corporal", score: 45 },
      { name: "Salud general", score: 55 },
      { name: "Vitalidad", score: 45 },
      { name: "Función social", score: 75 },
      { name: "Rol emocional", score: 66.7 },
      { name: "Salud mental", score: 80 },
    ]);
    expect(form.score({ ...a, i2: 1 })).toEqual(form.score(a));
  });

  it("cada escala es la media de lo contestado; la que no tiene respuestas no sale", () => {
    // Dolor corporal solo con el 21 («Muy poco», 80); Salud general con 1 («Muy buena», 75) y 35 («Totalmente falsa», 100).
    expect(form.score({ i21: 2, i1: 2, i35: 5, i36: null })).toEqual({
      score: null,
      subscores: [
        { name: "Dolor corporal", score: 80 },
        { name: "Salud general", score: 87.5 },
      ],
    });
  });

  it("una respuesta fuera de rango cuenta como sin responder", () => {
    expect(form.score({ i13: 3, i14: 2 }).subscores).toEqual([{ name: "Rol físico", score: 100 }]);
  });

  it("sin ninguna escala calculable, lanza RangeError", () => {
    expect(() => form.score({})).toThrow(RangeError);
    expect(() => form.score({ i2: 3 })).toThrow(/Faltan respuestas/);
  });
});
