# Marca por clínica

Cada clínica puede poner su nombre, su lema, dos colores (o una de las ocho paletas listas), su logo y el aspecto
(la barra de arriba, la letra, las esquinas y el acabado) en Ajustes › Marca de la clínica. Sin marca guardada, la app
es OmniClin tal cual. La **identidad** (nombre, logo y colores) va aparte del **aspecto**: con `identity: "omniclin"`
la clínica se queda con el nombre, el logo a dos colores y los colores de OmniClin y cambia solo lo demás (cabecera,
letra, esquinas, acabado, membrete, página del paciente). `ownIdentity(brand)` da la marca solo si el nombre, el logo
y los colores son de la clínica: es lo que miran el logo, la barra, el favicon, el título, el membrete, los mensajes y
la página del paciente. `omniclinTokens` (engine.ts) parte de los colores de `tokens.json` tal cual y les aplica la
cabecera y los tonos del acabado.

- `engine.ts`: de dos colores salen todos los colores de la app en claro y en oscuro, en OKLCH, con el contraste de
  WCAG AA corregido solo. Puro. `engine.test.ts` comprueba las parejas de `src/styles/tokens.json` con cientos de
  colores al azar, y con las paletas, los tres acabados y las tres cabeceras. El acabado vivo o metálico sube el croma
  de los dos colores antes de calcular; la cabecera «color» usa el color de los botones y la «clara», el fondo; de la
  cabecera, los botones y los destacados salen un tono más claro (`-hi`) y otro más oscuro (`-lo`) para los degradados.
- `options.ts`: las paletas listas, las opciones de cabecera, esquinas, acabado y letra con sus nombres, los radios de
  cada opción de esquinas y las cuatro parejas de letra (paquetes `@fontsource-variable`, dentro de la app; las tres
  que no son la de OmniClin se cargan solo al elegirlas y el service worker las guarda al bajarlas). `brandVars` da las
  variables de radios y letras que van en la misma hoja que los colores.
- Las reglas del acabado están al final de `src/styles/index.css`: con `data-finish="vivid"` o `"metal"` en `<html>`
  (o en el recuadro de la vista previa), la cabecera, los botones y los destacados llevan degradado y, en metálico,
  brillo. Los documentos (`.theme-light`) se quedan planos.
- `brand.ts`: el tipo `Brand`, el ajuste `clinic_brand` (en la base de la clínica, cifrada y sincronizada), y cómo se
  aplica a la página: una hoja de estilos encima de `tokens.css` (colores, radios y letras), `data-finish` y
  `data-header` en `<html>`, el favicon, el título y el color de la barra del móvil. La última marca se guarda también
  en el navegador para ponerla antes de pintar (sin parpadeo). Una marca guardada antes de existir una opción se
  completa con la de OmniClin (`cleanBrand`); `brand.test.ts` lo comprueba. Los campos `letterhead` (membrete) y
  `patient` (página del paciente) se guardan ya; los documentos y la página del paciente los usan en sus bloques.
- `logo.ts`: el logo subido se reduce a 512 px (PNG) o se acepta como SVG pequeño; `logoColors` propone dos colores.
- `BrandPage.tsx` y `BrandPreview.tsx`: la pantalla de Ajustes con la vista previa en vivo.
- `src/ui/Logo.tsx` pinta el logo de la clínica (o su inicial) donde antes iba solo el de OmniClin.

- `signature.ts` y `SignatureSettings.tsx`: la firma dibujada de cada fisio (Ajustes › Clínica › Tu firma), un ajuste de
  cada persona (`memberKey`, en `MEMBER_SETTINGS` para que siga a la persona al entrar en una clínica). La pone
  `SignatureLine` (`src/clinical/reportParts.tsx`) sobre la línea de firma, y el PDF la captura con el resto.
- El membrete (`Letterhead`, en `src/clinical/reportParts.tsx`) sigue `brand.letterhead`: el logo a la derecha, a la
  izquierda o centrado, el lema bajo el nombre, con o sin datos de contacto, banda de color y el pie propio junto a la
  firma. Los consentimientos firmados conservan su marca y enseñan el lema si lo tenía.
- `docs.tsx`: la marca en los documentos. `Watermark` (el logo en gris al 7 %, en el tercio superior; al imprimir,
  en cada hoja) y `docVars` (los colores de un documento como variables en su recuadro). El membrete común está en
  `src/clinical/reportParts.tsx`; el PDF (`src/clinical/reportPdf.ts`) esconde la marca de agua de la pantalla y la
  dibuja él en cada página. Un consentimiento guarda la marca con la que se firmó (`ConsentDocument.brand`) y se
  pinta siempre con esa; los de antes de haber marca, con la de OmniClin.

- `form.ts`: la marca en la página que abre el paciente. El nombre, los colores, el logo reducido a 160 px, el lema,
  la cabecera, las esquinas, el acabado, la letra, el texto de bienvenida y la línea de contacto (teléfono y correo de
  Ajustes › Clínica, si la clínica lo quiere) viajan dentro del sobre cifrado del formulario (`FormRequest.brand`);
  `PublicFormPage` la aplica al descifrarlo. Los formularios de antes no la llevan y se abren con la de OmniClin. El
  servidor no la ve.

Los mensajes de WhatsApp y correo se editan aparte, en `src/messages/`. En Privacidad (`src/pages/PrivacyPage.tsx`)
hay siempre un apartado «Quién hace el programa», aunque la app lleve la marca de la clínica.
