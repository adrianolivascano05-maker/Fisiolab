import { describe, expect, it } from "vitest";
import { setupSteps } from "./SetupChecklist";

describe("pon en marcha tu clínica", () => {
  it("seis pasos con su enlace; cada uno, hecho o no según lo que ya hay", () => {
    const none = setupSteps({ clinicReady: false, ownBrand: false, price: false, pin: false, patients: false, backup: false });
    expect(none.map((s) => s.to)).toEqual(["/ajustes/clinica", "/ajustes/marca", "/ajustes/cobros", "/ajustes/bloqueo", "/ajustes/importar", "/ajustes/datos"]);
    expect(none.every((s) => !s.done)).toBe(true);
    const some = setupSteps({ clinicReady: true, ownBrand: false, price: true, pin: false, patients: true, backup: false });
    expect(some.filter((s) => s.done).map((s) => s.id)).toEqual(["clinica", "precio", "pacientes"]);
  });
});
