import { describe, expect, it } from "vitest";
import { PRECAUTIONS } from "./precautions";
import { buildSections, TEMPLATES, templateById } from "./templates";
import type { ConsentContext, ConsentTemplate } from "./types";

/** Contexto vacío (sin nada marcado) con lo que cambie cada test. */
const ctx = (over: Partial<ConsentContext> = {}): ConsentContext => ({
  age: null,
  sex: null,
  regions: [],
  precautions: [],
  detected: [],
  redFlags: [],
  hasPerformanceTests: false,
  planText: "",
  ...over,
});

const tpl = (id: string): ConsentTemplate => {
  const t = templateById(id);
  if (!t) throw new Error(`falta la plantilla ${id}`);
  return t;
};

const IDS = ["general", "invasiva", "manipulacion", "electroterapia", "ondas_choque", "suelo_pelvico", "rendimiento", "telefisio"];

/** Ids de las plantillas que sugieren algo para este plan. */
const suggested = (planText: string, over: Partial<ConsentContext> = {}) =>
  TEMPLATES.filter((t) => t.suggest(ctx({ planText, ...over })) !== null).map((t) => t.id);

const texts = (id: string, over: Partial<ConsentContext>) => tpl(id).personal(ctx(over)).map((r) => r.text).join("\n");
const absolutes = (id: string, over: Partial<ConsentContext>) => tpl(id).personal(ctx(over)).filter((r) => r.absolute).map((r) => r.text);

describe("plantillas de consentimiento", () => {
  it("las ocho, con ids únicos, versión y textos completos", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(IDS);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      expect(t.version, t.id).toBe("1");
      expect(t.title.trim(), t.id).not.toBe("");
      expect(t.summary.trim(), t.id).not.toBe("");
      expect(t.summary, t.id).not.toContain("\n");
      expect(t.description.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.description.length, t.id).toBeLessThanOrEqual(4);
      for (const list of [t.description, t.benefits, t.expected, t.risks.frequent, t.risks.rare, t.contraindications, t.alternatives]) {
        expect(list.length, t.id).toBeGreaterThan(0);
        for (const s of list) expect(s.trim(), t.id).not.toBe("");
      }
      expect(t.techniques.length, t.id).toBeGreaterThan(0);
      expect(new Set(t.techniques.map((x) => x.id)).size, t.id).toBe(t.techniques.length);
    }
  });

  it("por escrito obligado en lo invasivo o con riesgos notorios", () => {
    const required = TEMPLATES.filter((t) => t.written === "required").map((t) => t.id);
    expect(required).toEqual(["invasiva", "manipulacion", "suelo_pelvico"]);
  });

  it("templateById", () => {
    expect(templateById("invasiva")?.title).toBe("Fisioterapia invasiva");
    expect(templateById("no-existe")).toBeUndefined();
  });

  it("con todo vacío solo se sugiere la general y nadie tiene riesgos personales", () => {
    expect(suggested("")).toEqual(["general"]);
    expect(tpl("general").suggest(ctx())).toBe("Antes de empezar el tratamiento");
    for (const t of TEMPLATES) expect(t.personal(ctx()), t.id).toEqual([]);
  });
});

describe("suggest: palabras del plan, sin tildes ni mayúsculas", () => {
  it("fisioterapia invasiva", () => {
    for (const plan of ["punción seca del trapecio", "PUNCION SECA", "aguja en gemelo", "Electrólisis percutánea", "EPI en tendón rotuliano", "epte", "Neuromodulación percutánea del mediano"]) {
      expect(suggested(plan), plan).toContain("invasiva");
    }
    // «epicondilalgia» no es EPI.
    expect(suggested("epicondilalgia lateral")).not.toContain("invasiva");
  });

  it("manipulación", () => {
    for (const plan of ["Manipulación dorsal", "manipulacion lumbar", "thrust en C7", "HVLA"]) expect(suggested(plan), plan).toContain("manipulacion");
  });

  it("electroterapia y agentes físicos", () => {
    for (const plan of ["TENS", "electroestimulación del cuádriceps", "Ultrasonido", "diatermia", "Tecarterapia", "radiofrecuencia", "Láser", "laser", "magnetoterapia"]) {
      expect(suggested(plan), plan).toContain("electroterapia");
    }
    // Ni «extensión» ni «tensión» son TENS, y la electrólisis es invasiva.
    expect(suggested("ejercicios de extensión, tensión neural")).not.toContain("electroterapia");
    expect(suggested("electrólisis percutánea")).not.toContain("electroterapia");
  });

  it("ondas de choque", () => {
    expect(suggested("Ondas de choque radiales")).toContain("ondas_choque");
    expect(suggested("ONDAS focales")).toContain("ondas_choque");
  });

  it("suelo pélvico", () => {
    for (const plan of ["fisioterapia de suelo pélvico", "SUELO PELVICO", "valoración intracavitaria", "masaje perineal", "periné"]) {
      expect(suggested(plan), plan).toContain("suelo_pelvico");
    }
  });

  it("rendimiento: por las mediciones o por el plan", () => {
    expect(suggested("", { hasPerformanceTests: true })).toContain("rendimiento");
    expect(tpl("rendimiento").suggest(ctx({ hasPerformanceTests: true }))).toMatch(/mediciones/);
    for (const plan of ["saltos pliométricos", "Fuerza de cuádriceps", "sprint", "Readaptación", "readaptacion", "vuelta al deporte"]) {
      expect(suggested(plan), plan).toContain("rendimiento");
    }
  });

  it("telefisioterapia", () => {
    for (const plan of ["telefisioterapia", "Videollamada semanal", "seguimiento ONLINE", "ejercicios a distancia"]) {
      expect(suggested(plan), plan).toContain("telefisio");
    }
  });
});

describe("personal: riesgos por las circunstancias del paciente", () => {
  it("invasiva y anticoagulantes: más riesgo de hematoma, no absoluta", () => {
    const r = tpl("invasiva").personal(ctx({ precautions: ["anticoagulantes"] }));
    expect(r).toHaveLength(1);
    expect(r[0].text).toMatch(/^Como toma anticoagulantes o antiagregantes, el riesgo de hematoma es mayor/);
    expect(r[0].absolute).toBeFalsy();
  });

  it("contraindicaciones absolutas, una precaución cada vez", () => {
    const found: string[] = [];
    for (const t of TEMPLATES) {
      for (const p of PRECAUTIONS) {
        if (t.personal(ctx({ precautions: [p.id] })).some((r) => r.absolute)) found.push(`${t.id}+${p.id}`);
      }
    }
    expect(found.sort()).toEqual(
      [
        "invasiva+coagulacion",
        "invasiva+linfedema",
        "electroterapia+marcapasos",
        "manipulacion+osteoporosis",
        "manipulacion+cancer",
        "ondas_choque+embarazo",
        "ondas_choque+coagulacion",
      ].sort(),
    );
  });

  it("manipulación: banderas rojas, y arterias del cuello o artritis inflamatoria solo si es el cuello", () => {
    expect(absolutes("manipulacion", { redFlags: ["Dolor nocturno que no cede con el reposo"] })).toHaveLength(1);
    expect(texts("manipulacion", { redFlags: ["Dolor nocturno que no cede con el reposo"] })).toContain("dolor nocturno que no cede con el reposo");
    expect(absolutes("manipulacion", { precautions: ["cervical_vascular"], regions: ["cervical"] })).toHaveLength(1);
    expect(absolutes("manipulacion", { precautions: ["cervical_vascular"], regions: ["lumbar"] })).toHaveLength(0);
    expect(texts("manipulacion", { precautions: ["cervical_vascular"], regions: ["lumbar"] })).toMatch(/no se le debe manipular el cuello/);
    expect(absolutes("manipulacion", { precautions: ["reuma"], regions: ["cervical"] })).toHaveLength(1);
    expect(absolutes("manipulacion", { precautions: ["reuma"] })).toHaveLength(0);
  });

  it("manipulación: riesgo arterial si es el cuello y hueso más frágil desde los 65", () => {
    expect(texts("manipulacion", { regions: ["cervical"] })).toMatch(/arteria del cuello/);
    expect(texts("manipulacion", { regions: ["lumbar"] })).toBe("");
    expect(texts("manipulacion", { age: 70 })).toMatch(/Como tiene 70 años, el hueso puede ser más frágil/);
    expect(texts("manipulacion", { age: 64 })).toBe("");
  });

  it("invasiva: neumotórax en cuello, espalda alta u hombro", () => {
    for (const region of ["cervical", "dorsal", "hombro"]) expect(texts("invasiva", { regions: [region] }), region).toMatch(/neumotórax/);
    expect(texts("invasiva", { regions: ["lumbar", "rodilla"] })).not.toMatch(/neumotórax/);
  });

  it("invasiva y embarazo: absoluta solo si la zona es lumbar o pélvica", () => {
    expect(absolutes("invasiva", { precautions: ["embarazo"], regions: ["lumbar"] })).toHaveLength(1);
    expect(absolutes("invasiva", { precautions: ["embarazo"], regions: ["sacroiliaca"] })).toHaveLength(1);
    expect(absolutes("invasiva", { precautions: ["embarazo"], regions: ["hombro"] })).toHaveLength(0);
    expect(texts("invasiva", { precautions: ["embarazo"], regions: ["hombro"] })).toMatch(/no se pincha la zona lumbar/);
  });

  it("ondas de choque en menores: cartílago de crecimiento", () => {
    expect(texts("ondas_choque", { age: 15 })).toMatch(/cartílagos de crecimiento/);
    expect(texts("ondas_choque", { age: 18 })).toBe("");
  });

  it("suelo pélvico y embarazo: según criterio médico, no absoluta", () => {
    const r = tpl("suelo_pelvico").personal(ctx({ precautions: ["embarazo"] }));
    expect(r).toHaveLength(1);
    expect(r[0].text).toMatch(/médico o su matrona/);
    expect(r[0].absolute).toBeFalsy();
    expect(texts("suelo_pelvico", { sex: "male" })).toMatch(/vía anal/);
    expect(texts("suelo_pelvico", { sex: "female" })).toBe("");
  });

  it("cada precaución de la anamnesis cambia al menos una plantilla", () => {
    for (const p of PRECAUTIONS) {
      expect(TEMPLATES.some((t) => t.personal(ctx({ precautions: [p.id] })).length > 0), p.id).toBe(true);
    }
  });

  it("lo detectado en el texto libre sin marcar no sale en el documento", () => {
    const detected = PRECAUTIONS.map((p) => ({ precaution: p.id, word: p.words[0] }));
    for (const t of TEMPLATES) expect(t.personal(ctx({ detected })), t.id).toEqual([]);
  });

  it("los textos van en segunda persona y sin huecos", () => {
    const full = ctx({
      age: 70,
      sex: "male",
      regions: ["cervical", "dorsal", "lumbar"],
      precautions: PRECAUTIONS.map((p) => p.id),
      redFlags: ["Pérdida de peso sin explicación", "Alteración de esfínteres o anestesia en silla de montar"],
    });
    for (const t of TEMPLATES) {
      for (const r of t.personal(full)) {
        expect(r.text, t.id).toMatch(/^(Como |Nos ha comentado |En su caso)/);
        expect(r.text, t.id).not.toMatch(/undefined|null|\$\{/);
        expect(r.text.endsWith("."), r.text).toBe(true);
      }
    }
  });
});

describe("buildSections", () => {
  const ORDER = [
    "Qué es y cómo se hace",
    "Para qué sirve",
    "Lo que es normal notar",
    "Riesgos frecuentes",
    "Riesgos poco frecuentes pero importantes",
    "Riesgos por sus circunstancias",
    "Cuándo no se debe aplicar",
    "Alternativas",
    "Sus derechos",
  ];

  it("todas las plantillas: apartados en orden, ninguno vacío, y al final «Sus derechos»", () => {
    for (const t of TEMPLATES) {
      const s = buildSections(t, ctx(), []);
      expect(s.map((x) => x.title), t.id).toEqual(ORDER.filter((x) => x !== "Riesgos por sus circunstancias"));
      for (const x of s) expect(x.items.length, `${t.id}: ${x.title}`).toBeGreaterThan(0);
      expect(s.at(-1)?.title).toBe("Sus derechos");
    }
  });

  it("riesgos personales entre los riesgos y las contraindicaciones, solo si hay", () => {
    const s = buildSections(tpl("invasiva"), ctx({ precautions: ["anticoagulantes"], detected: [{ precaution: "diabetes", word: "diabet" }] }), []);
    expect(s.map((x) => x.title)).toEqual(ORDER);
    expect(s[5].items).toHaveLength(1);
    expect(s[5].items[0]).toMatch(/anticoagulantes/);
    expect(s.at(-1)?.title).toBe("Sus derechos");
  });

  it("qué es: la descripción y, si se marcan, las técnicas", () => {
    const t = tpl("invasiva");
    expect(buildSections(t, ctx(), [])[0].items).toEqual(t.description);
    const items = buildSections(t, ctx(), ["puncion_seca", "neuromodulacion"])[0].items;
    expect(items).toHaveLength(t.description.length + 1);
    expect(items.at(-1)).toBe("Técnicas que se van a usar en su caso: punción seca; neuromodulación percutánea.");
    // Las siglas se quedan en mayúsculas.
    expect(buildSections(tpl("electroterapia"), ctx(), ["tens"])[0].items.at(-1)).toMatch(/: TENS y electroestimulación\.$/);
  });

  it("sus derechos: preguntar, revocar por escrito (art. 8.5), copia y acompañante", () => {
    const rights = buildSections(tpl("general"), ctx(), []).at(-1)?.items.join("\n") ?? "";
    expect(rights).toMatch(/preguntar/);
    expect(rights).toMatch(/retirar este consentimiento en cualquier momento, por escrito/);
    expect(rights).toMatch(/Ley 41\/2002, art\. 8\.5/);
    expect(rights).toMatch(/copia/);
    expect(rights).toMatch(/acompañante/);
  });

  it("el documento no comparte arrays con la plantilla", () => {
    const t = tpl("general");
    const before = [...t.benefits];
    buildSections(t, ctx(), [])[1].items.push("cambiado");
    expect(t.benefits).toEqual(before);
  });
});
