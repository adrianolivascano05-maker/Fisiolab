// Rehace la tabla de cámaras de la galería 3D (src/gallery/three/cameras.json).
// Uso: con el servidor de desarrollo en marcha (npx vite --port 5199), node scripts/gallery3d-cameras.mjs
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
p.on("pageerror", (e) => console.log("pageerror:", e.message));
// Mismo tamaño y proporción (4:3) que en la app.
await p.goto("http://localhost:5199/scripts/gallery3d.html?cameras&w=400", { waitUntil: "commit" });
await p.waitForFunction(() => window.done !== undefined, null, { timeout: 900000 });
const cams = await p.evaluate(() => window.cameras);
const sorted = Object.fromEntries(Object.entries(cams).sort(([a], [b2]) => a.localeCompare(b2)));
writeFileSync("src/gallery/three/cameras.json", JSON.stringify(sorted, null, 0).replace(/\],"/g, '],\n"') + "\n");
console.log("cámaras:", Object.keys(sorted).length);
await b.close();
