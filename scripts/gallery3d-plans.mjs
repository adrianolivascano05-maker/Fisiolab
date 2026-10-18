// Rehace la tabla de colocaciones del examinador de la galería 3D (src/gallery/three/plans.json).
// Buscar dónde se pone y cómo mueve los brazos sin chocar con nada en ningún instante cuesta segundos por
// figura; la tabla lo deja hecho. Uso: node scripts/gallery3d-plans.mjs [filtro de tests] (con filtro —ids separados por comas—, solo
// rehace esas figuras y conserva las demás; después, rehacer las cámaras).
import { build } from "esbuild";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

const filter = process.argv[2] ?? "";
const dir = mkdtempSync(join(tmpdir(), "plans-"));
const entry = `
import { parentPort, workerData } from "node:worker_threads";
import { tests } from "./src/gallery/data";
import { planKey } from "./src/gallery/three/cameras";
import { packPlan, planExaminer } from "./src/gallery/three/examiner";
import { polishPlan } from "./src/gallery/three/polish";
import { layoutPatient } from "./src/gallery/three/layout";
const figs = tests.filter((t) => workerData.filter.split(",").some((x) => t.id.includes(x))).flatMap((t) => t.figures).filter((f) => f.hands?.length && f.examiner !== "none");
const out = {};
figs.forEach((f, i) => {
  if (i % workerData.n !== workerData.k) return;
  const L = layoutPatient(f);
  const plan = planExaminer(f, L, true);
  // Repaso con la animación de verdad: si algo choca en algún instante, se prueban variantes de los brazos.
  if (plan) out[planKey(f)] = packPlan(polishPlan(f, L, plan));
});
// Las claves de todas las figuras (para quitar de la tabla las de figuras que ya no existen o han cambiado).
const keys = workerData.k === 0 ? tests.flatMap((t) => t.figures).filter((f) => f.hands?.length && f.examiner !== "none").map(planKey) : [];
parentPort.postMessage({ out, keys });
`;
await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", outfile: join(dir, "w.mjs"), logLevel: "error" });
const n = Math.max(1, availableParallelism() - 1);
const parts = await Promise.all(
  Array.from({ length: n }, (_, k) => new Promise((ok, ko) => {
    const w = new Worker(new URL(pathToFileURL(join(dir, "w.mjs"))), { workerData: { n, k, filter } });
    w.on("message", ok);
    w.on("error", ko);
  })),
);
rmSync(dir, { recursive: true, force: true });
const prev = filter && existsSync("src/gallery/three/plans.json") ? JSON.parse(readFileSync("src/gallery/three/plans.json", "utf8")) : {};
const current = new Set(parts.flatMap((p) => p.keys));
const all = Object.fromEntries(Object.entries(Object.assign(prev, ...parts.map((p) => p.out))).filter(([k]) => current.has(k)));
const sorted = Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync("src/gallery/three/plans.json", JSON.stringify(sorted).replace(/\},"/g, '},\n"') + "\n");
console.log("colocaciones:", Object.keys(sorted).length);
