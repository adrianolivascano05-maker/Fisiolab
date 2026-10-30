# Pasos pendientes (los hace quien administra la app)

Cinco tareas que no se pueden hacer desde el código: cuatro son en las cuentas de Google y Cloudflare y la última,
en un iPhone de verdad. Ninguna es urgente: la app funciona igual mientras tanto. Los menús son los de octubre de 2026; si alguno cambia de nombre, el
orden es el mismo.

## 1. Google: sacar la app de «en pruebas» (unos 5 minutos)

Mientras el proyecto de Google está **en pruebas**, solo pueden entrar las cuentas de la lista de usuarios de prueba
y Google les vuelve a pedir permiso cada 7 días. En **producción** puede entrar cualquier cuenta (sin clínica no ve
nada: puede pedir el alta y tú la aceptas en Ajustes → Proveedor).

1. Abre <https://console.cloud.google.com/auth/audience> con la cuenta dueña del proyecto. Arriba, comprueba que
   el proyecto elegido es **Cenit Fisiolab** (su nombre de antes; se puede cambiar a «OmniClin» en la configuración del proyecto sin que afecte a nada).
2. Antes de publicar, mira <https://console.cloud.google.com/auth/scopes> (**Acceso a datos**): solo debe haber
   permisos «no sensibles» (`openid`, correo, perfil, `drive.file` y, si se usa la copia en Drive,
   `drive.appdata`). Si hay alguno en «Permisos sensibles» o «restringidos», quítalo y **Guardar**: la app pide el
   del calendario solo a quien activa las citas en Google Calendar, no hace falta tenerlo ahí.
3. En **Marca** (<https://console.cloud.google.com/auth/branding>), Google exige cuatro datos antes de publicar:
   - **Nombre de la aplicación:** `OmniClin`.
   - **Correo de asistencia:** `cenitfisiolab@gmail.com`.
   - **Página principal:** `https://cenitfisiolab.pages.dev/`.
   - **Política de privacidad:** `https://cenitfisiolab.pages.dev/politica-de-privacidad.html` (página pública y estática,
     `public/politica-de-privacidad.html`, desde el 27-10-2026; es un texto por revisar con la asesoría).
   - En **Dominios autorizados**, que esté `cenitfisiolab.pages.dev` (y, si ya estaba, el de GitHub).
   No subas un logotipo de momento: con logotipo, Google exige verificar la marca antes de enseñarlo.
4. Vuelve a **Público** → **Publicar aplicación** → **Confirmar**. El estado pasa a «En producción».
5. Prueba: abre la app en una ventana de incógnito con una cuenta que **no** estaba en la lista de prueba. Debe
   entrar sin el aviso «Google no ha verificado esta aplicación». Si aparece ese aviso, vuelve al paso 2: queda
   algún permiso sensible.

Si algún día Google pide verificar la app, se puede volver a **en pruebas** con el mismo botón; las cuentas de la
lista siguen entrando.

## 2. Mudar la app entera a `cenitfisiolab.pages.dev` sin perder nada

Hoy la clínica usa la dirección de GitHub y los pacientes abren los formularios en `cenitfisiolab.pages.dev`. Las
dos son la misma app, publicada a la vez. Cada dirección guarda sus datos aparte en el navegador, así que al
cambiar de dirección cada dispositivo vuelve a bajar los datos de la clínica del servidor. Lo que hay en el
servidor no se toca.

**Qué pasa con los datos:** pacientes, agenda, sesiones, cobros y todo lo de la clínica están en el servidor de
Cloudflare (cifrados) y bajan solos al entrar. Lo que es solo de cada dispositivo (el PIN, los favoritos de la guía
de tests, la vista de la agenda, la conexión con Google Calendar) hay que volver a ponerlo en la dirección nueva.

Una vez, en Google (5 minutos):

1. <https://console.cloud.google.com/auth/clients> → el cliente **Cénit web** (su nombre de antes; se puede llamar «OmniClin web» sin que afecte a nada) → en **Orígenes de JavaScript
   autorizados**, **Añadir URI**: `https://cenitfisiolab.pages.dev`
2. En **URIs de redireccionamiento autorizados**, **Añadir URI**: `https://cenitfisiolab.pages.dev/` (con la
   barra del final). **Guardar**. Puede tardar unos minutos en valer.

En Cloudflare no hay que hacer nada: `ALLOWED_ORIGINS` ya tiene las dos direcciones.

Después, en **cada** dispositivo de la clínica:

1. En la dirección de siempre, espera a que la nube diga que está todo subido (Ajustes → tu cuenta: «Guardado
   en…», sin «Cambios pendientes de subir»). Como red de seguridad, Ajustes → **Copias de seguridad y exportar** →
   **Descargar todo (historias, Excel y copia)** y guarda el .zip fuera del móvil.
2. Abre <https://cenitfisiolab.pages.dev>, entra con tu cuenta de Google, elige la clínica y pon la contraseña de
   la clínica. Espera a que bajen los pacientes y comprueba que están todos.
3. Instálala desde ahí (menú del navegador → **Instalar aplicación** o **Añadir a pantalla de inicio**) y vuelve a
   poner el PIN si lo usabas.
4. Cuando todo esté bien, quita el icono antiguo de la pantalla de inicio. No borres los datos de la dirección
   antigua hasta pasados unos días.

Cuando estén mudados todos los dispositivos, la versión de GitHub puede quedarse como está (sigue funcionando) o
puedo hacer que avise «La app se ha mudado» y lleve a la dirección nueva. Dímelo y lo preparo.

## 3. Cloudflare: pegar el `worker.js` nuevo y borrar las tablas de la reserva (unos 10 minutos)

**Hecho el 27-10-2026** (versión `2026-10-27.2`; tablas de la reserva borradas, no quedaba ninguna sin recoger) **y
otra vez el 28-10-2026** (versión `2026-10-28`, la del cambio de nombre; `/v1/salud` la confirma). **Pendiente otra vez desde el 30-10-2026** (versión `2026-10-30`): cambia el texto del contrato de encargado (la finalidad prevista de la app, de la revisión de producto sanitario). Solo hay que pegar el `worker.js` nuevo (paso 4 de `cloudflare/README.md`); las tablas no cambian.

La reserva online se ha quitado (24-10-2026) y el servidor se ha dejado más limpio (bloque 3: formularios repetidos
a la vez, lotes de cambios que se leían de más, tiempo límite con Google, menos limpiezas en cada consulta). El
servidor nuevo ya no tiene las rutas de la reserva, y sus tres tablas sobran. Además trae los archivos de los
pacientes (26-10-2026), que necesitan dos tablas nuevas en la base, y (27-10-2026) la copia de cada clínica en R2 por
trozos, la consulta de cada minuto que dice también si hay formularios respondidos (la mitad de peticiones) y los
avisos al 70 % en el panel del proveedor (sin tablas nuevas). **Ya está listo para pegarlo.** Si ya lo pegaste
antes del 27-10-2026, vuelve a hacer el paso 3 (el `schema.sql` no cambia: ejecutarlo otra vez no hace nada).

**Otra vez el 27-10-2026, por la tarde:** el servidor trae las peticiones de hoy para el panel del proveedor
(versión `2026-10-27.2`). Si pegaste el `worker.js` por la mañana, vuelve a pegarlo (solo el apartado 3 de abajo:
el `schema.sql` no cambia). Después, si quieres verlas, haz el paso 4 bis.

**28-10-2026, cambio de nombre a OmniClin:** el contrato de encargado que da el servidor dice ya «OmniClin» (versión
`2026-10-28`). Pegado ese mismo día (solo el `worker.js`; el `schema.sql` no cambió).

**Desde el 27-10-2026 la app te lo recuerda:** en **Ajustes**, la fila **Proveedor** sale en naranja con «Pendiente
en Cloudflare: actualizar el servidor» mientras el servidor pegado sea anterior al que necesita la app, y con
«activar R2» mientras falte el paso 4. Dentro, en el panel, explica qué hacer. Cuando ya no diga nada, está todo al
día. Los fisios del paciente (migración 034) van solo en la app: no tocan el servidor.

1. Comprueba que no queda ninguna reserva sin recoger. <https://dash.cloudflare.com> → **Storage & Databases** →
   **D1** → la base (`cenit-datos`) → **Console**. Pega y ejecuta:
   `SELECT count(*) AS n FROM bookings WHERE collected_at IS NULL;`
   - Si dice `n = 0`, o «no such table» (la reserva nunca se llegó a instalar), sigue.
   - Si dice otro número, **para y dímelo**: son reservas que nadie ha recogido y aún se pueden rescatar.
2. En la misma **Console**, pega todo `cloudflare/schema.sql` del repositorio y pulsa **Execute**. Crea las tablas
   nuevas (`documents` y `doc_requests`) y no borra nada. Tiene que ir **antes** de pegar el servidor: sin ellas,
   el servidor nuevo da error.
3. **Workers & Pages** → el servidor (`cenit-datos`) → **Edit code**. Borra todo, pega el contenido de
   `cloudflare/worker.js` del repositorio y **Deploy**.
4. Abre la dirección del servidor terminada en `/v1/salud`: debe decir que todo está bien.
5. Vuelve a la **Console** de la base y ejecuta (se puede pegar todo junto):
   `DROP TABLE IF EXISTS booking_pages; DROP TABLE IF EXISTS bookings; DROP TABLE IF EXISTS cancel_links;`
6. En la app, comprueba que «Buscar respuestas» de un formulario y la sincronización siguen funcionando.

## 4. Cloudflare: activar los archivos de los pacientes (R2) (unos 10 minutos, después del paso 3)

**Hecho el 27-10-2026** (almacén `cenit-archivos` en la UE, enlace `DOCS`).

Para guardar los informes y pruebas de cada paciente (PDF o fotos) y para el enlace con el que el paciente te los
envía. Además, desde el 27-10-2026, la copia de cada clínica pasa a R2: así deja de tener el tope de 50 MB (una
clínica de 10.000 pacientes ocupa unos 54 MB) y el servidor no tiene que juntarla en memoria. Hasta que lo actives,
la app no ofrece los archivos y todo lo demás funciona igual. Cloudflare pide una tarjeta; con el tope del servidor
(10 GB, avisa al 70 %) no se pasa de lo gratis, salvo que uses R2 para otras cosas en la misma cuenta. Si un día
quieres más sitio, pon la variable `DOCS_CAP_GB` (por ejemplo `50`, unos 0,60 $ al mes). La guía completa, con los
precios, está en `cloudflare/README.md`, «Documentos».

1. <https://dash.cloudflare.com> → **Storage & Databases** → **R2 object storage**. La primera vez pide activar R2
   y una tarjeta.
2. **Create bucket**: nombre `cenit-archivos`; **Location** → **Specify jurisdiction** → **European Union (EU)**;
   si pregunta la clase, **Standard**; **Create bucket**. La jurisdicción no se puede cambiar después. No actives
   el acceso público.
3. **Workers & Pages** → el servidor (`cenit-datos`) → **Settings** → **Bindings** → **Add binding** → **R2
   bucket**: Variable name `DOCS`, R2 bucket `cenit-archivos` → **Add Binding** (o **Deploy**).
4. En la app (con un paciente inventado): en su ficha, **Archivos del paciente** → **Añadir PDF o fotos**. En
   **Ajustes** → **Copias y exportar** sale lo que ocupan.
5. Opcional: si pasas al plan de pago de Workers, añade la variable `D1_CAP_MB` = `10000` (**Settings** →
   **Variables and Secrets**): el panel del proveedor avisa al 70 % de lo que puede ocupar la base, y con el plan
   de pago cabe 20 veces más.

## 4 bis. Ver las peticiones de hoy en el panel del proveedor (opcional, unos 5 minutos)

**Hecho el 27-10-2026** (`CF_ACCOUNT_ID` y `CF_API_TOKEN` en el Worker; el panel ya enseña las peticiones).

Para que el panel (solo tú lo ves) diga cuántas peticiones lleva hoy el servidor y te avise al 70 % del límite del
plan gratuito (100 000 al día). Necesita un token de Cloudflare de **solo lectura** que creas tú y se queda guardado
en Cloudflare. Los pasos están en `cloudflare/README.md`, «Peticiones al día, en el panel del proveedor»: crear el
token (permiso **Account Analytics: Read**), copiar el ID de la cuenta y guardar los dos en el Worker
(`CF_ACCOUNT_ID` y el secreto `CF_API_TOKEN`).

## 5. Probar en un iPhone (unos 10 minutos, antes de ofrecer la app a una clínica con iPhone)

Las pruebas automáticas usan el motor de Safari en Linux, que no es igual que un iPhone. Esto solo se puede
comprobar a mano. Usa siempre pacientes inventados.

1. En el iPhone, abre la app en **Safari** (la dirección de siempre).
2. Crea un paciente de prueba, por ejemplo «Prueba iPhone».
3. Recarga la página (la flecha circular de la barra de Safari). El paciente tiene que seguir ahí.
4. **Ajustes**: abajo del todo tiene que poner «guardado en el dispositivo» (si pone «en memoria», apúntalo).
5. Si usas cuenta de Google: **Ajustes › Cuenta de Google** → **Entrar con Google**. Al volver de Google **no**
   tiene que salir «OmniClin ya está abierta en otra pestaña».
6. Instálala: botón **Compartir** → **Añadir a pantalla de inicio**, y ábrela desde el icono. En iPhone, la app
   instalada guarda sus datos aparte de Safari: el paciente de Safari puede no salir. Crea otro de prueba.
7. Cierra la app del todo (desliza hacia arriba desde abajo y quítala) y vuelve a abrirla. El paciente sigue.
8. Borra los pacientes de prueba.

Si algo de esto falla: **Ajustes › Algo no funciona**, y cuéntame en qué paso y qué salía en la pantalla.
