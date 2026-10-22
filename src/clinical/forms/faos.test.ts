import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form } from "./faos";
import { form as koos } from "./koos";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = (title?: string) => form.sections.filter((s) => !title || s.title === title).flatMap((s) => s.items.map((it) => it.id));
const fill = (value: number | null, only = ids()): Answers => Object.fromEntries(only.map((id) => [id, value]));
const text = (id: string) => items.find((it) => it.id === id)!.text;
const SUBSCALES = ["Dolor", "Síntomas", "AVD", "Deporte y ocio", "Calidad de vida"];

describe("FAOS", () => {
  it("los 42 ítems del KOOS, con sus ids, apartados y respuestas de 0 a 4", () => {
    expect(ids()).toHaveLength(42);
    expect(ids()).toEqual(koos.sections.flatMap((s) => s.items.map((it) => it.id)));
    expect(form.sections.map((s) => [s.title, s.items.length])).toEqual([
      ["Síntomas", 7],
      ["Dolor", 9],
      ["AVD", 17],
      ["Deporte y ocio", 5],
      ["Calidad de vida", 4],
    ]);
    for (const it of items) expect(it.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
    expect(getKind("faos")!.subscales).toEqual(SUBSCALES);
  });

  it("«rodilla» pasa a «pie/tobillo», concordando, y el KOOS no cambia", () => {
    const all = [form.instructions, ...form.sections.map((s) => s.intro ?? ""), ...items.map((it) => it.text)];
    for (const t of all) expect(t).not.toMatch(/\brodilla\b/i);
    expect(form.instructions).toBe(
      "Este cuestionario le pregunta por su pie/tobillo. Piense en cómo ha estado el pie/tobillo durante la última semana y marque una sola respuesta en cada pregunta. Si no está seguro, marque la que le parezca más cercana.",
    );
    expect(text("s1")).toBe("¿Se le hincha el pie/tobillo?");
    expect(text("s3")).toBe("¿Se le engancha o se le bloquea el pie/tobillo al moverlo?");
    expect(text("p1")).toBe("¿Con qué frecuencia le duele el pie/tobillo?");
    expect(text("a12")).toBe("Estar tumbado en la cama (darse la vuelta, mantener la posición del pie/tobillo)");
    expect(text("sp4")).toBe("Girar o pivotar sobre el pie/tobillo lesionado");
    expect(text("sp5")).toBe("Arrodillarse");
    expect(text("q1")).toBe("¿Con qué frecuencia es consciente de su problema de pie/tobillo?");
    expect(form.sections.find((s) => s.title === "AVD")!.intro).toMatch(/a causa del pie\/tobillo/);
    expect(koos.sections[0].items[0].text).toBe("¿Se le hincha la rodilla?");
  });

  it("todo lo mejor: 100 en cada subescala; todo lo peor: 0", () => {
    expect(form.score(fill(0))).toEqual({ score: null, subscores: SUBSCALES.map((name) => ({ name, score: 100 })) });
    expect(form.score(fill(4)).subscores!.map((s) => s.score)).toEqual([0, 0, 0, 0, 0]);
  });

  it("caso mixto: media de lo contestado de cada subescala, 100 − media × 25", () => {
    const a: Answers = {
      // Dolor: los 9, suman 5 → media 5/9 → 100 − 13,9 = 86,1.
      ...Object.fromEntries(ids("Dolor").map((id, i) => [id, [2, 1, 1, 0, 0, 1, 0, 0, 0][i]])),
      // Síntomas: 4 de 7 (1, 3, 2, 4) → media 2,5 → 37,5.
      s1: 1,
      s2: 3,
      s3: 2,
      s6: 4,
      // AVD: 8 de 17, menos de la mitad → sin nota.
      ...fill(1, ids("AVD").slice(0, 8)),
      // Deporte y ocio: todo 4 → 0.
      ...fill(4, ids("Deporte y ocio")),
      // Calidad de vida: 1, 1, 1, 2 → media 1,25 → 68,75 → 68,8.
      q1: 1,
      q2: 1,
      q3: 1,
      q4: 2,
    };
    expect(form.score(a).subscores).toEqual([
      { name: "Dolor", score: 86.1 },
      { name: "Síntomas", score: 37.5 },
      { name: "Deporte y ocio", score: 0 },
      { name: "Calidad de vida", score: 68.8 },
    ]);
    // Con la mitad o más de AVD (9 de 17), ya sale.
    expect(form.score({ ...a, a9: 1 }).subscores!.map((s) => s.name)).toContain("AVD");
  });

  it("respuestas que faltan: la subescala con menos de la mitad contestada no sale; sin ninguna, no calcula", () => {
    const a: Answers = { ...fill(0), s4: null };
    delete a.s1;
    delete a.s2;
    delete a.s3;
    expect(form.score(a).subscores!.map((s) => s.name)).toEqual(["Dolor", "AVD", "Deporte y ocio", "Calidad de vida"]);
    expect(() => form.score({})).toThrow(RangeError);
    expect(() => form.score(fill(null))).toThrow(/FAOS/);
  });

  it("la fuente empieza por las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("faos")!.refs!)).toBe(true);
    expect(form.source).toMatch(/Texto de trabajo fiel al original: revisar con la versión española publicada/);
  });
});
