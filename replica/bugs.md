# Fallos

Abiertos: ninguno. S1: 0 · S2: 2 (arreglados) · S3: 3 (arreglados) · S4: 2 (arreglados).

### BUG-000: «Cargar datos de ejemplo» podía dejar la carga a medias

- Severity: S3
- Flow / case: F15 / F15-E1
- Screen: S24
- Build: antes de b1742e5  Browser / device: Chromium 1194, 390 px

Steps
1. Abrir Ajustes con la base vacía y pulsar «Cargar datos de ejemplo» enseguida.
2. Ir a la lista de pacientes.

Expected: 3 pacientes de ejemplo con todos sus tests.
Actual: el botón cambiaba a «Borrar» a los 400 ms (la consulta inicial se resolvía tras el primer
paciente insertado); al salir de la pantalla se cortaba la carga: Lucía con 2 CMJ en vez de 5.
Evidence: gráfica de evolución con 2 puntos; trazas de tiempos en consola.
Status: fixed in b1742e5 (encontrado durante la construcción; regresión cubierta por F15-E1)

### BUG-001: una segunda pestaña trabaja en una base vacía y pierde lo que se escribe

- Severity: S2
- Flow / case: F15 / F15-E2
- Screen: todas
- Build: b1742e5  Browser / device: Chromium 1194, 390 px

Steps
1. Abrir la app y crear un paciente.
2. Abrir la app en otra pestaña.

Expected: la segunda pestaña ve los datos o avisa claramente y no deja trabajar.
Actual: la segunda pestaña no puede abrir la base (OPFS solo admite una) y usa una base en memoria:
lista vacía y el aviso engañoso «Este navegador no guarda los datos… Abre la app en Safari o Chrome».
Lo que se cree ahí se pierde al cerrarla.
Evidence: F15-E2 falló en b1742e5.
Status: fixed in 6b86c64 (Web Lock en el worker y pantalla «La app ya está abierta en otra pestaña» con Reintentar)

### BUG-002: la pantalla de marcado de un test borrado se queda «Cargando…» para siempre

- Severity: S3
- Flow / case: F02 / F02-N2
- Screen: S07
- Build: b1742e5  Browser / device: Chromium 1194, 390 px

Steps
1. Medir un CMJ y borrarlo.
2. Abrir /tests/<id>/marcar (por ejemplo, desde el historial del navegador).

Expected: «Este test no existe.»
Actual: «Cargando…» indefinidamente (no distinguía «cargando» de «no existe»).
Evidence: F02-N2, instantánea con solo «Cargando…».
Status: fixed in 2bcec1a

### BUG-003: los botones de marcar dicen una cosa en pantalla y otra al lector de pantalla

- Severity: S3
- Flow / case: F02 / F02-H1, L-390
- Screen: S07, /design
- Build: b1742e5  Browser / device: Chromium 1194, 390 px

Steps
1. Abrir el marcado de un salto y pasar axe.

Expected: el nombre accesible empieza por el texto visible (WCAG 2.5.3): quien usa control por voz dice «Despegue».
Actual: visible «D Despegue», nombre «Marcar despegue en este fotograma» (axe label-content-name-mismatch).
Evidence: axe en F02-H1 y en las pantallas a 390/1440 px.
Status: fixed in 8b1622f (nombre «Despegue: marcar en este fotograma» con texto solo para lector)

### BUG-004: al guardar un paciente con errores, el foco no va al campo con error

- Severity: S4
- Flow / case: F01 / F01-E1
- Screen: S03
- Build: b1742e5  Browser / device: Chromium 1194, 390 px

Steps
1. Nuevo paciente → «Crear paciente» sin nombre.

Expected: el foco salta a «Nombre» y se lee su error.
Actual: el foco se queda en el botón (se buscaba el campo antes de pintar los errores).
Evidence: F01-E1 «toBeFocused» falló.
Status: fixed in 0497972

### BUG-005: en vídeos reales se veía el fotograma siguiente al marcado

- Severity: S2
- Flow / case: F02 / F02-E10
- Screen: S07
- Build: e3f013f  Browser / device: Chromium 1194, 412 px; vídeo real de Pixel 7 Pro (120 fps guardado a 30)

Steps
1. Subir el vídeo del Pixel y llevar la barra al fotograma 211 (también 271 y 400).
2. Comparar la imagen con el fotograma 211 extraído con ffmpeg.

Expected: se ve el fotograma 211.
Actual: se veía el 212 (y el 272, el 401). El salto entre fotogramas se calculaba con 30 fps exactos y el
archivo va a 30,08 fps con irregularidades de 31-36 ms: a partir de ~190 fotogramas el error es de uno. En
este salto no cambió la altura (las dos marcas se movían igual), pero en otros podía mover una marca
8 ms (~1 cm).
Evidence: comparación de imágenes app/ffmpeg; F02-E10 falla en la versión anterior (pide 300, ve 301).
Status: fixed in ed5d1d0 (hora real de cada fotograma desde el índice del archivo y calibración con requestVideoFrameCallback)

### BUG-006: los avisos tapaban los botones de marcar

- Severity: S4
- Flow / case: F02 / F01-E7
- Screen: S07 y todas
- Build: e3f013f  Browser / device: Chromium 1194, 412 px

Steps
1. Crear un paciente y empezar enseguida un salto.

Expected: el aviso «Paciente creado» no tapa nada importante.
Actual: durante 4 s quedaba encima del botón «Despegue».
Evidence: captura del marcado con el vídeo real.
Status: fixed in 3f13bec (avisos arriba, bajo la barra de título)

## Por comprobar (no reproducido)

- Reproducción de vídeos HEVC (H.265) en el Chrome del móvil: el Pixel 7 Pro graba en HEVC y el Chromium de las pruebas no lo reproduce; la prueba se hizo con el mismo vídeo convertido a VP9 (mismos 412 fotogramas y horas). Pasada manual M1.
