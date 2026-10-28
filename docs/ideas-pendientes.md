# Ideas y pendientes (lo que va saliendo en las conversaciones)

Lista viva. Cada punto: qué es, de dónde sale y estado. Nada de esto está hecho salvo que lo diga.
Análisis completo de la competencia: https://claude.ai/artifact/BmXfNJB6usGL61EGQoQjzA (23-10-2026).

## Para revisar más tarde (apuntado el 26-10-2026)

Salen de preparar la reunión con la gerente de la clínica. El usuario pidió apuntarlos para revisarlos más tarde.
Ninguno está hecho.

1. **Un fisio que se va conserva los datos en su móvil.** Al quitarlo del equipo (Ajustes › Equipo de la clínica),
   el servidor deja de aceptarle («Tu cuenta no está autorizada en el servidor de la clínica», `src/cloud/remote.ts`),
   pero la base de su dispositivo no se borra sola. Solo se borra si esa persona pulsa «Cerrar sesión y borrar los
   datos de este dispositivo» (`src/cloud/CloudGate.tsx`).
   - Mientras tanto: que lo haga delante de quien gestiona la clínica antes de quitarlo del equipo.
   - Por decidir: si la app debe borrar sola los datos de esa clínica cuando el servidor dice que la cuenta ya no
     está en el equipo. Cuidado con dos cosas: no borrar por un fallo pasajero del servidor y no perder cambios que
     aún no se hayan subido.
2. **Revisión legal antes de meter pacientes reales.** La asesoría de la clínica tiene que revisar la hoja
   informativa de protección de datos que firma cada paciente, los cinco consentimientos informados (`src/consent/`)
   y quién es encargado del tratamiento de qué (Cloudflare, y el usuario si da soporte o administra el servidor).
   - Mientras no esté revisado, ningún paciente real en un piloto con la app.
   - Lo hace el usuario con la asesoría; no se puede hacer desde el código.

## Decidido el 24-10-2026: quitar lo que da problemas y limpiar

El usuario quiere quitarse marrones: que las clínicas gestionen las citas como siempre (teléfono, WhatsApp, en
persona) y que facturen con su propio programa (Verifactu fuera de la app). Auditoría del servidor de ese día en el
chat (fallos P1–P7, mejoras V1–V12). Orden:

1. **Q1 · Quitar la reserva online 24/7 y los enlaces «anular desde aquí» de los recordatorios.** Hecho el
   24-10-2026: fuera `src/booking/`, Ajustes › Reserva online, la confirmación de reservas en Envíos y las rutas y
   tablas del servidor. Los enlaces antiguos dicen que se hable con la clínica. «Cerrar la agenda» se queda. No se
   borra ningún dato de la base de la app. Falta que el usuario pegue el `worker.js` y borre las tablas
   (`docs/pasos-pendientes.md`, paso 3), mejor después de Q3.
2. **Q2 · Facturas fuera de la app.** Hecho el 24-10-2026: Ajustes › Para facturar con los cobros del mes, los
   datos del paciente y un Excel para el programa de facturación de la clínica; en cada cobro se apunta el número
   de su factura (también desde la ficha). Fuera «Hacer la factura», las series y las rectificativas. Las facturas
   ya hechas se quedan en solo lectura (ver, imprimir, PDF, libro). La descarga mensual de Precios y cobros lleva
   ahora a Para facturar. Preguntas para la gestoría: si la app tiene que cumplir Verifactu solo por exportar los cobros, y
   qué columnas necesitan.
3. **Q3 · Servidor limpio.** Hecho el 24-10-2026: formularios repetidos a la vez dan 409 y no un error (P4); los
   cambios se leen de la base solo los que caben en la tanda de 3 MB y `more` ya no da un viaje de más con 100
   justos (P6, V11); tiempo límite de 8 s con Google (V5); cabecera `nosniff` (V7); el papel y el estado de la
   clínica en una sola consulta (un viaje menos en cada petición de una clínica) y la limpieza de formularios como
   mucho cada 10 minutos (V3). Falta que el usuario pegue `worker.js` y borre las tablas de la reserva
   (`docs/pasos-pendientes.md`, paso 3).
   - Pendiente (no hecho, para más adelante si crecen las copias): la subida con `?v=2&seq=N` no es atómica con
     la de `delta_base` (V1) y bajar una copia de 50 MB podría pasar de la memoria del Worker (V2).
4. **Q4 · Limpieza general.** Hecho el 24-10-2026, sin cambiar lo que hace la app:
   - Fuera 5 piezas que nadie usaba (una tarjeta de mediciones, una lista de etiquetas, dos funciones de datos y
     un texto de error de la reserva) y `export` quitado a 75 nombres que solo se usan en su archivo (comprobado
     con `knip` y con el compilador).
   - Repeticiones a una sola: guardar un archivo (`src/app/download.ts`, antes 11 copias), la fecha «dd/mm/aaaa»,
     el primer día del mes, «1 cobro / 3 cobros» y el nombre de pila (`src/app/format.ts`, `schedule/reminders.ts`).
   - `ClinicalPages.tsx` (1 395 líneas) partido en `AnamnesisPage.tsx`, `AssessmentSections.tsx`,
     `SessionPages.tsx` y `QuestionnaireFormPage.tsx`; cada pantalla carga solo lo suyo.
   - Avisos del linter de «relleno inútil» arreglados. Quedan los de React (estado puesto dentro de un efecto,
     `Date` al pintar): cambiarlos puede cambiar cuándo se pinta algo; se dejan para hacerlos uno a uno con pruebas.
   - Documentos: `docs/README.md` con lo que es cada uno; los planes cumplidos, a `docs/archivo/`.
   - Pendiente: revisar las pruebas e2e para que tarden menos (hoy unos 25 minutos por modo).

## Facturación dentro de la app (futuro, apuntado el 25-10-2026)

El usuario quiere poder facturar algún día desde la app, aunque haya que pagar algo. Son dos cosas distintas:

1. **El proveedor (el usuario) factura a las clínicas su cuota.** Recomendación: fuera de la app. Un programa de
   facturación español que ya cumpla Verifactu (cada clínica, un cliente; factura mensual automática) y cobro por
   domiciliación SEPA o tarjeta con una pasarela de pago. Opcional después: que el panel del Proveedor enseñe si cada
   clínica está al día (sin facturar desde la app; suspender ya existe). Sin programación.
2. **Las clínicas facturan a sus pacientes desde la app.** Recomendación: conectar con un servicio que ya cumpla
   Verifactu (con API), no hacerlo nosotros (eso exige declaración responsable de fabricante, el formato de Hacienda,
   los certificados de cada clínica y mantenerlo; el riesgo sería del usuario).
   - Cómo: vuelve «Hacer la factura» en cada cobro → la app manda los datos (los de `src/data/toBill.ts`) al servidor
     de Cloudflare → este llama al servicio con la clave guardada en el servidor (nunca en los móviles) → el servicio
     numera, registra, pone el QR y envía a Hacienda y devuelve número y PDF → la app los guarda en el cobro
     (`payments.invoice_ref`, migración 030) y enseña el PDF para imprimir o mandar.
   - Los números ya no se repiten (los pone el servicio). Sin conexión no se emite: queda pendiente hasta que vuelva.
   - Trabajo estimado: 2 o 3 bloques.

**Pasos, en orden:**
1. Con la gestoría o asesoría: si contrata el servicio el proveedor para todas las clínicas o cada clínica el suyo;
   contrato de encargado del tratamiento con el servicio (la factura lleva nombre y DNI del paciente, y «fisioterapia»
   revela un servicio de salud); fechas de Verifactu que aplican (aplazadas a 2027 según lo último sabido: confirmar).
2. Comparativa de 3 o 4 servicios con API y Verifactu, con precios mirados en sus webs ese día (no dar nombres ni
   precios de memoria).
3. Conexión contra su entorno de pruebas (gratis, normalmente), con pacientes inventados.
4. Primera clínica real (Fisiolab), con su NIF y la autorización que pida el servicio; un mes con pocas facturas.
5. Abrirlo al resto de clínicas y repercutir el coste en su cuota.

Nada se contrata sin que lo decida el usuario. Estado: pendiente.

## Marca por clínica (hecha el 25-10-2026)

Decidido con los borradores y el plan (fase 2 y 3): cada clínica pone su nombre, dos colores y su logo en Ajustes ›
Marca de la clínica; la app, la página del paciente y los documentos se visten con ello. Sin dominios, sin planes y sin
«Powered by» por ahora. Bloques: 1 motor y pantalla (hecho), 2 documentos y marca de agua, 3 mensajes editables,
4 página del paciente, 5 pie legal y documentación.

- Hecho en el bloque 1: `src/brand/` (motor OKLCH con contraste AA probado con cientos de colores, hoja de marca
  encima de tokens.css, sin parpadeo al abrir, favicon, título y color de la barra del móvil), Logo.tsx con el logo
  de la clínica, fila «Marca de la clínica» en Ajustes › Clínica.
- Hecho en el bloque 2: membrete con la marca en informe, alta, derivación, justificante, recibo y hoja de
  ejercicios; marca de agua en pantalla, al imprimir y en cada página del PDF; pie «Documento generado con OmniClin»;
  los consentimientos guardan la marca con la que se firmaron. Las facturas antiguas (solo lectura) no cambian.
- Hecho en el bloque 3: Ajustes › Mensajes a pacientes (`src/messages/`): los seis mensajes con texto y asunto
  editables, fichas que se insertan, vista previa y firma común; los seis sitios de la app leen de ahí; el texto del
  recordatorio que ya hubiera se conserva. Agenda › Recordatorios enlaza a esa pantalla.
- Hecho en el bloque 4: la página del paciente lleva la marca de la clínica (nombre, colores, logo pequeño) dentro
  del sobre cifrado del formulario; los enlaces antiguos se abren con la de OmniClin.
- Hecho en el bloque 5: Privacidad dice siempre quién hace el programa y, con el servidor de la clínica, explica
  dónde están los datos (antes decía, por error, que la app hablaba solo con Google Drive) y quién es encargado del
  tratamiento; la ayuda dice dónde se cambian los mensajes; fichas de Mensajes a 44 px; prueba de 44 px en las
  pantallas nuevas; documentación (RESUMEN, soporte, índice). El texto legal no está revisado por un abogado:
  revisarlo con la asesoría o el delegado de protección de datos.
- Pendiente para después: el icono de la app instalada solo cambia al reinstalar (límite del navegador); PDF con
  texto buscable; una segunda versión del logo para oscuro si alguna clínica la pide; tipografía y bordes propios.

## Tras probar el bloque A (pedido y hecho el 27-10-2026)

- **Fisios del paciente.** El usuario no veía cómo decir qué fisio lleva a cada paciente, y sin eso el filtro «Fisio»
  no tenía sentido. Hecho: en la cabecera de la ficha, **Asignar fisio** (o «Fisio: Ana», «Fisios: Ana, Bruno»), solo
  en una clínica con equipo; una hoja con el equipo para marcar uno o varios y cuántas citas tiene con cada uno; si
  alguno ya no está en el equipo, sale para poder quitarlo. Se sincroniza (migración 034, tabla `patient_staff`, una
  fila por paciente y fisio: dos personas que asignan a la vez no se pisan) y sale en la historia exportada. El
  filtro «Fisio» busca los asignados; si un paciente no tiene a nadie asignado, los que tienen alguna cita suya
  (como antes). Pruebas: `src/data/patientSearch.test.ts`, `src/data/fieldMerge.test.ts` y CL16 en
  `e2e/clinics.spec.ts`.
- **Hoja de protección de datos firmada en la pantalla.** Antes solo se imprimía. Hecho: «Firmar en la pantalla»,
  como los consentimientos; se guarda la hoja entera (texto con su versión, respuestas a fotos y vídeos, WhatsApp o
  correo y docencia, y la firma del paciente o su representante), se ve e imprime después tal como se firmó, cuenta
  como «firmada» en el filtro de pendientes y sale en la exportación. Si cambian las respuestas, avisa de que la hoja
  firmada ya no coincide. Pruebas: `src/data/privacy.test.ts`, `src/export/fullExport.test.ts` y PD4 en
  `e2e/privacy.spec.ts`. Sigue siendo un modelo por revisar con la asesoría (punto 2 de arriba).
- **Que no se quede nada en el tintero en Cloudflare.** El servidor dice su versión (`SERVER_VERSION` en
  `cloudflare/worker.js`) y si tiene el almacén R2; si está por detrás de lo que necesita la app
  (`src/cloud/serverStatus.ts`) o falta R2, Ajustes → Proveedor lo dice en naranja («Pendiente en Cloudflare:
  actualizar el servidor y activar R2») y el panel explica cómo. Mientras se pegue el `worker.js` de antes (sin
  versión), avisará de actualizarlo. Pruebas: `src/cloud/serverStatus.test.ts`, «salud» en
  `cloudflare/worker.test.ts` y CL8.
- **Dudas del usuario sobre el cobro de Cloudflare (respondidas):** Workers y D1 en el plan gratuito nunca cobran;
  al pasarse de un límite, dan error hasta el día siguiente (peticiones) o hasta que haya sitio (base). Para más,
  hay que pasar al plan de pago con tarjeta (unos 5 $ al mes). R2 pide tarjeta para activarlo y cobraría solo pasados
  10 GB, pero el tope del servidor (`DOCS_CAP_GB`, 10 GB) para los archivos antes; las copias de las clínicas no se
  rechazan nunca, pero ocupan poco.

## Clínicas grandes y muchas clínicas (medido el 26-10-2026)

Pregunta del usuario: qué pasa si da servicio a 10 clínicas de 10.000 pacientes cada una. Lo que más le importa: que
la sincronización nunca dé problemas, también cuando varias personas cambian cosas a la vez. Hechos: el DNI en la
búsqueda, el bloque B (26-10-2026) y el bloque A (27-10-2026). Quedan C y D.

- **Medido** (ordenador de pruebas, clínica inventada de 10.000 pacientes con 57.000 citas y 32.000 sesiones, unos
  3 años de 10 fisios): base de 174 MB en cada dispositivo; copia comprimida de 54 MB; lista de pacientes 0,4 s;
  agenda de una semana 0,05 s. Con 500 pacientes: 10 MB, copia de 2,9 MB. Exportación completa de los 10.000 (sin
  PDF): .zip de 120 MB, 3,5 minutos y unos 3.200 MB de memoria a la vez. Importar 10.000 pacientes, 2 s; 30.000
  sesiones de un CSV de 14 MB, 10 s.
- **Límites antes del bloque A** (el 27-10-2026 quedan solo los dos últimos):
  - ~~La copia de la clínica tenía un tope de 50 MB en el servidor~~: con R2 ya no (hasta 2 GB). Sin R2 sigue igual,
    y el panel del proveedor avisa desde 35 MB.
  - ~~Hacer la copia en el móvil juntaba la base, la comprimida, la cifrada y el texto (unos 355 MB)~~: ahora la
    base y la cifrada (unos 230 MB con 10.000 pacientes, calculado: 174 + 54), sin el texto en base64.
  - ~~La lista de pacientes cargaba y dibujaba todos~~: ahora de 50 en 50, buscando en la base.
  - La exportación completa monta el .zip en memoria (bloque C).
  - Plan gratuito: base de 500 MB para todas las clínicas (con R2, las copias ya no van ahí); 100.000 peticiones al
    día (ahora 1 por minuto y dispositivo en uso, 1 cada 5 minutos sin uso); 10 ms de proceso por petición.
- **Sincronización a la vez (cómo es hoy):** cada cosa es una fila (cada sesión, cita, cobro, cuestionario o
  archivo): dos personas que añaden cosas a la vez nunca se pisan. Si dos cambian la misma fila (los datos del
  paciente, la misma anamnesis, la misma cita), gana el último cambio entero y el otro dispositivo ve «Editado por»
  si lo había cambiado en el último cuarto de hora; lo anterior no se guarda. Dos citas a la misma hora de la misma
  persona pueden quedar las dos si se dan a la vez en dos dispositivos.
- **Propuesto (por bloques, a la espera del usuario):**
  - A. **Hecho el 27-10-2026.** La copia de la clínica a R2, por trozos de 8 MiB y en bytes (formato `CENITENC2`,
    cifrada por trozos de 4 MiB que no se pueden cortar ni cambiar de orden sin que se note); el servidor la baja
    sin juntarla en memoria (antes, con 40-50 MB podía pasarse de sus 128 MB). Copia entera menos a menudo en las
    clínicas grandes (desde 5 MB: a los 1.000 lotes o al 10 % de lo que ocupa). Una consulta por minuto (dice también
    si hay formularios respondidos) y una cada 5 minutos si nadie toca la app: 1 petición por minuto, antes 1,9.
    Pacientes de 50 en 50 con buscador en la base (nombre, teléfono o DNI y lo demás de la ficha) y filtros: edad,
    sexo, fisio, con cita próxima, última vez que vino y con algo pendiente de cobrar o de firmar. Panel del
    proveedor con lo que ocupan el almacén y la base, y avisos al 70 %; tope del almacén con `DOCS_CAP_GB`.
    Medido con 10.000 pacientes (la clínica de prueba, base de 39 MB): primera página 0,05 s (antes la lista entera,
    0,2-0,4 s, y dibujar 10.000 filas); buscar un nombre 0,08 s; un teléfono 0,09 s; filtros sencillos 0,01-0,04 s;
    pendiente de cobrar 0,4 s y de firmar 0,6 s (una vez al ponerlo, no en cada página). Pruebas:
    `src/data/patientSearch.test.ts`, «copia de la clínica en R2» en `cloudflare/worker.test.ts`,
    `src/cloud/remote.test.ts`, `src/cloud/crypt.test.ts`, `src/cloud/limits.test.ts`, CL14-CL15 en
    `e2e/clinics.spec.ts`, CAP1-CAP2 en `e2e/capacidad.spec.ts` y F01-E7 en `e2e/f01-patients.spec.ts`.
  - Pendiente del bloque A: el selector de pacientes de la agenda y el de «Registrar en un paciente» ya buscan en la
    base; la importación de pacientes (comprobar duplicados) sigue cargándolos todos (una vez, al importar).
  - Las peticiones al día no las cuenta el servidor (costaría una escritura por petición). **Hecho el 27-10-2026,
    a petición del usuario («que me avise solo a mí»):** el panel del proveedor se las pregunta a las estadísticas
    de Cloudflare con un token de solo lectura (`CF_ACCOUNT_ID` y el secreto `CF_API_TOKEN` en el Worker;
    `cloudflare/README.md`, «Peticiones al día») y avisa al 70 % allí y en Ajustes → Proveedor. Las clínicas no lo
    ven. Pruebas: «peticiones de hoy» en `cloudflare/worker.test.ts`, `src/cloud/limits.test.ts` y CL8.
  - B. **Hecho el 26-10-2026** (el usuario la puso primero): sincronización campo a campo (migración 033; si uno
    cambia el teléfono y otro las notas, se quedan los dos; en la anamnesis, respuesta a respuesta), lo que pierde se
    guarda tres meses para recuperarlo (Ajustes › Cuenta › «Cambios sustituidos»), aviso de cita doble al
    sincronizar y una ventana fija abajo mientras algo impide sincronizar («Pulsa para sincronizar»). Medido con
    10.000 pacientes: un móvil nuevo tarda 44 s en juntar la copia (antes, 118 s); aplicar un lote de 400 cambios,
    0,12 s (antes, 0,10 s); ningún cambio perdido (antes, si dos personas tocaban la misma ficha, uno se perdía).
    Pruebas: `src/data/fieldMerge.test.ts` (tres dispositivos al azar con 12 semillas acaban iguales) y CL13 en
    `e2e/clinics.spec.ts`.
  - C. Exportación por partes: escribir en el disco paciente a paciente (Chrome o Edge de ordenador) o varios .zip
    de tamaño fijo, cada uno completo, que se puede reanudar.
  - D. Más adelante: archivar los pacientes inactivos (en los dispositivos queda una ficha mínima para buscarlos; su
    historia se baja al abrirlos o al tener cita).
  - iPhone: probar la app instalada en un iPhone de verdad (`docs/pasos-pendientes.md`, paso 5). Si da problemas,
    la alternativa es una app de la App Store hecha con la misma web (Capacitor): 99 € al año de Apple y un Mac o un
    servicio que la compile.

## Precios y márgenes (ideas para cuando se facture)

El usuario pidió tener presentes estas ideas para más adelante.

- Cloudflare de pago (Workers Paid, unos 5 $ al mes): base de 10 GB, 5 GB incluidos y después 0,75 $ por GB al mes;
  10 millones de peticiones al mes; más tiempo de proceso. Conviene en cuanto se facture.
- R2 (archivos y copias de las clínicas, desde el 27-10-2026): 10 GB gratis y después 0,015 $ por GB al mes (500 GB,
  unos 7,35 $; 1 TB, unos 15 $). Bajar archivos no se cobra. El tope se sube con `DOCS_CAP_GB`.
- Cupo de archivos por clínica (por ejemplo, 20 GB incluidos en su cuota, unos 0,30 $ al mes de coste) y planes por
  tamaño de clínica.
- Si un día hace falta app en la App Store: 99 € al año de Apple; en Google Play, 25 $ una vez (según guías de
  2026; las cuentas personales quizá necesiten 14 días de prueba con 12 personas). En Mac no hace falta tienda
  (Safari «Añadir al Dock», Chrome o Edge la instalan). En iPhone, fuera de la web instalada, siempre hace falta la
  cuenta de Apple; las tiendas alternativas de la UE piden requisitos de empresa.
- Recordatorios automáticos (sin pulsar): SMS, unos 0,09 $ cada uno (Twilio, España); WhatsApp de empresa (Meta),
  unos 2-3 céntimos según webs de terceros, más el margen del intermediario. Una clínica con 100 citas a la semana:
  unos 38 $ al mes por SMS u 11 $ por WhatsApp. Se podría cobrar como extra. Exige que el servidor conozca el
  teléfono y la hora de cada cita (decisión de privacidad).

## Archivos del paciente: informes y pruebas en PDF (hecho el 26-10-2026)

Pedido por el usuario: guardar en la ficha los informes que trae el paciente (le llegan al ordenador y por WhatsApp
o correo al móvil) y un enlace para que el paciente los suba él, como la anamnesis. Decidido con él: R2 de
Cloudflare con tope de 10 GB, las fotos pasadas a PDF, 5 archivos por enlace y 5 MB por archivo.

- Hecho: en la ficha, **Documentos › Archivos del paciente**: añadir PDF o fotos (las fotos de una vez se juntan en
  un PDF, reducidas si hace falta), abrir (se descarga), enviar, cambiar el nombre y borrar. **Pedírselos al
  paciente** manda un enlace («Sus informes y pruebas»); lo que sube aparece en sus archivos al recogerlo. En
  Android, con la app instalada, **Compartir → OmniClin** desde WhatsApp, el correo o la galería, y se elige el
  paciente. La exportación completa lleva los archivos (carpeta «Archivos de pacientes», con enlaces desde la ficha
  de cada paciente y una hoja en el Excel).
- Cómo va: cada archivo se cifra en el dispositivo con su propia clave (que va en la copia cifrada de la clínica),
  se guarda en el dispositivo y se sube al servidor, que lo deja en R2 (UE). Los demás dispositivos lo bajan solo
  al abrirlo. Lo pendiente se sube solo cada minuto. Ajustes › Copias y exportar enseña lo que ocupan y deja
  liberar espacio en el dispositivo.
- Solo con el servidor de la clínica y con R2 activado (`docs/pasos-pendientes.md`, paso 4). Sin eso, la app no
  ofrece los archivos.
- Límites conocidos:
  - No hay visor dentro de la app: abrir un archivo es descargarlo y abrirlo con el visor del móvil o del ordenador.
  - Compartir → OmniClin solo en Android con la app instalada; en iPhone el navegador no lo permite (allí, con el
    botón).
  - La exportación completa junta todo en memoria: con muchos GB de archivos puede ir lenta o fallar en un móvil;
    mejor hacerla en un ordenador.
  - Si un archivo se añade sin conexión y ese dispositivo se borra antes de subirlo, ese archivo se pierde (los
    demás ven que existe, pero no pueden abrirlo).
  - En casos raros (una clínica que borra un archivo justo mientras otro dispositivo lo sube) puede quedar un
    archivo suelto en R2 que ocupa espacio; no se ve ni se puede leer sin su clave.
- Ideas para después, si se piden: visor de PDF dentro de la app; buscar dentro de los archivos; carpetas o
  etiquetas (informe médico, prueba de imagen…).

## Lista de espera para ordenar y filtrar (hecha el 25-10-2026)

Pedido por el usuario: poder ordenar la lista de espera por tiempo de espera y filtrarla por mañanas, tardes, días de
la semana y varias cosas a la vez, pensando en todas las variables.

- Hecho: cada paciente de la lista lleva además si es **preferente**, desde qué día **puede** venir y, si hace falta,
  unas **horas concretas** (de 18:00 a 20:00) en vez de mañanas o tardes (migración 031). Un hueco le encaja si es uno
  de sus días, en su franja u horas (y cabe entero) y ya puede venir.
- **Ordenar por:** más tiempo esperando (lo de siempre), menos tiempo esperando, preferentes primero, sin cita primero
  (y después la más lejana), sin ofrecer primero, nombre.
- **Filtros que se combinan:** buscar (nombre, nota o teléfono), franja (quien puede a cualquier hora sale en las dos),
  días (alguno de los marcados), con quién puede (en un equipo), solo preferentes, solo los que ya pueden venir,
  ofrecido o no, con cita o sin ella, y cuánto lleva esperando (más de una semana, dos o un mes). Se ven arriba como
  etiquetas que se quitan de una en una; el orden y los filtros van en la dirección y se conservan al volver.
- Con un hueco libre, primero salen a quienes les encaja, y dentro de eso, el orden elegido.
- La exportación completa lleva las columnas nuevas; la clínica de prueba trae de todo para probarlo.
- Hecho después (mismo día), a petición del usuario: desde cada paciente de la lista, **WhatsApp** (con el mensaje
  «Lista de espera» de Ajustes › Mensajes, editable; queda como ofrecido), **Dar cita** sin salir de la lista y **Ver
  ficha**. La ficha tiene su WhatsApp en la cabecera y, si se llegó desde la lista, «‹ Lista de espera» vuelve a ella
  con sus filtros (también tras cambiar de pestaña). Al dar cita a alguien de la lista (desde la lista o desde su
  ficha) se pregunta si sale de ella o sigue esperando para adelantarla. **«Tengo un hueco libre»** pone un hueco a
  mano (día, hora, duración y con quién) y la lista enseña a quién le encaja, con el WhatsApp del hueco listo.
- Pendiente para después, si se pide: que el propio paciente se apunte desde su página.

## Clínica de prueba con volumen (hecha el 25-10-2026)

Pedido por el usuario: muchos pacientes inventados en su perfil para probar la app «viva» y ver qué pasa al
saturarla, con varios fisios repartidos por igual, y poder borrarlo todo después. Decidido: en una clínica de prueba
aparte (opción A), con modo estrés y teléfonos falsos.

- Hecho: Ajustes › Copias y exportar › Clínica de prueba (`src/demo/`). 100 pacientes (o 500 en modo estrés) con
  anamnesis, CIF, exploración, cuestionarios con la nota de la app, mapa del dolor, PSFS, movilidad, saltos en los
  deportistas, sesiones, bonos, cobros, consentimientos, lista de espera y algún motivo de consulta anterior; cinco
  fisios inventados (más quien lo carga) con turnos de mañana o de tarde, unas vacaciones y la agenda desde hace dos
  meses (seis en estrés) hasta final del mes que viene, repartida por igual. Teléfonos +44 7700 900xxx (reservados
  por el regulador británico para la ficción). Solo en una clínica vacía y solo quien la administra; se borra entero
  (y los ajustes que tocó vuelven a como estaban). Las citas inventadas no van al Google Calendar de quien las carga.
- Medido en las pruebas: 100 pacientes, unas 700 citas en unos segundos; 500 pacientes, unas 3000 citas en unos
  35 s, 17 MB en el navegador, y cada pantalla (pacientes, búsqueda, ficha, agenda, recordatorios, lista de espera,
  cobros) abre en un segundo o menos. Con el servidor, los 500 suben cifrados en unos 10 s más.
- Pendiente: probarlo el usuario en su clínica de prueba real y decir qué pantalla se le hace lenta.

## Propuestos por el usuario (23-10-2026)

1. **Bandeja de envíos automáticos por WhatsApp.** La app prepara sola lo que toca mandar (anamnesis el día
   antes de la primera cita, cuestionarios de seguimiento, recordatorios de mañana) y con «Enviar todos» se abren
   los WhatsApp uno tras otro con el texto y el enlace. Gratis y sin riesgo.
   - Descartado: automatizar WhatsApp Web con un programa (va contra sus normas; riesgo de bloqueo del número).
   - Más adelante, si se quiere envío 100 % automático: API oficial de WhatsApp Business (Meta cobra por
     mensaje) con un servidor que solo conozca teléfono y hora. Es de pago: decidirlo antes.
   - **Hecho el 24-10-2026** (Agenda › Hoy › Envíos, `src/schedule/outbox.ts`): recordatorios del día antes,
     anamnesis 48 horas antes de la primera cita (o en cuanto se da, si queda menos; antelación configurable) y
     cuestionarios antes de reevaluar (los que rellenó hace 2 semanas o más), con «Enviar uno tras otro». Lo enviado
     o descartado se apunta y se sincroniza (migración 026). La anamnesis y los cuestionarios necesitan el servidor
     de la clínica. Los navegadores no dejan abrir varios WhatsApp a la vez: por eso es un toque por mensaje.
2. **Facturación y Verifactu — CAMBIADO el 24-10-2026: la app ya no hace facturas (ver Q2 arriba).** Lo que sigue
   es la historia. Primero facturas con numeración legal desde cobros y bonos; después Verifactu
   (registro encadenado, QR, declaración responsable del fabricante, certificado digital de la clínica).
   Confirmar requisitos y fechas (aplazadas a 2027) con una asesoría. Mirar si sirve mientras tanto la
   aplicación gratuita de facturación de la AEAT.
   - **Hecho el 24-10-2026 (primera parte):** Ajustes › Facturas y «Hacer la factura» en cada cobro del paciente
     (`src/data/invoices.ts`, migración 028). Factura completa o simplificada (hasta 400 €), numeración
     correlativa por serie y año (una letra por persona: A2026-0001…; rectificativas aparte: RA2026-0001…),
     IVA exento con su motivo o con tipo, retención de IRPF opcional, varias líneas, PDF e impresión, libro de
     facturas en CSV para la gestoría y hoja «Facturas» en la exportación completa. Una factura emitida no se
     cambia ni se borra (ni al borrar el paciente): se anula con una rectificativa. Cada una guarda los datos de
     la clínica y del destinatario de ese momento y una huella encadenada; la app avisa si una factura se ha
     tocado, si falta un número o si hay dos iguales (dos dispositivos con la misma serie sin conexión).
   - Pendiente: Verifactu (formato de registro de la AEAT, código QR, envío y declaración responsable). No está
     hecho y la app lo dice. Confirmar con la asesoría: exención de IVA de cada servicio, cuándo retener IRPF,
     qué datos del paciente deben salir y si las series por persona les valen.
3. **Firma de consentimientos con más prueba.** Hoy es firma simple (dibujo en pantalla o papel). Paso gratis:
   guardar con cada firma la fecha, el dispositivo y una huella del documento. Firma avanzada (tipo Viafirma)
   solo si la asesoría lo ve necesario, sobre todo para técnicas invasivas. Estado: pendiente.
4. **Dictado por voz (alternativa a Noa Notes).** Con el reconocimiento de voz del navegador, en la sesión y la
   anamnesis, revisando antes de guardar. Resumir una consulta entera necesitaría una IA de pago: no por ahora.
   Estado: pendiente.

5. **Reserva online 24/7 — QUITADA el 24-10-2026 por decisión del usuario (ver Q1 arriba).** Lo que sigue es
   la historia de cómo se hizo. Página pública de la clínica donde un paciente ve
   los huecos libres según los turnos del equipo y reserva sin cuenta.
   - Cómo, sin exponer datos: la app calcula los huecos (turnos menos citas) y sube al servidor de Cloudflare
     **solo horas libres y nombre del profesional**, nunca pacientes. Se actualiza al cambiar la agenda.
   - El paciente elige hueco y deja nombre, teléfono, email y motivo. Eso se cifra en su navegador con la clave
     pública de la clínica: el servidor no puede leerlo. El servidor bloquea el hueco al momento para que no lo
     coja otro.
   - La app recoge las reservas al abrirse, crea la cita en la agenda y la ofrece en la bandeja de WhatsApp para
     confirmar. Antes de la primera cita, la anamnesis se manda sola desde la bandeja (idea 1).
   - Decisiones abiertas: confirmación automática o «solicitud» que la clínica acepta; antelación mínima y
     máxima; duración y tipos de cita (primera visita, seguimiento); qué profesionales salen; política de
     anulación; protección contra reservas falsas (límite por dispositivo, verificación del teléfono).
   - Coste: plan gratuito de Cloudflare. Un correo automático de confirmación al paciente necesitaría un servicio
     de envío (posible coste): en su lugar, confirmación en pantalla, archivo para su calendario y WhatsApp.
   - Requiere modo clínica con nube (el modo solo en el dispositivo no puede publicar huecos).
   - **Decidido por el usuario (23-10-2026):**
     - Al reservar, la bandeja propone el WhatsApp de confirmación, y ese mensaje lleva un **enlace para anular**.
     - Anular tiene que ser muy fácil: abrir el enlace, ver la cita y un botón «Anular cita». Sin cuenta ni
       llamadas. El hueco vuelve a quedar libre en la página al momento, y la app anula la cita al recogerlo
       y avisa a la lista de espera. El mismo enlace sirve también para las citas que da la clínica, no solo
       para las reservadas online.
     - La anamnesis de la primera visita se manda **48 horas antes**. Si la cita se reserva con menos de 48
       horas, se manda en cuanto se reserva (junto a la confirmación).
     - Ojo: los envíos de la bandeja salen cuando alguien abre la app y pulsa «Enviar». El de las 48 horas
       aparece en la bandeja ese día; si nadie la abre, sale más tarde.
   - **Hecho el 24-10-2026** (Ajustes › Reserva online, `src/booking/`, página `…/reservar/<clínica>` y enlace
     `…/cita/<código>`):
     - Huecos según el horario de la clínica o los turnos de cada fisio, menos las citas; tipos de cita con su
       duración; antelación mínima, días vista y cada cuánto empiezan las citas, configurables. En una clínica
       con equipo, la clínica elige quién sale y el paciente puede elegir fisio o «me da igual».
     - Reserva directa (no «solicitud»): el hueco se bloquea al momento en el servidor. Límite de 3 reservas al
       día desde una misma conexión y 300 sin recoger por clínica. Sin verificación del teléfono (necesitaría SMS,
       de pago).
     - Los datos del paciente se cifran en su móvil para la clínica (el servidor no puede leerlos y los borra al
       recogerlos). La app crea la cita y, si no existe, el paciente (por móvil o correo).
     - Confirmación en Agenda › Envíos con el enlace para anular (y la anamnesis si su primera cita es en menos de
       48 horas; si no, sale 48 horas antes). Al reservar, el paciente ve el enlace y puede añadir la cita a su
       calendario.
     - Anular: abrir el enlace, «Anular la cita», confirmar. El hueco sale libre en la página al momento. La app
       anula la cita al recogerlo y, si hay lista de espera, lo recuerda en el aviso.
     - Si la clínica mueve o anula una cita con enlace, el paciente ve la hora nueva o «anulada» en su enlace.
   - Limitaciones: las reservas entran en la agenda cuando hay un dispositivo de la clínica con la app abierta (se
     mira cada dos minutos). El WhatsApp de confirmación lo manda la clínica con un toque, no sale solo. La lista de
     espera no se apunta desde la página (el paciente ve el teléfono de la clínica).
   - Ideas para después: que el paciente se apunte a la lista de espera desde la página; avisar por correo; varias
     sedes.
   - Antes de encenderla: el administrador ejecuta `schema.sql` y pega el `worker.js` nuevo
     (`docs/pasos-pendientes.md`, paso 4). El texto «Tus datos» de la página conviene revisarlo con la asesoría.

6. **Preparar la app para otras clínicas (soporte y fiabilidad).** Antes de abrirla fuera de Fisiolab:
   - Registro de errores dentro de la app (sin servicios externos) y botón «Enviar informe de fallo» que copia
     versión, dispositivo y últimos errores para mandarlo por correo o WhatsApp.
   - Linter y formateador en la integración continua; pruebas de navegador también en WebKit (iPhone).
   - Servidor: el plan gratuito de Cloudflare da unos 80 dispositivos a la vez en total (100 000 peticiones al
     día, `cloudflare/README.md`). Con varias clínicas en un mismo servidor, o cada clínica monta el suyo, o
     pasar a Workers Paid (unos 5 $ al mes). Medir la carga real antes.
   - Simulacro de desastre: perder el móvil, restaurar desde la copia cifrada y comprobar que no falta nada.
   - Piloto con una o dos clínicas conocidas durante un mes, con una versión «de prueba» separada de la estable.
   - Soporte: página de problemas frecuentes y un canal claro; decidir quién atiende y en qué plazo.
   - **Hecho el 24-10-2026** (ver `docs/soporte.md`): registro de fallos e informe, pantalla de error, corrector
     de código en la publicación, pruebas en Safari (solo informan), simulacro de pérdida del móvil, presupuesto
     de peticiones (1,9 por minuto por dispositivo: unos 75 dispositivos todo el día en el plan gratuito) y
     problemas frecuentes. Falta: el piloto con clínicas reales (lo hace una persona) y formatear el código.

## Revisión de lo hecho la noche del 23 al 24-10-2026 (pendiente de arreglar)

Revisado el código de los cuatro bloques (con dos revisiones independientes). Todo lo de abajo está comprobado en el
código salvo lo marcado «a confirmar». Orden propuesto por bloques.

**R1. Fallos que pueden perder datos o mensajes** — **hecho el 24-10-2026:**
- ~~Restaurar una copia borra las facturas hechas después~~: al restaurar se conservan todas las facturas (las de la
  copia y las de este dispositivo), así no se vuelven a dar sus números.
- ~~La misma persona en dos dispositivos puede repetir número~~: ahora cada dispositivo tiene su serie (A, B…), no
  cada persona. Si dos dispositivos sin conexión cogen la misma letra a la vez, uno se la deja al otro en su próxima
  factura. Lo que se hubiera emitido ya con números repetidos lo avisa la lista de facturas («Número repetido…»).
- ~~La bandeja apunta la anamnesis como enviada al enseñarla~~: se apunta al pulsar «Enviar»; con «Saltar por ahora»
  vuelve a salir.
- ~~Una reserva que no se puede abrir se queda para siempre~~: se descarta y la app avisa («puede ser falsa»).
  Además el servidor ya no acepta lo que no tenga la forma de una reserva cifrada.
- ~~Una anulación se da por vista aunque el dispositivo no tenga la cita~~: se queda en el servidor hasta que llega la
  cita (o hasta que ya ha pasado).
- ~~Al borrar una cita con enlace para anular, el enlace sigue funcionando~~: se desactiva. Al restaurar una copia no
  se desactiva nada (lo que falta en la copia puede seguir en otros dispositivos).
- ~~Dos pacientes que reservan el mismo hueco a la vez~~: el servidor comprueba y guarda en un solo paso; el segundo
  ve «Ese hueco se acaba de ocupar». Si una reserva cae encima de una cita dada a mano, el aviso lo dice en rojo.
- ~~Si la app vuelve a publicar los huecos antes de recoger una anulación, el hueco anulado se vuelve a tapar~~: el
  servidor lo mantiene libre hasta que la clínica recoge la anulación (lo encontró una prueba automática).
- Lo que queda: si dos dispositivos emiten facturas **sin conexión** con la misma letra antes de sincronizar, pueden
  repetir número (se avisa; se arregla con una rectificativa). Con conexión no pasa.

**Medición con el inclinómetro (visto el 24-10-2026, sin tocar):** si se pulsa «Registrar lectura» antes de que
salga «Estable», el número grande puede decir 37° y la lectura guardarse como 38°: se guarda con un decimal (37,46 →
37,5) y luego se redondea otra vez al enseñarla. Con la lectura estable no pasa. Arreglarlo (guardar sin redondear
antes, o enseñar el decimal) cambia cómo se guarda la medición: decidirlo antes.

**R2. iPhone** — **en marcha el 24-10-2026:**
- Lo que fallaba en la prueba con el motor de Safari (WebKit): la primera vez que se abre la app va bien, pero en la
  segunda carga de página en la misma pestaña salía «OmniClin ya está abierta en otra pestaña». Safari guarda la
  página anterior «congelada» (para volver atrás deprisa) con su base de datos abierta. En un iPhone puede pasar al
  volver de entrar con Google, al cambiar de clínica, al cerrar sesión o al recargar.
- ~~Arreglo~~ **hecho:** la app cierra su base al dejar la página y, si Safari devuelve la congelada, la recarga.
  Prueba nueva PWA-H3 (recargar, otra dirección y volver atrás: los datos siguen).
- **Hecho también:** si la página anterior tarda más de 3 segundos en soltar la base (un móvil lento), el aviso «ya
  está abierta en otra pestaña» ya no se queda para siempre: en cuanto se suelta, la app sigue sola. Lo mismo al
  cerrar la otra pestaña de verdad.
- Las pruebas de gestos con dos dedos y la de leer el portapapeles no se pueden hacer en el WebKit de pruebas de
  Linux (no deja simular toques ni da permiso de portapapeles): ahí se saltan; en Chromium siguen.
- **Resultado en GitHub tras el arreglo (24-10-2026): sigue fallando (22 de 41).** En ese Safari de pruebas la base
  ya trabaja «en memoria» desde la primera carga (no guarda nada) y la segunda carga de página no llega a verse. Se
  ha añadido una prueba de diagnóstico (e2e/webkit-diagnostico.spec.ts, solo en WebKit) que apunta en el registro de
  GitHub qué pasa en cada carga. **Aún no se sabe si en un iPhone de verdad pasa lo mismo**: el Safari de pruebas de
  Linux no es igual que el del iPhone.
- **Lo que dijo el diagnóstico:** (1) el WebKit de Linux no tiene almacenamiento privado (OPFS): ahí la app solo
  puede ir en memoria, y por eso se pierde todo al recargar; es del navegador de pruebas, no de la app. (2) La
  segunda carga ya se ve bien (el arreglo de la base funciona); lo que salía era la pantalla de entrar con Google,
  porque el service worker pedía la configuración de verdad sin pasar por el ajuste de la prueba.
- **Cambiado:** la prueba de Safari pasa a un Mac (WebKit con OPFS, más parecido al iPhone; gratis en un repositorio
  público) y el servidor de pruebas sirve la configuración sin Google en esa prueba.
- **En el Mac, primer tropiezo (arreglado):** la app no compilaba porque había dos archivos cuyo nombre solo cambiaba
  en una mayúscula (`BodyMap.tsx` y `bodyMap.ts`); en Linux conviven, en Mac y Windows son el mismo. Renombrado a
  `BodyMapParts.tsx` y una prueba nueva (`src/nombresDeArchivo.test.ts`) impide que vuelva a pasar.
- **Repasando el arranque (24-10-2026):** si la página anterior aún tiene cogido el almacenamiento (OPFS) un instante,
  la app caía a «en memoria» sin avisar y lo que se escribiera se perdía al cerrar; ahora insiste hasta 5 segundos
  antes de rendirse. Y mientras abre los datos, si tarda más de segundo y medio, pone «Abriendo tus datos…» en vez de
  una pantalla en blanco.
- **Resultado en el Mac (24-10-2026, por la tarde):** la app compila y arranca; pasan 17 de 41. Las que fallan son
  las que recargan o cambian de página: el almacenamiento existe pero al abrirlo Safari responde «UnknownError: The
  operation failed for an unknown transient reason» y la app va en memoria. Es **del navegador de pruebas**: el
  WebKit de Playwright usa una sesión efímera (como una ventana privada de Safari), y en ese modo WebKit no da el
  almacenamiento privado; con un perfil persistente sí ([playwright #18235](https://github.com/microsoft/playwright/issues/18235),
  [LumiLab #282](https://github.com/radiantlab/LumiLab/issues/282), [tallyui #304](https://github.com/TallyUI/tallyui/pull/304)).
  Pero el WebKit de **Playwright 1.56** (la versión del proyecto) no arranca con perfil persistente en Mac («Browser
  started with no default context», [playwright-rust #39](https://github.com/padamson/playwright-rust/issues/39));
  está arreglado en versiones posteriores, y otros proyectos necesitaron la 1.64 ([maibuk #514](https://github.com/M4ss1ck/maibuk/pull/514)).
  Las pruebas ya intentan el perfil persistente y, si no pueden, siguen como antes avisando.
- **Siguiente paso para tener una señal fiable de Safari:** subir Playwright a la 1.64 o posterior. Cambia el
  Chromium de todas las pruebas, así que hay que pasar la tanda completa en los dos modos después (una hora larga)
  y revisar los fallos que salgan. Hasta entonces, el trabajo «webkit» de GitHub sigue siendo solo informativo.
- **Lo más importante sigue siendo probar en un iPhone de verdad** (pasos en docs/pasos-pendientes.md, «Probar en
  un iPhone»): un iPhone real tiene almacenamiento persistente, así que nada de lo anterior tiene por qué pasar ahí.

**Pruebas automáticas que fallan de vez en cuando (24-10-2026):** en la tanda completa (4 navegadores a la vez en una
máquina de 4 núcleos) a veces cae 1 de 170 y en solitario pasa siempre:
- ~~RS1 (reserva)~~ arreglada: comprobaba que el servidor no guardara «611» y el código de anular, que es al azar,
  lo contenía por casualidad; ahora busca el móvil entero.
- ~~CL8 (borrar una clínica)~~ arreglada: una tarea de fondo (reserva o formularios) llamaba al servidor justo después de
  borrar la clínica y el navegador apuntaba el «410» como error; al salir de una clínica ya no se llama al servidor.
- AG7 (justificante) y antes F15-H3 (importar CSV): tras guardar algo y cambiar de página, la página no llega a pintarse
  en 30 segundos. Solo con la máquina saturada; 30 de 30 en solitario. Desde ahora la tanda guarda una traza de cada
  fallo (`--trace retain-on-failure`) para verlo la próxima vez. No se ha visto fuera de las pruebas.

**R3. Reserva online — ya no aplica: la reserva online se quitó el 24-10-2026.**
- ~~Días cerrados y festivos~~ **hecho el 24-10-2026:** «Cerrar la agenda» (de un fisio o de toda la clínica; una
  tarde, un día o varios), se ve rayado en la agenda y la reserva no ofrece esos ratos.
- ~~Una sesión que ya ha empezado no cuenta como ocupada~~ **hecho el 24-10-2026.**
- ~~Al anular, el hueco se libera aunque esté fuera de horario~~ **hecho el 24-10-2026:** solo se libera lo que cae
  dentro del horario abierto de ese fisio. (Sigue pendiente: si se solapa con otra cita suya dada después.)
- ~~Al apagar la reserva, otra clínica puede quedarse con su dirección~~ **hecho el 24-10-2026.**
- ~~Horas fuera de la rejilla (10:07)~~ **hecho el 24-10-2026** (el servidor solo acepta las horas de la lista).
- **Hecho el 24-10-2026, a petición del usuario:** página de reservas como en las apps de reservas (tipo de cita con
  su precio, el fisio con su especialidad o «cualquiera», calendario del mes con los días libres, horas de mañana y
  de tarde) y enlace personal de cada fisio (…/reservar/<clínica>?con=<fisio>) para que sus pacientes vuelvan con él;
  al terminar y al anular, «pedir otra cita con…».
- Un fisio sin turnos puestos sale con todo el horario de la clínica (también si está de vacaciones o ya no está
  en el equipo); poner un solo turno quita el resto del mes.
- El paciente se une a una ficha solo por el móvil o el correo (una madre que reserva para su marido con su móvil
  cae en su ficha). El motivo que escribe solo se guarda si es paciente nuevo.
- El permiso de contacto que da al reservar no se guarda; si un paciente tenía «no contactar», no recibe la
  confirmación y nadie lo avisa.
- Al apagar la reserva, otra clínica del mismo servidor puede quedarse con su dirección.
- Límite de reservas por día fácil de saltar; horas fuera de la rejilla (10:07) rompen los huecos.
- Política de anulación (no dejar anular a menos de X horas) y «cambiar la hora» además de anular.

**R4. Bandeja de envíos:**
- Recordatorios y Envíos hacen lo mismo en dos sitios: juntarlos en uno.
- El recordatorio es solo «mañana»: los lunes y después de un festivo no sale el día antes.
- Una reserva para mañana manda dos WhatsApp seguidos (confirmación y recordatorio).
- Pacientes sin el permiso de contacto apuntado entran en la tanda; el aviso solo sale en la lista.
- «No enviar» no se puede deshacer; si se mueve la cita, el «No enviar» se queda.
- Lo enviado por un compañero no se ve hasta refrescar la bandeja.

**R5. Facturas, más detalles:**
- Desde un cobro con IVA puede salir 1 céntimo distinto de lo cobrado; cambiar el IVA no recalcula el precio.
- El libro en CSV no neutraliza textos que empiezan por = + - @ (Excel podría ejecutarlos como fórmula).
- Al entrar en una clínica, las facturas hechas por tu cuenta se mezclan con las de la clínica.
- El aviso de número repetido no se puede quitar y puede dar «cadena rota» de más.
- Mejor: que el servidor de la clínica dé los números (una serie para toda la clínica, sin repetidos) y las series
  por dispositivo solo sin conexión. IVA distinto por línea.

**R6. General:**
- Cada dispositivo pregunta al servidor por tres cosas por separado (cambios, formularios y reservas): unas 2,5
  peticiones por minuto. Con una sola pregunta «¿hay algo nuevo?» bajaría a 1.
- Si la página de reservas no se puede publicar, solo se apunta el fallo: avisar en la app.
- Las pruebas usan una copia del servidor escrita aparte; mejor probar con el servidor de verdad.

## Del análisis de la competencia (plan de acción)

- Corto plazo: captura de errores en producción guardada en el dispositivo; linter y formateador; prueba
  cronometrada con el equipo de Fisiolab; quitar letras que no se usan de la precarga; guía del primer día;
  cabeceras de seguridad completas también fuera de Cloudflare.
- Medio plazo: cifrar la base del dispositivo y registro de accesos por ficha; validar las mediciones con
  plataforma de fuerza y dinamómetro; trocear archivos grandes y probar en WebKit (iPhone); marcado asistido
  en las mediciones; segunda persona que revise el código.
- Largo plazo: área del paciente por enlace; segundo idioma
  si sale de Fisiolab. Videoconsulta: no, salvo que el equipo la pida.
- Argumento a explicar en Ajustes («Tus datos»): exportación completa, sin permanencia, cifrado.
