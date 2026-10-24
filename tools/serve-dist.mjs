// Sirve dist/ como lo hará el alojamiento, para que las pruebas e2e vean lo mismo que el móvil:
// - por defecto, como Cloudflare: aplica public/_headers (CSP incluida) y devuelve index.html en
//   cualquier ruta ("not_found_handling: single-page-application" de wrangler.jsonc);
// - con GHPAGES=1, como GitHub Pages: sin cabeceras propias, la app bajo BASE (p. ej. /Fisiolab/)
//   y las rutas desconocidas con 404.html y estado 404.
// Con SIN_GOOGLE=1, cloud.json sin ID de Google: la app sin cuenta. Las pruebas lo cambian en el navegador, pero en
// WebKit lo que pide el service worker no pasa por ahí (y traería el de verdad).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../dist/", import.meta.url).pathname;
const port = Number(process.env.PORT ?? 4173);
const base = process.env.BASE ?? "/";
const ghPages = process.env.GHPAGES === "1";
const noGoogle = process.env.SIN_GOOGLE === "1";
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
const rules = ghPages ? [] : await loadHeaders();

async function exists(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

createServer(async (req, res) => {
  const full = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!full.startsWith(base) && full + "/" !== base) return res.writeHead(404).end("Fuera de la app");
  const path = "/" + full.slice(base.length);
  if (noGoogle && path === "/cloud.json") return res.writeHead(200, { "Content-Type": "application/json" }).end('{"googleClientId":""}');
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  if (path.endsWith("/")) file = join(file, "index.html");
  let status = 200;
  if (!(await exists(file))) {
    if (ghPages) {
      file = join(root, "404.html");
      status = 404;
    } else {
      file = join(root, "index.html"); // aplicación de una sola página
    }
  }
  const served = "/" + file.slice(root.length);
  for (const r of rules) if (matches(r.pattern, path) || matches(r.pattern, served)) for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
  try {
    const body = await readFile(file);
    res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
    res.writeHead(status).end(body);
  } catch {
    res.writeHead(404).end("No encontrado");
  }
}).listen(port, () => console.log(`dist en http://localhost:${port}${base}${ghPages ? " (modo GitHub Pages)" : " con _headers"}`));
