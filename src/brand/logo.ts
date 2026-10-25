// El logo que sube la clínica: se reduce y se guarda como data: URL (brand.ts), y de él se sacan dos colores para
// proponerlos. Solo en el navegador (canvas e Image).
import { fromLch, toLch } from "./engine";

/** Lado máximo del PNG guardado: de sobra para la barra (34 px), los documentos y el favicon. */
const MAX_SIDE = 512;
const MAX_SVG_BYTES = 60_000;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => fail(new Error("No se ha podido leer el archivo."));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error("Ese archivo no es una imagen que el navegador sepa abrir."));
    img.src = src;
  });
}

/**
 * Prepara el logo para guardarlo: un SVG pequeño va tal cual (como imagen no puede ejecutar nada); un PNG (o JPG,
 * WebP…) se reduce a 512 px y se guarda como PNG con su transparencia.
 */
export async function prepareLogo(file: File): Promise<string> {
  if (file.type === "image/svg+xml") {
    if (file.size > MAX_SVG_BYTES) throw new Error(`El SVG pesa demasiado (máximo ${Math.round(MAX_SVG_BYTES / 1000)} KB).`);
    const text = await file.text();
    if (/<script|on\w+\s*=|<foreignObject|href\s*=\s*["']\s*(?!#|data:image)/i.test(text)) throw new Error("Ese SVG lleva código o enlaces externos: exporta el logo como PNG.");
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  }
  if (!file.type.startsWith("image/")) throw new Error("Sube el logo como PNG o SVG.");
  const img = await loadImage(await readAsDataUrl(file));
  const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

/**
 * Los dos colores más presentes y vivos del logo (por matiz, dejando fuera blancos, negros y grises), para
 * proponerlos como principal y de acento. Puede devolver uno o ninguno (un logo en blanco y negro).
 */
export async function logoColors(dataUrl: string): Promise<string[]> {
  const img = await loadImage(dataUrl);
  const S = 64;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0, S, S);
  const d = x.getImageData(0, 0, S, S).data;
  const buckets = new Map<number, { n: number; L: number; C: number; h: number }>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 128) continue;
    const hex = `#${[d[i]!, d[i + 1]!, d[i + 2]!].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    const { L, C, h } = toLch(hex);
    if (C < 0.04 || L < 0.12 || L > 0.95) continue;
    const key = Math.round(h / 20) % 18;
    const b = buckets.get(key) ?? { n: 0, L: 0, C: 0, h: 0 };
    b.n++;
    b.L += L;
    b.C += C;
    b.h += h;
    buckets.set(key, b);
  }
  return [...buckets.values()]
    .sort((a, b) => b.n * b.C - a.n * a.C)
    .slice(0, 2)
    .map((b) => fromLch({ L: b.L / b.n, C: b.C / b.n, h: b.h / b.n }));
}
