// Claves internas de las respuestas (src/clinical/answerMeta.ts): no son preguntas ni se pierden al juntar.
import { describe, expect, it } from "vitest";
import { orphanAnswers } from "./anamnesis";
import { readSources, sourceText, stampSources, SRC, TPL } from "./answerMeta";
import { findFlags } from "./redFlags";

describe("claves internas", () => {
  it("quién contestó: se apunta por pregunta sin borrar lo de otras y lo que no se entiende se ignora", () => {
    const a1 = stampSources({ motivo: "x" }, ["motivo"], { by: "patient", at: "2026-11-04T10:00:00.000Z", form: "f1" });
    const a2 = stampSources(a1, ["eva"], { by: "clinician", who: "ana@x.es", at: "2026-11-05T10:00:00.000Z" });
    expect(readSources(a2)).toEqual({
      motivo: { by: "patient", at: "2026-11-04T10:00:00.000Z", form: "f1" },
      eva: { by: "clinician", who: "ana@x.es", at: "2026-11-05T10:00:00.000Z" },
    });
    expect(readSources({ [SRC]: "{roto" })).toEqual({});
    expect(readSources({ [SRC]: JSON.stringify({ a: { by: "hacker", at: "x" } }) })).toEqual({});
    expect(sourceText({ by: "patient", at: "2026-11-04T10:00:00.000Z" })).toMatch(/^El paciente, el 4 nov/);
  });

  it("no salen como respuestas sueltas ni disparan banderas", () => {
    const a = { motivo: "x", [TPL]: "general@abcdefabcdef", [SRC]: JSON.stringify({ motivo: { by: "patient", at: "fiebre" } }) };
    expect(orphanAnswers(a)).toEqual([]);
    expect(findFlags({ [SRC]: "fiebre alta y pérdida de peso" })).toEqual([]);
  });
});
