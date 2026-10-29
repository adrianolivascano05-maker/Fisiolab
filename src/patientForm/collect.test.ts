import { describe, expect, it } from "vitest";
import { ANAMNESIS, withCustom } from "../clinical/anamnesis";
import { ANAMNESIS_KIND, CONSENT_PREFIX, DOCS_KIND, formLink, PRIVACY_KIND, formMessage, mergeAnamnesis, newFormId, newFormKey, patientSections, seal, unseal } from "../clinical/patientForms";
import { ServerError } from "../cloud/remote";
import { listDocuments } from "../data/documents";
import { getAnamnesis, listQuestionnaires, saveAnamnesis } from "../data/clinical";
import { addSentForm, cancelSentForm, formStatus, getSentForm } from "../data/patientForms";
import { createPatient, getPatient } from "../data/repo";
import { listConsents } from "../data/consents";
import { emptyClinic } from "../data/privacy";
import { privacyToSign } from "../privacy/toSign";
import { createTestDb } from "../data/testDb";
import { collectAnswered, type FormsApi } from "./collect";

const patient = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });

/** Un servidor de mentira con las respuestas ya contestadas; apunta lo que se borra. */
function server(answered: { id: string; response: string; answeredAt: string }[], onServer: string[] = []) {
  const removed: string[] = [];
  const kept: string[] = [];
  const api: FormsApi = {
    answered: async () => answered.filter((f) => !removed.includes(f.id)),
    remove: async (id) => {
      removed.push(id);
    },
    keepDoc: async (id) => {
      if (!onServer.includes(id)) throw new ServerError("Ese documento ya no está en el servidor.", 404);
      kept.push(id);
    },
  };
  return { api, removed, kept };
}

describe("formularios para el paciente", () => {
  it("cifra y descifra con la clave del enlace; con otra clave no se lee", async () => {
    const key = newFormKey();
    expect(newFormId()).toMatch(/^[A-Za-z0-9_-]{24}$/);
    const blob = await seal({ hola: "qué tal", n: 3 }, key);
    expect(blob).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(await unseal(blob, key)).toEqual({ hola: "qué tal", n: 3 });
    await expect(unseal(blob, newFormKey())).rejects.toThrow();
  });

  it("al paciente solo se le pregunta lo suyo, dicho para él, y las preguntas propias de la clínica", () => {
    const custom = withCustom([{ id: "c_horas", section: "habitos", label: "Horas sentado al día", type: "text" }]);
    const sections = patientSections(custom);
    expect(sections.map((s) => s.title)).toEqual(["Datos personales", "Motivo de consulta", "Antecedentes médicos personales", "Antecedentes médicos familiares", "Tratamientos previos y expectativas", "Hábitos y estilo de vida"]);
    const ids = sections.flatMap((s) => s.fields.map((f) => f.id));
    for (const no of ["regiones", "lado", "banderas_rojas", "precauciones", "ritmo", "diagnostico_funcional", "fecha_valoracion"]) expect(ids).not.toContain(no);
    expect(ids).toContain("c_horas");
    expect(sections[1]!.fields[0]).toMatchObject({ id: "motivo", label: "¿Por qué vienes? Cuéntanos qué te pasa" });
  });

  it("lo que contesta rellena lo vacío; lo que ya estaba escrito no se toca", () => {
    const current = { motivo: "Dolor lumbar (lo escribí yo)", alergias: "" };
    const { merged, filled, skipped } = mergeAnamnesis(
      current,
      { motivo: "Me duele la espalda", alergias: " Ninguna ", eva: 7, banderas_rojas: ["Fiebre o malestar general"], medicacion: 42 },
      ANAMNESIS,
    );
    expect(merged).toMatchObject({ motivo: "Dolor lumbar (lo escribí yo)", alergias: "Ninguna", eva: 7 });
    expect(merged).not.toHaveProperty("banderas_rojas");
    expect(merged).not.toHaveProperty("medicacion");
    expect(filled.sort()).toEqual(["alergias", "eva"]);
    expect(skipped).toEqual(["motivo"]);
  });

  it("recoge: rellena la anamnesis, guarda el cuestionario con su nota y lo borra del servidor", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Nora Enlace"));
    await saveAnamnesis(db, pid, { motivo: "Lo escribió el fisio" });
    const exp = new Date(Date.now() + 86_400_000).toISOString();
    const a = { id: newFormId(), key: newFormKey() };
    const q = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: a.id, patientId: pid, episodeId: pid, kind: ANAMNESIS_KIND, key: a.key, expiresAt: exp });
    await addSentForm(db, { id: q.id, patientId: pid, episodeId: pid, kind: "gad7", key: q.key, expiresAt: exp });
    // Respondidos hace una hora: lo de un compañero que lleva más de ORPHAN_DAYS días sin recoger se borra (abajo).
    const at = new Date(Date.now() - 3_600_000).toISOString();
    const { api, removed } = server([
      { id: a.id, response: await seal({ v: 1, answers: { motivo: "Me duele", alergias: "Ninguna" } }, a.key), answeredAt: at },
      { id: q.id, response: await seal({ v: 1, answers: { i1: 1, i2: 2, i3: 0, i4: 3, i5: 1, i6: 0, i7: 2, otro: 9 } }, q.key), answeredAt: at },
      // De un compañero cuyo envío aún no ha llegado aquí: se deja.
      { id: newFormId(), response: "QUJD", answeredAt: at },
    ]);
    const got = await collectAnswered(db, api, ANAMNESIS);
    expect(got).toEqual([
      { patientId: pid, name: "Nora Enlace", kind: ANAMNESIS_KIND, skipped: 1, incomplete: false },
      { patientId: pid, name: "Nora Enlace", kind: "gad7", skipped: 0, incomplete: false },
    ]);
    expect(removed.sort()).toEqual([a.id, q.id].sort());
    expect((await getAnamnesis(db, pid))!.answers).toEqual({ motivo: "Lo escribió el fisio", alergias: "Ninguna" });
    const [gad] = await listQuestionnaires(db, pid);
    expect(gad).toMatchObject({ kind: "gad7", score: 9, performedAt: at, notes: "Lo rellenó el paciente desde su móvil." });
    const sent = await getSentForm(db, a.id);
    expect(formStatus(sent!)).toBe("done");
    expect(sent!.skipped).toEqual(["motivo"]);
    expect(sent!.answers).toEqual({ motivo: "Me duele", alergias: "Ninguna" });
    // Otra vez no hace nada.
    expect(await collectAnswered(db, api, ANAMNESIS)).toEqual([]);
  });

  it("uno anulado no se pone en la ficha; uno incompleto no da nota", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Pau Anulado"));
    const exp = new Date(Date.now() + 86_400_000).toISOString();
    const c = { id: newFormId(), key: newFormKey() };
    const i = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: c.id, patientId: pid, episodeId: pid, kind: ANAMNESIS_KIND, key: c.key, expiresAt: exp });
    await addSentForm(db, { id: i.id, patientId: pid, episodeId: pid, kind: "gad7", key: i.key, expiresAt: exp });
    await cancelSentForm(db, c.id);
    const { api, removed } = server([
      { id: c.id, response: await seal({ v: 1, answers: { motivo: "x" } }, c.key), answeredAt: exp },
      { id: i.id, response: await seal({ v: 1, answers: { i1: 1 } }, i.key), answeredAt: exp },
    ]);
    expect(await collectAnswered(db, api, ANAMNESIS)).toEqual([{ patientId: pid, name: "Pau Anulado", kind: "gad7", skipped: 0, incomplete: true }]);
    expect(removed.sort()).toEqual([c.id, i.id].sort());
    expect(await getAnamnesis(db, pid)).toBeNull();
    expect(await listQuestionnaires(db, pid)).toEqual([]);
    expect(formStatus((await getSentForm(db, c.id))!)).toBe("cancelled");
  });

  it("el enlace va a la dirección de los formularios, con la clave después de «#»", () => {
    expect(formLink("abc", "k1", "https://cenitfisiolab.pages.dev/")).toBe("https://cenitfisiolab.pages.dev/formulario/abc#k1");
  });

  it("dos dispositivos que recogen lo mismo a la vez guardan el mismo registro; lo desconocido se tira a la semana", async () => {
    const a = await createTestDb();
    const pid = await createPatient(a, patient("Doble Recogida"));
    const f = { id: newFormId(), key: newFormKey() };
    await addSentForm(a, { id: f.id, patientId: pid, episodeId: pid, kind: "gad7", key: f.key, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
    const response = await seal({ v: 1, answers: { i1: 1, i2: 1, i3: 1, i4: 1, i5: 1, i6: 1, i7: 1 } }, f.key);
    const at = new Date().toISOString();
    // Los dos ven la respuesta antes de que el otro la borre.
    const both: FormsApi = { answered: async () => [{ id: f.id, response, answeredAt: at }], remove: async () => {}, keepDoc: async () => {} };
    await collectAnswered(a, both, ANAMNESIS);
    const first = (await listQuestionnaires(a, pid)).map((q) => q.id);
    await a.transaction([{ sql: "update patient_forms set imported_at = null where id = ?", bind: [f.id] }]);
    await collectAnswered(a, both, ANAMNESIS);
    expect((await listQuestionnaires(a, pid)).map((q) => q.id)).toEqual(first);
    // Unas respuestas de un envío que aquí no está: se dejan unos días y después se tiran.
    const { api, removed } = server([
      { id: "reciente-000000000000000", response: "QUJD", answeredAt: at },
      { id: "antigua-0000000000000000", response: "QUJD", answeredAt: new Date(Date.now() - 8 * 86_400_000).toISOString() },
    ]);
    await collectAnswered(a, api, ANAMNESIS);
    expect(removed).toEqual(["antigua-0000000000000000"]);
  });

  it("de la anamnesis se guarda solo lo que se le preguntó, limpio", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Datos Raros"));
    const f = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: f.id, patientId: pid, episodeId: pid, kind: ANAMNESIS_KIND, key: f.key, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
    const response = await seal({ v: 1, answers: { motivo: { toString: "x" }, alergias: "Polen", raro: "x".repeat(10) } }, f.key);
    const { api } = server([{ id: f.id, response, answeredAt: new Date().toISOString() }]);
    await collectAnswered(db, api, ANAMNESIS);
    expect((await getSentForm(db, f.id))!.answers).toEqual({ alergias: "Polen" });
  });

  it("el mensaje dice quién lo pide, qué es y hasta cuándo vale", () => {
    const text = formMessage({ name: "Nora", clinic: "Fisiolab", kind: "gad7", url: "https://x/formulario/abc#k", expiresAt: "2026-11-04T10:00:00Z" });
    expect(text).toContain("Hola Nora: desde Fisiolab te pedimos que rellenes el cuestionario «GAD-7 (ansiedad)»");
    expect(text).toContain("https://x/formulario/abc#k");
    expect(text).toContain("hasta el 4 de noviembre");
  });
  it("los archivos que envía el paciente: la clínica se los queda en el servidor y se apuntan en sus archivos", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Nora Enlace"));
    const id = newFormId();
    const key = newFormKey();
    await addSentForm(db, { id, patientId: pid, episodeId: pid, kind: DOCS_KIND, key, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
    const at = new Date().toISOString();
    const docs = [
      { n: 1, name: "Resonancia\nrodilla", size: 120_000 },
      { n: 1, name: "Repetido", size: 10 },
      { n: 2, name: "Analítica", size: 50_000 },
      { n: 3, name: "Ya no está", size: 10 },
      { n: 9, name: "Fuera del enlace", size: 10 },
    ];
    const { api, removed, kept } = server([{ id, response: await seal({ v: 1, answers: { docs } }, key), answeredAt: at }], [`${id}.1`, `${id}.2`]);
    const got = await collectAnswered(db, api, ANAMNESIS);
    expect(got).toEqual([{ patientId: pid, name: "Nora Enlace", kind: DOCS_KIND, skipped: 0, incomplete: false, files: 2 }]);
    expect(kept).toEqual([`${id}.1`, `${id}.2`]);
    expect(removed).toEqual([id]);
    const files = await listDocuments(db, pid);
    expect(files.map((f) => [f.id, f.name, f.source, f.key, f.uploadedAt]).sort()).toEqual([
      [`${id}.1`, "Resonancia rodilla", "patient", key, at],
      [`${id}.2`, "Analítica", "patient", key, at],
    ]);
    expect((await getSentForm(db, id))?.answers).toEqual({ docs: [{ n: 1, name: "Resonancia rodilla", size: 120_000 }, { n: 2, name: "Analítica", size: 50_000 }] });
    // El mensaje para pedírselos.
    expect(formMessage({ name: "Nora", clinic: "Fisiolab", kind: DOCS_KIND, url: "https://x/formulario/a#b", expiresAt: at })).toMatch(/^Hola Nora: desde Fisiolab te pedimos que nos envíes tus informes o pruebas \(en PDF o en foto\)/);
  });

  it("la hoja de protección de datos firmada en su móvil vuelve entera, con su versión, sus permisos y la firma", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Nora Enlace"));
    const exp = new Date(Date.now() + 86_400_000).toISOString();
    const p = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: p.id, patientId: pid, episodeId: pid, kind: PRIVACY_KIND, key: p.key, expiresAt: exp });
    const toSign = privacyToSign({ ...emptyClinic, name: "Fisio Prueba", email: "datos@prueba.test" }, "server", { name: "Nora Enlace", privacy: {} });
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const at = "2026-10-29T10:00:00.000Z";
    const { api, removed } = server([{ id: p.id, response: await seal({ v: 1, answers: { privacy: toSign, consents: { contact: true, images: false, research: false }, signature: png } }, p.key), answeredAt: at }]);
    const got = await collectAnswered(db, api, ANAMNESIS);
    expect(got).toEqual([expect.objectContaining({ kind: PRIVACY_KIND })]);
    expect(removed).toEqual([p.id]);
    const privacy = (await getPatient(db, pid))!.privacy;
    expect(privacy.consents).toEqual({ contact: true, images: false, research: false });
    expect(privacy.informedAt).toBe("2026-10-29");
    expect(privacy.sheets).toHaveLength(1);
    expect(privacy.sheets![0]).toMatchObject({ method: "link", version: toSign.version, signature: png, sections: toSign.sections, at });
    expect(privacy.sheets![0]!.consents.find((c) => c.id === "contact")).toMatchObject({ answer: true });
    // Recogido otra vez (dos dispositivos a la vez): la misma hoja, una sola.
    const again = server([{ id: p.id, response: await seal({ v: 1, answers: { privacy: toSign, consents: { contact: true }, signature: png } }, p.key), answeredAt: at }]);
    await collectAnswered(db, again.api, ANAMNESIS);
    expect((await getPatient(db, pid))!.privacy.sheets).toHaveLength(1);
  });

  it("un consentimiento firmado en su móvil se guarda con las dos firmas; sin firma no se guarda nada", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Luis Enlace"));
    const exp = new Date(Date.now() + 86_400_000).toISOString();
    const document = {
      templateId: "puncion",
      version: "1",
      title: "Punción seca",
      clinic: { name: "Fisio Prueba", taxId: "", address: "" },
      professional: { name: "Ana Fisio", license: "123" },
      patient: { name: "Luis Enlace", birthDate: null, idDoc: "" },
      representative: null,
      techniques: ["Punción seca"],
      sections: [{ title: "Qué es", items: ["Texto"] }],
      date: "2026-10-29",
      place: "Madrid",
    };
    const sig = "data:image/png;base64,iVBORw0KGgo=";
    const ok = { id: newFormId(), key: newFormKey() };
    const bad = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: ok.id, patientId: pid, episodeId: pid, kind: `${CONSENT_PREFIX}puncion`, key: ok.key, expiresAt: exp });
    await addSentForm(db, { id: bad.id, patientId: pid, episodeId: pid, kind: `${CONSENT_PREFIX}puncion`, key: bad.key, expiresAt: exp });
    const consent = { document, professionalSignature: sig };
    const { api, removed } = server([
      { id: ok.id, response: await seal({ v: 1, answers: { consent, signature: sig } }, ok.key), answeredAt: exp },
      { id: bad.id, response: await seal({ v: 1, answers: { consent } }, bad.key), answeredAt: exp },
    ]);
    const got = await collectAnswered(db, api, ANAMNESIS);
    expect(got.map((g) => g.kind)).toEqual([`${CONSENT_PREFIX}puncion`]);
    expect(removed.sort()).toEqual([ok.id, bad.id].sort());
    const list = await listConsents(db, pid);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ method: "screen", title: "Punción seca", signatures: { patient: sig, professional: sig, via: "link" } });
    expect(list[0]!.document).toEqual(document);
  });
});
