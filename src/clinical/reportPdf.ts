// El informe en PDF para guardarlo en Drive: se dibuja tal como se ve (html-to-image, que lo pinta el propio
// navegador) al ancho de una hoja A4, se corta en páginas entre bloques (no a mitad de una línea) y se monta el
// PDF con una imagen por página (src/app/pdf.ts).
import { jpegPdf, type JpegPage } from "../app/pdf";
import { currentBrand } from "../brand/brand";
import { watermarkSrc } from "../brand/docs";

/** Ancho del informe al dibujarlo: el de la zona de texto de un A4 con 12 mm de margen, a 96 ppp. */
const A4_WIDTH = 703;
/** Más ancho, si una tabla no cabe (en el PDF se ve todo un poco más pequeño). */
const MAX_WIDTH = 940;
/** Alto de la zona de texto de una página a un ancho dado (A4: 297 × 210 mm, menos los márgenes). */
const pageHeight = (width: number) => Math.floor((width * (297 - 24)) / (210 - 24));
/** Dónde se puede cortar una página: antes de cualquiera de estos. */
const BREAKS = "section, header, h2, h3, tr, li, p, dl > div, figure, .break-inside-avoid";

/**
 * La marca de agua de la clínica (si la tiene activada) como JPEG en gris sobre blanco, para que el PDF la ponga en
 * cada hoja al 7 % (src/app/pdf.ts). null si no toca.
 */
async function watermarkStamp(): Promise<JpegPage | null> {
  const brand = currentBrand();
  if (!brand?.watermark) return null;
  const img = await new Promise<HTMLImageElement | null>((ok) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = watermarkSrc(brand);
  });
  if (!img || !img.naturalWidth) return null;
  const c = document.createElement("canvas");
  c.width = 800;
  c.height = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * 800));
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.filter = "grayscale(1)";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.85));
  return blob ? { jpeg: new Uint8Array(await blob.arrayBuffer()), width: c.width, height: c.height } : null;
}

export async function reportPdf(article: HTMLElement): Promise<Uint8Array> {
  const { toCanvas } = await import("html-to-image");
  const before = article.getAttribute("style");
  // La marca de agua de la pantalla no se captura: el PDF la dibuja en cada página.
  const watermarks = [...article.querySelectorAll<HTMLElement>("[data-watermark]")];
  watermarks.forEach((w) => (w.style.display = "none"));
  const stamp = await watermarkStamp();
  // Como al imprimir: sin borde, sombra ni relleno, y al ancho de la hoja.
  Object.assign(article.style, { width: `${A4_WIDTH}px`, maxWidth: "none", padding: "0", border: "0", boxShadow: "none", borderRadius: "0", background: "#ffffff" });
  // Las tablas anchas se desplazan en pantalla; en papel tienen que verse enteras.
  const regions = [...article.querySelectorAll<HTMLElement>("[role=region]")];
  const overflow = regions.map((r) => r.style.overflow);
  try {
    const widest = Math.max(A4_WIDTH, ...regions.map((r) => r.scrollWidth));
    const WIDTH = Math.min(MAX_WIDTH, widest);
    const PAGE = pageHeight(WIDTH);
    article.style.width = `${WIDTH}px`;
    regions.forEach((r) => (r.style.overflow = "visible"));
    await document.fonts?.ready;
    const top = article.getBoundingClientRect().top;
    const height = Math.ceil(article.scrollHeight);
    const cuts = [...new Set([...article.querySelectorAll(BREAKS)].map((el) => Math.round(el.getBoundingClientRect().top - top)))].sort((a, b) => a - b);
    // Hasta 2 píxeles por punto, sin pasar del lienzo más alto que admite el navegador.
    const ratio = Math.min(2, 30_000 / height);
    const canvas = await toCanvas(article, { pixelRatio: ratio, backgroundColor: "#ffffff", width: WIDTH, height, cacheBust: false });

    const pages: JpegPage[] = [];
    for (let start = 0; start < height - 1; ) {
      let stop = start + PAGE;
      if (stop >= height) stop = height;
      else {
        // El último corte posible en la página, si no deja la página casi vacía.
        const cut = cuts.filter((c) => c > start + PAGE * 0.4 && c <= stop).at(-1);
        if (cut) stop = cut;
      }
      const page = document.createElement("canvas");
      page.width = Math.round(WIDTH * ratio);
      page.height = Math.max(1, Math.round((stop - start) * ratio));
      const ctx = page.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, page.width, page.height);
      ctx.drawImage(canvas, 0, Math.round(start * ratio), page.width, page.height, 0, 0, page.width, page.height);
      const blob = await new Promise<Blob>((ok, fail) => page.toBlob((b) => (b ? ok(b) : fail(new Error("No se pudo dibujar el informe."))), "image/jpeg", 0.9));
      pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: page.width, height: page.height });
      start = stop;
    }
    return jpegPdf(pages, 12, stamp);
  } finally {
    watermarks.forEach((w) => (w.style.display = ""));
    regions.forEach((r, i) => (r.style.overflow = overflow[i]!));
    if (before === null) article.removeAttribute("style");
    else article.setAttribute("style", before);
  }
}
