# Cambiar el nombre «Cénit · Fisiolab» (inventario del 28-10-2026)

El nombre «Cénit» puede estar ya registrado: este documento reúne **todos** los sitios donde sale, para cambiarlo de
una vez cuando haya nombre nuevo. Hay tres tipos de sitio y no se tratan igual:

1. **Lo que ve la gente** (textos de la app, la web, los PDF y los archivos que se descargan): se cambia sin riesgo.
2. **Lo que está fuera del código** (dominios, correo, Google, Cloudflare, GitHub): lo cambia el usuario en cada panel,
   y algunos cambios obligan a mudar datos o a tocar el código a la vez.
3. **Nombres internos** que ya están guardados en los dispositivos y en el servidor: **no se cambian**. Nadie los ve, y
   cambiarlos haría que la app dejara de encontrar los datos ya guardados.

Para volver a buscar: `git grep -n -E "(Cénit|Cenit|cenit|CENIT|Fisiolab|fisiolab)"`.

## 1. Lo que ve la gente (se cambia)

Nombre de la app al instalarla y en la pestaña del navegador, el logo con su texto, títulos, mensajes, el nombre de
los archivos que se descargan (`Cenit-…zip`, `Cenit-kit-recuperacion-…pdf`, `Cenit-contrato-…pdf`, `Copia de
Cenit.sqlite3`), los PDF (pie de los informes), la página pública de privacidad y la de formularios del paciente.

- `cloudflare/worker.js` — líneas 1936, 1939
- `index.html` — líneas 8, 12
- `public/cloud.json` — líneas 4
- `public/politica-de-privacidad.html` — líneas 6, 7, 88, 92, 100, 104, 108, 112, 119, 120, 124, 127, 128, 135, 151, 162, 169, 176, 184, 191
- `src/app/DbGate.tsx` — líneas 58
- `src/app/contact.ts` — líneas 2
- `src/app/errorLog.ts` — líneas 82
- `src/brand/BrandPage.tsx` — líneas 134, 266
- `src/brand/docs.tsx` — líneas 10
- `src/calc/agreement.ts` — líneas 130
- `src/clinical/calendar.ts` — líneas 88
- `src/clinical/reportParts.tsx` — líneas 44, 65
- `src/cloud/AccessRequest.tsx` — líneas 53, 80
- `src/cloud/AccountPages.tsx` — líneas 93, 95, 158
- `src/cloud/CloudGate.tsx` — líneas 380
- `src/cloud/ProviderPage.tsx` — líneas 328
- `src/cloud/RecoveryParts.tsx` — líneas 32, 52
- `src/cloud/drive.ts` — líneas 97
- `src/cloud/googleCalendar.ts` — líneas 17, 67
- `src/data/validation.ts` — líneas 34, 49, 51, 63, 64, 76, 91, 103, 110
- `src/documents/DocumentsPage.tsx` — líneas 93
- `src/documents/SharedFilesPage.tsx` — líneas 75
- `src/export/FullExportButton.tsx` — líneas 47
- `src/export/fullExport.ts` — líneas 149, 339, 358, 520, 583, 586, 660, 669
- `src/messages/MessagesPage.tsx` — líneas 78, 79, 182
- `src/pages/HelpPage.tsx` — líneas 79, 150
- `src/pages/ImportPatientsPage.tsx` — líneas 279
- `src/pages/InstallPage.tsx` — líneas 15, 31, 65
- `src/pages/PrivacyPage.tsx` — líneas 25, 59, 64, 67
- `src/pages/ReportProblemPage.tsx` — líneas 50, 86
- `src/pages/SettingsPage.tsx` — líneas 109, 287
- `src/pages/ValidationPage.tsx` — líneas 38, 67, 203, 242, 317, 324, 334, 344, 372
- `src/pages/VideoPage.tsx` — líneas 145
- `src/patientForm/PublicFormPage.tsx` — líneas 56, 80
- `src/patientForm/SendFormsPage.tsx` — líneas 89
- `src/privacy/AppLock.tsx` — líneas 141
- `src/privacy/LockSettings.tsx` — líneas 119
- `src/privacy/passkey.ts` — líneas 24
- `src/styles/tokens.json` — líneas 2
- `src/ui/AppBar.tsx` — líneas 225, 228
- `src/ui/Logo.tsx` — líneas 84
- `vite.config.ts` — líneas 62, 63

Además, el correo de soporte (`cenitfisiolab@gmail.com`) está en `src/app/contact.ts` (un solo sitio para toda la app)
y en `public/politica-de-privacidad.html`; la dirección de los formularios (`cenitfisiolab.pages.dev`) en
`public/cloud.json` (`formsUrl`).

Con cuidado:
- `src/cloud/drive.ts` (`FOLDER_NAME` = «Cénit · Fisiolab»): la carpeta de Google Drive **se busca por su nombre**. Si
  se cambia, cada fisio tendrá una carpeta nueva y los informes ya guardados se quedan en la antigua (no se pierden).
  Se puede hacer que la app busque las dos.
- `src/cloud/googleCalendar.ts` (`CALENDAR_NAME` = «Cénit · Citas»): solo cambia el nombre de los calendarios que se
  creen después; los que ya existen siguen funcionando (la app los recuerda por su identificador).
- `src/privacy/passkey.ts`: el nombre que enseña el móvil al usar Face ID o la huella en las llaves nuevas.
- `src/data/validation.ts` y `src/pages/ValidationPage.tsx`: «Cénit» como herramienta de medida en los textos de
  validación.
- Documentación (no la ve el usuario final, pero conviene tenerla al día): `RESUMEN.md`, `docs/*.md`,
  `cloudflare/README.md`, `src/*/README.md`, `.github/workflows/pages.yml` (comentarios).

Las pruebas que buscan esos textos también hay que cambiarlas a la vez: `git grep -l -E "(Cénit|Cenit)" -- e2e src/**/*.test.ts`.

## 2. Fuera del código (lo cambias tú en cada panel)

| Qué | Hoy | Qué implica cambiarlo |
| --- | --- | --- |
| Dirección de la app y de los formularios | `cenitfisiolab.pages.dev` (proyecto de Cloudflare Pages `cenitfisiolab`) | Proyecto de Pages nuevo o dominio propio; cambiar `public/cloud.json`, los orígenes de Google (Credenciales), `ALLOWED_ORIGINS` del Worker, la Marca de Google (página principal y privacidad) y los textos. Los datos de cada dispositivo van con la dirección: hay que mudar como en el paso 2 de `docs/pasos-pendientes.md`. Los enlaces de formularios ya enviados dejarían de abrir. |
| Dirección de GitHub | `adrianolivascano05-maker.github.io/Fisiolab/` | Depende del nombre del repositorio (`Fisiolab`). Mismo problema de mudanza. |
| Correo de soporte | `cenitfisiolab@gmail.com` | Cuenta nueva; cambiar `src/app/contact.ts`, la política de privacidad y la Marca de Google. |
| Google Cloud | proyecto «Cenit Fisiolab», cliente OAuth «Cénit web», Marca «Cénit · Fisiolab» | El nombre del proyecto y del cliente se cambian sin más. El nombre en **Marca** es el que ve la gente al entrar con Google. |
| Cloudflare | Worker y base D1 `cenit-datos`, almacén R2 `cenit-archivos`, token `cenit-peticiones` | **Mejor no cambiarlos**: nadie los ve. Renombrar el Worker cambia la dirección del servidor (`cloudflareUrl` en `public/cloud.json`) y todas las clínicas tendrían que volver a conectarse; el almacén R2 no se puede renombrar (habría que copiarlo). |
| Contrato de encargado y textos legales | dicen «Cénit · Fisiolab» | Cambiar el borrador en `cloudflare/worker.js` (final del archivo) y que la asesoría lo revise. |

## 3. Nombres internos (no se cambian)

Están guardados en los dispositivos, en las copias y en el servidor. Cambiarlos rompería lo que ya hay:

- Formatos de archivo: `CENITENC1`, `CENITENC2` (copias cifradas) y `CENITDOC1` (archivos de los pacientes). Las
  copias y los PDF ya guardados empiezan por ellos.
- Base del dispositivo: `cenit-fisiolab.sqlite3`, `fisiolab-db`, `fisiolab-pool`, `fisiolab-claves`.
- Ajustes del navegador: todas las claves `fisiolab.*` (sesión, PIN, tema, marca de la clínica…) y `cenit.*`.
- Cachés de la app: `cenit-compartidos`, `cenit-exportacion`, `fisiolab-medicion`.
- Nombres de variables del código (`CENIT_PRIMARY`, etc.).

«Fisiolab» es además el nombre de la clínica del usuario: donde salga como nombre de clínica (datos de ejemplo,
pruebas) no hace falta cambiarlo.
