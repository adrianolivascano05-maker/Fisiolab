# Ideas y pendientes (lo que va saliendo en las conversaciones)

Lista viva. Cada punto: qué es, de dónde sale y estado. Nada de esto está hecho salvo que lo diga.
Análisis completo de la competencia: https://claude.ai/artifact/BmXfNJB6usGL61EGQoQjzA (23-10-2026).

## Propuestos por el usuario (23-10-2026)

1. **Bandeja de envíos automáticos por WhatsApp.** La app prepara sola lo que toca mandar (anamnesis el día
   antes de la primera cita, cuestionarios de seguimiento, recordatorios de mañana) y con «Enviar todos» se abren
   los WhatsApp uno tras otro con el texto y el enlace. Gratis y sin riesgo.
   - Descartado: automatizar WhatsApp Web con un programa (va contra sus normas; riesgo de bloqueo del número).
   - Más adelante, si se quiere envío 100 % automático: API oficial de WhatsApp Business (Meta cobra por
     mensaje) con un servidor que solo conozca teléfono y hora. Es de pago: decidirlo antes.
   - **Hecho el 24-10-2026** (Agenda › Hoy › Envíos, `src/schedule/outbox.ts`): recordatorios del día antes,
     anamnesis 48 horas antes de la primera cita (o en cuanto se da, si queda menos; antelación configurable) y
     cuestionarios antes de reevaluar (los que rellenó hace 2 semanas o más), con «Enviar uno tras otro». Lo enviado
     o descartado se apunta y se sincroniza (migración 026). La anamnesis y los cuestionarios necesitan el servidor
     de la clínica. Los navegadores no dejan abrir varios WhatsApp a la vez: por eso es un toque por mensaje.
2. **Facturación y Verifactu.** Primero facturas con numeración legal desde cobros y bonos; después Verifactu
   (registro encadenado, QR, declaración responsable del fabricante, certificado digital de la clínica).
   Confirmar requisitos y fechas (aplazadas a 2027) con una asesoría. Mirar si sirve mientras tanto la
   aplicación gratuita de facturación de la AEAT. Estado: pendiente.
3. **Firma de consentimientos con más prueba.** Hoy es firma simple (dibujo en pantalla o papel). Paso gratis:
   guardar con cada firma la fecha, el dispositivo y una huella del documento. Firma avanzada (tipo Viafirma)
   solo si la asesoría lo ve necesario, sobre todo para técnicas invasivas. Estado: pendiente.
4. **Dictado por voz (alternativa a Noa Notes).** Con el reconocimiento de voz del navegador, en la sesión y la
   anamnesis, revisando antes de guardar. Resumir una consulta entera necesitaría una IA de pago: no por ahora.
   Estado: pendiente.

5. **Reserva online 24/7 (prioridad alta para el usuario).** Página pública de la clínica donde un paciente ve
   los huecos libres según los turnos del equipo y reserva sin cuenta.
   - Cómo, sin exponer datos: la app calcula los huecos (turnos menos citas) y sube al servidor de Cloudflare
     **solo horas libres y nombre del profesional**, nunca pacientes. Se actualiza al cambiar la agenda.
   - El paciente elige hueco y deja nombre, teléfono, email y motivo. Eso se cifra en su navegador con la clave
     pública de la clínica: el servidor no puede leerlo. El servidor bloquea el hueco al momento para que no lo
     coja otro.
   - La app recoge las reservas al abrirse, crea la cita en la agenda y la ofrece en la bandeja de WhatsApp para
     confirmar. Antes de la primera cita, la anamnesis se manda sola desde la bandeja (idea 1).
   - Decisiones abiertas: confirmación automática o «solicitud» que la clínica acepta; antelación mínima y
     máxima; duración y tipos de cita (primera visita, seguimiento); qué profesionales salen; política de
     anulación; protección contra reservas falsas (límite por dispositivo, verificación del teléfono).
   - Coste: plan gratuito de Cloudflare. Un correo automático de confirmación al paciente necesitaría un servicio
     de envío (posible coste): en su lugar, confirmación en pantalla, archivo para su calendario y WhatsApp.
   - Requiere modo clínica con nube (el modo solo en el dispositivo no puede publicar huecos).
   - **Decidido por el usuario (23-10-2026):**
     - Al reservar, la bandeja propone el WhatsApp de confirmación, y ese mensaje lleva un **enlace para anular**.
     - Anular tiene que ser muy fácil: abrir el enlace, ver la cita y un botón «Anular cita». Sin cuenta ni
       llamadas. El hueco vuelve a quedar libre en la página al momento, y la app anula la cita al recogerlo
       y avisa a la lista de espera. El mismo enlace sirve también para las citas que da la clínica, no solo
       para las reservadas online.
     - La anamnesis de la primera visita se manda **48 horas antes**. Si la cita se reserva con menos de 48
       horas, se manda en cuanto se reserva (junto a la confirmación).
     - Ojo: los envíos de la bandeja salen cuando alguien abre la app y pulsa «Enviar». El de las 48 horas
       aparece en la bandeja ese día; si nadie la abre, sale más tarde.
   - **Hecho el 24-10-2026** (Ajustes › Reserva online, `src/booking/`, página `…/reservar/<clínica>` y enlace
     `…/cita/<código>`):
     - Huecos según el horario de la clínica o los turnos de cada fisio, menos las citas; tipos de cita con su
       duración; antelación mínima, días vista y cada cuánto empiezan las citas, configurables. En una clínica
       con equipo, la clínica elige quién sale y el paciente puede elegir fisio o «me da igual».
     - Reserva directa (no «solicitud»): el hueco se bloquea al momento en el servidor. Límite de 3 reservas al
       día desde una misma conexión y 300 sin recoger por clínica. Sin verificación del teléfono (necesitaría SMS,
       de pago).
     - Los datos del paciente se cifran en su móvil para la clínica (el servidor no puede leerlos y los borra al
       recogerlos). La app crea la cita y, si no existe, el paciente (por móvil o correo).
     - Confirmación en Agenda › Envíos con el enlace para anular (y la anamnesis si su primera cita es en menos de
       48 horas; si no, sale 48 horas antes). Al reservar, el paciente ve el enlace y puede añadir la cita a su
       calendario.
     - Anular: abrir el enlace, «Anular la cita», confirmar. El hueco sale libre en la página al momento. La app
       anula la cita al recogerlo y, si hay lista de espera, lo recuerda en el aviso.
     - Si la clínica mueve o anula una cita con enlace, el paciente ve la hora nueva o «anulada» en su enlace.
   - Limitaciones: las reservas entran en la agenda cuando hay un dispositivo de la clínica con la app abierta (se
     mira cada dos minutos). El WhatsApp de confirmación lo manda la clínica con un toque, no sale solo. La lista de
     espera no se apunta desde la página (el paciente ve el teléfono de la clínica).
   - Ideas para después: que el paciente se apunte a la lista de espera desde la página; avisar por correo; varias
     sedes.
   - Antes de encenderla: el administrador ejecuta `schema.sql` y pega el `worker.js` nuevo
     (`docs/pasos-pendientes.md`, paso 4). El texto «Tus datos» de la página conviene revisarlo con la asesoría.

6. **Preparar la app para otras clínicas (soporte y fiabilidad).** Antes de abrirla fuera de Fisiolab:
   - Registro de errores dentro de la app (sin servicios externos) y botón «Enviar informe de fallo» que copia
     versión, dispositivo y últimos errores para mandarlo por correo o WhatsApp.
   - Linter y formateador en la integración continua; pruebas de navegador también en WebKit (iPhone).
   - Servidor: el plan gratuito de Cloudflare da unos 80 dispositivos a la vez en total (100 000 peticiones al
     día, `cloudflare/README.md`). Con varias clínicas en un mismo servidor, o cada clínica monta el suyo, o
     pasar a Workers Paid (unos 5 $ al mes). Medir la carga real antes.
   - Simulacro de desastre: perder el móvil, restaurar desde la copia cifrada y comprobar que no falta nada.
   - Piloto con una o dos clínicas conocidas durante un mes, con una versión «de prueba» separada de la estable.
   - Soporte: página de problemas frecuentes y un canal claro; decidir quién atiende y en qué plazo.
   - **Hecho el 24-10-2026** (ver `docs/soporte.md`): registro de fallos e informe, pantalla de error, corrector
     de código en la publicación, pruebas en Safari (solo informan), simulacro de pérdida del móvil, presupuesto
     de peticiones (1,9 por minuto por dispositivo: unos 75 dispositivos todo el día en el plan gratuito) y
     problemas frecuentes. Falta: el piloto con clínicas reales (lo hace una persona) y formatear el código.

## Del análisis de la competencia (plan de acción)

- Corto plazo: captura de errores en producción guardada en el dispositivo; linter y formateador; prueba
  cronometrada con el equipo de Fisiolab; quitar letras que no se usan de la precarga; guía del primer día;
  cabeceras de seguridad completas también fuera de Cloudflare.
- Medio plazo: cifrar la base del dispositivo y registro de accesos por ficha; validar las mediciones con
  plataforma de fuerza y dinamómetro; trocear archivos grandes y probar en WebKit (iPhone); marcado asistido
  en las mediciones; segunda persona que revise el código.
- Largo plazo: área del paciente por enlace; segundo idioma
  si sale de Fisiolab. Videoconsulta: no, salvo que el equipo la pida.
- Argumento a explicar en Ajustes («Tus datos»): exportación completa, sin permanencia, cifrado.
