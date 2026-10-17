#!/usr/bin/env python3
"""Iconos provisionales de la app, dibujados desde cero con el color de acento de los tokens.
/replica-brand los sustituirá. Uso: python3 tools/build-icons.py"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
tokens = json.loads((ROOT / "replica/design/tokens.json").read_text())
ACCENT = tokens["color"]["accent"]
WHITE = tokens["color"]["on-accent"]
OUT = ROOT / "public/icons"


def glyph(d: ImageDraw.ImageDraw, size: int, scale: float):
    """Flecha hacia arriba sobre la línea del suelo: un salto vertical."""
    c = size / 2
    u = size * scale / 100  # unidad: 1 % del área útil
    w = max(2, round(7 * u))
    # Suelo
    d.rounded_rectangle([c - 30 * u, c + 26 * u, c + 30 * u, c + 26 * u + w], radius=w // 2, fill=WHITE)
    # Trazo de la flecha
    d.rounded_rectangle([c - w / 2, c - 18 * u, c + w / 2, c + 14 * u], radius=w // 2, fill=WHITE)
    # Punta
    d.polygon([(c, c - 34 * u), (c - 17 * u, c - 12 * u), (c + 17 * u, c - 12 * u)], fill=WHITE)


def icon(size: int, *, maskable: bool, rounded: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable or not rounded:
        d.rectangle([0, 0, size, size], fill=ACCENT)
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=round(size * 0.22), fill=ACCENT)
    # Los iconos "maskable" deben dejar el dibujo dentro del 80 % central.
    glyph(d, size, 0.62 if maskable else 0.8)
    return img


OUT.mkdir(parents=True, exist_ok=True)
icon(192, maskable=False, rounded=True).save(OUT / "icon-192.png")
icon(512, maskable=False, rounded=True).save(OUT / "icon-512.png")
icon(512, maskable=True, rounded=False).save(OUT / "maskable-512.png")
icon(180, maskable=False, rounded=False).convert("RGB").save(OUT / "apple-touch-icon.png")
icon(64, maskable=False, rounded=True).save(ROOT / "public/favicon.png")
print("iconos en", OUT)
