-- «Vuelve de viaje sin cita» (14-11-2026, src/schedule/backFromTrip.ts): la bandeja de envíos tiene un mensaje nuevo,
-- «Al volver de un viaje», que cada clínica puede cambiar en Ajustes › Mensajes a pacientes. Una versión anterior de la
-- app, al guardar sus mensajes, borraría el texto que la clínica le hubiera puesto (solo guarda los que conoce). Esta
-- migración no cambia ninguna tabla: sube la versión de la base para que un dispositivo sin actualizar deje de recibir
-- cambios (src/data/engine.ts, applyDelta) hasta que se actualice.
select 1;
