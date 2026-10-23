import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearErrors, errorReport, logError, readErrors } from "./errorLog";

// Un almacenamiento en memoria en lugar del del navegador.
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("registro de fallos", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("location", { pathname: "/pacientes/abc" });
  });

  it("anota errores con dónde pasaron y los lee después", () => {
    logError("sincronización", new TypeError("fallo de red"));
    logError("pantalla", "algo raro");
    const list = readErrors();
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ where: "sincronización", message: "TypeError: fallo de red", path: "/pacientes/abc" });
    expect(list[1]!.message).toBe("algo raro");
  });

  it("el mismo error repetido seguido cuenta una vez y se guardan como mucho 40", () => {
    for (let i = 0; i < 5; i++) logError("pantalla", new Error("bucle"));
    expect(readErrors()).toHaveLength(1);
    for (let i = 0; i < 60; i++) logError("pantalla", new Error(`error ${i}`));
    const list = readErrors();
    expect(list).toHaveLength(40);
    expect(list.at(-1)!.message).toBe("Error: error 59");
  });

  it("no guarda la clave de los enlaces de formularios, reservas y citas", () => {
    vi.stubGlobal("location", { pathname: "/formulario/abc123" });
    logError("pantalla", "x");
    vi.stubGlobal("location", { pathname: "/cita/tok-secreto" });
    logError("pantalla", "y");
    expect(readErrors().map((e) => e.path)).toEqual(["/formulario/…", "/cita/…"]);
  });

  it("el informe lleva lo que cuenta la persona, el dispositivo y los últimos errores, el más reciente primero", () => {
    logError("pantalla", new Error("primero"));
    logError("sincronización", new Error("segundo"));
    const text = errorReport("No guarda la sesión", ["Sincronización: al día"]);
    expect(text).toContain("Qué pasó: No guarda la sesión");
    expect(text).toContain("Versión:");
    expect(text).toContain("Sincronización: al día");
    expect(text.indexOf("Error: segundo")).toBeLessThan(text.indexOf("Error: primero"));
    clearErrors();
    expect(readErrors()).toEqual([]);
    expect(errorReport("")).toContain("Sin errores anotados");
  });

  it("si el almacenamiento falla, no rompe nada", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(() => logError("pantalla", "x")).not.toThrow();
    expect(readErrors()).toEqual([]);
    expect(() => clearErrors()).not.toThrow();
  });
});
