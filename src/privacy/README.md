# Protección de datos

Lo que la app pone de su parte para que la clínica cumpla el RGPD, la LOPDGDD y la Ley 41/2002 con las historias
clínicas. No sustituye lo que tiene que hacer la clínica: registro de actividades de tratamiento, delegado de
protección de datos (obligatorio en un centro sanitario), contrato con el proveedor de la nube (Google Workspace, o
el de Cloudflare si usa su servidor) y revisión de estos textos con su delegado. Nada de esto es asesoramiento legal.

| Qué | Dónde | Archivo |
| --- | --- | --- |
| Datos de la clínica (responsable, NIF, contacto, delegado, años de conservación y si hay contrato con Google) | Ajustes → Clínica y protección de datos | `ClinicSettings.tsx`, ajuste `clinic_privacy` |
| Texto informativo para el paciente (art. 13 RGPD, art. 11 LOPDGDD), con los consentimientos opcionales y el sitio para firmar | ficha del paciente → «Protección de datos» (`/pacientes/:id/proteccion-datos`) | `PrivacyNotice.tsx`, `PatientPrivacyPage.tsx` |
| Cuándo se entregó, quién firmó (representante legal de menores de 16 años) y sí o no a fotos y vídeos, contacto por WhatsApp o correo, y docencia y estudios | la misma pantalla; la fila «Protección de datos» del resumen de la ficha lo resume (en naranja si falta) | `../pages/PatientPage.tsx`, columna `patients.privacy` (migración 009) |
| Aviso al borrar un paciente con historia que aún hay que conservar | editar paciente → «Borrar paciente» | `../pages/PatientFormPage.tsx`, `clinicalRecord` y `keepUntil` |
| Bloqueo de la app con PIN | Ajustes → Bloqueo con PIN | `pin.ts`, `AppLock.tsx`, `LockSettings.tsx` |
| Cifrado de la copia de la nube | Ajustes → Cuenta de Google → Cifrado de la copia | `../cloud/crypt.ts`, `../cloud/EncryptionParts.tsx` |
| Servidor de la clínica en Cloudflare: datos en la UE, solo cifrados, contrato de encargado en sus condiciones | `public/cloud.json` (`cloudflareUrl`); casilla del contrato en Ajustes → Clínica | `../../cloudflare/README.md`, `../cloud/remote.ts` |
| Consentimientos informados (Ley 41/2002): generados con la anamnesis, firma en pantalla o papel, retirada | ficha → Consentimientos | `../consent/README.md` |

Los datos de las funciones están en `../data/privacy.ts`.

- **Texto informativo.** Se rellena con los datos de la clínica y dice dónde se guardan los datos: solo en los
  dispositivos, o también (cifrados) en Google Drive o en el servidor de la clínica. Se imprime (o se guarda en PDF) con las respuestas que
  ya se hayan apuntado. La hoja firmada se guarda con la historia clínica.
- **Conservación.** El plazo cuenta desde el último registro clínico del paciente (test, sesión, exploración,
  cuestionario, bienestar o anamnesis), con un mínimo de 5 años (Ley 41/2002, art. 17). Algunas comunidades
  autónomas exigen más: se cambia en Ajustes. Si no ha pasado, borrar pide marcar que se borra igualmente (un
  duplicado, un error o una historia guardada en otro sitio). Una ficha sin ningún registro clínico y los
  pacientes de ejemplo se borran sin aviso.
- **PIN.** Como el del móvil: teclado numérico que sale al instante mientras la app (base y sincronización) carga
  por detrás, invisible e `inert`. Con cuenta de Google, cada persona tiene el suyo en el dispositivo (en una tablet
  compartida, «Cambiar de cuenta de Google» desde la pantalla del PIN); en una clínica es obligatorio y se elige al
  entrar por primera vez. Se guarda su huella con PBKDF2-SHA-256 (150 000 vueltas y sal), nunca el PIN. Se pide al
  abrir la app, al volver a ella y tras el tiempo elegido sin usarla (por defecto 15 minutos; en una clínica, como
  mucho 1 hora); recargar dentro de ese tiempo no lo pide. Con cuenta, tras 5 fallos o si se olvida, se vuelve a
  entrar con Google y se elige otro (los datos se quedan); sin cuenta, tras 5 fallos hay que esperar 30 s (el doble
  con cada fallo, hasta 15 min) y si se olvida solo queda borrar los datos. Opcional: Face ID o huella
  (`passkey.ts`, WebAuthn del propio dispositivo). Es una barrera para quien coja el dispositivo desbloqueado: los
  datos del dispositivo los protege el bloqueo del propio dispositivo, que además los cifra.
- **iPhone.** Sin instalar la app, Safari puede borrar los datos de una web que no se abre en unos días: la pantalla
  principal lo avisa con el enlace a «Instalar la app». La app pide además almacenamiento persistente.
