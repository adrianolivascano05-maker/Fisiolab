// Genera public/voz/guion.txt (un párrafo por escena) a partir de src/config.ts
import fs from "node:fs";
import path from "node:path";
import { loadConfig, ROOT, vpath } from "./config.mjs";
const cfg = await loadConfig();
const txt = cfg.SCENES.map((s) => s.sentences.map((x) => x.text).join(" ")).join("\n\n") + "\n";
fs.writeFileSync(vpath("voz/guion.txt"), txt);
console.log(txt);
