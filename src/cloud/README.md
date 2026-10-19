# Cuenta de Google y copia en Google Drive

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

1. Entra en <https://console.cloud.google.com/> con la cuenta de Google de la clínica (o la tuya).
2. Arriba, en el selector de proyectos: **Proyecto nuevo** → nombre `Cenit Fisiolab` → **Crear**. Comprueba que
   queda elegido.
3. **APIs y servicios → Biblioteca** → busca **Google Drive API** → **Habilitar**.
4. **APIs y servicios → Pantalla de consentimiento de OAuth** (o **Google Auth Platform**) → **Empezar**:
   - Nombre de la aplicación: `Cénit · Fisiolab`; correo de asistencia: el tuyo.
   - Público: **Externo**.
   - Datos de contacto: tu correo. Acepta las condiciones y **Crear**.
5. **Acceso a datos** → **Añadir o quitar permisos** → marca `.../auth/drive.appdata` («Ver, crear y eliminar
   sus propios datos de configuración en Google Drive»). Los de nombre y correo (`openid`, `userinfo.email`,
   `userinfo.profile`) no hace falta añadirlos. **Guardar**.
6. **Público** → **Publicar aplicación**. Todos estos permisos son de los que Google llama «no sensibles», así que
   no debería pedir verificación. Si la pide, o si al entrar sale el aviso «Google no ha verificado esta
   aplicación», deja la app **en pruebas**. Añade en **Usuarios de prueba** el correo de cada fisioterapeuta
   (hasta 100). Solo podrán entrar esas cuentas, y Google pedirá volver a aceptar los permisos de vez en cuando.
7. **Clientes** → **Crear cliente**:
   - Tipo de aplicación: **Aplicación web**; nombre: `Cénit web`.
   - **Orígenes de JavaScript autorizados**: `https://adrianolivascano05-maker.github.io`
   - **URIs de redireccionamiento autorizados**: `https://adrianolivascano05-maker.github.io/Fisiolab/` (con la
     barra del final).
   - Para probar en el ordenador con `npm run dev`, añade también `http://localhost:5173` y
     `http://localhost:5173/`.
   - **Crear**. Copia el **ID de cliente**, que termina en `.apps.googleusercontent.com`. El «secreto del cliente»
     no hace falta: no lo uses ni lo compartas.
8. Pon el ID en `public/cloud.json` (o pásaselo a quien mantenga la app) y publica:

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
| `auth.ts` | entrar con Google con redirección (OAuth 2.0 para apps web de cliente). Google vuelve con un token de una hora que solo sirve para la carpeta de la app en Drive y para el nombre y el correo |
| `account.ts` | la cuenta que ha entrado en el dispositivo. Cada cuenta tiene su base (`fisiolab-u<id>.sqlite3`) |
| `drive.ts` | la copia en Drive: listar, bajar, subir y borrar, con la API REST v3 |
| `sync.ts` | cuándo sincronizar: al abrir, cada 5 minutos con la app a la vista, 5 segundos después del último cambio y al salir de la app |
| `AccountPages.tsx` | la tarjeta de la cuenta en la pantalla principal y la pantalla para pegar el ID de cliente en el dispositivo |
| `CloudGate.tsx` | pantallas de entrada (y de pasar a la cuenta los datos que había sin cuenta), aviso de sincronización y la sección «Cuenta» de Ajustes |
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
- **Una tabla nueva** en una migración necesita sus tres disparadores (como en la 008) y su línea en `SYNC_TABLES`
  de `syncMerge.ts`. `src/data/sync.test.ts` falla si falta alguno.

## Privacidad

Son datos de salud. La copia vive en el Google Drive de cada fisioterapeuta, y Google la trata según las
condiciones de esa cuenta. No está cifrada aparte: la protege la cuenta de Google, así que conviene activar la
verificación en dos pasos. La clínica debe revisar con su delegado de protección de datos si las cuentas
personales de Google son adecuadas, o si conviene usar cuentas de Google Workspace de la clínica, que tienen
contrato de encargado del tratamiento.
