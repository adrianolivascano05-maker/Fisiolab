#!/usr/bin/env python3
"""Iconos de Cénit desde los tokens: una «C» que es también el arco de un goniómetro, con el sol de oro
en su punto más alto (el cénit). Mismo dibujo que src/ui/Logo.tsx.
Uso: python3 tools/build-icons.py"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
tokens = json.loads((ROOT / "replica/design/tokens.json").read_text())
import math

ACCENT = tokens["color"]["brand"]
WHITE = tokens["color"]["on-brand"]
GOLD = tokens["color"]["highlight"]
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
    # Arco de circunferencia (centro 50,57; radio 27) abierto a la derecha: de −40° a +40° pasando por
    # arriba y por la izquierda. Se estampan círculos a lo largo: trazo uniforme y extremos redondos.
    w = 9 * u
    for i in range(0, 1201):
        a = math.radians(-40 - 280 * i / 1200)
        px, py = p(50 + 27 * math.cos(a), 57 + 27 * math.sin(a))
        d.ellipse([px - w / 2, py - w / 2, px + w / 2, py + w / 2], fill=WHITE)
    # Sol de oro en lo más alto, con un halo del color de fondo que lo separa del arco.
    cx, cy = p(50, 30)
    for r, col in ((14 * u, ACCENT), (9.5 * u, GOLD)):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)


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
icon(192, maskable=False, rounded=True).save(OUT / "icon-192.png")
icon(512, maskable=False, rounded=True).save(OUT / "icon-512.png")
icon(512, maskable=True, rounded=False).save(OUT / "maskable-512.png")
icon(180, maskable=False, rounded=False).convert("RGB").save(OUT / "apple-touch-icon.png")
icon(64, maskable=False, rounded=True).save(ROOT / "public/favicon.png")
icon(1024, maskable=False, rounded=False).convert("RGB").save(OUT / "icon-1024.png")
print("iconos en", OUT)
