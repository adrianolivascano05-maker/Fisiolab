# Medición libre (módulo experimental)

Goniometría dinámica en vídeo con pose 3D estimada por IA (MediaPipe Pose Landmarker, Apache 2.0),
dentro del navegador: el vídeo no sale del móvil. Autocontenido para poder quitarlo sin tocar el resto.

## Qué hay aquí

| archivo | qué hace |
| --- | --- |
| `types.ts` | interfaces de la medición (`BiomechanicalMeasurement`, `KeyframeData`, `Landmark3D`) |
| `joints.ts` | puntos del modelo, puntos derivados (≈ C7, ≈ sacro), esqueleto y mediciones preparadas |
| `geometry.ts` | ángulo 2D (atan2), ángulo 3D (producto escalar), ejes del cuerpo, proyección en el plano anatómico, filtro One Euro, Δθ |
| `auto.ts` | autocompletado al analizar: elige la medición que más se mueve y marca inicio, pico y fin |
| `pose.ts` | carga del modelo (`assets/pose_landmarker_full.task`) y del motor wasm, detección por fotograma |
| `store.ts` | tabla propia `free_measurements` (la crea el módulo; no es una migración) e informe CSV |
| `FreeMeasurePage.tsx`, `FreeDetailPage.tsx`, `routes.tsx` | pantallas y rutas |
| `*.test.ts`, `e2e/free.spec.ts` | pruebas |

## Cómo quitarlo

1. Borrar la carpeta `src/free/` y `e2e/free.spec.ts`.
2. `src/App.tsx`: quitar la línea `import { freeRoutes } …` y la línea `...freeRoutes,`.
3. `src/pages/TestPickerPage.tsx`: quitar la línea de la categoría `libre` y `ScanLine` del import.
4. `vite.config.ts`: quitar `"**/vision_*"` de `globIgnores` y la línea `runtimeCaching` de la medición libre.
5. `npm uninstall @mediapipe/tasks-vision`.
6. Opcional, para borrar también las mediciones guardadas: `drop table free_measurements` (si no, la tabla
   queda sin uso y no molesta; se borra sola con los pacientes).

O, si se añadió en un único commit, `git revert <commit>`.
