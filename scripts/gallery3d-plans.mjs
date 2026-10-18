// Rehace la tabla de colocaciones del examinador de la galería 3D (src/gallery/three/plans.json).
// Buscar dónde se pone sin chocar con el paciente ni con la camilla cuesta segundos por figura; la tabla
// lo deja hecho. Uso: node scripts/gallery3d-plans.mjs (después, rehacer las cámaras).
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

const dir = mkdtempSync(join(tmpdir(), "plans-"));
const entry = `
import { parentPort, workerData } from "node:worker_threads";
import { tests } from "./src/gallery/data";
import { cameraKey } from "./src/gallery/three/cameras";
import { packPlan, planExaminer } from "./src/gallery/three/examiner";
import { layoutPatient, patientPose } from "./src/gallery/three/layout";
const figs = tests.flatMap((t) => t.figures).filter((f) => f.hands?.length && f.examiner !== "none");
const out = {};
figs.forEach((f, i) => {
  if (i % workerData.n !== workerData.k) return;
  const L = layoutPatient(f);
  const poses = [0, 0.5, 1].map((m) => patientPose(L, m, 0));
  const plan = planExaminer(f, poses, L.table, true);
  if (plan) out[cameraKey(f)] = packPlan(plan);
});
parentPort.postMessage(out);
`;
await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", outfile: join(dir, "w.mjs"), logLevel: "error" });
const n = Math.max(1, availableParallelism() - 1);
const parts = await Promise.all(
  Array.from({ length: n }, (_, k) => new Promise((ok, ko) => {
    const w = new Worker(new URL(pathToFileURL(join(dir, "w.mjs"))), { workerData: { n, k } });
    w.on("message", ok);
    w.on("error", ko);
  })),
);
rmSync(dir, { recursive: true, force: true });
const all = Object.assign({}, ...parts);
const sorted = Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync("src/gallery/three/plans.json", JSON.stringify(sorted).replace(/\},"/g, '},\n"') + "\n");
console.log("colocaciones:", Object.keys(sorted).length);
