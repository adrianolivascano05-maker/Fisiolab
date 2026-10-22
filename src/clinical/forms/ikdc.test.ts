import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form } from "./ikdc";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const byId = (id: string) => items.find((it) => it.id === id)!;
const NINE = "abcdefghi".split("").map((l) => `i9${l}`);

/** Todo lo mejor: las opciones en su valor más alto, frecuencia e intensidad del dolor a 0, función actual a 10. */
const best = (): Answers => ({
  ...Object.fromEntries(items.filter((it) => it.options).map((it) => [it.id, Math.max(...it.options!.map((o) => o.value))])),
  i2: 0,
  i3: 0,
  i10a: 10,
  i10b: 10,
});
/** Todo lo peor. */
const worst = (): Answers => ({
  ...Object.fromEntries(items.filter((it) => it.options).map((it) => [it.id, 0])),
  i2: 10,
  i3: 10,
  i10a: 0,
  i10b: 0,
});

describe("IKDC subjetivo", () => {
  it("18 ítems que puntúan más la función antes de la lesión (10a)", () => {
    expect(ids).toEqual(["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8", ...NINE, "i10a", "i10b"]);
    expect(new Set(ids).size).toBe(19);
    for (const id of ["i1", "i5", "i7", "i8"]) expect(byId(id).options!.map((o) => o.value)).toEqual([4, 3, 2, 1, 0]);
    expect(byId("i4").options!.map((o) => o.value)).toEqual([4, 3, 2, 1, 0]);
    expect(byId("i6").options!.map((o) => [o.value, o.label])).toEqual([
      [1, "No"],
      [0, "Sí"],
    ]);
    for (const id of NINE) expect(byId(id).options!.map((o) => o.value)).toEqual([4, 3, 2, 1, 0]);
    for (const id of ["i2", "i3", "i10a", "i10b"]) expect(byId(id).scale).toMatchObject({ from: 0, to: 10 });
  });
  it("todo lo mejor → 100 (suma 87 de 87); todo lo peor → 0", () => {
    expect(form.score(best()).score).toBe(100);
    expect(form.score(worst()).score).toBe(0);
  });
  it("los ítems 2 y 3 se invierten: marcar 10 resta todos sus puntos", () => {
    // 87 − 10 (ítem 2 marcado a 10) = 77 → 77/87 = 88,5.
    expect(form.score({ ...best(), i2: 10 }).score).toBe(88.5);
    expect(form.score({ ...best(), i3: 10 }).score).toBe(88.5);
  });
  it("la función antes de la lesión (10a) no cuenta", () => {
    expect(form.score({ ...worst(), i10a: 10 }).score).toBe(0);
    const a = best();
    delete a.i10a;
    expect(form.score(a).score).toBe(100);
  });
  it("caso mixto calculado a mano", () => {
    // Puntos: 1 → 2; 2 → 10 − 3 = 7; 3 → 10 − 4 = 6; 4 → 3; 5 → 2; 6 → 0 (sí); 7 → 3; 8 → 1;
    // 9a-9i → 4+4+3+3+2+2+1+1+0 = 20; 10b → 6 (10a = 9 no cuenta). Suma 50 de 87 → 57,47 → 57,5.
    const a: Answers = { i1: 2, i2: 3, i3: 4, i4: 3, i5: 2, i6: 0, i7: 3, i8: 1, i10a: 9, i10b: 6 };
    [4, 4, 3, 3, 2, 2, 1, 1, 0].forEach((v, i) => (a[NINE[i]] = v));
    expect(form.score(a).score).toBe(57.5);
    // Con 2 en blanco (el 3 y el 9i): 50 − 6 − 0 = 44 de 87 − 10 − 4 = 73 → 60,27 → 60,3.
    delete a.i3;
    delete a.i9i;
    expect(form.score(a).score).toBe(60.3);
  });
  it("con 16 de los 18 calcula; con 15 no (10a no cuenta para el mínimo)", () => {
    const a = best();
    delete a.i9a;
    delete a.i9b;
    expect(form.score(a).score).toBe(100);
    delete a.i9c;
    expect(() => form.score(a)).toThrow(/Faltan 3 de las 18/);
    a.i9c = null; // «No aplica» cuenta como sin responder.
    expect(() => form.score(a)).toThrow(/Faltan 3 de las 18/);
    expect(() => form.score({})).toThrow(/Faltan 18 de las 18/);
  });
  it("la fuente lleva las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("ikdc")!.refs!)).toBe(true);
  });
});
