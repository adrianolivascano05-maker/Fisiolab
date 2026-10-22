import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { form as aclRsi } from "./acl_rsi";
import { form } from "./alr_rsi";
import type { Answers } from "./types";

const items = form.sections.flatMap((s) => s.items);
const ids = items.map((i) => i.id);
const all = (v: number): Answers => Object.fromEntries(ids.map((id) => [id, v]));

describe("ALR-RSI", () => {
  it("los 12 ítems del ACL-RSI, de 0 a 10 y con sus mismos extremos", () => {
    expect(ids).toEqual(Array.from({ length: 12 }, (_, i) => `i${i + 1}`));
    const acl = aclRsi.sections.flatMap((s) => s.items);
    items.forEach((it, i) => {
      expect(it.scale).toEqual(acl[i].scale);
      expect(it.scale).toMatchObject({ from: 0, to: 10 });
    });
  });

  it("«rodilla» pasa a «tobillo» y el ACL-RSI no cambia", () => {
    for (const t of [form.instructions, ...items.map((it) => it.text)]) expect(t).not.toMatch(/rodilla/i);
    expect(items.map((it) => it.text).filter((t) => /tobillo/.test(t))).toHaveLength(7);
    expect(items[1].text).toBe("¿Cree que es probable que vuelva a lesionarse el tobillo si practica su deporte?");
    expect(items[3].text).toBe("¿Confía en que el tobillo no le fallará al practicar su deporte?");
    expect(items[4].text).toBe("¿Confía en que podría practicar su deporte sin preocuparse por el tobillo?");
    expect(form.instructions).toBe(aclRsi.instructions);
    expect(aclRsi.sections[0].items[1].text).toMatch(/la rodilla/);
  });

  it("todo a 10 → 100; todo a 0 → 0", () => {
    expect(form.score(all(10)).score).toBe(100);
    expect(form.score(all(0)).score).toBe(0);
  });

  it("caso mixto: seis a 7 y seis a 4 → 66/120 = 55; con el último a 5 → 67/120 = 55,8", () => {
    const a: Answers = {};
    ids.forEach((id, i) => (a[id] = i < 6 ? 7 : 4));
    expect(form.score(a).score).toBe(55);
    a.i12 = 5;
    expect(form.score(a).score).toBe(55.8);
  });

  it("si falta alguna respuesta no calcula, como el ACL-RSI de la app", () => {
    const a = all(5);
    delete a.i12;
    expect(() => form.score(a)).toThrow(/Faltan 1 de las 12/);
    expect(() => form.score({})).toThrow(RangeError);
  });

  it("la fuente empieza por las referencias del catálogo", () => {
    expect(form.source.startsWith(getKind("alr_rsi")!.refs!)).toBe(true);
  });
});
