// Fotos (JPEG) a un PDF de una página por foto, sin librerías: cada foto va tal cual (DCTDecode) en una página del
// ancho de un A4 y la altura que le toque. Lo usan la ficha (Añadir archivo) y la página del paciente.

export type JpegImage = { bytes: Uint8Array; width: number; height: number };

/** Ancho de la página: el de un A4, en puntos. */
const PAGE_WIDTH = 595;

export function imagesToPdf(images: JpegImage[]): Uint8Array {
  if (!images.length) throw new Error("No hay fotos.");
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (p: string | Uint8Array) => {
    const bytes = typeof p === "string" ? enc.encode(p) : p;
    parts.push(bytes);
    length += bytes.byteLength;
  };
  const object = (n: number, body: string) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };

  push("%PDF-1.4\n%âãÏÓ\n");
  // 1: catálogo; 2: páginas; y por cada foto, su página (3 + 3i), su contenido y la imagen.
  const pageIds = images.map((_, i) => 3 + 3 * i);
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(" ")}] /Count ${images.length} >>`);
  images.forEach((img, i) => {
    const page = pageIds[i]!;
    const height = Math.max(1, Math.round((PAGE_WIDTH * img.height) / img.width));
    const draw = `q ${PAGE_WIDTH} 0 0 ${height} 0 0 cm /Im0 Do Q`;
    object(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${height}] /Resources << /XObject << /Im0 ${page + 2} 0 R >> >> /Contents ${page + 1} 0 R >>`);
    object(page + 1, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
    offsets[page + 2] = length;
    push(`${page + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.byteLength} >>\nstream\n`);
    push(img.bytes);
    push("\nendstream\nendobj\n");
  });

  const count = 3 + 3 * images.length;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}
