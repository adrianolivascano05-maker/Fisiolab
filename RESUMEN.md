# Impulso · Fisiolab: resumen ejecutivo para continuar

Fecha: 2026-10-17

## 1. Qué es y dónde está

- **App:** Impulso · Fisiolab. Mide el salto por vídeo a cámara lenta: se marcan fotogramas y la app calcula altura, RSI, fuerza, potencia, etc. Es una versión propia, por funciones, de My Jump Lab (Carlos Balsalobre). No usa nada suyo: ni código, ni nombre, ni logo, ni textos.
- **Uso:** interno en la clínica Fisiolab, en el móvil **Android (Pixel 7 Pro)** del usuario.
- **Publicada (versión de prueba):** https://adrianolivascano05-maker.github.io/Fisiolab/
- **Código:** repositorio `adrianolivascano05-maker/Fisiolab` (público). Rama principal y única: `claude/replica-skill-install-zv3ker`. Cada push a esa rama vuelve a publicar la app (GitHub Actions → GitHub Pages).
- **Método:** las skills «replica» instaladas en `.claude/skills/` (recon → architect → design → build → test → diff → brand → deploy). Todos sus documentos están en `replica/`.

## 2. Estado actual

| | |
| --- | --- |
| Funciones imprescindibles | **13 / 13** |
| Paridad con My Jump Lab | **91,7 / 100**: fases 1 a 4 completas; quedan los «could» (sprint curvo, deceleración, S-MAS, IA) |
| Pruebas | 100 unitarias (Vitest) + 70 en navegador (Playwright), en los dos modos de alojamiento |
| Fallos | 7 encontrados, 7 arreglados (`replica/bugs.md`); ninguno abierto |
| Prueba real | vídeo de Pixel 7 Pro (120 fps guardado a 30): 30,7 cm; el usuario confirmó que la app publicada funciona en su Android |
| Barrido de marca | limpio (`sweep.py`) |

**Hecho:**
- Pacientes.
- Saltos: CMJ, CMJ con brazos, SJ, Drop jump (RSI, rigidez, DRI), unipodal con lado, 10/5 y horizontal.
- RSI modificado (marca opcional del inicio del movimiento).
- Perfil fuerza-velocidad con óptimo y desequilibrio.
- Asimetría.
- Fuerza: velocidad media de la barra por vídeo o encoder en 6 ejercicios, pérdida de velocidad, perfil carga-velocidad con 1RM estimado y cargas por % 1RM.
- Sprint lineal: tiempos de paso (vídeo o fotocélulas), tramos y perfil fuerza-velocidad del sprint.
- Cambio de dirección: 5-0-5, 5+5, V-Cut e Illinois; asimetría entre giros y déficit de cambio de dirección.
- Carrera en cinta: contacto, vuelo, frecuencia, factor de apoyo, longitud del paso y asimetría por pie.
- Comparar pacientes: ranking por 21 medidas.
- Nórdico de isquios: ángulo de rotura en el vídeo (o a mano) y momento estimado por pierna.
- Bienestar: cuestionario diario (fatiga, sueño, dolor muscular, estrés y ánimo, de 1 a 5) más dolor de la lesión; total sobre 25, comparación con su media y avisos.
- Movilidad: 14 movimientos de tobillo (lunge), cadera, hombro y cuello, medidos con el inclinómetro del móvil, sobre una foto o con goniómetro; resumen por lados y evolución.
- Evolución con gráfica y tabla.
- Exportación CSV para Excel, y copia de seguridad que se puede restaurar.
- App instalable que funciona sin conexión.
- Ayuda ilustrada.
- Datos de ejemplo.
- Marca propia.

**Pendiente:**
- **Validación** contra My Jump Lab o una plataforma de fuerza: 10-20 saltos medidos a la vez. Hasta entonces, no usar para decisiones clínicas.
- Validar el momento del nórdico con un dinamómetro.
- Comparar la velocidad de barra con un encoder lineal.
- Probar la movilidad con el sensor de un Android real.
- `/replica-entrepreneur`: leer reseñas reales del original para mejorar sobre él.
- Prueba con TalkBack.

**Experimental (se puede quitar):** «Medición libre» (Nueva medición → Medición libre).
- Pose 3D por IA (MediaPipe, Apache 2.0) en el propio móvil.
- Esqueleto superpuesto, plano anatómico con compensación de la perspectiva, filtro One Euro, anclaje a las articulaciones, Δθ e informe CSV.
- Está toda en `src/free/` y usa su propia tabla. Cómo quitarla, en `src/free/README.md`, o con `git revert` de su commit.
- Comprobado: abducción de 90° → 91,6° en una foto de ejemplo; temblor de unos 2° en imagen quieta.

## 3. Decisiones tomadas (y por qué)

1. **Por fases, saltos primero.** El usuario pidió «toda la app»; se construye por fases. Las fases 1 a 4 están hechas.
2. **Web instalable (PWA), no app nativa.** Funciona en cualquier móvil, sin tiendas, sin cuentas de desarrollador y gratis.
3. **Datos solo en el dispositivo:** SQLite WASM sobre OPFS, sin servidor ni cuentas. Son datos de salud (RGPD), con coste 0 € y funcionan sin conexión. Consecuencias:
   - No se sincroniza entre móviles; se pasa la copia de seguridad.
   - Hay recordatorio semanal de copia.
   - Solo una pestaña a la vez (Web Lock); la segunda avisa y se bloquea.
   - Borrar un paciente borra todo lo suyo.
4. **El vídeo no se guarda:** se queda en la galería. Solo se guardan las marcas y los resultados, así que, si cambia una fórmula, se recalcula desde las marcas.
5. **fps de grabación separados de los fps del archivo.**
   - Las cámaras lentas suelen guardarse ralentizadas (el Pixel graba a 120 y guarda a 30).
   - La app lee la etiqueta `com.android.capture.fps` y propone 120 sola.
   - Avisa por debajo de 100 fps.
6. **Fotograma exacto.** Se navega por la hora real de cada fotograma, sacada del índice MP4/MOV con mp4box y calibrada con `requestVideoFrameCallback`. Con 30 fps fijos, el vídeo real mostraba el fotograma siguiente (BUG-005).
7. **Alojamiento: GitHub Pages**, bajo `/Fisiolab/`. Es gratis porque el repo es público y no hace falta cuenta nueva.
   - La CSP va en `<meta>`.
   - `404.html` es la propia app.
   - Cloudflare Workers queda preparado como alternativa (`wrangler.jsonc`, `public/_headers`) para un dominio propio.
8. **Marca: Impulso · Fisiolab.**
   - Paleta propia «petróleo y pizarra».
   - Logo: parábola del salto con un punto en el vértice, sobre el suelo.
   - Voz: precisa, cercana y serena.
   - Las comprobaciones de marca registrada están pendientes; solo harían falta si algún día se vende.
9. **Claude no crea cuentas ni usa claves.** El usuario activó GitHub Pages él mismo (Settings → Pages → Source: GitHub Actions).
10. **Movilidad con tres métodos.** Inclinómetro del móvil (sin aparatos), ángulo sobre foto (si no hay sensor o para dejar constancia) y goniómetro (lo que ya se usa en la clínica).
    - El resultado es la media de las lecturas (se recomiendan 3).
    - La foto no se guarda, como el vídeo.
    - El cuello en flexión, extensión y rotación no se mide con foto: en una sola imagen no sale fiable.
    - No hay valores normales: solo se compara un lado con el otro y la evolución.
11. **Fuerza por vídeo o encoder.** El vídeo sirve sin aparatos; si en la clínica hay un encoder, se escriben sus velocidades.
    - El perfil usa la repetición más rápida de cada carga y se proponen las series del último día.
    - El umbral del 1RM es editable por ejercicio y se puede guardar para siempre.
    - La pérdida de velocidad va de la repetición más rápida a la última.
12. **Bienestar, un registro por día.** Si se rellena dos veces el mismo día, se corrige el primero. El dolor de la lesión se apunta aparte y no suma en el total.
13. **Nórdico: ángulo respecto a la vertical** (0° erguido); se muestra también el ángulo con el suelo. El momento se calcula con los datos actuales del paciente y se presenta como estimación para comparar al mismo paciente.

## 4. Fórmulas acordadas (`src/calc/`)

| medida | fórmula | fuente / estado |
| --- | --- | --- |
| Altura | h = g·t_vuelo² / 8 | Bosco 1983 |
| RSI (DJ) | h / t_contacto | estándar |
| RSI-mod | h / tiempo hasta el despegue | marca opcional «Inicio» |
| Samozino (CMJ, SJ) | F = m·g·(h/hpo + 1); v = √(g·h/2); P = F·v; m = masa + carga | Samozino 2008. No se aplica al CMJ con brazos ni al unipodal |
| Rigidez vertical (DJ) | k = m·π·(tv+tc) / (tc²·((tv+tc)/π − tc/4)) | Dalleau 2004; comprobada con su derivación Fmáx/Δy |
| DRI (DJ) | (caída + altura) / (g·tc²) | Brooks 2026, por fuentes secundarias: **confirmar en el artículo** |
| 10/5 | RSI de cada rebote = h/tc; resultado = media de los 5 mejores (mínimo 6 saltos) | Harper 2011 |
| Perfil F-V | recta F̄(v̄) por mínimos cuadrados, F por kg de masa corporal; F0, V0, Pmáx = F0·V0/4 | Samozino |
| Perfil óptimo | pendiente que maximiza h con la misma Pmáx, **buscada numéricamente** con el modelo macroscópico de Samozino; desequilibrio = \|1 − SFv/SFvopt\|; <100 % = déficit de fuerza | sin la fórmula cerrada del artículo |
| Asimetría | (mejor − peor) / mejor × 100, con el mejor salto de cada pierna del día | estándar |
| Velocidad de barra | recorrido / tiempo de la subida; serie: la más rápida, la media y pérdida = (más rápida − última) / más rápida | estándar |
| Perfil carga-velocidad | recta velocidad = a + b·carga con la repetición más rápida de cada carga; 1RM = carga a la velocidad del umbral | umbral 0,30 sentadilla, 0,17 banca, 0,15 peso muerto; **press militar, remo y hip thrust por confirmar** (editables) |
| Bienestar | suma de 5 respuestas de 1 a 5 (5 = mejor): 5-25; «por debajo de lo habitual» si está más de 1 desviación típica bajo su media de 30 días (mín. 3 registros) | ítems de McLean 2010; **la suma y el umbral son uso habitual, no confirmados en el artículo** |
| Nórdico | ángulo de rotura = inclinación rodilla-cadera respecto a la vertical; momento por pierna = 0,878·masa·g·0,322·estatura·sen θ / 2 | **modelo propio, por validar**: no se encontró la fórmula publicada |
| Sprint | v(t) = V0·(1 − e^(−t/τ)) ajustado a los pasos; F0 = V0/τ, Pmáx = F0·V0/4 | Samozino 2016 **sin resistencia del aire** (F0 y V0 algo menores que el método completo) |
| Cambio de dirección | déficit = 5-0-5 − mejor paso a 10 m; asimetría = (lento − rápido) / rápido | Nimphius 2013 |
| Carrera | contacto, vuelo, frecuencia = 60 / paso, factor de apoyo = contacto / (2·paso), longitud = velocidad·paso | estándar |
| Movilidad (móvil) | ángulo entre la dirección «arriba» al poner a cero y la actual; lunge: inclinación del borde largo respecto a la vertical | geometría; vale si el segmento se mueve en un plano vertical |
| Movilidad (foto) | ángulo en el eje entre 3 puntos, pasado al valor clínico (directo, 180° − ángulo o ángulo − 90°); o inclinación de 2 puntos respecto a la vertical | goniometría estándar |
| Movilidad (resultado) | media de las lecturas; aviso si difieren más de 5° | criterio propio |

Avisos de plausibilidad: altura fuera de 3-80 cm y contacto fuera de 80-900 ms.

## 5. Marca (texto final)

- **Nombre:** «Impulso» (completo «Impulso · Fisiolab»).
- **Colores (`replica/design/tokens.json`):**
  - acción `#0e6672` (petróleo), hover `#0a4f59`
  - texto `#0f2530`, texto secundario `#4c5e66`
  - superficie `#f3f6f7`, bordes `#dce3e6`
  - gráficas `#0083a3` y `#b4532a` (cobre)
  - peligro `#b42318`, éxito `#19764a`, aviso `#8a5300`
  - 41 pares AA, 0 fallos; el par de gráficas pasa el validador de daltonismo.
- **Logo:** `src/ui/Logo.tsx` (SVG). Iconos generados con `tools/build-icons.py`.
- **Voz:** precisa (no técnica de más), cercana (no coloquial), serena (no fría). Textos clave:
  - «Todavía no hay pacientes» / «Añade a tu primer paciente y mide su salto en un par de minutos.»
  - «Nueva medición»
  - «Calcular resultado»
  - «Paciente añadido»
  - «Ten Impulso a un toque»
  - «El vídeo no sale de tu galería: Impulso solo guarda las marcas y el resultado.»

## 6. Código: mapa y comandos

```
src/calc/        fórmulas puras + tests (jump, results, repeated, profile, asymmetry, video, rom)
src/data/        SQLite: worker, motor, migraciones (001_init, 002_rom), repo.ts (una función por operación), seed
src/calc/strength.ts y src/pages/Strength*, VbtResult, LoadVelocityPage: fuerza
src/rom/         useInclinometer.ts (sensor), PhotoProtractor.tsx (ángulo sobre foto)
src/video/       meta.ts (fps, fps de grabación Android, horas de fotogramas), timeline.ts, useTimeline.ts
src/pages/       una pantalla por archivo (S01 PatientsPage … S25 JumpHelp); rutas en src/App.tsx
src/ui/          componentes del sistema de diseño (FrameScrubber, MetricCard, Sheet, Logo…)
e2e/             pruebas Playwright por flujo (fixtures.ts con ayudas)
replica/         recon, arquitectura, diseño, test-plan, bugs, paridad, marca, despliegue
tools/           build-tokens.mjs, build-icons.py, serve-dist.mjs (sirve el build como el alojamiento)
```

Pila: Vite + React 19 + TypeScript + Tailwind 4 (tokens) + React Router + SQLite WASM (OPFS) + mp4box + Recharts + vite-plugin-pwa.

```bash
npm ci
npm test               # unitarias
npm run e2e            # navegador, en la raíz (cabeceras de Cloudflare)
npm run e2e:ghpages    # navegador, bajo /Fisiolab/ como GitHub Pages
npm run build          # tokens + typecheck + build
python3 tools/build-icons.py
python3 .claude/skills/replica-design/contrast.py replica/design/tokens.json
python3 .claude/skills/replica-brand/sweep.py . --config replica/brand.json
python3 .claude/skills/replica-diff/parity.py replica/features.csv
```

Convenciones:
- Commits en inglés, con una línea de título y el cuerpo.
- La app y la documentación, en español.
- Pruebas antes de cada push: el push publica.
- Los vídeos del usuario no se suben al repositorio.

## 7. Siguientes pasos recomendados

1. **Validación:** pantalla o CSV para anotar la altura de My Jump Lab junto a la de Impulso y calcular la diferencia media.
2. **Extras («could»):** sprint curvo, deceleración, S-MAS y detección automática con IA (fase 5).
3. **`/replica-entrepreneur`:** quejas reales de los usuarios del original, convertidas en mejoras.
4. **Confirmar el DRI** en el artículo de Brooks (2026).
