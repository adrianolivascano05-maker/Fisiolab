// Genera la base musical con la duración del reel y el hueco de silencio antes del dato fuerte.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadConfig, ROOT } from "./config.mjs";
const cfg = await loadConfig();
const timings = JSON.parse(fs.readFileSync(path.join(ROOT, "public/voz/timings.json"), "utf8"));
const flat = cfg.SCENES.flatMap((s) => s.sentences.map(() => s.id));
const idx = flat.indexOf("hallazgo");
const gapAt = timings.sentences[idx].start + 0.35; // el hueco termina justo cuando arranca "el 47 %"
const dur = timings.sentences.at(-1).end + timings.tail;
execFileSync("python3", [path.join(ROOT, "tools/make_music.py"), String(dur + 0.5), String(gapAt), path.join(ROOT, "public/sfx/music.wav"), "0.9"], { stdio: "inherit" });
