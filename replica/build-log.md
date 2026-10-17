# Registro de construcción

Pantallas del recon: 25. Construidas: 14 (S01-S12, S22, S24, S25).
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
| S06 Vídeo | 2026-10-17 | hecho | ver el vídeo HEVC reproducirse en el Chrome del móvil | los vídeos a cámara lenta pueden venir "ralentizados" a 30 fps: hay que separar los fps del archivo (para moverse por el vídeo) de los de grabación (para calcular) |
| S07 Marcado | 2026-10-17 | hecho | — | las marcas de un salto quedan muy juntas en la barra: hizo falta una lupa |
| S08 Resultado | 2026-10-17 | hecho | — | — |
| S09 Perfil fuerza-velocidad | 2026-10-17 | hecho | — | la fórmula cerrada del perfil óptimo no estaba accesible: se busca numéricamente con el mismo modelo y se comprobó que recupera F0/V0 de saltos simulados |
| S10 Asimetría | 2026-10-17 | hecho | — | — |
| S11 Saltos 10/5 | 2026-10-17 | hecho | — | el marcado pasó a admitir series (despegue/aterrizaje alternos, deshacer) |
| S12 Salto horizontal | 2026-10-17 | hecho | medida por vídeo (se anota la distancia) | — |
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
- Vídeo real (2026-10-17, Pixel 7 Pro): cámara lenta a 120 fps guardada a 30 fps en HEVC, 412 fotogramas a un ritmo
  irregular (media 30,08 fps) y con la etiqueta com.android.capture.fps. Llevó a leer esa etiqueta (S06 propone 120
  solo) y a moverse por la hora real de cada fotograma (BUG-005). Medido en la app: 30,7 cm.
- Fase 2 de saltos (2026-10-17): CMJ con brazos, unipodal con lado, 10/5, horizontal, RSI-mod, rigidez (Dalleau),
  DRI (Brooks), perfil F-V con óptimo y desequilibrio, asimetría. 52 pruebas unitarias y 51 e2e (en la raíz y bajo
  /Fisiolab/). Datos de ejemplo de fase 2 en «Ejemplo · Marcos Vidal».
