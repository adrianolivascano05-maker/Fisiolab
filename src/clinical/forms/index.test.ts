import { describe, expect, it } from "vitest";
import { QUESTIONNAIRES } from "../questionnaires";
import { formFor } from ".";

describe("cuestionarios enteros", () => {
  it("todos los del catálogo (salvo PSFS y cambio global, que tienen su pantalla) se rellenan enteros en la app", () => {
    for (const k of QUESTIONNAIRES.filter((q) => !q.inApp)) expect(formFor(k.id), k.id).toBeDefined();
  });
  it("cada pregunta tiene su texto y cada respuesta dice algo más que un número", () => {
    for (const k of QUESTIONNAIRES.filter((q) => !q.inApp)) {
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
    for (const k of QUESTIONNAIRES.filter((q) => q.subscales)) {
      const f = formFor(k.id)!;
      const all = Object.fromEntries(f.sections.flatMap((s) => s.items).map((i) => [i.id, i.options?.[0]?.value ?? i.scale?.from ?? i.input?.min ?? 0]));
      const r = f.score(all);
      for (const sub of r.subscores ?? []) expect(k.subscales, `${k.id}: ${sub.name}`).toContain(sub.name);
    }
  });
});
