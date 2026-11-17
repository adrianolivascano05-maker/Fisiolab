// Evolución por ejercicio (cycleEvolution.ts): previsto y hecho por semana, por nombre en todas las fases.
import { describe, expect, it } from "vitest";
import { emptyPhase, newExercise, newPlan, type DoneDoc, type LoadedPlan, type PhaseDoc } from "./cycles";
import { evolution, planExerciseNames, valueOf } from "./cycleEvolution";

function loaded(): LoadedPlan {
  const plan = newPlan({ goal: "", start: "2026-11-02", phases: [{ name: "Adaptación", weeks: 2 }, { name: "Desarrollo", weeks: 2 }], perWeek: 2, deload: false, effort: "rpe" });
  const a: PhaseDoc = emptyPhase(plan.phases[0]!.id, 2);
  a.sessions = [{ id: "A", label: "A", exercises: [{ ...newExercise("Prensa bilateral"), id: "p1" }, { ...newExercise("Plancha"), id: "pl" }] }];
  a.weeks = [{ A: { p1: { sets: 3, reps: 10, kg: 40, effort: 6 }, pl: { sets: 3, time: 30 } } }, { A: { p1: { sets: 3, reps: 10, kg: 45, effort: 7 } } }];
  const b: PhaseDoc = emptyPhase(plan.phases[1]!.id, 2);
  // En la fase siguiente, el mismo ejercicio con otro id (y escrito con tilde distinta).
  b.sessions = [{ id: "B", label: "A", exercises: [{ ...newExercise("prensa  bilateral"), id: "p2" }] }];
  b.weeks = [{ B: { p2: { sets: 4, reps: 8, kg: 50, effort: 7 } } }, {}];
  return { plan, phases: { [a.id]: a, [b.id]: b } };
}

const done = (phaseId: string, week: number, tpl: string, items: DoneDoc["items"]): DoneDoc => ({ v: 1, phaseId, week, sessionTplId: tpl, items, extra: [], auto: "" });

describe("evolución por ejercicio", () => {
  it("los ejercicios del plan, una vez cada uno", () => {
    expect(planExerciseNames(loaded())).toEqual(["Prensa bilateral", "Plancha"]);
  });

  it("kilos previstos y hechos por semana; «Hecho» cuenta como lo previsto, «Cambiado» con lo real; el esfuerzo, la media", () => {
    const l = loaded();
    const [f1, f2] = l.plan.phases.map((p) => p.id);
    const evo = evolution(l, "Prensa bilateral", [
      { day: "2026-11-03", doc: done(f1!, 0, "A", [{ exId: "p1", state: "done" }]) },
      { day: "2026-11-05", doc: done(f1!, 0, "A", [{ exId: "p1", state: "changed", real: { sets: 3, reps: 10, kg: 42.5, effort: 8 } }]) },
      { day: "2026-11-17", doc: done(f2!, 0, "B", [{ exId: "p2", state: "done" }]) },
      // Fuera del plan: no cuenta.
      { day: "2027-03-01", doc: done(f2!, 0, "B", [{ exId: "p2", state: "done" }]) },
    ])!;
    expect(evo.metric).toBe("kg");
    expect(evo.unit).toBe("kg");
    expect(evo.weeks.map((w) => [w.phase, w.planned, w.done, w.plannedEffort, w.doneEffort, w.sessions])).toEqual([
      [0, 40, 42.5, 6, 7, 2],
      [0, 45, null, 7, null, 0],
      [1, 50, 50, 7, 7, 1],
      [1, null, null, null, null, 0],
    ]);
  });

  it("sin kilos, el tiempo; un ejercicio que no está, nada", () => {
    const evo = evolution(loaded(), "Plancha", [])!;
    expect(evo.metric).toBe("time");
    expect(evo.weeks[0]!.planned).toBe(30);
    expect(evolution(loaded(), "Remo", [])).toBeNull();
    expect(valueOf({ kg: 0, reps: 10 }, "kg")).toBeNull();
  });
});
