// Captura de la hoja de figuras 3D. Uso: node scripts/gallery3d-shot.mjs <salida.png> "<query>"
// (necesita el servidor de desarrollo en http://localhost:5199).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [out = "g3d.png", query = ""] = process.argv.slice(2);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
p.on("console", (m) => (m.type() === "error" || process.env.DEBUG) && console.log("console:", m.text()));
p.on("pageerror", (e) => console.log("pageerror:", e.message));
await p.goto(`http://localhost:5199/scripts/gallery3d.html?${query}`, { waitUntil: "commit" });
await p.waitForFunction(() => window.done !== undefined, null, { timeout: 600000 });
console.log("figuras:", await p.evaluate(() => window.done));
const times = await p.evaluate(() => window.times);
if (process.env.TIMES) console.log(times.map((t) => t.join(" ")).join("\n"));
const tot = times.reduce((a, t) => a + t[1], 0);
console.log("montaje medio (ms):", Math.round(tot / times.length), "máx:", Math.max(...times.map((t) => t[1])));
await p.screenshot({ path: out, fullPage: true });
await b.close();
