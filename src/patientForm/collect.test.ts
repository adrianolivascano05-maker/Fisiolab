import { describe, expect, it } from "vitest";
import { ANAMNESIS, withCustom } from "../clinical/anamnesis";
import { ANAMNESIS_KIND, CALENDAR_KIND, CONSENT_PREFIX, DOCS_KIND, formLink, PRIVACY_KIND, formMessage, mergeAnamnesis, newFormId, newFormKey, patientSections, seal, unseal } from "../clinical/patientForms";
import { ServerError } from "../cloud/remote";
import { listDocuments } from "../data/documents";
import { getAnamnesis, listQuestionnaires, saveAnamnesis } from "../data/clinical";
import { addSentForm, cancelSentForm, formStatus, getSentForm, markImported } from "../data/patientForms";
import { createPatient, getPatient } from "../data/repo";
import { listConsents } from "../data/consents";
import { signPrivacySheet } from "../data/privacy";
import { createTestDb } from "../data/testDb";
import { cancelSignLinks, collectAnswered, type FormsApi } from "./collect";
import { readSources } from "../clinical/answerMeta";
import { NO_ANSWER } from "../clinical/anamnesis";
import { uploadPatientForm } from "./createForm";
import { addModule, currentTemplate, emptyDelta, getTemplateDoc, markTemplateUsed, saveTemplateDoc } from "../data/anamnesisTemplates";
import { saveModuleDoc, type ModuleDoc } from "../data/anamnesisModules";
import { addLibraryForm, archiveOwnForm, newOwnFormId, saveOwnForm } from "../data/ownForms";
import { listPatientEvents } from "../data/patientEvents";
import { FROM_PATIENT } from "./calendarForm";

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
    // Las 15 de siempre (docs/anamnesis-adaptable.md, decisión 8) y la propia de la clínica.
    expect(sections.map((s) => s.title)).toEqual(["Motivo de consulta", "Antecedentes médicos personales", "Tratamientos previos y expectativas", "Hábitos y estilo de vida"]);
    expect(sections.flatMap((s) => s.fields)).toHaveLength(16);
    const ids = sections.flatMap((s) => s.fields.map((f) => f.id));
    for (const no of ["regiones", "lado", "banderas_rojas", "precauciones", "ritmo", "diagnostico_funcional", "fecha_valoracion"]) expect(ids).not.toContain(no);
    expect(ids).toContain("c_horas");
    expect(sections[0]!.fields[0]).toMatchObject({ id: "motivo", label: "¿Por qué vienes? Cuéntanos qué te pasa" });
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

  it("lo que se le preguntó no se pierde aunque la clínica cambie después la plantilla", () => {
    // Un enlace de antes (32 preguntas) con «profesion», que ahora es solo del fisio: se acepta porque se le preguntó.
    const m = mergeAnamnesis({}, { profesion: "Carpintera", regiones: ["lumbar"], c_x: "Otro: natación" }, ANAMNESIS, ["profesion", "c_x"], [
      { id: "c_x", label: "Deporte", type: "choice", options: ["Correr", "Nadar"], who: "both" },
    ]);
    expect(m.merged).toEqual({ profesion: "Carpintera", c_x: "Otro: natación" });
    // Lo que no se le mandó, no.
    expect(m.clean).not.toHaveProperty("regiones");
  });

  it("delicadas: «Prefiero no responder»; Sí/No con detalle", () => {
    const sections = [{ id: "habitos", title: "Hábitos", fields: [
      { id: "toxicos", label: "Tabaco", type: "text" as const, sensitive: true, who: "both" as const },
      { id: "c_op", label: "¿Le operaron?", type: "yesno_detail" as const, who: "both" as const },
      { id: "c_ch", label: "Elige", type: "choice" as const, options: ["A", "B"], who: "both" as const, sensitive: true },
    ] }];
    const m = mergeAnamnesis({}, { toxicos: NO_ANSWER, c_op: "Sí: rodilla", c_ch: NO_ANSWER }, sections);
    expect(m.merged).toEqual({ toxicos: NO_ANSWER, c_op: "Sí: rodilla", c_ch: NO_ANSWER });
    expect(mergeAnamnesis({}, { c_op: "Quizá" }, sections).merged).toEqual({});
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
    const saved = (await getAnamnesis(db, pid))!.answers;
    expect(saved).toMatchObject({ motivo: "Lo escribió el fisio", alergias: "Ninguna" });
    // Quién contestó lo que se ha puesto: el paciente, con ese enlace y a esa hora; lo del fisio no se toca.
    expect(readSources(saved)).toEqual({ alergias: { by: "patient", at, form: a.id } });
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

  it("contestado antes de que el cuestionario saliera de la app: sin nota, pero sus respuestas no se pierden", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Olga Antigua"));
    const exp = new Date(Date.now() + 86_400_000).toISOString();
    const f = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: f.id, patientId: pid, episodeId: pid, kind: "odi", key: f.key, expiresAt: exp });
    const { api } = server([{ id: f.id, response: await seal({ v: 1, answers: { s1: 2, s2: 1, s3: null, x: "texto" } }, f.key), answeredAt: exp }]);
    expect(await collectAnswered(db, api, ANAMNESIS)).toEqual([{ patientId: pid, name: "Olga Antigua", kind: "odi", skipped: 0, incomplete: true }]);
    expect(await listQuestionnaires(db, pid)).toEqual([]);
    expect((await getSentForm(db, f.id))!.answers).toEqual({ s1: 2, s2: 1, s3: null });
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

  it("de la anamnesis solo entran las preguntas que se le mandaron (meta.fields)", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Solo Algunas"));
    const f = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: f.id, patientId: pid, episodeId: pid, kind: ANAMNESIS_KIND, key: f.key, expiresAt: new Date(Date.now() + 86_400_000).toISOString(), meta: { fields: ["alergias"] } });
    const response = await seal({ v: 1, answers: { motivo: "Me duele", alergias: "Polen" } }, f.key);
    const { api } = server([{ id: f.id, response, answeredAt: new Date().toISOString() }]);
    await collectAnswered(db, api, ANAMNESIS);
    const saved = (await getAnamnesis(db, pid))!.answers;
    expect(saved).toMatchObject({ alergias: "Polen" });
    expect(saved).not.toHaveProperty("motivo");
  });

  it("paciente nuevo: el acuse y la petición de contacto se apuntan con el texto del envío, sin dar el permiso", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Nueva Paciente"));
    const intake = { version: "2026-10-31", contactText: "Quiero que me escribáis por WhatsApp o correo." };
    const f = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: f.id, patientId: pid, episodeId: pid, kind: ANAMNESIS_KIND, key: f.key, expiresAt: new Date(Date.now() + 86_400_000).toISOString(), meta: { intake } });
    // Un envío sin la información: lo que diga __intake no cuenta.
    const g = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: g.id, patientId: pid, episodeId: pid, kind: ANAMNESIS_KIND, key: g.key, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
    const at = "2026-10-31T09:00:00.000Z";
    const { api } = server([
      { id: f.id, response: await seal({ v: 1, answers: { alergias: "Polen", __intake: { ack: true, contact: true, text: "otro texto" } } }, f.key), answeredAt: at },
      { id: g.id, response: await seal({ v: 1, answers: { __intake: { ack: true, contact: true } } }, g.key), answeredAt: at },
    ]);
    await collectAnswered(db, api, ANAMNESIS);
    const p = (await getPatient(db, pid))!.privacy;
    expect(p.intakeAcks).toEqual([{ at, formId: f.id, version: "2026-10-31" }]);
    expect(p.contactRequests).toEqual([{ at, formId: f.id, text: intake.contactText, version: "2026-10-31" }]);
    expect(p.consents?.contact).toBeUndefined();
    expect((await getSentForm(db, f.id))!.answers).toMatchObject({ alergias: "Polen", __intake: { ack: true, contact: true } });
    expect((await getSentForm(db, g.id))!.answers).not.toHaveProperty("__intake");
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

  it("«Tu calendario»: lo que apunta llega a su calendario, con la marca de que lo apuntó él; lo que no vale, fuera; sin repetirse", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Nora Enlace"));
    const id = newFormId();
    const key = newFormKey();
    await addSentForm(db, { id, patientId: pid, episodeId: pid, kind: CALENDAR_KIND, key, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
    const at = new Date().toISOString();
    const events = [
      { kind: "training", title: "Pádel", startsOn: "2026-11-17", repeatDays: [2, 4], time: "19:00", minutes: 90 },
      { kind: "travel", startsOn: "2026-12-20", endsOn: "2027-01-06", notes: "Al pueblo" },
      { kind: "surgery", startsOn: "no es un día" },
    ];
    const { api, removed } = server([{ id, response: await seal({ v: 1, answers: { events } }, key), answeredAt: at }]);
    const got = await collectAnswered(db, api, ANAMNESIS);
    expect(got).toEqual([{ patientId: pid, name: "Nora Enlace", kind: CALENDAR_KIND, skipped: 0, incomplete: true, events: 2 }]);
    expect(removed).toEqual([id]);
    const saved = await listPatientEvents(db, pid);
    expect(saved.map((e) => [e.id, e.kind, e.title, e.notes])).toEqual([
      [`${id}.0`, "training", "Pádel", FROM_PATIENT],
      [`${id}.1`, "travel", "", `Al pueblo\n${FROM_PATIENT}`],
    ]);
    expect((await getSentForm(db, id))?.answers).toEqual({ events: 2, dropped: 1 });
    // El mensaje para pedírselo.
    expect(formMessage({ name: "Nora", clinic: "Fisiolab", kind: CALENDAR_KIND, url: "https://x/formulario/a#b", expiresAt: at })).toMatch(
      /^Hola Nora: desde Fisiolab te pedimos que rellenes tu calendario \(entrenamientos, partidos, una operación, una prueba médica o un viaje\)/,
    );
  });

  it("una firma que llega por un enlace (la hoja o un consentimiento) ya no se guarda: el envío queda anulado y se avisa", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Nora Enlace"));
    const exp = new Date(Date.now() + 86_400_000).toISOString();
    const sheet = { id: newFormId(), key: newFormKey() };
    const consent = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: sheet.id, patientId: pid, episodeId: pid, kind: PRIVACY_KIND, key: sheet.key, expiresAt: exp });
    await addSentForm(db, { id: consent.id, patientId: pid, episodeId: pid, kind: `${CONSENT_PREFIX}puncion`, key: consent.key, expiresAt: exp });
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const at = "2026-10-29T10:00:00.000Z";
    const { api, removed } = server([
      { id: sheet.id, response: await seal({ v: 1, answers: { privacy: { version: "2026-10-27", patientName: "Nora Enlace", sections: [], consents: [] }, consents: { contact: true }, signature: png } }, sheet.key), answeredAt: at },
      { id: consent.id, response: await seal({ v: 1, answers: { consent: { document: { templateId: "puncion" }, professionalSignature: png }, signature: png } }, consent.key), answeredAt: at },
    ]);
    const got = await collectAnswered(db, api, ANAMNESIS);
    expect(got).toEqual([
      { patientId: pid, name: "Nora Enlace", kind: PRIVACY_KIND, skipped: 0, incomplete: false, refused: true },
      { patientId: pid, name: "Nora Enlace", kind: `${CONSENT_PREFIX}puncion`, skipped: 0, incomplete: false, refused: true },
    ]);
    expect(removed.sort()).toEqual([sheet.id, consent.id].sort());
    const privacy = (await getPatient(db, pid))!.privacy;
    expect(privacy.consents?.contact).toBeUndefined();
    expect(privacy.sheets ?? []).toHaveLength(0);
    expect(await listConsents(db, pid)).toHaveLength(0);
    expect(formStatus((await getSentForm(db, sheet.id))!)).toBe("cancelled");
    expect(formStatus((await getSentForm(db, consent.id))!)).toBe("cancelled");
  });

  it("cancelSignLinks anula solo los enlaces de firma pendientes y sigue aunque el servidor falle", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Luis Enlace"));
    const exp = new Date(Date.now() + 86_400_000).toISOString();
    const ids = { sheet: newFormId(), consent: newFormId(), anamnesis: newFormId(), imported: newFormId() };
    await addSentForm(db, { id: ids.sheet, patientId: pid, episodeId: pid, kind: PRIVACY_KIND, key: newFormKey(), expiresAt: exp });
    await addSentForm(db, { id: ids.consent, patientId: pid, episodeId: pid, kind: `${CONSENT_PREFIX}manual`, key: newFormKey(), expiresAt: exp });
    await addSentForm(db, { id: ids.anamnesis, patientId: pid, episodeId: pid, kind: ANAMNESIS_KIND, key: newFormKey(), expiresAt: exp });
    await addSentForm(db, { id: ids.imported, patientId: pid, episodeId: pid, kind: PRIVACY_KIND, key: newFormKey(), expiresAt: exp });
    await markImported(db, ids.imported, { answeredAt: exp, answers: {}, skipped: [] });
    const tried: string[] = [];
    const n = await cancelSignLinks(db, async (id) => {
      tried.push(id);
      if (id === ids.consent) throw new Error("sin red");
    });
    expect(n).toBe(2);
    expect(tried.sort()).toEqual([ids.sheet, ids.consent].sort());
    expect(formStatus((await getSentForm(db, ids.sheet))!)).toBe("cancelled");
    expect(formStatus((await getSentForm(db, ids.consent))!)).toBe("cancelled");
    expect(formStatus((await getSentForm(db, ids.anamnesis))!)).toBe("pending");
    expect(formStatus((await getSentForm(db, ids.imported))!)).toBe("done");
    // Otra vez: ya no queda nada que anular.
    expect(await cancelSignLinks(db, async () => {})).toBe(0);
  });

  it("una hoja firmada por enlace antes del cambio sigue igual después de recoger otras respuestas", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Ana Antes"));
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const sheet = {
      version: "2026-10-27",
      date: "2026-10-29",
      at: "2026-10-29T10:00:00.000Z",
      method: "link" as const,
      patientName: "Ana Antes",
      sections: [{ title: "Para qué", paragraphs: ["Para atenderle como fisioterapeuta."] }],
      consents: [{ id: "contact" as const, text: "WhatsApp, SMS o correo.", answer: true }],
      signature: png,
    };
    await signPrivacySheet(db, pid, { consents: { contact: true } }, sheet);
    const exp = new Date(Date.now() + 86_400_000).toISOString();
    const f = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: f.id, patientId: pid, episodeId: pid, kind: ANAMNESIS_KIND, key: f.key, expiresAt: exp });
    const { api } = server([{ id: f.id, response: await seal({ v: 1, answers: { motivo: "Dolor de hombro" } }, f.key), answeredAt: exp }]);
    await collectAnswered(db, api, ANAMNESIS);
    const privacy = (await getPatient(db, pid))!.privacy;
    expect(privacy.sheets).toEqual([sheet]);
    expect(privacy.consents?.contact).toBe(true);
    expect((await getAnamnesis(db, pid))?.answers.motivo).toBe("Dolor de hombro");
  });

  it("enlace v2: se recoge con la plantilla con la que se mandó aunque la clínica la cambie; quién contesta en un menor", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Leo Menor"));
    const d = await getTemplateDoc(db);
    const own = { id: "c_dddddddd", section: "motivo", type: "choice" as const, label: "¿Hace deporte?", who: "both" as const, options: ["Sí", "No"] };
    await saveTemplateDoc(db, { ...d, delta: { ...d.delta, added: [own] } }, null);
    const sentTpl = await currentTemplate(db);
    const ref = await markTemplateUsed(db, sentTpl);
    const f = { id: newFormId(), key: newFormKey() };
    const fields = patientSections(sentTpl.sections).flatMap((x) => x.fields.map((y) => y.id));
    expect(fields).toContain("c_dddddddd");
    await addSentForm(db, { id: f.id, patientId: pid, episodeId: pid, kind: ANAMNESIS_KIND, key: f.key, expiresAt: new Date(Date.now() + 86_400_000).toISOString(), meta: { fields, tpl: ref, minor: true } });
    // Después, la clínica retira la pregunta y le quita la opción «No»: el enlace ya enviado no cambia.
    await saveTemplateDoc(db, { ...d, delta: { ...d.delta, added: [{ ...own, options: ["Sí", "A veces"], removed: true }] } }, null);
    const at = "2026-11-04T10:00:00.000Z";
    const response = await seal({ v: 1, answers: { motivo: "Me duele", c_dddddddd: "No", __respondent: "guardian", __tpl: "general@000000000000" } }, f.key);
    const { api } = server([{ id: f.id, response, answeredAt: at }]);
    await collectAnswered(db, api, await currentTemplate(db));
    const saved = (await getAnamnesis(db, pid))!.answers;
    expect(saved).toMatchObject({ motivo: "Me duele", c_dddddddd: "No", __tpl: ref, __respondent: "guardian" });
    expect(readSources(saved).c_dddddddd).toEqual({ by: "patient", at, form: f.id });
    expect((await getSentForm(db, f.id))!.answers).toMatchObject({ c_dddddddd: "No", __respondent: "guardian" });
  });

  it("fase 2: con un módulo; lo de una condicional que no se cumple no se guarda; tipos nuevos; obligatorias nunca al recoger; quién contesta", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Gema Guardián"));
    const mod: ModuleDoc = {
      v: 1,
      id: "md_0000000f",
      name: "Infancia",
      guardian: true,
      fields: {},
      added: [
        { id: "c_4000000a", section: "self", type: "yesno", label: "¿Va a la guardería?", who: "both" },
        { id: "c_4000000b", section: "self", type: "text", label: "¿Cuántas horas?", who: "both", showIf: { field: "c_4000000a", op: "eq", value: "Sí" }, required: true },
        { id: "c_4000000c", section: "self", type: "date", label: "Última revisión", who: "both" },
        { id: "c_4000000d", section: "self", type: "zones", label: "¿Dónde le duele?", who: "both" },
      ],
    };
    await saveModuleDoc(db, mod, null);
    const t = await saveTemplateDoc(db, addModule({ v: 1, id: "t_0000000f", name: "Pediatría", base: 1, delta: emptyDelta() }, mod.id, [mod]), null);
    const sentTpl = await currentTemplate(db, t.id);
    expect(sentTpl.guardian).toBe(true);
    const ref = await markTemplateUsed(db, sentTpl);
    const fields = patientSections(sentTpl.sections).flatMap((x) => x.fields.map((y) => y.id));
    expect(fields).toEqual(expect.arrayContaining(["c_4000000a", "c_4000000b", "c_4000000c", "c_4000000d"]));
    const f = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: f.id, patientId: pid, episodeId: pid, kind: ANAMNESIS_KIND, key: f.key, expiresAt: new Date(Date.now() + 86_400_000).toISOString(), meta: { fields, tpl: ref, guardian: true } });
    // Contesta «No» y aun así llegan las horas (no se le enseñaban): no se guardan. La obligatoria sin contestar no
    // impide recogerlo. Una fecha y unas zonas que no valen, fuera.
    const response = await seal(
      { v: 1, answers: { c_4000000a: "No", c_4000000b: "8 horas", c_4000000c: "2026-02-30x", c_4000000d: ["rodilla:derecho", "rodilla:izquierdo", "codo", "pie"], __respondent: "guardian" } },
      f.key,
    );
    const { api } = server([{ id: f.id, response, answeredAt: "2026-11-09T10:00:00.000Z" }]);
    await collectAnswered(db, api, await currentTemplate(db));
    const saved = (await getAnamnesis(db, pid))!.answers;
    expect(saved).toMatchObject({ c_4000000a: "No", c_4000000d: ["rodilla:derecho", "codo"], __respondent: "guardian", __tpl: ref });
    expect(saved).not.toHaveProperty("c_4000000b");
    expect(saved).not.toHaveProperty("c_4000000c");
  });

  it("cuestionario propio: se recoge y puntúa con la versión enviada aunque la clínica lo cambie después", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Paula Propia"));
    const own = {
      v: 1 as const,
      id: newOwnFormId(),
      name: "Adherencia",
      note: "Comentar en consulta.",
      sections: [{ items: [{ id: "q_00000001", type: "options" as const, text: "¿Hizo los ejercicios?", options: [{ label: "Nunca", points: 0 }, { label: "Siempre", points: 3 }] }] }],
      scoring: { method: "sum" as const, better: "higher" as const, na: "block" as const },
    };
    const v1 = await saveOwnForm(db, own, null, { clinic: "Clínica Aurora" });
    const f = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: f.id, patientId: pid, episodeId: pid, kind: own.id, key: f.key, expiresAt: new Date(Date.now() + 86_400_000).toISOString(), meta: { hash: v1.spec.hash } });
    // Después la clínica cambia los puntos («Siempre» pasa a valer 10) y archiva el cuestionario.
    await saveOwnForm(db, { ...own, sections: [{ items: [{ ...own.sections[0]!.items[0]!, options: [{ label: "Nunca", points: 0 }, { label: "Siempre", points: 10 }] }] }] }, null);
    await archiveOwnForm(db, own.id, true, null);
    const at = "2026-11-05T10:00:00.000Z";
    const { api } = server([{ id: f.id, response: await seal({ v: 1, answers: { q_00000001: 1, otro: 5 } }, f.key), answeredAt: at }]);
    const got = await collectAnswered(db, api, ANAMNESIS);
    expect(got).toEqual([{ patientId: pid, name: "Paula Propia", kind: own.id, skipped: 0, incomplete: false }]);
    const [q] = await listQuestionnaires(db, pid);
    expect(q).toMatchObject({ kind: own.id, score: 3, performedAt: at });
    expect(q!.details).toMatchObject({ answers: { q_00000001: 1 }, own: { id: own.id, hash: v1.spec.hash, name: "Adherencia", min: 0, max: 3, note: "Comentar en consulta.", noteClinic: "Clínica Aurora" } });
    expect(q!.details).not.toHaveProperty("answers.otro");
  });

  it("biblioteca: «Control semanal» por enlace, sin nota; el «Sí» con lo que escribió y «Prefiero no responder»", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Vera Semanal"));
    const doc = await addLibraryForm(db, "lib_control_semanal", null, "Clínica Aurora");
    const f = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: f.id, patientId: pid, episodeId: pid, kind: doc.spec.id, key: f.key, expiresAt: new Date(Date.now() + 86_400_000).toISOString(), meta: { hash: doc.spec.hash } });
    const at = "2026-11-06T09:00:00.000Z";
    const answers = { q_00000001: 4, q_00000002: 7, q_00000003: 6, q_00000004: 8, q_00000005: null, q_00000006: 0 };
    const texts = { q_00000006: "  Un pinchazo nuevo\u0007 en la rodilla  ", q_00000001: "esto no tiene detalle", q_99999999: "ni existe" };
    const { api } = server([{ id: f.id, response: await seal({ v: 1, answers: { ...answers, __texts: texts } }, f.key), answeredAt: at }]);
    const got = await collectAnswered(db, api, ANAMNESIS);
    expect(got[0]).toMatchObject({ incomplete: false });
    const [q] = await listQuestionnaires(db, pid);
    expect(q!.details).toMatchObject({ answers, texts: { q_00000006: "Un pinchazo nuevo en la rodilla" }, own: { noScore: true } });
    expect((await getSentForm(db, f.id))!.answers).toMatchObject({ __texts: { q_00000006: "Un pinchazo nuevo en la rodilla" } });
  });

  it("biblioteca: «Adherencia» por enlace; la de varias se guarda junta y no suma; lo escrito sin «Sí» no se guarda", async () => {
    const db = await createTestDb();
    const pid = await createPatient(db, patient("Adrián Adherente"));
    const doc = await addLibraryForm(db, "lib_adherencia", null, "Clínica Aurora");
    const f = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: f.id, patientId: pid, episodeId: pid, kind: doc.spec.id, key: f.key, expiresAt: new Date(Date.now() + 86_400_000).toISOString(), meta: { hash: doc.spec.hash } });
    // q3 (varias): «Falta de tiempo» y «No me acordaba» (1 + 4); un 64 no existe con 6 opciones y se tira.
    const sent = { q_00000001: 3, q_00000002: 2, q_00000003: 5, q_00000004: 7, q_00000005: 1 };
    const { api } = server([{ id: f.id, response: await seal({ v: 1, answers: { ...sent, __texts: { q_00000003: "no" } } }, f.key), answeredAt: "2026-11-06T09:00:00.000Z" }]);
    await collectAnswered(db, api, ANAMNESIS);
    const [q] = await listQuestionnaires(db, pid);
    expect(q).toMatchObject({ score: 5 });
    expect(q!.details).toMatchObject({ answers: sent });
    expect(q!.details).not.toHaveProperty("texts");

    const g = { id: newFormId(), key: newFormKey() };
    await addSentForm(db, { id: g.id, patientId: pid, episodeId: pid, kind: doc.spec.id, key: g.key, expiresAt: new Date(Date.now() + 86_400_000).toISOString(), meta: { hash: doc.spec.hash } });
    const { api: api2 } = server([{ id: g.id, response: await seal({ v: 1, answers: { q_00000001: 0, q_00000002: 0, q_00000003: 64 } }, g.key), answeredAt: "2026-11-07T09:00:00.000Z" }]);
    await collectAnswered(db, api2, ANAMNESIS);
    const [last] = await listQuestionnaires(db, pid);
    expect(last!.details).toMatchObject({ answers: { q_00000001: 0, q_00000002: 0 } });
    expect(last!.details).not.toHaveProperty("answers.q_00000003");
  });

  it("ya no se crea un enlace para firmar", async () => {
    const db = await createTestDb();
    const base = { patientId: "p1", patientName: "Nora Enlace", clinicName: "Fisio Prueba", sections: [] };
    await expect(uploadPatientForm(db, null, { ...base, kind: PRIVACY_KIND })).rejects.toThrow("se firman en la clínica");
    await expect(uploadPatientForm(db, null, { ...base, kind: `${CONSENT_PREFIX}puncion` })).rejects.toThrow("se firman en la clínica");
  });
});
