# Plan de limpieza de Cénit (fase 3)

Aprobado por el usuario el 2026-10-22 a partir de la radiografía y la propuesta v2 publicadas en
https://claude.ai/artifact/X1tmesH5Bb2Kwnj2dNmwVh (66 capturas a 360 px, mapa, duplicados, recorridos en toques,
bocetos, prueba de 10 fisios). Las pantallas actuales, en texto, están en esa página; aquí solo lo decidido.

## Reglas fijas

- Un bloque cada vez, con capturas de antes y después a 360 px, sin scroll horizontal y zonas táctiles de 44 px.
- No se pierde ninguna función ni dato: lo que se mueve sigue accesible y las direcciones antiguas redirigen.
- No se toca la lógica clínica (cuestionarios, CIF, banderas rojas, cálculos): esto es orden, nombres y aspecto.
- Pruebas: `npm test` y Playwright en los dos modos (`npm run e2e` y `npm run e2e:ghpages`), una tras otra, nunca a la vez.
- Commit y push por bloque solo con todo en verde, a la rama `claude/replica-skill-install-zv3ker` (publica la web).
- Castellano, sencillo, paso a paso. Sin servicios de pago ni claves. Nada se presenta como validado clínica o legalmente.

## Decisiones

- Inicio: **opción B**. La app sigue abriendo en Pacientes, pero limpio (buscador, franja «Hoy» de una fila, lista A-Z).
- **B3 (colores por clínica) descartado.** En su lugar, la app adopta la estética de la página de la propuesta tal
  como la vio el usuario en su móvil (modo oscuro): fondo gris verdoso muy oscuro, tarjetas algo más claras con
  bordes redondeados, acento verde menta, texto claro, títulos en Bricolage Grotesque y texto en Source Sans 3,
  etiquetas de sección en mayúsculas pequeñas. Sigue el ajuste del teléfono (clara = papel gris verdoso frío, oscura
  = la de la captura). El logo y el nombre Cénit se mantienen. Se hace como un bloque propio (B8) después de B2.
- La letra de los títulos no es configurable: es la de esa estética.

## Bloques, en este orden

Estado (2026-10-23): hechos y publicados B1, B2, B8, B4, B5 y B6; B7 con este cambio. B3 (colores por clínica) no se
aprobó. Cambios respecto a lo escrito abajo, decididos al hacerlo: en Ajustes se mantienen los nombres «Clínica y
protección de datos» y «Precios y cobros» (salen en muchos textos de la app); «Biblioteca» vive en `/biblioteca` y
las direcciones `/exploracion/…` llevan allí.


1. **B1 · Inicio y Agenda con «Hoy».** Pacientes: + Nuevo (crea el paciente directamente), buscador, franja «Hoy»,
   lista con la próxima cita; fuera Pendiente, Próximas citas, Para reevaluar, Medición rápida (va a Biblioteca ›
   Mediciones) y los avisos (a Ajustes). Agenda: segmentos Hoy · Día · Semana; Hoy en lista con Atender (vuelve a
   Hoy al guardar, con la cita atendida) y Cobrar; Pendiente: reevaluaciones, «Sin cobrar» (pantalla propia, vuelve
   a Hoy), «Sin firmar hoy»; «Mañana · n citas · Recordatorios ›»; fila fija «Lista de espera · n».
2. **B2 · La ficha.** Cabecera compacta con una fila de chips de 44 px (Motivo ▾, Cita / Dar cita, Debe). Pestañas
   Resumen · Anamnesis · Valoración · Sesiones. Resumen: «Nueva sesión» y «Valorar» (hoja: Test · Cuestionario ·
   Medición); tarjeta «Situación» (diagnóstico, alarmas con «ver», última sesión, último cuestionario o medición,
   reevaluación, simetría < 90 % en rojo); «Pendiente» solo si hay; grupos Documentos (Informe, Informe de alta,
   Carta de derivación, Justificante de asistencia, con pista de tres palabras), Legal (Consentimientos informados,
   Protección de datos RGPD) y Cuenta (Bonos y cobros, Lista de espera). Fuera: Añadir, Historia (al final de
   Sesiones), secciones Exploración/Mediciones/Cuestionarios, fila Anamnesis, fila Formularios. Valoración: una
   página con tres títulos (Exploración primero, Cuestionarios con Bienestar, Mediciones) y anclas con el «+» del
   bloque activo; se abre en el último bloque usado; «Tests de la zona» encabeza el selector de «+ Registrar un
   test»; tarjetas de cuestionario con «primera → última (n pases)»; chip «Evolución de mediciones». Anamnesis sin
   números; apartado de exploración física con una línea a Valoración. Nueva sesión: «Dar la siguiente cita» y
   «Reevaluar» (plegado) con su verbo; hoja del calendario solo si no hay cita. Documentos: «Imprimir» y «Guardar en
   PDF» en los cuatro (el alta lo gana); sin el enlace al alta dentro del Informe; Consentimientos sin pestañas ni
   fila RGPD repetida. Formularios: «Enviar al móvil» abre siempre la hoja de elegir; aviso del servidor enlaza a
   Proveedor; estado de lo enviado junto al cuestionario o la anamnesis.
3. **B8 · Estética** (sustituye a B3): tokens de color y tipografía nuevos en `src/styles/tokens.json`, modo claro y
   oscuro según el sistema, tarjetas redondeadas; comprobar contraste (≥ 4,5:1 en texto) en los dos modos.
4. **B4 · Biblioteca.** Renombrar la pestaña; buscador único; estantes Tests de exploración, Cuestionarios (ficha
   con qué mide, preguntas, puntuación, licencia con el interruptor «Tenemos el permiso» que hoy está en Ajustes, y
   «Pasar a un paciente») y Mediciones (qué es cada prueba, «Medir en un paciente», «Medir ahora, sin ficha»).
   «Registrar en…» / «Pasar a…» / «Medir en…» solo con nombre cuando se viene de la ficha; si no, elegir paciente.
   «Pendiente del permiso» en el selector de cuestionarios enlaza a la ficha de la Biblioteca.
5. **B5 · Nombres y 44 px.** Un solo nombre por concepto: Test, Cuestionario, Medición, Sesión; Informe, Informe de
   alta, Carta de derivación, Justificante de asistencia; «Cobrar» (no «Apuntar un cobro»); «Recibo» (no
   «Justificante del cobro»); «Permisos opcionales» dentro de Protección de datos; contadores «quedan N de M» y
   «sesión 2 de 10 previstas». Nada cortado en barra ni pestañas; Motivo, cita, «Ver todo», chips e índice de la
   anamnesis a 44 px.
6. **B6 · Ajustes** en cuatro grupos: Clínica (Datos de la clínica, Equipo, Precios y bonos, Anamnesis propia, La
   clínica en números), Datos (Cuenta de Google, Copias y exportar, Importar, Proveedor), Seguridad (PIN,
   Privacidad de la app), App (Instalar, Cómo se usa, Validación). La lista de licencias se va a la Biblioteca (B4).
   «Pendiente de cobro» deja de estar al final de Precios y bonos (B1).
7. **B7 · Agenda en rejilla** cómoda en 360 px: controles en una fila, columna del día a todo el ancho, «3 días»
   solo en pantallas anchas.

## Duplicados que se mantienen a propósito

Chip «Debe» y fila «Bonos y cobros» (estado y lugar); WhatsApp en la hoja de la cita y en Recordatorios; Lista de
espera en Agenda y en la ficha (apuntar a este paciente); «Pasar a un paciente» en Biblioteca y «+» en Valoración;
«Dar por terminado» (cierra el motivo) e «Informe de alta» (el documento).
