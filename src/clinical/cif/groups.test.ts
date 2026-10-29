import { describe, expect, it } from "vitest";
import { parseCatalog } from "./cif";
import { CIF_TSV } from "./cifData";
import { GROUPS, ancestorsOf, chaptersOf } from "./groups";

const catalog = parseCatalog(CIF_TSV);
const byCode = new Map(catalog.map((e) => [e.code, e]));

describe("atajos de fisioterapia para acotar en la CIF", () => {
  it("cada código de cada atajo existe, es de su componente y no se repite en el mismo atajo", () => {
    for (const [component, groups] of Object.entries(GROUPS)) {
      expect(new Set(groups.map((g) => g.id)).size).toBe(groups.length);
      for (const g of groups) {
        expect(new Set(g.codes).size, g.id).toBe(g.codes.length);
        for (const c of g.codes) {
          expect(byCode.has(c), `${g.id}: ${c}`).toBe(true);
          expect(c[0], `${g.id}: ${c}`).toBe(component);
        }
      }
    }
  });

  it("baja por el árbol de la CIF: capítulos, categorías y subcategorías", () => {
    expect(chaptersOf(catalog, "b").map((e) => e.code)).toEqual(["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"]);
    expect(ancestorsOf("b28013")).toEqual(["b2", "b280", "b2801"]);
    expect(ancestorsOf("d450")).toEqual(["d4"]);
    for (const c of ["b28013", "s75011", "d4153", "e1101"]) for (const a of ancestorsOf(c)) expect(byCode.has(a), a).toBe(true);
  });
});
