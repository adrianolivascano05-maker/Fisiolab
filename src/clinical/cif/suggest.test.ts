import { describe, expect, it } from "vitest";
import type { Questionnaire } from "../../data/clinical";
import { readEntry } from "./cif";
import { CIF_TSV } from "./cifData";
import { autoProfile, evidenceFrom, percentToQualifier, suggestQualifier } from "./suggest";

const titles = new Map(CIF_TSV.split("\n").map((l) => l.split("\t") as [string, string]));
const q = (kind: string, score: number, performedAt = "2026-10-20T10:00:00Z"): Questionnaire => ({ id: kind, patientId: "p", kind, score, performedAt, details: {}, notes: "" });

describe("calificadores propuestos", () => {
  it("la escala genérica de la CIF", () => {
    expect([0, 4, 5, 24, 25, 49, 50, 95, 96, 100].map(percentToQualifier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("dolor desde la última sesión o la EVA; actividades desde el cuestionario de la zona", () => {
    const ev = evidenceFrom({ eva: 4, regiones: ["lumbar"] }, [{ pain: 6, performedAt: "2026-10-21T10:00:00Z" }], [q("odi", 32)], []);
    expect(suggestQualifier("b28013", ev)).toMatchObject({ q: 3, why: expect.stringContaining("dolor 6/10 = 60 %") });
    expect(suggestQualifier("d430", ev)).toMatchObject({ q: 2, why: expect.stringContaining("32 % de discapacidad") });
    expect(suggestQualifier("s76002", ev)).toBeNull();
    // Sin sesiones, la EVA de la anamnesis; un cuestionario de otra zona no cuenta.
    const ev2 = evidenceFrom({ eva: 4, regiones: ["rodilla"] }, [], [q("odi", 32)], []);
    expect(suggestQualifier("b280", ev2)).toMatchObject({ q: 2 });
    expect(suggestQualifier("d450", ev2)).toBeNull();
  });

  it("los cuestionarios en que más es mejor también cuentan bien (LEFS 60/80 = 25 % de problema)", () => {
    const ev = evidenceFrom({ regiones: ["rodilla"] }, [], [q("lefs", 60)], []);
    expect(suggestQualifier("d450", ev)?.q).toBe(2);
  });

  it("el borrador rápido trae los códigos de la zona con lo propuesto y no repite", () => {
    const ev = evidenceFrom({ regiones: ["lumbar"] }, [{ pain: 6, performedAt: "2026-10-21T10:00:00Z" }], [q("odi", 32), q("phq9", 9)], []);
    const out = autoProfile(ev, (c) => titles.get(c), new Set(["d410"])).map((e) => readEntry(e)!);
    expect(out.map((e) => `${e.coded.code}.${e.coded.q}`)).toEqual(["b28013.3", "s76002.8", "d415.2", "d430.2", "b152.2"]);
    expect(out[0]!.title).toBe("Dolor en la espalda");
  });
});
