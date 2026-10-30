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
  planText: "",
  ...over,
});

const tpl = (id: string): ConsentTemplate => {
  const t = templateById(id);
  if (!t) throw new Error(`falta la plantilla ${id}`);
  return t;
};

const IDS = ["general", "invasiva", "manipulacion", "electroterapia", "suelo_pelvico"];

/** Ids de las plantillas que sugieren algo para este plan. */
const suggested = (planText: string) => TEMPLATES.filter((t) => t.suggest(ctx({ planText })) !== null).map((t) => t.id);

const texts = (id: string, over: Partial<ConsentContext>) => tpl(id).personal(ctx(over)).map((r) => r.text).join("\n");

describe("plantillas de consentimiento", () => {
  it("las cinco, con ids únicos, versión y textos cortos", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(IDS);
    for (const t of TEMPLATES) {
      expect(t.version, t.id).toBe("4");
      expect(t.title.trim(), t.id).not.toBe("");
      expect(t.summary, t.id).toMatch(/, etc\.$/);
      expect(t.description.length, t.id).toBeLessThanOrEqual(2);
      expect(t.risks.length, t.id).toBeLessThanOrEqual(5);
      expect(t.contraindications.length, t.id).toBeLessThanOrEqual(5);
      expect(t.alternatives, t.id).toHaveLength(1);
      for (const list of [t.description, t.risks, t.contraindications, t.alternatives]) {
        expect(list.length, t.id).toBeGreaterThan(0);
        for (const s of list) expect(s.trim(), t.id).not.toBe("");
      }
      expect(t.techniques.length, t.id).toBeGreaterThan(0);
      expect(new Set(t.techniques.map((x) => x.id)).size, t.id).toBe(t.techniques.length);
    }
  });

  it("cada uno pone ejemplos («como… etc.»)", () => {
    for (const t of TEMPLATES) expect(t.description[0], t.id).toMatch(/como .*etc\./);
  });

  it("por escrito obligado en lo invasivo o con riesgos notorios", () => {
    const required = TEMPLATES.filter((t) => t.written === "required").map((t) => t.id);
    expect(required).toEqual(["invasiva", "manipulacion", "suelo_pelvico"]);
  });

  it("templateById", () => {
    expect(templateById("invasiva")?.title).toBe("Tratamientos invasivos");
    expect(templateById("no-existe")).toBeUndefined();
  });

  it("con todo vacío solo se sugiere la general y nadie tiene riesgos personales", () => {
    expect(suggested("")).toEqual(["general"]);
    expect(tpl("general").suggest(ctx())).toBe("Antes de empezar el tratamiento");
    for (const t of TEMPLATES) expect(t.personal(ctx()), t.id).toEqual([]);
  });
});

describe("suggest: palabras del plan, sin tildes ni mayúsculas", () => {
  it("tratamientos invasivos", () => {
    for (const plan of ["punción seca del trapecio", "PUNCION SECA", "aguja en gemelo", "Electrólisis percutánea", "EPI en tendón rotuliano", "epte", "Neuromodulación percutánea del mediano"]) {
      expect(suggested(plan), plan).toContain("invasiva");
    }
    // «epicondilalgia» no es EPI, y la neuromodulación por la piel no es invasiva.
    expect(suggested("epicondilalgia lateral")).not.toContain("invasiva");
    expect(suggested("Neuromodulación transcutánea del tibial")).not.toContain("invasiva");
  });

  it("manipulaciones", () => {
    for (const plan of ["Manipulación dorsal", "manipulacion lumbar", "thrust en C7", "HVLA"]) expect(suggested(plan), plan).toContain("manipulacion");
  });

  it("electroterapia y otros aparatos, ondas de choque incluidas", () => {
    for (const plan of ["TENS", "electroestimulación del cuádriceps", "Ultrasonido", "diatermia", "Tecarterapia", "radiofrecuencia", "Láser", "laser", "magnetoterapia", "Ondas de choque radiales", "ONDAS focales"]) {
      expect(suggested(plan), plan).toContain("electroterapia");
    }
    // Ni «extensión» ni «tensión» son TENS, y la electrólisis es invasiva.
    expect(suggested("ejercicios de extensión, tensión neural")).not.toContain("electroterapia");
    expect(suggested("electrólisis percutánea")).not.toContain("electroterapia");
  });

  it("suelo pélvico", () => {
    for (const plan of ["fisioterapia de suelo pélvico", "SUELO PELVICO", "valoración intracavitaria", "masaje perineal", "periné"]) {
      expect(suggested(plan), plan).toContain("suelo_pelvico");
    }
  });
});

describe("personal: lo de cada paciente según su anamnesis", () => {
  it("invasiva y anticoagulantes: más moratones", () => {
    const r = tpl("invasiva").personal(ctx({ precautions: ["anticoagulantes"] }));
    expect(r).toHaveLength(1);
    expect(r[0].text).toMatch(/^Como toma anticoagulantes o antiagregantes, es más fácil que salga un moratón/);
  });

  const ZONES = [[], ["cervical"], ["dorsal"], ["lumbar"], ["sacroiliaca"], ["hombro"], ["rodilla"]];
  const FLAGS = [[], ["Dolor nocturno que no cede con el reposo", "Alteración de esfínteres o anestesia en silla de montar"]];

  it("ninguna plantilla da veredictos: sin «absolute» y sin «no se debe», «con urgencia» ni «Contraindicado»", () => {
    for (const t of TEMPLATES) {
      for (const p of [...PRECAUTIONS.map((x) => [x.id]), PRECAUTIONS.map((x) => x.id)]) {
        for (const regions of ZONES) {
          for (const redFlags of FLAGS) {
            for (const r of t.personal(ctx({ precautions: p, regions, redFlags, age: 70 }))) {
              expect(Object.keys(r), `${t.id}: ${r.text}`).toEqual(["text"]);
              expect(r.text, `${t.id}: ${r.text}`).not.toMatch(/no se le debe|no se debe|con urgencia|Contraindicado/);
            }
          }
        }
      }
    }
  });

  it("manipulación: banderas rojas y precauciones, dichas como riesgo que valora el fisioterapeuta", () => {
    const flagged = texts("manipulacion", { redFlags: ["Dolor nocturno que no cede con el reposo"] });
    expect(flagged).toContain("dolor nocturno que no cede con el reposo");
    expect(flagged).toContain("valorará con usted");
    expect(texts("manipulacion", { precautions: ["cervical_vascular"], regions: ["lumbar"] })).toMatch(/manipular el cuello tiene más riesgo/);
    expect(texts("manipulacion", { precautions: ["reuma"] })).toMatch(/enfermedad reumática inflamatoria/);
    expect(texts("manipulacion", { precautions: ["osteoporosis"] })).toMatch(/valorará con usted si se aplican o se usan técnicas suaves/);
  });

  it("manipulación: aviso si es el cuello; la edad sola no añade nada", () => {
    expect(texts("manipulacion", { regions: ["cervical"] })).toMatch(/arteria/);
    expect(texts("manipulacion", { regions: ["lumbar"] })).toBe("");
    expect(texts("manipulacion", { age: 70 })).toBe("");
    expect(texts("manipulacion", { age: 64 })).toBe("");
  });

  it("invasiva: neumotórax en cuello, espalda alta u hombro", () => {
    for (const region of ["cervical", "dorsal", "hombro"]) expect(texts("invasiva", { regions: [region] }), region).toMatch(/neumotórax/);
    expect(texts("invasiva", { regions: ["lumbar", "rodilla"] })).not.toMatch(/neumotórax/);
  });

  it("invasiva y embarazo: el mismo texto en cualquier zona, y lo valora el fisioterapeuta", () => {
    for (const regions of [["lumbar"], ["sacroiliaca"], ["hombro"]]) {
      const t = texts("invasiva", { precautions: ["embarazo"], regions });
      expect(t, regions.join()).toMatch(/en general no se pincha la zona lumbar/);
      expect(t, regions.join()).toMatch(/lo valorará con usted/);
    }
  });

  it("aparatos en menores: cartílagos de crecimiento", () => {
    expect(texts("electroterapia", { age: 15 })).toMatch(/cartílagos de crecimiento/);
    expect(texts("electroterapia", { age: 18 })).toBe("");
  });

  it("suelo pélvico y embarazo: con su médico o matrona", () => {
    const r = tpl("suelo_pelvico").personal(ctx({ precautions: ["embarazo"] }));
    expect(r).toHaveLength(1);
    expect(r[0].text).toMatch(/médico o matrona/);
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

  it("los textos van en segunda persona, sin huecos y en una o dos frases", () => {
    const full = ctx({
      age: 70,
      sex: "male",
      regions: ["cervical", "dorsal", "lumbar"],
      precautions: PRECAUTIONS.map((p) => p.id),
      redFlags: ["Pérdida de peso sin explicación", "Alteración de esfínteres o anestesia en silla de montar"],
    });
    for (const t of TEMPLATES) {
      for (const r of t.personal(full)) {
        expect(r.text, t.id).toMatch(/^(Como |Nos ha comentado[: ]|En su caso)/);
        expect(r.text, t.id).not.toMatch(/undefined|null|\$\{/);
        expect(r.text.endsWith("."), r.text).toBe(true);
        expect(r.text.split(". ").length, r.text).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("buildSections", () => {
  const ORDER = ["Qué es", "Riesgos", "En su caso, según su historia", "Cuándo no se aplica", "Alternativas"];

  it("cinco apartados como mucho, en orden; el personal solo si hay algo", () => {
    for (const t of TEMPLATES) {
      const s = buildSections(t, ctx(), []);
      expect(s.map((x) => x.title), t.id).toEqual(ORDER.filter((x) => x !== "En su caso, según su historia"));
      for (const x of s) expect(x.items.length, `${t.id}: ${x.title}`).toBeGreaterThan(0);
    }
    const s = buildSections(tpl("invasiva"), ctx({ precautions: ["anticoagulantes"], detected: [{ precaution: "diabetes", word: "diabetes" }] }), []);
    expect(s.map((x) => x.title)).toEqual(ORDER);
    expect(s[2].items).toHaveLength(1);
    expect(s[2].items[0]).toMatch(/anticoagulantes/);
  });

  it("qué es: la descripción y, si se marcan, las técnicas", () => {
    const t = tpl("invasiva");
    expect(buildSections(t, ctx(), [])[0].items).toEqual(t.description);
    const items = buildSections(t, ctx(), ["puncion_seca", "neuromodulacion"])[0].items;
    expect(items).toHaveLength(t.description.length + 1);
    expect(items.at(-1)).toBe("En su caso: punción seca; neuromodulación percutánea.");
    // Las siglas se quedan en mayúsculas.
    expect(buildSections(tpl("electroterapia"), ctx(), ["tens"])[0].items.at(-1)).toMatch(/: TENS y electroestimulación\.$/);
  });

  it("los riesgos graves dicen qué hacer", () => {
    expect(tpl("invasiva").risks.join("\n")).toMatch(/neumotórax.*urgencias/);
    expect(tpl("manipulacion").risks.join("\n")).toMatch(/ictus.*112/);
  });

  it("el documento no comparte arrays con la plantilla", () => {
    const t = tpl("general");
    const before = [...t.risks];
    buildSections(t, ctx(), [])[1].items.push("cambiado");
    expect(t.risks).toEqual(before);
  });
});
