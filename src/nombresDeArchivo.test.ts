// Dos archivos cuyo nombre solo cambia en mayúsculas (BodyMap.tsx y bodyMap.ts) conviven en Linux, pero en un Mac o
// en Windows el sistema los confunde y la app no compila. Pasó el 24-10-2026 con la prueba de Safari en un Mac, y otra
// vez el 29-10-2026 con DocSync.tsx y docSync.ts: el nombre completo cambia, pero se importan igual («./docSync»).
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", ".git", "dist", "test-results", "playwright-report", ".claude"]);

function* walk(dir: string, rel = ""): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = rel ? `${rel}/${entry.name}` : entry.name;
    yield path;
    if (entry.isDirectory()) yield* walk(join(dir, entry.name), path);
  }
}

describe("nombres de archivo", () => {
  it("no hay dos que solo se distingan en mayúsculas (en Mac y Windows serían el mismo)", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const path of walk(ROOT)) {
      const key = path.toLowerCase();
      const other = seen.get(key);
      if (other && other !== path) clashes.push(`${other} ↔ ${path}`);
      seen.set(key, path);
    }
    expect(clashes).toEqual([]);
  });
  it("ni dos módulos que se importen igual salvo mayúsculas (sin la extensión: .ts, .tsx…)", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const path of walk(ROOT)) {
      const m = /^(.*)\.(ts|tsx|js|jsx|mjs|cjs)$/.exec(path);
      if (!m) continue;
      const key = m[1]!.toLowerCase();
      const other = seen.get(key);
      if (other && other.replace(/\.[^.]+$/, "") !== m[1]) clashes.push(`${other} ↔ ${path}`);
      seen.set(key, path);
    }
    expect(clashes).toEqual([]);
  });
});
