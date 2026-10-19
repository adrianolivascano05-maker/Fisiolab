// PDF mínimo hecho a mano: una imagen JPEG por página, en A4 con márgenes. Basta para guardar el informe tal
// como se ve (el texto no se puede seleccionar) sin añadir una librería de PDF. Formato: PDF 1.4, imágenes con
// /DCTDecode (el JPEG va tal cual dentro del PDF).

export type JpegPage = { jpeg: Uint8Array; width: number; height: number };

const A4 = { w: 595.28, h: 841.89 }; // puntos (1/72 de pulgada)
const MM = 72 / 25.4;

export function jpegPdf(pages: JpegPage[], marginMm = 12): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const enc = new TextEncoder();
  const push = (b: Uint8Array) => {
    chunks.push(b);
    size += b.byteLength;
  };
  const text = (s: string) => push(enc.encode(s));
  const obj = (n: number, body: () => void) => {
    offsets[n] = size;
    text(`${n} 0 obj\n`);
    body();
    text("\nendobj\n");
  };

  const margin = marginMm * MM;
  const contentW = A4.w - 2 * margin;
  // 1 catálogo, 2 páginas, y por página: página, contenido e imagen.
  const pageObj = (i: number) => 3 + i * 3;
  text("%PDF-1.4\n%âãÏÓ\n");
  obj(1, () => text("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => text(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] >>`));
  pages.forEach((p, i) => {
    const n = pageObj(i);
    const w = contentW;
    const h = (p.height * contentW) / p.width;
    const draw = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${margin.toFixed(2)} ${(A4.h - margin - h).toFixed(2)} cm /Im0 Do Q`;
    obj(n, () =>
      text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`),
    );
    obj(n + 1, () => text(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
    obj(n + 2, () => {
      text(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.byteLength} >>\nstream\n`);
      push(p.jpeg);
      text("\nendstream");
    });
  });
  const count = 3 + pages.length * 3;
  const xref = size;
  text(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) text(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  text(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}
