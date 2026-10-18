// Auditoría de choques de todas las figuras 3D a lo largo de la animación. Uso: node scripts/gallery3d-audit.mjs [filtro]
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

const filter = process.argv[2] ?? "";
const dir = mkdtempSync(join(tmpdir(), "audit-"));
const entry = `
import { parentPort, workerData } from "node:worker_threads";
import { tests } from "./src/gallery/data";
import { auditFigure } from "./src/gallery/three/audit";
import { planExaminer } from "./src/gallery/three/examiner";
import { layoutPatient } from "./src/gallery/three/layout";
const figs = tests.flatMap((t) => t.figures.map((f, i) => ({ id: t.id + (t.figures.length > 1 ? "#" + i : ""), f }))).filter((x) => x.id.includes(workerData.filter));
const out = [];
figs.forEach(({ id, f }, i) => {
  if (i % workerData.n !== workerData.k) return;
  const L = layoutPatient(f);
  const plan = f.hands?.length ? planExaminer(f, L, workerData.fresh) : null;
  out.push({ id, issues: auditFigure(f, L, plan) });
});
parentPort.postMessage(out);
`;
await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", outfile: join(dir, "w.mjs"), logLevel: "error" });
const n = Math.max(1, availableParallelism() - 1);
const parts = await Promise.all(
  Array.from({ length: n }, (_, k) => new Promise((ok, ko) => {
    const w = new Worker(new URL(pathToFileURL(join(dir, "w.mjs"))), { workerData: { n, k, filter, fresh: !!process.env.FRESH } });
    w.on("message", ok);
    w.on("error", ko);
  })),
);
rmSync(dir, { recursive: true, force: true });
const all = parts.flat().sort((a, b) => a.id.localeCompare(b.id));
let bad = 0;
const kinds = new Map();
for (const { id, issues } of all) {
  if (!issues.length) continue;
  bad++;
  console.log(id);
  for (const is of issues.slice(0, process.env.ALL ? 99 : 4)) {
    console.log(`   ${is.depth.toFixed(1).padStart(5)} cm  t=${is.t.toFixed(3)}  ${is.what}`);
    const k = is.what.replace(/[rl]_/g, "").replace(/ dentro de (su )?.*/, " → $1" + is.what.split(" dentro de ")[1]?.replace(/[rl]_/g, ""));
    kinds.set(k, (kinds.get(k) ?? 0) + 1);
  }
}
console.log(`\nfiguras con choques: ${bad} de ${all.length}`);
for (const [k, v] of [...kinds].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(String(v).padStart(4), k);
