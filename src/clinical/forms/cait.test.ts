import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form, NEVER_SPRAINED } from "./cait";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const side = (prefix: string) => Array.from({ length: 9 }, (_, i) => `${prefix}${i + 1}`);
/** Las respuestas de un tobillo, en orden de ítem. */
const fill = (prefix: string, values: number[]): Answers => Object.fromEntries(side(prefix).map((id, i) => [id, values[i]]));
/** Lo mejor (más puntos) y lo peor (0) de cada ítem. */
const BEST = [5, 4, 3, 3, 2, 3, 4, 3, 3];
const WORST = [0, 0, 0, 0, 0, 0, 0, 0, 0];

describe("CAIT", () => {
  it("9 ítems por tobillo, con los puntos de cada respuesta", () => {
    expect(form.sections.map((s) => [s.title, s.items.length])).toEqual([
      ["Tobillo izquierdo", 9],
      ["Tobillo derecho", 9],
    ]);
    expect(getKind("cait")!.subscales).toEqual(form.sections.map((s) => s.title));
    const values = form.sections[0].items.map((it) => it.options!.map((o) => o.value));
    expect(values).toEqual([
      [5, 4, 3, 2, 1, 0],
      [4, 3, 2, 1, 0],
      [3, 2, 1, 0],
      [3, 2, 1, 0],
      [2, 1, 0],
      [3, 2, 1, 0],
      [4, 3, 2, 1, 0],
      [3, 2, 1, 0, NEVER_SPRAINED],
      [3, 2, 1, 0, NEVER_SPRAINED],
    ]);
    // Los dos tobillos con las mismas preguntas y respuestas.
    expect(form.sections[1].items.map((it) => [it.text, it.options])).toEqual(form.sections[0].items.map((it) => [it.text, it.options]));
    // Cada respuesta de un ítem se distingue de las demás.
    for (const it of items) expect(new Set(it.options!.map((o) => o.value)).size).toBe(it.options!.length);
    expect(items.find((it) => it.id === "i8")!.options!.at(-1)!.label).toBe("Nunca me he torcido el tobillo");
  });

  it("lo mejor en todo → 30 en cada tobillo; lo peor → 0", () => {
    const best = form.score({ ...fill("i", BEST), ...fill("d", BEST) });
    expect(best.score).toBeNull();
    expect(best.subscores).toEqual([
      { name: "Tobillo izquierdo", score: 30 },
      { name: "Tobillo derecho", score: 30 },
    ]);
    expect(form.score({ ...fill("i", WORST), ...fill("d", WORST) }).subscores!.map((s) => s.score)).toEqual([0, 0]);
  });

  it("«Nunca me he torcido el tobillo» puntúa 3, como «De inmediato» y «Casi de inmediato»", () => {
    const never = [...BEST.slice(0, 7), NEVER_SPRAINED, NEVER_SPRAINED];
    expect(form.score(fill("i", never)).subscores).toEqual([{ name: "Tobillo izquierdo", score: 30 }]);
  });

  it("caso mixto: 3 + 2 + 2 + 3 + 1 + 3 + 3 + 3 (nunca se lo ha torcido) + 1 = 21 en el izquierdo", () => {
    const r = form.score(fill("i", [3, 2, 2, 3, 1, 3, 3, NEVER_SPRAINED, 1]));
    expect(r.subscores).toEqual([{ name: "Tobillo izquierdo", score: 21 }]);
  });


  it("sin prorrateo: un tobillo a medias no tiene nota; sin ninguno completo, no calcula", () => {
    const partial = fill("d", BEST);
    delete partial.d9;
    const r = form.score({ ...fill("i", BEST), ...partial });
    expect(r.subscores).toEqual([{ name: "Tobillo izquierdo", score: 30 }]);
    // El tobillo sin contestar no se menciona.
    expect(() => form.score(partial)).toThrow(/Faltan 1 de las 9 respuestas del tobillo derecho/);
    expect(() => form.score({})).toThrow(RangeError);
    expect(() => form.score({})).toThrow(/Faltan las 9 respuestas de cada tobillo/);
  });

  it("la fuente empieza por las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("cait")!.refs!)).toBe(true);
  });
});
