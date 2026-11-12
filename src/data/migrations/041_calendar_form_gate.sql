-- «Su calendario» por enlace (12-11-2026, src/patientForm/calendarForm.ts): el paciente apunta lo suyo y llega a su
-- calendario al recogerlo. Una versión anterior de la app no sabe recogerlo y, si lo recogiera, perdería lo que mandó
-- el paciente. Esta migración no cambia ninguna tabla: sube la versión de la base para que un dispositivo sin
-- actualizar deje de recibir cambios (src/data/engine.ts, applyDelta) y así no conozca el envío ni lo recoja.
select 1;
