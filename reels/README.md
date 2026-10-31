# Reels de fisioterapia con Remotion · plantilla reutilizable

Reel vertical (1080×1920, 30 fps) con animaciones en código, voz en off de Gemini TTS (voz fija «Dani», Achird) y sonido sintetizado sin copyright.

## Primer vídeo
«Palpamos el nivel correcto la mitad de las veces» (Custers 2024 · reel 1; dato original de Harlick 2007). Composición principal `PalpacionL4`; cada escena también está suelta en la carpeta «Escenas» de Remotion Studio; portada en el still `Portada`.

## Dónde se cambia todo
- `src/config.ts`: textos del guion (frase a frase), palabras resaltadas en los subtítulos, datos, colores y metadatos. **Es el único archivo que hay que tocar para otro vídeo** (más las escenas si el visual cambia).
- `public/voz/timings.json`: tiempos de cada frase (los genera `tools/align.mjs` a partir de la voz, o `tools/estimate.mjs` como estimación mientras no hay voz). `calculateMetadata` lee este archivo y de ahí sale la duración de cada escena y del vídeo.
- `src/scenes/*.tsx`: una escena por archivo. Reciben `c` (frases en frames relativos) y usan `wordAt()` para sincronizar cada animación con la palabra que se dice.
- `src/cues.ts`: efectos de sonido por escena, con los mismos momentos que las animaciones.

## Producir
```bash
npm i
tools/produce.sh            # voz (1 petición TTS) → normalización → alineación → música → render
tools/produce.sh --skip-voice   # solo música + render con los tiempos actuales
npx remotion still Portada out/portada.png
npx remotion studio         # previsualizar
```
Si no hay voz, `tools/estimate.mjs` crea tiempos estimados y el render sale sin voz (hasta que exista `public/voz/voz.wav`).

## Entorno (contenedor en la nube)
- `remotion.config.ts` apunta al Chromium headless preinstalado (remotion.media está bloqueado).
- Fuente Montserrat local en `public/fonts` (`@remotion/fonts`); nada de `@remotion/google-fonts`.
- Efectos en `public/sfx` generados con ffmpeg; base musical con `tools/make_music.py` (numpy), con hueco de silencio antes del dato fuerte y ducking bajo la voz.
- Gemini TTS: capa gratuita, 10 peticiones/día con `gemini-3.8-flash-tts`. Una sola toma por vídeo.

Entregables del primer vídeo (portada, descripción, ganchos alternativos y guion de la parte 2): `ENTREGABLES.md`.
