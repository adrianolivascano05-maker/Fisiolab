# Recuperar la clínica

Qué hacer cuando se pierde la contraseña de la clínica, un dispositivo o la cuenta de Google de quien la administra.
Procedimiento para quien administra la clínica (y para quien lleva el servidor). Es un procedimiento operativo: no
sustituye la valoración legal (registro de actividades de tratamiento y evaluación de impacto) ni a su delegado de
protección de datos.

## Cómo está montado (en pocas palabras)

- La copia de la clínica en el servidor va **cifrada con la contraseña de la clínica**. El servidor (Cloudflare) no
  puede leerla, ni quien lo gestiona.
- Cada dispositivo guarda la clave de esa contraseña sin exportar. Con la contraseña, cualquier dispositivo del
  equipo abre la copia.
- Quien administra tiene además un **código de recuperación** (el «kit de recuperación» que la app enseña al poner o
  cambiar la contraseña). Con él se abre la copia **aunque se haya perdido la contraseña y todos los dispositivos**.
  En el servidor solo está la clave cerrada con ese código: sin el código no sirve de nada.
- La sincronización es un espejo: lo que se borra en un dispositivo se borra en todos y en el servidor. Por eso la app
  recuerda cada semana **Descargar todo** (Ajustes → Copias y exportar), que puede ir cifrado con contraseña.

## Reglas de siempre (antes de que pase nada)

1. **Dos administradores** como mínimo. El servidor no deja quitar al último, pero si su cuenta de Google se pierde,
   hace falta otro.
2. El **kit de recuperación impreso**: uno en la caja fuerte de la clínica y otro fuera de ella (notaría, gestoría,
   domicilio de quien administra). Nunca en el correo ni en un mensaje.
3. Cada **6 meses, prueba de recuperación**: en un navegador limpio (ventana privada), entrar con la cuenta de quien
   administra, elegir la clínica, pulsar «He olvidado la contraseña» y escribir el código. Basta con llegar a ver los
   pacientes; después, cerrar la ventana privada. No toca los datos.
4. Al **cambiar la contraseña** (también al quitar a alguien del equipo: la app lo pide en «Termina de cerrarle el
   acceso»), guardar el código **nuevo** y destruir el viejo: el viejo deja de valer.
5. Cada semana, **Descargar todo** cifrado con contraseña y guardarlo fuera de los dispositivos de la clínica. Apuntar
   esa contraseña en el mismo sitio que el kit.

## Si se pierde…

### …la contraseña de la clínica (pero hay dispositivos que siguen abiertos)

Quien administra, en un dispositivo que siga abierto: Ajustes → Cuenta → **Cambiar la contraseña**. La copia se
vuelve a cifrar con la nueva, sale un kit nuevo (guardarlo, destruir el viejo) y a todo el equipo se le pide la nueva
una vez en cada dispositivo. Dársela en persona.

### …la contraseña y todos los dispositivos (queda el código)

1. En un dispositivo nuevo, entrar con la cuenta de Google de quien administra y elegir la clínica.
2. En el aviso de la copia cifrada, **He olvidado la contraseña** → escribir el código de recuperación del kit.
3. La app abre la copia y pide **una contraseña nueva**: sale un kit nuevo. Guardarlo y destruir el viejo.
4. El resto del equipo escribe la contraseña nueva en sus dispositivos.

### …la contraseña, los dispositivos y el código

Los datos del servidor **no se pueden abrir**: es a propósito (nadie, tampoco el servidor, puede leerlos sin la
contraseña o el código). Queda la última exportación descargada («Descargar todo»): Ajustes → Copias y exportar →
Restaurar una copia (el `.sqlite3` que va dentro del `.zip`; si la exportación iba cifrada, antes «Abrir una copia
cifrada»). Lo apuntado después de esa exportación se ha perdido. Por eso las reglas 2, 3 y 5.

### …la cuenta de Google de quien administra

- Si hay **otro administrador**: entra, quita la cuenta perdida del equipo (Ajustes → Equipo), añade la cuenta nueva
  como administradora y cambia la contraseña de la clínica («Termina de cerrarle el acceso»).
- Si **no hay otro administrador**: hoy el panel del proveedor (quien lleva el servidor) **no puede nombrar un
  administrador nuevo**: solo da de alta clínicas, las suspende, las recupera de la papelera y ve el contrato y las
  peticiones de acceso (`cloudflare/src/provider.js`). Es una carencia conocida, apuntada en `docs/ideas-pendientes.md`
  (parte 7); mientras tanto, la regla 1 (dos administradores) es la única cobertura.

### …un dispositivo (robo o pérdida)

1. Quien administra cambia la contraseña de la clínica (Ajustes → Cuenta → Cambiar la contraseña): el dispositivo
   perdido no podrá abrir nada nuevo del servidor.
2. Si era de alguien que sale del equipo, quitarlo del equipo: la próxima vez que ese dispositivo se conecte, la app
   borra los datos de la clínica. Si pasan más días que los que marca la clínica (Ajustes → Equipo: 3, 7 o 14) sin
   conectarse, la app no enseña nada hasta comprobarlo.
3. Límite real: nada puede borrar un dispositivo que no se vuelve a encender o conectar. Lo que protege ahí es el
   bloqueo del propio dispositivo (que cifra su memoria) y el PIN de la app. Dejarlo apuntado como riesgo residual en
   la evaluación de impacto. Los archivos de pacientes (PDF, fotos) llevan cada uno su propia clave: cambiar la
   contraseña de la clínica no los vuelve a cifrar; quien los tenía bajados los conserva.

## Qué queda registrado

- **Registro de accesos** (Ajustes → Equipo → Registro de accesos): quién abrió qué ficha, la exportó o imprimió su
  historia, una anotación por persona, paciente, acción y día. Solo se añade; se borra solo lo de más de 2 años
  (plazo por defecto, a confirmar con el delegado de protección de datos). Es un registro de buena fe: quien sepa
  tocar su navegador podría alterar su base antes de sincronizar.
- **Editado por**: en cada ficha, quién la cambió por última vez.
- **Cambios sustituidos** (Ajustes): lo que perdió al juntarse dos cambios, durante tres meses.
