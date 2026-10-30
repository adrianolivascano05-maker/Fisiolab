# Protección de datos

Lo que la app pone de su parte para que la clínica cumpla el RGPD, la LOPDGDD y la Ley 41/2002 con las historias
clínicas. No sustituye lo que tiene que hacer la clínica: registro de actividades de tratamiento, delegado de
protección de datos (obligatorio en un centro sanitario), contrato con el proveedor de la nube (Google Workspace, o
el de Cloudflare si usa su servidor) y revisión de estos textos con su delegado. Nada de esto es asesoramiento legal.

| Qué | Dónde | Archivo |
| --- | --- | --- |
| Datos de la clínica (responsable, NIF, contacto, delegado, años de conservación y si hay contrato con Google) | Ajustes → Clínica y protección de datos | `ClinicSettings.tsx`, ajuste `clinic_privacy` |
| Texto informativo para el paciente (art. 13 RGPD, art. 11 LOPDGDD), con los consentimientos opcionales y el sitio para firmar | ficha del paciente → «Protección de datos» (`/pacientes/:id/proteccion-datos`) | `privacyText.ts` (el texto), `PrivacyNotice.tsx`, `PatientPrivacyPage.tsx` |
| La hoja firmada en la pantalla, tal como se firmó (texto, respuestas y firma) | la misma pantalla → «Firmar en la pantalla»; abajo, «Hojas firmadas en la pantalla» | `signPrivacySheet` en `../data/privacy.ts` (`privacy.sheets`) |
| Cuándo se entregó, quién firmó (representante legal de menores de 16 años) y sí o no a fotos y vídeos, contacto por WhatsApp o correo, y docencia y estudios | la misma pantalla; la fila «Protección de datos» del resumen de la ficha lo resume (en naranja si falta) | `../pages/PatientPage.tsx`, columna `patients.privacy` (migración 009) |
| Aviso al borrar un paciente con historia que aún hay que conservar | editar paciente → «Borrar paciente» | `../pages/PatientFormPage.tsx`, `clinicalRecord` y `keepUntil` |
| Bloqueo de la app con PIN | Ajustes → Bloqueo con PIN | `pin.ts`, `AppLock.tsx`, `LockSettings.tsx` |
| Cifrado de la copia de la nube | Ajustes → Cuenta de Google → Cifrado de la copia | `../cloud/crypt.ts`, `../cloud/EncryptionParts.tsx` |
| Servidor de la clínica en Cloudflare: datos en la UE, solo cifrados, contrato de encargado en sus condiciones | `public/cloud.json` (`cloudflareUrl`); casilla del contrato en Ajustes → Clínica | `../../cloudflare/README.md`, `../cloud/remote.ts` |
| Consentimientos informados (Ley 41/2002): generados con la anamnesis, firma en pantalla o papel, retirada | ficha → Consentimientos | `../consent/README.md` |

Los datos de las funciones están en `../data/privacy.ts`.

- **Texto informativo.** Se rellena con los datos de la clínica y dice dónde se guardan los datos: solo en los
  dispositivos, o también (cifrados) en Google Drive o en el servidor de la clínica. Lo que falta de la clínica sale
  entre corchetes. Se imprime (o se guarda en PDF) con las respuestas que ya se hayan apuntado, o se firma en la
  pantalla, como los consentimientos: el paciente (o su representante) dibuja la firma y se guarda la hoja entera
  (texto con su versión, `PRIVACY_TEXT_VERSION`, respuestas a fotos y vídeos, WhatsApp o correo y docencia, y la
  firma) en `privacy.sheets`, que se puede ver e imprimir después tal como se firmó y sale en la exportación. Si
  luego cambian las respuestas, la pantalla avisa de que la hoja firmada ya no coincide y se puede firmar otra (las
  anteriores se conservan). Al cambiar el texto, sube `PRIVACY_TEXT_VERSION`. Es un modelo: la clínica debe
  revisarlo con su delegado; la app no garantiza su validez legal.
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
  mucho 1 hora); recargar dentro de ese tiempo no lo pide. Tras 5 fallos hay que esperar 30 s (el doble con cada
  fallo, hasta 15 min). Para poner un PIN nuevo donde ya hubo uno (tras 5 fallos, con «He olvidado el PIN» o si
  alguien borró el PIN del navegador) hay que demostrar que se puede abrir la clínica (`pinProof.ts`, desde el
  30-10-2026): la contraseña de la clínica (sin conexión) o el código de recuperación del kit (con conexión), que se
  comparan con la clave guardada en el dispositivo sin exportarla (`crypt.ts`, `sameKey`). Volver a entrar con Google
  no vale: el navegador ya tiene la sesión abierta. Quien no tenga ni la contraseña ni el código puede borrar los
  datos del dispositivo (la copia de la clínica no se toca y vuelve a bajar con la contraseña). El contador de fallos
  y la marca de que aquí se puso un PIN van también en IndexedDB (`fisiolab-claves`, almacén `pin`): borrar solo
  localStorage no los reinicia; la marca solo se quita al quitar el PIN a propósito en Ajustes. Sin cuenta, si se
  olvida solo queda borrar los datos. Opcional: Face ID o huella (`passkey.ts`, WebAuthn del propio dispositivo). Es
  una barrera para quien coja el dispositivo desbloqueado: los datos del dispositivo los protege el bloqueo del
  propio dispositivo, que además los cifra.
- **iPhone.** Sin instalar la app, Safari puede borrar los datos de una web que no se abre en unos días: la pantalla
  principal lo avisa con el enlace a «Instalar la app». La app pide además almacenamiento persistente.

## Firmar la hoja por enlace (29-10-2026; retirado el 30-10-2026)

Durante un día se pudo mandar la hoja al móvil del paciente para que la firmara allí. **Retirado el 30-10-2026: se
firma en la clínica**, en la pantalla o en papel (la revisión técnica encontró que quien tuviera el enlace podía
devolver un documento distinto y que no se sabía quién firmaba). Lo firmado antes se conserva tal cual
(`method: "link"`, en la ficha «Firmada en su móvil») y sale en la exportación como «firmada en su móvil, por
enlace». Un enlace de firma que quedara pendiente se anula solo al abrir la app (`cancelSignLinks` en
`src/patientForm/collect.ts`); si el paciente ya lo había firmado, no se guarda y la app avisa de que lo firme en la
clínica. El paciente que abra uno de esos enlaces lee «Este documento se firma en la clínica».
