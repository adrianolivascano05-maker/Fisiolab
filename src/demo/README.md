# Clínica de prueba

Ajustes › Copias y exportar › **Clínica de prueba**: carga cientos de pacientes inventados para probar la app con
volumen y ver cómo responde, y los borra de una vez.

| Archivo | Qué hace |
| --- | --- |
| `cases.ts` | Los doce motivos de consulta inventados (lumbalgia, cervicalgia, hombro, esguince, tendinopatía rotuliana, cruzado anterior, epicondilalgia, túnel carpiano, fascitis plantar, dolor lateral de cadera, dorsal y ATM), con textos para elegir al azar, sus códigos de la CIF, tests de la galería, cuestionarios y mediciones; nombres, hábitos y los cinco fisios inventados |
| `generate.ts` | Crea la clínica de prueba con las funciones de la app (`src/data`), en lotes grandes, y la borra |
| `state.ts` | Si está cargada y qué se creó (ajuste `demo_data`), sin cargar el generador |
| `DemoSection.tsx` | La sección de Ajustes |

## Qué crea

- **Modo normal:** 100 pacientes, unas 700 citas de dos meses atrás a final del mes que viene, la agenda a medio
  llenar. **Modo estrés:** 500 pacientes, seis meses de historia y el mes que viene casi lleno, con pacientes en la
  lista de espera.
- Cinco fisios inventados (correos de `example.com`, que no son de nadie) y quien lo carga (en una clínica), con
  turnos de 6 horas de mañana o de tarde (8 citas de 45 minutos) y dos días de vacaciones de una de ellas. Sin dos
  citas a la vez con el mismo fisio y todas dentro de su turno. El mes que viene, el mismo número de citas para
  cada uno (se reparten primero los pacientes con más citas ese mes).
- Cada paciente: nombre inventado, fecha de nacimiento, peso, talla y un teléfono +44 7700 900xxx (números que el
  regulador británico reserva para el cine y la televisión: no son de nadie, y WhatsApp los entiende). Sin correo,
  DNI ni dirección.
- Los que ya han venido: anamnesis entera (con la CIF y, en el cruzado, la precaución por material metálico),
  exploración con los tests de su zona (el que encaja, positivo), cuestionarios rellenos con la fórmula de la app al
  empezar y en la reevaluación (quinta visita), mapa del dolor, PSFS, cambio global percibido, movilidad, saltos en
  los deportistas, una sesión por cita atendida con el dolor bajando, bono o sesiones sueltas cobradas (algunas sin
  cobrar), consentimientos firmados en papel. El 12 %, con un motivo de consulta anterior ya cerrado. El 3 %, con una
  bandera roja (pérdida de peso) para ver el aviso; el resto de textos evita las palabras que la app toma por
  banderas rojas.
- Citas pasadas atendidas, alguna sin venir o anulada; las de los próximos dos días, algunas recordadas y
  confirmadas.
- La lista de espera, variada para ordenarla y filtrarla: días distintos esperando, algunos preferentes, con horas
  concretas o que aún no pueden venir.

## Cuidados

- Solo en una clínica **sin pacientes** (para no mezclarlos nunca con pacientes de verdad) y, en una clínica del
  servidor, solo quien la administra. Para probar: Ajustes › Equipo de la clínica › Cambiar de clínica › Dar de alta
  otra clínica distinta (con equipo).
- Si es una clínica «por mi cuenta», pasa a «con equipo» para ver a los fisios; al borrar, vuelve como estaba.
- Las citas inventadas de quien lo carga **no van a su Google Calendar de verdad**: en la clínica de prueba se le
  desactiva «Apuntar solas las citas» (aunque ya hubiera dado el permiso). Al borrar, vuelve como estaba.
- Se escribe en lotes de 3000 cambios (`batched`): las funciones de la app que se usan escriben sin leer antes; las
  que leen (cerrar el motivo anterior, saltos) van después de escribir el lote.
- **Borrar** quita los pacientes creados (y en cascada todo lo suyo), los fisios inventados con sus turnos, las
  vacaciones, y deja como estaban los ajustes que tocó (precio de la sesión, bonos, datos de la clínica, modo y
  Google Calendar).
  Lo que se haya añadido a mano se queda. Si la carga falla a medias, se borra lo que ya estaba escrito.

Pruebas: `generate.test.ts` (reparto, solapes, turnos, notas de los cuestionarios, CIF, banderas rojas, borrado
completo) y `e2e/prueba.spec.ts` (cargar y borrar, 360 px y 44 px, tiempos con 500 pacientes, en el servidor).
