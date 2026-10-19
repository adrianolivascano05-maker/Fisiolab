import { beforeEach, describe, expect, it } from "vitest";
import { regions } from "../gallery/regions";
import { answerText, BODY_REGIONS, clinicalSummary, getField, orphanAnswers } from "../clinical/anamnesis";
import {
  deleteFinding,
  dueReviews,
  getAnamnesis,
  latestFindings,
  listFindings,
  listSessions,
  saveAnamnesis,
  saveFinding,
  saveSession,
  type FindingInput,
  type SessionInput,
} from "./clinical";
import type { Db } from "./db";
import { createPatient, deletePatient, exportCsv } from "./repo";
import { createTestDb } from "./testDb";

let db: Db;
let pid: string;
beforeEach(async () => {
  db = await createTestDb();
  pid = await createPatient(db, { name: "Ana", birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
});

const session = (over: Partial<SessionInput> = {}): SessionInput => ({
  performedAt: "2026-10-01T10:00:00.000Z",
  pain: 6,
  subjective: "Le duele al bajar escaleras",
  objective: "",
  treatment: "Terapia manual",
  plan: "Sentadilla isométrica",
  reviewOn: null,
  nextAt: null,
  nextMinutes: null,
  ...over,
});

const lachman = (over: Partial<FindingInput> = {}): FindingInput => ({
  galleryTest: "rod-lachman",
  testName: "Test de Lachman",
  region: "rodilla",
  performedAt: "2026-10-01T10:00:00.000Z",
  side: "right",
  result: "positive",
  notes: "",
  ...over,
});

describe("anamnesis", () => {
  it("se guarda, se actualiza y quita las respuestas vacías", async () => {
    expect(await getAnamnesis(db, pid)).toBeNull();
    await saveAnamnesis(db, pid, { motivo: "Dolor de rodilla", regiones: ["rodilla"], eva: 6, alergias: "", banderas_rojas: [] });
    const a = await getAnamnesis(db, pid);
    expect(a!.answers).toEqual({ motivo: "Dolor de rodilla", regiones: ["rodilla"], eva: 6 });
    await saveAnamnesis(db, pid, { ...a!.answers, eva: 4 });
    const b = await getAnamnesis(db, pid);
    expect(b!.answers.eva).toBe(4);
    expect(b!.createdAt).toBe(a!.createdAt);
  });

  it("resumen, textos y respuestas de campos que ya no existen", () => {
    const answers = { motivo: "Dolor", regiones: ["rodilla", "cadera"], lado: "Derecho", banderas_rojas: ["Fiebre o malestar general"], campo_viejo: "dato" };
    const s = clinicalSummary(answers);
    expect(s.regions).toEqual(["rodilla", "cadera"]);
    expect(s.redFlags).toHaveLength(1);
    expect(answerText(getField("regiones"), answers.regiones)).toBe("Rodilla, Cadera");
    expect(answerText(getField("fecha_valoracion"), "2026-09-14")).toBe("14/09/2026");
    expect(answerText(getField("eva"), 6)).toBe("6/10");
    expect(orphanAnswers(answers)).toEqual([["campo_viejo", "dato"]]);
  });

  it("las zonas son las mismas que las regiones de la galería", () => {
    expect(BODY_REGIONS.map((r) => r.id).sort()).toEqual(regions.map((r) => r.id).sort());
  });
});

describe("sesiones", () => {
  it("crear, editar, listar (la más reciente primero) y validar", async () => {
    const a = await saveSession(db, pid, session());
    const b = await saveSession(db, pid, session({ performedAt: "2026-10-08T10:00:00.000Z", pain: 3 }));
    expect((await listSessions(db, pid)).map((s) => s.id)).toEqual([b, a]);
    await saveSession(db, pid, session({ pain: 5 }), a);
    expect((await listSessions(db, pid)).find((s) => s.id === a)!.pain).toBe(5);
    await expect(saveSession(db, pid, session({ pain: 11 }))).rejects.toThrow("0 a 10");
    await expect(saveSession(db, pid, session({ reviewOn: "mañana" }))).rejects.toThrow("reevaluación");
  });

  it("siguiente cita: después de la sesión, con duración; la de la última sesión si no ha pasado", async () => {
    const { nextVisit } = await import("./clinical");
    await expect(saveSession(db, pid, session({ nextAt: "2026-09-30T10:00:00.000Z", nextMinutes: 45 }))).rejects.toThrow("después");
    await expect(saveSession(db, pid, session({ nextAt: "2026-10-08T10:00:00.000Z", nextMinutes: null }))).rejects.toThrow("cuánto dura");
    // Sin fecha, la duración no se guarda.
    const a = await saveSession(db, pid, session({ nextMinutes: 60 }));
    expect((await listSessions(db, pid))[0]).toMatchObject({ id: a, nextAt: null, nextMinutes: null });
    await saveSession(db, pid, session({ nextAt: "2026-10-08T10:00:00.000Z", nextMinutes: 45 }), a);
    const list = await listSessions(db, pid);
    expect(list[0]).toMatchObject({ nextAt: "2026-10-08T10:00:00.000Z", nextMinutes: 45 });
    expect(nextVisit(list, new Date("2026-10-05T00:00:00Z"))?.id).toBe(a);
    expect(nextVisit(list, new Date("2026-10-09T00:00:00Z"))).toBeNull();
  });

  it("reevaluaciones pendientes: cuenta la de la última sesión", async () => {
    await saveSession(db, pid, session({ reviewOn: "2026-10-05" }));
    expect(await dueReviews(db, "2026-10-04")).toEqual([]);
    expect((await dueReviews(db, "2026-10-05"))[0]).toMatchObject({ patientId: pid, reviewOn: "2026-10-05" });
    // Una sesión posterior sin reevaluación la da por hecha.
    await saveSession(db, pid, session({ performedAt: "2026-10-06T10:00:00.000Z", reviewOn: null }));
    expect(await dueReviews(db, "2026-10-10")).toEqual([]);
  });
});

describe("exploración", () => {
  it("guarda hallazgos y se queda con el último de cada test y lado", async () => {
    await saveFinding(db, pid, lachman());
    await saveFinding(db, pid, lachman({ performedAt: "2026-10-20T10:00:00.000Z", result: "negative" }));
    await saveFinding(db, pid, lachman({ side: "left", result: "negative" }));
    const all = await listFindings(db, pid);
    expect(all).toHaveLength(3);
    const latest = latestFindings(all);
    expect(latest).toHaveLength(2);
    expect(latest.find((f) => f.side === "right")!.result).toBe("negative");
    await deleteFinding(db, all[0]!.id);
    expect(await listFindings(db, pid)).toHaveLength(2);
    await expect(saveFinding(db, pid, lachman({ galleryTest: "" }))).rejects.toThrow("Elige el test");
  });

  it("borrar el paciente borra su anamnesis, sesiones y hallazgos", async () => {
    await saveAnamnesis(db, pid, { motivo: "x" });
    await saveSession(db, pid, session());
    await saveFinding(db, pid, lachman());
    await deletePatient(db, pid);
    expect(await getAnamnesis(db, pid)).toBeNull();
    expect(await listSessions(db, pid)).toEqual([]);
    expect(await listFindings(db, pid)).toEqual([]);
  });

  it("el CSV lleva el dolor de cada sesión y los tests de exploración", async () => {
    await saveSession(db, pid, session());
    await saveFinding(db, pid, lachman());
    const csv = await exportCsv(db);
    expect(csv).toContain("Ana;2026-10-01T10:00:00.000Z;sesion;;;;;;;;dolor_eva;6;0-10");
    expect(csv).toContain("Ana;2026-10-01T10:00:00.000Z;exploracion;Test de Lachman;derecha;;;;;;resultado;1;positivo");
  });
});

describe("simetría y cuestionarios", () => {
  it("LSI = peor / mejor con la última medición de cada lado; en tiempos, peor es más lento", async () => {
    const { symmetryRows } = await import("../clinical/symmetry");
    const base = { extraLoadKg: 0, heightCm: null, rsi: null, distanceCm: null, movement: null, angleDeg: null, exercise: null, barVelocity: null, timeS: null, contactMs: null };
    const rows = symmetryRows([
      { ...base, id: "a", type: "single_leg", side: "left", performedAt: "2026-10-02", heightCm: 18 },
      { ...base, id: "b", type: "single_leg", side: "right", performedAt: "2026-10-02", heightCm: 20 },
      { ...base, id: "c", type: "single_leg", side: "left", performedAt: "2026-09-01", heightCm: 10 },
      { ...base, id: "d", type: "cod_505", side: "left", performedAt: "2026-10-02", timeS: 2.5 },
      { ...base, id: "e", type: "cod_505", side: "right", performedAt: "2026-10-02", timeS: 2.4 },
    ]);
    expect(rows[0]).toMatchObject({ title: "CMJ a una pierna", weaker: "left" });
    expect(rows[0]!.lsi).toBeCloseTo(90, 5);
    expect(rows[1]).toMatchObject({ weaker: "left", lowerIsBetter: true });
    expect(rows[1]!.lsi).toBeCloseTo(96, 5);
  });

  it("PSFS: media de las actividades; se guarda, se lista y va al CSV", async () => {
    const { psfsScore } = await import("../clinical/questionnaires");
    const { saveQuestionnaire, listQuestionnaires } = await import("./clinical");
    expect(psfsScore([{ name: "Bajar escaleras", score: 4 }, { name: "Correr", score: 2 }, { name: "", score: 9 }])).toBe(3);
    expect(() => psfsScore([])).toThrow("al menos una");
    await saveQuestionnaire(db, pid, { kind: "koos", performedAt: "2026-10-01T10:00:00.000Z", score: 62, details: { subscale: "Dolor" }, notes: "" });
    expect((await listQuestionnaires(db, pid))[0]).toMatchObject({ kind: "koos", score: 62, details: { subscale: "Dolor" } });
    expect(await exportCsv(db)).toContain("Ana;2026-10-01T10:00:00.000Z;cuestionario;koos · Dolor;;;;;;;puntuacion;62;");
  });

  it("catálogo: los de la zona primero, zonas que existen, «otro» con su rango y puntuaciones legibles", async () => {
    const { byRegions, kindOf, QUESTIONNAIRES, scoreText } = await import("../clinical/questionnaires");
    const ids = new Set(BODY_REGIONS.map((r) => r.id));
    for (const q of QUESTIONNAIRES) for (const r of q.regions ?? []) expect(ids.has(r), `${q.id}: ${r}`).toBe(true);
    const knee = byRegions(["rodilla"]);
    expect(knee.length).toBe(QUESTIONNAIRES.length);
    expect(knee.filter((k) => k.forRegion).map((k) => k.kind.id)).toEqual(["koos", "lefs", "visa_p", "acl_rsi"]);
    expect(knee.findIndex((k) => !k.forRegion)).toBe(4);
    const other = kindOf("otro", { name: "Escala propia", min: 0, max: 20, better: "lower" });
    expect(other).toMatchObject({ name: "Escala propia", max: 20, better: "lower" });
    expect(scoreText(other, 7.5)).toBe("7,5/20");
    expect(scoreText(kindOf("groc", {}), 3)).toBe("+3");
    expect(scoreText(kindOf("odi", {}), 24)).toBe("24 %");
  });
});
