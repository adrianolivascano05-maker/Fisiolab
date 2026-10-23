# Servidor de datos de la clínica en Cloudflare

Es otra forma de guardar en la nube la copia de los pacientes. En lugar de ir al Google Drive de cada
fisioterapeuta, va a un servidor pequeño en Cloudflare. Se monta una vez, con el plan gratuito y sin programar, y
sirve para varias clínicas: cada una con su equipo y sus pacientes, sin que las demás (ni quien gestiona el
servidor) puedan verlos.

## Qué es y por qué

- **Google queda solo para entrar.** Cada fisioterapeuta entra en la app con su cuenta de Google, como ahora. El
  servidor pregunta a Google si la sesión es buena y de quién es; la copia ya no va a Google Drive.
- **Los datos se quedan en la UE.** La base de datos, donde se guarda la copia, se crea con la jurisdicción `eu`
  (Unión Europea). Así Cloudflare la guarda y la procesa solo en centros de datos de la Unión Europea. El
  servidor que la recibe se ejecuta en el centro de Cloudflare más cercano al dispositivo (desde España,
  normalmente en Europa) y solo maneja la copia ya cifrada.
- **Solo se guardan copias cifradas.** El dispositivo cifra la copia con la contraseña de cifrado de la clínica
  antes de enviarla. Cloudflare no tiene esa contraseña y solo recibe bytes que sin ella no se pueden leer. El
  servidor rechaza cualquier copia sin cifrar. La otra cara: si se pierde la contraseña, Cloudflare tampoco puede
  recuperar la copia (la de cada dispositivo sigue intacta).
- **Qué más ve Cloudflare:** lo mismo que quien gestiona el servidor (nombres de clínica, correos de cada equipo,
  tamaño y fecha de cada copia). No guarda los tokens de Google, y los registros de peticiones se dejan
  desactivados (paso 7).
- **Contrato de encargado del tratamiento (DPA).** El de Cloudflare forma parte de sus condiciones de autoservicio:
  se acepta al crear la cuenta. Conviene descargar la versión vigente
  (<https://www.cloudflare.com/cloudflare-customer-dpa/>; si la página cambia, busca «Cloudflare Customer DPA»),
  guardarla con la documentación de protección de datos de la clínica y comprobar con vuestro delegado de
  protección de datos que encaja con lo que necesitáis. Esta guía no es asesoramiento legal ni garantiza que el
  montaje cumpla la normativa: eso lo decide la clínica con su delegado.
- **Clínicas con equipo.** Quien está en la lista `ALLOWED_EMAILS` puede dar de alta una clínica en la app y queda
  como su administrador. Después, él mismo añade a su equipo por correo de Google, desde la app (**Ajustes** →
  **Equipo de la clínica**): no hace falta tocar Cloudflare. Todo el equipo comparte los pacientes de la clínica;
  nadie de fuera del equipo puede bajar su copia. Al quitar a alguien, deja de poder bajarla y los pacientes se
  borran de sus dispositivos la próxima vez que abra la app con conexión.
- **Quien gestiona el servidor tampoco ve a los pacientes.** Cada clínica cifra su copia con su propia contraseña,
  que se da en persona a su equipo y nunca pasa por el servidor. Quien gestiona Cloudflare (por ejemplo, quien
  da la app a varias clínicas) ve los nombres de las clínicas, los correos de cada equipo y el tamaño y la fecha
  de cada copia; los pacientes, no. Sí controla la app y el servidor, así que para cada clínica es su encargado
  del tratamiento y conviene firmar con ella un contrato de encargado.

## Antes de empezar

Ten a mano:

- El **ID de cliente de Google** de la app. Es el `googleClientId` de `public/cloud.json` (ahora,
  `1084216324372-0mrfdeckqcfu8p2t1tjsosdebs7g2tmb.apps.googleusercontent.com`).
- El **correo de Google** del responsable de cada clínica que vaya a usar el servidor (el resto del equipo lo
  añade él desde la app).
- Los archivos **`schema.sql`** y **`worker.js`** de esta carpeta. En GitHub, abre cada uno, pulsa **Raw** y copia
  todo el texto.

## Instalarlo desde el panel de Cloudflare (sin terminal, unos 15 minutos)

Los nombres de los menús son los del panel de Cloudflare en octubre de 2026, en inglés. Si alguno cambia, los
pasos son los mismos.

1. **Cuenta gratuita.** Entra en <https://dash.cloudflare.com/sign-up> con el correo de la clínica y verifica el
   correo. Para Workers y D1 no hace falta tarjeta. Activa la verificación en dos pasos (tu perfil →
   **Authentication**): esta cuenta guarda datos de salud, aunque estén cifrados.
2. **Base de datos.** En el menú de la izquierda, **Storage & Databases** → **D1 SQL Database** → **Create
   Database**:
   - Nombre: `cenit-datos`.
   - **Data location** → **Specify jurisdiction** → **European Union**.
   - **Create**.

   La jurisdicción no se puede cambiar después. Si la base se ha creado sin ella, bórrala y créala otra vez.
3. **Tablas.** Dentro de la base, abre la pestaña **Console**, pega todo `schema.sql` y pulsa **Execute**. Si da
   error, pega y ejecuta cada `CREATE TABLE … );` por separado.
4. **El servidor (Worker).** **Workers & Pages** → **Create** → **Start with Hello World!**:
   - Nombre: `cenit-datos` → **Deploy**.
   - **Edit code**: borra todo lo que hay en `worker.js`, pega nuestro `worker.js` y pulsa **Deploy**.
5. **Unir el servidor con la base.** En el Worker, **Settings** → **Bindings** → **Add binding** → **D1 database**:
   - Variable name: `DB`.
   - D1 database: `cenit-datos`.
   - **Add Binding** (o **Deploy**, si lo pide).
6. **Variables.** En el Worker, **Settings** → **Variables and Secrets** → **Add**, de tipo **Text**, una por una:

   | Nombre | Valor |
   | --- | --- |
   | `GOOGLE_CLIENT_ID` | el ID de cliente de Google (arriba) |
   | `ALLOWED_EMAILS` | los correos de quien puede dar de alta una clínica, separados por comas: `ana@gmail.com, luis@gmail.com` |
   | `ALLOWED_ORIGINS` | `https://adrianolivascano05-maker.github.io` (para probar con `npm run dev`, añade `,http://localhost:5173`) |
   | `OPERATOR_EMAILS` | tu correo de Google, si gestionas el servidor para varias clínicas: ves Ajustes → Proveedor en la app |

   En `ALLOWED_ORIGINS` va solo el principio de la dirección, sin `/Fisiolab/`. Pulsa **Deploy**. Si
   `ALLOWED_EMAILS` se queda vacía, nadie puede dar de alta una clínica.
7. **Sin registros.** En el Worker, **Settings** → **Observability**: si **Workers Logs** está activado,
   desactívalo. El servidor nunca escribe en el registro una copia ni un token, pero así tampoco queda
   constancia de cada petición.
8. **Comprobarlo.** Abre en el navegador `https://cenit-datos.<subdominio>.workers.dev/v1/salud`. El
   `<subdominio>` es el de tu cuenta; la dirección completa sale en la página del Worker. Debe salir
   `{"ok":true}`. Si sale `"ok":false`, el mensaje dice qué falta (el enlace `DB`, las tablas o una variable).
9. **Conectar la app.** En `public/cloud.json`, junto a `googleClientId`, pon la dirección del servidor, sin barra
   al final, y publica la app. Si no la mantienes tú, pásale la dirección a quien la mantenga.

   ```json
   {
     "googleClientId": "1084216324372-0mrfdeckqcfu8p2t1tjsosdebs7g2tmb.apps.googleusercontent.com",
     "cloudflareUrl": "https://cenit-datos.<subdominio>.workers.dev"
   }
   ```

**Para dar de alta una clínica nueva,** desde la app, en **Ajustes** → **Proveedor** (con tu correo en
`OPERATOR_EMAILS`): escribe el correo de su responsable. También vale añadirlo a `ALLOWED_EMAILS`. Esa persona entra
en la app, pulsa **Crear la clínica** y desde **Ajustes** → **Equipo de la clínica** añade a su equipo. Quitar el
alta solo impide crear clínicas nuevas: las que ya existen siguen con su equipo.

**Panel del proveedor** (`OPERATOR_EMAILS`): la lista de clínicas con su equipo, el tamaño de su copia y su último
uso (nunca sus pacientes, que van cifrados), las altas, **suspender o reactivar** una clínica (suspendida, puede bajar
su copia pero no subir nada) y las **bajas**: quien administra una clínica puede borrarla desde la app tras
descargar su copia de seguridad y aceptar una declaración de que la conserva; queda 30 días en la papelera (se puede
recuperar desde la app o desde el panel) y después se borra para siempre. El panel también da el **borrador del
contrato de encargado del tratamiento**, que solo entrega el servidor a `OPERATOR_EMAILS` (para revisar con un
abogado).

**Al actualizar el servidor** (si cambia `worker.js` en la app), repite el paso 4 desde **Edit code**. Las
variables y el enlace se conservan. Si además cambia `schema.sql`, vuelve a ejecutarlo entero en la **Console**
de la base (paso 3): crea las tablas que falten y no borra nada. Así se pasó, en octubre de 2026, a la versión
con clínicas (tablas `clinics` y `members`), después a la sincronización por cambios (tablas `deltas` y
`delta_base`), a las solicitudes de acceso (`access_requests`) y a los formularios para el paciente
(`patient_forms`). Ejecuta el SQL **antes** de pegar el `worker.js`
nuevo. La consola junta en una línea lo que se pega: si dice «No SQL statements detected», pega solo las sentencias
`CREATE`, sin las líneas de comentario (las que empiezan por `--`).

## La app en Cloudflare Pages (para los enlaces de los pacientes)

La app se publica también en Cloudflare Pages, gratis, con un nombre de la clínica (`cenitfisiolab.pages.dev`): ahí
abren los pacientes los formularios que se les mandan, en vez de en la dirección de GitHub. Una vez:

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → elige el repositorio de la app (Cloudflare
   pide permiso en GitHub la primera vez).
2. Nombre del proyecto: `cenitfisiolab`. **Production branch**: `publicado-cloudflare` (la deja ahí el
   flujo de GitHub cuando pasan todas las pruebas). **Framework preset**: None. **Build command**:
   `npm run build`. **Build output directory**: `dist`. **Save and Deploy**.
3. En el proyecto, **Settings** → **Builds & deployments** → **Preview deployments**: **None** (así solo se
   publica lo probado).
4. En el Worker del servidor, añade la dirección nueva a `ALLOWED_ORIGINS` (separada por una coma):
   `https://cenitfisiolab.pages.dev`.
5. En `public/cloud.json`, `"formsUrl": "https://cenitfisiolab.pages.dev/"`: los enlaces de los formularios van ahí
   aunque se creen desde la app de siempre.

## Otra forma: con Wrangler (terminal)

Para quien prefiera la terminal. Necesita Node.js y se hace desde esta carpeta (`cloudflare/`). Todos los comandos
llevan `-c wrangler.toml`. Sin eso, Wrangler usaría el `wrangler.jsonc` de la carpeta de arriba, que es el de la
app, y publicaría la app en lugar del servidor.

```sh
cd cloudflare
npx wrangler login
npx wrangler d1 create cenit-datos --jurisdiction eu -c wrangler.toml
```

El último comando da un `database_id`; si pregunta si lo añade él a la configuración, responde que no. Pon el
`database_id` en `wrangler.toml` en lugar de `PEGA-AQUI-EL-ID-DE-TU-BASE`, y escribe en `ALLOWED_EMAILS` los
correos de los fisioterapeutas. Después:

```sh
npx wrangler d1 execute cenit-datos --remote --file schema.sql -c wrangler.toml
npx wrangler deploy -c wrangler.toml
```

Termina con la comprobación y la conexión de la app (pasos 8 y 9 de arriba). Con Wrangler, las variables de
`wrangler.toml` sustituyen a las del panel en cada `deploy`. Elige un camino, el panel o Wrangler, y mantén las
variables solo en ese.

## Límites del plan gratuito

En peticiones y espacio, para una clínica sobra:

- **Workers:** 100 000 peticiones al día. Cada dispositivo con la app abierta hace una o dos por minuto (unas
  1 200 al día en una jornada de 10 horas): unos 80 dispositivos a la vez antes de llegar al límite.
- **D1:** 5 GB en total (cada base, hasta 500 MB) y unos límites diarios de filas leídas y escritas. Cada copia
  se guarda en trozos de 1 MB, así que una copia de unos MB son pocas filas. Con la sincronización por cambios,
  cada guardado es un lote pequeño (una fila), y de vez en cuando se sube una copia entera que deja borrar los
  lotes anteriores.
- **Cada copia,** como mucho 50 MB.
- **Sin tarjeta:** Workers y D1 no la piden. Por eso no se usa R2 (el almacén de archivos de Cloudflare), que sí
  pide una tarjeta aunque no se pague nada.

Si un día se pasa de algún límite, el servidor da error hasta el día siguiente. No se pierde nada: la app sigue
funcionando en el dispositivo y sube la copia cuando puede.

### Cuántas clínicas caben

Medido con la app de verdad (prueba `e2e/capacidad.spec.ts`, 24-10-2026): con la pantalla abierta y sin tocar
nada, cada dispositivo hace **1,9 peticiones por minuto** (mirar si hay cambios y mirar si hay formularios
respondidos). Cada cosa que se guarda añade una más. Con la pantalla apagada o la app cerrada, ninguna.

| Uso | Peticiones al día por dispositivo | Dispositivos con el plan gratuito |
| --- | --- | --- |
| Abierta 10 horas seguidas, uso normal | unas 1.300 | unos 75 |
| Abierta 5 horas en total (lo habitual en una clínica) | unas 650 | unos 150 |

Es decir, con el plan gratuito caben unas **25 clínicas pequeñas de 3 dispositivos** en un mismo servidor, o cada
clínica monta el suyo (es gratis y no comparte nada con las demás). Si se pasa de ahí, el plan de pago de Workers
(unos 5 $ al mes) da 10 millones de peticiones al mes. La prueba avisa si algún cambio de la app sube de 3 por
minuto.

**Tiempo de proceso.** El plan gratuito da a cada petición 10 ms de CPU. Cuando ya se guarde una copia de
verdad, mira en la página del Worker **Metrics** → **CPU time**. Si alguna vez salen errores 1102 (límite
superado), el plan de pago de Workers (Workers Paid, unos 5 $ al mes, con tarjeta) quita ese límite sin cambiar
nada más.

## Qué hay en esta carpeta

| Archivo | Qué es |
| --- | --- |
| `worker.js` | el servidor. JavaScript sin dependencias, para pegarlo tal cual en el panel |
| `schema.sql` | las tablas de la base: `clinics` y `members` (cada clínica y su equipo), `clinic_status` (suspendida o en la papelera, con la declaración de baja), `creators` (altas desde el panel), `recovery` (la clave cerrada con el código de recuperación), `heads` (la copia vigente de cada clínica), `parts` (sus trozos, en texto base64), `deltas` (los lotes de cambios cifrados, numerados), `delta_base` (hasta qué lote lleva la copia entera, y su época) `access_requests` (las solicitudes de acceso: quién pide dar de alta qué clínica) y `patient_forms` (los formularios para el paciente y sus respuestas, cifrados con la clave del enlace) |
| `wrangler.toml` | la configuración, solo para instalarlo con Wrangler (siempre con `-c wrangler.toml`) |
| `worker.test.ts`, `d1shim.ts` | las pruebas (`npx vitest run cloudflare`), con una base D1 simulada sobre SQLite |

## Para quien mantenga la app

Todas las rutas, salvo `/v1/salud` y las dos de `/v1/formularios/:fid` (las abre el paciente), piden
`Authorization: Bearer <token de acceso de Google>`. El token debe ser
del ID de cliente `GOOGLE_CLIENT_ID` y de un correo verificado. Lo que puede hacer cada cuenta depende de la ruta:
dar de alta clínicas, si su correo está en `ALLOWED_EMAILS`; usar una clínica, si es de su equipo (tabla
`members`, por correo en minúsculas). La copia de cada clínica va en `heads`/`parts` con `owner = "clinic:<id>"`.
Todas las respuestas llevan `Cache-Control: no-store`. Los errores son JSON `{ "error": "…" }` en español.

| Petición | Respuesta |
| --- | --- |
| `GET /v1/salud` | `200 { ok: true }`, sin sesión. Si falta algo de la instalación, `500 { ok: false, error }` |
| `GET /v1/yo` | `200 { email, canCreate, operator, clinics: [{ id, name, role, suspended? }], deleted: [{ id, name, deletedAt, purgeAfter }] }`: las clínicas de quien entra, las que borró y aún puede recuperar, si puede dar de alta otra y si gestiona el servidor |
| `POST /v1/solicitud` + `{ clinic, note }` | `200 { clinic, status: "pending", createdAt }`: cualquier cuenta de Google pide permiso para dar de alta su clínica (una por correo; como mucho 200 pendientes, si no `429`). Si ya puede, `409`; si se le rechazó, `409` hasta que el proveedor la borre. `DELETE` la retira. `GET /v1/yo` dice `request` (la suya) y, al proveedor, `pendingRequests` |
| `POST /v1/proveedor/solicitudes/:correo` + `{ accept }` | acepta (pasa a `creators`) o rechaza; `DELETE` la borra (podrá volver a pedirlo). Solo `OPERATOR_EMAILS` |
| `POST /v1/clinicas` + `{ name }` | `201 { id, name, role: "admin" }`; solo `ALLOWED_EMAILS` (si no, `403`). Nombre de 1 a 80 caracteres |
| `PATCH /v1/clinicas/:id` + `{ name }` | `200 { id, name, role }`; solo administradores |
| `DELETE /v1/clinicas/:id` + `{ declaration }` | `200 { purgeAfter }`: la clínica va 30 días a la papelera con la declaración de quien la borra; solo administradores |
| `POST /v1/clinicas/:id/recuperar` | `200`: la saca de la papelera; solo administradores |
| `GET /v1/proveedor`, `PUT`/`DELETE /v1/proveedor/altas/:correo`, `POST /v1/proveedor/clinicas/:id/suspender` (`{ suspended }`) y `/recuperar`, `GET /v1/proveedor/contrato` | el panel del proveedor; solo `OPERATOR_EMAILS` |
| `GET /v1/clinicas/:id/miembros` | `200 { members: [{ email, role, addedAt }] }`; cualquiera del equipo |
| `PUT /v1/clinicas/:id/miembros/:correo` + `{ role }` | `200 { email, role, addedAt }`: añade o cambia el papel (`admin` o `member`); solo administradores. Como mucho 100 personas |
| `DELETE /v1/clinicas/:id/miembros/:correo` | `204`; un administrador quita a cualquiera, y cada uno puede quitarse a sí mismo |
| `GET`, `PUT /v1/clinicas/:id/recuperacion` | `{ blob, updatedAt }` / `{ blob }`: la clave de la copia cerrada con el código de recuperación de la clínica (sin el código no sirve); solo administradores |
| `GET`, `PUT`, `DELETE /v1/clinicas/:id/copia` y `GET /v1/clinicas/:id/copia/info` | la copia de la clínica, como las de abajo; borrarla, solo administradores |
| `GET /v1/clinicas/:id/copia/info?v=2` | además `{ epoch, base, last, deltas, deltaSize }`: la época de la copia (`null` si la clínica aún no va por cambios), hasta qué lote lleva la copia entera, el último lote y cuántos lotes hay después de la copia (y cuánto ocupan) |
| `PUT /v1/clinicas/:id/copia?v=2&seq=N` | la copia entera, que ya lleva los lotes hasta `N`: esos se borran. La primera vez pasa la clínica a los cambios (nueva época). Responde además `{ epoch, base }` |
| `POST /v1/clinicas/:id/copia/cambios?v=2` | un lote cifrado en base64 (como mucho 1 000 000 caracteres): `200 { seq }`. Sin copia por cambios aún, `409` |
| `GET /v1/clinicas/:id/copia/cambios?v=2&desde=N` | `200 { epoch, base, deltas: [{ seq, data }], more }`: los lotes después de `N`, por tandas de 100 (o 3 millones de caracteres). Si `N` es menor que `base`, sin lotes: hay que bajar la copia entera |
| las rutas de la copia sin `?v=2`, con la clínica ya por cambios | `426 { error }`: una versión anterior de la app tiene que actualizarse |
| `POST /v1/clinicas/:id/formularios` + `{ id, request, expiresAt }` | `201 { id }`: un formulario para el paciente, cifrado en el dispositivo con una clave que solo va en el enlace (`id` de 22 a 64 caracteres al azar; caduca en 30 días como mucho; 500 sin recoger por clínica). Cualquiera del equipo |
| `GET /v1/clinicas/:id/formularios` | `200 { forms: [{ id, response, answeredAt }] }`: los ya contestados (de 50 en 50). Cualquiera del equipo |
| `DELETE /v1/clinicas/:id/formularios/:fid` | `204`: recogido o anulado; se borra. Cualquiera del equipo |
| `GET /v1/formularios/:fid` | `200 { request, expiresAt, answered }`, **sin sesión**: lo abre el paciente con su enlace. Caducado, anulado o de una clínica borrada: `404` |
| `POST /v1/formularios/:fid/respuesta` + `{ response }` | `200`, **sin sesión**: las respuestas cifradas, una sola vez (después, `409`). Los que caducan sin responder se borran; las respuestas que nadie recoge, a los 60 días |

Las rutas de la copia (aquí con `/v1/copia`, la copia personal de versiones anteriores de la app, solo para
`ALLOWED_EMAILS`; con clínica, igual bajo `/v1/clinicas/:id`):

| Petición | Respuesta |
| --- | --- |
| `GET /v1/copia/info` | `200 { version, size, updatedAt }`, con `size` en bytes aproximados (`Math.floor(caracteres * 3 / 4)`); sin copia, `200 { version: null, size: 0, updatedAt: null }` |
| `GET /v1/copia` | `200` con la copia en base64 (`text/plain; charset=utf-8`) y `ETag: "<version>"`; sin copia, `404` |
| `PUT /v1/copia` + `If-None-Match: *` | crea la copia (cuerpo: la copia cifrada en base64 estándar, con relleno, y `Content-Type: text/plain`): `200 { version, size, updatedAt }` y `ETag`. Si ya hay una, `412 { error, version }` |
| `PUT /v1/copia` + `If-Match: <version>` | la sustituye (con comillas o sin ellas). Si la versión no es la vigente, `412 { error, version }` con la vigente, o `null` si no hay |
| `DELETE /v1/copia` | `204`, también si no había copia |

Más respuestas de error:

- `401`: falta la sesión o no es válida.
- `400`: un nombre, correo o papel que no vale, o un cuerpo que no es JSON.
- `403`: la cuenta no es del equipo de esa clínica (también si la clínica no existe), no la administra, no está
  en `ALLOWED_EMAILS` para dar de alta clínicas, o la consulta previa de CORS (`OPTIONS`) viene de un origen que no
  está en `ALLOWED_ORIGINS`.
- `409`: se quitaría o bajaría de papel al último administrador de la clínica, o el equipo ya tiene 100 personas.
- `413`: la copia pasa de 50 MB: más de 69 905 068 caracteres de base64.
- `415`: la copia no empieza por `Q0VOSVRFTkMx` (`CENITENC1` en base64), es decir, no está cifrada.
- `428`: un `PUT` sin `If-Match` ni `If-None-Match: *`.
- `503`: Google no responde, o la copia está cambiando justo en ese momento. Hay que reintentar.

La copia va y vuelve en base64 y se guarda así, en trozos de 1 000 000 caracteres: el servidor nunca convierte
bytes, que en D1 gasta mucho tiempo de proceso. Cada copia se escribe en trozos con una versión nueva. Solo al
final pasa a ser la vigente, y siempre con la condición de versión: nunca se pisa lo que subió otro dispositivo.
Una subida perdedora borra sus trozos. CORS: solo los orígenes de `ALLOWED_ORIGINS`, que pueden leer la cabecera
`ETag`.
