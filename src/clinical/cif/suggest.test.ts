import { describe, expect, it } from "vitest";
import type { Questionnaire } from "../../data/clinical";
import { evidenceFrom, evidenceText, proposedCoded, proposedCodes } from "./suggest";

const q = (kind: string, score: number, performedAt = "2026-10-20T10:00:00Z"): Questionnaire => ({ id: kind, patientId: "p", kind, score, performedAt, details: {}, notes: "" });

describe("la ficha en la hoja de la CIF: datos, no calificadores", () => {
  it("un código nuevo entra sin calificar aunque haya datos; la estructura lleva el lado de la anamnesis", () => {
    const ev = evidenceFrom({ regiones: ["rodilla"], lado: "Izquierdo", eva: 5 }, [{ pain: 8, performedAt: "2026-10-21T10:00:00Z" }], [q("koos12", 50)], []);
    expect(proposedCoded("b28015", ev)).toEqual({ code: "b28015", q: 8, capacity: null, facilitator: false });
    expect(proposedCoded("s75011", ev)).toMatchObject({ q: 8, location: 2 });
    expect(proposedCoded("d450", ev).q).toBe(8);
    expect(proposedCoded("b28015").q).toBe(8);
  });

  it("el dato de la ficha, tal cual: dolor de la última sesión o la EVA, cuestionarios y ángulos", () => {
    const ev = evidenceFrom({ eva: 4, regiones: ["lumbar"] }, [{ pain: 6, performedAt: "2026-10-21T10:00:00Z" }], [q("odi", 32)], []);
    expect(evidenceText("b28013", ev)).toBe("Dolor 6/10 en la sesión del 21 oct");
    expect(evidenceText("d430", ev)).toBe("Oswestry 32 % el 20 oct");
    expect(evidenceText("s76002", ev)).toBeNull();
    // Sin sesiones, la EVA de la anamnesis; un cuestionario solo acompaña a lo que informa.
    const ev2 = evidenceFrom({ eva: 6, regiones: ["rodilla"] }, [], [q("odi", 32)], []);
    expect(evidenceText("b280", ev2)).toBe("EVA 6/10 en la anamnesis");
    expect(evidenceText("d440", ev2)).toBeNull();
    const ev3 = evidenceFrom({ regiones: ["rodilla"] }, [], [{ ...q("koos", 25), details: { subscale: "Dolor" } }, q("isi", 13)], []);
    expect(evidenceText("b134", ev3)).toMatch(/^ISI 13/);
    expect(evidenceText("b28015", ev3)).toMatch(/^KOOS · Dolor 25\/100 el 20 oct$/);
    // Nada en el texto convierte el dato en grado ni en porcentaje de problema.
    for (const t of [evidenceText("b28013", ev), evidenceText("d430", ev), evidenceText("b134", ev3)]) expect(t).not.toMatch(/grave|moderad|liger|de problema|=/);
  });

  it("los atajos son los de la zona, sin cuestionarios ni dolor", () => {
    const ev = evidenceFrom({ regiones: ["lumbar"] }, [{ pain: 6, performedAt: "2026-10-21T10:00:00Z" }], [q("odi", 32), q("phq9", 9)], []);
    expect(proposedCodes(ev)).toEqual(["b28013", "s76002", "d410", "d415", "d430"]);
    expect(proposedCodes(evidenceFrom({}, [], [], []))).toEqual(["b280"]);
  });
});
