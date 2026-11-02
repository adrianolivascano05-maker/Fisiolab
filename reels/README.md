# Reels de fisioterapia con Remotion · plantilla reutilizable

Reel vertical (1080×1920, 30 fps) con animaciones en código, voz en off de Gemini TTS (voz fija «Dani», Achird) y sonido sintetizado sin copyright.

## Vídeos
| Carpeta | Composición | Reel |
|---|---|---|
| `src/videos/palpacion` | `PalpacionL4` | «Palpamos el nivel correcto la mitad de las veces» (Custers 2024 · reel 1; Harlick 2007) |
| `src/videos/kemp` | `Kemp` | «El test de Kemp no confirma ni descarta» (Custers 2024 · reel 5; Stuber 2014) |
| `src/videos/sacroiliaca` | `Sacroiliaca` | «Test del 4 positivo: ¿qué mide de verdad el 91,4 %?» (Custers 2024 · reel 6, corregido con Telli 2018) |

Cada vídeo tiene su carpeta en `src/videos/<id>/` (config.ts con el guion y los datos, scenes/, cues.ts, index.ts) y sus assets en `public/<id>/` (voz/ y music.wav). Se registra en `src/videos/index.ts`. En Studio cada reel aparece con su portada (`<Id>-Portada`) y sus escenas sueltas.

## Añadir un vídeo nuevo
1. Copia `src/videos/kemp` a `src/videos/<nuevo>`, cambia `META`, `SCENES` (guion frase a frase, con `keys` y `display`) y `DATA`; escribe o adapta las escenas (cada visual se dispara con `wordAt(frase, "palabra")`).
2. Añádelo a `src/videos/index.ts`.
3. `VIDEO=<nuevo> node tools/estimate.mjs` para previsualizar sin voz; `tools/produce.sh <nuevo>` para voz, alineación, música y render.

## Sincronía palabra a palabra
`public/voz/timings.json` guarda el inicio y el fin de **cada palabra**. Las escenas disparan cada visual con `wordAt(frase, "palabra")` y los subtítulos resaltan la palabra que se está diciendo. Con la voz real, `tools/align.mjs` fija las frases por silencios y `tools/align_words.mjs` (modelo de audio de Gemini, cuota distinta del TTS) reparte las palabras dentro de cada frase; si ese paso falla, se reparten por caracteres.

## Motion (v5): reglas tomadas de los reels de motion graphics hechos con código
Fuentes: skill `haidrrrry/claude-remotion-skill` (motion-patterns, design-rules, theme) y `Maartenlouis/remotion-ads` (animations, captions, ohneis-style). Instagram y TikTok no son accesibles desde el contenedor; se usaron sus guías publicadas en GitHub.
- **Muelles en vez de curvas** (`src/motion.ts`): snappy {14,160,0.6} para palabras e iconos, smooth {20,90,1} para bloques, bouncy {11,170,0.7} para sellos e impactos. Nada lineal.
- **Entrada premium**: aparece + sube 40 px + escala 0,94→1 (bloques) o 0,6→1 (impactos, tipo *popIn*). Escalonado de 2 a 5 frames entre elementos.
- **Salida rápida** en los últimos 10 frames de cada escena (sube 42 px y desaparece), más corta que la entrada, y **respiración** sutil de lo que lleva más de 2,5 s quieto.
- **Cortes**: barrido corto (90 px) con desenfoque de 6 px, 4 frames de salida y 5 de entrada, alternando el sentido; el fondo se mueve al 30 % (parallax); zoom lento que alterna dentro/fuera por escena.
- **Subtítulos**: páginas de 4 palabras como máximo, entrada de página con muelle (30 px), cada palabra sube 8 px al sonar y la activa crece un 5 %.
- **Sonido**: cada efecto entra 2 frames antes de su visual; máximo uno cada 0,3 s.
- Ritmo: golpe → pausa → construcción → golpe; algo se mueve en los primeros 15 frames; ningún tramo de más de 3 s sin un elemento nuevo.

## Estética «Clínico» (v6)
Blanco-gris frío con papel milimetrado fino, una línea de ECG que avanza al pie y aros finos que giran despacio (`components/Background.tsx`). Texto en azul marino casi negro, un solo acento azul clínico para los datos, verde azulado para la prueba, verde para lo correcto y rojo para el error; el amarillo marcador solo en la palabra activa de los subtítulos. Tarjetas blancas con borde fino gris y sombra suave (`STICKER`, `STICKER_SM`), tintes por escena casi imperceptibles, tipografía Nunito. Toda la paleta está en `COLORS` (`src/config.ts`): `white` es el color de texto principal (tinta) y `paper` el blanco de las tarjetas.

## Recursos de enganche (v3)
- **Cold open** de 0,8 s con el dato a pantalla completa antes de la voz (`META.coldOpen`), y el mismo fotograma al final para que el bucle enganche.
- **Pausas recortadas**: `tools/tighten.mjs` acorta a 0,34 s las pausas entre frases de la toma existente (no regenera la voz; guarda `voz_tight.wav` y `timings.orig.json`). Respeta el silencio dramático antes del dato.
- **Cámara continua** (zoom y deriva por escena) y **color por escena** (`tints` en el `VideoDef`), con fogonazo en cada corte.
- **Cadencia**: en `src/Reel.tsx`, `spaceOut()` deja como mucho un efecto de sonido cada 0,3 s (`MIN_GAP`), priorizando impactos y rayos X; los rebotes, temblores y fogonazos están calibrados para que no haya más de un estímulo cada 0,3 s.
- **Cuenta atrás 3-2-1 y 0,3 s de negro** justo antes del dato fuerte; **aviso «guárdalo»** en la escena `saveScene`.
- **Clips reales (B-roll)**: si existe `public/<id>/broll/<escena>.mp4`, se muestra debajo de los rótulos de esa escena (en bucle, sin audio, al 55 %). Graba clips verticales de 3 a 5 s y ponlos ahí.

## Dónde se cambia todo
- `src/config.ts`: textos del guion (frase a frase), palabras resaltadas en los subtítulos, datos, colores y metadatos. **Es el único archivo que hay que tocar para otro vídeo** (más las escenas si el visual cambia).
- `public/voz/timings.json`: tiempos de cada frase (los genera `tools/align.mjs` a partir de la voz, o `tools/estimate.mjs` como estimación mientras no hay voz). `calculateMetadata` lee este archivo y de ahí sale la duración de cada escena y del vídeo.
- `src/scenes/*.tsx`: una escena por archivo. Reciben `c` (frases en frames relativos) y usan `wordAt()` para sincronizar cada animación con la palabra que se dice.
- `src/cues.ts`: efectos de sonido por escena, con los mismos momentos que las animaciones.

## Producir
```bash
npm i
tools/produce.sh kemp            # voz (1 petición TTS) → normalización → alineación → música → render
tools/produce.sh kemp --skip-voice   # solo música + render con los tiempos actuales
npx remotion still Kemp-Portada out/portada-kemp.png
npx remotion studio         # previsualizar
```
Si no hay voz, `tools/estimate.mjs` crea tiempos estimados y el render sale sin voz (hasta que exista `public/voz/voz.wav`).

## Entorno (contenedor en la nube)
- `remotion.config.ts` apunta al Chromium headless preinstalado (remotion.media está bloqueado).
- Fuente Nunito variable local en `public/fonts` (`@remotion/fonts`); nada de `@remotion/google-fonts`.
- Efectos en `public/sfx` generados con ffmpeg; base musical con `tools/make_music.py` (numpy), con hueco de silencio antes del dato fuerte y ducking bajo la voz.
- Gemini TTS: capa gratuita, 10 peticiones/día con `gemini-3.8-flash-tts`. Una sola toma por vídeo. El prompt de estilo exige castellano de España (zeta /θ/, sin seseo); `tools/check_accent.mjs voz.wav` pide a un modelo de audio que lo verifique.

Entregables del primer vídeo (portada, descripción, ganchos alternativos y guion de la parte 2): `ENTREGABLES.md`.
