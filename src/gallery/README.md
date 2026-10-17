# Galería de tests de exploración (módulo independiente)

Pestaña «Exploración»: tests diferenciales agrupados por articulación y, dentro de cada una, por patología.
Cada test tiene ilustración propia, posición, pasos, qué es positivo, cómo interpretarlo, precauciones, datos de
precisión con su fuente y una calculadora de probabilidad tras el test (razones de verosimilitud). No guarda nada
en la base de datos: solo los favoritos, en el navegador.

## Qué hay aquí

| archivo | qué hace |
| --- | --- |
| `types.ts` | tipo `SpecialTest` (texto, evidencia, figuras) |
| `figure.ts` | descripción de cada figura (`FigureSpec`: postura, ángulos, manos, flechas, síntoma), fases de la animación y el dibujo plano, que se usa si el navegador no tiene WebGL |
| `three/` | figuras en 3D (three.js): maniquíes de paciente y examinador movidos por un esqueleto (los segmentos nunca cambian de longitud), camilla, flechas, síntoma y etiquetas; la cámara se elige sola para que se vean las manos y la zona del test, y se puede girar |
| `three/rig.ts` | esqueleto: medidas, ángulos a partir de la `FigureSpec`, cinemática directa y puntos del cuerpo |
| `three/layout.ts`, `three/examiner.ts` | dónde va el paciente (suelo, camilla, borde) y dónde se pone el examinador (si no llega desde un sitio, se desplaza durante la maniobra), cuánto se agacha, sus brazos (cinemática inversa) y la toma de cada mano (`grips` en la figura: palma que presiona, mano que abarca el segmento o yemas que palpan, y en qué cara) |
| `three/person.ts`, `three/stage.ts` | mallas de los maniquíes (con boca que se abre: articulación `jaw`) y la escena (luces, sombras, cámara, giro con el dedo) |
| `three/cameras.json` | cámaras precalculadas; si se cambia una figura, se rehace con `scripts/gallery3d-cameras.mjs` (la prueba `three/rig.test.ts` avisa) |
| `AnimatedFigure.tsx` | reproductor: 3D (o dibujo plano), pausa, avance manual, giro y texto de cada fase; respeta «reducir movimiento» |
| `Disclosure.tsx` | desplegables que recuerdan si se dejaron abiertos |
| `data/*.ts` | contenido, un archivo por región; `data/index.ts` los junta |
| `evidence.ts` | razones de verosimilitud y probabilidad tras el test |
| `regions.ts` | articulaciones y su orden |
| `GalleryPages.tsx`, `routes.tsx`, `useFavorites.ts` | pantallas, rutas y favoritos |
| `scripts/gallery-sheet.mjs` | hoja de contacto de las figuras planas |
| `scripts/gallery3d.html`, `scripts/gallery3d-shot.mjs` | hoja de contacto de las figuras 3D (con `npx vite --port 5199`): `node scripts/gallery3d-shot.mjs hoja.png "region=rodilla"` |

## Cómo quitarlo

1. Borrar `src/gallery/`, `scripts/gallery-sheet.mjs`, `scripts/gallery-samples.mjs`, `scripts/gallery3d*` y `e2e/gallery.spec.ts`,
   y quitar `three` y `@types/three` de `package.json` (`npm uninstall three @types/three`).
2. `src/App.tsx`: quitar la línea `import { galleryRoutes } …` y la línea `...galleryRoutes,`.
3. `src/ui/AppBar.tsx`: quitar la línea de la pestaña «Exploración» y `BookOpen` del import.

## Fuentes

El texto está redactado para la app. Los números de sensibilidad, especificidad y LR se tomaron de revisiones y
estudios publicados, comprobados con el buscador (en este entorno no se pueden abrir las revistas); cada fila
lleva su cita. Antes de citarlos en un informe, consulta la fuente original.
