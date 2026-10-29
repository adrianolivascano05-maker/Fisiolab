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

  it("solo la lista de síntomas: sin agrupar en enfermedades ni urgencia", () => {
    const r = redFlagReview({ regiones: ["lumbar"], banderas_rojas: ["Alteración de esfínteres o anestesia en silla de montar"], motivo: "Lumbalgia con fiebre" });
    expect(Object.keys(r)).toEqual(["hits"]);
    expect(r.hits.map((h) => `${h.flag.id}:${h.from}`)).toEqual(["fiebre:texto", "esfinteres:marcada"]);
  });
});
