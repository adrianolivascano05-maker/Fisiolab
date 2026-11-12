# Calendario de cada paciente

Pedido el 12-11-2026: «añade un calendario dentro de cada paciente, para poder añadir dentro de cada paciente cuando
tienen eventos como operaciones, o entrenamientos de ellos mismos, poder ver solo sus citas directamente».

## Qué hace

Es la quinta pestaña de la ficha: **Resumen · Anamnesis · Valoración · Sesiones · Calendario**
(`/pacientes/:id/calendario`, `src/clinical/CalendarPage.tsx`).

- **El mes**, con un punto por clase de cosa en cada día: verde, sus citas (y las sesiones apuntadas sin cita);
  azul, sus eventos; ocre, la reevaluación prevista. Hoy va marcado. «‹ ›» cambian de mes y «Hoy» vuelve al día de
  hoy.
- **Debajo, la lista del mes.** Lo que se repite cada semana sale una vez, arriba («Cada semana»), y un viaje de
  varios días sale una vez, con sus días. Al tocar un día se ve solo lo de ese día, con **Dar cita** (si no ha
  pasado) y **Apuntar evento** para ese día.
- **Todo · Citas · Eventos.** «Citas» enseña solo lo de la clínica: sus citas (pendientes, atendidas, «No vino» y
  anuladas, tachadas), las sesiones sin cita y la reevaluación. «Eventos», solo lo suyo.
- **Apuntar evento:** qué es (operación, consulta médica, prueba médica, entrenamiento, competición, viaje o
  vacaciones, otro), un nombre si se quiere, cuándo (un día, varios días seguidos o cada semana unos días, hasta una
  fecha o sin fin), una hora si la tiene (si no, es de todo el día) con su duración, y una nota. Se cambia y se borra
  tocándolo; borrar uno que se repite borra la serie entera, y se pregunta antes.
- Tocar una cita abre su hoja de siempre (cambiarla, anularla, cobrar, recordar…); tocar una sesión, la sesión.
- El mes, el día y el filtro van en la dirección (`?mes=2026-11&dia=2026-11-12&ver=citas`): al volver de una sesión
  se sigue donde se estaba.
- En el ordenador a pantalla completa, el mes a la izquierda y la lista a la derecha; con la lista de pacientes al
  lado, una debajo de otra, como en el móvil.

## Con el resto de la app

- **Al dar o mover una cita** (desde la ficha, el calendario o la agenda) se avisa si ese día el paciente tiene algo:
  lo de todo el día (una operación, un viaje, una prueba…) o lo que se pisa con la hora de la cita. Los
  entrenamientos sin hora no avisan (serían casi todos los días). El aviso no impide nada: «Darla igualmente».
- **En el Resumen** (tarjeta «Situación»): su última operación si fue hace menos de un año («hace 6 semanas y 2
  días»), un viaje en curso («hasta el …») y lo próximo de los dos meses siguientes (operación, consulta o prueba
  médica, competición o viaje; como mucho dos), cada uno con un enlace a ese día del calendario. Son fechas, sin
  ninguna interpretación clínica.
- **Exportación:** pestaña «Calendario del paciente» en el Excel, sección «Su calendario» en la historia de cada
  paciente y la tabla tal cual en el JSON.
- **Datos de ejemplo:** Lucía (una operación y una revisión), Marcos (entrenamientos martes y jueves y un partido) e
  Irene (unas vacaciones).

## Lo que no hace (a propósito)

- No ocupa la agenda de la clínica, no se le recuerda por WhatsApp y no cuenta para los cobros ni las estadísticas:
  es lo suyo, para tenerlo a la vista.
- No calcula plazos ni fases de recuperación: solo cuenta los días que han pasado o que faltan.

## Por dentro

- Migración 039, tabla `patient_events` (una fila por evento; sincronizada como las demás: disparadores de cambios y
  de campos, en `SYNC_TABLES`). Los días van como `AAAA-MM-DD` de Madrid y la hora como `HH:MM`: un cambio de hora no
  los mueve. Lo que se repite no se guarda semana a semana: se calcula para los días que se ven (`occurrencesIn`).
- El tipo no lleva CHECK: si una versión nueva añade uno, un móvil sin actualizar lo recibe y lo enseña como «Otro».
- Se borra con el paciente (en cascada).
- Código: `src/data/patientEvents.ts` (guardar, comprobar, repeticiones, aviso al dar cita, textos),
  `src/clinical/patientCalendar.ts` (qué sale cada día y en la lista del mes), `CalendarPage.tsx`, `EventSheet.tsx`.
- Pruebas: `src/data/patientEvents.test.ts`, `src/clinical/patientCalendar.test.ts`, `e2e/calendario.spec.ts`
  (CA1 y CA2, a 360 px) y la exportación en `src/export/fullExport.test.ts`.

## Ideas para más adelante (sin hacer)

- Que el paciente apunte sus eventos desde el enlace de sus formularios.
- «Terminar la serie aquí» con un toque (ahora se cambia «Hasta»).
- Una marca discreta en la agenda de la clínica los días en que el paciente tiene una operación o un viaje.
