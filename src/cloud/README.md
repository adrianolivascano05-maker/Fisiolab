# Cuenta de Google y copia en Google Drive (o en el servidor de la clínica en Cloudflare)

> **Alternativa recomendada para historias clínicas: el servidor de la clínica en Cloudflare** (plan gratuito,
> base de datos en la Unión Europea, contrato de encargado del tratamiento incluido en sus condiciones y solo copias
> cifradas). Se monta una vez siguiendo `cloudflare/README.md` y se activa poniendo su dirección en
> `public/cloud.json` (`"cloudflareUrl"`). Con él, Google queda solo para entrar: la copia de los pacientes ya no
> va a Drive. Ver «Servidor de la clínica en Cloudflare» al final.

Con la nube activada, cada fisioterapeuta entra en la app con su cuenta de Google. Sus pacientes se guardan en el
dispositivo, que funciona sin conexión, y en **su** Google Drive, dentro de la carpeta oculta de la app
(`appDataFolder`). Esa carpeta solo la ve esta app. Así tiene sus pacientes en cualquier móvil u ordenador donde
entre con su cuenta. Los compañeros entran con sus cuentas y no ven los pacientes de los demás, aunque usen el
mismo dispositivo.

No hay servidor propio ni nada de pago: el dispositivo habla directamente con Google. Solo hace falta crear una vez
un **ID de cliente** gratuito en Google Cloud. Ese ID no es secreto: va dentro de la app, como en cualquier web
que permite entrar con Google.

## Activarla: crear el ID de cliente (una vez, unos 10 minutos)

Los nombres de los menús son los de la consola de Google en octubre de 2026; si alguno cambia, el orden es el mismo.

1. Abre <https://console.cloud.google.com/flows/enableapi?apiid=drive.googleapis.com> con la cuenta de Google de
   la clínica (o la tuya). En el mismo paso se crea el proyecto (nombre `Cenit Fisiolab`) y se activa la Google
   Drive API. Comprueba arriba que queda elegido ese proyecto.
2. <https://console.cloud.google.com/auth/branding> (**Google Auth Platform**) → **Empezar**:
   - Nombre de la aplicación: `Cénit · Fisiolab`; correo de asistencia: el tuyo.
   - Público: **Externo**.
   - Datos de contacto: tu correo. Acepta las condiciones y **Crear**.
3. <https://console.cloud.google.com/auth/scopes> (**Acceso a datos**) → **Añadir o quitar permisos** → marca `.../auth/drive.appdata` («Ver, crear y eliminar
   sus propios datos de configuración en Google Drive»). Los de nombre y correo (`openid`, `userinfo.email`,
   `userinfo.profile`) no hace falta añadirlos. **Guardar**.
4. **Público** → **Publicar aplicación**. Todos estos permisos son de los que Google llama «no sensibles», así que
   no debería pedir verificación. Si la pide, o si al entrar sale el aviso «Google no ha verificado esta
   aplicación», deja la app **en pruebas**. Añade en **Usuarios de prueba** el correo de cada fisioterapeuta
   (hasta 100). Solo podrán entrar esas cuentas, y Google pedirá volver a aceptar los permisos de vez en cuando.
5. **Clientes** → **Crear cliente**:
   - Tipo de aplicación: **Aplicación web**; nombre: `Cénit web`.
   - **Orígenes de JavaScript autorizados**: `https://adrianolivascano05-maker.github.io`
   - **URIs de redireccionamiento autorizados**: `https://adrianolivascano05-maker.github.io/Fisiolab/` (con la
     barra del final).
   - Para probar en el ordenador con `npm run dev`, añade también `http://localhost:5173` y
     `http://localhost:5173/`.
   - **Crear**. Copia el **ID de cliente**, que termina en `.apps.googleusercontent.com`. El «secreto del cliente»
     no hace falta: no lo uses ni lo compartas.
6. Pon el ID en `public/cloud.json` (o pásaselo a quien mantenga la app) y publica:

   ```json
   { "googleClientId": "1234567890-abc123.apps.googleusercontent.com" }
   ```

**Sin tocar el código:** en la pantalla principal, «Iniciar sesión con Google» lleva a una pantalla con estos pasos
(y el origen y la redirección listos para copiar) donde se pega el ID. Pegado ahí vale solo para ese dispositivo:
para que valga en todos los de la clínica, va en `public/cloud.json`, que tiene preferencia.

Para desactivarla, deja `googleClientId` vacío. La app vuelve a funcionar solo en el dispositivo, con los datos
de la última cuenta que entró en él.

## Cómo funciona

| Archivo | Qué hace |
| --- | --- |
| `config.ts` | lee `public/cloud.json` al abrir la app (sin conexión, la última que leyó); si no trae ID, el pegado en el dispositivo |
| `auth.ts` | entrar con Google con redirección (OAuth 2.0 para apps web de cliente). Google vuelve con un token de una hora que solo sirve para el nombre y el correo, la carpeta oculta de la app en Drive, los archivos que crea la app y su calendario |
| `account.ts` | la cuenta que ha entrado en el dispositivo. Cada cuenta tiene su base (`fisiolab-u<id>.sqlite3`) |
| `clinic.ts`, `TeamPage.tsx` | con el servidor de Cloudflare: la clínica en la que se trabaja (su base, `fisiolab-u<id>-c<clínica>.sqlite3`), lo que se pide al servidor sobre clínicas y equipo, y la pantalla Ajustes → Equipo de la clínica |
| `drive.ts` | la copia en Drive: listar, bajar, subir y borrar, con la API REST v3 |
| `remote.ts` | dónde vive la copia: Drive o el servidor de Cloudflare, con la misma interfaz para `sync.ts` |
| `sync.ts` | cuándo sincronizar: al abrir, cada 5 minutos con la app a la vista, 5 segundos después del último cambio y al salir de la app |
| `AccountPages.tsx` | la tarjeta de la cuenta en la pantalla principal y la pantalla para pegar el ID de cliente en el dispositivo |
| `googleCalendar.ts`, `CalendarSettings.tsx` | las citas solas en Google Calendar, en el calendario «Cénit · Citas» que crea la app |
| `saveToDrive.ts`, `DriveSaveButton.tsx` | guardar el informe en PDF y los resultados en CSV en la carpeta «Cénit · Fisiolab» de Drive |
| `crypt.ts`, `EncryptionParts.tsx` | cifrado obligatorio de la copia con una contraseña, y pedirla en otro dispositivo |
| `CloudGate.tsx` | pantallas de entrada (de pasar a la cuenta los datos que había sin cuenta y, con el servidor, de elegir o dar de alta la clínica), aviso de sincronización y la sección «Cuenta» de Ajustes |
| `../data/migrations/008_sync.sql`, `../data/syncMerge.ts` | registro de cambios por fila y fusión de dos copias |

- **Al abrir la app**, si el token ha caducado, la app va a Google y vuelve sola en un segundo, si la sesión de
  Google sigue abierta en el navegador. Si no, pide «Continuar con Google» o deja seguir sin conexión.
- **A mitad de uso**, el token caduca a la hora. Si hay cambios sin subir, sale un aviso con «Entrar con Google».
  No se va a Google sin pulsar, para no perder lo que se esté escribiendo.
- **Juntar copias.** Cada alta, cambio o borrado de una fila deja su hora en `sync_changes`, mediante los
  disparadores de la migración 008. Al juntar la copia del dispositivo con la de Drive gana, fila a fila, el
  cambio más reciente, también si es un borrado. Si la nube ha cambiado, primero se baja y se junta, y luego se
  sube. Nunca se pisa sin más lo que subió otro dispositivo.
- **Límites:**
  - Se compara la fila entera. Si en dos dispositivos se cambian, sin sincronizar entre medias, dos campos
    distintos del mismo paciente, se queda la versión del cambio más reciente.
  - La hora es la del reloj de cada dispositivo.
  - Drive no deja condicionar la subida a la versión anterior. Si dos dispositivos suben a la vez, el que pierde
    conserva sus cambios en su base y los vuelve a subir, ya juntos, en la siguiente sincronización.
- **Se quedan en cada dispositivo:**
  - la comprobación del sensor (`sensor_check`) y la fecha de la última copia en archivo (`last_backup_at`);
  - los vídeos, que la app nunca guarda.
- **Restaurar una copia en archivo** con la nube activada no sustituye la copia de Drive: se junta con ella,
  como si viniera de otro dispositivo, y en cada fila gana el cambio más reciente.
- **Copias de más de 4,5 MB** se suben con la subida reanudable de Drive. Las pruebas usan un Google simulado
  (`e2e/fakeGoogle.ts`) y no llegan a ese tamaño.
- **Permisos de Google.** Además del nombre, el correo y la carpeta oculta (`drive.appdata`), la app pide
  `drive.file` (solo los archivos que crea ella) y `calendar.app.created` (solo el calendario que crea ella). Los
  tres son «no sensibles». Si alguien no acepta uno, lo demás funciona y la app dice qué falta y cómo darlo.
- **Citas en Google Calendar.** Al acabar cada sincronización, cada cita pendiente que aún no ha llegado (la agenda,
  `../data/appointments.ts`) se pone en el calendario «Cénit · Citas». El id del evento sale del de
  la cita (`cenit` + su id; la que se da al guardar una sesión lleva el id de la sesión, como antes de la agenda),
  así que dos dispositivos dejan un solo evento. Una cita cambiada se mueve; una que ya no está pendiente (atendida,
  no vino, anulada, borrada, o su paciente borrado) se quita. Las citas pasadas o empezadas no se
  tocan. Si nada ha cambiado, no se pregunta a Google hasta media hora después. En Ajustes → Cuenta de Google → Google Calendar se
  desactiva o se elige si sale el nombre del paciente o solo sus iniciales (por defecto, las iniciales). Con esto activado, al guardar una sesión ya no
  se ofrece el enlace de Google Calendar ni el .ics.
- **Informe y resultados en Drive.** «Guardar en mi Drive (PDF)» en el informe y «Guardar los resultados en mi
  Drive (CSV)» en Ajustes los suben a la carpeta «Cénit · Fisiolab» de «Mi unidad», que la app crea la primera vez
  (su id va en el ajuste sincronizado `drive_folder_id`). El PDF es el informe dibujado tal como se ve, una imagen
  por página A4 (`../clinical/reportPdf.ts` con html-to-image, y `../app/pdf.ts`): el texto no se puede
  seleccionar. Estos archivos no se cifran aunque la copia sí lo esté.
- **Copia siempre cifrada (en Drive y en Cloudflare).** La primera vez la app pide una contraseña de cifrado
  («needs-password», Ajustes → Cuenta de Google → Cifrado de la copia) y no sube nada hasta tenerla; no se puede
  dejar de cifrar. La base se comprime (gzip) y se cifra en el dispositivo antes de subirla, con AES-GCM de 256 bits
  y una clave sacada de la contraseña con PBKDF2-SHA-256 (600 000 vueltas). En la nube solo hay bytes ilegibles sin
  la contraseña. El archivo empieza por `CENITENC1`, seguido de la sal y el vector de inicio. La sal va también en el
  ajuste sincronizado `drive_encryption`: así todos los dispositivos de la cuenta saben con qué se cifró. Una copia
  antigua sin cifrar se sigue pudiendo bajar y juntar; la siguiente subida ya va cifrada.
  - Cada dispositivo guarda la clave, no la contraseña, en IndexedDB y marcada como no exportable: la app la usa,
    pero no se puede leer ni copiar (las versiones anteriores la tenían en `localStorage`; se pasa sola).
  - Un dispositivo sin la clave no baja ni sube nada: pide la contraseña («needs-key») y la comprueba con la copia
    antes de guardarla.
  - Cambiar la contraseña en un dispositivo hace que los demás la pidan de nuevo.
  - Si se olvida la contraseña, se puede sustituir la copia de la nube por la del dispositivo, cifrada con una
    contraseña nueva.
  - Cerrar sesión borrando los datos del dispositivo borra también la clave.
- **Una tabla nueva** en una migración necesita sus tres disparadores (como en la 008) y su línea en `SYNC_TABLES`
  de `syncMerge.ts`. `src/data/sync.test.ts` falla si falta alguno.

## Privacidad

Son datos de salud. La copia vive en el Google Drive de cada fisioterapeuta, y Google la trata según las
condiciones de esa cuenta. Va cifrada con una contraseña que solo tiene la clínica (arriba); aun así conviene activar
la verificación en dos pasos. La clínica debe revisar con su delegado de protección de datos si las cuentas
personales de Google son adecuadas, o si conviene usar cuentas de Google Workspace de la clínica, que tienen
contrato de encargado del tratamiento. Para historias clínicas ese contrato hace falta (art. 28 del RGPD), y la
app lo recuerda en Ajustes → Clínica y protección de datos hasta que se marca que existe. Más en `../privacy/README.md`.

## Servidor de la clínica en Cloudflare

Con `"cloudflareUrl"` en `public/cloud.json` (el servidor de `cloudflare/`), la sincronización es la misma, pero:

- La copia va al servidor de la clínica (Cloudflare Workers + D1 con jurisdicción `eu`), no a Drive, y la app ya no
  pide el permiso de la carpeta oculta de Drive (`drive.appdata`).
- Como en Drive, solo se suben copias cifradas; además, el servidor rechaza lo que no empiece por `CENITENC1`.
- **Se trabaja en una clínica** (`clinic.ts`). La primera vez en cada dispositivo, la cuenta elige su clínica o,
  si su correo está en `ALLOWED_EMAILS`, la da de alta y queda como administradora. Quien la administra añade al
  equipo por correo en Ajustes → Equipo de la clínica. Con una sola clínica y nada que llevar a ella, se entra
  directo. Cada clínica tiene en el dispositivo su base, su clave de cifrado y su sincronización.
- **Una base y una copia por clínica, compartidas por el equipo.** La copia va cifrada con la contraseña de la
  clínica, que elige (y cambia) quien la administra y se da en persona al equipo: ni Cloudflare ni quien gestiona
  el servidor pueden leerla. Si alguien la olvida, no puede sustituir la copia de todos: se la pide a quien la
  administra.
- **Código de recuperación** (`recovery.ts`, `RecoveryParts.tsx`): al elegir o cambiar la contraseña de la clínica,
  quien la administra recibe un código (20 caracteres) y su kit en PDF para imprimir; la app se lo recuerda hasta que
  confirma que lo ha guardado (ajuste `recovery_saved`). En el servidor (`/recuperacion`) solo está la clave de la
  copia cerrada con el código. Si se olvida la contraseña y no queda ningún dispositivo con la clave, quien
  administra abre la copia con el código («He olvidado la contraseña») y elige otra contraseña.
- **«Editado por»** (`../data/editors.ts`, migración 016): cada cambio guarda el dispositivo que lo hizo y cada
  dispositivo de la clínica dice de quién es (tabla `devices`), así que la ficha y las citas muestran «Última
  modificación: Ana, hace 5 min». Guardar sin cambiar nada no cuenta (los disparadores de modificación solo apuntan
  el cambio si cambia alguna columna además de `updated_at`). Si llega de otro dispositivo un cambio que pisa algo
  guardado aquí hace menos de un cuarto de hora, el aviso de arriba lo dice («se ha quedado su versión»).
- **Lo de cada persona** (`../data/member.ts`): su Google Calendar, su carpeta de Drive y su nombre y nº de
  colegiado para firmar se guardan en la base de la clínica con su clave (`calendar_id@<sub>`…). Cada cita lleva
  quién la dio (`created_by`, migración 014) y a cada calendario solo van las suyas.
- **Llevar los pacientes de la cuenta a la clínica.** Si en el dispositivo hay pacientes de la cuenta, al entrar
  por primera vez en la clínica se pregunta si se llevan. El worker de SQLite abre la base nueva de la clínica y
  le junta la de la cuenta (`syncMerge.ts`, `prepareForClinic`): lo de la persona pasa a su nombre, la contraseña
  de la cuenta no se lleva y, en los demás ajustes, ganan los que ya tenga la clínica. La base de la cuenta no se
  toca.
- **Agenda y horario de la clínica** (`../schedule/`, `../data/schedule.ts`, migración 015): la pestaña «Agenda» es como
  Google Calendar (día, 3 días o semana, con la hora a la izquierda). Las citas se arrastran para cambiarlas de hora o
  de día (en el móvil, manteniéndolas pulsadas), con «Deshacer», y desde su hoja se mueven una hora, un día o una
  semana. Tocar un hueco da una cita (eligiendo el paciente). Sin clínica sirve igual, solo con tus citas. En una
  clínica, además, los turnos de cada persona y, en la vista de un día, una columna por persona: arrastrar una cita a
  otra columna se la pasa a esa persona. Quien administra pone los turnos de todos (y repite una semana en la
  siguiente); cada persona, los suyos. Cada cita es con alguien (`assigned_to`, «Con quién»); a cada Google Calendar
  solo van las suyas. El equipo está en la base (`staff`), con nombre y color. Con el servidor la app mira la nube
  cada minuto, y con la agenda a la vista lo nuevo se enseña solo.
- **Al quitar a alguien del equipo** el servidor deja de darle la copia y, la próxima vez que abre la app con
  conexión, se borran de su dispositivo los datos de la clínica.
- El servidor comprueba el token de Google de cada petición (que sea de esta app) y que la cuenta sea del equipo
  de la clínica. Al subir dice qué versión sustituye: si otro dispositivo subió entre medias, responde 412 y la app
  vuelve a bajar, juntar y subir.
- La CSP (`public/_headers`) deja conectar con `https://*.workers.dev`. Si el servidor va en un dominio propio, hay
  que añadirlo ahí.
- Las citas en Google Calendar y los informes en Drive siguen siendo opcionales: con Calendar, mejor la opción de
  solo iniciales.
- Pruebas: `e2e/clinics.spec.ts` con el servidor simulado de `e2e/fakeGoogle.ts`, `src/data/clinicMember.test.ts` y
  `cloudflare/worker.test.ts`.
