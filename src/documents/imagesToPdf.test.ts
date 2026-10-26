import { describe, expect, it } from "vitest";
import { imagesToPdf } from "./imagesToPdf";

const text = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

describe("fotos a PDF", () => {
  it("una página por foto, con la foto tal cual y el índice apuntando a cada objeto", () => {
    const fake = (n: number) => Uint8Array.from({ length: 50 + n }, (_, i) => (i * 7 + n) % 256);
    const pdf = imagesToPdf([
      { bytes: fake(1), width: 1200, height: 1600 },
      { bytes: fake(2), width: 1600, height: 900 },
    ]);
    const t = text(pdf);
    expect(t.startsWith("%PDF-1.4")).toBe(true);
    expect(t).toContain("/Count 2");
    expect(t).toContain("/MediaBox [0 0 595 793]");
    expect(t).toContain("/MediaBox [0 0 595 335]");
    expect(t).toContain("/Width 1200 /Height 1600");
    // Los bytes de cada foto están dentro, sin cambiar.
    expect(t).toContain(text(fake(1)));
    expect(t).toContain(text(fake(2)));
    // Cada entrada del índice apunta al principio de su objeto.
    const startxref = Number(/startxref\n(\d+)/.exec(t)![1]);
    const xref = t.slice(startxref);
    const entries = [...xref.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(8);
    entries.forEach((offset, i) => expect(t.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true));
    expect(t.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("sin fotos no hay PDF", () => {
    expect(() => imagesToPdf([])).toThrow();
  });
});
