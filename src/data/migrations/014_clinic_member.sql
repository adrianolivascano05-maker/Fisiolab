-- Clínicas con equipo (src/cloud/clinic.ts): todos comparten la base, pero cada cita es de quien la dio (el «sub» de
-- su cuenta de Google) y va solo a su Google Calendar. Sin clínica, o en las citas de antes, queda vacío.
alter table appointments add column created_by text;
