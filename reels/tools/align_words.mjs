// Afina los tiempos PALABRA A PALABRA pidiendo a Gemini (modelo de audio, no el TTS) la transcripción
// con marcas de tiempo de la voz. Uso: node tools/align_words.mjs public/voz/voz.wav [salida.json]
// Devuelve [{w, start, end}] para cada palabra del audio. Luego tools/align.mjs lo casa con el guion.
import fs from "node:fs";

const MODEL = process.env.ALIGN_MODEL ?? "gemini-3.8-flash";
const wav = process.argv[2];
const out = process.argv[3] ?? wav.replace(/\.wav$/, ".words.json");
const key = process.env.GEMINI_API_KEY;
if (!key) { console.error("Falta GEMINI_API_KEY"); process.exit(1); }

const audio = fs.readFileSync(wav).toString("base64");
const prompt = `Transcribe este audio en español de España palabra por palabra y devuelve SOLO un JSON (sin texto alrededor, sin bloque de código) con este formato:
{"words":[{"w":"palabra","start":0.00,"end":0.35}, ...]}
Reglas: una entrada por palabra hablada, en orden; "start" y "end" en segundos con dos decimales, medidos desde el inicio del audio; escribe los números como se pronuncian (por ejemplo "cuarenta", "siete"); no incluyas signos de puntuación en "w".`;

const body = {
  contents: [{ parts: [{ inlineData: { mimeType: "audio/wav", data: audio } }, { text: prompt }] }],
  generationConfig: { temperature: 0, responseMimeType: "application/json" },
};
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body),
});
if (!res.ok) { console.error(res.status, (await res.text()).slice(0, 400)); process.exit(1); }
const j = await res.json();
const text = j.candidates[0].content.parts.map((p) => p.text ?? "").join("");
const parsed = JSON.parse(text);
fs.writeFileSync(out, JSON.stringify(parsed, null, 1));
console.log(`${parsed.words.length} palabras → ${out}`);
parsed.words.slice(0, 60).forEach((x) => console.log(x.start.toFixed(2).padStart(6), x.end.toFixed(2).padStart(6), x.w));
