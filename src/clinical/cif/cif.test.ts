import { describe, expect, it } from "vitest";
import { codedText, draftDiagnosis, entriesText, formatCoded, makeEntry, parseCatalog, parseCoded, qualifierLabel, searchCif, suggestedCodes } from "./cif";
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

  it("las sugerencias por zona son códigos que existen", () => {
    for (const r of ["atm", "cervical", "hombro", "codo", "muneca_mano", "dorsal", "lumbar", "sacroiliaca", "cadera", "rodilla", "tobillo_pie"]) {
      for (const c of suggestedCodes([r])) expect(byCode.has(c), `${r}: ${c}`).toBe(true);
    }
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

  it("redacta el diagnóstico por componentes", () => {
    const entries = [
      makeEntry(parseCoded("b28013.2")!, "Dolor en la espalda"),
      makeEntry(parseCoded("d450.21")!, "Andar"),
      makeEntry(parseCoded("e310+3")!, "Familiares cercanos"),
    ];
    expect(draftDiagnosis(entries)).toBe(
      [
        "Deficiencias en las funciones corporales: Dolor en la espalda (b28013.2): deficiencia moderada.",
        "Limitaciones en la actividad y restricciones en la participación: Andar (d450.21): desempeño/realización: dificultad moderada; capacidad: dificultad ligera.",
        "Factores ambientales: Familiares cercanos (e310+3): facilitador grave.",
      ].join("\n"),
    );
    expect(entriesText(entries).split("\n")[0]).toBe(codedText(parseCoded("b28013.2")!, "Dolor en la espalda"));
  });
});
