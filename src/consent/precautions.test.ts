import { describe, expect, it } from "vitest";
import { detectPrecautions, PRECAUTIONS } from "./precautions";

describe("precauciones escritas en la anamnesis", () => {
  it("encuentra la palabra entera, sin tildes ni mayúsculas, y no repite lo ya marcado", () => {
    const a = { medicacion: "Sintrom 4 mg, Metformina", enfermedades: "Osteoporosis. Embarazada de 12 semanas (gestación)" };
    expect(detectPrecautions(a, [])).toEqual([
      { precaution: "anticoagulantes", word: "sintrom" },
      { precaution: "embarazo", word: "embarazada" },
      { precaution: "osteoporosis", word: "osteoporosis" },
      { precaution: "diabetes", word: "metformina" },
    ]);
    expect(detectPrecautions(a, ["anticoagulantes", "embarazo", "osteoporosis", "diabetes"])).toEqual([]);
  });
  it("solo al principio de palabra: «placa» no es «aplacar», «tumor» no está en «estumor»", () => {
    expect(detectPrecautions({ observaciones: "Hay que aplacar el dolor" }, [])).toEqual([]);
  });
  it("cada precaución tiene su texto y sus palabras", () => {
    for (const p of PRECAUTIONS) {
      expect(p.label.length).toBeGreaterThan(5);
      expect(p.words.length).toBeGreaterThan(0);
    }
  });
});
