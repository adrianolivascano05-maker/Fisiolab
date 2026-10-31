#!/usr/bin/env python3
"""Iconos de OmniClin desde los tokens: un anillo de tres arcos (medir · organizar · acompañar) con el sol de
oro arriba, sobre el verde bosque. Mismo dibujo que src/ui/Logo.tsx (RING y ARCS).
Uso: python3 tools/build-icons.py"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
tokens = json.loads((ROOT / "src/styles/tokens.json").read_text())
import math

ACCENT = tokens["color"]["brand"]
WHITE = tokens["color"]["on-brand"]
GOLD = tokens["color"]["highlight"]
MINT = tokens["color"]["on-brand-accent"]
OUT = ROOT / "public/icons"
SS = 4  # supermuestreo para bordes suaves


def hex_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def glyph(d: ImageDraw.ImageDraw, size: int, scale: float):
    """Mismas coordenadas que el SVG (caja de 100), reducidas a `scale` y centradas."""
    off = size * (1 - scale) / 2

    def p(x, y):
        return (off + x / 100 * size * scale, off + y / 100 * size * scale)

    u = size * scale / 100
    # Anillo: centro (50, 52), radio 27, trazo 9; huecos de 12° a cada lado de −90°, 30° y 150°. Se estampan
    # círculos a lo largo de cada arco: trazo uniforme y extremos redondos. El de abajo, en menta.
    w = 9 * u
    for start, end, col in ((-78, 18, WHITE), (42, 138, MINT), (162, 258, WHITE)):
        for i in range(0, 601):
            a = math.radians(start + (end - start) * i / 600)
            px, py = p(50 + 27 * math.cos(a), 52 + 27 * math.sin(a))
            d.ellipse([px - w / 2, py - w / 2, px + w / 2, py + w / 2], fill=col)
    # Sol de oro arriba, sobre el hueco.
    cx, cy = p(50, 25)
    r = 7.65 * u
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD)


def icon(size: int, *, maskable: bool, rounded: bool) -> Image.Image:
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable or not rounded:
        d.rectangle([0, 0, big, big], fill=ACCENT)
    else:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=round(big * 0.24), fill=ACCENT)
    # Los iconos "maskable" deben dejar el dibujo dentro del 80 % central.
    glyph(d, big, 0.66 if maskable else 0.86)
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
icon(192, maskable=False, rounded=True).save(OUT / "omniclin-icon-192.png")
icon(512, maskable=False, rounded=True).save(OUT / "omniclin-icon-512.png")
icon(512, maskable=True, rounded=False).save(OUT / "omniclin-maskable-512.png")
icon(180, maskable=False, rounded=False).convert("RGB").save(OUT / "omniclin-apple-touch-icon.png")
icon(64, maskable=False, rounded=True).save(ROOT / "public/favicon.png")
icon(1024, maskable=False, rounded=False).convert("RGB").save(OUT / "omniclin-icon-1024.png")
print("iconos en", OUT)
