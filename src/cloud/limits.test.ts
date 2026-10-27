import { describe, expect, it } from "vitest";
import { limitWarnings } from "./limits";

const clinic = (name: string, size: number) => ({ name, size, deletedAt: null });

describe("avisos de los límites del servidor (panel del proveedor)", () => {
  it("nada por debajo del 70 %", () => {
    expect(
      limitWarnings({
        clinics: [clinic("Fisiolab", 30 * 1024 * 1024)],
        documents: { enabled: true, total: 6_999_999_999, cap: 10e9, warnAt: 7e9 },
        database: { bytes: 349_000_000, cap: 500e6, warnAt: 350e6 },
      }),
    ).toEqual([]);
  });

  it("al 70 % del almacén y de la base, con qué pasa y qué hacer", () => {
    const w = limitWarnings({
      clinics: [],
      documents: { enabled: true, total: 7.5e9, copies: 1e9, cap: 10e9, warnAt: 7e9 },
      database: { bytes: 400e6, cap: 500e6, warnAt: 350e6 },
    });
    expect(w.map((x) => x.title)).toEqual(["El almacén de archivos va por el 75 % (7,5 GB de 10 GB)", "La base de datos va por el 80 % (400 MB de 500 MB)"]);
    expect(w[0]!.detail).toContain("DOCS_CAP_GB");
    expect(w[1]!.detail).toContain("D1_CAP_MB");
  });

  it("sin R2: cada copia en la base, como mucho 50 MB; se avisa desde 35 MB (y la base, que active R2)", () => {
    const w = limitWarnings({
      clinics: [clinic("Grande", 40 * 1024 * 1024), clinic("Pequeña", 5 * 1024 * 1024), { name: "Borrada", size: 49 * 1024 * 1024, deletedAt: "2026-10-01" }],
      documents: { enabled: false, total: 0, cap: 10e9, warnAt: 7e9 },
      database: { bytes: 360e6, cap: 500e6, warnAt: 350e6 },
    });
    expect(w.map((x) => x.title)).toEqual(["La base de datos va por el 72 % (360 MB de 500 MB)", "La copia de «Grande» ocupa 41,9 MB"]);
    expect(w[0]!.detail).toContain("Activa el almacén R2");
    // Con R2 las copias no tienen ese límite.
    expect(limitWarnings({ clinics: [clinic("Grande", 400 * 1024 * 1024)], documents: { enabled: true, total: 1e9, cap: 10e9, warnAt: 7e9 } })).toEqual([]);
    // Un servidor que no dice lo que ocupa la base: no se avisa de eso.
    expect(limitWarnings({ clinics: [], database: { bytes: null, cap: 500e6, warnAt: 350e6 } })).toEqual([]);
  });
});
