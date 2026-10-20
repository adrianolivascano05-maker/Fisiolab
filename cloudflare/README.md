# Servidor de datos de la clínica en Cloudflare

Es otra forma de guardar en la nube la copia de los pacientes. En lugar de ir al Google Drive de cada
fisioterapeuta, va a un servidor pequeño de la clínica en Cloudflare. Se monta una vez, con el plan gratuito y
sin programar.

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
- **Qué más ve Cloudflare:** el tamaño y la fecha de cada copia y el número de cuenta de Google de quien la sube
  (no el correo). No guarda los tokens de Google, y los registros de peticiones se dejan desactivados (paso 7).
- **Contrato de encargado del tratamiento (DPA).** El de Cloudflare forma parte de sus condiciones de autoservicio:
  se acepta al crear la cuenta. Conviene descargar la versión vigente
  (<https://www.cloudflare.com/cloudflare-customer-dpa/>; si la página cambia, busca «Cloudflare Customer DPA»),
  guardarla con la documentación de protección de datos de la clínica y comprobar con vuestro delegado de
  protección de datos que encaja con lo que necesitáis. Esta guía no es asesoramiento legal ni garantiza que el
  montaje cumpla la normativa: eso lo decide la clínica con su delegado.
- **Quién puede usarlo:** solo los correos de Google que pongas en la lista `ALLOWED_EMAILS`. Cada cuenta ve solo
  su copia.

## Antes de empezar

Ten a mano:

- El **ID de cliente de Google** de la app. Es el `googleClientId` de `public/cloud.json` (ahora,
  `1084216324372-0mrfdeckqcfu8p2t1tjsosdebs7g2tmb.apps.googleusercontent.com`).
- Los **correos de Google** de los fisioterapeutas que van a usar la app.
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
   | `ALLOWED_EMAILS` | los correos de los fisioterapeutas, separados por comas: `ana@gmail.com, luis@gmail.com` |
   | `ALLOWED_ORIGINS` | `https://adrianolivascano05-maker.github.io` (para probar con `npm run dev`, añade `,http://localhost:5173`) |

   En `ALLOWED_ORIGINS` va solo el principio de la dirección, sin `/Fisiolab/`. Pulsa **Deploy**. Si
   `ALLOWED_EMAILS` se queda vacía, no puede entrar nadie.
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

**Para añadir o quitar a alguien,** cambia `ALLOWED_EMAILS` (**Settings** → **Variables and Secrets**) y pulsa
**Deploy**. Quitar un correo impide entrar, pero no borra la copia que esa persona tuviera.

**Al actualizar el servidor** (si cambia `worker.js` en la app), repite el paso 4 desde **Edit code**. Las
variables y el enlace se conservan.

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

- **Workers:** 100 000 peticiones al día. Cada dispositivo con la app abierta hace unas pocas cada 5 minutos.
- **D1:** 5 GB en total (cada base, hasta 500 MB) y unos límites diarios de filas leídas y escritas. Cada copia
  se guarda en trozos de 1 MB, así que una copia de unos MB son pocas filas.
- **Cada copia,** como mucho 50 MB.
- **Sin tarjeta:** Workers y D1 no la piden. Por eso no se usa R2 (el almacén de archivos de Cloudflare), que sí
  pide una tarjeta aunque no se pague nada.

Si un día se pasa de algún límite, el servidor da error hasta el día siguiente. No se pierde nada: la app sigue
funcionando en el dispositivo y sube la copia cuando puede.

**Tiempo de proceso.** El plan gratuito da a cada petición 10 ms de CPU. Cuando ya se guarde una copia de
verdad, mira en la página del Worker **Metrics** → **CPU time**. Si alguna vez salen errores 1102 (límite
superado), el plan de pago de Workers (Workers Paid, unos 5 $ al mes, con tarjeta) quita ese límite sin cambiar
nada más.

## Qué hay en esta carpeta

| Archivo | Qué es |
| --- | --- |
| `worker.js` | el servidor. JavaScript sin dependencias, para pegarlo tal cual en el panel |
| `schema.sql` | las dos tablas de la base: `heads` (la copia vigente de cada cuenta) y `parts` (sus trozos, en texto base64) |
| `wrangler.toml` | la configuración, solo para instalarlo con Wrangler (siempre con `-c wrangler.toml`) |
| `worker.test.ts`, `d1shim.ts` | las pruebas (`npx vitest run cloudflare`), con una base D1 simulada sobre SQLite |

## Para quien mantenga la app

Todas las rutas, salvo `/v1/salud`, piden `Authorization: Bearer <token de acceso de Google>`. El token debe ser
del ID de cliente `GOOGLE_CLIENT_ID` y de un correo verificado que esté en `ALLOWED_EMAILS`. La copia de cada
cuenta va por su `sub` de Google. Todas las respuestas llevan `Cache-Control: no-store`. Los errores son JSON
`{ "error": "…" }` en español.

| Petición | Respuesta |
| --- | --- |
| `GET /v1/salud` | `200 { ok: true }`, sin sesión. Si falta algo de la instalación, `500 { ok: false, error }` |
| `GET /v1/copia/info` | `200 { version, size, updatedAt }`, con `size` en bytes aproximados (`Math.floor(caracteres * 3 / 4)`); sin copia, `200 { version: null, size: 0, updatedAt: null }` |
| `GET /v1/copia` | `200` con la copia en base64 (`text/plain; charset=utf-8`) y `ETag: "<version>"`; sin copia, `404` |
| `PUT /v1/copia` + `If-None-Match: *` | crea la copia (cuerpo: la copia cifrada en base64 estándar, con relleno, y `Content-Type: text/plain`): `200 { version, size, updatedAt }` y `ETag`. Si ya hay una, `412 { error, version }` |
| `PUT /v1/copia` + `If-Match: <version>` | la sustituye (con comillas o sin ellas). Si la versión no es la vigente, `412 { error, version }` con la vigente, o `null` si no hay |
| `DELETE /v1/copia` | `204`, también si no había copia |

Más respuestas de error:

- `401`: falta la sesión o no es válida.
- `403`: el correo no está en la lista, o la consulta previa de CORS (`OPTIONS`) viene de un origen que no está
  en `ALLOWED_ORIGINS`.
- `413`: la copia pasa de 50 MB: más de 69 905 068 caracteres de base64.
- `415`: la copia no empieza por `Q0VOSVRFTkMx` (`CENITENC1` en base64), es decir, no está cifrada.
- `428`: un `PUT` sin `If-Match` ni `If-None-Match: *`.
- `503`: Google no responde, o la copia está cambiando justo en ese momento. Hay que reintentar.

La copia va y vuelve en base64 y se guarda así, en trozos de 1 000 000 caracteres: el servidor nunca convierte
bytes, que en D1 gasta mucho tiempo de proceso. Cada copia se escribe en trozos con una versión nueva. Solo al
final pasa a ser la vigente, y siempre con la condición de versión: nunca se pisa lo que subió otro dispositivo.
Una subida perdedora borra sus trozos. CORS: solo los orígenes de `ALLOWED_ORIGINS`, que pueden leer la cabecera
`ETag`.
