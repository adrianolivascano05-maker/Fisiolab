# Cambio de nombre: Cénit · Fisiolab → OmniClin (hecho el 28-10-2026)

«CENIT» está registrada para software en la UE y en España, así que la app pasa a llamarse **OmniClin**. Fisiolab
sigue siendo el nombre de la clínica del usuario. Logo: anillo de tres arcos (medir · organizar · acompañar) con el
sol de oro arriba; colores de siempre (bosque `#0E3B2E`, verde `#1F6B4F`, oro `#C9A227`, papel `#F2F4F1`) más el
crema `#F1E9DA` y el menta `#6CC39D` del logo; el modo oscuro va sobre el bosque.

Para comprobar que no queda nada: `git grep -n -E "(Cénit|Cenit|CÉNIT)"`. Lo que sale es a propósito (abajo).

## Qué se cambió en la app

- Nombre al instalarla y en la pestaña (`vite.config.ts`, `index.html`), logo (`src/ui/Logo.tsx`: `LogoMark` y
  `Wordmark`), iconos y favicon (`tools/build-icons.py`, `public/icons/`, `public/favicon.png`) y colores
  (`src/styles/tokens.json`: `on-brand` crema, `on-brand-accent` menta y el modo oscuro sobre el bosque).
- Todos los textos de la app, de los documentos (pie «Documento generado con OmniClin»), de la ayuda, de Privacidad,
  de la página pública de privacidad (`public/politica-de-privacidad.html`) y de la de formularios del paciente.
- Los archivos que se descargan: `OmniClin-…zip`, `OmniClin-kit-recuperacion-…pdf`, `OmniClin-contrato-…pdf` y
  `Copia de OmniClin.sqlite3`.
- La carpeta de Google Drive («OmniClin») y el calendario («OmniClin · Citas»): **se renombran** los que ya tenía cada
  fisio la próxima vez que se usan; no se crea otra carpeta ni otro calendario (`OLD_FOLDER_NAMES` en
  `src/cloud/drive.ts`, `OLD_CALENDAR_NAMES` en `src/cloud/googleCalendar.ts`; pruebas en `src/cloud/rename.test.ts`).
- El contrato de encargado que da el servidor (`cloudflare/worker.js`, versión `2026-10-28`): hay que **volver a pegar
  el `worker.js`** en Cloudflare (la app lo recuerda en Ajustes → Proveedor).
- Pruebas, `RESUMEN.md`, `docs/` y los README.

## Qué no se cambió, a propósito

- Marcas internas de los archivos: `CENITENC1`, `CENITENC2` (copias cifradas) y `CENITDOC1` (archivos de los
  pacientes). Las copias y archivos de antes tienen que seguir abriéndose.
- Base del dispositivo y ajustes del navegador: `cenit-fisiolab.sqlite3`, `fisiolab-db`, `fisiolab-pool`,
  `fisiolab-claves`, las claves `fisiolab.*` y `cenit.*`, las cachés `cenit-compartidos` y `cenit-exportacion`, y los
  ids de los eventos de Google Calendar (`cenit…`). Cambiarlos haría que la app no encontrara lo que ya hay.
- Servidor de Cloudflare: el Worker y la base `cenit-datos`, el almacén R2 `cenit-archivos` y el token
  `cenit-peticiones`. Nadie los ve; cambiarlos obligaría a reconectar todas las clínicas.
- Los nombres de antes de la carpeta y del calendario, que solo sirven para encontrarlos y renombrarlos.

## Qué falta, fuera del código (lo hace el usuario)

| Qué | Hoy | Cuándo |
| --- | --- | --- |
| Dirección de la app y de los formularios | `cenitfisiolab.pages.dev` (y la de GitHub) | Al tener `omniclin.es`: proyecto de Pages o dominio propio, `public/cloud.json`, orígenes de Google, `ALLOWED_ORIGINS` del Worker y mudanza de los dispositivos (como el paso 2 de `docs/pasos-pendientes.md`). Los enlaces de formularios ya enviados dejarían de abrir. |
| Correo de soporte | `cenitfisiolab@gmail.com` (`src/app/contact.ts`, política de privacidad) | Al tener un correo de OmniClin. |
| Google Cloud | proyecto «Cenit Fisiolab», cliente «Cénit web», Marca | El proyecto y el cliente se pueden renombrar sin efecto. En **Marca**, el nombre «OmniClin» y el logo (con logo, Google pide verificar la marca). |
| Cloudflare | pegar el `worker.js` de la versión `2026-10-28` | Ahora. |
| Marca en la OEPM | sin presentar | Antes de enseñar el nombre en público (`docs/ideas-pendientes.md`). |
