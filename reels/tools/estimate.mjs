// Escribe public/voz/timings.json con tiempos ESTIMADOS palabra a palabra (sin voz todavía).
import fs from "node:fs";
import path from "node:path";
import { loadConfig, ROOT, estimateSeconds, spreadWords } from "./config.mjs";
const cfg = await loadConfig();
let t = 0.35;
const out = [];
for (const s of cfg.SCENES) {
  s.sentences.forEach((x, i) => {
    const d = estimateSeconds(x.text, i === s.sentences.length - 1);
    const end = t + d - 0.25;
    out.push({ start: +t.toFixed(3), end: +end.toFixed(3), words: spreadWords(x.text, t, end) });
    t += d;
  });
}
const timings = { source: "estimado", voiceDuration: +t.toFixed(3), sentences: out, tail: 1.8 };
fs.writeFileSync(path.join(ROOT, "public/voz/timings.json"), JSON.stringify(timings, null, 1));
console.log(`estimado: ${timings.voiceDuration}s, ${out.length} frases`);
