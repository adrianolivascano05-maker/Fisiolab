// El buscador de pantallas del botón «＋» (screens.ts).
import { describe, expect, it } from "vitest";
import { findScreens, SCREENS } from "./screens";

describe("buscar una pantalla", () => {
  it("por su nombre o por otras palabras, sin tildes ni mayúsculas", () => {
    expect(findScreens("PIN")[0]?.to).toBe("/ajustes/bloqueo");
    expect(findScreens("contraseña")[0]?.to).toBe("/ajustes/bloqueo");
    expect(findScreens("bono").map((s) => s.to)).toContain("/ajustes/cobros");
    expect(findScreens("tarifa")[0]?.label).toBe("Precios y cobros");
    expect(findScreens("envios")[0]?.label).toBe("Envíos pendientes");
  });

  it("primero las que lo llevan en el nombre; nada sin escribir o sin coincidencias", () => {
    expect(findScreens("cuestionarios").map((s) => s.label).slice(0, 2)).toEqual(["Cuestionarios", "Cuestionarios propios"]);
    expect(findScreens("")).toEqual([]);
    expect(findScreens("zzzz")).toEqual([]);
    expect(findScreens("lista espera")[0]?.to).toBe("/agenda/espera");
  });

  it("cada pantalla lleva a una dirección distinta de la app", () => {
    expect(new Set(SCREENS.map((s) => s.to)).size).toBe(SCREENS.length);
    expect(SCREENS.every((s) => s.to.startsWith("/"))).toBe(true);
  });
});
