// Rehace la tabla de cámaras de la galería 3D (src/gallery/three/cameras.json).
// Uso: con el servidor de desarrollo en marcha (npx vite --port 5199), node scripts/gallery3d-cameras.mjs [ids,separados,por,comas]
// Con ids, solo rehace las cámaras de esos tests y conserva las demás (y quita las de figuras que ya no existen).
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ids = process.argv[2] ?? "";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
p.on("pageerror", (e) => console.log("pageerror:", e.message));
// Mismo tamaño y proporción (4:3) que en la app.
await p.goto(`http://localhost:5199/scripts/gallery3d.html?cameras&w=400${ids ? `&ids=${ids}` : ""}`, { waitUntil: "commit" });
await p.waitForFunction(() => window.done !== undefined, null, { timeout: 1800000 });
const cams = await p.evaluate(() => window.cameras);
const keys = new Set(await p.evaluate(() => window.allKeys));
const prev = ids && existsSync("src/gallery/three/cameras.json") ? JSON.parse(readFileSync("src/gallery/three/cameras.json", "utf8")) : {};
const all = Object.fromEntries(Object.entries({ ...prev, ...cams }).filter(([k]) => keys.has(k)));
const sorted = Object.fromEntries(Object.entries(all).sort(([a], [b2]) => a.localeCompare(b2)));
writeFileSync("src/gallery/three/cameras.json", JSON.stringify(sorted, null, 0).replace(/\],"/g, '],\n"') + "\n");
console.log("cámaras:", Object.keys(sorted).length, "rehechas:", Object.keys(cams).length);
await b.close();
