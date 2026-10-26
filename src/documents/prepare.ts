// Lo que se elige para subir (en la ficha o en la página del paciente) pasa a PDF listo para cifrar: los PDF, tal
// cual; las fotos elegidas a la vez, comprimidas en un solo PDF (una página por foto). Nada pasa de 5 MB.
import { MAX_DOC_BYTES } from "../data/documents";
import { imagesToPdf, type JpegImage } from "./imagesToPdf";

export type Prepared = { name: string; bytes: Uint8Array; mime: "application/pdf"; pages?: number };
export type PrepareResult = { ready: Prepared[]; problems: string[] };

/** Tamaño y calidad de las fotos: se prueba el primero y, si el PDF pasa de 5 MB, los siguientes. */
const STEPS = [
  { side: 2000, quality: 0.82 },
  { side: 1600, quality: 0.7 },
  { side: 1200, quality: 0.6 },
];

const isPdfName = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);
/** El nombre sin la extensión. */
export const baseName = (name: string) => name.replace(/\.[a-z0-9]{2,5}$/i, "").trim();

/** Si los bytes son de verdad un PDF (empieza por «%PDF», a veces tras algo de basura). */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

const mb = (bytes: number) => `${(bytes / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;

async function toJpeg(file: File, side: number, quality: number): Promise<JpegImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Este navegador no puede preparar la foto.");
    ctx.fillStyle = "#ffffff"; // las PNG con transparencia, sobre blanco
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("No se ha podido preparar la foto.");
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
  } finally {
    bitmap.close();
  }
}

/** Las fotos en un PDF de 5 MB como mucho, bajando el tamaño si hace falta; null si ni así cabe. */
export async function photosToPdf(files: File[]): Promise<Uint8Array | null> {
  for (const step of STEPS) {
    const images: JpegImage[] = [];
    for (const f of files) images.push(await toJpeg(f, step.side, step.quality));
    const pdf = imagesToPdf(images);
    if (pdf.byteLength <= MAX_DOC_BYTES) return pdf;
  }
  return null;
}

/** `photosName`: el nombre del PDF de las fotos (si no, el de la primera). */
export async function prepareFiles(files: File[], photosName?: string): Promise<PrepareResult> {
  const ready: Prepared[] = [];
  const problems: string[] = [];
  const photos: File[] = [];
  for (const f of files) {
    if (isPdfName(f)) {
      if (f.size > MAX_DOC_BYTES) {
        problems.push(`«${f.name}» ocupa ${mb(f.size)}: el máximo es 5 MB. Prueba a enviarlo en varias partes o como fotos.`);
        continue;
      }
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!looksLikePdf(bytes)) {
        problems.push(`«${f.name}» no es un PDF que se pueda abrir.`);
        continue;
      }
      ready.push({ name: baseName(f.name) || "Documento", bytes, mime: "application/pdf" });
    } else if (isImage(f)) photos.push(f);
    else problems.push(`«${f.name}»: solo se pueden añadir PDF o fotos.`);
  }
  if (photos.length) {
    try {
      const pdf = await photosToPdf(photos);
      if (pdf) ready.push({ name: photosName ?? (baseName(photos[0]!.name) || "Fotos"), bytes: pdf, mime: "application/pdf", pages: photos.length });
      else problems.push(`Las ${photos.length === 1 ? "foto ocupa" : `${photos.length} fotos ocupan`} demasiado incluso comprimidas: prueba con menos fotos cada vez.`);
    } catch {
      problems.push(photos.length === 1 ? "No se ha podido leer la foto: prueba con otra o hazle una captura." : "No se han podido leer las fotos: prueba con otras o hazles una captura.");
    }
  }
  return { ready, problems };
}
