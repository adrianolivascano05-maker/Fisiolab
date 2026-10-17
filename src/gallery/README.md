# Galería de tests de exploración (módulo independiente)

Pestaña «Exploración»: tests diferenciales agrupados por articulación y, dentro de cada una, por patología.
Cada test tiene ilustración propia, posición, pasos, qué es positivo, cómo interpretarlo, precauciones, datos de
precisión con su fuente y una calculadora de probabilidad tras el test (razones de verosimilitud). No guarda nada
en la base de datos: solo los favoritos, en el navegador.

## Qué hay aquí

| archivo | qué hace |
| --- | --- |
| `types.ts` | tipo `SpecialTest` (texto, evidencia, figuras) |
| `figure.ts` | generador de ilustraciones: paciente y examinador con cuerpo y ropa, camilla o silla, flechas y zona de síntoma; anima la maniobra en bucle (colocación → maniobra → qué buscar) |
| `AnimatedFigure.tsx` | reproductor: pausa, avance manual y texto de cada fase; respeta «reducir movimiento» |
| `Disclosure.tsx` | desplegables que recuerdan si se dejaron abiertos |
| `data/*.ts` | contenido, un archivo por región; `data/index.ts` los junta |
| `evidence.ts` | razones de verosimilitud y probabilidad tras el test |
| `regions.ts` | articulaciones y su orden |
| `GalleryPages.tsx`, `routes.tsx`, `useFavorites.ts` | pantallas, rutas y favoritos |
| `scripts/gallery-sheet.mjs` | hoja de contacto de todas las figuras para revisarlas |

## Cómo quitarlo

1. Borrar `src/gallery/`, `scripts/gallery-sheet.mjs`, `scripts/gallery-samples.mjs` y `e2e/gallery.spec.ts`.
2. `src/App.tsx`: quitar la línea `import { galleryRoutes } …` y la línea `...galleryRoutes,`.
3. `src/ui/AppBar.tsx`: quitar la línea de la pestaña «Exploración» y `BookOpen` del import.

## Fuentes

El texto está redactado para la app. Los números de sensibilidad, especificidad y LR se tomaron de revisiones y
estudios publicados, comprobados con el buscador (en este entorno no se pueden abrir las revistas); cada fila
lleva su cita. Antes de citarlos en un informe, consulta la fuente original.
