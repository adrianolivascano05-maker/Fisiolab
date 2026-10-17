# Fallos

Abiertos: ninguno. S1: 0 · S2: 1 (arreglado) · S3: 3 (arreglados) · S4: 1 (arreglado).

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

## Por comprobar (no reproducido)

- Cómo llega un vídeo a cámara lenta del iPhone al elegirlo desde Safari (fps reales o convertido): pasada manual M1-M2.
- Sin conexión la app no abre: es esperado hasta hacerla instalable (PWA); no es un fallo, es trabajo pendiente.
- Safari puede borrar los datos de una web no instalada tras 7 días sin uso: mismo trabajo pendiente.
