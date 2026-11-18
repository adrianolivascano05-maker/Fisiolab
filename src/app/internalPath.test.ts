// internalPath.ts: ?volver= solo lleva a rutas de la app.
import { describe, expect, it } from "vitest";
import { internalPath } from "./internalPath";

describe("dirección de vuelta", () => {
  it("las rutas de la app, sí", () => {
    expect(internalPath("/pacientes/abc/sesiones")).toBe("/pacientes/abc/sesiones");
    expect(internalPath("/pacientes/abc/calendario?dia=2026-11-18#x")).toBe("/pacientes/abc/calendario?dia=2026-11-18#x");
  });
  it("otro sitio, no: //, /\\, esquemas, espacios y vacío", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "evil.example", "/pac ientes", "/a\\b", "", null, undefined])
      expect(internalPath(bad as string)).toBeNull();
  });
});
