import { describe, expect, it } from "vitest";
import { makeEntry, parseCoded } from "./cif";
import { draftDiagnosis, personalFactors } from "./prose";

const entry = (s: string, title: string) => makeEntry(parseCoded(s)!, title);

describe("el perfil CIF redactado", () => {
  it("por componentes, solo con lo que eligió el profesional, y los factores personales", () => {
    const text = draftDiagnosis(
      [entry("b28013.3", "Dolor en la espalda"), entry("d430.2", "Levantar y llevar objetos"), entry("d450.1", "Andar"), entry("s76002.8", "Columna vertebral lumbar"), entry("e310+3", "Familiares cercanos")],
      { personal: "45 años; profesión: administrativa" },
    );
    expect(text.split("\n")).toEqual([
      "Funciones corporales: deficiencia grave en dolor en la espalda (b28013.3).",
      "Estructuras corporales: deficiencia de gravedad sin especificar en columna vertebral lumbar (s76002.8).",
      "Actividades y participación: dificultad moderada para levantar y llevar objetos (d430.2) y dificultad ligera para andar (d450.1).",
      "Factores ambientales: facilitador grave: familiares cercanos (e310+3).",
      "Factores personales: 45 años; profesión: administrativa.",
    ]);
    // Sin «según…»: el texto no justifica los calificadores con datos de la ficha.
    expect(text).not.toMatch(/según/);
  });

  it("seguidos y con la misma gravedad se dicen una vez", () => {
    expect(draftDiagnosis([entry("d410.3", "Cambiar las posturas corporales básicas"), entry("d415.3", "Mantener la posición del cuerpo"), entry("d450.3", "Andar"), entry("d540.2", "Vestirse")])).toBe(
      "Actividades y participación: dificultad grave para cambiar las posturas corporales básicas (d410.3), para mantener la posición del cuerpo (d415.3), para andar (d450.3) y dificultad moderada para vestirse (d540.2).",
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
