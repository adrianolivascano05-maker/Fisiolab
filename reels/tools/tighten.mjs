// Recorta las pausas ENTRE frases de la toma de voz (sin regenerarla) y añade el hueco del cold open al principio.
// Entrada: public/<video>/voz/voz.wav + timings.orig.json (o timings.json la primera vez).
// Salida: public/<video>/voz/voz_tight.wav + timings.json remapeado. Los originales no se tocan.
// Uso: VIDEO=kemp node tools/tighten.mjs
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { loadConfig, vpath } from "./config.mjs";

const KEEP = +(process.env.PAUSE_KEEP ?? 0.34); // s de pausa que se conservan entre frases
const MIN_CUT = 0.42; // solo se recortan pausas más largas que esto
const INTRO = +(process.env.INTRO ?? 0.8); // s de silencio inicial para el cold open

const cfg = await loadConfig();
const origPath = vpath("voz/timings.orig.json");
if (!fs.existsSync(origPath)) fs.copyFileSync(vpath("voz/timings.json"), origPath);
const t = JSON.parse(fs.readFileSync(origPath, "utf8"));
const wav = vpath("voz/voz.wav");
const total = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav], { encoding: "utf8" }));

// Silencios reales
const log = spawnSync("ffmpeg", ["-hide_banner", "-i", wav, "-af", "silencedetect=n=-30dB:d=0.2", "-f", "null", "-"], { encoding: "utf8" }).stderr;
const st = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
const en = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
const silences = st.map((a, i) => ({ start: a, end: en[i] ?? total }));

// Pausa que se respeta: la que precede a la escena del dato (silencio dramático)
const flat = cfg.SCENES.flatMap((s) => s.sentences.map(() => s.id));
const dataIdx = flat.indexOf(cfg.DATA_SCENE ?? "hallazgo");

const cuts = []; // intervalos [a,b] que se eliminan
for (let i = 0; i + 1 < t.sentences.length; i++) {
  if (i + 1 === dataIdx) continue;
  const e = t.sentences[i].end, s = t.sentences[i + 1].start;
  // Silencio que solapa el hueco entre frases (los fines de palabra son aproximados: margen de 0,15 s)
  const sil = silences.find((x) => x.start <= s + 0.05 && x.end >= e - 0.05 && x.end - x.start > 0.2);
  if (!sil) continue;
  const lo = Math.max(sil.start, e - 0.15), hi = Math.min(sil.end, s + 0.15);
  if (hi - lo <= MIN_CUT) continue;
  cuts.push([lo + KEEP / 2, hi - KEEP / 2]);
}
// Cola final: dejar 0,35 s tras la última palabra
const lastEnd = t.sentences[t.sentences.length - 1].end;
const tailCut = total > lastEnd + 0.45 ? [lastEnd + 0.35, total] : null;

const removedBefore = (x) => cuts.reduce((acc, [a, b]) => acc + (x >= b ? b - a : x > a ? x - a : 0), 0);
const map = (x) => +(x - removedBefore(x) + INTRO).toFixed(3);

// Audio: concatenar los tramos conservados
const keep = []; let cur = 0;
for (const [a, b] of [...cuts, ...(tailCut ? [tailCut] : [])]) { keep.push([cur, a]); cur = b; }
if (cur < total) keep.push([cur, total]);
const parts = keep.map((k, i) => `[0:a]atrim=start=${k[0].toFixed(3)}:end=${k[1].toFixed(3)},asetpts=PTS-STARTPTS[p${i}]`).join(";");
const filter = `${parts};${keep.map((_, i) => `[p${i}]`).join("")}concat=n=${keep.length}:v=0:a=1,adelay=${Math.round(INTRO * 1000)}|${Math.round(INTRO * 1000)}[out]`;
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", wav, "-filter_complex", filter, "-map", "[out]", "-ar", "48000", "-ac", "1", vpath("voz/voz_tight.wav")]);
const newTotal = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", vpath("voz/voz_tight.wav")], { encoding: "utf8" }));

const out = {
  ...t,
  source: "voz",
  voiceDuration: +newTotal.toFixed(3),
  intro: INTRO,
  tail: 1.0,
  sentences: t.sentences.map((s) => ({ start: map(s.start), end: map(s.end), words: s.words.map((w) => ({ ...w, start: map(w.start), end: map(w.end) })) })),
};
fs.writeFileSync(vpath("voz/timings.json"), JSON.stringify(out, null, 1));
const removed = cuts.reduce((a, [x, y]) => a + (y - x), 0) + (tailCut ? tailCut[1] - tailCut[0] : 0);
console.log(`${cuts.length} pausas recortadas, ${removed.toFixed(2)} s menos (+${INTRO} s de intro): ${total.toFixed(2)} s → ${newTotal.toFixed(2)} s`);
