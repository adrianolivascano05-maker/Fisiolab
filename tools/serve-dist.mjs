// Sirve dist/ como lo hará el alojamiento: aplica public/_headers (CSP incluida) y devuelve index.html
// en cualquier ruta, como "not_found_handling: single-page-application" de wrangler.jsonc.
// Lo usan las pruebas e2e para detectar antes de publicar lo que la CSP o las rutas romperían.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../dist/", import.meta.url).pathname;
const port = Number(process.env.PORT ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};

/** Reglas de _headers: [{ pattern, headers }], en orden. */
async function loadHeaders() {
  const rules = [];
  let current = null;
  for (const line of (await readFile(join(root, "_headers"), "utf8")).split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: {} };
      rules.push(current);
    } else if (current) {
      const i = line.indexOf(":");
      current.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return rules;
}

const matches = (pattern, path) => (pattern.endsWith("*") ? path.startsWith(pattern.slice(0, -1)) : path === pattern);
const rules = await loadHeaders();

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(root, "index.html"); // aplicación de una sola página
  }
  const served = "/" + file.slice(root.length);
  for (const r of rules) if (matches(r.pattern, path) || matches(r.pattern, served)) for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
  try {
    const body = await readFile(file);
    res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
    res.writeHead(200).end(body);
  } catch {
    res.writeHead(404).end("No encontrado");
  }
}).listen(port, () => console.log(`dist en http://localhost:${port} con _headers y _redirects`));
