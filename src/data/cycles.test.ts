// Plan por ciclos (cycles.ts): fechas, reglas de progresión, descarga, texto de Tratamiento, 1RM y lo guardado.
import { beforeEach, describe, expect, it } from "vitest";
import { createEpisode, deleteEpisode } from "./episodes";
import { deleteSession, saveSession } from "./clinical";
import {
  checkPlan,
  cleanOrphanCycles,
  deload,
  doneKey,
  doneSql,
  doseText,
  emptyPhase,
  extendPhase,
  fillPhase,
  finishPhase,
  kgOfPct,
  loadDone,
  loadPlan,
  newExercise,
  newPlan,
  nextTreatment,
  oneRmEpley,
  phaseAt,
  phaseFromPrevious,
  planEnd,
  planSpanText,
  progress,
  savePhase,
  savePlan,
  sessionFor,
  sessionsBeforeInWeek,
  setCell,
  treatmentText,
  weekDays,
  weekIndexOf,
  type PhaseDoc,
  type PlanDoc,
} from "./cycles";
import type { Db } from "./db";
import { createPatient, deletePatient, type PatientInput } from "./repo";
import { createTestDb } from "./testDb";

const person = (name: string): PatientInput => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const four = [
  { name: "Adaptación", weeks: 4 },
  { name: "Desarrollo", weeks: 6 },
  { name: "Pico", weeks: 6 },
  { name: "Transición", weeks: 4 },
];
const plan = (over: Partial<PlanDoc> = {}): PlanDoc => ({ ...newPlan({ goal: "Volver a jugar", start: "2026-09-14", phases: four, perWeek: 2, deload: true, effort: "rpe" }), ...over });

/** Una fase con una sesión tipo y dos ejercicios en su primera semana. */
function phaseWith(weeks: number): PhaseDoc {
  const doc = emptyPhase("f1", weeks);
  const squat = { ...newExercise("Sentadilla a cajón"), id: "sq", rule: "rep1" as const };
  const press = { ...newExercise("Prensa bilateral"), id: "pr", rule: "kg5" as const };
  doc.sessions = [{ id: "A", label: "A", exercises: [squat, press] }];
  doc.weeks[0] = { A: { sq: { sets: 3, reps: 10, kg: 0, effort: 5 }, pr: { sets: 3, reps: 10, kg: 40, effort: 6 } } };
  return doc;
}

describe("fechas y semanas", () => {
  it("20 semanas del lunes 14 de septiembre al domingo 31 de enero, cambiando de año", () => {
    const p = plan();
    expect(planEnd(p)).toBe("2027-01-31");
    expect(planSpanText(p)).toBe("20 semanas · del 14 sep al 31 ene");
    expect(weekIndexOf(p, "2026-09-14")).toBe(0);
    expect(weekIndexOf(p, "2026-09-20")).toBe(0);
    expect(weekIndexOf(p, "2026-09-21")).toBe(1);
    expect(weekIndexOf(p, "2027-01-31")).toBe(19);
    expect(weekIndexOf(p, "2026-09-13")).toBe(-1);
    expect(phaseAt(p, 3)).toEqual({ index: 0, week: 3, weeks: 4, deload: true });
    expect(phaseAt(p, 4)).toEqual({ index: 1, week: 0, weeks: 6, deload: false });
    expect(phaseAt(p, 20)).toBeNull();
  });

  it("un plan que empieza en miércoles: su semana 1 es la de ese miércoles, de lunes a domingo", () => {
    const p = plan({ start: "2026-12-30" });
    expect(weekDays(p, 0)).toEqual(["2026-12-30", "2027-01-03"]);
    expect(weekDays(p, 1)).toEqual(["2027-01-04", "2027-01-10"]);
    expect(weekIndexOf(p, "2026-12-28")).toBe(0);
    expect(weekIndexOf(p, "2027-01-04")).toBe(1);
  });

  it("comprueba lo que hace falta", () => {
    expect(checkPlan(plan())).toBeNull();
    expect(checkPlan(plan({ phases: [] }))).toBe("Pon al menos una fase.");
    expect(checkPlan(plan({ start: "" }))).toBe("Pon el día en que empieza.");
  });
});

describe("cómo progresa", () => {
  it("cada regla cambia solo lo suyo y los kilos van a 0,5", () => {
    const d = { sets: 3, reps: 10, kg: 41, effort: 6 };
    expect(progress(d, "same")).toEqual(d);
    expect(progress(d, "rep1")!.reps).toBe(11);
    expect(progress(d, "rep2")!.reps).toBe(12);
    expect(progress(d, "rep3")!.reps).toBe(13);
    expect(progress(d, "kg2.5")!.kg).toBe(43.5);
    expect(progress(d, "kg5")!.kg).toBe(46);
    expect(progress(d, "pct5")!.kg).toBe(43);
    expect(progress({ pct: 70 }, "pct5")!.pct).toBe(73.5);
    expect(progress({ effort: 10 }, "rpe1")!.effort).toBe(10);
    expect(progress({ effort: 0 }, "rir1")!.effort).toBe(0);
    expect(progress({ effort: 3 }, "rir1")!.effort).toBe(2);
    expect(progress(d, "manual")).toBeNull();
    // Sin kilos, +2,5 kg no se inventa unos.
    expect(progress({ sets: 3, reps: 12 }, "kg2.5")).toEqual({ sets: 3, reps: 12 });
  });

  it("descarga: una serie menos (mínimo 1) y el 40 % menos de carga; repeticiones y esfuerzo iguales", () => {
    expect(deload({ sets: 3, reps: 10, kg: 50, effort: 7 }, 40)).toEqual({ sets: 2, reps: 10, kg: 30, effort: 7 });
    expect(deload({ sets: 1, kg: 11 }, 40)).toEqual({ sets: 1, kg: 6.5 });
    expect(deload({ kg: 50 }, 90).kg).toBe(20);
  });

  it("rellena las semanas con su regla y la descarga en la última", () => {
    const { doc, kept } = fillPhase(phaseWith(4), { weeks: 4, deload: true });
    expect(kept).toBe(0);
    expect(doc.weeks.map((w) => w.A!.sq)).toEqual([
      { sets: 3, reps: 10, kg: 0, effort: 5 },
      { sets: 3, reps: 11, kg: 0, effort: 5 },
      { sets: 3, reps: 12, kg: 0, effort: 5 },
      { sets: 2, reps: 12, kg: 0, effort: 5 },
    ]);
    expect(doc.weeks.map((w) => w.A!.pr!.kg)).toEqual([40, 45, 50, 30]);
  });

  it("lo cambiado a mano no se pisa al volver a rellenar, salvo que se pida", () => {
    let doc = fillPhase(phaseWith(4), { weeks: 4, deload: true }).doc;
    doc = setCell(doc, 2, "A", "pr", { ...doc.weeks[2]!.A!.pr, kg: 47.5 });
    expect(doc.manual).toEqual(["2:A:pr:kg"]);
    const again = fillPhase(doc, { weeks: 4, deload: true });
    expect(again.kept).toBe(1);
    expect(again.doc.weeks[2]!.A!.pr!.kg).toBe(47.5);
    // La semana siguiente parte de lo puesto a mano.
    expect(again.doc.weeks[3]!.A!.pr!.kg).toBe(28.5);
    const forced = fillPhase(doc, { weeks: 4, deload: true, overwrite: true });
    expect(forced.doc.weeks[2]!.A!.pr!.kg).toBe(50);
    expect(forced.doc.manual).toEqual([]);
  });

  it("«Poner ejercicios» empieza con la última semana normal de la fase anterior", () => {
    const prev = fillPhase(phaseWith(4), { weeks: 4, deload: true }).doc;
    const next = phaseFromPrevious(prev, true, "f2", 6);
    expect(next.weeks).toHaveLength(6);
    expect(next.weeks[0]!.A!.pr!.kg).toBe(50);
    expect(next.sessions[0]!.exercises.map((e) => e.name)).toEqual(["Sentadilla a cajón", "Prensa bilateral"]);
    // Sin descarga, la última.
    expect(phaseFromPrevious(prev, false, "f2", 6).weeks[0]!.A!.pr!.kg).toBe(30);
  });

  it("alargar una semana mete la nueva antes de la descarga y mueve las fases siguientes", () => {
    const p = plan();
    const doc = fillPhase(phaseWith(4), { weeks: 4, deload: true }).doc;
    const out = extendPhase(p, { ...doc, manual: ["3:A:pr:kg"] }, 0);
    expect(out.plan.phases[0]!.weeks).toBe(5);
    expect(planEnd(out.plan)).toBe("2027-02-07");
    expect(out.doc!.weeks).toHaveLength(5);
    expect(out.doc!.weeks[3]!.A!.pr!.kg).toBe(50);
    expect(out.doc!.weeks[4]!.A!.pr!.kg).toBe(30);
    expect(out.doc!.manual).toEqual(["4:A:pr:kg"]);
    expect(phaseAt(out.plan, 5)).toEqual({ index: 1, week: 0, weeks: 6, deload: false });
  });

  it("pasar a la siguiente fase acaba la de ahora esta semana y adelanta las demás", () => {
    const p = plan();
    const doc = fillPhase(phaseWith(4), { weeks: 4, deload: true }).doc;
    const out = finishPhase(p, doc, 0, 1);
    expect(out.plan.phases[0]!.weeks).toBe(2);
    expect(out.doc!.weeks).toHaveLength(2);
    expect(phaseAt(out.plan, 2)!.index).toBe(1);
    expect(planEnd(out.plan)).toBe("2027-01-17");
  });
});

describe("1RM aproximado", () => {
  it("Epley, con una repetición los propios kilos, hasta 12 repeticiones", () => {
    expect(oneRmEpley(60, 10)).toBe(80);
    expect(oneRmEpley(100, 1)).toBe(100);
    expect(oneRmEpley(50, 5)).toBe(58.5);
    expect(oneRmEpley(50, 13)).toBeNull();
    expect(oneRmEpley(0, 5)).toBeNull();
  });
  it("los kilos de un % del 1RM, solo si hay 1RM", () => {
    expect(kgOfPct(80, 60)).toBe(48);
    expect(kgOfPct(null, 60)).toBeNull();
    expect(kgOfPct(80, undefined)).toBeNull();
  });
});

describe("el texto de Tratamiento", () => {
  const tpl = phaseWith(4).sessions[0]!;
  const planned = { sq: { sets: 3, reps: 12, kg: 0, effort: 6 }, pr: { sets: 3, reps: 10, kg: 45, effort: 6 } };

  it("con y sin kilos, con lo real distinto de lo previsto", () => {
    const text = treatmentText(tpl, planned, { items: [{ exId: "sq", state: "done" }, { exId: "pr", state: "changed", real: { sets: 3, reps: 10, kg: 45, effort: 8 } }], extra: [] }, "rpe");
    expect(text).toBe("Sentadilla a cajón 3 × 12 (RPE 6). Prensa bilateral 3 × 10 con 45 kg (RPE 8).");
  });

  it("RIR, sin esfuerzo, lo no marcado no sale y lo añadido ese día sí", () => {
    const done = { items: [{ exId: "pr", state: "done" as const }], extra: [{ name: "Bicicleta 10 min" }] };
    expect(treatmentText(tpl, { pr: { sets: 3, reps: 10, kg: 45, effort: 2 } }, done, "rir")).toBe("Prensa bilateral 3 × 10 con 45 kg (RIR 2). Bicicleta 10 min.");
    expect(treatmentText(tpl, planned, done, "none")).toBe("Prensa bilateral 3 × 10 con 45 kg. Bicicleta 10 min.");
  });

  it("tiempo, % 1RM, lado y tempo", () => {
    expect(doseText({ sets: 3, time: 30 }, "rpe")).toBe("3 × 30 s");
    expect(doseText({ sets: 3, reps: 8, pct: 70 }, "rpe")).toBe("3 × 8 al 70 % del 1RM");
    expect(doseText({ sets: 2, reps: 12, side: "der", tempo: "3-1-1" }, "none")).toBe("2 × 12, tempo 3-1-1, lado derecho");
  });

  it("si el fisio cambia el texto a mano, la app ya no lo toca", () => {
    expect(nextTreatment("", "", "A.")).toBe("A.");
    expect(nextTreatment("A.", "A.", "A. B.")).toBe("A. B.");
    expect(nextTreatment("A. Y masaje.", "A.", "A. B.")).toBeNull();
  });

  it("la sesión tipo que toca rota A, B, A…", () => {
    const doc = phaseWith(4);
    doc.sessions.push({ id: "B", label: "B", exercises: [newExercise("Puente de glúteo")] });
    expect(sessionFor(doc, 0)!.id).toBe("A");
    expect(sessionFor(doc, 1)!.id).toBe("B");
    expect(sessionFor(doc, 2)!.id).toBe("A");
    expect(sessionFor(emptyPhase("x", 2), 0)).toBeNull();
  });
});

describe("en la base", () => {
  let db: Db;
  beforeEach(async () => {
    db = await createTestDb();
  });
  const session = (performedAt: string) => ({ performedAt, pain: null, subjective: "", objective: "", treatment: "Terapia manual", plan: "", reviewOn: null, nextAt: null, nextMinutes: null });

  it("dos planes en dos motivos del mismo paciente, cada uno con sus fases; un motivo sin plan no tiene nada", async () => {
    const pid = await createPatient(db, person("Lucía Ciclos"));
    const ep = await createEpisode(db, pid, { title: "Hombro", startedAt: "2026-10-01T10:00:00.000Z", answers: {} });
    const a = plan();
    const b = plan({ goal: "Hombro sin dolor" });
    await savePlan(db, pid, pid, a, [{ ...phaseWith(4), id: a.phases[0]!.id }]);
    await savePlan(db, pid, ep, b);
    expect((await loadPlan(db, pid, pid))!.phases[a.phases[0]!.id]!.sessions).toHaveLength(1);
    expect((await loadPlan(db, pid, ep))!.plan.goal).toBe("Hombro sin dolor");
    const other = await createEpisode(db, pid, { title: "Tobillo", startedAt: "2026-10-02T10:00:00.000Z", answers: {} });
    expect(await loadPlan(db, pid, other)).toBeNull();
  });

  it("quitar una fase del plan no borra ninguna sesión; borrar el motivo borra su plan; borrar el paciente, todo", async () => {
    const pid = await createPatient(db, person("Mario Fases"));
    const sid = await saveSession(db, pid, session("2026-09-15T09:00:00.000Z"));
    const p = plan();
    await savePlan(db, pid, pid, p, [{ ...phaseWith(4), id: p.phases[0]!.id }, { ...emptyPhase(p.phases[1]!.id, 6) }]);
    await db.transaction(doneSql(pid, sid, { v: 1, phaseId: p.phases[0]!.id, week: 0, sessionTplId: "A", items: [{ exId: "sq", state: "done" }], extra: [], auto: "" }));
    await savePlan(db, pid, pid, { ...p, phases: [p.phases[1]!] });
    expect(Object.keys((await loadPlan(db, pid, pid))!.phases)).toEqual([p.phases[1]!.id]);
    expect(await db.query("select id from sessions where id = ?", [sid])).toHaveLength(1);
    expect(await loadDone(db, pid, sid)).not.toBeNull();

    const ep = await createEpisode(db, pid, { title: "Hombro", startedAt: "2026-10-01T10:00:00.000Z", answers: {} });
    await savePlan(db, pid, ep, plan());
    await deleteEpisode(db, pid, ep);
    expect(await loadPlan(db, pid, ep)).toBeNull();
    expect(await loadPlan(db, pid, pid)).not.toBeNull();

    await deleteSession(db, sid);
    expect(await loadDone(db, pid, sid)).toBeNull();
    await deletePatient(db, pid);
    expect(await db.query("select key from settings where key like 'ciclos%'")).toEqual([]);
  });

  it("lo que se queda sin dueño (borrado en otro dispositivo) se limpia", async () => {
    const pid = await createPatient(db, person("Nora Huérfana"));
    const keep = await createPatient(db, person("Olga Sigue"));
    await savePlan(db, pid, pid, plan());
    await savePlan(db, keep, keep, plan());
    await db.transaction([{ sql: "insert into settings (key, value) values (?, '{}')", bind: [doneKey(keep, "no-existe")] }]);
    // Como si el borrado del paciente llegara de otro dispositivo, sin pasar por deletePatient.
    await db.transaction([{ sql: "delete from patients where id = ?", bind: [pid] }]);
    expect(await cleanOrphanCycles(db)).toBe(2);
    expect(await loadPlan(db, keep, keep)).not.toBeNull();
  });

  it("qué sesión de la semana es (de lunes a domingo, en el día de Madrid)", async () => {
    const pid = await createPatient(db, person("Pablo Semana"));
    await saveSession(db, pid, session("2026-09-14T08:00:00.000Z"));
    await saveSession(db, pid, session("2026-09-13T21:30:00.000Z"));
    // El domingo 13 a las 23:30 de Madrid es de la semana anterior.
    expect(await sessionsBeforeInWeek(db, pid, pid, "2026-09-16T08:00:00.000Z")).toBe(1);
    expect(await sessionsBeforeInWeek(db, pid, pid, "2026-09-14T07:00:00.000Z")).toBe(0);
  });

  it("guarda una fase sin tocar las demás", async () => {
    const pid = await createPatient(db, person("Quique Fase"));
    const p = plan();
    await savePlan(db, pid, pid, p, [{ ...phaseWith(4), id: p.phases[0]!.id }]);
    await savePhase(db, pid, pid, { ...emptyPhase(p.phases[1]!.id, 6), goal: "Fuerza" });
    const loaded = (await loadPlan(db, pid, pid))!;
    expect(loaded.phases[p.phases[0]!.id]!.sessions).toHaveLength(1);
    expect(loaded.phases[p.phases[1]!.id]!.goal).toBe("Fuerza");
  });
});
