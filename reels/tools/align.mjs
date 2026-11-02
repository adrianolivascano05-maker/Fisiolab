// Alinea el guion con la toma de voz: frases por silencios (ffmpeg silencedetect) y palabras
// dentro de cada frase con las duraciones relativas del transcriptor (public/voz/voz.words.json,
// generado por tools/align_words.mjs) o, si no existe, proporcionales a los caracteres.
// Uso: node tools/align.mjs [public/voz/voz.wav]
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { loadConfig, vpath, estimateSeconds, spreadWords, wordWeights } from "./config.mjs";

const wav = process.argv[2] ?? vpath("voz/voz.wav");
const wordsFile = wav.replace(/\.wav$/, ".words.json");

const cfg = await loadConfig();
const sents = cfg.SCENES.flatMap((s) => s.sentences.map((x, i) => ({ text: x.text, last: i === s.sentences.length - 1 })));

const total = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav], { encoding: "utf8" }));
const est = sents.map((s) => estimateSeconds(s.text, s.last) - 0.3);
const sumEst = est.reduce((a, b) => a + b, 0);
const N = sents.length;
const INF = 1e18;

/** Segmentos de voz entre silencios para un umbral dado. */
const segmentsFor = (noise, min) => {
  const log = spawnSync("ffmpeg", ["-hide_banner", "-i", wav, "-af", `silencedetect=n=${noise}:d=${min}`, "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  const out = []; let cur = 0;
  for (let i = 0; i < starts.length; i++) { if (starts[i] - cur > 0.05) out.push({ start: cur, end: starts[i] }); cur = ends[i] ?? total; }
  if (total - cur > 0.05) out.push({ start: cur, end: total });
  return out;
};

/** Programación dinámica: agrupar segmentos consecutivos en N frases minimizando la desviación
 *  respecto a la duración esperada (proporcional a los caracteres). Devuelve grupos y coste medio. */
const groupSentences = (segs) => {
  const M = segs.length;
  if (M < N) return null;
  const speech = segs.reduce((a, s) => a + (s.end - s.start), 0);
  const scale = speech / sumEst;
  const cost = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(INF));
  const prev = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(-1));
  cost[0][0] = 0;
  for (let n = 1; n <= N; n++) for (let m = n; m <= M; m++) for (let k = n - 1; k < m; k++) {
    if (cost[n - 1][k] >= INF) continue;
    const d = segs[m - 1].end - segs[k].start;
    const c = cost[n - 1][k] + Math.abs(d - est[n - 1] * scale);
    if (c < cost[n][m]) { cost[n][m] = k; prev[n][m] = k; cost[n][m] = c; }
  }
  let m = M; const groups = [];
  for (let n = N; n >= 1; n--) { const k = prev[n][m]; groups.unshift({ start: segs[k].start, end: segs[m - 1].end }); m = k; }
  return { groups, score: cost[N][M] / N, scale, segs };
};

// Se prueban varios umbrales de silencio (el TTS respira y hace pausas de distinta profundidad):
// gana la segmentación cuyas frases se parecen más a las duraciones esperadas.
let best = null;
for (const noise of [process.env.SIL_DB ?? "-38dB", "-34dB", "-30dB", "-26dB"]) for (const min of [process.env.SIL_MIN ?? "0.16", "0.12", "0.22"]) {
  const r = groupSentences(segmentsFor(noise, min));
  if (!r) continue;
  if (!best || r.score < best.score) best = { ...r, noise, min };
}
if (!best) { console.error("No se encuentran suficientes pausas: revisa la toma"); process.exit(1); }
const { groups, scale, segs } = best;
console.error(`umbral elegido ${best.noise}/${best.min}s · segmentos ${segs.length} · desviación media ${best.score.toFixed(2)} s`);

// Palabras del transcriptor (opcional): se reparten entre las frases por orden, casando el número de palabras.
let refWords = null;
if (fs.existsSync(wordsFile)) {
  // Sin tildes ni diéresis para comparar (el transcriptor a veces las omite); las palabras del guion se conservan tal cual.
  const da = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const raw = JSON.parse(fs.readFileSync(wordsFile, "utf8")).words.map((w) => ({ ...w, w: da(w.w.toLowerCase()).replace(/[^a-zñ0-9-]/g, "") }));
  // El transcriptor dice «L uno» por «L1»: se fusionan letra + número en un token.
  const NUM = { uno: "1", una: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9" };
  const merged = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i], b = raw[i + 1];
    if (a.w === "l" && b && NUM[b.w]) { merged.push({ w: a.w + NUM[b.w], start: a.start, end: b.end }); i++; } else merged.push(a);
  }
  // Casar token a token con el guion (permite «l4-l5» = «l4» + «l5»); si algo no cuadra, se descarta el transcriptor.
  const script = sents.flatMap((s) => wordWeights(s.text).map((x) => da(x.w)));
  // Casado tolerante: parte palabras que el transcriptor pegó, salta palabras de más y admite las que falten.
  const out = []; let j = 0; let ok = true; let fixes = 0;
  for (let ti = 0; ti < script.length; ti++) {
    const tok = script[ti];
    const a = merged[j], b = merged[j + 1];
    if (a && a.w === tok) { out.push(a); j++; continue; }
    if (a && b && a.w + "-" + b.w === tok) { out.push({ w: tok, start: a.start, end: b.end }); j += 2; continue; }
    if (a && a.w.length > tok.length && a.w.startsWith(tok)) {
      const cut = a.start + ((a.end - a.start) * tok.length) / a.w.length;
      out.push({ w: tok, start: a.start, end: cut });
      merged[j] = { w: a.w.slice(tok.length), start: cut, end: a.end }; fixes++; continue;
    }
    if (a && a.w.length > tok.length && a.w.endsWith(tok)) {
      const cut = a.end - ((a.end - a.start) * tok.length) / a.w.length;
      out.push({ w: tok, start: cut, end: a.end }); j++; fixes++; continue;
    }
    if (a && b && b.w === tok) { out.push(b); j += 2; fixes++; continue; } // palabra de más en el transcriptor
    if (a && merged[j + 2] && merged[j + 2].w === tok) { out.push(merged[j + 2]); j += 3; fixes++; continue; }
    if (a && (ti + 1 >= script.length || (b && b.w === script[ti + 1]))) { out.push({ w: tok, start: a.start, end: a.end }); j++; fixes++; continue; } // el transcriptor oyó otra palabra
    if (a && script.length - out.length > merged.length - j) { out.push({ w: tok, start: a.start, end: a.start }); fixes++; continue; } // falta en el transcriptor
    console.error(`transcriptor: no cuadra «${tok}» con «${a?.w}» (posición ${j})`); ok = false; break;
  }
  console.error(`transcriptor: ${merged.length} tokens, guion: ${script.length} palabras, casadas: ${out.length}, arreglos: ${fixes}`);
  refWords = ok && out.length === script.length && j >= merged.length - 2 ? out : null;
  if (!refWords) console.error("Se usan proporciones por caracteres dentro de cada frase");
}
// Dentro de cada frase, las pausas internas (segmentos de voz) sirven de anclas: las palabras se reparten
// entre los segmentos con otra programación dinámica (duración esperada de cada palabra ∝ transcriptor o caracteres).
const partition = (weights, chunks) => {
  const N = chunks.length, M = weights.length;
  const total = weights.reduce((a, b) => a + b, 0), span = chunks.reduce((a, c) => a + (c.end - c.start), 0);
  const INF = 1e18;
  const cost = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(INF));
  const prev = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(-1));
  cost[0][0] = 0;
  for (let n = 1; n <= N; n++) for (let m = n; m <= M; m++) for (let k = n - 1; k < m; k++) {
    if (cost[n - 1][k] >= INF) continue;
    const w = weights.slice(k, m).reduce((a, b) => a + b, 0);
    const c = cost[n - 1][k] + Math.abs((w / total) * span - (chunks[n - 1].end - chunks[n - 1].start));
    if (c < cost[n][m]) { cost[n][m] = c; prev[n][m] = k; }
  }
  const cuts = []; let m = M;
  for (let n = N; n >= 1; n--) { const k = prev[n][m]; cuts.unshift([k, m]); m = k; }
  return cuts;
};
let cursor = 0;
const out = groups.map((g, i) => {
  const toks = wordWeights(sents[i].text);
  const n = toks.length;
  const ref = refWords ? refWords.slice(cursor, cursor + n) : null;
  cursor += n;
  const inner = segs.filter((sg) => sg.start >= g.start - 0.01 && sg.end <= g.end + 0.01);
  if (inner.length <= 1 || inner.length > n) return { start: +g.start.toFixed(3), end: +g.end.toFixed(3), words: spreadWords(sents[i].text, g.start, g.end, ref) };
  const weights = ref ? ref.map((r, k) => Math.max(0.05, r.end - r.start) + (k < n - 1 ? Math.max(0, ref[k + 1].start - r.end) : 0)) : toks.map((x) => x.weight);
  const cuts = partition(weights, inner);
  const words = [];
  cuts.forEach(([a, b], k) => {
    const text = sents[i].text.split(/\s+/).filter(Boolean).slice(a, b).join(" ");
    words.push(...spreadWords(text, inner[k].start, inner[k].end, ref ? ref.slice(a, b) : null));
  });
  return { start: +g.start.toFixed(3), end: +g.end.toFixed(3), words };
});
const timings = { source: "voz", voiceDuration: +total.toFixed(3), sentences: out, tail: 1.8 };
fs.writeFileSync(vpath("voz/timings.json"), JSON.stringify(timings, null, 1));
out.forEach((t, i) => console.log(`${t.start.toFixed(2).padStart(6)} → ${t.end.toFixed(2).padStart(6)}  (${(t.end - t.start).toFixed(2)} s, est. ${(est[i] * scale).toFixed(2)})  ${sents[i].text}`));
