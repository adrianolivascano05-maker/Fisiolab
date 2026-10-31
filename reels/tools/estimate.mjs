// Escribe public/voz/timings.json con tiempos ESTIMADOS (sin voz todavía).
import fs from "node:fs";
import path from "node:path";
import { loadConfig, ROOT, estimateSeconds } from "./config.mjs";
const cfg = await loadConfig();
let t = 0.35;
const out = [];
for (const s of cfg.SCENES) {
  s.sentences.forEach((x, i) => {
    const d = estimateSeconds(x.text, i === s.sentences.length - 1);
    out.push({ start: +t.toFixed(3), end: +(t + d - 0.25).toFixed(3) });
    t += d;
  });
}
const timings = { source: "estimado", voiceDuration: +t.toFixed(3), sentences: out, tail: 1.6 };
fs.writeFileSync(path.join(ROOT, "public/voz/timings.json"), JSON.stringify(timings, null, 2));
console.log(JSON.stringify(timings));
