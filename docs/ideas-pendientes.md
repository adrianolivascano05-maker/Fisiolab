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
   - Estado: propuesto como lo primero que hacer.
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

## Del análisis de la competencia (plan de acción)

- Corto plazo: captura de errores en producción guardada en el dispositivo; linter y formateador; prueba
  cronometrada con el equipo de Fisiolab; quitar letras que no se usan de la precarga; guía del primer día;
  cabeceras de seguridad completas también fuera de Cloudflare.
- Medio plazo: cifrar la base del dispositivo y registro de accesos por ficha; validar las mediciones con
  plataforma de fuerza y dinamómetro; trocear archivos grandes y probar en WebKit (iPhone); marcado asistido
  en las mediciones; segunda persona que revise el código.
- Largo plazo: reserva online del paciente sin exponer la agenda; área del paciente por enlace; segundo idioma
  si sale de Fisiolab. Videoconsulta: no, salvo que el equipo la pida.
- Argumento a explicar en Ajustes («Tus datos»): exportación completa, sin permanencia, cifrado.
