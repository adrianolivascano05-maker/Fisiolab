// La anamnesis base (lo mínimo, lo que sale al abrir la ficha) y la ampliada (todo): qué preguntas lleva cada una, cómo
// las cambia la clínica y qué se le manda al paciente (docs/anamnesis-adaptable.md).
import { describe, expect, it } from "vitest";
import { ALWAYS_ASKED, ANAMNESIS, baseBlocks, CORE, FIXED, type Field } from "../clinical/anamnesis";
import { patientSections } from "../clinical/patientForms";
import { addOwn, checkTemplate, defaultLevel, editorView, emptyDelta, GENERAL, patchField, resetField, resolveTemplate, templateHash, type TemplateDoc } from "./anamnesisTemplates";
import { addModule } from "./anamnesisTemplates";
import { blankModule, checkModule, patchModuleField, resolveModule } from "./anamnesisModules";
import type { OwnField } from "./anamnesisFields";

const doc = (delta: Partial<TemplateDoc["delta"]> = {}): TemplateDoc => ({ v: 1, id: GENERAL, name: "General", base: 1, delta: { ...emptyDelta(), ...delta } });
const all = (t: { sections: { fields: Field[] }[] }) => t.sections.flatMap((s) => s.fields);
const base = (t: { sections: { fields: Field[] }[] }) => all(t).filter((f) => !f.extra).map((f) => f.id);
const own = (over: Partial<OwnField> = {}): OwnField => ({ id: "c_0000aaaa", section: "habitos", type: "text", label: "Horas sentado al día", who: "both", ...over });

describe("la anamnesis base", () => {
  it("son 16 preguntas (y la fecha, que se pone sola), todas del tronco; el resto, en la ampliada", () => {
    const trunk = ANAMNESIS.flatMap((s) => s.fields.map((f) => f.id));
    expect([...CORE].every((id) => trunk.includes(id))).toBe(true);
    expect(CORE.size).toBe(17);
    const t = resolveTemplate(doc());
    expect(base(t)).toEqual([
      "fecha_valoracion",
      "motivo",
      "regiones",
      "lado",
      "fecha_inicio",
      "eva",
      "agravantes",
      "atenuantes",
      "banderas_rojas",
      "enfermedades",
      "cirugias",
      "medicacion",
      "alergias",
      "precauciones",
      "diagnostico_funcional",
      "plan",
      "observaciones",
    ]);
    // La ampliada lo lleva todo: no se quita ninguna pregunta.
    expect(all(t).length).toBe(trunk.length);
    expect(all(t).filter((f) => f.extra).length).toBe(trunk.length - 17);
  });

  it("lleva lo que usa el resto de la app para el motivo, los tests por zona, los consentimientos y el informe", () => {
    for (const id of ["motivo", "regiones", "lado", "eva", "banderas_rojas", "precauciones", "enfermedades", "medicacion", "alergias", "cirugias", "diagnostico_funcional", "plan", "observaciones"]) {
      expect(FIXED[id], id).toBeTruthy();
      expect(CORE.has(id), id).toBe(true);
    }
  });

  it("se ve en tres bloques; los apartados de la clínica y de los módulos, aparte con su nombre", () => {
    const t = resolveTemplate(doc());
    const blocks = baseBlocks(t.sections, (s) => s.fields.filter((f) => !f.extra));
    expect(blocks.map((b) => b.title)).toEqual(["Motivo de consulta", "Salud", "Diagnóstico y plan"]);
    expect(blocks.map((b) => b.parts.flatMap((p) => p.fields).length)).toEqual([9, 5, 3]);
    // Con un módulo: su apartado es un bloque más, con su nombre, en su sitio (antes de la exploración).
    const withMod = resolveTemplate(addModule(doc(), "m_suelo_pelvico"));
    expect(baseBlocks(withMod.sections, (s) => s.fields.filter((f) => !f.extra)).map((b) => b.title)).toEqual(["Motivo de consulta", "Salud", "Suelo pélvico", "Diagnóstico y plan"]);
    // Un bloque sin preguntas que enseñar no sale.
    expect(baseBlocks(t.sections, (s) => (s.id === "motivo" ? s.fields.filter((f) => !f.extra) : [])).map((b) => b.title)).toEqual(["Motivo de consulta"]);
  });
});

describe("la clínica cambia dónde sale cada pregunta", () => {
  it("una del tronco: a la base o a la ampliada; lo igual que el original no cuenta como cambio y «volver al original» lo deshace", () => {
    expect(defaultLevel("motivo")).toBe("base");
    expect(defaultLevel("profesion")).toBe("extra");
    let d = patchField(doc(), "profesion", { level: "base" });
    expect(d.delta.fields.profesion).toEqual({ level: "base" });
    expect(base(resolveTemplate(d))).toContain("profesion");
    d = patchField(d, "agravantes", { level: "extra" });
    expect(base(resolveTemplate(d))).not.toContain("agravantes");
    // Sigue en la ampliada: no se pierde.
    expect(all(resolveTemplate(d)).map((f) => f.id)).toContain("agravantes");
    expect(editorView(d).flatMap((s) => s.items).find((i) => i.field.id === "profesion")?.changed).toBe(true);
    // Volver a lo que trae OmniClin borra el cambio.
    expect(patchField(d, "profesion", { level: "extra" }).delta.fields.profesion).toBeUndefined();
    expect(resetField(d, "agravantes").delta.fields.agravantes).toBeUndefined();
    // Se guarda limpio: un nivel que no existe o igual que el original se quita.
    const saved = checkTemplate({ ...d, delta: { ...d.delta, fields: { ...d.delta.fields, motivo: { level: "base" }, lado: { level: "raro" as never } } } });
    expect(saved.delta.fields).toEqual({ profesion: { level: "base" }, agravantes: { level: "extra" } });
  });

  it("las propias de la clínica van en la base si no dice otra cosa; se pueden pasar a la ampliada", () => {
    let d = addOwn(doc(), own());
    expect(base(resolveTemplate(d))).toContain("c_0000aaaa");
    d = patchField(d, "c_0000aaaa", { level: "extra" });
    expect(d.delta.added[0]!.extra).toBe(true);
    expect(base(resolveTemplate(d))).not.toContain("c_0000aaaa");
    expect(checkTemplate(d).delta.added[0]!.extra).toBe(true);
    d = patchField(d, "c_0000aaaa", { level: "base" });
    expect(d.delta.added[0]!.extra).toBeUndefined();
  });

  it("las de un módulo van en la base; pasarlas a la ampliada es un cambio del módulo (se ve en todas sus plantillas)", () => {
    const d = addModule(doc(), "m_suelo_pelvico");
    expect(base(resolveTemplate(d))).toContain("m_suelo_pelvico_escapes");
    const mod = checkModule(patchModuleField(blankModule("m_suelo_pelvico"), "m_suelo_pelvico_escapes", { extra: true }));
    expect(mod.fields.m_suelo_pelvico_escapes).toEqual({ extra: true });
    expect(base(resolveTemplate(d, [mod]))).not.toContain("m_suelo_pelvico_escapes");
    expect(resolveModule("m_suelo_pelvico", mod)!.items.find((i) => i.field.id === "m_suelo_pelvico_escapes")!.changed).toBe(true);
    // De vuelta a la base: sin cambio guardado.
    expect(patchModuleField(mod, "m_suelo_pelvico_escapes", { extra: undefined }).fields.m_suelo_pelvico_escapes).toBeUndefined();
  });

  it("cambiar dónde sale una pregunta cambia la huella de la plantilla (un enlace ya mandado se lee con la suya)", async () => {
    const a = await templateHash(resolveTemplate(doc()));
    const b = await templateHash(resolveTemplate(patchField(doc(), "profesion", { level: "base" })));
    expect(a).not.toBe(b);
  });
});

describe("lo que se le manda al paciente", () => {
  const ids = (sections: { fields: { id: string }[] }[]) => sections.flatMap((s) => s.fields.map((f) => f.id));

  it("con la base: 10 preguntas en 2 pasos (las de la base que contesta él y, siempre, sus síntomas de alarma)", () => {
    const t = resolveTemplate(doc());
    const short = patientSections(t.sections, false);
    expect(ids(short)).toEqual(["motivo", "fecha_inicio", "eva", "agravantes", "atenuantes", ALWAYS_ASKED, "enfermedades", "cirugias", "medicacion", "alergias"]);
    expect(short.map((s) => s.title)).toEqual(["Motivo de consulta", "Antecedentes médicos personales"]);
  });

  it("con la ampliada: las 15 de siempre", () => {
    const t = resolveTemplate(doc());
    expect(ids(patientSections(t.sections, true)).length).toBe(15);
    expect(ids(patientSections(t.sections))).toEqual(ids(patientSections(t.sections, true)));
  });

  it("lo que la clínica pasa a la base (o saca de ella) se le manda (o no) con la base", () => {
    let d = patchField(doc(), "objetivo_paciente", { level: "base" });
    d = patchField(d, "agravantes", { who: "clinician" });
    const short = ids(patientSections(resolveTemplate(d).sections, false));
    expect(short).toContain("objetivo_paciente");
    expect(short).not.toContain("agravantes");
    // Una propia que contesta el paciente va en la base; si se pasa a la ampliada, solo con la ampliada.
    const withOwn = addOwn(doc(), own());
    expect(ids(patientSections(resolveTemplate(withOwn).sections, false))).toContain("c_0000aaaa");
    const moved = patchField(withOwn, "c_0000aaaa", { level: "extra" });
    expect(ids(patientSections(resolveTemplate(moved).sections, false))).not.toContain("c_0000aaaa");
    expect(ids(patientSections(resolveTemplate(moved).sections, true))).toContain("c_0000aaaa");
  });
});
