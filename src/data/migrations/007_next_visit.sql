-- Siguiente cita, al cerrar una sesión: fecha y hora y cuánto dura. La app la pasa al calendario del
-- fisioterapeuta con un enlace de Google Calendar o un archivo .ics, sin conectar ninguna cuenta.
alter table sessions add column next_at text;
alter table sessions add column next_minutes integer check (next_minutes is null or next_minutes between 5 and 480);
