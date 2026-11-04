// Plantillas de anamnesis de la clínica (docs/anamnesis-adaptable.md): tronco + cambios, instantáneas con huella,
// límites, fijas y compatibilidad con las preguntas propias de antes.
import { beforeEach, describe, expect, it } from "vitest";
import { ANAMNESIS, FIXED, orphanAnswers } from "../clinical/anamnesis";
import {
  changeCount,
  checkTemplate,
  currentTemplate,
  emptyDelta,
  getSnapshot,
  getTemplateDoc,
  GENERAL,
  resolveTemplate,
  saveTemplateDoc,
  toCustom,
  markTemplateUsed,
  withHash,
  type TemplateDoc,
} from "./anamnesisTemplates";
import { getCustomFields, saveCustomFields } from "./customFields";
import type { Db } from "./db";
import { getSetting, setSetting } from "./settings";
import { createTestDb } from "./testDb";
import { anamnesisRows, collect } from "../export/fullExport";
import { addOwn, addPack, duplicateField, editorView, knownField, moveField, patchField, resetAll, resetField, resetSection, retireOwn, setHidden } from "./anamnesisTemplates";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const doc = (delta: Partial<TemplateDoc["delta"]> = {}): TemplateDoc => ({ v: 1, id: GENERAL, name: "General", base: 1, delta: { ...emptyDelta(), ...delta } });
const field = (sections: { fields: { id: string }[] }[], id: string) => sections.flatMap((s) => s.fields).find((f) => f.id === id);

describe("resolver: tronco + cambios", () => {
  it("sin cambios es el tronco, con quién contesta por defecto (15 al paciente)", () => {
    const r = resolveTemplate(doc());
    expect(r.sections.map((s) => s.id)).toEqual(ANAMNESIS.map((s) => s.id));
    const toPatient = r.sections.flatMap((s) => s.fields).filter((f) => f.who !== "clinician").map((f) => f.id);
    expect(toPatient).toHaveLength(15);
    expect(toPatient).toContain("motivo");
    expect(toPatient).not.toContain("profesion");
    expect(field(r.sections, "motivo")).toMatchObject({ patientLabel: "¿Por qué vienes? Cuéntanos qué te pasa" });
  });

  it("ocultar, renombrar, ordenar y añadir; lo oculto sigue en «all» para leer lo respondido", () => {
    const r = resolveTemplate(
      doc({
        fields: { profesion: { hidden: true }, alergias: { label: "Alergias conocidas", who: "clinician" } },
        order: { antecedentes: ["alergias", "enfermedades"] },
        added: [{ id: "c_12345678", section: "antecedentes", type: "text", label: "Marcapasos", who: "both" }],
      }),
    );
    expect(field(r.sections, "profesion")).toBeUndefined();
    expect(r.all.find((f) => f.id === "profesion")?.label).toBe("Profesión");
    const ante = r.sections.find((s) => s.id === "antecedentes")!.fields.map((f) => f.id);
    expect(ante.slice(0, 2)).toEqual(["alergias", "enfermedades"]);
    expect(ante.at(-1)).toBe("c_12345678");
    expect(field(r.sections, "alergias")).toMatchObject({ label: "Alergias conocidas", who: "clinician" });
  });

  it("una pregunta propia retirada no se ve pero su respuesta se lee con su texto", () => {
    const r = resolveTemplate(doc({ added: [{ id: "c_aaaaaaaa", section: "motivo", type: "choice", label: "Escapes", who: "both", options: ["No", "Sí"], removed: true }] }));
    expect(field(r.sections, "c_aaaaaaaa")).toBeUndefined();
    expect(r.all.find((f) => f.id === "c_aaaaaaaa")?.label).toBe("Escapes");
    expect(orphanAnswers({ c_aaaaaaaa: "Sí", motivo: "x", __tpl: "general@abc" }, r.sections)).toEqual([["c_aaaaaaaa", "Sí"]]);
  });

  it("volver al original es borrar los cambios: la misma huella que el tronco", async () => {
    const a = await withHash(resolveTemplate(doc()));
    const b = await withHash(resolveTemplate(doc({ fields: { profesion: { label: "Trabajo" } } })));
    const c = await withHash(resolveTemplate(doc({ fields: {} })));
    expect(a.hash).toMatch(/^[0-9a-f]{12}$/);
    expect(b.hash).not.toBe(a.hash);
    expect(c.hash).toBe(a.hash);
  });
});

describe("comprobar al guardar", () => {
  it("límites, ids, opciones y claves desconocidas", () => {
    const own = (over: object) => doc({ added: [{ id: "c_11111111", section: "motivo", type: "choice", label: "P", who: "both", options: ["A", "B"], ...over }] });
    expect(() => checkTemplate(own({ options: ["A"] }))).toThrow(/dos opciones/);
    expect(() => checkTemplate(own({ options: ["A", "a"] }))).toThrow(/repetida/);
    expect(() => checkTemplate(own({ id: "__x" }))).toThrow(/identificador/);
    expect(() => checkTemplate(own({ id: "motivo" }))).toThrow(/repetido/);
    expect(() => checkTemplate(own({ label: "x".repeat(201) }))).toThrow(/200/);
    expect(() => checkTemplate(own({ type: "html" }))).toThrow(/tipo/);
    const many = doc({ added: Array.from({ length: 300 }, (_, i) => ({ id: `c_${String(i).padStart(8, "0")}`, section: "motivo", type: "text" as const, label: `P${i}`, who: "both" as const })) });
    expect(() => checkTemplate(many)).toThrow(/300 preguntas/);
    // Claves desconocidas fuera; patches de preguntas que no existen, fuera; la CIF no se manda al paciente.
    const clean = checkTemplate({ ...doc({ fields: { inventada: { label: "x" }, cif: { who: "patient" }, motivo: { label: " Motivo ", evil: 1 } as never } }), hack: 1 } as never);
    expect(clean.delta.fields).toEqual({ motivo: { label: "Motivo" } });
    expect("hack" in clean).toBe(false);
  });

  it("las delicadas no pueden ser obligatorias (fase 2) y el detalle tiene texto por defecto", () => {
    const clean = checkTemplate(doc({ added: [{ id: "c_22222222", section: "habitos", type: "yesno_detail", label: "¿Toma algo?", who: "both", sensitive: true, required: true }] }));
    expect(clean.delta.added[0]).toMatchObject({ detail: "¿Cuál?", sensitive: true });
    expect(clean.delta.added[0]!.required).toBeUndefined();
  });

  it("las fijas incluyen las que leen los consentimientos", () => {
    for (const id of ["cirugias", "observaciones", "objetivos_corto", "banderas_rojas", "precauciones", "regiones"]) expect(FIXED[id]).toBeTruthy();
  });
});

describe("guardar, instantáneas y compatibilidad", () => {
  it("sin puntero: tronco + preguntas propias de antes; el primer guardado las pasa a la plantilla y las sigue escribiendo para los móviles viejos", async () => {
    await saveCustomFields(db, [{ id: "c_old00001", section: "habitos", label: "Deporte", type: "text" }]);
    const t = await currentTemplate(db);
    expect(field(t.sections, "c_old00001")).toMatchObject({ label: "Deporte", who: "both" });
    const d = await getTemplateDoc(db);
    await saveTemplateDoc(db, { ...d, delta: { ...d.delta, added: [...d.delta.added, { id: "c_new00001", section: "motivo", type: "yesno_detail", label: "¿Le operaron?", who: "both" }] } }, "ana@x.es");
    expect((await getCustomFields(db)).map((c) => [c.id, c.type])).toEqual([
      ["c_old00001", "text"],
      ["c_new00001", "text"],
    ]);
    expect((await getTemplateDoc(db)).by).toBe("ana@x.es");
  });

  it("la instantánea se escribe al usarse, una vez por huella, y no cambia aunque cambie la plantilla", async () => {
    const t1 = await currentTemplate(db);
    expect(await getSnapshot(db, t1.ref)).toBeNull();
    const ref = await markTemplateUsed(db, t1);
    const snap = await getSnapshot(db, ref);
    expect(snap?.sections.map((s) => s.id)).toEqual(t1.sections.map((s) => s.id));
    const d = await getTemplateDoc(db);
    await saveTemplateDoc(db, { ...d, delta: { ...d.delta, fields: { motivo: { label: "Qué le pasa" } } } }, null);
    const t2 = await currentTemplate(db);
    expect(t2.hash).not.toBe(t1.hash);
    expect(field((await getSnapshot(db, ref))!.sections, "motivo")).toMatchObject({ label: "Motivo principal" });
    expect(await getSnapshot(db, "general@zzzz")).toBeNull();
    expect(await getSnapshot(db, { evil: 1 })).toBeNull();
  });

  it("dos móviles guardando a la vez: quedan sus dos instantáneas y gana el último puntero", async () => {
    const d = await getTemplateDoc(db);
    const a = { ...d, delta: { ...d.delta, fields: { profesion: { hidden: true } } } };
    const b = { ...d, delta: { ...d.delta, fields: { alergias: { label: "Alergias conocidas" } } } };
    const ra = await markTemplateUsed(db, await withHash(resolveTemplate(checkTemplate(a))));
    const rb = await markTemplateUsed(db, await withHash(resolveTemplate(checkTemplate(b))));
    await saveTemplateDoc(db, a, "ana@x.es");
    await saveTemplateDoc(db, b, "bruno@x.es");
    expect(await getSnapshot(db, ra)).not.toBeNull();
    expect(await getSnapshot(db, rb)).not.toBeNull();
    const now = await getTemplateDoc(db);
    expect(now.by).toBe("bruno@x.es");
    expect(now.delta.fields).toEqual({ alergias: { label: "Alergias conocidas" } });
  });

  it("cada clínica tiene su base y sus cambios: no se mezclan", async () => {
    const other = await createTestDb();
    const d = await getTemplateDoc(db);
    await saveTemplateDoc(db, { ...d, delta: { ...d.delta, fields: { profesion: { hidden: true } } } }, null);
    expect((await getTemplateDoc(other)).delta.fields).toEqual({});
  });

  it("un puntero de una versión más nueva que esta no entiende se lee sin romper", async () => {
    await setSetting(db, "anamnesis_tpl:general", { v: 1, id: GENERAL, name: "General", base: 9, delta: { fields: {}, order: {}, added: [{ id: "c_zzzzzzzz", section: "motivo", type: "zones", label: "Zonas", who: "both" }], sections: {}, modules: [{ id: "m_x" }] } });
    const d = await getTemplateDoc(db);
    expect(d.delta.modules).toEqual([{ id: "m_x" }]);
    expect(await getSetting(db, "anamnesis_tpl:general")).toBeTruthy();
  });

  it("una respuesta a una pregunta retirada se lee con su texto: en la ficha y en la exportación", async () => {
    const d = await getTemplateDoc(db);
    const own = { id: "c_bbbbbbbb", section: "habitos", type: "choice" as const, label: "¿Usa plantillas?", who: "both" as const, options: ["No", "Sí"] };
    await saveTemplateDoc(db, { ...d, delta: { ...d.delta, added: [own] } }, null);
    const ref = await markTemplateUsed(db, await currentTemplate(db));
    const answers = { motivo: "Lumbalgia", c_bbbbbbbb: "Sí", __tpl: ref };
    // La clínica la retira después.
    await saveTemplateDoc(db, { ...d, delta: { ...d.delta, added: [{ ...own, removed: true }] } }, null);
    const now = await currentTemplate(db);
    expect(orphanAnswers(answers, now.sections)).toEqual([["c_bbbbbbbb", "Sí"]]);
    expect(knownField("c_bbbbbbbb", await getSnapshot(db, ref), now)?.label).toBe("¿Usa plantillas?");
    const c = await collect(db);
    expect(anamnesisRows(answers, c.template, c.known)).toContainEqual(["Respuestas a preguntas que ya no están", "¿Usa plantillas?", "Sí"]);
    expect(c.templates?.some((t) => t.key === `anamnesis_tpl_v:${ref.replace("@", ":")}`)).toBe(true);
  });

  it("changeCount y toCustom", () => {
    expect(changeCount(doc({ fields: { a: {}, b: {} }, order: { motivo: [] }, added: [{ id: "c_1", section: "motivo", type: "text", label: "x", who: "both", removed: true }] }).delta)).toBe(3);
    expect(toCustom([{ id: "c_1", section: "motivo", type: "text", label: "x", who: "both", hidden: true }])).toEqual([]);
  });
});

describe("editor: operaciones", () => {
  const own = { id: "c_cccccccc", section: "motivo", type: "text" as const, label: "Propia", who: "both" as const };

  it("ocultar y mostrar; lo igual que el original no cuenta como cambio", () => {
    let d = setHidden(doc(), "profesion", true);
    expect(editorView(d)[0]!.items.find((i) => i.field.id === "profesion")).toMatchObject({ hidden: true, changed: false });
    d = setHidden(d, "profesion", false);
    expect(d.delta.fields).toEqual({});
    d = patchField(doc(), "motivo", { label: "Motivo principal" });
    expect(d.delta.fields).toEqual({});
    d = patchField(d, "motivo", { label: "Qué le trae", who: "clinician" });
    expect(d.delta.fields).toEqual({ motivo: { label: "Qué le trae", who: "clinician" } });
    expect(changeCount(d.delta)).toBe(1);
  });

  it("volver al original: por pregunta, por apartado y toda la plantilla (las propias se retiran, no se borran)", () => {
    let d = patchField(setHidden(doc(), "profesion", true), "motivo", { label: "X" });
    d = patchField(d, "alergias", { label: "Y" });
    d = moveField(d, "motivo", "eva", -1);
    d = addOwn(d, own);
    expect(resetField(d, "alergias").delta.fields).not.toHaveProperty("alergias");
    const sec = resetSection(d, "motivo");
    expect(sec.delta.fields).toEqual({ profesion: { hidden: true }, alergias: { label: "Y" } });
    expect(sec.delta.order).toEqual({});
    expect(sec.delta.added).toHaveLength(1);
    const all = resetAll(d);
    expect(changeCount(all.delta)).toBe(0);
    expect(all.delta.added).toEqual([{ ...own, removed: true }]);
    expect(resolveTemplate(all).all.find((f) => f.id === own.id)?.label).toBe("Propia");
  });

  it("subir, bajar, duplicar y retirar", () => {
    const ids = (d: TemplateDoc) => editorView(d).find((s) => s.id === "motivo")!.items.map((i) => i.field.id);
    const before = ids(doc());
    const d = moveField(doc(), "motivo", before[1]!, -1);
    expect(ids(d).slice(0, 2)).toEqual([before[1], before[0]]);
    expect(moveField(doc(), "motivo", before[0]!, -1)).toEqual(doc());
    const dup = duplicateField(doc(), "motivo", editorView(doc())[1]!.items.find((i) => i.field.id === "eva")!.field);
    const copy = dup.delta.added[0]!;
    expect(copy).toMatchObject({ type: "scale", section: "motivo", label: "Intensidad (EVA 0-10) (copia)" });
    expect(ids(dup)[ids(dup).indexOf("eva") + 1]).toBe(copy.id);
    expect(() => checkTemplate(dup)).not.toThrow();
    const gone = retireOwn(addOwn(doc(), own), own.id);
    expect(ids(gone)).not.toContain(own.id);
  });

  it("los paquetes de ejemplo se añaden una vez y los contesta el paciente", () => {
    const pack = [{ section: "habitos", label: "Deporte", type: "text" as const }];
    const a = addPack(doc(), pack);
    expect(a.added).toBe(1);
    expect(a.doc.delta.added[0]).toMatchObject({ label: "Deporte", who: "both" });
    expect(addPack(a.doc, pack).added).toBe(0);
  });
});
