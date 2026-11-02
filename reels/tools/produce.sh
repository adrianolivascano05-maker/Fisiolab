#!/usr/bin/env bash
# Pipeline completo: voz (1 petición a Gemini TTS) → normalización → alineación → música → render.
# Uso: tools/produce.sh <video> [--skip-voice]     (video = carpeta en src/videos/ y public/, p. ej. palpacion, kemp)
set -euo pipefail
cd "$(dirname "$0")/.."
export VIDEO="${1:?indica el vídeo: palpacion, kemp...}"
COMP=$(node --no-warnings -e "import('./src/videos/'+process.env.VIDEO+'/config.ts').then(m=>console.log(m.META.id))")
V="public/$VIDEO"
mkdir -p "$V/voz"
if [[ "${2:-}" != "--skip-voice" ]]; then
  node --no-warnings tools/guion.mjs > /dev/null
  ( cd voz-dani && python3 voz_dani.py -f "../$V/voz/guion.txt" "../$V/voz/voz_raw.wav" )
  # Recorta silencio inicial/final, normaliza a -16 LUFS y limita el pico a -1,5 dB
  ffmpeg -y -v error -i "$V/voz/voz_raw.wav" \
    -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.3,areverse,adelay=350|350,apad=pad_dur=0.4,loudnorm=I=-16:TP=-1.5:LRA=11" \
    -ar 48000 -ac 1 "$V/voz/voz.wav"
  # Palabras con tiempos (modelo de audio de Gemini, cuota distinta del TTS); si falla, se reparten por caracteres
  node --no-warnings tools/align_words.mjs "$V/voz/voz.wav" "$V/voz/voz.words.json" || true
  node --no-warnings tools/align.mjs "$V/voz/voz.wav"
  # Recorta las pausas entre frases (sin regenerar la voz) y añade el hueco del cold open
  node --no-warnings tools/tighten.mjs
fi
node --no-warnings tools/music.mjs
npx remotion render "$COMP" "out/reel-$VIDEO.raw.mp4" --codec=h264 --crf=18 --audio-codec=aac
# Seguridad: pico ≤ -1 dB sin tocar el vídeo
ffmpeg -y -v error -i "out/reel-$VIDEO.raw.mp4" -c:v copy -af "alimiter=limit=0.8:attack=5:release=50:level=false" -c:a aac -b:a 192k "out/reel-$VIDEO.mp4"
ffmpeg -i "out/reel-$VIDEO.mp4" -af "astats=measure_perchannel=none:measure_overall=Peak_level" -f null - 2>&1 | grep "Peak level"
