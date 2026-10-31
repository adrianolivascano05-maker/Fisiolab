// Alinea las frases del guion con la toma de voz detectando silencios (ffmpeg silencedetect)
// y escribe public/voz/timings.json. Uso: node tools/align.mjs [public/voz/voz.wav]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadConfig, ROOT, estimateSeconds } from "./config.mjs";

const wav = process.argv[2] ?? path.join(ROOT, "public/voz/voz.wav");
const NOISE = process.env.SIL_DB ?? "-38dB";
const MIN = process.env.SIL_MIN ?? "0.16";

const cfg = await loadConfig();
const sents = cfg.SCENES.flatMap((s) => s.sentences.map((x, i) => ({ text: x.text, last: i === s.sentences.length - 1 })));

const log = execFileSync("ffmpeg", ["-hide_banner", "-i", wav, "-af", `silencedetect=n=${NOISE}:d=${MIN}`, "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const total = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav], { encoding: "utf8" }));
const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);

// Segmentos de voz entre silencios
const segs = [];
let cur = 0;
for (let i = 0; i < starts.length; i++) {
  if (starts[i] - cur > 0.05) segs.push({ start: cur, end: starts[i] });
  cur = ends[i] ?? total;
}
if (total - cur > 0.05) segs.push({ start: cur, end: total });
console.error(`segmentos de voz: ${segs.length}, frases: ${sents.length}`);

// Programación dinámica: agrupar segmentos consecutivos en N frases minimizando
// la desviación respecto a la duración esperada (proporcional a los caracteres).
const N = sents.length, M = segs.length;
if (M < N) { console.error("Menos segmentos que frases: baja SIL_DB o SIL_MIN"); process.exit(1); }
const est = sents.map((s) => estimateSeconds(s.text, s.last) - 0.3);
const sumEst = est.reduce((a, b) => a + b, 0);
const speech = segs.reduce((a, s) => a + (s.end - s.start), 0);
const scale = speech / sumEst;
const INF = 1e18;
const cost = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(INF));
const prev = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(-1));
cost[0][0] = 0;
for (let n = 1; n <= N; n++) {
  for (let m = n; m <= M; m++) {
    for (let k = n - 1; k < m; k++) {
      if (cost[n - 1][k] >= INF) continue;
      const d = segs[m - 1].end - segs[k].start;
      const c = cost[n - 1][k] + Math.abs(d - est[n - 1] * scale);
      if (c < cost[n][m]) { cost[n][m] = c; prev[n][m] = k; }
    }
  }
}
let m = M; const groups = [];
for (let n = N; n >= 1; n--) { const k = prev[n][m]; groups.unshift({ start: segs[k].start, end: segs[m - 1].end }); m = k; }

const out = groups.map((g) => ({ start: +g.start.toFixed(3), end: +g.end.toFixed(3) }));
const timings = { source: "voz", voiceDuration: +total.toFixed(3), sentences: out, tail: 1.6 };
fs.writeFileSync(path.join(ROOT, "public/voz/timings.json"), JSON.stringify(timings, null, 2));
out.forEach((t, i) => console.log(`${t.start.toFixed(2).padStart(6)} → ${t.end.toFixed(2).padStart(6)}  (${(t.end - t.start).toFixed(2)} s, est. ${(est[i] * scale).toFixed(2)})  ${sents[i].text}`));
