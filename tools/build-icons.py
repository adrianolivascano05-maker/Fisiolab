#!/usr/bin/env python3
"""Iconos de Impulso desde los tokens: la trayectoria del salto (ver src/ui/Logo.tsx).
Uso: python3 tools/build-icons.py"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
tokens = json.loads((ROOT / "replica/design/tokens.json").read_text())
ACCENT = tokens["color"]["accent"]
WHITE = tokens["color"]["on-accent"]
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
    # Parábola: Bézier cuadrática de (18,72) a (82,72) con control (50,0); vértice en (50,36).
    # Se dibuja estampando círculos a lo largo de la curva: trazo uniforme y sin juntas.
    w = 7 * u
    for i in range(0, 801):
        t = i / 800
        x = (1 - t) ** 2 * 18 + 2 * (1 - t) * t * 50 + t * t * 82
        y = (1 - t) ** 2 * 72 + 2 * (1 - t) * t * 0 + t * t * 72
        px, py = p(x, y)
        d.ellipse([px - w / 2, py - w / 2, px + w / 2, py + w / 2], fill=WHITE)
    cx, cy = p(50, 36)
    r = 8.5 * u
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    # Suelo, más tenue.
    ground = tuple(round(a * 0.55 + b * 0.45) for a, b in zip(hex_rgb(WHITE), hex_rgb(ACCENT)))
    gw = round(6 * u)
    x1, y1 = p(14, 83)
    x2, _ = p(86, 83)
    d.line([(x1, y1), (x2, y1)], fill=ground, width=gw)
    for x in (x1, x2):
        d.ellipse([x - gw / 2, y1 - gw / 2, x + gw / 2, y1 + gw / 2], fill=ground)


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
