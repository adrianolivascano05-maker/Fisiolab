import { describe, expect, it } from "vitest";
import { findFlags, FLAGS, redFlagReview } from "./redFlags";

const ids = (a: Parameters<typeof findFlags>[0]) => findFlags(a).map((h) => `${h.flag.id}:${h.from}`);

describe("banderas rojas", () => {
  it("las 8 de siempre conservan su texto (lo guardado sigue valiendo)", () => {
    expect(FLAGS.slice(0, 8).map((f) => f.label)).toEqual([
      "Pérdida de peso sin explicación",
      "Fiebre o malestar general",
      "Antecedente de cáncer",
      "Dolor nocturno que no cede con el reposo",
      "Traumatismo importante reciente",
      "Alteración de esfínteres o anestesia en silla de montar",
      "Pérdida de fuerza o sensibilidad que avanza",
      "Corticoides durante mucho tiempo o inmunosupresión",
    ]);
  });

  it("junta las marcadas, las del paciente y las escritas, una vez cada una", () => {
    const a = {
      banderas_rojas: ["Antecedente de cáncer"],
      sintomas_paciente: ["Tengo náuseas o vómitos", "Tengo o he tenido cáncer"],
      motivo: "Dolor lumbar con VÓMITOS desde ayer y mareo al girar el cuello",
      enfermedades: "Cáncer de mama en 2019",
    };
    expect(ids(a)).toEqual(["cancer:marcada", "mareo:texto", "vomitos:paciente"]);
    const mareo = findFlags(a, (f) => (f === "motivo" ? "Motivo principal" : f)).find((h) => h.flag.id === "mareo")!;
    expect(mareo.field).toBe("Motivo principal");
    expect(mareo.quote).toContain("mareo al girar");
  });

  it("no cuenta lo dicho en negativo", () => {
    expect(ids({ motivo: "No tiene fiebre ni vómitos. Sin mareos.", evolucion: "niega pérdida de peso" })).toEqual([]);
    expect(ids({ motivo: "No le duele de noche, pero ha tenido fiebre" })).toEqual(["fiebre:texto"]);
  });

  it("cauda equina y vascular cervical salen como urgentes y primero", () => {
    const r = redFlagReview({ regiones: ["lumbar"], banderas_rojas: ["Alteración de esfínteres o anestesia en silla de montar"], motivo: "Lumbalgia con fiebre" }, null);
    expect(r.patterns.map((p) => `${p.pattern.id}:${p.pattern.urgency}`)).toEqual(["cauda_equina:urgente", "infeccion:preferente"]);
    const neck = redFlagReview({ regiones: ["cervical"], motivo: "Cervicalgia y visión doble desde ayer" }, null);
    expect(neck.patterns[0]!.pattern.id).toBe("vascular_cervical");
  });

  it("cáncer con más de 50 años; fractura por corticoides u osteoporosis con la espalda", () => {
    const today = new Date();
    const born = `${today.getFullYear() - 60}-01-01`;
    expect(redFlagReview({ banderas_rojas: ["Antecedente de cáncer"] }, born).patterns.map((p) => p.pattern.id)).toEqual(["cancer"]);
    expect(redFlagReview({ banderas_rojas: ["Antecedente de cáncer"] }, `${today.getFullYear() - 30}-01-01`).patterns).toEqual([]);
    expect(redFlagReview({ regiones: ["lumbar"], enfermedades: "Osteoporosis", medicacion: "Prednisona desde hace 2 años" }, born).patterns.map((p) => p.pattern.id)).toEqual(["fractura"]);
  });

});
