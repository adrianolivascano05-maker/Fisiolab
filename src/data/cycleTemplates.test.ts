// Plantillas de plan por ciclos (cycleTemplates.ts): sin nada del paciente, con ids nuevos al usarlas, y en la base.
import { describe, expect, it } from "vitest";
import { emptyPhase, extendPhase, finishPhase, isAssessWeek, newExercise, newPlan, toggleAssess, type LoadedPlan, type PhaseDoc } from "./cycles";
import { duplicateTemplate, listTemplates, parseTemplate, planFromTemplate, saveTemplate, templateFromPlan, templateSummary } from "./cycleTemplates";
import type { Db } from "./db";
import { createTestDb } from "./testDb";

function loaded(): LoadedPlan {
  const plan = newPlan({ goal: "Volver a jugar al pádel con Lucía", start: "2026-11-16", phases: [{ name: "Adaptación", weeks: 3 }, { name: "Desarrollo", weeks: 4 }], perWeek: 3, deload: true, effort: "rir" });
  const doc: PhaseDoc = { ...emptyPhase(plan.phases[0]!.id, 3), goal: "Bajar el dolor de Lucía", deloadPct: 30, assess: [2] };
  const ex = { ...newExercise("Prensa"), id: "pr", oneRm: 120, how: "Espalda pegada." };
  doc.sessions = [{ id: "A", label: "A", exercises: [ex] }];
  doc.weeks = [{ A: { pr: { sets: 3, reps: 10, kg: 60 } } }, { A: { pr: { sets: 3, reps: 10, kg: 65 } } }, { A: { pr: { sets: 2, reps: 10, kg: 39 } } }];
  doc.manual = ["1:A:pr:kg"];
  return { plan, phases: { [doc.id]: doc } };
}

describe("plantillas", () => {
  it("guardan la estructura y los ejercicios, sin fechas, objetivos ni 1RM", () => {
    const t = templateFromPlan(loaded(), "  Rodilla 7 semanas  ", "2026-11-17T10:00:00.000Z", "t1");
    expect(t.name).toBe("Rodilla 7 semanas");
    expect(t.phases).toEqual([{ name: "Adaptación", weeks: 3 }, { name: "Desarrollo", weeks: 4 }]);
    expect(t).toMatchObject({ perWeek: 3, deload: true, effort: "rir" });
    expect(JSON.stringify(t)).not.toContain("Lucía");
    expect(JSON.stringify(t)).not.toContain("2026-11-16");
    expect(t.docs[0]!.sessions[0]!.exercises[0]).toMatchObject({ name: "Prensa", oneRm: null, how: "Espalda pegada." });
    expect(t.docs[0]!.assess).toEqual([2]);
    expect(t.docs[1]).toBeNull();
    expect(templateSummary(t)).toBe("2 fases · 7 semanas · 3 por semana · 1 ejercicio");
  });

  it("al usarla, el plan del paciente lleva sus fechas, ids nuevos y las casillas en su sitio", () => {
    const t = templateFromPlan(loaded(), "Rodilla", undefined, "t1");
    const { plan, docs } = planFromTemplate(t, { goal: "Correr", start: "2027-01-13" });
    expect(plan.goal).toBe("Correr");
    expect(plan.start).toBe("2027-01-13");
    expect(docs).toHaveLength(1);
    const d = docs[0]!;
    expect(d.id).toBe(plan.phases[0]!.id);
    expect(d.goal).toBe("");
    const s = d.sessions[0]!;
    const e = s.exercises[0]!;
    expect(s.id).not.toBe("A");
    expect(e.id).not.toBe("pr");
    expect(d.weeks[1]![s.id]![e.id]).toEqual({ sets: 3, reps: 10, kg: 65 });
    expect(d.manual).toEqual([`1:${s.id}:${e.id}:kg`]);
    expect(isAssessWeek(d, 2)).toBe(true);
  });

  it("en la base: se listan por nombre, se renombran, se duplican y se archivan", async () => {
    const db: Db = await createTestDb();
    const t = templateFromPlan(loaded(), "Rodilla", undefined, "t1");
    await saveTemplate(db, t);
    await saveTemplate(db, duplicateTemplate(t));
    await saveTemplate(db, { ...t, name: "Hombro" });
    expect((await listTemplates(db)).map((x) => x.name)).toEqual(["Hombro", "Rodilla (copia)"]);
    await saveTemplate(db, { ...t, name: "Hombro", archived: true });
    expect((await listTemplates(db)).find((x) => x.id === "t1")!.archived).toBe(true);
    await expect(saveTemplate(db, { ...t, name: "  " })).rejects.toThrow(/nombre/);
    expect(parseTemplate({ v: 1, id: "x", name: "y", phases: [] })).toBeNull();
  });
});

describe("semanas de valoración", () => {
  it("se marcan y se quitan; se corren al alargar y se recortan al pasar de fase", () => {
    const { plan, phases } = loaded();
    const doc = phases[plan.phases[0]!.id]!;
    expect(isAssessWeek(toggleAssess(doc, 0), 0)).toBe(true);
    expect(isAssessWeek(toggleAssess(doc, 2), 2)).toBe(false);
    // Alargar con descarga mete la semana nueva antes de la última: la valoración de la última se corre.
    expect(extendPhase(plan, doc, 0).doc!.assess).toEqual([3]);
    expect(finishPhase(plan, doc, 0, 1).doc!.assess).toEqual([]);
  });
});
