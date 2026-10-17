# Registro de construcción

Pantallas del recon: 25. Construidas: 10 (S01-S08, S22, S24, S25).
El resto tienen ruta y muestran en qué fase llegan.

Comprobación de cada pantalla: flujo completo en Chromium a 390 px (táctil) con vídeos sintéticos
VP9 a 240 fps y a 30 fps "ralentizado", base real en OPFS, recarga de página, sin errores de consola;
S01 también a 1440 px. Capturas en `replica/clone-screens/`.

| ID | fecha | estado | falta | más difícil de lo esperado |
| --- | --- | --- | --- | --- |
| S01 Pacientes | 2026-10-17 | hecho | — | — |
| S02 Ficha | 2026-10-17 | hecho | — | — |
| S03 Paciente nuevo/editar | 2026-10-17 | hecho | — | validar con coma decimal y los mismos rangos que la base |
| S04 Selector de test | 2026-10-17 | hecho | las categorías de fases 2-4 llevan a "próximamente" | — |
| S05 Configurar salto | 2026-10-17 | hecho | — | — |
| S06 Vídeo | 2026-10-17 | parcial | probar con un vídeo real de iPhone (Safari) | los vídeos a cámara lenta pueden venir "ralentizados" a 30 fps: hay que separar los fps del archivo (para moverse por el vídeo) de los de grabación (para calcular) |
| S07 Marcado | 2026-10-17 | hecho | — | las marcas de un salto quedan muy juntas en la barra: hizo falta una lupa |
| S08 Resultado | 2026-10-17 | hecho | — | — |
| S22 Evolución | 2026-10-17 | hecho | — | — |
| S24 Ajustes | 2026-10-17 | hecho | — | carrera al cargar datos de ejemplo: el botón se mostraba antes de saber si ya había datos (arreglado) |
| S25 Ayuda | 2026-10-17 | hecho | ayuda de los tests de fases 2-4 cuando se construyan | dibujar la sentadilla para que no pareciera sentado; que la cabeza no se cortara en el vuelo |

Notas:
- El Chromium de las pruebas no reproduce H.264 (Safari y Chrome sí). Las pruebas en navegador usan
  VP9; las de lectura de fps usan además H.264 en .mov con el índice al final, como el iPhone.
- PWA (2026-10-17): instalable, abre y mide sin conexión (precaché 2,4 MB, sobre todo el motor SQLite),
  aviso de versión nueva sin recarga automática (no corta un marcado), tarjeta de instalación con pasos
  propios para iPhone (no tiene botón de instalar), recordatorio semanal de copia y estado de protección
  de datos en Ajustes. Iconos provisionales hasta /replica-brand (`tools/build-icons.py`).
- Pendiente de comprobar en un iPhone real: instalación desde Safari y que los datos persisten instalada.
- El paquete inicial pesa ~370 KB; las gráficas y el lector de vídeo se cargan solo al usarlos.
