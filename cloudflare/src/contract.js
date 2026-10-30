// @ts-check
// ---------- Borrador del contrato de encargado del tratamiento ----------
// Solo lo ve quien gestiona el servidor (GET /v1/proveedor/contrato). Es un BORRADOR para revisar con un abogado o un
// delegado de protección de datos: no se ha comprobado que cumpla la normativa.

export const CONTRACT_HTML = `
<p><strong>BORRADOR para revisar con un profesional (abogado o delegado de protección de datos). No firmar sin revisarlo.</strong></p>
<h2>Contrato de encargo del tratamiento de datos personales (artículo 28 del RGPD)</h2>
<p>En [LOCALIDAD], a [FECHA].</p>
<h3>Reunidos</h3>
<p><strong>De una parte</strong>, [NOMBRE O RAZÓN SOCIAL DE LA CLÍNICA], con NIF [NIF], domicilio en [DIRECCIÓN] y representada por [NOMBRE Y CARGO], en adelante <em>el Responsable</em>.</p>
<p><strong>De otra parte</strong>, [NOMBRE DEL PROVEEDOR], con NIF [NIF], domicilio en [DIRECCIÓN] y correo de contacto [CORREO], en adelante <em>el Encargado</em>, que presta el servicio de la aplicación OmniClin.</p>
<p>Ambas partes se reconocen capacidad para firmar este contrato y acuerdan las siguientes cláusulas.</p>
<h3>1. Objeto</h3>
<p>El Encargado presta al Responsable el servicio de la aplicación OmniClin: una herramienta de registro y organización de la actividad de fisioterapia (fichas de pacientes, anamnesis, sesiones, mediciones, agenda y turnos del equipo). Para ello guarda en un servidor una copia cifrada de los datos de la clínica, que se sincroniza entre los dispositivos de su equipo. OmniClin es un programa de registro y organización de la actividad de fisioterapia y de medición del rendimiento físico. No es un producto sanitario: no diagnostica, no hace triaje, no predice, no vigila al paciente ni propone tratamientos. Cada valoración y cada decisión clínica es del profesional.</p>
<h3>2. Duración</h3>
<p>Este contrato dura lo mismo que la prestación del servicio. Al terminar se aplica la cláusula 10.</p>
<h3>3. Naturaleza, finalidad y datos tratados</h3>
<ul>
<li><strong>Finalidad:</strong> guardar y sincronizar la copia de los datos de la clínica y gestionar el acceso de su equipo.</li>
<li><strong>Interesados:</strong> pacientes de la clínica y profesionales de su equipo.</li>
<li><strong>Datos:</strong> identificativos y de contacto de los pacientes; datos de salud (categoría especial, artículo 9 del RGPD): historia clínica, anamnesis, exploración, sesiones, mediciones y cuestionarios; del equipo, nombre y correo electrónico.</li>
<li><strong>Tratamientos:</strong> conservación y transmisión de una copia cifrada; gestión de cuentas de acceso (correos del equipo).</li>
</ul>
<h3>4. Cifrado y acceso a los datos</h3>
<p>La copia de los datos se cifra en los dispositivos de la clínica (AES-256) con una contraseña que solo conoce la clínica, antes de llegar al servidor. El Encargado no conoce esa contraseña ni la del código de recuperación y no puede leer los datos de los pacientes. El Encargado sí trata, para prestar el servicio, el nombre de la clínica, los correos de su equipo, el tamaño de la copia y las fechas de uso. Si la clínica usa los formularios para el paciente, el servidor guarda además, hasta que la clínica los recoge, lo que envía el paciente, cifrado en su navegador para la clínica (el Encargado no puede leerlo). Si la clínica guarda documentos de sus pacientes (informes en PDF), se cifran igual antes de salir del dispositivo (o del navegador del paciente) y se guardan en un almacén de archivos de Cloudflare con jurisdicción en la Unión Europea; el Encargado solo ve cuánto ocupan. La clínica custodia su contraseña y su código de recuperación: si los pierde, el Encargado no puede recuperar los datos.</p>
<h3>5. Obligaciones del Encargado</h3>
<ol>
<li>Tratar los datos solo para prestar el servicio y siguiendo las instrucciones documentadas del Responsable, incluidas las de este contrato.</li>
<li>Garantizar que las personas autorizadas a tratar los datos se han comprometido a respetar su confidencialidad.</li>
<li>Aplicar las medidas de seguridad del artículo 32 del RGPD descritas en el anexo.</li>
<li>No recurrir a otro encargado sin autorización del Responsable. El Responsable autoriza a los subencargados del anexo; el Encargado avisará de cualquier cambio con al menos 30 días de antelación para que el Responsable pueda oponerse.</li>
<li>Asistir al Responsable, en lo que le sea posible, para responder a las solicitudes de ejercicio de derechos de los interesados.</li>
<li>Notificar al Responsable, sin dilación indebida y a más tardar en 48 horas desde que tenga conocimiento, cualquier violación de la seguridad que afecte a los datos, con la información necesaria para que el Responsable cumpla los artículos 33 y 34 del RGPD.</li>
<li>Poner a disposición del Responsable la información necesaria para demostrar el cumplimiento de este contrato y permitir las auditorías razonables que este solicite.</li>
<li>Llevar el registro de actividades de tratamiento como encargado (artículo 30.2 del RGPD).</li>
</ol>
<h3>6. Obligaciones del Responsable</h3>
<ol>
<li>Ser el responsable del tratamiento: informar a los pacientes, recabar los consentimientos que procedan y atender sus derechos.</li>
<li>Elegir y custodiar la contraseña de cifrado y el código de recuperación, y dar acceso solo a su equipo.</li>
<li>Conservar las historias clínicas el plazo que marca la ley (como mínimo cinco años desde el alta de cada proceso asistencial, Ley 41/2002) y guardar copias de seguridad.</li>
<li>Velar por que su equipo cumpla la normativa y su deber de confidencialidad, y mantener protegidos sus dispositivos.</li>
</ol>
<h3>7. Subencargados</h3>
<p>Se autorizan los subencargados del anexo. El Encargado les impone por contrato las mismas obligaciones de protección de datos.</p>
<h3>8. Transferencias internacionales</h3>
<p>La copia cifrada se guarda en una base de datos de Cloudflare con jurisdicción en la Unión Europea. El inicio de sesión con Google puede implicar transferencias a Estados Unidos, amparadas en el Marco de Privacidad de Datos UE-EE. UU. o en cláusulas contractuales tipo, según el contrato de Google.</p>
<h3>9. Suspensión del servicio</h3>
<p>Si el servicio se suspende (por ejemplo, por impago), el Responsable puede seguir descargando su copia, pero no guardar cambios en el servidor, hasta su reactivación o la terminación del contrato.</p>
<h3>10. Fin de la prestación</h3>
<p>Al terminar el servicio, el Responsable descarga su copia de seguridad y la conserva bajo su responsabilidad. Cuando el Responsable borra su clínica, declara conservar esa copia y el servidor guarda constancia de quién lo hizo, cuándo y con qué declaración. Los datos quedan 30 días en la papelera, durante los cuales el Responsable puede recuperarlos; después el Encargado los suprime de su servidor, salvo obligación legal de conservarlos.</p>
<h3>11. Responsabilidad</h3>
<p>Cada parte responde de sus incumplimientos conforme al artículo 82 del RGPD. [LIMITACIONES DE RESPONSABILIDAD, A REVISAR]</p>
<h3>12. Ley aplicable</h3>
<p>Este contrato se rige por la ley española y el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD). [JURISDICCIÓN]</p>
<h3>Anexo I. Medidas de seguridad</h3>
<ul>
<li>Cifrado de la copia en el dispositivo (AES-256-GCM, clave derivada con PBKDF2-SHA-256 de 600 000 iteraciones) antes de enviarla; el servidor rechaza copias sin cifrar.</li>
<li>Documentos de los pacientes cifrados en el dispositivo (AES-256-GCM, con una clave propia de cada documento que solo está en la copia cifrada de la clínica o en el enlace del paciente); el servidor rechaza documentos sin cifrar y no guarda más de 10 GB en total.</li>
<li>Acceso al servidor solo con sesión de Google verificada y solo para el equipo de cada clínica; los permisos del equipo los gestiona su administrador.</li>
<li>Conexiones cifradas (HTTPS). Registros de peticiones desactivados; nunca se registran el contenido ni los tokens.</li>
<li>Control de versiones de la copia para que un dispositivo no pise los cambios de otro.</li>
<li>En los dispositivos: PIN de la aplicación obligatorio en las clínicas y bloqueo por inactividad.</li>
</ul>
<h3>Anexo II. Subencargados autorizados</h3>
<ul>
<li>Cloudflare, Inc. (y sus filiales): alojamiento del servidor, de la base de datos y de los documentos (jurisdicción UE). Contrato: Cloudflare Customer DPA.</li>
<li>Google LLC / Google Ireland Ltd.: inicio de sesión con cuenta de Google y, si la clínica lo activa, Google Calendar y Google Drive de cada profesional.</li>
<li>GitHub, Inc.: publicación de la aplicación web (no trata datos de pacientes).</li>
</ul>
<p>Firmado por ambas partes:</p>
<p>El Responsable: ______________________ &nbsp;&nbsp;&nbsp; El Encargado: ______________________</p>
`;
