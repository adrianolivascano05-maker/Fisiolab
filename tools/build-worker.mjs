// Junta los módulos de cloudflare/src/*.js en cloudflare/worker.js, el único archivo que se pega en el panel de
// Cloudflare (sin dependencias ni empaquetador). Es una concatenación: quita los `import` y los `export` entre
// módulos y deja todo lo demás tal cual (comentarios y tipos JSDoc incluidos), así que worker.js se lee igual que
// antes. Comprueba que ningún nombre de arriba del todo se repita entre módulos y que cada import exista.
// `node tools/build-worker.mjs` lo escribe; `node tools/build-worker.mjs --check` solo dice si está al día.
// La prueba cloudflare/worker.build.test.ts hace lo mismo que --check.
import { readFileSync, writeFileSync } from "node:fs";

/** El orden de los módulos en worker.js (el de siempre: de las rutas a las utilidades). Cada archivo de src tiene que estar. */
export const MODULES = ["types", "constants", "index", "copy", "copyStore", "clinics", "provider", "forms", "documents", "health", "auth", "util", "contract"];
export const ENTRY = "index";

const NOTICE = [
  "// Generado por «npm run worker» a partir de cloudflare/src/*.js: no lo edites a mano (edita el módulo y vuelve a",
  "// generarlo). Es el archivo que se pega en el panel de Cloudflare (README.md de esta carpeta).",
];

const IMPORT = /^import \{[^}]*\} from "\.\/([\w-]+)\.js";\n/gm;
const TYPEDEF_IMPORT = /^\/\*\* @typedef \{import\("\.\/types\.js"\)\.(\w+)\} \1 \*\/\n/gm;
const DECL = /^export ((?:async )?(?:function|const|let|class) ([A-Za-z_$][\w$]*))/gm;
const TOP_LEVEL = /^(?:export )?(?:async )?(?:function|const|let|class) ([A-Za-z_$][\w$]*)/gm;

/** @param {string} name */
const read = (name) => readFileSync(new URL(`../cloudflare/src/${name}.js`, import.meta.url), "utf8");

/**
 * El contenido de worker.js a partir de los módulos. Lanza un error si un módulo falta, un nombre se repite o un
 * import no está exportado por su módulo.
 * @param {(name: string) => string} [source] de dónde leer cada módulo (para las pruebas)
 */
export function buildWorker(source = read) {
  /** @type {Map<string, string>} */
  const sources = new Map(MODULES.map((m) => [m, source(m)]));
  /** @type {Map<string, string>} nombre de arriba del todo → módulo */
  const owners = new Map();
  /** @type {Map<string, Set<string>>} módulo → lo que exporta */
  const exported = new Map(MODULES.map((m) => [m, new Set()]));
  for (const [mod, text] of sources) {
    if (!text.startsWith("// @ts-check\n")) throw new Error(`cloudflare/src/${mod}.js tiene que empezar por «// @ts-check».`);
    for (const m of text.matchAll(TOP_LEVEL)) {
      const other = owners.get(m[1]);
      if (other) throw new Error(`«${m[1]}» está declarado en cloudflare/src/${other}.js y en ${mod}.js: en worker.js chocarían.`);
      owners.set(m[1], mod);
    }
    for (const m of text.matchAll(DECL)) exported.get(mod)?.add(m[2]);
    if (/^export default\b/m.test(text)) exported.get(mod)?.add("default");
  }
  for (const [mod, text] of sources) {
    for (const m of text.matchAll(IMPORT)) {
      const from = m[1];
      if (!sources.has(from)) throw new Error(`cloudflare/src/${mod}.js importa de «${from}.js», que no está en MODULES (tools/build-worker.mjs).`);
      for (const name of m[0].slice(m[0].indexOf("{") + 1, m[0].indexOf("}")).split(",").map((s) => s.trim()).filter(Boolean)) {
        if (!exported.get(from)?.has(name)) throw new Error(`cloudflare/src/${mod}.js importa «${name}» de ${from}.js, que no lo exporta.`);
      }
    }
  }

  const [header, ...rest] = splitHeader(sources.get(ENTRY) ?? "");
  const parts = [["// @ts-check", ...NOTICE, ...header].join("\n")];
  for (const mod of MODULES) {
    let text = (mod === ENTRY ? rest.join("\n") : (sources.get(mod) ?? "").replace(/^\/\/ @ts-check\n/, "")).replace(IMPORT, "").replace(TYPEDEF_IMPORT, "");
    if (mod === "types") text = text.replace(/\nexport \{\};\n$/, "\n");
    if (mod !== ENTRY) text = text.replace(DECL, "$1");
    parts.push(text.replace(/^\n+/, "").replace(/\n+$/, "\n"));
  }
  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").replace(/\n*$/, "\n");
}

/** Las líneas de comentario con las que empieza el módulo de entrada (la portada de worker.js) y el resto. */
function splitHeader(text) {
  const lines = text.replace(/^\/\/ @ts-check\n/, "").split("\n");
  let i = 0;
  while (i < lines.length && lines[i].startsWith("//")) i++;
  return [lines.slice(0, i), ...lines.slice(i)];
}

const out = new URL("../cloudflare/worker.js", import.meta.url);
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const built = buildWorker();
  if (process.argv.includes("--check")) {
    if (readFileSync(out, "utf8") !== built) {
      console.error("cloudflare/worker.js no está al día: ejecuta «npm run worker».");
      process.exit(1);
    }
    console.log("cloudflare/worker.js está al día.");
  } else {
    writeFileSync(out, built);
    console.log(`cloudflare/worker.js: ${built.split("\n").length - 1} líneas a partir de ${MODULES.length} módulos.`);
  }
}
