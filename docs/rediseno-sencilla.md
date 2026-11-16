# OmniClin más sencilla (rediseño de noviembre de 2026)

Propuesta en tres vueltas con bocetos (15-11-2026), aprobada por el usuario: «barra verde y todas las mejoras sí,
empieza». Página de bocetos: https://claude.ai/artifact/MDkcrT4DF9XJYP7U7jPDkN (privada del usuario). Este documento es
la lista de lo decidido, para hacerlo por bloques. Reglas de siempre: nada se pierde (lo que se mueve sigue accesible),
360 px sin scroll horizontal, zonas táctiles de 44 px, pruebas en los dos modos, y **no se publica ningún bloque sin el
visto bueno del usuario** (se le enseñan capturas reales antes).

Decisiones que el usuario no contestó de forma expresa y se toman con lo recomendado (dijo «me gusta»): juntar «Hoy» y
«Día» en una vista (lo pendiente, en un botón con su número); el dolor, en una fila de once puntos; el orden de abajo.

## Ideas que valen para todo

- El color nunca va solo: siempre con palabra o icono.
- Lo que avisa de seguridad (precauciones, banderas rojas, avisos al dar cita) nunca se pliega.
- Un solo botón principal por pantalla. Los botones de siempre no desaparecen: lo nuevo se suma.
- Móvil (360 px) y ordenador a la vez en cada bloque.

## Colores (bloque 0)

1. El verde (`accent`) es para tocar: botones y enlaces. «Hecho» pasa a gris con ✓ (`done`).
2. Cinco colores para «qué es» (fondo suave / tinta), iguales en calendario, Agenda, Hoy y Resumen:
   cita `#DDEDE5/#14523C`, médico `#F8DEDA/#8C2F1F`, viaje `#DCE8F7/#1F4E86`, deporte `#F3E7C4/#6B5200`, otro
   `#E9E2F2/#56407A`. En oscuro: `#173D2F/#9BE0C0`, `#4A211A/#F5B3A6`, `#1A3352/#A9CBF2`, `#3F3410/#EBD27A`,
   `#33284A/#CDB9EE`. Tipos de evento: surgery, medical y test → médico; travel → viaje; training y competition →
   deporte; other → otro.
3. Tres para «cómo está»: hecho (gris `#E8ECE8/#4A5750`), atención (ámbar, el `warning` de hoy), problema (rojo, el
   `danger` de hoy). Información, en el azul de viaje.
4. El dorado (`highlight`) es «ahora»: el día de hoy, la hora actual y la pestaña en la que se está.
5. El dolor, una sola escala de claro a oscuro (0 → 10): `#EEF1EE #F9E9E5 #F5DAD3 #F0C9BF #EAB6A9 #E3A191 #D98A77
   #CC725E #BC5946 #A64231 #8C2F1F` (texto oscuro hasta el 7, blanco del 8 al 10). Sin semáforo: dice cuánto, no si es
   bueno o malo.
6. Modo oscuro neutro: fondo `#0B1512`, tarjetas `#14211C`, hundido `#0F1A16`, línea `#26352E`, texto `#E9EFEA`, apagado
   `#A3B3AA`, acento `#6CC39D` (hoy es verde sobre verde).
7. Barra de arriba: verde, como hoy. La marca propia de cada clínica (Ajustes › Aspecto) sigue mandando; los colores de
   «qué es» y «cómo está» no cambian con la marca. Todas las parejas pasan AA (≥ 4,5).

## Bloques, en orden

1. **Cabecera de la ficha, compacta y que se encoge.** Nombre + edad; el motivo con por dónde va («Molestia lumbar ·
   sesión 10 de 10», se toca para cambiar); las precauciones siempre a la vista; una fila de acciones: la cita dice su
   estado («mar 17 · 10:00» o «Dar cita»), WhatsApp, lo que debe y «⋯» (teléfono, peso, estatura, quién lo lleva, quién
   ha abierto la ficha). Al bajar se recoge en la barra verde (nombre, cita, WhatsApp, ⋯) con las pestañas pegadas.
   Pasar de pestaña deslizando el dedo.
2. **Calendario del paciente, mes con color.** Cada cosa con su color y su palabra o icono (cita con la hora, «✈
   Viaje» como franja, «✚ Operación», «Entreno»); lo pasado, atenuado y con lo que pasó (✓ atendida, ✕ no vino); los
   colores son el filtro, con su número (sustituyen a Todo · Citas · Eventos); días cerrados rayados; el día se abre
   debajo sin mover la pantalla con «Dar cita a su hora» y «Apuntar algo»; «+1» si hay más de dos cosas; arriba, una
   línea con la próxima cita, cuántas pendientes, WhatsApp y la hoja para imprimir; en ancho, el mes grande y el día
   al lado.
3. **Agenda en el móvil: tira de la semana y el día en lista.** Tira con barra y número de citas por día, días cerrados
   rayados, deslizar para cambiar de semana, «nov ▾» para saltar; el día sin horas vacías: citas (con su estado:
   atendida ✓, cobrada o sin cobrar, 1.ª visita; lo hecho atenuado), línea de la hora actual, «Atender» y «Cobrar» en la
   que toca, huecos libres («Libre 1 h · 2 en espera encajan»), lo cerrado rayado; «Bloquear» e «Ir a hoy» en «⋯» y en
   la tira; «Hoy» y «Día» en una sola vista con «Pendiente N»; en una clínica, chip por fisio. La rejilla para
   arrastrar sigue en «Semana» y en el ordenador.
4. **Botón «＋» central y lupa.** «＋» contextual (en una ficha, primero lo de ese paciente: nueva sesión, darle cita,
   cobrarle, apuntar en su calendario; fuera, nueva cita y nuevo paciente; últimos tres pacientes). Lupa en todas las
   pantallas: pacientes (nombre, teléfono, DNI) y pantallas/ajustes por palabras («bono», «PIN»). Las cuatro pestañas
   no se mueven. En el ordenador, arriba y con teclado.
5. **Apuntar una sesión en una pantalla.** Última sesión plegada arriba; dolor en once puntos (marca el de la última);
   cada cuadro crece al escribir y tiene «Igual que la última» (copia su propio texto); «Y después»: la siguiente cita
   dice el día y la hora y avisa ahí de viajes o cierres, y el cobro con su forma de pago; borrador guardado en el
   dispositivo; «Guardar» fijo abajo.
6. **Listas largas: filas que se abren.** Sesiones: resumen arriba (cuántas, dolor de → a, gráfica), una fila por sesión
   (número, fecha, dolor, primera frase), la última abierta, «Abrir todas», buscar dentro, por meses. Cobros: fila con
   importe, día y forma de pago; al abrir, Recibo, Nº de factura y Borrar; total por mes. Envíos: por tipo y plegados,
   «Enviar uno tras otro» con «3 de 9»; «No enviar», dentro de la fila.
7. **Ajustes y ayuda.** Buscador (con sinónimos) y cinco grupos (Tu clínica, La consulta, Dinero, Mensajes, Seguridad y
   datos) que dicen su estado (ámbar si hay algo que mirar: sin PIN, copia antigua); ayuda por preguntas con buscador y
   un «?» en cada pantalla; página «Novedades» con lo que ha cambiado de sitio y aviso de una vez tras cada bloque; la
   puesta en marcha, en una línea.
8. **Pacientes.** Filtros rápidos con número (Todos, Hoy, Sin cita, Deben; «Filtros» sigue); cada fila: motivo y sesión
   debajo del nombre y una etiqueta con lo más urgente (próxima cita, debe, de viaje, sin cita); índice A–Z en el borde
   (en vez de «Empiezan por»); iniciales con color fijo; fuera la tarjeta «Hoy · sin citas».
9. **Resumen de la ficha como tablero.** Arriba «Lo siguiente» (el paso pendiente más importante de los avisos que ya
   calcula la app, con su botón); cuatro cifras que se tocan (dolor, sesiones, cuestionario principal, cuenta), sin
   interpretación; su calendario con sus colores; documentos y legal plegados en una fila.
10. **Dar cita eligiendo entre huecos.** Tres huecos propuestos (dentro del turno, sin otra cita, agenda abierta, fuera
    de viajes, operación, prueba, competición y entrenos; primero su hora de siempre); o elegir día y ver sus horas
    libres; «Otra hora…» a mano como hoy; el botón dice lo que hace («Dar la cita · mar 17, 10:00»).
11. **Ordenador.** Columna fija a la derecha con lo esencial del paciente (cifras, su calendario, «Nueva sesión») en
    todas las pestañas; lupa y «＋» arriba.
12. **Avisos, vacíos y deshacer.** Tres avisos siempre iguales (información, atención, problema) con icono; pantallas
    vacías con una frase y un botón; «Deshacer» en dar, mover o anular cita, cobrar y borrar un evento; silueta de carga
    en todas las pantallas.
13. **Valoración y Anamnesis más ligeras.** Valoración con tres pestañas con número; cada cuestionario en una tarjeta
    igual (última nota, de dónde viene, si menos o más es mejor), en dos columnas; «Pasar los de la otra vez»; Anamnesis
    con cada apartado plegado y su resumen en una línea (banderas rojas, siempre abiertas y arriba).
14. **Limpieza.** Textos de explicación de Envíos, Lista de espera y Cobros tras un «?»; «Guardar» fijo abajo en todos
    los formularios; Lista de espera con «WhatsApp», «Dar cita» y «⋯» en una fila; «Hoy» con tres números arriba.

## Estado

| Bloque | Estado |
| --- | --- |
| 0 Colores | hecho, sin publicar |
| 1 Cabecera de la ficha | hecho, sin publicar |
| 2 Calendario con color | hecho (móvil; el mes grande en ancho, con el bloque 11), sin publicar |
| 3 Agenda en el móvil | hecho, sin publicar: tira de la semana y el día en lista (`src/schedule/DayList.tsx`, `dayRows.ts`), huecos libres con «N en espera encajan», lo cerrado, línea de ahora, «Atender» en la que toca, «Ver el día en rejilla» (se recuerda). **Falta de este bloque:** juntar «Hoy» y «Día» con «Pendiente N», el chip por fisio y «Cobrar» junto a «Atender» |
| 4 Botón «＋» y buscador | hecho, sin publicar (`src/app/QuickAdd.tsx`, `screens.ts`): «＋» en el centro de la barra (y arriba del menú lateral en el ordenador), con lo del paciente de la ficha primero, cita nueva sin salir, paciente nuevo, últimos pacientes y un buscador de pacientes y de pantallas. **Distinto del boceto:** la lupa va dentro de la hoja del «＋» (no en la barra de arriba, que en el móvil no tiene sitio junto al título) |
| 5 Sesión en una pantalla | hecho, sin publicar (`src/clinical/SessionPages.tsx`, `parts.tsx`): el dolor con la escala de color y la última vez marcada con borde dorado (en el móvil sigue en dos filas: once casillas en una no llegan a 44 px), «Igual que la última» en cada texto, la siguiente cita dicha antes de guardar con aviso si cae en un viaje o en la agenda cerrada, borrador guardado en el dispositivo (se recupera si se recarga) y «Guardar» fijo abajo |
| 6 Filas que se abren | hecho, sin publicar: Sesiones (con más de tres, solo la última abierta, las demás en una línea con su primera frase; «Abrir todas», buscar dentro y un rótulo por mes), Cobros (con más de tres, cada fila se abre para Recibo, nº de factura y Borrar; total de cada mes) y Envíos (los tipos con más de cinco mensajes salen plegados; «Enviar los N» por tipo). «No enviar» sigue a la vista en cada fila |
| 7 Ajustes y ayuda | hecho, sin publicar: buscador en Ajustes (`src/app/screens.ts`), cinco grupos (Tu clínica, La consulta, Dinero, Mensajes, Seguridad y datos) más Ayuda, aviso ámbar si no hay PIN, la puesta en marcha en una línea («Siguiente: …» y «Ver los 6 pasos»), buscador en «Cómo se usa», «?» en la barra (Ajustes, Envíos, Lista de espera, Bonos y cobros: las pantallas sin otro botón arriba) y la página «Novedades» con su aviso de una vez a quien ya tenía pacientes (`src/app/news.ts`, `NewsNotice.tsx`) |
| 8 Pacientes | hecho, sin publicar: filtros de un toque con número (Todos, Hoy, Sin cita, Deben), cada fila con su motivo y sus sesiones y una etiqueta con lo más urgente (debe, de viaje, próxima cita o sin cita), iniciales con color fijo, la tira de letras A–Z (de lado, encima de la lista: en el borde no cabrían a 44 px) y fuera la tarjeta «Hoy · sin citas» |
| 9 Resumen como tablero | hecho, sin publicar (`src/pages/PatientPage.tsx`): «Lo siguiente» (lo pendiente más importante: reevaluación, consentimiento sin firmar u hoja de protección de datos; lo demás, en «Pendiente»), cuatro cifras que se tocan (dolor, sesiones, último cuestionario y bonos y cobros: el dato, sin decir si es bueno o malo), y Documentos y Legal plegados en una fila cada uno (dicen lo que hay; lo abierto se recuerda mientras la app está abierta; en el ordenador salen abiertos). «Lista de espera» sigue en su fila |
| 10 Dar cita con huecos | hecho, sin publicar (`src/schedule/slots.ts`, `AppointmentForm.tsx`): al dar una cita nueva sin hora ya elegida, tres huecos libres propuestos (primero su hora de siempre, si la tiene y está libre; cada uno de un día distinto), «Ver las horas libres de otro día» y, como siempre, «Día y hora» a mano; el botón dice «Dar la cita · mar, 17 nov, 10:00». Libre: dentro del turno de con quién es (sin turnos esa semana, de lunes a viernes de 9 a 20), sin otra cita, con la agenda abierta y sin nada en su calendario |
| 11 Ordenador | hecho en parte, sin publicar: en pantallas de 1536 px o más, una columna fija a la derecha de la ficha con «Nueva sesión», sus cifras y lo próximo de su calendario, en todas las pestañas menos el Resumen (`src/clinical/PatientAside.tsx`); el «＋» con buscador ya está arriba del menú lateral (bloque 4). El calendario del paciente ya ponía en ancho el mes a la izquierda y el día al lado |
| 12 Avisos, vacíos y deshacer | hecho, sin publicar: «Deshacer» en el aviso al dar, cambiar, mover y anular una cita, al cobrar (ficha y Hoy) y al borrar un evento (`src/ui/Toast.tsx`; arrastrar en la rejilla ya lo tenía); «Sin sesiones» y «Todavía no hay pacientes» con su botón. Los tres avisos con icono y la silueta de carga ya estaban |
| 13 Valoración y Anamnesis ligeras | hecho en parte, sin publicar: las tres pestañas de Valoración dicen cuántos hay y, en Cuestionarios, «Pasar otra vez» repite a un toque los últimos que se le pasaron (hasta tres). **Pendiente:** cada cuestionario en una tarjeta igual en dos columnas y la Anamnesis con cada apartado plegado y su resumen |
| 14 Limpieza | hecho en parte, sin publicar: las explicaciones de Envíos y Lista de espera, tras «¿Cómo funciona?» (`src/ui/HowItWorks.tsx`); «Hoy» con tres cifras arriba (citas, por atender, por cobrar). **Pendiente:** «Guardar» fijo abajo en todos los formularios (solo lo tiene la sesión: una barra fija tapa botones de debajo a 360 px), la fila de la Lista de espera con «⋯» y el texto de Cobros |
| Restos del bloque 3 | **pendiente:** juntar «Hoy» y «Día» con «Pendiente N», un chip por fisio y «Cobrar» junto a «Atender» en la lista del día |
