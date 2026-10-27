import { beforeEach, describe, expect, it } from "vitest";
import { saveSession } from "./clinical";
import type { Db } from "./db";
import { ageOn, changedSinceSigned, clinicalRecord, getClinic, keepUntil, MIN_RETENTION_YEARS, saveClinic, savePatientPrivacy, signPrivacySheet, type SignedPrivacySheet } from "./privacy";
import { privacySections } from "../privacy/privacyText";
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

  it("la hoja firmada en la pantalla se guarda tal cual; las anteriores se conservan; avisa si cambian sus permisos", async () => {
    const clinic = { ...(await getClinic(db)), name: "Fisiolab", email: "datos@fisiolab.test", retentionYears: 15 };
    const sheet = (date: string, images: boolean): SignedPrivacySheet => ({
      version: "2026-10-27",
      date,
      at: `${date}T09:00:00.000Z`,
      method: "screen",
      patientName: "Ana",
      signedBy: "Luis Pérez",
      sections: privacySections(clinic, "server"),
      consents: [
        { id: "images", text: "Fotos", answer: images },
        { id: "contact", text: "WhatsApp", answer: true },
        { id: "research", text: "Docencia", answer: null },
      ],
      signature: "data:image/png;base64,iVBORw0KGgo=",
    });
    const answers = { signedBy: "Luis Pérez", consents: { images: true, contact: true } };
    await expect(signPrivacySheet(db, pid, answers, { ...sheet("2026-10-20", true), signature: "" })).rejects.toThrow(/Falta la firma/);
    await signPrivacySheet(db, pid, answers, sheet("2026-10-20", true));
    let p = (await getPatient(db, pid))!.privacy;
    expect(p).toMatchObject({ informedAt: "2026-10-20", signedBy: "Luis Pérez", consents: { images: true, contact: true } });
    expect(p.sheets).toHaveLength(1);
    expect(p.sheets![0]!.sections.find((s) => s.title === "Cuánto tiempo")!.paragraphs[0]).toContain("al menos 15 años");
    expect(changedSinceSigned(p)).toBe(false);
    // Retira el permiso de fotos: la hoja firmada no cambia, pero avisa de que hay que firmar otra.
    await savePatientPrivacy(db, pid, { ...p, consents: { images: false, contact: true } });
    p = (await getPatient(db, pid))!.privacy;
    expect(p.sheets![0]!.consents[0]!.answer).toBe(true);
    expect(changedSinceSigned(p)).toBe(true);
    await signPrivacySheet(db, pid, p, sheet("2026-10-27", false));
    p = (await getPatient(db, pid))!.privacy;
    expect(p.sheets!.map((s) => s.date)).toEqual(["2026-10-20", "2026-10-27"]);
    expect(p.informedAt).toBe("2026-10-27");
    expect(changedSinceSigned(p)).toBe(false);
  });

  it("el texto de la hoja: lo que falta de la clínica, entre corchetes; dónde se guardan los datos según la copia", async () => {
    const empty = privacySections(await getClinic(db), "local");
    expect(empty[0]!.paragraphs[0]).toBe("[nombre de la clínica]. Contacto: [correo y teléfono].");
    expect(empty.find((s) => s.title === "Quién más los ve")!.paragraphs[0]).toContain("Se guardan en los dispositivos de la clínica.");
    const full = privacySections({ ...(await getClinic(db)), name: "Fisiolab", taxId: "B123", address: "C/ Mayor 1", email: "a@b.es", phone: "600", dpo: "dpo@b.es" }, "server");
    expect(full[0]!.paragraphs[0]).toBe("Fisiolab, NIF B123, C/ Mayor 1. Contacto: a@b.es · 600. Delegado de protección de datos: dpo@b.es.");
    expect(full.find((s) => s.title === "Quién más los ve")!.paragraphs[0]).toContain("servidor de Cloudflare");
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
