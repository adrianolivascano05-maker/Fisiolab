// Carga src/config.ts desde Node (sin compilar) y expone utilidades de tiempos.
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const ROOT = root;

export async function loadConfig() {
  return import(pathToFileURL(path.join(root, "src/config.ts")).href);
}

/** Peso de cada palabra hablada (caracteres + pausa tras puntuación). */
export function wordWeights(text) {
  const toks = text.split(/\s+/).filter(Boolean);
  return toks.map((tok) => {
    const w = tok.toLowerCase().replace(/[«»"“”¿?¡!,.:;()…]/g, "");
    let pause = 0;
    if (/[,;]$/.test(tok)) pause = 2.5;
    if (/[:]$/.test(tok) || /\.\.\.$|…$/.test(tok)) pause = 5;
    if (/[.?!]["»]?$/.test(tok)) pause = 4;
    return { w, weight: w.length + 1.2 + pause };
  });
}

/** Duración estimada de una frase (s), calibrada con la muestra de referencia (13,04 s / 205 caracteres). */
export function estimateSeconds(text, isLastOfScene) {
  const chars = text.replace(/\s+/g, " ").trim().length;
  let pause = 0.3;
  if (/[:…]|\.\.\./.test(text)) pause += 0.25;
  if (isLastOfScene) pause += 0.2;
  return chars * 0.056 + pause;
}

/** Reparte una ventana [start,end] entre las palabras de la frase.
 *  Si hay `ref` (palabras con tiempos de un transcriptor), usa sus duraciones relativas; si no, los pesos por caracteres. */
export function spreadWords(text, start, end, ref) {
  const ws = wordWeights(text);
  let weights = ws.map((x) => x.weight);
  if (ref && ref.length === ws.length) weights = ref.map((r, i) => Math.max(0.05, r.end - r.start) + (i < ws.length - 1 ? Math.max(0, ref[i + 1].start - r.end) : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = start;
  return ws.map((x, i) => {
    const d = ((end - start) * weights[i]) / total;
    const out = { w: x.w, start: +t.toFixed(3), end: +(t + d * 0.92).toFixed(3) };
    t += d;
    return out;
  });
}
