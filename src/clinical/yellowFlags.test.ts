import { describe, expect, it } from "vitest";
import { findYellowFlags } from "./yellowFlags";

const ids = (a: Parameters<typeof findYellowFlags>[0]) => findYellowFlags(a).map((h) => h.flag.id);

describe("banderas amarillas", () => {
  it("las encuentra en lo escrito, con el cuestionario que las mide", () => {
    const hits = findYellowFlags({ creencias: "Le da miedo agacharse, cree que se le va a romper algo", estres: "Mucho estrés, está de baja" }, (f) => (f === "creencias" ? "Qué cree el paciente que le pasa" : f));
    expect(hits.map((h) => h.flag.id)).toEqual(["miedo", "animo", "trabajo"]);
    expect(hits[0]!.field).toBe("Qué cree el paciente que le pasa");
    expect(hits[1]!.flag.measure).toEqual(["phq9", "gad7"]);
  });

  it("palabra entera y sin lo negado", () => {
    expect(ids({ motivo: "Algo inevitable con la edad" })).toEqual([]);
    expect(ids({ motivo: "No le da miedo moverse; sin ansiedad" })).toEqual([]);
  });
});
