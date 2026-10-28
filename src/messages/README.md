# Mensajes a pacientes

Los ocho mensajes que la app prepara para WhatsApp y correo: recordatorio de cita, hueco libre, lista de espera, anamnesis antes de la
primera cita, cuestionarios antes de reevaluar, formulario por enlace, petición de informes y pruebas y hoja de ejercicios. Nada se envía solo: el
mensaje se abre en el WhatsApp o el correo del dispositivo y lo manda la persona.

- `templates.ts`: cada mensaje con su texto y su asunto de siempre y las fichas que admite ({nombre}, {dia}, {hora},
  {clinica}, {con}, {enlace}, {enlaces}, {cuestionarios}, {formulario}, {caduca}); `fillTemplate` las sustituye;
  `messageText` y `messageSubject` dan el de la clínica o el de OmniClin, con la firma común al final. El ajuste
  `message_templates` va en la base de la clínica; el antiguo `reminder_template` (solo el recordatorio) se sigue
  leyendo y escribiendo para no perder nada.
- `MessagesPage.tsx`: Ajustes › Mensajes a pacientes. Lista de mensajes, fichas que se insertan donde está el cursor,
  texto, asunto, vista previa con un paciente de ejemplo, firma común y «Volver al texto de OmniClin».
- Quién los usa: `src/schedule/reminders.ts` (recordatorio y hueco), `src/schedule/outbox.ts` (anamnesis y
  seguimiento), `src/clinical/patientForms.ts` (formulario) y `src/data/exercises.ts` (la primera línea de la hoja).
