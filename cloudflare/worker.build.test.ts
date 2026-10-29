// worker.js es un archivo generado (tools/build-worker.mjs) a partir de cloudflare/src/*.js: esta prueba falla si
// alguien cambió un módulo y no volvió a generarlo («npm run worker»), o si editó worker.js a mano.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODULES, buildWorker } from "../tools/build-worker.mjs";

const here = (p: string) => new URL(p, import.meta.url);

describe("worker.js generado", () => {
  it("está al día con cloudflare/src (si falla: npm run worker)", () => {
    expect(readFileSync(here("./worker.js"), "utf8")).toBe(buildWorker());
  });

  it("junta todos los módulos de cloudflare/src, cada uno una vez", () => {
    const files = readdirSync(here("./src/")).filter((f) => f.endsWith(".js")).map((f) => f.slice(0, -3)).sort();
    expect([...MODULES].sort()).toEqual(files);
    expect(new Set(MODULES).size).toBe(MODULES.length);
  });

  it("avisa si dos módulos declaran el mismo nombre o un import no existe", () => {
    const real = (name: string) => readFileSync(here(`./src/${name}.js`), "utf8");
    const dup = (name: string) => (name === "health" ? real(name) + "\nconst json = 1;\n" : real(name));
    expect(() => buildWorker(dup)).toThrow(/«json» está declarado/);
    const bad = (name: string) => (name === "health" ? real(name).replace("import { json, list }", "import { json, lista }") : real(name));
    expect(() => buildWorker(bad)).toThrow(/importa «lista» de util\.js/);
  });
});
