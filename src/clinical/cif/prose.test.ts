import { describe, expect, it } from "vitest";
import type { Questionnaire } from "../../data/clinical";
import { makeEntry, parseCoded } from "./cif";
import { draftDiagnosis, personalFactors } from "./prose";
import { evidenceFrom } from "./suggest";

const entry = (s: string, title: string) => makeEntry(parseCoded(s)!, title);
const q = (kind: string, score: number, performedAt = "2026-10-20T10:00:00Z"): Questionnaire => ({ id: kind, patientId: "p", kind, score, performedAt, details: {}, notes: "" });

describe("el perfil CIF redactado", () => {
  it("por componentes, agrupados por el dato que respalda el calificador, y los factores personales", () => {
    const ev = evidenceFrom({ regiones: ["lumbar"] }, [{ pain: 6, performedAt: "2026-10-21T10:00:00Z" }], [q("odi", 32)], []);
    const text = draftDiagnosis(
      [
        entry("b28013.3", "Dolor en la espalda"),
        entry("d430.2", "Levantar y llevar objetos"),
        // No coincide con lo propuesto (Oswestry 32 % → moderada): sin el dato.
        entry("d450.1", "Andar"),
        entry("s76002.8", "Columna vertebral lumbar"),
        entry("e310+3", "Familiares cercanos"),
      ],
      { evidence: ev, personal: "45 años; profesión: administrativa" },
    );
    expect(text.split("\n")).toEqual([
      "Funciones corporales: deficiencia grave en dolor en la espalda (b28013.3), según dolor 6/10 en la sesión del 21 oct.",
      "Estructuras corporales: deficiencia de gravedad sin especificar en columna vertebral lumbar (s76002.8).",
      "Actividades y participación: dificultad moderada para levantar y llevar objetos (d430.2), según Oswestry 32 % el 20 oct; dificultad ligera para andar (d450.1).",
      "Factores ambientales: facilitador grave: familiares cercanos (e310+3).",
      "Factores personales: 45 años; profesión: administrativa.",
    ]);
  });

  it("lo que respalda el mismo dato con la misma gravedad se dice una vez", () => {
    const ev = evidenceFrom({}, [], [q("rmdq", 12)], []);
    expect(
      draftDiagnosis(
        [entry("d410.3", "Cambiar las posturas corporales básicas"), entry("d415.3", "Mantener la posición del cuerpo"), entry("d450.3", "Andar"), entry("d540.2", "Vestirse")],
        { evidence: ev },
      ),
    ).toBe(
      "Actividades y participación: dificultad grave para cambiar las posturas corporales básicas (d410.3), para mantener la posición del cuerpo (d415.3) y para andar (d450.3), según RMDQ 12/24 el 20 oct; dificultad moderada para vestirse (d540.2).",
    );
  });

  it("los factores personales salen de la anamnesis", () => {
    const now = new Date();
    const birth = `${now.getFullYear() - 45}-01-01`;
    expect(
      personalFactors(
        { profesion: "Administrativa", actividad: "Pádel", frecuencia: "2 veces por semana", creencias: "Que tiene una hernia.", expectativas: "Mejorar en un mes", objetivo_paciente: "Volver a jugar al pádel" },
        birth,
      ),
    ).toBe("45 años; profesión: administrativa; actividad física: pádel, 2 veces por semana; cree que tiene una hernia; espera mejorar en un mes; quiere volver a jugar al pádel");
    expect(personalFactors({}, null)).toBe("");
  });
});
