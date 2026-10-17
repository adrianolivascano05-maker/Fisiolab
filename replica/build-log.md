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
| S13 Velocidad de barra | 2026-10-17 | hecho | detección automática de la barra (fase 5, IA) | el marcado de series se generalizó: alterna dos marcas cualesquiera (despegue/aterrizaje o inicio/fin de la subida) |
| S14 Perfil carga-velocidad | 2026-10-17 | hecho | — | el umbral del 1RM solo está bien establecido en sentadilla, press de banca y peso muerto: en el resto es editable y se marca «por confirmar»; un 1RM por debajo de la carga más alta movida se rechaza |
| S21 Bienestar | 2026-10-17 | hecho | — | se añadió el ánimo (ítem de McLean 2010 que faltaba en el esquema) y el dolor de la lesión (0-10) con la migración 3; un registro por día |
| S19 Movilidad | 2026-10-17 | hecho | ver el sensor en un Android real; nada se puede probar aquí con un sensor de verdad | `deviceorientation` y `devicemotion` no dan la gravedad con el mismo signo en todos los móviles: se usa la primera fuente que llega y el ángulo no depende del signo. Hubo que fijar a mano el color del texto en la leyenda y la ayuda emergente de la gráfica (salía en el color de cada lado, sin contraste) |
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
- Movilidad (2026-10-17, fase 3): 14 movimientos de tobillo (lunge), cadera, hombro y cuello, catálogo en
  `src/calc/rom.ts`. Tres formas de medir: inclinómetro del móvil (cero en la posición de inicio, o inclinación
  respecto a la vertical en el lunge), ángulo sobre foto (2 o 3 puntos, con ajuste fino y teclado; la foto no se
  guarda) y goniómetro a mano. Resultado = media de las lecturas; aviso si difieren más de 5°. Migración 2: métrica
  `wall_distance_cm` para la distancia del dedo gordo a la pared. Resumen por lados (diferencia si se midieron el
  mismo día) y evolución con una línea por lado. CSV con columnas `movimiento` y `metodo`; `salto` pasa a `intento`.
  67 pruebas unitarias y 57 e2e en los dos modos.
- Fuerza (2026-10-17, fase 3): 6 ejercicios (sentadilla, press de banca, peso muerto, press militar, remo tumbado,
  hip thrust). Por vídeo se marcan inicio y fin de cada subida y la velocidad media es recorrido / tiempo; sin vídeo
  se escriben las velocidades de un encoder. Resultado: repetición más rápida, media y pérdida de velocidad. Perfil
  carga-velocidad con la más rápida de cada carga, 1RM a la velocidad del umbral (0,30 sentadilla, 0,17 banca, 0,15
  peso muerto; el resto editable), r², tabla por % 1RM y perfiles guardados. 77 pruebas unitarias y 60 e2e.
- Bienestar (2026-10-17, fase 3): cuestionario diario de 5 preguntas de 1 a 5 (5 = mejor), total de 5 a 25, dolor de
  la lesión aparte. Compara con la media de sus 30 días anteriores (aviso si baja más de una desviación típica, con 3
  registros o más) y avisa de respuestas de 1-2. Gráfica y tabla; un registro por día que se puede corregir. En el CSV
  como test «bienestar». 82 pruebas unitarias y 62 e2e.
