// «1ª visita» en Hoy (billing.ts, dayAccounts) y las alergias que no son alergias (PrecautionsNote.tsx).
import { beforeEach, describe, expect, it } from "vitest";
import { precautionsOf } from "../clinical/PrecautionsNote";
import { createAppointment } from "./appointments";
import { dayAccounts } from "./billing";
import { saveSession } from "./clinical";
import type { Db } from "./db";
import { createPatient } from "./repo";
import { createTestDb } from "./testDb";

let db: Db;
const patient = (name: string) =>
  createPatient(db, { name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const today = "2026-11-03";
const dayStartIso = "2026-11-02T23:00:00.000Z";

beforeEach(async () => {
  db = await createTestDb();
});

describe("Hoy: primera visita", () => {
  it("no es la primera si ya tuvo una sesión o una cita atendida o pendiente de antes; una anulada no cuenta", async () => {
    const nueva = await patient("Nueva");
    const conSesion = await patient("Con sesión");
    const importada = await patient("Importada");
    const anulada = await patient("Anulada");
    await saveSession(db, conSesion, { performedAt: "2026-10-20T10:00:00.000Z", pain: null, subjective: "", objective: "", treatment: "", plan: "", reviewOn: null, nextAt: null, nextMinutes: null });
    await createAppointment(db, importada, { startsAt: "2026-10-27T09:00:00.000Z", minutes: 45 });
    const a = await createAppointment(db, anulada, { startsAt: "2026-10-27T09:00:00.000Z", minutes: 45 });
    await db.transaction([{ sql: "update appointments set status = 'cancelled' where id = ?", bind: [a] }]);
    const out = await dayAccounts(db, [nueva, conSesion, importada, anulada], today, dayStartIso);
    expect(out.get(nueva)!.firstVisit).toBe(true);
    expect(out.get(conSesion)!.firstVisit).toBe(false);
    expect(out.get(importada)!.firstVisit).toBe(false);
    expect(out.get(anulada)!.firstVisit).toBe(true);
  });
});

describe("precauciones: alergias", () => {
  it("«ninguno», «ninguna conocida», «NAMC»… no salen como alergia; una alergia de verdad, sí", () => {
    for (const none of ["No", "Ninguno", "ninguna", "Ninguna conocida", "no conocidas", "NAMC", "nada", "-"]) expect(precautionsOf({ alergias: none }).allergies, none).toBe("");
    expect(precautionsOf({ alergias: "Penicilina" }).allergies).toBe("Penicilina");
    expect(precautionsOf({ alergias: "Ninguna a fármacos; látex" }).allergies).toBe("Ninguna a fármacos; látex");
  });
});
