# Marca por clínica

Cada clínica puede poner su nombre, dos colores y su logo (Ajustes › Marca de la clínica). Sin marca guardada, la app
es Cénit tal cual.

- `engine.ts`: de dos colores salen todos los colores de la app en claro y en oscuro, en OKLCH, con el contraste de
  WCAG AA corregido solo. Puro. `engine.test.ts` comprueba las parejas de `src/styles/tokens.json` con cientos de
  colores al azar.
- `brand.ts`: el tipo `Brand`, el ajuste `clinic_brand` (en la base de la clínica, cifrada y sincronizada), y cómo se
  aplica a la página: una hoja de estilos encima de `tokens.css`, el favicon, el título y el color de la barra del
  móvil. La última marca se guarda también en el navegador para ponerla antes de pintar (sin parpadeo).
- `logo.ts`: el logo subido se reduce a 512 px (PNG) o se acepta como SVG pequeño; `logoColors` propone dos colores.
- `BrandPage.tsx` y `BrandPreview.tsx`: la pantalla de Ajustes con la vista previa en vivo.
- `src/ui/Logo.tsx` pinta el logo de la clínica (o su inicial) donde antes iba solo el de Cénit.

- `docs.tsx`: la marca en los documentos. `Watermark` (el logo en gris al 7 %, en el tercio superior; al imprimir,
  en cada hoja) y `docVars` (los colores de un documento como variables en su recuadro). El membrete común está en
  `src/clinical/reportParts.tsx`; el PDF (`src/clinical/reportPdf.ts`) esconde la marca de agua de la pantalla y la
  dibuja él en cada página. Un consentimiento guarda la marca con la que se firmó (`ConsentDocument.brand`) y se
  pinta siempre con esa; los de antes de haber marca, con la de Cénit.

Lo que aún no usa la marca (bloques siguientes): la página del paciente y los mensajes editables.
