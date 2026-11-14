# Calendario de cada paciente

Pedido el 12-11-2026: «añade un calendario dentro de cada paciente, para poder añadir dentro de cada paciente cuando
tienen eventos como operaciones, o entrenamientos de ellos mismos, poder ver solo sus citas directamente».

## Qué hace

Es la quinta pestaña de la ficha: **Resumen · Anamnesis · Valoración · Sesiones · Calendario**
(`/pacientes/:id/calendario`, `src/clinical/CalendarPage.tsx`).

- **El mes**, con un punto por clase de cosa en cada día: verde, sus citas (y las sesiones apuntadas sin cita);
  azul relleno, lo importante (operación, consulta o prueba médica, competición, otro); azul hueco, lo que se repite
  cada semana (sus entrenamientos), para que no tape lo importante; ocre, la reevaluación prevista. Lo de varios días
  (un viaje) va como una franja que pasa de un día al siguiente. La leyenda solo dice lo que hay ese mes. Hoy va
  marcado. «‹ ›» (o deslizar el dedo sobre el mes) cambian de mes y «Hoy» vuelve al día de hoy.
- **Debajo, la lista del mes.** Lo que se repite cada semana sale una vez, arriba («Cada semana»), y un viaje de
  varios días sale una vez, con sus días. Al tocar un día se ve solo lo de ese día, con **Dar cita a las …** (si no
  ha pasado; propone la hora de su última cita o, si no tiene, las 10:00). **Apuntar evento**, arriba, apunta en el
  día elegido.
- **Todo · Citas · Eventos.** «Citas» enseña solo lo de la clínica: sus citas (pendientes, atendidas, «No vino» y
  anuladas, tachadas), las sesiones sin cita y la reevaluación. «Eventos», solo lo suyo.
- **Apuntar evento:** qué es (operación, consulta médica, prueba médica, entrenamiento, competición, viaje o
  vacaciones, otro), un nombre si se quiere, cuándo (un día, varios días seguidos o cada semana unos días, hasta una
  fecha o sin fin), una hora si la tiene (si no, es de todo el día) con su duración, y una nota. Cada tipo propone lo
  normal mientras no se toque «Cuándo»: un entrenamiento, cada semana (el día de la semana del día puesto); un viaje,
  varios días; lo demás, un día. Se cambia y se borra tocándolo; borrar uno que se repite borra la serie entera, y se
  pregunta antes.
- **Lo de cada semana, día a día:** al tocarlo en un día, **Este día no** (ese día no sale, por ejemplo, un jueves que
  no entrena) y **Desde este día ya no** (la serie acaba el día antes). Los días quitados salen en su hoja, cada uno
  con **volver a poner**.
- Tocar una cita abre su hoja de siempre (cambiarla, anularla, cobrar, recordar…); tocar una sesión, la sesión.
- El mes, el día y el filtro van en la dirección (`?mes=2026-11&dia=2026-11-12&ver=citas`): al volver de una sesión
  se sigue donde se estaba.
- En el ordenador a pantalla completa, el mes a la izquierda y la lista a la derecha; con la lista de pacientes al
  lado, una debajo de otra, como en el móvil.

## Con el resto de la app

- **Al dar o mover una cita** (desde la ficha, el calendario o la agenda) se avisa si ese día el paciente tiene algo:
  lo de todo el día (una operación, un viaje, una prueba…) o lo que se pisa con la hora de la cita. Lo de varios días
  seguidos (un viaje) ocupa los días enteros aunque lleve una hora (la de salida). Los
  entrenamientos sin hora no avisan (serían casi todos los días). El aviso no impide nada: «Darla igualmente».
- **Desde la sesión y la anamnesis:** al escribir la sesión, arriba, lo de su calendario contado desde el día de la
  sesión («Ligamento cruzado: hace 4 semanas y 2 días · Partido: en 3 días») y **Apuntar en su calendario**; en la
  anamnesis, junto a «Cirugías previas», **Apuntar una operación en su calendario** (la hoja viene con «Operación»).
  Se apunta sin salir de lo que se está escribiendo.
- **En cada sesión de la lista,** si hubo una operación en el año anterior: «4 semanas y 2 días tras la operación».
  Solo cuenta días.
- **En Agenda › Hoy,** bajo el nombre de cada paciente, la misma línea corta: se ve antes de que entre (una consulta
  para todos los del día).
- **Series de citas que tienen en cuenta su vida y la agenda:** al dar «Cada semana, N citas», las semanas en que está
  de viaje o la agenda está cerrada a esa hora (un festivo, unas vacaciones de toda la clínica o de con quién es la
  cita: Agenda › «Bloquear horas o días») se saltan solas (la serie sigue después hasta tener las N, como mucho medio
  año más) y la hoja lo dice antes de darlas («La semana del 24 nov (Vacaciones) · La semana del 8 dic (agenda
  cerrada: Festivo). La última cita, el …»). Bajo «Día y hora», sus entrenamientos de cada semana y los días en que no
  entrena, para elegir uno libre. Una cita sola (o al cambiarla) en un día de viaje o en un rato con la agenda cerrada
  no se mueve: se avisa («Ese rato la agenda está cerrada: Festivo, el …») y se puede dar igualmente. Lo mismo al
  moverla a un toque (una hora, un día, una semana) y al darle otra después de «No vino».
- **Fuera del turno de su fisio (en una clínica con turnos):** al dar una cita o una serie con alguien que tiene
  turnos puestos esa semana, si alguna cae fuera de ellos se avisa antes de darlas («Ese rato Bruno no tiene turno» o
  «En 2 de esas citas Bruno no tiene turno», con los días) y se pueden dar igualmente o cambiar la hora o con quién es.
  Una semana sin ningún turno suyo no avisa (no se sabe su horario). Código: `outsideShifts` en
  `src/data/seriesPlan.ts`.
- **Al arrastrar una cita en la Agenda:** si a donde se lleva ese día tiene algo en su calendario (lo mismo que avisa al
  dar cita) o la agenda está cerrada a esa hora, la cita se mueve igual y el aviso de «Movida · … · Deshacer» lo dice
  en una segunda línea («Ese día tiene en su calendario: Resonancia de rodilla · La agenda está cerrada (Formación)»);
  ese aviso dura 20 segundos en vez de 10 para leerlo y deshacer.
- **Citas que caen en algo apuntado después:** al guardar un evento (un viaje, una operación, un partido a la hora de
  la cita…) que pisa citas pendientes que ya tenía, la hoja no se cierra: «Ya tiene 2 citas esos días», cada una a un
  toque para abrir su hoja (cambiarla o anularla), o «Dejarlas así». En su calendario, la fila de esa cita dice «Cae
  en: …» mientras siga así, y si es un viaje o una operación (no podrá venir), arriba: «Una cita cae durante su
  viaje», con la cita a un toque. Se usa la misma regla que el aviso al dar cita.
- **Sus próximas citas, para mandárselas:** en su calendario, «N citas pendientes · la próxima, …» y **Sus próximas
  citas por WhatsApp** (o por correo): el mensaje «Sus próximas citas» de Ajustes › Mensajes a pacientes con la lista
  de las siguientes (día y hora, y con quién en una clínica; como mucho diez). Solo con el permiso de contacto firmado;
  sin él, se dice por qué y se le dicen en la consulta.
- **Que lo apunte el paciente:** «Que lo apunte desde su móvil» (en su calendario, o en Formularios › «Su calendario») crea
  un enlace como los de la anamnesis: cifrado de extremo a extremo, sin cuenta, 14 días. Arriba, «Ya apuntado en la
  clínica»: sus próximas citas (como mucho diez) y lo que ya tiene en su calendario de hoy en adelante (como mucho 30,
  sin las notas, que escribe la clínica), tal como estaba al crear el enlace, solo para verlo; si intenta añadir lo
  mismo, se le dice («Eso ya está apuntado en la clínica»). Debajo, los mismos
  campos que en la clínica (con lo normal de cada tipo), la lista de lo que lleva apuntado (y «Quitar») y lo manda
  todo con «Enviar»; se guarda en su móvil hasta que lo envía. Como mucho 30 cosas de una vez. Al recogerlo, cada cosa
  se comprueba con las mismas reglas que en la clínica (lo que no vale se deja fuera), llega a su calendario con la
  nota «Lo apuntó el paciente.» y con un id fijo por envío (una recogida repetida no la duplica). Lo que ya estaba
  apuntado igual (el mismo tipo, nombre sin mirar mayúsculas, días, hora y repetición; la nota no cuenta), en la
  clínica, en otro envío o dos veces en este, no se repite. El aviso al recogerlo lo dice («Nora ha apuntado 1 cosa en
  su calendario (1 ya estaba). Una de sus citas cae ahí: míralo en su calendario»). En Formularios: «Apuntó N cosas
  (M ya estaban): ver su calendario».
- **En la Agenda (Día y Semana):** la cita de alguien que ese día está de viaje, se operó hace poco o tiene algo cerca
  (lo mismo que su línea en Hoy) lleva un calendario pequeño junto al nombre; el texto sale al abrir la cita (en su
  hoja, bajo el día y la hora), al pasar el ratón y lo lee el lector de pantalla («Su calendario: …»). Si la cita no es
  hoy, «mañana» o «hace 3 semanas» se cuentan desde el día de la cita, y lo dice: «El día de la cita: Partido: mañana».
- **Vuelve de viaje sin cita** (`src/schedule/backFromTrip.ts`): quien estaba en tratamiento (vino, con cita o sesión,
  en los 60 días antes de irse, y no tiene todos sus motivos de consulta dados de alta) y vuelve de un viaje apuntado
  en su calendario sin haber venido desde que se fue (una cita atendida o una sesión) ni tener una cita pendiente desde
  el día que vuelve. Las citas que se quedaron dentro del viaje («No vino» o pendientes sin tocar) no cuentan. Sale en
  Agenda › Hoy › Pendiente desde dos días antes de volver hasta una semana después (su nombre y, debajo, «Sin cita al
  volver de viaje · Vuelve hoy» o «· Volvió el lunes, 16 de noviembre»), con el enlace a su calendario ese día para darle cita; y, desde el día que
  vuelve, en la bandeja de envíos con el mensaje «Al volver de un viaje» (editable en Ajustes › Mensajes a
  pacientes; solo con el permiso de contacto firmado; se puede apagar en la bandeja, «Qué se prepara»). En cuanto
  tiene una cita, deja de salir.
- **En Pacientes, el filtro «En su calendario»:** «De viaje ahora», «Vuelven de viaje en los próximos 7 días» (el día
  que vuelve es el siguiente al último del viaje: hoy o en los 6 días siguientes; los que ya volvieron hoy, también),
  «Operados en el último año» (hasta hoy), «Se operan en los próximos 30 días» (desde mañana) y «Compiten en los
  próximos 7 días» (cuenta lo de cada semana y los días quitados).
- **En el Resumen** (tarjeta «Situación»): su última operación si fue hace menos de un año («hace 6 semanas y 2
  días»), un viaje en curso («hasta el …») y lo próximo de los dos meses siguientes (operación, consulta o prueba
  médica, competición o viaje; como mucho dos), cada uno con un enlace a ese día del calendario. Son fechas, sin
  ninguna interpretación clínica.
- **Exportación:** pestaña «Calendario del paciente» en el Excel, sección «Su calendario» en la historia de cada
  paciente y la tabla tal cual en el JSON.
- **Datos de ejemplo:** Lucía (una operación y una revisión), Marcos (entrenamientos martes y jueves y un partido) e
  Irene (unas vacaciones). La clínica de prueba (Ajustes › Clínica de prueba, `src/demo/README.md`) también trae
  calendario: la operación del cruzado, entrenos y partidos de los deportistas, alguna operación en el próximo mes,
  viajes y alguna prueba o consulta médica.

## Lo que no hace (a propósito)

- No ocupa la agenda de la clínica, no se le recuerda por WhatsApp y no cuenta para los cobros ni las estadísticas:
  es lo suyo, para tenerlo a la vista.
- No calcula plazos ni fases de recuperación: solo cuenta los días que han pasado o que faltan.
- Un dispositivo con una versión anterior de la app no sabe recoger «Su calendario» (perdería lo que mandó el
  paciente). Para que no pase, la migración 041 sube la versión de la base: un dispositivo sin actualizar deja de
  recibir cambios hasta que se actualiza, así que no conoce el envío ni lo recoge. La app se actualiza sola al abrirla.

## Por dentro

- Migración 042: tampoco cambia ninguna tabla; sube la versión de la base porque hay un mensaje nuevo («Al volver de
  un viaje»): una versión anterior, al guardar sus mensajes, borraría el texto que la clínica le hubiera puesto.
- Migración 041: no cambia ninguna tabla; sube la versión de la base (ver arriba, «Su calendario» y versiones
  anteriores).
- Migración 040: `skip_days` (los días quitados de una serie, «AAAA-MM-DD,…»), sincronizado campo a campo.
- Migración 039, tabla `patient_events` (una fila por evento; sincronizada como las demás: disparadores de cambios y
  de campos, en `SYNC_TABLES`). Los días van como `AAAA-MM-DD` de Madrid y la hora como `HH:MM`: un cambio de hora no
  los mueve. Lo que se repite no se guarda semana a semana: se calcula para los días que se ven (`occurrencesIn`).
- El tipo no lleva CHECK: si una versión nueva añade uno, un móvil sin actualizar lo recibe y lo enseña como «Otro».
- Se borra con el paciente (en cascada).
- Código: `src/data/patientEvents.ts` (guardar, comprobar, repeticiones, aviso al dar cita, las citas que caen en algo
  `visitsInEvents`, el mismo evento `eventKey`, textos), `src/data/seriesPlan.ts` (la serie que se salta sus viajes y
  la agenda cerrada, sus días de entrenamiento), `src/data/closures.ts` (`closureSpan`: cuándo está cerrada, en
  palabras), `src/schedule/upcoming.ts`
  (la lista de sus próximas citas), `src/clinical/EventFields.tsx` (los campos, para la clínica y para el paciente),
  `src/patientForm/calendarForm.ts` y `CalendarFill.tsx` («Tu calendario» por enlace; la recogida, en `collect.ts`),
  `src/clinical/patientCalendar.ts` (qué sale cada día y en la lista del mes), `CalendarPage.tsx`, `EventSheet.tsx`.
- Pruebas: `src/data/patientEvents.test.ts`, `src/clinical/patientCalendar.test.ts`, `e2e/calendario.spec.ts`
  (CA1 a CA7, a 360 px), `src/data/closures.test.ts`, `src/schedule/backFromTrip.test.ts`, `src/schedule/outbox.test.ts`,
  `src/data/patientSearch.test.ts`, CL23 en `e2e/clinics.spec.ts` (el enlace, en un móvil de 360 px), `src/data/seriesPlan.test.ts`,
  `src/schedule/upcoming.test.ts`, `src/patientForm/calendarForm.test.ts`, `src/patientForm/createForm.test.ts` (lo que lleva el
  enlace), `collect.test.ts` y la exportación en
  `src/export/fullExport.test.ts`.

## Ideas para más adelante (sin hacer)

- Nada pendiente de lo propuesto el 14-11-2026 (ver `docs/ideas-pendientes.md`).
