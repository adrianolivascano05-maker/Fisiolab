# Protección de datos

Lo que la app pone de su parte para que la clínica cumpla el RGPD, la LOPDGDD y la Ley 41/2002 con las historias
clínicas. No sustituye lo que tiene que hacer la clínica: registro de actividades de tratamiento, delegado de
protección de datos (obligatorio en un centro sanitario), contrato con Google si usa la nube y revisión de estos
textos con su delegado. Nada de esto es asesoramiento legal.

| Qué | Dónde | Archivo |
| --- | --- | --- |
| Datos de la clínica (responsable, NIF, contacto, delegado, años de conservación y si hay contrato con Google) | Ajustes → Protección de datos | `ClinicSettings.tsx`, ajuste `clinic_privacy` |
| Texto informativo para el paciente (art. 13 RGPD, art. 11 LOPDGDD), con los consentimientos opcionales y el sitio para firmar | ficha del paciente → «Protección de datos» (`/pacientes/:id/proteccion-datos`) | `PrivacyNotice.tsx`, `PatientPrivacyPage.tsx` |
| Cuándo se entregó, quién firmó (representante legal de menores de 16 años) y sí o no a fotos y vídeos, contacto por WhatsApp o correo, y docencia y estudios | la misma pantalla; la tarjeta de la ficha lo resume | `PrivacyCard.tsx`, columna `patients.privacy` (migración 009) |
| Aviso al borrar un paciente con historia que aún hay que conservar | editar paciente → «Borrar paciente» | `../pages/PatientFormPage.tsx`, `clinicalRecord` y `keepUntil` |
| Bloqueo de la app con PIN | Ajustes → Bloqueo de la app | `pin.ts`, `AppLock.tsx`, `LockSettings.tsx` |
| Cifrado de la copia de Google Drive | Ajustes → Cifrado de la copia de Drive | `../cloud/crypt.ts`, `../cloud/EncryptionParts.tsx` |

Los datos de las funciones están en `../data/privacy.ts`.

- **Texto informativo.** Se rellena con los datos de la clínica y dice dónde se guardan los datos: solo en los
  dispositivos, o también en Google Drive, cifrados o no. Se imprime (o se guarda en PDF) con las respuestas que
  ya se hayan apuntado. La hoja firmada se guarda con la historia clínica.
- **Conservación.** El plazo cuenta desde el último registro clínico del paciente (test, sesión, exploración,
  cuestionario, bienestar o anamnesis), con un mínimo de 5 años (Ley 41/2002, art. 17). Algunas comunidades
  autónomas exigen más: se cambia en Ajustes. Si no ha pasado, borrar pide marcar que se borra igualmente (un
  duplicado, un error o una historia guardada en otro sitio). Una ficha sin ningún registro clínico y los
  pacientes de ejemplo se borran sin aviso.
- **PIN.** Es de cada dispositivo, no de la cuenta. Se guarda su huella con PBKDF2-SHA-256 (150 000 vueltas y
  sal), nunca el PIN. Tras 5 fallos hay que esperar 30 s, y el doble con cada fallo más, hasta 15 min. Al abrir la
  app no se monta nada hasta poner el PIN. Al bloquear con la app abierta, la pantalla se tapa (`inert`) sin perder
  lo que se estaba escribiendo. Se bloquea al volver a la app después del tiempo elegido. Si se olvida: con la
  nube, cerrar sesión borrando los datos del dispositivo y volver a entrar; sin la nube, borrar los datos del
  dispositivo. Es una barrera para quien coja el dispositivo desbloqueado: los datos del dispositivo los protege
  el bloqueo del propio dispositivo, que además los cifra.
