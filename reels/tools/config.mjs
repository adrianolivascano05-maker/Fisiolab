// Carga src/config.ts desde Node (sin compilar) y expone las frases aplanadas.
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const ROOT = root;

export async function loadConfig() {
  const mod = await import(pathToFileURL(path.join(root, "src/config.ts")).href);
  return mod;
}

export function sentences(cfg) {
  return cfg.SCENES.flatMap((s) => s.sentences.map((x) => ({ scene: s.id, text: x.text })));
}

/** Duración estimada de una frase (s) a partir de la muestra de referencia:
 *  13,04 s para 205 caracteres ≈ 0,0636 s/carácter, pausas incluidas. */
export function estimateSeconds(text, isLastOfScene) {
  const chars = text.replace(/\s+/g, " ").trim().length;
  let pause = 0.3;
  if (/[:…]|\.\.\./.test(text)) pause += 0.25;
  if (isLastOfScene) pause += 0.2;
  return chars * 0.056 + pause;
}
