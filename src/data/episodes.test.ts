import { beforeEach, describe, expect, it } from "vitest";
import { getAnamnesis, listSessions, saveAnamnesis, saveSession, type SessionInput } from "./clinical";
import type { Db } from "./db";
import { ALL, createEpisode, currentEpisode, deleteEpisode, episodeCounts, getFocus, listEpisodes, setFocus, updateEpisode } from "./episodes";
import { createHorizontalTest, createPatient, listTests } from "./repo";
import { createTestDb } from "./testDb";

let db: Db;
let pid: string;
beforeEach(async () => {
  db = await createTestDb();
  pid = await createPatient(db, { name: "Ana", birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
});

const session = (performedAt: string, subjective = ""): SessionInput => ({
  performedAt,
  pain: null,
  subjective,
  objective: "",
  treatment: "",
  plan: "",
  reviewOn: null,
  nextAt: null,
  nextMinutes: null,
});

describe("motivos de consulta", () => {
  it("sin motivos nuevos, todo es del primero y se ve como siempre", async () => {
    await saveAnamnesis(db, pid, { motivo: "Rodilla" });
    await saveSession(db, pid, session("2026-01-10T10:00:00.000Z"));
    const eps = await listEpisodes(db, pid);
    expect(eps).toHaveLength(1);
    expect(eps[0]).toMatchObject({ id: pid, first: true });
    expect(await getFocus(db, pid)).toBe(ALL);
    expect(await listSessions(db, pid)).toHaveLength(1);
    expect((await getAnamnesis(db, pid))?.answers).toEqual({ motivo: "Rodilla" });
  });

  it("un motivo nuevo lleva su anamnesis y sus registros; el filtro enseña los de cada uno", async () => {
    await saveAnamnesis(db, pid, { motivo: "Rodilla", profesion: "Profesora" });
    await saveSession(db, pid, session("2026-01-10T10:00:00.000Z", "rodilla"));
    await createHorizontalTest(db, pid, 180);

    const hombro = await createEpisode(db, pid, { title: "Hombro derecho", startedAt: "2026-06-01T09:00:00.000Z", answers: { profesion: "Profesora" } });
    expect(await getFocus(db, pid)).toBe(hombro);
    // La anamnesis es la del motivo nuevo y se guarda en él.
    expect((await getAnamnesis(db, pid))?.answers).toEqual({ profesion: "Profesora" });
    await saveAnamnesis(db, pid, { profesion: "Profesora", motivo: "Dolor al elevar el brazo" });
    // Lo nuevo va al motivo que se ve.
    await saveSession(db, pid, session("2026-06-01T10:00:00.000Z", "hombro"));
    expect((await listSessions(db, pid)).map((s) => s.subjective)).toEqual(["hombro"]);
    expect(await listTests(db, pid)).toHaveLength(0);

    await setFocus(db, pid, pid);
    expect((await listSessions(db, pid)).map((s) => s.subjective)).toEqual(["rodilla"]);
    expect(await listTests(db, pid)).toHaveLength(1);
    expect((await getAnamnesis(db, pid))?.answers.motivo).toBe("Rodilla");

    await setFocus(db, pid, ALL);
    expect(await listSessions(db, pid)).toHaveLength(2);
    // Viendo todos, lo nuevo va al último motivo abierto.
    expect(await currentEpisode(db, pid)).toBe(hombro);
    expect(await episodeCounts(db, pid)).toEqual({ [pid]: 2, [hombro]: 1 });
  });

  it("nombre, cierre y borrado", async () => {
    await updateEpisode(db, pid, pid, { title: "Esguince de tobillo", closedAt: "2026-03-01T00:00:00.000Z" });
    const otro = await createEpisode(db, pid, { title: "Lumbalgia", startedAt: "2026-05-01T00:00:00.000Z", answers: {} });
    await saveSession(db, pid, session("2026-05-02T10:00:00.000Z"));
    const eps = await listEpisodes(db, pid);
    expect(eps.map((e) => [e.title, e.first, !!e.closedAt])).toEqual([
      ["Esguince de tobillo", true, true],
      ["Lumbalgia", false, false],
    ]);
    await expect(deleteEpisode(db, pid, pid)).rejects.toThrow(RangeError);
    await deleteEpisode(db, pid, otro);
    expect(await listEpisodes(db, pid)).toHaveLength(1);
    expect(await getFocus(db, pid)).toBe(ALL);
    expect(await listSessions(db, pid)).toHaveLength(0);
  });

  it("los motivos y a cuál pertenece cada registro llegan al otro dispositivo; lo que se ve, no", async () => {
    const hombro = await createEpisode(db, pid, { title: "Hombro", startedAt: "2026-06-01T09:00:00.000Z", answers: { motivo: "Hombro" } });
    await saveSession(db, pid, session("2026-06-01T10:00:00.000Z", "hombro"));
    const other = await createTestDb();
    await other.merge((await db.snapshot()).bytes);
    expect((await listEpisodes(other, pid)).map((e) => e.title)).toEqual(["", "Hombro"]);
    expect(await getFocus(other, pid)).toBe(ALL);
    await setFocus(other, pid, hombro);
    expect((await listSessions(other, pid)).map((s) => s.subjective)).toEqual(["hombro"]);
    expect((await getAnamnesis(other, pid))?.answers).toEqual({ motivo: "Hombro" });
  });
});
