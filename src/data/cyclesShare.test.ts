// «Enviar la semana al paciente» (cyclesShare.ts): qué se le enseña según lo marcado, cuándo caduca y los enlaces
// apuntados con el plan.
import { beforeEach, describe, expect, it } from "vitest";
import { emptyPhase, loadPlan, newExercise, newPlan, rememberedExercise, rememberSql, savePlan, type LoadedPlan, type PhaseDoc, type PlanDoc } from "./cycles";
import { addSent, cancelSent, loadSent, patientDose, sentAlive, weekEnd, weekShare } from "./cyclesShare";
import type { Db } from "./db";
import { deleteEpisode, createEpisode } from "./episodes";
import { createPatient, deletePatient, type PatientInput } from "./repo";
import { createTestDb } from "./testDb";

const person = (name: string): PatientInput => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const plan = (): PlanDoc =>
  newPlan({ goal: "Volver a jugar", start: "2026-11-16", phases: [{ name: "Adaptación", weeks: 2 }, { name: "Desarrollo", weeks: 3 }], perWeek: 2, deload: false, effort: "rpe" });

function loaded(p: PlanDoc, sessions = 1): LoadedPlan {
  const doc: PhaseDoc = emptyPhase(p.phases[0]!.id, 2);
  const squat = { ...newExercise("Sentadilla a cajón"), id: "sq", how: "Baja despacio hasta tocar el cajón." };
  const press = { ...newExercise("Prensa bilateral"), id: "pr", params: ["sets" as const, "reps" as const, "pct" as const, "effort" as const], oneRm: 100 };
  const plank = { ...newExercise("Plancha"), id: "pl", params: ["sets" as const, "time" as const] };
  doc.sessions = sessions === 1 ? [{ id: "A", label: "A", exercises: [squat, press] }] : [{ id: "A", label: "A", exercises: [squat, press] }, { id: "B", label: "B", exercises: [plank] }];
  doc.weeks[1] = { A: { sq: { sets: 3, reps: 10, kg: 20, effort: 6 }, pr: { sets: 3, reps: 8, pct: 70, effort: 7 } }, B: { pl: { sets: 3, time: 30 } } };
  return { plan: p, phases: { [doc.id]: doc } };
}

describe("lo que se le enseña", () => {
  it("sin marcar nada: series y repeticiones, sin kilos ni esfuerzo, con «Cómo se hace»", () => {
    const s = weekShare(loaded(plan()), 1, { kg: false, effort: false, plan: false })!;
    expect(s.from).toBe("2026-11-23");
    expect(s.to).toBe("2026-11-29");
    expect(s.sessions).toEqual([
      {
        label: null,
        items: [
          { name: "Sentadilla a cajón", dose: "3 × 10", how: "Baja despacio hasta tocar el cajón." },
          { name: "Prensa bilateral", dose: "3 × 8" },
        ],
      },
    ]);
    expect(s.plan).toBeUndefined();
  });

  it("con los kilos y el esfuerzo: el % del 1RM pasa a kilos si tiene 1RM", () => {
    const s = weekShare(loaded(plan()), 1, { kg: true, effort: true, plan: false })!;
    expect(s.sessions[0]!.items.map((i) => i.dose)).toEqual(["3 × 10 con 20 kg (RPE 6)", "3 × 8 con 70 kg (RPE 7)"]);
    expect(patientDose({ sets: 3, pct: 70 }, null, { kg: true, effort: false })).toEqual({ sets: 3, pct: 70 });
  });

  it("con varias sesiones tipo, cada una con su letra; con las fases, «estás aquí»", () => {
    const s = weekShare(loaded(plan(), 2), 1, { kg: false, effort: false, plan: true })!;
    expect(s.sessions.map((x) => x.label)).toEqual(["A", "B"]);
    expect(s.sessions[1]!.items[0]!.dose).toBe("3 × 30 s");
    expect(s.plan).toEqual({ goal: "Volver a jugar", phases: ["Adaptación", "Desarrollo"], at: 0, week: 1, weeks: 2 });
  });

  it("nada que mandar fuera del plan o en una fase sin ejercicios", () => {
    const l = loaded(plan());
    expect(weekShare(l, -1, { kg: false, effort: false, plan: false })).toBeNull();
    expect(weekShare(l, 2, { kg: false, effort: false, plan: false })).toBeNull();
    expect(weekShare(l, 9, { kg: false, effort: false, plan: false })).toBeNull();
  });
});

describe("caduca al acabar la semana, en la hora de Madrid", () => {
  it("en invierno y en verano, desde cualquier día de la semana", () => {
    expect(weekEnd("2026-11-29")).toBe("2026-11-29T23:00:00.000Z");
    expect(weekEnd("2026-11-23")).toBe("2026-11-29T23:00:00.000Z");
    expect(weekEnd("2026-07-08")).toBe("2026-07-12T22:00:00.000Z");
    // La semana en que se cambia la hora (el 25 de octubre de 2026): el lunes 26 ya en hora de invierno.
    expect(weekEnd("2026-10-21")).toBe("2026-10-25T23:00:00.000Z");
  });
});

describe("en la base", () => {
  let db: Db;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it("los enlaces se apuntan con el plan, se anulan y se borran con el motivo o el paciente; cambiar el plan no los quita", async () => {
    const pid = await createPatient(db, person("Lucía Enlaces"));
    const p = plan();
    await savePlan(db, pid, pid, p);
    const link = { id: "a".repeat(24), key: "k", week: 0, sentAt: "2026-11-17T10:00:00.000Z", expiresAt: "2026-11-22T23:00:00.000Z" };
    await addSent(db, pid, pid, link);
    await addSent(db, pid, pid, { ...link, id: "b".repeat(24), week: 1 });
    expect((await loadSent(db, pid, pid)).map((x) => x.week)).toEqual([1, 0]);
    // Guardar el plan otra vez (con otras fases) no borra los enlaces, y el plan se sigue leyendo bien.
    await savePlan(db, pid, pid, { ...p, phases: [p.phases[1]!] });
    expect(await loadSent(db, pid, pid)).toHaveLength(2);
    expect(Object.keys((await loadPlan(db, pid, pid))!.phases)).toEqual([]);

    await cancelSent(db, pid, pid, link.id, "2026-11-18T10:00:00.000Z");
    const [, first] = await loadSent(db, pid, pid);
    expect(first!.cancelledAt).toBe("2026-11-18T10:00:00.000Z");
    expect(sentAlive(first!, Date.parse("2026-11-19T00:00:00Z"))).toBe(false);
    expect(sentAlive({ ...link }, Date.parse("2026-11-19T00:00:00Z"))).toBe(true);
    expect(sentAlive({ ...link }, Date.parse("2026-11-23T00:00:00Z"))).toBe(false);

    const ep = await createEpisode(db, pid, { title: "Hombro", startedAt: "2026-11-01T10:00:00.000Z", answers: {} });
    await savePlan(db, pid, ep, plan());
    await addSent(db, pid, ep, link);
    await deleteEpisode(db, pid, ep);
    expect(await loadSent(db, pid, ep)).toEqual([]);
    await deletePatient(db, pid);
    expect(await db.query("select key from settings where key like 'ciclos:%'")).toEqual([]);
  });

  it("guarda solo los 8 últimos", async () => {
    const pid = await createPatient(db, person("Mario Ocho"));
    for (let i = 0; i < 10; i++) await addSent(db, pid, pid, { id: `${i}`.padStart(24, "x"), key: "k", week: i, sentAt: "2026-11-17T10:00:00.000Z", expiresAt: "2026-11-22T23:00:00.000Z" });
    expect((await loadSent(db, pid, pid)).map((x) => x.week)).toEqual([9, 8, 7, 6, 5, 4, 3, 2]);
  });

  it("«Cómo se hace» se recuerda con el ejercicio para la próxima vez", async () => {
    await db.transaction(rememberSql([{ ...newExercise("Puente de glúteo"), how: "Aprieta arriba dos segundos." }]));
    const r = await rememberedExercise(db, "puente de gluteo");
    expect(newExercise("Puente de glúteo", r).how).toBe("Aprieta arriba dos segundos.");
  });
});
