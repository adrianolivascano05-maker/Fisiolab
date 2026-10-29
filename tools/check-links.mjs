// Comprueba que abren los enlaces oficiales de los cuestionarios de solo nota (src/clinical/questionnaires.ts y
// src/clinical/catalog): `npm run check:links`. Hay que pasarlo con conexión antes de publicar un cambio de enlaces.
// Sale con error si alguno no responde con 2xx o 3xx.
import { readdirSync, readFileSync } from "node:fs";

const files = ["src/clinical/questionnaires.ts", ...readdirSync("src/clinical/catalog").map((f) => `src/clinical/catalog/${f}`)];
const urls = [...new Set(files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/url: "(https:\/\/[^"]+)"/g)].map((m) => m[1])))].sort();

let bad = 0;
for (const url of urls) {
  let status;
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (comprobación de enlaces de OmniClin)" }, signal: AbortSignal.timeout(20_000) });
    status = r.status;
  } catch (e) {
    status = e instanceof Error ? e.message : String(e);
  }
  const ok = typeof status === "number" && status < 400;
  if (!ok) bad++;
  console.log(`${ok ? "bien" : "MAL "}  ${status}  ${url}`);
}
console.log(`${urls.length} enlaces, ${bad} sin abrir.`);
process.exit(bad ? 1 : 0);
