import { beforeEach, describe, expect, it } from "vitest";
import { saveSession } from "./clinical";
import type { Db } from "./db";
import { ageOn, clinicalRecord, getClinic, keepUntil, MIN_RETENTION_YEARS, saveClinic, savePatientPrivacy } from "./privacy";
import { createPatient, getPatient } from "./repo";
import { createTestDb } from "./testDb";

let db: Db;
let pid: string;
beforeEach(async () => {
  db = await createTestDb();
  pid = await createPatient(db, { name: "Ana", birthDate: "2012-05-20", sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
});

describe("protección de datos", () => {
  it("guarda la información entregada y los consentimientos del paciente", async () => {
    expect((await getPatient(db, pid))!.privacy).toEqual({});
    await savePatientPrivacy(db, pid, { informedAt: "2026-10-19", signedBy: "  Luis Pérez ", consents: { images: true, contact: false } });
    const p = (await getPatient(db, pid))!.privacy;
    expect(p).toMatchObject({ informedAt: "2026-10-19", signedBy: "Luis Pérez", consents: { images: true, contact: false } });
    expect(p.updatedAt).toBeTruthy();
  });

  it("datos de la clínica: por defecto vacíos y 5 años; nunca menos de 5", async () => {
    expect(await getClinic(db)).toMatchObject({ name: "", retentionYears: MIN_RETENTION_YEARS, googleDpa: false });
    await saveClinic(db, { ...(await getClinic(db)), name: " Fisiolab ", email: "datos@fisiolab.test", retentionYears: 2 });
    expect(await getClinic(db)).toMatchObject({ name: "Fisiolab", retentionYears: 5 });
  });

  it("conservación: cuenta desde el último registro clínico", async () => {
    expect(await clinicalRecord(db, pid)).toEqual({ records: 0, last: null });
    const base = { pain: null, subjective: "", objective: "", treatment: "x", plan: "", reviewOn: null, nextAt: null, nextMinutes: null };
    await saveSession(db, pid, { ...base, performedAt: "2026-01-10T10:00:00.000Z" });
    await saveSession(db, pid, { ...base, performedAt: "2026-03-02T10:00:00.000Z" });
    const r = await clinicalRecord(db, pid);
    expect(r).toEqual({ records: 2, last: "2026-03-02T10:00:00.000Z" });
    expect(keepUntil(r.last!, 5).toISOString()).toBe("2031-03-02T10:00:00.000Z");
  });

  it("edad para saber si firma el representante legal", () => {
    expect(ageOn("2012-05-20", new Date(2026, 4, 19))).toBe(13);
    expect(ageOn("2012-05-20", new Date(2026, 4, 20))).toBe(14);
    expect(ageOn(null)).toBeNull();
  });
});
