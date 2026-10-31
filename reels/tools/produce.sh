#!/usr/bin/env bash
# Pipeline completo: voz (1 petición a Gemini TTS) → normalización → alineación → música → render.
# Uso: tools/produce.sh [--skip-voice]
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${1:-}" != "--skip-voice" ]]; then
  node --no-warnings tools/guion.mjs > /dev/null
  ( cd voz-dani && python3 voz_dani.py -f ../public/voz/guion.txt ../public/voz/voz_raw.wav )
  # Recorta silencio inicial/final, normaliza a -16 LUFS y limita el pico a -1,5 dB
  ffmpeg -y -v error -i public/voz/voz_raw.wav \
    -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.3,areverse,adelay=350|350,apad=pad_dur=0.4,loudnorm=I=-16:TP=-1.5:LRA=11" \
    -ar 48000 -ac 1 public/voz/voz.wav
  node --no-warnings tools/align.mjs public/voz/voz.wav
fi
node --no-warnings tools/music.mjs
npx remotion render PalpacionL4 out/reel-palpacion-l4.mp4 --codec=h264 --crf=18 --audio-codec=aac
# Seguridad: pico ≤ -1 dB sin tocar el vídeo
ffmpeg -y -v error -i out/reel-palpacion-l4.mp4 -c:v copy -af "alimiter=limit=0.89:attack=3:release=60" -c:a aac -b:a 192k out/reel-palpacion-l4.final.mp4 && mv out/reel-palpacion-l4.final.mp4 out/reel-palpacion-l4.mp4
ffmpeg -i out/reel-palpacion-l4.mp4 -af "astats=measure_perchannel=none:measure_overall=Peak_level" -f null - 2>&1 | grep "Peak level"
