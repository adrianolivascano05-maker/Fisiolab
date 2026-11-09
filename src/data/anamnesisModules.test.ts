// Fase 2 de la anamnesis adaptable (docs/anamnesis-adaptable.md): varias plantillas, módulos de OmniClin y de la
// clínica, apartados nuevos, condiciones, obligatorias y destacados.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANAMNESIS, conditionMet, MAX_REQUIRED, visibleFields, zoneText, type Field } from "../clinical/anamnesis";
import { TPL } from "../clinical/answerMeta";
import {
  addModule,
  addSection,
  archiveTemplate,
  checkTemplate,
  createTemplate,
  currentTemplate,
  duplicateTemplate,
  editorView,
  emptyDelta,
  GENERAL,
  getDefaultTemplateId,
  getTemplateDoc,
  listTemplates,
  markTemplateUsed,
  moveSection,
  patchField,
  removeModule,
  removeSection,
  resolveTemplate,
  saveTemplateDoc,
  setDefaultTemplate,
  setHidden,
  templateFor,
  type TemplateDoc,
} from "./anamnesisTemplates";
import { ackModule, addModuleField, blankModule, checkModule, getModuleDoc, patchModuleField, resetModule, resolveModule, retireModuleField, saveModuleDoc, type ModuleDoc } from "./anamnesisModules";
import { MODULES_LIBRARY, type ModuleSpec } from "./modulesLibrary";
import type { Db } from "./db";
import { setSetting } from "./settings";
import { createTestDb } from "./testDb";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const doc = (delta: Partial<TemplateDoc["delta"]> = {}, id = GENERAL): TemplateDoc => ({ v: 1, id, name: id === GENERAL ? "General" : "Otra", base: 1, delta: { ...emptyDelta(), ...delta } });
const ids = (sections: { fields: { id: string }[] }[]) => sections.flatMap((s) => s.fields.map((f) => f.id));
const sectionIds = (r: { sections: { id: string }[] }) => r.sections.map((s) => s.id);

describe("los módulos de OmniClin (versión 1, los paquetes de antes)", () => {
  it("los tres pasan la comprobación, con ids estables y las mismas preguntas que los paquetes", () => {
    expect(MODULES_LIBRARY.map((m) => m.id)).toEqual(["m_deportiva", "m_suelo_pelvico", "m_neurologica"]);
    for (const m of MODULES_LIBRARY) {
      expect(m.version).toBe(1);
      expect(() => checkModule(blankModule(m.id))).not.toThrow();
      for (const f of m.fields) expect(f.id.startsWith(`${m.id}_`)).toBe(true);
    }
    const labels = MODULES_LIBRARY.flatMap((m) => m.fields.map((f) => f.label));
    expect(labels).toEqual([
      "Deporte principal y nivel",
      "Horas de entrenamiento a la semana",
      "Próxima competición o evento",
      "Objetivo deportivo",
      "Embarazos y partos",
      "Escapes de orina",
      "Uso de absorbentes",
      "Dolor en las relaciones sexuales",
      "Hábito intestinal",
      "Diagnóstico neurológico y fecha",
      "Ayudas técnicas",
      "Nivel de independencia en las actividades diarias",
      "Tono y espasticidad",
    ]);
    // La de sexualidad es delicada: «Prefiero no responder» y nunca obligatoria.
    const sexual = MODULES_LIBRARY[1]!.fields.find((f) => f.id === "m_suelo_pelvico_dispareunia")!;
    expect(sexual).toMatchObject({ sensitive: true, options: ["No", "Sí"] });
    expect(resolveModule("m_suelo_pelvico", patchModuleField(blankModule("m_suelo_pelvico"), sexual.id, { required: true }))!.items.find((i) => i.field.id === sexual.id)!.field.required).toBeFalsy();
  });
});

describe("resolver con módulos y apartados", () => {
  it("un módulo de OmniClin va en su apartado propio, antes de la exploración; quitarlo no pierde lo respondido", () => {
    const withMod = addModule(doc(), "m_suelo_pelvico");
    const r = resolveTemplate(withMod);
    expect(sectionIds(r).slice(5, 8)).toEqual(["habitos", "m_suelo_pelvico", "exploracion"]);
    const sec = r.sections.find((s) => s.id === "m_suelo_pelvico")!;
    expect(sec).toMatchObject({ title: "Suelo pélvico", module: "m_suelo_pelvico" });
    expect(sec.fields[0]).toMatchObject({ id: "m_suelo_pelvico_partos", module: "m_suelo_pelvico" });
    expect(r.modules).toEqual([{ id: "m_suelo_pelvico", name: "Suelo pélvico", version: 1 }]);
    const gone = resolveTemplate(removeModule(withMod, "m_suelo_pelvico"));
    expect(sectionIds(gone)).toEqual(ANAMNESIS.map((s) => s.id));
    expect(gone.all.some((f) => f.id === "m_suelo_pelvico_partos")).toBe(false);
  });

  it("cada plantilla oculta las preguntas del módulo que quiera; los cambios del módulo son de la clínica (se ven en todas)", () => {
    const a = setHidden(addModule(doc(), "m_deportiva"), "m_deportiva_horas", true, "m_deportiva");
    const b = addModule(doc({}, "t_bbbbbbbb"), "m_deportiva");
    const mod = patchModuleField(blankModule("m_deportiva"), "m_deportiva_deporte", { label: "Deporte y nivel" });
    const ra = resolveTemplate(a, [mod]);
    const rb = resolveTemplate(b, [mod]);
    expect(ids(ra.sections)).not.toContain("m_deportiva_horas");
    expect(ids(rb.sections)).toContain("m_deportiva_horas");
    expect(ra.all.find((f) => f.id === "m_deportiva_horas")).toBeTruthy();
    for (const r of [ra, rb]) expect(r.sections.flatMap((s) => s.fields).find((f) => f.id === "m_deportiva_deporte")!.label).toBe("Deporte y nivel");
    // En el editor se ven todas, con su módulo y si están ocultas aquí.
    const row = editorView(a, [mod]).flatMap((s) => s.items).find((i) => i.field.id === "m_deportiva_horas")!;
    expect(row).toMatchObject({ hidden: true, module: "m_deportiva", own: false });
  });

  it("apartados nuevos: con nombre, en su sitio, se mueven y se retiran; una pregunta movida a uno que ya no está vuelve al suyo", () => {
    let d = addSection(doc(), "Obstetricia", "s_0000000a");
    d = { ...d, delta: { ...d.delta, added: [{ id: "c_0000000a", section: "s_0000000a", type: "number", unit: "semanas", label: "Semanas de embarazo", who: "both" }] } };
    d = patchField(d, "profesion", { section: "s_0000000a" });
    let r = resolveTemplate(checkTemplate(d));
    expect(sectionIds(r).slice(5, 8)).toEqual(["habitos", "s_0000000a", "exploracion"]);
    expect(ids(r.sections.filter((s) => s.id === "s_0000000a"))).toEqual(["profesion", "c_0000000a"]);
    expect(r.sections.find((s) => s.id === "s_0000000a")!.fields[1]).toMatchObject({ type: "number", unit: "semanas" });
    d = moveSection(d, "s_0000000a", -1);
    r = resolveTemplate(d);
    expect(sectionIds(r).slice(4, 7)).toEqual(["tratamientos", "s_0000000a", "habitos"]);
    r = resolveTemplate(removeSection(d, "s_0000000a"));
    expect(sectionIds(r)).not.toContain("s_0000000a");
    expect(ids(r.sections.filter((s) => s.id === "datos"))).toContain("profesion");
    expect(r.all.some((f) => f.id === "c_0000000a")).toBe(true);
  });

  it("condiciones: solo sobre una anterior del mismo apartado, Sí/No u opción única; si no, la pregunta se ve siempre", () => {
    const yes = { id: "c_0000000b", section: "motivo", type: "yesno" as const, label: "¿Escapes?", who: "both" as const };
    const when = { id: "c_0000000c", section: "motivo", type: "text" as const, label: "¿Cuándo?", who: "both" as const, showIf: { field: "c_0000000b", op: "eq" as const, value: "Sí" } };
    const wrongOrder = { ...when, id: "c_0000000d", showIf: { field: "c_0000000e", op: "eq" as const, value: "Sí" } };
    const later = { ...yes, id: "c_0000000e" };
    const r = resolveTemplate(checkTemplate(doc({ added: [yes, when, wrongOrder, later] })));
    const motivo = r.sections.find((s) => s.id === "motivo")!.fields;
    expect(motivo.find((f) => f.id === "c_0000000c")!.showIf).toEqual({ field: "c_0000000b", op: "eq", value: "Sí" });
    expect(motivo.find((f) => f.id === "c_0000000d")!.showIf).toBeUndefined();
    expect(ids([{ fields: visibleFields(motivo, { c_0000000b: "No" }) }])).not.toContain("c_0000000c");
    expect(ids([{ fields: visibleFields(motivo, { c_0000000b: "Sí" }) }])).toContain("c_0000000c");
    // «Sí: …» cuenta como Sí; «in» con varias respuestas; encadenadas: si no se ve la de la que depende, tampoco.
    expect(conditionMet({ field: "x", op: "eq", value: "Sí" }, { x: "Sí: rodilla" })).toBe(true);
    expect(conditionMet({ field: "x", op: "in", value: ["A", "B"] }, { x: "B" })).toBe(true);
    const chain = [
      { id: "a", showIf: undefined },
      { id: "b", showIf: { field: "a", op: "eq" as const, value: "Sí" } },
      { id: "c", showIf: { field: "b", op: "eq" as const, value: "Sí" } },
    ];
    expect(visibleFields(chain, { a: "No", b: "Sí" }).map((f) => f.id)).toEqual(["a"]);
  });

  it("obligatorias: solo al paciente, nunca las delicadas, como mucho 5", () => {
    const added = Array.from({ length: 6 }, (_, i) => ({ id: `c_1000000${i}`, section: "motivo", type: "text" as const, label: `P${i}`, who: "both" as const, required: true }));
    expect(() => checkTemplate(doc({ added }))).toThrow(new RegExp(`${MAX_REQUIRED} preguntas obligatorias`));
    const ok = checkTemplate(doc({ added: added.slice(0, 5), fields: { toxicos: { required: true }, cif: { required: true } } }));
    expect(ok.delta.fields.toxicos).toBeUndefined();
    const r = resolveTemplate(ok);
    expect(r.sections.flatMap((s) => s.fields).filter((f: Field) => f.required)).toHaveLength(5);
    expect(checkTemplate(doc({ added: [{ ...added[0]!, who: "clinician" }] })).delta.added[0]!.required).toBeUndefined();
  });

  it("zonas del cuerpo con su lado, en texto", () => {
    expect(zoneText("rodilla:derecho")).toBe("Rodilla (lado derecho)");
    expect(zoneText("hombro:ambos")).toBe("Hombro (los dos lados)");
    expect(zoneText("cadera")).toBe("Cadera");
  });
});

describe("módulos de OmniClin: cambios de la clínica, volver a la versión de OmniClin y novedades", () => {
  const extra: ModuleSpec = {
    id: "m_prueba",
    name: "Prueba",
    version: 2,
    hideTrunk: ["profesion", "derivado_por"],
    fields: [
      { id: "m_prueba_uno", section: "self", type: "choice", label: "Uno", who: "both", options: ["A", "B"], highlight: ["B"] },
      { id: "m_prueba_dos", section: "antecedentes", type: "yesno", label: "Dos", who: "both", since: 2 },
    ],
  };
  beforeEach(() => void MODULES_LIBRARY.push(extra));
  afterEach(() => void MODULES_LIBRARY.splice(MODULES_LIBRARY.indexOf(extra), 1));

  it("añadirlo oculta las del tronco que indica; reparte las suyas; opciones: añadir y retirar, nunca renombrar", () => {
    const d = addModule(doc(), "m_prueba");
    expect(d.delta.fields).toMatchObject({ profesion: { hidden: true }, derivado_por: { hidden: true } });
    const r = resolveTemplate(d, [blankModule("m_prueba")]);
    expect(ids(r.sections.filter((s) => s.id === "antecedentes"))).toContain("m_prueba_dos");
    let m = patchModuleField(blankModule("m_prueba"), "m_prueba_uno", { options: ["B", "C"], label: "Uno bis" });
    expect(m.fields.m_prueba_uno).toMatchObject({ addOptions: ["C"], removeOptions: ["A"], label: "Uno bis" });
    expect(resolveModule("m_prueba", m)!.items[0]!.field).toMatchObject({ label: "Uno bis", options: ["B", "C"], highlight: ["B"] });
    m = addModuleField(m, { id: "c_2000000a", section: "self", type: "text", label: "Mía", who: "both" });
    m = retireModuleField(m, "m_prueba_dos");
    const rm = resolveModule("m_prueba", m)!;
    expect(rm.changed).toBe(true);
    expect(rm.items.find((i) => i.field.id === "m_prueba_dos")!.removed).toBe(true);
    // Volver a la versión de OmniClin: sin cambios; las suyas se retiran (lo respondido se lee).
    const back = resolveModule("m_prueba", resetModule(m))!;
    expect(back.items.map((i) => [i.field.id, i.removed])).toEqual([
      ["m_prueba_uno", false],
      ["m_prueba_dos", false],
      ["c_2000000a", true],
    ]);
    expect(back.items[0]!.field.label).toBe("Uno");
  });

  it("una versión nueva: la clínica ve el aviso con las preguntas nuevas, que aparecen solas, y lo suyo se respeta", () => {
    const seen1 = { ...patchModuleField(blankModule("m_prueba"), "m_prueba_uno", { label: "Lo mío" }), seen: 1 };
    const rm = resolveModule("m_prueba", seen1)!;
    expect(rm.news).toEqual(["m_prueba_dos"]);
    expect(rm.items.map((i) => i.field.label)).toEqual(["Lo mío", "Dos"]);
    expect(resolveModule("m_prueba", ackModule(seen1))!.news).toEqual([]);
  });

  it("se guarda y se lee; uno de la clínica con su id, sus preguntas y «lo contesta un familiar o tutor»", async () => {
    await saveModuleDoc(db, { ...blankModule("m_prueba"), seen: 2 }, "ana@x.es");
    expect(await getModuleDoc(db, "m_prueba")).toMatchObject({ id: "m_prueba", by: "ana@x.es" });
    const own: ModuleDoc = { v: 1, id: "md_0000000a", name: "Obstetricia", fields: {}, added: [{ id: "c_3000000a", section: "self", type: "date", label: "Fecha prevista de parto", who: "both" }], guardian: true };
    await saveModuleDoc(db, own, null);
    expect(() => checkModule({ ...own, id: "md_mal" })).toThrow(/identificador/);
    const t = await saveTemplateDoc(db, addModule(doc(), "md_0000000a", [own]), null);
    const r = await currentTemplate(db, t.id);
    expect(r.guardian).toBe(true);
    expect(r.sections.find((s) => s.id === "md_0000000a")!.fields[0]).toMatchObject({ type: "date", label: "Fecha prevista de parto" });
  });
});

describe("varias plantillas", () => {
  it("crear (con lo de la de por defecto y sus módulos), duplicar, por defecto y archivar; como mucho 20", async () => {
    await saveTemplateDoc(db, patchField(await getTemplateDoc(db), "profesion", { hidden: true }), null);
    const sp = await createTemplate(db, "Suelo pélvico", ["m_suelo_pelvico"], "ana@x.es");
    expect(sp.id).toMatch(/^t_[0-9a-f]{8}$/);
    expect(sp.delta.fields.profesion).toEqual({ hidden: true });
    expect(sp.delta.modules).toEqual([{ id: "m_suelo_pelvico" }]);
    expect((await listTemplates(db)).map((t) => t.name)).toEqual(["General", "Suelo pélvico"]);
    expect(await getDefaultTemplateId(db)).toBe(GENERAL);
    await setDefaultTemplate(db, sp.id);
    expect(await getDefaultTemplateId(db)).toBe(sp.id);
    await expect(archiveTemplate(db, sp.id, true, null)).rejects.toThrow(/por defecto/);
    await setDefaultTemplate(db, GENERAL);
    const copy = await duplicateTemplate(db, sp.id, null);
    expect(copy.name).toBe("Suelo pélvico (copia)");
    await archiveTemplate(db, copy.id, true, null);
    expect((await listTemplates(db)).find((t) => t.id === copy.id)!.archived).toBe(true);
    // General, Suelo pélvico y 18 más: 20 en uso (la copia archivada no cuenta).
    for (let i = 0; i < 18; i++) await createTemplate(db, `P${i}`, [], null);
    await expect(createTemplate(db, "Otra", [], null)).rejects.toThrow(/20 plantillas/);
  });

  it("dos plantillas, un paciente con cada una: cambiar la de por defecto o archivarla no cambia las ya hechas", async () => {
    const sp = await createTemplate(db, "Suelo pélvico", ["m_suelo_pelvico"], null);
    const a = await markTemplateUsed(db, await currentTemplate(db));
    const b = await markTemplateUsed(db, await currentTemplate(db, sp.id));
    await setDefaultTemplate(db, sp.id);
    expect((await templateFor(db, a)).id).toBe(GENERAL);
    expect((await templateFor(db, b)).sections.some((s) => s.id === "m_suelo_pelvico")).toBe(true);
    await setDefaultTemplate(db, GENERAL);
    await archiveTemplate(db, sp.id, true, null);
    expect((await templateFor(db, b)).sections.some((s) => s.id === "m_suelo_pelvico")).toBe(true);
    // Sin __tpl, la de por defecto; con una de otro móvil que aquí no está, su instantánea.
    expect((await templateFor(db, undefined)).id).toBe(GENERAL);
    const snapOnly = await createTestDb();
    const snap = await currentTemplate(db, sp.id);
    await setSetting(snapOnly, `anamnesis_tpl_v:${sp.id}:${snap.hash}`, { v: 1, id: snap.id, name: snap.name, base: snap.base, sections: snap.sections, all: snap.all, modules: snap.modules });
    expect((await templateFor(snapOnly, `${sp.id}@${snap.hash}`)).sections.some((s) => s.id === "m_suelo_pelvico")).toBe(true);
    expect(TPL).toBe("__tpl");
  });
});
