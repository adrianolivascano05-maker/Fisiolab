import { describe, expect, it } from "vitest";
import { jpegPdf } from "./pdf";

const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join("");

describe("PDF de imágenes", () => {
  it("una página por imagen, con la tabla de referencias apuntando a cada objeto", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const pdf = jpegPdf([
      { jpeg, width: 720, height: 1000 },
      { jpeg, width: 720, height: 400 },
    ]);
    const s = latin1(pdf);
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(s).toContain("/Type /Pages /Count 2 /Kids [3 0 R 6 0 R]");
    expect(s.match(/\/Subtype \/Image/g)).toHaveLength(2);
    // Cada entrada de la tabla xref apunta al inicio de «n 0 obj».
    const xref = Number(/startxref\n(\d+)/.exec(s)![1]);
    const rows = s.slice(xref).split("\n").slice(3, 11);
    rows.forEach((row, i) => {
      const at = Number(row.slice(0, 10));
      expect(s.slice(at, at + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
    // El JPEG va dentro tal cual.
    expect(s).toContain(latin1(jpeg));
  });
});
