import { describe, expect, it } from "vitest";
import { getKind } from "../questionnaires";
import { CIF_TSV } from "./cifData";
import { QUESTIONNAIRE_CIF, informs } from "./questionnaireLinks";

const codes = new Set(CIF_TSV.split("\n").map((l) => l.split("\t")[0]));

describe("cuestionarios y CIF", () => {
  it("cada vínculo es de un cuestionario (y subescala) del catálogo y apunta a códigos que existen en la CIF", () => {
    for (const [key, links] of Object.entries(QUESTIONNAIRE_CIF)) {
      const [id, sub] = key.split(":");
      const k = getKind(id!);
      expect(k, key).toBeDefined();
      if (sub) expect(k!.subscales, key).toContain(sub);
      expect(links.length, key).toBeGreaterThan(0);
      for (const c of links) expect(codes.has(c), `${key}: ${c}`).toBe(true);
    }
  });
  it("un código general informa sus subcategorías, no al revés", () => {
    expect(informs(["b280"], "b28013")).toBe(true);
    expect(informs(["b28013"], "b280")).toBe(false);
  });
});
