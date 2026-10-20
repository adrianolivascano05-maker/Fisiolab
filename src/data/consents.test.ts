import { beforeEach, describe, expect, it } from "vitest";
import { buildSections, templateById } from "../consent/templates";
import { consentContext } from "../consent/context";
import type { ConsentDocument } from "../consent/types";
import { getConsent, listConsents, revokeConsent, saveSignedConsent } from "./consents";
import type { Db } from "./db";
import { createEpisode, setFocus } from "./episodes";
import { createPatient, getPatient } from "./repo";
import { createTestDb } from "./testDb";

let db: Db;
let pid: string;
beforeEach(async () => {
  db = await createTestDb();
  pid = await createPatient(db, { name: "Ana", birthDate: "1990-05-01", sex: "female", bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
});

async function doc(): Promise<ConsentDocument> {
  const t = templateById("invasiva")!;
  const patient = (await getPatient(db, pid))!;
  const ctx = consentContext(patient, { precauciones: ["Toma anticoagulantes o antiagregantes"], regiones: ["cervical"] }, []);
  return {
    templateId: t.id,
    version: t.version,
    title: t.title,
    clinic: { name: "Clínica", taxId: "B1", address: "Calle 1" },
    professional: { name: "Adrián", license: "123" },
    patient: { name: patient.name, birthDate: patient.birthDate, idDoc: "" },
    representative: null,
    techniques: ["Punción seca"],
    sections: buildSections(t, ctx, ["puncion_seca"]),
    date: "2026-10-20",
    place: "Madrid",
  };
}

describe("consentimientos firmados", () => {
  it("en la pantalla hacen falta las dos firmas; en papel, no", async () => {
    const d = await doc();
    await expect(saveSignedConsent(db, pid, d, "screen", { patient: "data:image/png;base64,AA" })).rejects.toThrow(RangeError);
    const id = await saveSignedConsent(db, pid, d, "screen", { patient: "data:image/png;base64,AA", professional: "data:image/png;base64,BB" });
    const paper = await saveSignedConsent(db, pid, d, "paper", { patient: "ignorada" });
    const c = (await getConsent(db, id))!;
    expect(c.document.sections.some((s) => s.title === "Riesgos por sus circunstancias")).toBe(true);
    expect(c.signatures.professional).toBe("data:image/png;base64,BB");
    expect((await getConsent(db, paper))!.signatures).toEqual({});
    expect((await listConsents(db, pid)).map((x) => x.method).sort()).toEqual(["paper", "screen"]);
  });

  it("se retira una vez, con fecha, sin borrar el documento", async () => {
    const id = await saveSignedConsent(db, pid, await doc(), "paper", {});
    await revokeConsent(db, id, "Ya no quiere", "data:image/png;base64,CC");
    const c = (await getConsent(db, id))!;
    expect(c.revokedAt).not.toBeNull();
    expect(c.revokeNote).toBe("Ya no quiere");
    expect(c.signatures.revocation).toBe("data:image/png;base64,CC");
    await expect(revokeConsent(db, id, "", undefined)).rejects.toThrow("Ya estaba retirado.");
  });

  it("van al motivo de consulta que se ve", async () => {
    await saveSignedConsent(db, pid, await doc(), "paper", {});
    await createEpisode(db, pid, { title: "Hombro", startedAt: "2026-06-01T00:00:00.000Z", answers: {} });
    expect(await listConsents(db, pid)).toHaveLength(0);
    await saveSignedConsent(db, pid, await doc(), "paper", {});
    expect(await listConsents(db, pid)).toHaveLength(1);
    await setFocus(db, pid, pid);
    expect(await listConsents(db, pid)).toHaveLength(1);
    await setFocus(db, pid, "all");
    expect(await listConsents(db, pid)).toHaveLength(2);
  });
});
