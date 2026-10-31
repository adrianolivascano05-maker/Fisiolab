#!/usr/bin/env python3
"""Base musical sin copyright: 120 BPM, La menor, con hueco casi en silencio antes del dato fuerte.
Uso: python3 tools/make_music.py <duracion_s> <hueco_inicio_s> <salida.wav> [hueco_duracion_s=0.9]
"""
import sys, math, numpy as np, wave

SR = 48000
dur = float(sys.argv[1]); gap_at = float(sys.argv[2]); out = sys.argv[3]
gap_len = float(sys.argv[4]) if len(sys.argv) > 4 else 0.9
BPM = 120; beat = 60 / BPM
N = int(dur * SR); t = np.arange(N) / SR
mix = np.zeros(N)

def add(start, sig):
    i = int(start * SR); j = min(N, i + len(sig))
    if i < N: mix[i:j] += sig[: j - i]

def env(n, a, d): # ataque/decay exponencial
    x = np.arange(n) / SR
    return np.minimum(1, x / max(a, 1e-4)) * np.exp(-x / d)

def kick():
    n = int(0.35 * SR); x = np.arange(n) / SR
    f = 50 + 90 * np.exp(-x * 25)
    return 0.9 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 9)

def snare():
    n = int(0.22 * SR); x = np.arange(n) / SR
    rng = np.random.default_rng(1)
    noise = rng.standard_normal(n) * np.exp(-x * 22)
    body = np.sin(2 * np.pi * 185 * x) * np.exp(-x * 30)
    return 0.35 * noise + 0.3 * body

def hat():
    n = int(0.06 * SR); x = np.arange(n) / SR
    rng = np.random.default_rng(2)
    h = rng.standard_normal(n) * np.exp(-x * 70)
    # filtro paso alto simple (diferencia)
    h = np.diff(h, prepend=0)
    return 0.12 * h / (np.max(np.abs(h)) + 1e-9)

def bass(freq, length):
    n = int(length * SR); x = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * x) + 0.4 * np.sin(2 * np.pi * freq * 2 * x) * np.exp(-x * 4)
    s = np.tanh(1.6 * s)
    return 0.28 * s * env(n, 0.01, 0.6) * np.minimum(1, (length - x) / 0.05)

# Secuencia: compases de 4 tiempos
A, C, G = 55.0, 65.41, 49.0  # La1, Do2, Sol1
bass_seq = [A, A, C, G]
bars = int(math.ceil(dur / (4 * beat)))
for b in range(bars):
    t0 = b * 4 * beat
    for k in (0, 2): add(t0 + k * beat, kick())
    for k in (1, 3): add(t0 + k * beat, snare())
    for k in range(4): add(t0 + k * beat + beat / 2, hat())
    add(t0, bass(bass_seq[b % 4], 2 * beat))
    add(t0 + 2 * beat, bass(bass_seq[b % 4], 2 * beat))

# Pad tenue La menor (A3, C4, E4) con vibrato lento
pad = np.zeros(N)
for f in (220.0, 261.63, 329.63):
    pad += np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 0.2 * t)) + 0.5 * np.sin(2 * np.pi * f * 0.5 * t)
pad *= 0.06 * (0.8 + 0.2 * np.sin(2 * np.pi * 0.125 * t))
mix += pad

# Hueco casi en silencio justo antes del dato fuerte
g0, g1 = gap_at - gap_len, gap_at
ramp = np.ones(N)
i0, i1 = int(g0 * SR), int(g1 * SR)
fade = int(0.08 * SR)
ramp[i0:i1] = 0.04
ramp[i0 - fade:i0] = np.linspace(1, 0.04, fade)
ramp[i1:i1 + fade] = np.linspace(0.04, 1, fade)
mix *= ramp

# Fade final
fo = int(1.5 * SR); mix[-fo:] *= np.linspace(1, 0, fo)
# Normalizar a -1 dBFS
mix = mix / (np.max(np.abs(mix)) + 1e-9) * (10 ** (-1 / 20))
pcm = (mix * 32767).astype(np.int16)
with wave.open(out, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("OK", out, f"{dur:.2f}s, hueco {g0:.2f}-{g1:.2f}s")
