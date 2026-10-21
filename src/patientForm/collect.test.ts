import { describe, expect, it } from "vitest";
import { ANAMNESIS, withCustom } from "../clinical/anamnesis";
import { ANAMNESIS_KIND, formLink, formMessage, mergeAnamnesis, newFormId, newFormKey, patientSections, seal, unseal } from "../clinical/patientForms";
import { getAnamnesis, listQuestionnaires, saveAnamnesis } from "../data/clinical";
import { addSentForm, cancelSentForm, formStatus, getSentForm } from "../data/patientForms";
import { createPatient } from "../data/repo";
import { createTestDb } from "../data/testDb";
import { collectAnswered, type FormsApi } from "./collect";

const patient = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });

/** Un servidor de mentira con las respuestas ya contestadas; apunta lo que se borra. */
function server(answered: { id: string; response: string; answeredAt: string }[]) {
  const removed: string[] = [];
  const api: FormsApi = {
    answered: async () => answered.filter((f) => !removed.includes(f.id)),
    remove: async (id) => {
      removed.push(id);
    },
  };
  return { api, removed };
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
    expect(sections.map((s) => s.title)).toEqual(["Sobre ti", "Lo que te pasa", "Tu salud", "Tu familia", "Tu día a día"]);
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
    const at = "2026-10-21T09:00:00.000Z";
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

  it("el mensaje dice quién lo pide, qué es y hasta cuándo vale", () => {
    const text = formMessage({ name: "Nora", clinic: "Fisiolab", kind: "gad7", url: "https://x/formulario/abc#k", expiresAt: "2026-11-04T10:00:00Z" });
    expect(text).toContain("Hola Nora: desde Fisiolab te pedimos que rellenes el cuestionario «GAD-7 (ansiedad)»");
    expect(text).toContain("https://x/formulario/abc#k");
    expect(text).toContain("hasta el 4 de noviembre");
  });
});
