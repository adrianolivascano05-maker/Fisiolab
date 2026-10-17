# Arquitectura: app de medición de Fisiolab (reconstrucción de las funciones de My Jump Lab)

Lee: `replica/recon.md`, `replica/features.csv`. Esquema: `src/data/migrations/001_init.sql` (antes `replica/schema.sql`).
Fecha: 2026-10-17

## Decisión principal: todo en el móvil, sin servidor

El recon fijó tres cosas: web para el móvil, uso interno en la clínica y datos
de salud de pacientes. Con eso, la pila por defecto del método (Postgres en la
nube, login, pagos, emails) sobra y además añadiría riesgo: un servidor con
datos de salud obliga a contratos de encargado de tratamiento, copias, cifrado
y un coste mensual. La app será una **web instalable (PWA) que guarda todo en
el propio dispositivo** y funciona sin conexión. My Jump Lab hace lo mismo: los
datos viven en el iPhone.

Lo que se pierde: no hay sincronización entre dos móviles. Cada fisio tiene
sus datos en su dispositivo; se pasan con el archivo de copia de seguridad.

## Pila

| capa | elección | por qué |
| --- | --- | --- |
| web | Vite + React + TypeScript | app estática sin servidor; Next.js no aporta nada si no hay backend |
| PWA | vite-plugin-pwa (Workbox) | se instala en la pantalla de inicio, funciona sin conexión y en iPhone evita que Safari borre los datos |
| estilos | Tailwind con los tokens de `/replica-design` | lo que asume el pack |
| rutas | React Router | pocas pantallas, todas en el cliente |
| base de datos | SQLite WASM oficial (`@sqlite.org/sqlite-wasm`) con el VFS `opfs-sahpool` | SQL de verdad con claves foráneas y restricciones; persiste en OPFS; `opfs-sahpool` funciona en Safari 16.4+ sin cabeceras COOP/COEP; la copia de seguridad es un único archivo `.sqlite` |
| lectura de vídeo | mp4box.js | lee del contenedor MP4/MOV la hora exacta de cada fotograma, sin decodificar el vídeo entero; así se sabe el fps real |
| navegación por fotogramas | `<video>` + `requestVideoFrameCallback` | saltar al fotograma exacto con la hora leída por mp4box |
| gráficas | Recharts | evolución, recta F-v y carga-velocidad, barras de asimetría |
| sensores | `DeviceOrientationEvent` (con `requestPermission()` en iOS) | inclinómetro para la movilidad (S19) |
| cálculos | módulo `src/calc/` puro, sin dependencias | todas las fórmulas aisladas y con tests |
| tests | Vitest (fórmulas y datos) + Playwright (flujos) | Playwright ya está en el entorno |
| IA (fase 5, opcional) | MediaPipe Pose Landmarker (Apache 2.0) en el navegador | modelo abierto; nunca los del original |
| auth | ninguna; bloqueo del propio móvil + PIN opcional de la app | no hay servidor que proteger; ver "partes que muerden" |
| pagos | ninguno | uso interno |
| email | ninguno | — |
| tareas programadas | ninguna; recordatorio de copia de seguridad al abrir la app | no hay servidor |
| alojamiento | cualquier hosting estático con HTTPS (la decisión es de `/replica-deploy`) | los sensores y la PWA exigen HTTPS; hay opciones gratuitas, pero se elegirá contigo |

Coste mensual previsto: 0 €.

## Esquema

Tablas: 9 (`patients`, `tests`, `videos`, `marks`, `results`, `profiles`,
`profile_tests`, `wellness`, `settings`). Ver `src/data/migrations/001_init.sql`.

Reglas de acceso: **no hay RLS ni comprobaciones por usuario**, porque no hay
usuarios ni servidor: quien tiene el móvil desbloqueado tiene los datos. La
protección es el bloqueo del dispositivo y un PIN opcional de la app.

Adaptaciones del método a SQLite, decididas y no por defecto:

- `id` es texto UUID generado con `crypto.randomUUID()` (SQLite no tiene `gen_random_uuid()`).
- Fechas en texto ISO 8601 en UTC; se muestran en `Europe/Madrid`.
- Sin columna de propietario: hay un solo dueño, el dispositivo.
- `on delete cascade` en todo lo que cuelga de un paciente: borrar un paciente
  borra todos sus datos (derecho de supresión del RGPD).
- Se guardan siempre las **marcas** del vídeo y no solo el resultado. Si una
  fórmula se corrige, los resultados se recalculan (`formula_version`).
- Restricciones que el recon pidió: el DJ exige altura de caída; masas y
  medidas con rangos plausibles; una sola marca por evento y número de salto.

Comprobado con SQLite 3.45: crea las 9 tablas; rechaza un DJ sin altura, un
tipo de test inexistente, una marca duplicada, una clave foránea rota y una
masa de 900 kg; y borrar un paciente deja a cero sus tests, marcas y resultados.

## Fórmulas (`src/calc/`)

Todas son ciencia publicada; ninguna se copia de la app. Cada una tendrá tests
con valores de los artículos. Las marcadas "por confirmar" se implementan solo
tras leer el artículo original.

| métrica | fórmula | fuente | estado |
| --- | --- | --- | --- |
| altura del salto | h = g·t_vuelo² / 8 | Bosco et al. 1983 | segura |
| RSI | h (m) / t_contacto (s) | literatura de drop jump | segura |
| RSI-mod | h (m) / tiempo hasta el despegue (s) | fuente 4 del recon | segura |
| fuerza, velocidad, potencia en salto | F = m·g·(h/hpo + 1); v = √(g·h/2); P = F·v | Samozino 2008 y 2016 (fuentes 9 y 10) | segura |
| perfil F-V | recta F-v por mínimos cuadrados sobre 2+ cargas; F0, V0; Pmáx = F0·V0/4 | Samozino | segura |
| perfil óptimo y desequilibrio | FVimb = 100·(1 − Sfv/Sfv_opt) | Samozino et al. 2012 | Sfv_opt por confirmar |
| rigidez vertical | k = m·π·(tv+tc) / (tc²·((tv+tc)/π − tc/4)) | Dalleau et al. 2004 | por confirmar con el artículo |
| DRI | — | Brooks 2026 | por confirmar |
| asimetría | (mejor − peor) / mejor · 100 | índice habitual (Bishop) | segura; el original no publica el suyo |
| velocidad de barra | recorrido (m) / (t_fin − t_inicio) | — | segura |
| 1RM | carga a la velocidad mínima (VMT) en la recta carga-velocidad | González-Badillo, Balsalobre 2018 | VMT configurable por ejercicio |
| pérdida de velocidad | (mejor − última) / mejor · 100 | — | segura |
| frecuencia de paso | 60 / (t_contacto + t_vuelo) | fuente 11 | segura |
| ángulo (ROM, nórdico) | inclinómetro o ángulo entre 3 puntos sobre la imagen | — | segura |
| torque del nórdico | — | literatura del nórdico | por confirmar |

## API

No hay API de red. La "API" es la capa de datos local (`src/data/`), con una
función por operación. Todas validan la entrada y escriben en una transacción.

| función | hace | entrada | salida | flujo |
| --- | --- | --- | --- | --- |
| `listPatients(query)` | lista y busca | texto | pacientes | F01, F14 |
| `createPatient` / `updatePatient` | alta y edición | datos del paciente | paciente | F01 |
| `deletePatient(id)` | borra el paciente y todo lo suyo | id | — | RGPD |
| `readVideoMeta(file)` | lee fps, nº de fotogramas y horas de cada fotograma con mp4box | archivo | metadatos | F02-F12 |
| `createTest(patientId, type, params)` | crea el test | tipo, carga, altura de caída, lado | test | F02-F12 |
| `saveMarks(testId, marks)` | guarda o reemplaza las marcas | marcas | — | F02-F12 |
| `computeResults(testId)` | aplica `src/calc/` a las marcas y guarda los resultados | id | resultados | F02-F12 |
| `buildProfile(patientId, kind, testIds)` | calcula el perfil F-V o carga-velocidad | tests | perfil | F04, F07 |
| `saveWellness(patientId, answers)` | guarda el cuestionario | 4 escalas | — | F13 |
| `history(patientId, type, metric)` | serie temporal | — | puntos | F14 |
| `ranking(type, metric)` | mejor resultado de cada paciente | — | tabla | F15 |
| `exportCsv()` | exporta todo a CSV | — | archivo | F15 |
| `exportBackup()` / `importBackup(file)` | copia de seguridad del archivo SQLite | — / archivo | archivo / — | F15 |
| `recomputeAll()` | recalcula los resultados tras cambiar una fórmula | — | — | mantenimiento |

Rutas de la app (cliente):

| ruta | pantalla |
| --- | --- |
| `/` | S01 Pacientes |
| `/pacientes/nuevo`, `/pacientes/:id/editar` | S03 |
| `/pacientes/:id` | S02 Ficha |
| `/pacientes/:id/test` | S04 Selector |
| `/pacientes/:id/test/:tipo` | S05 y configuración de cada test |
| `/tests/:id/video` | S06 |
| `/tests/:id/marcar` | S07 |
| `/tests/:id` | S08 y resultados de cada test |
| `/pacientes/:id/perfil/:tipo` | S09 / S14 |
| `/pacientes/:id/asimetria` | S10 |
| `/pacientes/:id/bienestar` | S21 |
| `/pacientes/:id/evolucion/:tipo` | S22 |
| `/comparar` | S23 |
| `/ajustes` | S24 |

Webhooks de entrada: ninguno. De salida: ninguno. Tareas programadas: ninguna.
No se usa ninguna API privada de My Jump Lab.

## Las partes que muerden

- **Precisión del fotograma (la más importante).** A 240 fps, un fotograma son
  4,2 ms; a 30 fps, 33 ms. En un CMJ de 30 cm (vuelo ≈ 495 ms), errar un
  fotograma a 30 fps cambia la altura unos 4 cm; a 240 fps, unos 0,5 cm. La app
  leerá la hora real de cada fotograma con mp4box y **avisará si el vídeo tiene
  menos de 100 fps**. Se probará con vídeos reales de iPhone antes que nada.
- **El selector de fotos del iPhone puede convertir el vídeo.** Al elegir un
  vídeo a cámara lenta desde Safari, iOS puede entregar una versión
  recodificada a 30 fps. Hay que probarlo en el primer paso de la construcción
  y, si pasa, explicar cómo compartir el original (por ejemplo, guardarlo en
  Archivos primero).
- **Vídeos grandes.** Un vídeo a 240 fps de 10 s puede pasar de 100 MB. No se
  carga entero en memoria: mp4box lee por trozos y el `<video>` lo reproduce
  desde el archivo. El vídeo no se guarda por defecto.
- **Safari puede borrar los datos de una web.** Si no se usa en 7 días, Safari
  borra el almacenamiento de las webs *no instaladas*. Por eso: instalar la app
  en la pantalla de inicio (se explica en el primer uso), pedir
  `navigator.storage.persist()` y recordar la copia de seguridad cada semana.
- **Sensores.** El inclinómetro exige HTTPS y, en iPhone, un toque del usuario
  para pedir permiso. Si se deniega, S19 ofrece medir el ángulo sobre una foto.
- **RGPD.** Datos de salud: todo se queda en el dispositivo; borrar un paciente
  lo borra todo; exportar un paciente cubre el derecho de acceso. La clínica
  debe recoger el consentimiento de sus pacientes como ya hace con su
  historia clínica. Esto no es asesoramiento legal.
- **Validación.** Hasta comparar el clon con una referencia, sus números no se
  usan para tomar decisiones clínicas. La comparación va justo después de los
  must-haves.
- **Sin conexión.** Es una ventaja: la PWA funciona sin internet en la consulta.
- **Zonas horarias, idempotencia, carreras, límites de uso, emails:** no aplican
  (un solo usuario por dispositivo, sin servidor). Las fechas se guardan en UTC.

## Orden de construcción

1. **Rebanada vertical (fase 1a).** Crear un paciente → CMJ → subir vídeo real
   a cámara lenta → marcar despegue y aterrizaje → ver la altura → queda en su
   ficha. Feo pero completo. Prueba lo arriesgado: fps, selector de fotos de
   iOS y SQLite en OPFS.
   - Pantallas: S01, S03, S02, S04, S05, S06, S07, S08.
   - Tablas: `patients`, `tests`, `videos`, `marks`, `results`.
   - Funciones: `createPatient`, `readVideoMeta`, `createTest`, `saveMarks`, `computeResults`.
2. **Must-haves (fase 1b).** SJ; DJ con tiempo de contacto y RSI; fuerza,
   velocidad y potencia de Samozino; evolución (S22); exportar CSV y copia de
   seguridad (S24); ayuda de cada test (S25); PWA instalable y aviso de copia.
3. **Validación.** Medir los mismos saltos con el clon y con una referencia y
   anotar la diferencia (fila "Validación interna" de `features.csv`).
4. **Should-haves por fases del recon:**
   - Fase 2 (saltos): S09 perfil F-V, S10 asimetría, S11 10-5, S12 horizontal,
     CMJ con brazos, RSI-mod, rigidez, DRI. Tablas: `profiles`, `profile_tests`.
   - Fase 3: S13-S14 velocidad de barra y 1RM, S19 movilidad, S20 nórdico,
     S21 bienestar. Tabla: `wellness`.
   - Fase 4: S15 sprint, S16 cambio de dirección, S18 carrera, S23 comparar.
   - Could-haves: S17 S-MAS, sprint curvo, deceleración, idiomas, fase 5 de IA.
5. **Mejoras de `/replica-entrepreneur`** cuando se ejecute.
