# Ángulos en vídeo con IA (medición libre, experimental)

Goniometría dinámica en vídeo con pose 3D estimada por IA (MediaPipe Pose Landmarker, Apache 2.0),
dentro del navegador: el vídeo no sale del móvil. Se entra desde Nueva medición → Movilidad → «Ángulos en
vídeo con IA». Sus mediciones se guardan en la tabla `free_measurements` (migración 012) y se sincronizan con la
copia de la nube como el resto.

El motor de pose (`src/ai/pose.ts` y el modelo en `src/ai/assets/`) es compartido: también lo usa la
propuesta automática de marcas (despegue, aterrizaje, velocidad de barra). No es parte de este módulo y no
se borra al quitarlo.

## Qué hay aquí

| archivo | qué hace |
| --- | --- |
| `types.ts` | interfaces de la medición (`BiomechanicalMeasurement`, `KeyframeData`, `Landmark3D`) |
| `joints.ts` | puntos del modelo, puntos derivados (≈ C7, ≈ sacro), esqueleto y mediciones preparadas |
| `geometry.ts` | ángulo 2D (atan2), ángulo 3D (producto escalar), ejes del cuerpo, proyección en el plano anatómico, filtro One Euro, Δθ |
| `auto.ts` | autocompletado al analizar: elige la medición que más se mueve y marca inicio, pico y fin |
| `store.ts` | guardar y leer en `free_measurements` e informe CSV |
| `FreeMeasurePage.tsx`, `FreeDetailPage.tsx`, `routes.tsx` | pantallas y rutas |
| `*.test.ts`, `e2e/free.spec.ts` | pruebas |

## Cómo quitarlo

1. Borrar la carpeta `src/free/` y `e2e/free.spec.ts`.
2. `src/App.tsx`: quitar la línea `import { freeRoutes } …` y la línea `...freeRoutes,`.
3. `src/pages/RomSetupPage.tsx`: quitar el enlace «Ángulos en vídeo con IA».
4. Nada más en `vite.config.ts` ni en `package.json`: el motor de pose lo sigue usando `src/ai`.
5. La tabla `free_measurements` es de una migración: se queda (sin uso) salvo que otra migración la borre, con
   sus tres disparadores de sincronización y su línea en `SYNC_TABLES` (`src/data/syncMerge.ts`).
