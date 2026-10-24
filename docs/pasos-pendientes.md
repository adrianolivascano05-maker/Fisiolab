# Pasos pendientes (los hace quien administra la app)

Cuatro tareas que no se pueden hacer desde el código porque son en las cuentas de Google y Cloudflare. Ninguna es
urgente: la app funciona igual mientras tanto. Los menús son los de octubre de 2026; si alguno cambia de nombre, el
orden es el mismo.

## 1. Google: sacar la app de «en pruebas» (unos 5 minutos)

Mientras el proyecto de Google está **en pruebas**, solo pueden entrar las cuentas de la lista de usuarios de prueba
y Google les vuelve a pedir permiso cada 7 días. En **producción** puede entrar cualquier cuenta (sin clínica no ve
nada: puede pedir el alta y tú la aceptas en Ajustes → Proveedor).

1. Abre <https://console.cloud.google.com/auth/audience> con la cuenta dueña del proyecto. Arriba, comprueba que
   el proyecto elegido es **Cenit Fisiolab**.
2. Antes de publicar, mira <https://console.cloud.google.com/auth/scopes> (**Acceso a datos**): solo debe haber
   permisos «no sensibles» (`openid`, correo, perfil, `drive.file` y, si se usa la copia en Drive,
   `drive.appdata`). Si hay alguno en «Permisos sensibles» o «restringidos», quítalo y **Guardar**: la app pide el
   del calendario solo a quien activa las citas en Google Calendar, no hace falta tenerlo ahí.
3. No subas un logotipo en **Marca** de momento: con logotipo, Google exige verificar la marca (dominio propio y
   política de privacidad publicada) antes de enseñarlo.
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

1. <https://console.cloud.google.com/auth/clients> → el cliente **Cénit web** → en **Orígenes de JavaScript
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

## 3. Cloudflare: volver a pegar `worker.js` (cuando quieras)

El servidor tiene un cambio pequeño: la limpieza de formularios caducados ahora solo la hace la clínica al buscar
respuestas, no cualquier petición anónima. Lo de ahora funciona; esto es para dejarlo más limpio.

1. <https://dash.cloudflare.com> → **Workers & Pages** → el servidor (`cenit-datos`) → **Edit code**.
2. Borra todo y pega el contenido de `cloudflare/worker.js` del repositorio. **Deploy**.
3. Comprueba en la app que «Buscar respuestas» de un formulario sigue funcionando.

## 4. Cloudflare: la reserva online (unos 10 minutos, antes de encenderla)

La reserva online necesita tres tablas nuevas en la base y el `worker.js` nuevo. Sin esto la app funciona igual,
pero al guardar en **Ajustes › Reserva online** saldrá un error.

1. <https://dash.cloudflare.com> → **Storage & Databases** → **D1** → la base (`cenit-datos`) → **Console**.
   Pega el contenido entero de `cloudflare/schema.sql` y ejecútalo. Crea las tablas que falten y no borra nada. Si
   dice «No SQL statements detected», pega solo las sentencias `CREATE` (sin las líneas que empiezan por `--`).
2. **Workers & Pages** → el servidor (`cenit-datos`) → **Edit code**. Borra todo, pega el contenido de
   `cloudflare/worker.js` del repositorio y **Deploy**.
3. Comprueba: abre la dirección del servidor terminada en `/v1/salud`. Debe decir que todo está bien (si faltan
   tablas, lo dice).
4. En la app: **Ajustes › Reserva online** → enciéndela, revisa la dirección, los tipos de cita y el horario →
   **Guardar**. Abre **Ver la página** en el móvil y haz una reserva de prueba con tus datos; en un par de minutos
   entra en la agenda. Anúlala con el enlace para comprobar que también funciona.
5. Revisa con tu asesoría el texto «Tus datos: quién los recibe y para qué» de la página de reservas (sale de los
   datos de **Ajustes › Clínica y protección de datos**): es un resumen informativo, no un texto legal revisado.
