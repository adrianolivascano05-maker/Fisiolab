import { describe, expect, it } from "vitest";
import type { Questionnaire } from "../data/clinical";
import { makeEntry, parseCoded } from "./cif/cif";
import { cifPhrases, informsText, latestQuestionnaires } from "./referral";

const entry = (s: string, title: string) => makeEntry(parseCoded(s)!, title);
const q = (kind: string, score: number, performedAt: string, details: Record<string, unknown> = {}): Questionnaire => ({ id: `${kind}${performedAt}`, patientId: "p", kind, score, performedAt, details, notes: "" });

describe("carta de derivación", () => {
  it("dice con la CIF los problemas calificados, no los sin especificar", () => {
    expect(
      cifPhrases([
        entry("b28013.3", "Dolor en la espalda"),
        entry("d430.21", "Levantar y llevar objetos"),
        entry("s76002.8", "Columna vertebral lumbar"),
        entry("e310+2", "Familiares cercanos"),
        entry("d450.0", "Andar"),
      ]),
    ).toEqual([
      "deficiencia grave en dolor en la espalda (b28013.3)",
      "dificultad moderada para levantar y llevar objetos en su entorno habitual, ligera en capacidad (d430.21)",
      "facilitador moderado: familiares cercanos (e310+2)",
    ]);
    // Seguidas y con la misma gravedad, sin repetirla.
    expect(cifPhrases([entry("d450.3", "Andar"), entry("d540.3", "Vestirse")])).toEqual(["dificultad grave para andar (d450.3)", "para vestirse (d540.3)"]);
  });

  it("la última nota de cada cuestionario de los últimos 6 meses, con su lectura y sus códigos CIF", () => {
    const now = Date.parse("2026-10-22T12:00:00Z");
    const lines = latestQuestionnaires(
      [
        q("odi", 40, "2026-09-01T10:00:00Z"),
        q("odi", 30, "2026-10-20T10:00:00Z", { text: "Discapacidad moderada" }),
        q("phq9", 9, "2026-01-01T10:00:00Z"),
        q("koos", 60, "2026-10-01T10:00:00Z", { subscale: "Dolor" }),
      ],
      now,
    );
    expect(lines.map((l) => [l.name, l.score, l.reading, l.codes.join(" ")])).toEqual([
      ["Oswestry (lumbar)", "30 %", "Discapacidad moderada", "b28013 d410 d415 d430 d450"],
      ["KOOS (rodilla) · Dolor (registro antiguo)", "60/100", null, "b28015"],
    ]);
  });

  it("dice qué valora cada cuestionario con las palabras de la CIF y el calificador del perfil", () => {
    const titles = new Map([
      ["b28013", "Dolor en la espalda"],
      ["b280", "Sensación de dolor"],
      ["d410", "Cambiar las posturas corporales básicas"],
      ["d450", "Andar"],
    ]);
    const profile = [parseCoded("b28013.3")!, parseCoded("d410.2")!];
    expect(informsText(["b28013", "d410", "d450"], (c) => titles.get(c), profile)).toBe(
      "dolor en la espalda (b28013.3), cambiar las posturas corporales básicas (d410.2) y andar (d450)",
    );
    // Un cuestionario más general («b280») se dice con lo concreto del perfil.
    expect(informsText(["b280"], (c) => titles.get(c), profile)).toBe("dolor en la espalda (b28013.3)");
  });
});
