// «Licencias de terceros» (src/pages/LicensesPage.tsx): en cada build, las librerías que acaban dentro de la app
// publicada, cada una con su licencia y su texto completo, en licencias.json. Sale de lo que de verdad entra en el
// build (la app y sus workers), no de package.json: lo que solo sirve para desarrollar no se publica y no sale.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

export type ThirdParty = {
  name: string;
  version: string;
  license: string;
  author?: string;
  homepage?: string;
  /** El texto de la licencia tal como lo trae el paquete. */
  text: string;
  /** De dónde sale el texto, si el paquete no trae su archivo de licencia. */
  note?: string;
};

/** Lo que entra en el build sin ser un paquete de node_modules. */
const EXTRA: ThirdParty[] = [
  {
    name: "MediaPipe Pose Landmarker (modelo pose_landmarker_full.task)",
    version: "full",
    license: "Apache-2.0",
    author: "Google",
    homepage: "https://github.com/google-ai-edge/mediapipe",
    text: readFileSync(new URL("../licenses/Apache-2.0.txt", import.meta.url), "utf8"),
    note: "Va dentro de la app para detectar la postura en el propio dispositivo. Texto oficial de la licencia Apache 2.0 (apache.org).",
  },
];

const LICENSE_FILE = /^(licen[cs]e|copying|ofl)([-._].*)?$/i;

/** La carpeta del paquete al que pertenece un módulo (o null si no viene de node_modules). */
export function packageDir(id: string): string | null {
  const path = id.replace(/^\0/, "").split("?")[0]!.replace(/\\/g, "/");
  const at = path.lastIndexOf("/node_modules/");
  if (at === -1) return null;
  const rest = path.slice(at + "/node_modules/".length).split("/");
  const name = rest[0]!.startsWith("@") ? rest.slice(0, 2).join("/") : rest[0]!;
  return `${path.slice(0, at)}/node_modules/${name}`;
}

const personName = (p: unknown) => (typeof p === "string" ? p : typeof p === "object" && p && "name" in p ? String(p.name) : undefined);

/** El comentario del principio de un archivo, si habla de la licencia (qrcode-generator la pone ahí). */
function licenseHeader(file: string): string | null {
  const lines: string[] = [];
  for (const line of readFileSync(file, "utf8").split("\n").slice(0, 60)) {
    if (!line.startsWith("//")) break;
    lines.push(line.replace(/^\/\/ ?/, ""));
  }
  const text = lines.join("\n").trim();
  return /licen[cs]e/i.test(text) ? text : null;
}

/** Los textos oficiales (licenses/) de cada licencia de la expresión («MIT AND ISC»), si están todos. */
function officialTexts(license: string): string | null {
  const texts = license.split(/\s+(?:AND|OR)\s+/).map((id) => {
    const file = new URL(`../licenses/${id.replace(/[()]/g, "")}.txt`, import.meta.url);
    return existsSync(file) ? readFileSync(file, "utf8").trim() : null;
  });
  return texts.every(Boolean) ? texts.join("\n\n") : null;
}

function describe(dir: string, files: string[]): ThirdParty {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const license =
    typeof pkg.license === "string"
      ? pkg.license
      : Array.isArray(pkg.licenses)
        ? pkg.licenses.map((l: { type?: string }) => l.type).join(" OR ")
        : "Sin indicar";
  const author = personName(pkg.author);
  const base = { name: pkg.name, version: pkg.version, license, author, homepage: pkg.homepage };
  const file = readdirSync(dir).find((f) => LICENSE_FILE.test(f));
  if (file) return { ...base, text: readFileSync(join(dir, file), "utf8") };
  // Sin archivo de licencia: el aviso que el paquete pone en su propio código y, después, el texto oficial.
  const header = files.map(licenseHeader).find(Boolean);
  const official = officialTexts(license);
  const holder = author ? ` Autor según el paquete: ${author}.` : "";
  return {
    ...base,
    text: [header, official].filter(Boolean).join("\n\n"),
    note: header
      ? `El paquete no trae archivo de licencia: su aviso, tal como va en su código${official ? ", y el texto oficial de la licencia" : ""}.`
      : official
        ? `El paquete no trae el texto de su licencia: este es el texto oficial.${holder}`
        : `El paquete no trae el texto de su licencia.${holder}`,
  };
}

/**
 * Dos plugins que comparten la lista: `collect` va también en los workers (vite.config.ts, worker.plugins) y apunta
 * los paquetes de cada parte; `emit` escribe licencias.json al final del build de la app.
 */
export function thirdPartyLicenses() {
  // Cada paquete, con los archivos suyos que entran en el build.
  const dirs = new Map<string, string[]>();
  const collect = (): Plugin => ({
    name: "licencias-recoger",
    apply: "build",
    buildEnd() {
      for (const id of this.getModuleIds()) {
        const dir = packageDir(id);
        if (!dir || !existsSync(join(dir, "package.json"))) continue;
        const file = id.replace(/^\0/, "").split("?")[0]!;
        dirs.set(dir, [...(dirs.get(dir) ?? []), ...(existsSync(file) ? [file] : [])]);
      }
    },
  });
  const emit: Plugin = {
    name: "licencias-escribir",
    apply: "build",
    generateBundle() {
      const byName = new Map<string, ThirdParty>();
      for (const [dir, files] of dirs) {
        const p = describe(dir, files);
        byName.set(`${p.name}@${p.version}`, p);
      }
      const list = [...byName.values(), ...EXTRA].sort((a, b) => a.name.localeCompare(b.name));
      this.emitFile({ type: "asset", fileName: "licencias.json", source: JSON.stringify(list) });
    },
  };
  return { collect, emit };
}
