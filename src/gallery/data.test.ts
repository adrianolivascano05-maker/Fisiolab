import { describe, expect, it } from "vitest";
import { tests } from "./data";
import { renderFigure } from "./figure";
import { verified } from "./GalleryPages";
import { regions } from "./regions";

describe("contenido de la galería", () => {
  it("ids únicos, enlaces válidos y campos completos", () => {
    const ids = tests.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of tests) {
      expect(regions.some((r) => r.id === t.region), t.id).toBe(true);
      for (const r of t.related ?? []) expect(ids, `${t.id} → ${r}`).toContain(r);
      expect(t.steps.length, t.id).toBeGreaterThan(0);
      expect(t.figures.length, t.id).toBeGreaterThan(0);
      for (const a of t.accuracy) {
        for (const v of [a.sens, a.spec]) if (v !== undefined) expect(v >= 0 && v <= 100, `${t.id} ${v}`).toBe(true);
        for (const v of [a.lrPos, a.lrNeg]) if (v !== undefined) expect(v > 0, `${t.id} ${v}`).toBe(true);
        expect(a.source.length, t.id).toBeGreaterThan(0);
      }
    }
  });

  it("cada figura se dibuja", () => {
    for (const t of tests) for (const f of t.figures) expect(renderFigure(f, t.name)).toMatch(/^<svg .*<\/svg>$/s);
  });

  it("cuenta de contrastados", () => {
    const n = tests.filter(verified).length;
    expect(n).toBeGreaterThan(tests.length / 2);
  });
});
