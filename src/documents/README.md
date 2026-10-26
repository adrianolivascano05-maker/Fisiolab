# Archivos del paciente (`src/documents/`)

Los informes y pruebas de cada paciente (PDF, o fotos que se juntan en un PDF), de 5 MB como mucho cada uno. Solo
con el servidor de la clínica y si ese servidor tiene el almacén de archivos (R2, `cloudflare/README.md`,
«Documentos»): sin él, la app no los ofrece.

## Cómo va

- **Los datos** (`src/data/documents.ts`, migración 032): la tabla `documents` (nombre, tipo, tamaño, la clave del
  archivo, de dónde viene, si ya está subido) se sincroniza como el resto, cifrada. Los archivos **no** van en la
  base: así la base sigue siendo pequeña.
- **Cifrado** (`docCrypto.ts`): cada archivo con su propia clave al azar, AES-GCM-256, con la cabecera
  `CENITDOC1` + IV de 12 bytes. Los que sube el paciente usan la clave de su enlace.
- **En el dispositivo** (`cache.ts`): los bytes cifrados en IndexedDB (`cenit-archivos.<clínica>`). Se guardan al
  añadirlos y al abrirlos; «Liberar espacio en este dispositivo» (Ajustes › Copias y exportar) borra los que ya
  están en el servidor.
- **Con el servidor** (`docSync.ts`, `DocSync.tsx`): al añadir se intenta subir ya; si no se puede, se sube solo
  después (cada minuto con la app abierta). Al borrar, el id va a `document_trash` (no se sincroniza) y se borra del
  servidor en la siguiente vuelta. Otro dispositivo baja el archivo solo al abrirlo.
- **Preparar** (`prepare.ts`, `imagesToPdf.ts`): los PDF tal cual; las fotos de una misma vez, reducidas a JPEG y
  juntas en un PDF (sin librerías). Lo que pasa de 5 MB o no es PDF ni foto no se guarda y se dice por qué.
- **Pantallas:** `DocumentsPage.tsx` (`/pacientes/:id/archivos`), `DocsStorageCard.tsx` (Ajustes) y
  `SharedFilesPage.tsx` (`/compartir`: lo que llega de «Compartir → Cénit» en Android, que deja
  `public/compartir-sw.js` en la caché `cenit-compartidos`).
- **El enlace del paciente:** `DOCS_KIND` en `src/clinical/patientForms.ts`; el paciente sube en
  `src/patientForm/PublicFormPage.tsx` y al recoger el formulario (`src/patientForm/collect.ts`) la clínica se queda
  con cada archivo (`POST …/guardar`) y lo añade a la ficha.
- **Exportación completa:** `src/export/fullExport.ts` mete los archivos descifrados en «Archivos de pacientes», con
  enlaces desde la ficha de cada paciente.

## Límites

- No hay visor dentro de la app: abrir un archivo es descargarlo.
- Compartir → Cénit solo en Android con la app instalada.
- La exportación completa junta todo en memoria.
- Un archivo añadido sin conexión vive solo en ese dispositivo hasta que se sube.

## Pruebas

`docSync.test.ts`, `imagesToPdf.test.ts`, «documentos» en `cloudflare/worker.test.ts`, el caso de documentos en
`src/patientForm/collect.test.ts` y `e2e/archivos.spec.ts` (AR1 a AR4).
