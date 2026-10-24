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
   aplicación gratuita de facturación de la AEAT.
   - **Hecho el 24-10-2026 (primera parte):** Ajustes › Facturas y «Hacer la factura» en cada cobro del paciente
     (`src/data/invoices.ts`, migración 028). Factura completa o simplificada (hasta 400 €), numeración
     correlativa por serie y año (una letra por persona: A2026-0001…; rectificativas aparte: RA2026-0001…),
     IVA exento con su motivo o con tipo, retención de IRPF opcional, varias líneas, PDF e impresión, libro de
     facturas en CSV para la gestoría y hoja «Facturas» en la exportación completa. Una factura emitida no se
     cambia ni se borra (ni al borrar el paciente): se anula con una rectificativa. Cada una guarda los datos de
     la clínica y del destinatario de ese momento y una huella encadenada; la app avisa si una factura se ha
     tocado, si falta un número o si hay dos iguales (dos dispositivos con la misma serie sin conexión).
   - Pendiente: Verifactu (formato de registro de la AEAT, código QR, envío y declaración responsable). No está
     hecho y la app lo dice. Confirmar con la asesoría: exención de IVA de cada servicio, cuándo retener IRPF,
     qué datos del paciente deben salir y si las series por persona les valen.
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

## Revisión de lo hecho la noche del 23 al 24-10-2026 (pendiente de arreglar)

Revisado el código de los cuatro bloques (con dos revisiones independientes). Todo lo de abajo está comprobado en el
código salvo lo marcado «a confirmar». Orden propuesto por bloques.

**R1. Fallos que pueden perder datos o mensajes** — **hecho el 24-10-2026:**
- ~~Restaurar una copia borra las facturas hechas después~~: al restaurar se conservan todas las facturas (las de la
  copia y las de este dispositivo), así no se vuelven a dar sus números.
- ~~La misma persona en dos dispositivos puede repetir número~~: ahora cada dispositivo tiene su serie (A, B…), no
  cada persona. Si dos dispositivos sin conexión cogen la misma letra a la vez, uno se la deja al otro en su próxima
  factura. Lo que se hubiera emitido ya con números repetidos lo avisa la lista de facturas («Número repetido…»).
- ~~La bandeja apunta la anamnesis como enviada al enseñarla~~: se apunta al pulsar «Enviar»; con «Saltar por ahora»
  vuelve a salir.
- ~~Una reserva que no se puede abrir se queda para siempre~~: se descarta y la app avisa («puede ser falsa»).
  Además el servidor ya no acepta lo que no tenga la forma de una reserva cifrada.
- ~~Una anulación se da por vista aunque el dispositivo no tenga la cita~~: se queda en el servidor hasta que llega la
  cita (o hasta que ya ha pasado).
- ~~Al borrar una cita con enlace para anular, el enlace sigue funcionando~~: se desactiva. Al restaurar una copia no
  se desactiva nada (lo que falta en la copia puede seguir en otros dispositivos).
- ~~Dos pacientes que reservan el mismo hueco a la vez~~: el servidor comprueba y guarda en un solo paso; el segundo
  ve «Ese hueco se acaba de ocupar». Si una reserva cae encima de una cita dada a mano, el aviso lo dice en rojo.
- ~~Si la app vuelve a publicar los huecos antes de recoger una anulación, el hueco anulado se vuelve a tapar~~: el
  servidor lo mantiene libre hasta que la clínica recoge la anulación (lo encontró una prueba automática).
- Lo que queda: si dos dispositivos emiten facturas **sin conexión** con la misma letra antes de sincronizar, pueden
  repetir número (se avisa; se arregla con una rectificativa). Con conexión no pasa.

**Medición con el inclinómetro (visto el 24-10-2026, sin tocar):** si se pulsa «Registrar lectura» antes de que
salga «Estable», el número grande puede decir 37° y la lectura guardarse como 38°: se guarda con un decimal (37,46 →
37,5) y luego se redondea otra vez al enseñarla. Con la lectura estable no pasa. Arreglarlo (guardar sin redondear
antes, o enseñar el decimal) cambia cómo se guarda la medición: decidirlo antes.

**R2. iPhone** — **en marcha el 24-10-2026:**
- Lo que fallaba en la prueba con el motor de Safari (WebKit): la primera vez que se abre la app va bien, pero en la
  segunda carga de página en la misma pestaña salía «Cénit ya está abierta en otra pestaña». Safari guarda la
  página anterior «congelada» (para volver atrás deprisa) con su base de datos abierta. En un iPhone puede pasar al
  volver de entrar con Google, al cambiar de clínica, al cerrar sesión o al recargar.
- ~~Arreglo~~ **hecho:** la app cierra su base al dejar la página y, si Safari devuelve la congelada, la recarga.
  Prueba nueva PWA-H3 (recargar, otra dirección y volver atrás: los datos siguen).
- **Hecho también:** si la página anterior tarda más de 3 segundos en soltar la base (un móvil lento), el aviso «ya
  está abierta en otra pestaña» ya no se queda para siempre: en cuanto se suelta, la app sigue sola. Lo mismo al
  cerrar la otra pestaña de verdad.
- Las pruebas de gestos con dos dedos y la de leer el portapapeles no se pueden hacer en el WebKit de pruebas de
  Linux (no deja simular toques ni da permiso de portapapeles): ahí se saltan; en Chromium siguen.
- **Resultado en GitHub tras el arreglo (24-10-2026): sigue fallando (22 de 41).** En ese Safari de pruebas la base
  ya trabaja «en memoria» desde la primera carga (no guarda nada) y la segunda carga de página no llega a verse. Se
  ha añadido una prueba de diagnóstico (e2e/webkit-diagnostico.spec.ts, solo en WebKit) que apunta en el registro de
  GitHub qué pasa en cada carga. **Aún no se sabe si en un iPhone de verdad pasa lo mismo**: el Safari de pruebas de
  Linux no es igual que el del iPhone.
- **Falta:** leer ese diagnóstico, arreglar lo que diga, y probar en un iPhone de verdad (pasos en
  docs/pasos-pendientes.md, «Probar en un iPhone»).

**R3. Reserva online, para que no dé sorpresas:**
- ~~Días cerrados y festivos~~ **hecho el 24-10-2026:** «Cerrar la agenda» (de un fisio o de toda la clínica; una
  tarde, un día o varios), se ve rayado en la agenda y la reserva no ofrece esos ratos.
- ~~Una sesión que ya ha empezado no cuenta como ocupada~~ **hecho el 24-10-2026.**
- ~~Al anular, el hueco se libera aunque esté fuera de horario~~ **hecho el 24-10-2026:** solo se libera lo que cae
  dentro del horario abierto de ese fisio. (Sigue pendiente: si se solapa con otra cita suya dada después.)
- ~~Al apagar la reserva, otra clínica puede quedarse con su dirección~~ **hecho el 24-10-2026.**
- ~~Horas fuera de la rejilla (10:07)~~ **hecho el 24-10-2026** (el servidor solo acepta las horas de la lista).
- **Hecho el 24-10-2026, a petición del usuario:** página de reservas como en las apps de reservas (tipo de cita con
  su precio, el fisio con su especialidad o «cualquiera», calendario del mes con los días libres, horas de mañana y
  de tarde) y enlace personal de cada fisio (…/reservar/<clínica>?con=<fisio>) para que sus pacientes vuelvan con él;
  al terminar y al anular, «pedir otra cita con…».
- Un fisio sin turnos puestos sale con todo el horario de la clínica (también si está de vacaciones o ya no está
  en el equipo); poner un solo turno quita el resto del mes.
- El paciente se une a una ficha solo por el móvil o el correo (una madre que reserva para su marido con su móvil
  cae en su ficha). El motivo que escribe solo se guarda si es paciente nuevo.
- El permiso de contacto que da al reservar no se guarda; si un paciente tenía «no contactar», no recibe la
  confirmación y nadie lo avisa.
- Al apagar la reserva, otra clínica del mismo servidor puede quedarse con su dirección.
- Límite de reservas por día fácil de saltar; horas fuera de la rejilla (10:07) rompen los huecos.
- Política de anulación (no dejar anular a menos de X horas) y «cambiar la hora» además de anular.

**R4. Bandeja de envíos:**
- Recordatorios y Envíos hacen lo mismo en dos sitios: juntarlos en uno.
- El recordatorio es solo «mañana»: los lunes y después de un festivo no sale el día antes.
- Una reserva para mañana manda dos WhatsApp seguidos (confirmación y recordatorio).
- Pacientes sin el permiso de contacto apuntado entran en la tanda; el aviso solo sale en la lista.
- «No enviar» no se puede deshacer; si se mueve la cita, el «No enviar» se queda.
- Lo enviado por un compañero no se ve hasta refrescar la bandeja.

**R5. Facturas, más detalles:**
- Desde un cobro con IVA puede salir 1 céntimo distinto de lo cobrado; cambiar el IVA no recalcula el precio.
- El libro en CSV no neutraliza textos que empiezan por = + - @ (Excel podría ejecutarlos como fórmula).
- Al entrar en una clínica, las facturas hechas por tu cuenta se mezclan con las de la clínica.
- El aviso de número repetido no se puede quitar y puede dar «cadena rota» de más.
- Mejor: que el servidor de la clínica dé los números (una serie para toda la clínica, sin repetidos) y las series
  por dispositivo solo sin conexión. IVA distinto por línea.

**R6. General:**
- Cada dispositivo pregunta al servidor por tres cosas por separado (cambios, formularios y reservas): unas 2,5
  peticiones por minuto. Con una sola pregunta «¿hay algo nuevo?» bajaría a 1.
- Si la página de reservas no se puede publicar, solo se apunta el fallo: avisar en la app.
- Las pruebas usan una copia del servidor escrita aparte; mejor probar con el servidor de verdad.

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
