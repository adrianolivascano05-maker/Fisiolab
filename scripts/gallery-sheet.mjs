// Hoja de contacto de las ilustraciones de la galería de tests, para revisarlas de un vistazo.
// Uso: node scripts/gallery-sheet.mjs <salida.png> [región | --samples]
import { createRequire } from "node:module";
import { readdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [out = "gallery-sheet.png", region] = process.argv.slice(2);
const { renderFigure } = await import(pathToFileURL("src/gallery/figure.ts").href);
let items;
if (region === "--samples") items = (await import(pathToFileURL("scripts/gallery-samples.mjs").href)).samples;
else {
  const tests = [];
  for (const f of readdirSync("src/gallery/data").filter((f) => f.endsWith(".ts") && f !== "index.ts")) {
    const mod = await import(pathToFileURL(`src/gallery/data/${f}`).href);
    for (const v of Object.values(mod)) if (Array.isArray(v)) tests.push(...v);
  }
  items = tests.filter((t) => !region || t.region === region).flatMap((t) => t.figures.map((f, i) => ({ name: `${t.name}${t.figures.length > 1 ? ` (${i + 1})` : ""}`, spec: f })));
}
const cells = items.map((it, i) => `<figure><div>${renderFigure(it.spec, it.name, String(i))}</div><figcaption>${it.name}</figcaption></figure>`).join("");
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:8px;font:12px system-ui;display:grid;grid-template-columns:repeat(4,240px);gap:8px}figure{margin:0;border:1px solid #ddd;border-radius:6px;padding:4px}svg{width:230px;height:172px}figcaption{height:28px;overflow:hidden}</style>${cells}`;
writeFileSync(out.replace(/\.png$/, ".html"), html);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 800 } });
await p.setContent(html);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log(`${items.length} figuras → ${out}`);
