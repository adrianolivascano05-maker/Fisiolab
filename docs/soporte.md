# Soporte y piloto: cómo abrir la app a otras clínicas sin que se nos caiga

Escrito el 24-10-2026. Qué hay ya, qué hacer cuando alguien escribe y cómo hacer el piloto. Nada de esto garantiza
que la app no falle: sirve para que falle menos, enterarse pronto y arreglarlo rápido.

## Lo que ya está hecho

- **Registro de fallos en cada dispositivo** (`src/app/errorLog.ts`). La app apunta los errores de las pantallas, de
  la sincronización y de Google Calendar, y los que nadie captura. Se guardan en el propio dispositivo, sin
  servicios externos. Si una pantalla falla, sale «Algo ha fallado en esta pantalla» con «Recargar» y «Enviar el
  informe», en vez de quedarse en blanco.
- **Ajustes › Algo no funciona** (`/ayuda/fallos`): problemas frecuentes con su solución y el **informe de fallo**
  (versión, navegador, pantalla, estado de la sincronización y los últimos errores). Sale por correo o se copia,
  solo si la persona lo decide. No lleva datos de pacientes y se puede leer antes de mandarlo.
- **Corrector de código** (oxlint, `.oxlintrc.json`, `npm run lint`) en la integración continua: un error para la
  publicación.
- **Pruebas en Safari (WebKit)** de las pantallas principales en la integración continua. De momento solo informan:
  no se pueden ejecutar en el entorno de desarrollo, así que no paran la publicación hasta ver que salen en verde.
- **Simulacro de pérdida del móvil** (`e2e/simulacro.spec.ts`): copia de seguridad, dispositivo vacío, restaurar y
  comparar seis pantallas. Pasa en cada publicación.
- **Presupuesto de peticiones al servidor** (`e2e/capacidad.spec.ts`): 1,9 por minuto por dispositivo; cuántas
  clínicas caben, en `cloudflare/README.md`.

## Cuando alguien escribe

1. Pedir el **informe de fallo** (Ajustes › Algo no funciona › Enviar por correo). Con eso se sabe la versión, el
   navegador y qué ha fallado.
2. Si es una duda de uso, contestar y, si se repite, añadirla a los problemas frecuentes (`src/pages/ReportProblemPage.tsx`).
3. Si es un fallo: reproducirlo con datos inventados, escribir una prueba que lo reproduzca, arreglarlo y publicar.
   Contestar con la versión que lo arregla (sale en el informe: el commit y la fecha).
4. Si hay riesgo de perder datos: pedir antes de nada que descargue una copia de seguridad (Ajustes › Copias y
   exportar) y que no borre la app.

Plazos que proponemos: dudas en 2 días laborables; un fallo que impide trabajar, el mismo día. Hay que decidir quién
responde el correo `cenitfisiolab@gmail.com` y quién le sustituye en vacaciones.

## El piloto (antes de la primera clínica de fuera)

Lo tiene que hacer una persona; no se puede automatizar.

1. Elegir una o dos clínicas de confianza, con 2 o 3 fisios cada una, y un mes.
2. Antes de empezar: una reunión de 30 minutos, datos de ejemplo cargados para practicar, y que cada uno sepa
   dónde está «Algo no funciona».
3. Cada clínica con su propio servidor de Cloudflare (es gratis y aísla sus datos) o el compartido, si caben
   (`cloudflare/README.md`).
4. Cada semana: 15 minutos de llamada. Qué ha fallado, qué ha costado y qué echan en falta. Apuntarlo en
   `docs/ideas-pendientes.md`.
5. Al final: decidir si se abre a más clínicas, con lo aprendido.

Para probar cambios grandes sin tocar a las clínicas del piloto se puede publicar una versión de prueba aparte (otro
proyecto de Cloudflare Pages unido a otra rama). No está montado: se monta el día que haga falta.

## Lo que queda pendiente

- Formatear todo el código con un formateador (Prettier): cambiaría 289 de los 503 archivos de una vez. Mejor en un
  momento tranquilo, en un solo cambio sin nada más.
- Que las pruebas en Safari paren la publicación cuando lleven unas semanas en verde.
- Cifrar la base del dispositivo (hoy el PIN solo impide abrir la app) y registro de quién abre cada ficha.
