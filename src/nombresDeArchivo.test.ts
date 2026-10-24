// Dos archivos cuyo nombre solo cambia en mayúsculas (BodyMap.tsx y bodyMap.ts) conviven en Linux, pero en un Mac o
// en Windows el sistema los confunde y la app no compila. Pasó el 24-10-2026 con la prueba de Safari en un Mac.
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
});
