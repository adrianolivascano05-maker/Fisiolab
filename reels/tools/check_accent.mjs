// Pide a un modelo de audio de Gemini que juzgue el acento de una toma de voz (España vs. latinoamericano).
// Uso: node tools/check_accent.mjs voz.wav  → imprime JSON {acento, sesea, ejemplos, veredicto}
import fs from "node:fs";
const MODEL = process.env.ALIGN_MODEL ?? "gemini-3.5-flash";
const wav = process.argv[2];
const audio = fs.readFileSync(wav).toString("base64");
const prompt = `Escucha este audio en español y evalúa el ACENTO del hablante. Devuelve SOLO JSON con este formato:
{"acento":"España peninsular|latinoamericano|mixto","sesea":true|false,"distingue_z_c_de_s":true|false,"ejemplos":["palabra: cómo la pronuncia"],"rasgos":"...","veredicto":"castellano de España|no es castellano de España"}
Fíjate sobre todo en si pronuncia la z y la c (ante e/i) como /θ/ (zeta castellana: cinco, vértebra, radiografía, especificidad) o como /s/ (seseo), en la pronunciación de la s final, en la entonación y en el vocabulario.`;
const body = { contents: [{ parts: [{ inlineData: { mimeType: "audio/wav", data: audio } }, { text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } };
for (const m of [MODEL, "gemini-3.8-flash", "gemini-2.5-flash"]) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify(body) });
  if (!res.ok) { console.error(m, res.status); continue; }
  const j = await res.json();
  console.log(j.candidates[0].content.parts.map((p) => p.text ?? "").join(""));
  process.exit(0);
}
process.exit(1);
