import { describe, expect, it } from "vitest";
import { answerText, orphanAnswers, withCustom } from "../clinical/anamnesis";
import { anamnesisRows } from "../export/fullExport";
import { addCustomPack, checkCustomField, getCustomFields, saveCustomFields } from "./customFields";
import { createTestDb } from "./testDb";

describe("campos propios de la anamnesis", () => {
  it("se validan: con pregunta, y las de opciones con dos o más (sin repetir ni vacías)", () => {
    expect(() => checkCustomField({ id: "c_1", section: "motivo", label: " ", type: "text" })).toThrow(/pregunta/);
    expect(() => checkCustomField({ id: "c_1", section: "motivo", label: "Escapes", type: "choice", options: ["Sí", " ", "Sí"] })).toThrow(/dos opciones/);
    expect(checkCustomField({ id: "c_1", section: "motivo", label: " Escapes ", type: "choice", options: [" No", "Sí", "No", ""] })).toEqual({
      id: "c_1",
      section: "motivo",
      label: "Escapes",
      type: "choice",
      options: ["No", "Sí"],
    });
    expect(checkCustomField({ id: "c_2", section: "habitos", label: "Horas sentado", type: "text", options: ["x"] })).toEqual({ id: "c_2", section: "habitos", label: "Horas sentado", type: "text" });
  });

  it("salen al final de su apartado, cuentan en el informe y en la exportación; quitadas, lo respondido se guarda", async () => {
    const db = await createTestDb();
    await saveCustomFields(db, [{ id: "c_horas", section: "habitos", label: "Horas sentado al día", type: "text" }]);
    const sections = withCustom(await getCustomFields(db));
    const habitos = sections.find((s) => s.id === "habitos")!;
    expect(habitos.fields.at(-1)).toEqual({ id: "c_horas", label: "Horas sentado al día", type: "text" });
    const answers = { motivo: "Lumbalgia", c_horas: "8" };
    expect(orphanAnswers(answers, sections)).toEqual([]);
    expect(anamnesisRows(answers, sections)).toContainEqual(["6. Hábitos y estilo de vida", "Horas sentado al día", "8"]);
    // Sin el campo: la respuesta no se pierde.
    await saveCustomFields(db, []);
    expect(orphanAnswers(answers, withCustom(await getCustomFields(db)))).toEqual([["c_horas", "8"]]);
    expect(answerText(undefined, "8")).toBe("8");
  });

  it("los paquetes por especialidad se añaden una vez", async () => {
    const db = await createTestDb();
    const n = await addCustomPack(db, "suelo_pelvico");
    expect(n).toBeGreaterThan(2);
    expect(await addCustomPack(db, "suelo_pelvico")).toBe(0);
    const fields = await getCustomFields(db);
    expect(fields.find((f) => f.label === "Escapes de orina")).toMatchObject({ section: "motivo", type: "choice" });
    expect(new Set(fields.map((f) => f.id)).size).toBe(fields.length);
  });
});
