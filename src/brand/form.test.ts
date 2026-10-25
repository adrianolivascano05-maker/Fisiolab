// La marca que viaja en el formulario del paciente: solo se acepta si es válida (viene de fuera).
import { describe, expect, it } from "vitest";
import { brandFromForm } from "./form";

describe("marca en el formulario del paciente", () => {
  it("acepta una marca válida y la completa; rechaza lo que no lo es", () => {
    const b = brandFromForm({ name: "Clínica Aurora", primary: "#7a1f3d", secondary: "#D9A441", logo: null, logoPlate: false, accentOverride: null });
    expect(b).toMatchObject({ v: 1, name: "Clínica Aurora", primary: "#7A1F3D", secondary: "#D9A441", logo: null, logoPlate: false, watermark: false, accentOverride: null });
    // Sin «logoPlate» se entiende que sí; sin logo, null.
    expect(brandFromForm({ name: "X", primary: "#000000", secondary: "#FFFFFF" })).toMatchObject({ logoPlate: true, logo: null });
    expect(brandFromForm(undefined)).toBeNull();
    expect(brandFromForm({ name: "X", primary: "rojo", secondary: "#FFFFFF" })).toBeNull();
    expect(brandFromForm({ name: "", primary: "#000000", secondary: "#FFFFFF" })).toBeNull();
    expect(brandFromForm({ name: "X", primary: "#000000", secondary: "#FFFFFF", logo: "javascript:alert(1)" })).toBeNull();
    expect(brandFromForm({ name: "X", primary: "#000000", secondary: "#FFFFFF", logo: "data:image/png;base64,iVBORw0KGgo=" })).not.toBeNull();
  });
});
