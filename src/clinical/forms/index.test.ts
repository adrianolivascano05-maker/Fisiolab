import { describe, expect, it } from "vitest";
import { ACTIVE, QUESTIONNAIRES } from "../questionnaires";
import { citeOf, formFor, WORKING_TRANSLATION } from ".";

describe("cuestionarios enteros", () => {
  it("todos los que se pueden pasar (salvo PSFS, cambio global y mapa del dolor, que tienen su pantalla) y no son de solo nota se rellenan enteros en la app", () => {
    for (const k of ACTIVE.filter((q) => !q.inApp && !q.scoreOnly)) expect(formFor(k.id), k.id).toBeDefined();
  });
  it("los de solo nota no llevan preguntas y dicen dónde está su hoja oficial o a quién pedirla, con su cita", () => {
    for (const k of QUESTIONNAIRES.filter((q) => q.scoreOnly)) {
      expect(formFor(k.id), k.id).toBeUndefined();
      expect(k.link?.label, k.id).toBeTruthy();
      expect(k.refs, k.id).toBeTruthy();
      if (k.link?.url) expect(k.link.url, k.id).toMatch(/^https:\/\//);
    }
  });
  it("los de pago están fuera del servicio: sin preguntas, sin enlace y fuera de lo que se puede pasar", () => {
    for (const k of QUESTIONNAIRES.filter((q) => q.retired)) {
      expect(formFor(k.id), k.id).toBeUndefined();
      expect(ACTIVE, k.id).not.toContain(k);
    }
  });
  it("cada uno está donde dice la revisión legal (29-10-2026)", () => {
    const ids = (f: (k: (typeof QUESTIONNAIRES)[number]) => boolean) =>
      QUESTIONNAIRES.filter(f)
        .map((k) => k.id)
        .sort();
    expect(ids((k) => !!k.retired)).toEqual(
      "koos hoos koos12 hoos12 faos oks ohs oss oes womac hit6 tsk11 dn4 ihot12 hagos wosi worc msws_12 zcq pseq fss abc s_lanss lefs uefi prtee ffi sirsi visa_a visa_p visa_g fabq dhi wdq ears ompsq10 bq_lumbar bq_cuello start_msk dash bipq"
        .split(" ")
        .sort(),
    );
    expect(ids((k) => !!k.scoreOnly && !k.retired)).toEqual(
      "quickdash odi ndi sbst ikdc rmdq pss10 promis_10 iciq_ui_sf eq5d5l cat midas cpaq8 back_paq10 pcs isi bpi_sf paindetect csi spadi pgq prwe rnpq acl_rsi alr_rsi ostrc_h2"
        .split(" ")
        .sort(),
    );
  });
  it("ids únicos y rangos coherentes; cada formulario es de un cuestionario del catálogo", () => {
    const ids = QUESTIONNAIRES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const k of QUESTIONNAIRES) {
      expect(k.min, k.id).toBeLessThan(k.max);
      // Rangos publicados: dentro del rango de la nota, seguidos y con su cita.
      if (!k.ranges) continue;
      expect(k.ranges.cite, k.id).toMatch(/\d{4}/);
      const rows = k.ranges.rows;
      expect(rows[0]!.from, k.id).toBeGreaterThanOrEqual(k.min);
      expect(rows.at(-1)!.to, k.id).toBe(k.max);
      for (let i = 1; i < rows.length; i++) expect(rows[i]!.from, k.id).toBe(rows[i - 1]!.to + 1);
    }
  });
  it("cada pregunta tiene su texto y cada respuesta dice algo más que un número", () => {
    for (const k of ACTIVE.filter((q) => !q.inApp && !q.scoreOnly)) {
      const f = formFor(k.id)!;
      const ids = new Set<string>();
      for (const item of f.sections.flatMap((s) => s.items)) {
        expect(ids.has(item.id), `${k.id} ${item.id} repetido`).toBe(false);
        ids.add(item.id);
        expect(item.text.trim().length, `${k.id} ${item.id}`).toBeGreaterThan(3);
        expect(item.text, `${k.id} ${item.id}`).not.toMatch(/^Pregunta \d+$|^Afirmación \d+$/);
        for (const o of item.options ?? []) expect(o.label, `${k.id} ${item.id}`).toMatch(/[a-záéíóúñ]/i);
        expect(!!(item.options?.length || item.scale || item.input), `${k.id} ${item.id} sin respuestas`).toBe(true);
      }
    }
  });
  it("las subescalas que se guardan aparte son las del catálogo", () => {
    for (const k of ACTIVE.filter((q) => q.subscales && !q.scoreOnly)) {
      const f = formFor(k.id)!;
      const all = Object.fromEntries(f.sections.flatMap((s) => s.items).map((i) => [i.id, i.options?.[0]?.value ?? i.scale?.from ?? i.input?.min ?? 0]));
      const r = f.score(all);
      for (const sub of r.subscores ?? []) expect(k.subscales, `${k.id}: ${sub.name}`).toContain(sub.name);
    }
  });
});

describe("cita y traducción", () => {
  it("cada uno que se rellena en la app tiene la cita de sus autores, sin la nota de texto de trabajo", () => {
    for (const k of ACTIVE.filter((q) => !q.inApp && !q.scoreOnly)) {
      const cite = citeOf(formFor(k.id)!);
      expect(cite.length, k.id).toBeGreaterThan(10);
      expect(cite, k.id).toMatch(/\d{4}/);
      expect(cite, k.id).not.toMatch(/Texto de trabajo/);
    }
  });
  it("el aviso de la traducción no dice que esté validada", () => {
    expect(WORKING_TRANSLATION).toMatch(/no se ha comprobado/);
  });
});
