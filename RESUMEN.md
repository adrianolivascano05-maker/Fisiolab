# OmniClin: resumen ejecutivo para continuar

Fecha: 2026-10-17

## 1. Qué es y dónde está

- **App:** OmniClin (antes «Impulso» y, hasta el 28-10-2026, «Cénit · Fisiolab», que se descartó porque «CENIT» está registrada; marca en el apartado 5: paleta papel y bosque con modo oscuro sobre el bosque, Bricolage Grotesque + Source Sans 3, logo del anillo de tres arcos con el sol de oro). Ficha clínica de fisioterapia y medición por vídeo a cámara lenta: se marcan fotogramas y la app calcula altura del salto, RSI, fuerza, potencia, etc. Código, nombre, logo y textos propios.
- **Uso:** interno en la clínica Fisiolab, en el móvil **Android (Pixel 7 Pro)** del usuario.
- **Publicada (versión de prueba):** https://adrianolivascano05-maker.github.io/Fisiolab/
- **Código:** repositorio `adrianolivascano05-maker/Fisiolab` (público). Rama principal y única: `claude/replica-skill-install-zv3ker`. Cada push a esa rama vuelve a publicar la app (GitHub Actions → GitHub Pages).
- **Método:** las skills «replica» instaladas en `.claude/skills/` (recon → architect → design → build → test → diff → brand → deploy). Sus documentos de trabajo se quitaron del repositorio el 2026-10-20 (quedan en el historial de git).

## 2. Estado actual

| | |
| --- | --- |
| Funciones imprescindibles | **13 / 13** |
| Fases | 1 a 4 completas; quedan los «could» (sprint curvo, deceleración, S-MAS) |
| Pruebas | 100 unitarias (Vitest) + 70 en navegador (Playwright), en los dos modos de alojamiento |
| Fallos | los encontrados en las pruebas, arreglados; ninguno abierto |
| Prueba real | vídeo de Pixel 7 Pro (120 fps guardado a 30): 30,7 cm; el usuario confirmó que la app publicada funciona en su Android |

**Hecho:**
- Pacientes.
- Saltos: CMJ, CMJ con brazos, SJ, Drop jump (RSI, rigidez, DRI), unipodal con lado, 10/5 y horizontal.
- RSI modificado (marca opcional del inicio del movimiento).
- Perfil fuerza-velocidad con óptimo y desequilibrio.
- Asimetría.
- Fuerza: velocidad media de la barra por vídeo o encoder en 6 ejercicios, pérdida de velocidad, perfil carga-velocidad con 1RM estimado y cargas por % 1RM.
- Sprint lineal: tiempos de paso (vídeo o fotocélulas), tramos y perfil fuerza-velocidad del sprint.
- Cambio de dirección: 5-0-5, 5+5, V-Cut e Illinois; asimetría entre giros y déficit de cambio de dirección.
- Carrera en cinta: contacto, vuelo, frecuencia, factor de apoyo, longitud del paso y asimetría por pie.
- Comparar pacientes (ranking por 21 medidas): quitado a petición del usuario el 2026-10-19; se recupera del commit `f820bb2` (`src/pages/ComparePage.tsx`, `src/data/compare.ts`) si se vuelve a pedir.
- Nórdico de isquios: ángulo de rotura en el vídeo (o a mano) y momento estimado por pierna.
- Bienestar: cuestionario diario (fatiga, sueño, dolor muscular, estrés y ánimo, de 1 a 5) más dolor de la lesión; total sobre 25, comparación con su media y avisos.
- Movilidad: 14 movimientos de tobillo (lunge), cadera, hombro y cuello, medidos con el inclinómetro del móvil, sobre una foto o con goniómetro; resumen por lados y evolución.
- Evolución con gráfica y tabla.
- Exportación CSV para Excel, y copia de seguridad que se puede restaurar.
- App instalable que funciona sin conexión.
- Ayuda ilustrada.
- Datos de ejemplo, y una clínica de prueba con 100 o 500 pacientes inventados para probarla con volumen (`src/demo/`).
- Marca propia.

**Pendiente:**
- **Validación** contra una plataforma de fuerza u otra app de salto validada: 10-20 saltos medidos a la vez. Hasta entonces, no usar para decisiones clínicas.
- Validar el momento del nórdico con un dinamómetro.
- Comparar la velocidad de barra con un encoder lineal.
- Probar la movilidad con el sensor de un Android real.
- Prueba con TalkBack.

**Experimental (se puede quitar):** «Ángulos en vídeo con IA» (Nueva medición → Movilidad → Ángulos en vídeo con IA).
- Pose 3D por IA (MediaPipe, Apache 2.0) en el propio móvil.
- Esqueleto superpuesto, plano anatómico con compensación de la perspectiva, filtro One Euro, anclaje a las articulaciones, Δθ e informe CSV.
- Está toda en `src/free/`; sus mediciones se sincronizan con la nube (tabla `free_measurements`, migración 012). Cómo quitarla, en `src/free/README.md`.
- Comprobado: abducción de 90° → 91,6° en una foto de ejemplo; temblor de unos 2° en imagen quieta.

**Noche del 23 al 24-10-2026 (cuatro bloques pedidos por el usuario):**
- **Preparar la app para otras clínicas:** registro de fallos en el dispositivo y «Algo no funciona» con el informe para mandar (`src/app/errorLog.ts`, `ReportProblemPage.tsx`), pantalla de error en vez de blanco (`RouteError.tsx`), linter oxlint en la integración continua, pruebas en WebKit (aviso), simulacro de recuperación (`e2e/simulacro.spec.ts`) y medida de carga del servidor (`e2e/capacidad.spec.ts`, 1,9 peticiones por minuto por dispositivo). Soporte en `docs/soporte.md`.
- **Bandeja de envíos (Agenda › Hoy › Envíos):** recordatorios del día antes, anamnesis 48 h antes de la primera cita y cuestionarios antes de reevaluar, uno tras otro por WhatsApp (`src/schedule/outbox.ts`, migración 026).
- **Reserva online 24/7 — quitada el 24-10-2026 por decisión del usuario:** las citas las dan, cambian y anulan las clínicas por teléfono, WhatsApp o en persona. Los enlaces antiguos (`…/reservar/…`, `…/cita/…`) dicen que se hable con la clínica (`src/app/OldLinkPage.tsx`). Las columnas `source` y `cancel_token` de las citas (migración 027) y los ajustes `booking_settings`/`booking_keys` se quedan en la base sin usarse: no se borra ningún dato. «Cerrar la agenda» se queda (rayado en la agenda).
- **Facturas — fuera de la app desde el 24-10-2026, por decisión del usuario:** cada clínica factura con su propio programa (que numera y cumple Verifactu). Ajustes › **Para facturar** (`src/data/toBill.ts`, `src/invoices/ToBillPage.tsx`): los cobros de cada mes con los datos del paciente (DNI, dirección, contacto), en Excel, y en cada cobro se apunta el número que le dio su programa (migración 030, `payments.invoice_ref`). Las facturas hechas antes con la app (migración 028) quedan en solo lectura en «Facturas hechas con la app» (`src/data/invoices.ts`), con su libro en CSV; no se borra ninguna.
- **Archivos del paciente (26-10-2026):** informes y pruebas en PDF (las fotos se juntan en un PDF; 5 MB como mucho cada uno) en la ficha, Documentos › Archivos del paciente (`src/documents/`, migración 032 `documents`, sincronizada con la clave de cada archivo; `document_trash` local para borrarlos del servidor). Cada archivo se cifra en el dispositivo con su clave (AES-GCM, `CENITDOC1`), se guarda en IndexedDB y se sube al servidor, que lo deja en R2 con jurisdicción UE (enlace `DOCS`, tablas `documents` y `doc_requests`; tope de 10 GB entre todas las clínicas, aviso a 8 GB). El paciente puede subir hasta 5 con su enlace («Sus informes y pruebas», `DOCS_KIND` en `src/clinical/patientForms.ts`) y, en Android con la app instalada, se comparten desde WhatsApp o el correo (`share_target`, `public/compartir-sw.js`, `/compartir`). Van en la exportación completa. Sin R2 activado (`docs/pasos-pendientes.md`, paso 4), la app no los ofrece. Pruebas: `src/documents/*.test.ts`, «documentos» en `cloudflare/worker.test.ts` y `e2e/archivos.spec.ts`.
- **Sincronización campo a campo (26-10-2026):** si dos dispositivos cambian la misma fila, de cada campo se queda el cambiado más tarde (migración 033: `sync_fields` con la hora de cada campo, `sync_changes.born`; en la anamnesis y los motivos de consulta, cada respuesta; `mergeRow` en `src/data/syncMerge.ts`). Lo de aquí que pierde frente a otro valor se guarda tres meses (`sync_conflicts`, Ajustes › Cuenta › «Cambios sustituidos», `src/data/conflicts.ts`). Ventana fija abajo mientras algo impide sincronizar (`src/cloud/SyncFloat.tsx`) y aviso de cita doble al sincronizar (`doubleBookingsFromOthers`). Con dispositivos sin actualizar se junta como antes, fila a fila. Sentencias preparadas reutilizadas al juntar: un móvil nuevo con 10.000 pacientes, 44 s (antes 118 s). Pruebas: `src/data/fieldMerge.test.ts` y CL13 en `e2e/clinics.spec.ts`.
- **Clínicas grandes (27-10-2026):** con el almacén R2, la copia entera de cada clínica va allí por trozos de 8 MiB y en bytes (`CENITENC2` en `src/cloud/crypt.ts`, `putPieces` en `src/cloud/remote.ts`, `copyUpload` en `cloudflare/worker.js`): sin el tope de 50 MB y sin que el servidor la junte en memoria; sin R2, como antes. Copia entera menos a menudo en las clínicas grandes (`shouldCompact`). Una petición por minuto en vez de 1,9 (la consulta de la sincronización dice si hay formularios respondidos) y una cada 5 minutos si nadie toca la app. Pacientes de 50 en 50, buscando en la base, con filtros: edad, sexo, fisio, cita próxima, última vez que vino y pendiente de cobrar o de firmar (`src/data/patientSearch.ts`). Panel del proveedor con lo que ocupan el almacén y la base, y avisos al 70 % (`src/cloud/limits.ts`; variables `DOCS_CAP_GB` y `D1_CAP_MB`). Hay que pegar el `worker.js` nuevo (`docs/pasos-pendientes.md`, paso 3).
- **Fisios del paciente, hoja de protección de datos firmada y lo pendiente en Cloudflare (27-10-2026):** «Asignar fisio» en la cabecera de la ficha (uno o varios del equipo; migración 034 `patient_staff`, sincronizada fila a fila; `src/data/patientStaff.ts`, `src/clinical/PatientPhysios.tsx`): el filtro «Fisio» de Pacientes busca los asignados y, si el paciente no tiene ninguno, los que tienen alguna cita suya. La hoja de protección de datos se firma también en la pantalla y se guarda entera con su versión, respuestas y firma (`privacy.sheets`, `signPrivacySheet`; el texto en `src/privacy/privacyText.ts`); sale en la exportación. El servidor dice su versión (`SERVER_VERSION`) y si tiene R2, y Ajustes → Proveedor avisa de lo que falta en Cloudflare (`src/cloud/serverStatus.ts`). El panel del proveedor enseña también las peticiones de hoy de la cuenta, preguntándoselas a las estadísticas de Cloudflare con un token de solo lectura (`/v1/proveedor/peticiones`; `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `DAILY_REQUESTS`), y avisa al 70 % solo a quien gestiona el servidor.

## 3. Decisiones tomadas (y por qué)

1. **Por fases, saltos primero.** El usuario pidió «toda la app»; se construye por fases. Las fases 1 a 4 están hechas.
2. **Web instalable (PWA), no app nativa.** Funciona en cualquier móvil, sin tiendas, sin cuentas de desarrollador y gratis.
3. **Datos en el dispositivo:** SQLite WASM sobre OPFS, sin servidor propio. Son datos de salud (RGPD), con coste 0 € y funcionan sin conexión. Consecuencias:
   - Sin la nube activada no se sincroniza entre móviles; se pasa la copia de seguridad, y hay recordatorio semanal de copia.
   - Con la nube activada (`public/cloud.json`, guía en `src/cloud/README.md`), cada fisioterapeuta entra con su cuenta de Google y sus pacientes se guardan también en su Google Drive, en la carpeta oculta de la app. Se junta fila a fila con la copia de la nube: gana el cambio más reciente.
   - Solo una pestaña a la vez (Web Lock); la segunda avisa y se bloquea.
   - Borrar un paciente borra todo lo suyo, pero avisa si su historia clínica aún hay que conservarla (5 años o lo que se ponga en Ajustes).
   - Con la cuenta de Google, la siguiente cita de cada paciente se apunta sola en el calendario «OmniClin · Citas» de su Google Calendar, y el informe (PDF) y los resultados (CSV) se pueden guardar en la carpeta «OmniClin» de su Drive.
   - **Protección de datos** (`src/privacy/README.md`):
     - Datos de la clínica en Ajustes.
     - Texto informativo del RGPD para que cada paciente lo firme, con sus consentimientos opcionales: fotos y vídeos, WhatsApp o correo, docencia y estudios.
     - PIN para abrir la app.
     - Copia de la nube siempre cifrada con la contraseña de la clínica (la clave, guardada sin poder sacarla del dispositivo).
     - Con la nube y cuentas de Gmail normales falta el contrato de encargado del tratamiento con Google, que tienen las cuentas de Google Workspace. La app lo recuerda.
4. **El vídeo no se guarda:** se queda en la galería. Solo se guardan las marcas y los resultados, así que, si cambia una fórmula, se recalcula desde las marcas.
5. **fps de grabación separados de los fps del archivo.**
   - Las cámaras lentas suelen guardarse ralentizadas (el Pixel graba a 120 y guarda a 30).
   - La app lee la etiqueta `com.android.capture.fps` y propone 120 sola.
   - Avisa por debajo de 100 fps.
6. **Fotograma exacto.** Se navega por la hora real de cada fotograma, sacada del índice MP4/MOV con mp4box y calibrada con `requestVideoFrameCallback`. Con 30 fps fijos, el vídeo real mostraba el fotograma siguiente (BUG-005).
7. **Alojamiento: GitHub Pages**, bajo `/Fisiolab/`. Es gratis porque el repo es público y no hace falta cuenta nueva.
   - La CSP va en `<meta>`.
   - `404.html` es la propia app.
   - Cloudflare Workers queda preparado como alternativa (`wrangler.jsonc`, `public/_headers`) para un dominio propio.
8. **Marca: OmniClin** (antes Impulso y Cénit).
   - Paleta propia «petróleo y pizarra».
   - Logo: parábola del salto con un punto en el vértice, sobre el suelo.
   - Voz: precisa, cercana y serena.
   - Las comprobaciones de marca registrada están pendientes; solo harían falta si algún día se vende.
9. **Claude no crea cuentas ni usa claves.** El usuario activó GitHub Pages él mismo (Settings → Pages → Source: GitHub Actions).
10. **Movilidad con tres métodos.** Inclinómetro del móvil (sin aparatos), ángulo sobre foto (si no hay sensor o para dejar constancia) y goniómetro (lo que ya se usa en la clínica).
    - El resultado es la media de las lecturas (se recomiendan 3).
    - La foto no se guarda, como el vídeo.
    - El cuello en flexión, extensión y rotación no se mide con foto: en una sola imagen no sale fiable.
    - No hay valores normales: solo se compara un lado con el otro y la evolución.
11. **Fuerza por vídeo o encoder.** El vídeo sirve sin aparatos; si en la clínica hay un encoder, se escriben sus velocidades.
    - El perfil usa la repetición más rápida de cada carga y se proponen las series del último día.
    - El umbral del 1RM es editable por ejercicio y se puede guardar para siempre.
    - La pérdida de velocidad va de la repetición más rápida a la última.
12. **Bienestar, un registro por día.** Si se rellena dos veces el mismo día, se corrige el primero. El dolor de la lesión se apunta aparte y no suma en el total.
13. **Nórdico: ángulo respecto a la vertical** (0° erguido); se muestra también el ángulo con el suelo. El momento se calcula con los datos actuales del paciente y se presenta como estimación para comparar al mismo paciente.

### Organización de la app (filosofía del iPhone)

El usuario pidió una app tan intuitiva como un iPhone, sin listas que le digan qué hacer y en qué orden.

- **Barra de abajo** (`src/ui/AppBar.tsx`):
  - Tres pestañas: Pacientes · Guía de tests · Ajustes. Se ve en todas las pantallas salvo en formularios y vídeo.
  - Cada pestaña recuerda dónde se estaba. Pulsar la pestaña activa vuelve a su inicio.
  - Un punto rojo en Ajustes mientras falten los datos de la clínica.
- **Arriba:** barra en el verde de la marca con línea de oro; en las pantallas principales, el logo a la izquierda. «‹ Pantalla anterior» y acciones a la derecha («+», «Editar»). En las pantallas principales y en la ficha, título grande que pasa a la barra al bajar.
- **Pacientes:**
  - «+» para añadir y buscador.
  - Próximas citas de 7 días, reevaluaciones y «Medición rápida».
  - Todos por letras, con su próxima cita o su última visita.
- **Ficha** (`src/clinical/PatientShell.tsx`):
  - Cabecera común a todas las pestañas: iniciales, nombre, edad, teléfono, peso y estatura, **motivo de consulta**, próxima cita con su botón de calendario, y «Editar». El contacto (teléfono, email, dirección) es del paciente, no de cada anamnesis (migración 012); los datos para saltos van plegados en el alta.
  - Anamnesis en apartados plegables; abiertos al llegar: motivo, antecedentes (con las precauciones), diagnóstico y objetivos (con el plan).
  - Mediciones: arriba, «Pruebas físicas» o «Cuestionarios», cada uno en su pantalla.
  - Sesiones: cuántas lleva de las previstas (o del bono, en la anamnesis) y «Repetir el tratamiento de la última sesión».
  - Informe de alta de cada motivo de consulta (se abre al «Dar por terminado»): evolución del primero al último dato, tratamiento y recomendaciones.
- **Agenda** (migración 013): citas con estado (pendiente, atendida, no vino, anulada); «Dar cita» sin sesión desde la ficha; en Pacientes, «Hoy» con todas las del día y «Próximas citas» de la semana. Google Calendar sigue las citas pendientes.
  - **Motivos de consulta:** un paciente que vuelve por otro problema tiene otro motivo, con su propia anamnesis y sus registros. La ficha enseña los del motivo elegido o todos juntos (`src/clinical/README.md`).
  - Las pestañas se quedan fijas al bajar.
  - En el Resumen: «Añadir» (Sesión, Medición, Exploración, Cuestionario) y una lista con Anamnesis, Protección de datos (en naranja si falta) e Informe. Después, solo lo que tiene datos.
- **Ajustes:** listas agrupadas con el estado de cada cosa y una pantalla por apartado.
- **Enlaces entre secciones:** desde un test de la Guía, «Registrar el resultado en …» propone el último paciente abierto.
- **Cuestionarios enteros en la app** (`src/clinical/forms/`), con el texto de cada pregunta y respuesta, la nota calculada al final y guardada con las respuestas. Por zona (KOOS, HOOS, LEFS, FAAM, VISA-A/P, ACL-RSI, NDI, Oswestry, QuickDASH, SPADI) y generales (RAND-36, PHQ-9, GAD-7, TSK-11, PCS, PSEQ, FABQ, CSI, Örebro corto, IPAQ corto). El texto de los ítems es una traducción de trabajo, por revisar con las versiones españolas publicadas.
- **Consentimientos informados** (`src/consent/`): cinco documentos cortos, uno por grupo de técnicas con ejemplos («Tratamientos invasivos, como la punción seca… etc.»): valoración y tratamiento (con las pruebas físicas), tratamientos invasivos, manipulaciones, electroterapia y otros aparatos (ondas de choque incluidas) y suelo pélvico. Se proponen con la anamnesis (plan y diagnóstico) y añaden los riesgos por las circunstancias del paciente (Ley 41/2002, art. 10) a partir de las «Precauciones» marcadas en la anamnesis; lo escrito sin marcar solo avisa al fisioterapeuta. Firma en la pantalla (dos firmas dibujadas) o en papel; se guarda el documento entero y se puede retirar. Sin IA de pago: reglas fijas y revisables. Modelos por revisar con el colegio o la asesoría.
- **Servidor de la clínica en Cloudflare** (`cloudflare/`): Worker + D1 con jurisdicción UE en el plan gratuito; solo copias cifradas (la contraseña la tiene la clínica); Google queda solo para entrar. **Activo desde el 2026-10-20:** `https://cenit-datos.adrianolivascano05.workers.dev` (`"cloudflareUrl"` en `public/cloud.json`; cuenta de Cloudflare del usuario, montada con `cloudflare/README.md`). **Clínicas con equipo (2026-10-20):** en la variable `ALLOWED_EMAILS` del Worker (Settings → Variables and secrets) van solo los correos de quien puede dar de alta una clínica (su responsable); el resto del equipo lo añade el responsable desde la app (Ajustes → Equipo de la clínica). Cada clínica tiene su base y su copia, cifrada con su propia contraseña: quien gestiona el servidor ve nombres de clínica y correos, no pacientes. **Agenda (2026-10-20):** pestaña «Agenda» tipo Google Calendar (día, 3 días, semana; arrastrar citas con deshacer; mover ±1 h/día/semana; crear en un hueco), para todos; en una clínica, además turnos de cada persona, columnas por persona y con quién es cada cita, sincronizado (la app mira el servidor cada minuto). Al pasar a esta versión hay que volver a ejecutar `cloudflare/schema.sql` en la consola de D1 (tablas `clinics` y `members`) y pegar el `worker.js` nuevo.
- **Sincronización por cambios (2026-10-20):** con el servidor de una clínica, cada dispositivo sube solo lo que ha cambiado (lotes cifrados, tablas `deltas` y `delta_base`; migración 017) en vez de la base entera; cada 200 lotes un dispositivo sube una copia entera y el servidor borra los anteriores. Medido: 15 personas y un año de uso son unos 26 MB de base (2,6 MB comprimida). El primer dispositivo actualizado pasa la clínica a este modo; las versiones anteriores de la app reciben «actualiza la app». Con un servidor anterior, la app sigue con la copia entera. Al actualizar el servidor: primero el `schema.sql` nuevo en la consola de D1, después el `worker.js`.
- **Traer datos de otro programa (2026-10-21):** Ajustes → Copias y exportar → Importar datos (y desde la lista vacía): pacientes, citas (las futuras y las pasadas, con su duración, estado y con quién) e historial de sesiones (fecha y notas; `src/data/importRecords.ts`), unidos a su paciente por el nombre (los que no están se crean con su nombre; lo ya importado no se repite). Lee Excel (.xlsx, sin librerías: `src/data/xlsx.ts`) y CSV (punto y coma, comas o tabuladores; UTF-8 o Windows-1252). Adivina cada columna por su título (se puede cambiar), junta nombre y apellidos, reconoce fechas (también el número de serie de Excel), sexo, peso y altura; lo que no tiene sitio o no se reconoce va a las notas. Salta los que ya existen con el mismo nombre (opcional). La última importación se puede deshacer (`last_import`). `src/data/importPatients.ts`.
- **Exportación completa (2026-10-21):** «Descargar todo» en Ajustes → Copias y exportar, y obligatoria al borrar una clínica: un .zip con la historia clínica legible de cada paciente (HTML que se abre en cualquier navegador y se imprime: datos, motivos de consulta con su anamnesis, sesiones, exploración, mediciones, cuestionarios, bienestar, consentimientos con firmas y citas), un índice, un Excel con una pestaña por tipo de dato, un JSON con las tablas para otro programa, la copia de OmniClin y un LEEME. Sin librerías (`src/export/`). Los vídeos de las mediciones no van (se quedan en el dispositivo).
- **Agenda más sencilla (2026-10-21):** tocar un hueco abre directamente la cita (en una clínica, desde ahí se puede poner un turno); el paciente nuevo se crea con su nombre sin salir de la cita; «Repetir cada semana» da una serie de 2 a 12 citas; avisa si a esa hora ya hay una cita (de esa persona en una clínica) y deja darla igualmente; tocar la fecha de arriba abre el calendario para ir a cualquier día. `clashes` y `createWeekly` en `src/data/appointments.ts`.
- **Frente a la competencia (2026-10-21):** análisis de Clinic Cloud, Doctoralia, FisioTools y apps de ejercicios en `replica/fixes.md` (reseñas en `replica/reviews.csv`, encuestas de fisios de la Universitat de València). Hechas: **recordatorios en un toque** (Agenda → Recordatorios: las citas de mañana con su WhatsApp o correo listo, recordada y confirmada; mensaje de la clínica en el ajuste `reminder_template`; respeta el permiso de contacto; migración 018 `reminded_at`, `confirmed_at`), **justificante de asistencia** (desde la cita o la ficha, imprimir o PDF) y **la clínica en números** (Ajustes: sesiones, pacientes atendidos y nuevos, ausencias, anuladas, altas, por profesional y sesiones por mes; `src/data/stats.ts`). Después: **mapa del dolor** en la anamnesis (campo `mapa_dolor` de tipo `bodymap`: zonas de frente y de espaldas, dolor, hormigueo o rigidez con color y trama, intensidad 0-10, una lista para las zonas pequeñas; propone Zona y Lado para los tests; sale en la ficha, el resumen, el informe y la exportación; `src/clinical/bodyMap.ts`, `BodyMapParts.tsx`; color `tingle` en los tokens), **bonos y cobros** (migración 019 `packs` y `payments`, en céntimos; las sesiones desde el día de compra gastan el bono, la más antigua primero; las sueltas valen el precio de Ajustes → Precios y cobros desde el día en que se puso; lo pendiente por paciente y de la clínica, lo cobrado por forma de pago; no son facturas; `src/data/billing.ts`), **lista de espera** (migración 020 `waitlist`, una fila por paciente; al anular o borrar una cita futura, la hoja ofrece el hueco y la lista lo manda por WhatsApp o correo y da la cita con un toque; `src/data/waitlist.ts`, `src/schedule/WaitlistPage.tsx`) y **ejercicios para casa** (migración 021 `exercises` y `exercise_plans`; biblioteca de la clínica con 14 ejemplos opcionales para editar; la hoja copia el texto, se imprime, va a PDF o Drive y se envía por WhatsApp o correo; `src/data/exercises.ts`). Pruebas e2e en `e2e/mejoras.spec.ts`. **Segunda ronda (revisión de fallos y de uso en el móvil):** precio de la sesión con historia (`periods`: cada sesión suelta vale el precio de su día; cambiarlo no toca lo de antes), bonos de la clínica para venderlos con un toque (ajuste `billing_pack_presets`, caducidad en meses), cambiar y renovar un bono, el bono que antes caduca se gasta primero, cobrar desde la hoja de la cita y al apuntar la sesión («Del bono: le quedarán N» / «Cobrada ahora»), justificante de pago con la cantidad en letra (`/pacientes/:id/recibo/:pid`, «no es una factura»), Excel de cobros del mes para la gestoría, lo pendiente en la cabecera del paciente y en la lista de hoy, lo cobrado en «La clínica en números»; hoja de la cita según el momento (recordar o llamar antes; atender o no vino el día; justificante después; anular y borrar con confirmación); justificante de asistencia que parte de la última visita y nunca de una hora futura; lista de espera con mañanas/tardes y días (migración 022), «Le encaja este hueco», «Ofrecido», apuntarse desde la ficha, dar el hueco comprobando que sigue libre y preguntando por la cita que ya tenía; después (25-10-2026, migración 031), preferente, «puede a partir del» y horas concretas, y la lista se ordena (tiempo de espera, prioridad, cita, ofrecido, nombre) y se filtra combinando franja, días, fisio, preferentes, ofrecido, cita, si ya puede y cuánto lleva esperando, con los filtros en la dirección (`filterWaitlist`, `sortWaitlist`; pruebas en `e2e/espera.spec.ts`); desde cada paciente, WhatsApp (mensaje «Lista de espera»), «Dar cita» (y preguntar si sale de la lista, también desde la ficha, `LeaveWaitlist.tsx`) y su ficha, que vuelve a la lista; «Tengo un hueco libre» pone un hueco a mano; la ficha tiene WhatsApp en la cabecera; recordatorios con «Recordada por teléfono», un aviso único de permisos con «Sí, acepta» y vista previa del mensaje; mapa del dolor con un dibujo grande cada vez, Dcha./Izda., intensidad en la zona, leyenda, antes de Zona y Lado y proponiendo la EVA; ejercicios con vídeo y su QR (migración 023), plantillas de hojas (ajuste `exercise_templates`), biblioteca que se abre en las zonas del paciente con buscador, editor plegado y una hoja para el paciente sin textos internos. **Anamnesis de la clínica (campos propios):** Ajustes → Anamnesis de la clínica añade preguntas propias (texto corto o largo, una o varias opciones, escala 0-10) al final de cualquier apartado, con paquetes de ejemplo (deportiva, suelo pélvico, neurológica); ajuste sincronizado `anamnesis_custom_fields` (`src/data/customFields.ts`), `withCustom()` en `src/clinical/anamnesis.ts` y `useAnamnesisSections()`; salen en la ficha, el informe y la exportación; quitar una pregunta no borra lo respondido (va a «Otros datos guardados»). **Anamnesis limpia (2026-10-21):** a petición de la clínica, la anamnesis vuelve a ser para escribir: solo se marcan en una lista la Zona y el Lado (ordenan los tests y cuestionarios), las banderas rojas y las precauciones; «Forma de inicio» y «Ritmo» pasan a texto (lo guardado sigue igual). El mapa del dolor sale de la anamnesis y es un cuestionario («Mapa del dolor», `inApp: "bodymap"`, la nota es la intensidad más alta, las zonas en `details.marks`); el último sale dibujado en el informe. Lo marcado antes en la anamnesis se ve en «Otros datos guardados» (`orphanText`). Exploración y el buscador de tests enseñan todos los tests de cada zona del paciente (también grupos de tests y reglas de decisión), zona por zona (`testsByRegion`); antes se cortaba en 6 y una zona podía quedarse sin los suyos. **Formularios para el paciente (2026-10-21):** Ficha → Formularios para el paciente (`/pacientes/:id/formularios`, `src/patientForm/SendFormsPage.tsx`) manda por WhatsApp, correo o copiando el enlace su parte de la anamnesis (datos, motivo, antecedentes, familia y hábitos, con preguntas dichas para el paciente en `PATIENT_FIELDS` y las propias de la clínica; nunca zona, lado, banderas rojas, precauciones, exploración ni plan) o un cuestionario entero; también desde la anamnesis y desde cada cuestionario. El paciente lo abre sin cuenta ni PIN (`/formulario/:id#clave`, `PublicFormPage.tsx`, fuera de la base y del router; guarda el borrador en su móvil). Cifrado de extremo a extremo: AES-GCM con una clave al azar que solo va en el enlace (después de `#`); el servidor (`patient_forms` en D1, rutas `/v1/clinicas/:id/formularios` y `/v1/formularios/:fid` sin sesión) solo guarda bytes ilegibles, caduca a los 14 días (30 como mucho) y borra las respuestas al recogerlas. Con la app abierta en la clínica se recogen solas cada minuto (`FormInbox.tsx`, `collect.ts`): la anamnesis solo rellena lo vacío del motivo al que se mandó (lo distinto queda en «Ver lo que contestó») y el cuestionario se guarda con su nota (KOOS y HOOS por subescalas). Migración 024 `patient_forms` (sincronizada; la clave no sale en la exportación). Pruebas: `src/patientForm/collect.test.ts`, `cloudflare/worker.test.ts` y CL12 en `e2e/clinics.spec.ts`.
- **Palabras:** «medición» para lo que se mide (salto, fuerza…) y «test de exploración» para Lachman, Neer…

## 4. Fórmulas acordadas (`src/calc/`)

| medida | fórmula | fuente / estado |
| --- | --- | --- |
| Altura | h = g·t_vuelo² / 8 | Bosco 1983 |
| RSI (DJ) | h / t_contacto | estándar |
| RSI-mod | h / tiempo hasta el despegue | marca opcional «Inicio» |
| Samozino (CMJ, SJ) | F = m·g·(h/hpo + 1); v = √(g·h/2); P = F·v; m = masa + carga | Samozino 2008. No se aplica al CMJ con brazos ni al unipodal |
| Rigidez vertical (DJ) | k = m·π·(tv+tc) / (tc²·((tv+tc)/π − tc/4)) | Dalleau 2004; comprobada con su derivación Fmáx/Δy |
| DRI (DJ) | (caída + altura) / (g·tc²) | Brooks 2026, por fuentes secundarias: **confirmar en el artículo** |
| 10/5 | RSI de cada rebote = h/tc; resultado = media de los 5 mejores (mínimo 6 saltos) | Harper 2011 |
| Perfil F-V | recta F̄(v̄) por mínimos cuadrados, F por kg de masa corporal; F0, V0, Pmáx = F0·V0/4 | Samozino |
| Perfil óptimo | pendiente que maximiza h con la misma Pmáx, **buscada numéricamente** con el modelo macroscópico de Samozino; desequilibrio = \|1 − SFv/SFvopt\|; <100 % = déficit de fuerza | sin la fórmula cerrada del artículo |
| Asimetría | (mejor − peor) / mejor × 100, con el mejor salto de cada pierna del día | estándar |
| Velocidad de barra | recorrido / tiempo de la subida; serie: la más rápida, la media y pérdida = (más rápida − última) / más rápida | estándar |
| Perfil carga-velocidad | recta velocidad = a + b·carga con la repetición más rápida de cada carga; 1RM = carga a la velocidad del umbral | umbral 0,30 sentadilla, 0,17 banca, 0,15 peso muerto; **press militar, remo y hip thrust por confirmar** (editables) |
| Bienestar | suma de 5 respuestas de 1 a 5 (5 = mejor): 5-25; «por debajo de lo habitual» si está más de 1 desviación típica bajo su media de 30 días (mín. 3 registros) | ítems de McLean 2010; **la suma y el umbral son uso habitual, no confirmados en el artículo** |
| Nórdico | ángulo de rotura = inclinación rodilla-cadera respecto a la vertical; momento por pierna = 0,878·masa·g·0,322·estatura·sen θ / 2 | **modelo propio, por validar**: no se encontró la fórmula publicada |
| Sprint | v(t) = V0·(1 − e^(−t/τ)) ajustado a los pasos; F0 = V0/τ, Pmáx = F0·V0/4 | Samozino 2016 **sin resistencia del aire** (F0 y V0 algo menores que el método completo) |
| Cambio de dirección | déficit = 5-0-5 − mejor paso a 10 m; asimetría = (lento − rápido) / rápido | Nimphius 2013 |
| Carrera | contacto, vuelo, frecuencia = 60 / paso, factor de apoyo = contacto / (2·paso), longitud = velocidad·paso | estándar |
| Movilidad (móvil) | ángulo entre la dirección «arriba» al poner a cero y la actual; lunge: inclinación del borde largo respecto a la vertical | geometría; vale si el segmento se mueve en un plano vertical |
| Movilidad (foto) | ángulo en el eje entre 3 puntos, pasado al valor clínico (directo, 180° − ángulo o ángulo − 90°); o inclinación de 2 puntos respecto a la vertical | goniometría estándar |
| Movilidad (resultado) | media de las lecturas; aviso si difieren más de 5° | criterio propio |

Avisos de plausibilidad: altura fuera de 3-80 cm y contacto fuera de 80-900 ms.

## 5. Marca (texto final)

- **Nombre:** «OmniClin» (desde el 28-10-2026). Antes «Impulso» y «Cénit · Fisiolab». Fisiolab es la clínica del usuario. Frase: «Medir · Organizar · Acompañar». Las marcas internas de los archivos (`CENITENC1`, `CENITENC2`, `CENITDOC1`), las claves guardadas (`fisiolab.*`, `cenit.*`) y los nombres del servidor (`cenit-datos`, `cenit-archivos`) no cambian: las copias y archivos de antes tienen que seguir abriéndose (`docs/cambio-de-nombre.md`).
- **Colores (`src/styles/tokens.json`), paleta «papel y bosque»** (desde el bloque B8 de `docs/archivo/plan-limpieza.md`):
  - claro: fondo `#F2F4F1` (papel gris verdoso), tarjetas `#FFFFFF`, texto `#16201B`, secundario `#55625A`,
    acción `#1F6B4F`; peligro `#A63F2A`, aviso `#865409`
  - oscuro (sigue el ajuste del teléfono): fondo `#0F1512`, tarjetas `#171F1B`, texto `#E7ECE8`, secundario
    `#9EABA3`, acción `#6CC39D` (menta); peligro `#E8826A`, aviso `#E2A94D`
  - barra superior `#0E3B2E` (verde bosque) y oro `#C9A227` del logo, iguales en los dos modos; los títulos de los
    documentos usan `brand-ink` (bosque en claro, menta clara en oscuro)
  - documentos (informe, consentimiento, justificante…) siempre en claro, como papel, y al imprimir todo en claro
  - gráficas `#00805A` y `#97700E` en claro, `#3E9E77` y `#C4862A` en oscuro (las dos parejas pasan el validador
    de daltonismo)
  - contraste AA de todos los pares en los dos modos: lo comprueba `src/styles/tokens.test.ts`
- **Tipografía:** Bricolage Grotesque (títulos y nombre) + Source Sans 3 (texto y cifras tabulares), dentro de la
  app (sin cargar nada de internet).
- **Logo:** anillo de tres arcos (medir · organizar · acompañar) con el sol de oro arriba: arcos crema y el de abajo menta sobre el bosque; la palabra «Omni» en bosque (crema en oscuro) y «Clin» en verde (menta en oscuro). `src/ui/Logo.tsx` (`LogoMark`, `Wordmark`); iconos con `tools/build-icons.py`.
- **Voz:** precisa (no técnica de más), cercana (no coloquial), serena (no fría). Textos clave:
  - «Todavía no hay pacientes» / «Añade a tu primer paciente y mide su salto en un par de minutos.»
  - «Nueva medición»
  - «Calcular resultado»
  - «Paciente añadido»
  - «Ten OmniClin a un toque»
  - «El vídeo no sale de tu galería: OmniClin solo guarda las marcas y el resultado.»
- **Marca de cada clínica (25-10-2026):** cada clínica puede poner su nombre, dos colores y su logo en Ajustes ›
  Marca de la clínica (`src/brand/`). De los dos colores salen todos los de la app en claro y en oscuro (OKLCH, con
  el contraste AA corregido solo y probado con cientos de colores), como una hoja de estilos encima de `tokens.css`;
  sin marca guardada, OmniClin tal cual. Llevan la marca la app (barra, favicon, título), los documentos (membrete y
  marca de agua en pantalla, al imprimir y en cada página del PDF; los consentimientos guardan la marca con la que
  se firmaron) y la página que abre el paciente (dentro del sobre cifrado del formulario). Al pie de cada documento,
  «Documento generado con OmniClin», y en Privacidad, siempre, quién hace el programa. Desde el 28-10-2026, además:
  ocho paletas listas, lema, la barra de arriba (oscura, del color principal o clara), cuatro parejas de letra (dentro
  de la app, se bajan al elegirlas), esquinas (redondeadas, suaves o rectas) en todos los recuadros y acabado (mate,
  vivo o metálico; los documentos siempre planos), con el mismo contraste AA garantizado (`src/brand/options.ts`);
  el membrete de los documentos a gusto (logo a la derecha, a la izquierda o centrado, datos de contacto, banda de
  color, pie propio), la firma dibujada de cada fisio en sus documentos (Ajustes › Clínica › Tu firma) y, en la página
  del paciente, el lema, un texto de bienvenida y el contacto de la clínica. La identidad (nombre, logo y colores) va
  aparte: se puede dejar la de OmniClin y cambiar solo el aspecto.
- **Mensajes a pacientes (25-10-2026):** Ajustes › Mensajes a pacientes (`src/messages/`): los ocho mensajes (el de la lista de espera, desde el 25-10-2026, y el de pedir informes, desde el 26-10-2026) de
  WhatsApp y correo con texto y asunto editables, fichas como {nombre} o {hora}, vista previa y firma común. El
  ajuste antiguo `reminder_template` se sigue leyendo y escribiendo.

## 6. Código: mapa y comandos

```
src/calc/        fórmulas puras + tests (jump, results, repeated, profile, asymmetry, video, rom)
src/data/        SQLite: worker, motor, migraciones (001_init, 002_rom), repo.ts (una función por operación), seed
src/calc/strength.ts y src/pages/Strength*, VbtResult, LoadVelocityPage: fuerza
src/rom/         useInclinometer.ts (sensor), PhotoProtractor.tsx (ángulo sobre foto)
src/video/       meta.ts (fps, fps de grabación Android, horas de fotogramas), timeline.ts, useTimeline.ts
src/pages/       una pantalla por archivo (S01 PatientsPage … S25 JumpHelp); rutas en src/App.tsx
src/ui/          componentes del sistema de diseño (FrameScrubber, MetricCard, Sheet, Logo…)
e2e/             pruebas Playwright por flujo (fixtures.ts con ayudas)
tools/           build-tokens.mjs, build-icons.py, serve-dist.mjs (sirve el build como el alojamiento)
```

Pila: Vite + React 19 + TypeScript + Tailwind 4 (tokens) + React Router + SQLite WASM (OPFS) + mp4box + Recharts + vite-plugin-pwa.

```bash
npm ci
npm test               # unitarias
npm run e2e            # navegador, en la raíz (cabeceras de Cloudflare)
npm run e2e:ghpages    # navegador, bajo /Fisiolab/ como GitHub Pages
npm run build          # tokens + typecheck + build
python3 tools/build-icons.py
python3 .claude/skills/replica-design/contrast.py src/styles/tokens.json
```

Convenciones:
- Commits en inglés, con una línea de título y el cuerpo.
- La app y la documentación, en español.
- Pruebas antes de cada push: el push publica.
- Los vídeos del usuario no se suben al repositorio.

## 7. Siguientes pasos recomendados

1. **Validación (herramienta hecha, faltan los datos):** Ajustes → Validación. Pares OmniClin–referencia (plataforma, otra app de salto validada, encoder, dinamómetro, goniómetro), Bland-Altman, ICC(A,1), error típico, cambio mínimo detectable y lectura en lenguaje claro frente a la diferencia clínica que elijas; «Marcar otra vez a ciegas» en cada resultado (fiabilidad); IA frente a marcas finales (se llena sola); comprobación del sensor del móvil. Falta hacer las sesiones de medida (20-30 pares por medida).
2. **IA (hecha):** «Proponer las marcas con IA» en saltos (despegue, aterrizaje, contacto en la caída, inicio del CMJ, series de rebotes) y en fuerza (inicio y fin de cada subida). Motor de pose compartido en `src/ai`. Cada marca se corrige con ‹ › (un fotograma) o ⌖ (al fotograma de pantalla). Probado con vídeos sintéticos: fotograma exacto. Falta probarla con vídeos reales de la clínica.
   Extras pendientes («could»): sprint curvo, deceleración y S-MAS.
3. **Exploración (hecha):** pestaña con 212 tests diferenciales en 11 articulaciones y 77 patologías (`src/gallery`, módulo quitable). Figuras en 3D generadas por código (paciente y examinador con anatomía humana —piel continua en las articulaciones, manos con dedos, cara y pelo—, esqueleto, examinador colocado sin meterse en el paciente, la camilla ni en sí mismo en ningún fotograma, brazos con mecánica de hombro, escápula, codo y muñeca reales, tomas con los dedos apoyados en la piel, cámara automática con giro limitado; dibujo plano si no hay WebGL); precisión de 145 tests con su fuente (comprobada con buscador; algunas cifras de fuentes secundarias, indicado en cada fila); 67 «sin contrastar», al final de cada patología, para completar cuando se consulten las fuentes originales.
3. **Mejoras pedidas en reseñas de apps de salto (hecho):** autoguardado de marcas, «Cómo se ha calculado» en el salto y medición rápida sin ficha. Pendiente: lupa sobre la imagen al marcar.
4. **Confirmar el DRI** en el artículo de Brooks (2026).
