import { describe, expect, it } from "vitest";
import { codedText, entriesText, formatCoded, makeEntry, parseCatalog, parseCoded, qualifierLabel, searchCif } from "./cif";
import { CIF_TSV } from "./cifData";

const catalog = parseCatalog(CIF_TSV);
const byCode = new Map(catalog.map((e) => [e.code, e]));

describe("catálogo de la CIF", () => {
  it("tiene todas las categorías (1424 y los 30 capítulos), sin repetir, y cada una cuelga de la anterior", () => {
    expect(catalog).toHaveLength(1454);
    expect(new Set(catalog.map((e) => e.code)).size).toBe(1454);
    expect(catalog.filter((e) => e.level === 1)).toHaveLength(30);
    expect(catalog.filter((e) => e.level === 2)).toHaveLength(362);
    for (const e of catalog.filter((x) => x.level > 1)) {
      const parent = e.level === 2 ? e.code.slice(0, 2) : e.code.slice(0, -1);
      expect(byCode.has(parent), e.code).toBe(true);
    }
  });

  it("los títulos son los de la CIF", () => {
    expect(byCode.get("b280")!.title).toBe("Sensación de dolor");
    expect(byCode.get("b28013")!.title).toBe("Dolor en la espalda");
    expect(byCode.get("d450")!.title).toBe("Andar");
    expect(byCode.get("s75011")!.title).toBe("Articulación de la rodilla");
    expect(byCode.get("e310")!.title).toBe("Familiares cercanos");
    expect(byCode.get("d340")!.title).toContain("lenguaje");
  });

  it("busca por código o por palabras sin tildes, y filtra por componente", () => {
    expect(searchCif(catalog, "dolor espalda", null).map((e) => e.code)).toContain("b28013");
    expect(searchCif(catalog, "d45", null)[0]!.code).toBe("d450");
    expect(searchCif(catalog, "rodilla", "s").every((e) => e.component === "s")).toBe(true);
    expect(searchCif(catalog, "", null)).toEqual([]);
  });

});

describe("notación y calificadores", () => {
  it("lee y escribe la notación oficial", () => {
    for (const s of ["b280.2", "d450.21", "d450.2", "e310+3", "e150.1", "s750.8", "b710"]) expect(formatCoded(parseCoded(s)!)).toBe(s);
    expect(parseCoded("x123")).toBeNull();
  });

  it("usa las palabras de la escala de cada componente", () => {
    expect(qualifierLabel("b", 2)).toBe("Deficiencia MODERADA");
    expect(qualifierLabel("d", 1)).toBe("Dificultad LIGERA");
    expect(qualifierLabel("e", 3)).toBe("Barrera GRAVE");
    expect(qualifierLabel("e", 2, { facilitator: true })).toBe("Facilitador MODERADO");
    expect(qualifierLabel("b", 8)).toBe("sin especificar");
  });

  it("las estructuras llevan la naturaleza del cambio y la localización", () => {
    expect(parseCoded("s75011.272")).toMatchObject({ code: "s75011", q: 2, nature: 7, location: 2, capacity: null });
    expect(formatCoded({ code: "s75011", q: 2, capacity: null, facilitator: false, nature: null, location: 1 })).toBe("s75011.281");
    expect(formatCoded({ code: "s75011", q: 3, capacity: null, facilitator: false, nature: 2, location: null })).toBe("s75011.32");
    for (const s of ["s75011.272", "s76002.881", "s720.3"]) expect(formatCoded(parseCoded(s)!)).toBe(s);
    expect(codedText(parseCoded("s75011.272")!, "Articulación de la rodilla")).toBe(
      "Articulación de la rodilla (s75011.272): deficiencia moderada; cambios cualitativos en la estructura, incluyendo la acumulación de fluido; izquierda",
    );
  });

  it("se lee en la ficha con sus calificadores", () => {
    const entries = [makeEntry(parseCoded("b28013.2")!, "Dolor en la espalda"), makeEntry(parseCoded("d450.21")!, "Andar")];
    expect(entriesText(entries).split("\n")).toEqual([
      "Dolor en la espalda (b28013.2): deficiencia moderada",
      "Andar (d450.21): desempeño/realización: dificultad moderada; capacidad: dificultad ligera",
    ]);
  });
});
