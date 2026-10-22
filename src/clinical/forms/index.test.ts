import { describe, expect, it } from "vitest";
import { QUESTIONNAIRES } from "../questionnaires";
import { formFor } from ".";

describe("cuestionarios enteros", () => {
  it("todos los del catálogo (salvo PSFS y cambio global, que tienen su pantalla) se rellenan enteros en la app", () => {
    for (const k of QUESTIONNAIRES.filter((q) => !q.inApp && !q.scoreOnly)) expect(formFor(k.id), k.id).toBeDefined();
  });
  it("los de solo nota no llevan preguntas, y los de pago son de solo nota", () => {
    for (const k of QUESTIONNAIRES.filter((q) => q.scoreOnly || q.license === "licencia")) {
      expect(k.scoreOnly, k.id).toBe(true);
      expect(formFor(k.id), k.id).toBeUndefined();
    }
  });
  it("ids únicos y rangos coherentes; cada formulario es de un cuestionario del catálogo", () => {
    const ids = QUESTIONNAIRES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const k of QUESTIONNAIRES) {
      expect(k.min, k.id).toBeLessThan(k.max);
      let prev = -Infinity;
      for (const b of k.bands ?? []) {
        expect(b.upTo, k.id).toBeGreaterThan(prev);
        prev = b.upTo;
      }
    }
  });
  it("cada pregunta tiene su texto y cada respuesta dice algo más que un número", () => {
    for (const k of QUESTIONNAIRES.filter((q) => !q.inApp && !q.scoreOnly)) {
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
    for (const k of QUESTIONNAIRES.filter((q) => q.subscales && !q.scoreOnly)) {
      const f = formFor(k.id)!;
      const all = Object.fromEntries(f.sections.flatMap((s) => s.items).map((i) => [i.id, i.options?.[0]?.value ?? i.scale?.from ?? i.input?.min ?? 0]));
      const r = f.score(all);
      for (const sub of r.subscores ?? []) expect(k.subscales, `${k.id}: ${sub.name}`).toContain(sub.name);
    }
  });
});
