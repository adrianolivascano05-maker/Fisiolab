# Anamnesis adaptable por clínica (plan de trabajo)

Pedido el 04-11-2026, en tres fases. Fase 1: cada clínica ajusta el tronco. Fase 2: módulos de especialidad y
varias plantillas por clínica. Fase 3: cuestionarios propios. Regla de oro: **lo ya respondido no se pierde nunca ni
cambia de significado**. No se sube nada (cada subida publica la app) sin el visto bueno del usuario, después de pasar
todas las pruebas y enseñar los cambios.

## Decisiones tomadas con el usuario (04-11-2026)

1. **Fijas.** Además de la lista del encargo, también son fijas `cirugias`, `observaciones` y `objetivos_corto`:
   los consentimientos las leen (`consent/precautions.ts` lee las dos primeras y `consent/context.ts` la tercera).
2. **Instantáneas al usarse.** El puntero `anamnesis_tpl:<id>` guarda los cambios de la clínica (delta), quién y
   cuándo. La instantánea `anamnesis_tpl_v:<id>:<huella>` (la plantilla ya resuelta, inmutable) se escribe la
   primera vez que se usa (al guardar una anamnesis o al enviar un enlace) y no se repite si ya existe con esa
   huella. Así no se crea una instantánea por cada toque del editor.
3. **Respuesta del paciente cuando el fisio ya había escrito.** No se pierde: queda en el registro del formulario
   recogido (`patient_forms`, `clean`). En la ficha se enseña «El paciente contestó: …» desde ese registro. Quién
   contestó cada pregunta y cuándo va en la clave `__src` de las respuestas.
4. **Móviles sin actualizar.** Durante una versión verán `__tpl` y `__src` como dos líneas en «Otros datos
   guardados». Solo visual; se acepta.
5. **«Sí/No con detalle» y «Otro».** Se guardan como texto legible: «Sí: rodilla izquierda», «Otro: natación».
6. **«Prefiero no responder».** En el tronco, en `toxicos`, `estres` y `sueno`. En las preguntas propias, un
   interruptor «Pregunta delicada» (`sensitive`), que en la fase 2 impide hacerla obligatoria.
7. **Menores.** «Contesta: el propio paciente / su madre, padre o tutor» solo si la ficha dice que es menor (por la
   fecha de nacimiento). Se guarda en `__respondent`.
8. **15 preguntas al paciente** para todas las clínicas al publicar (las otras 18 pasan a «Solo tú»).
9. **Sin clínica en la nube**, quien usa el móvil puede editar la plantilla.
10. **El formato de la fase 1 ya es el de la fase 2:** plantilla con `modules: []`, orden por apartado, ids `c_<8 hex>`
    y `s_<8 hex>`; un móvil con la fase 1 enseña como texto los tipos que no conoce y no borra nada.
11. **Fase 2: los cambios de un módulo de OmniClin son de la clínica** (como los módulos propios), no de cada
    plantilla; cada plantilla puede ocultar preguntas del módulo.
12. **Fase 2: mover preguntas con condición.** El editor avisa y no deja mover una pregunta con condición (o de la
    que depende otra) a otro apartado sin quitar antes la condición.
13. **Fase 2: tamaño.** 64 KB para los cambios de la clínica; hasta 256 KB para la instantánea resuelta.
14. **Fase 2: la anamnesis general** (sin motivo de consulta) usa la plantilla por defecto; una vez hecha conserva
    la suya (`__tpl`).

15. **Editar solo en Ajustes (04-11-2026).** En la anamnesis del paciente solo se **elige** el tipo de anamnesis
    (la plantilla, en la fase 2); no hay ningún enlace ni botón para cambiarla desde ahí. Las plantillas se cambian
    únicamente en Ajustes › Anamnesis de la clínica, para que nadie modifique nada sin querer.

## Decisiones de la fase 2 (07-11-2026 y 09-11-2026)

16. **Botón «⋯» en las plantillas**, en vez de mantener pulsado un chip (como en Cuestionarios propios): «Usar por
    defecto · Renombrar · Duplicar · Archivar» y, debajo, las archivadas con «Volver a usarla».
17. **Los 3 paquetes de ejemplo pasan a módulos de OmniClin, versión 1** (`m_deportiva`, `m_suelo_pelvico`,
    `m_neurologica`), con las mismas preguntas, cada uno en su apartado propio. Sin ocultar preguntas del tronco, sin
    proponer cuestionarios ni mediciones y sin respuestas destacadas: eso llega con el documento (versión 2). Dos
    ajustes: «Tono y espasticidad» la contesta solo el fisio (es de la exploración) y «Dolor en las relaciones
    sexuales» es delicada (con «Prefiero no responder» y nunca obligatoria) en vez de tener «Prefiere no responder»
    como opción.
18. **«Unos N minutos» al enviar**: la misma cuenta que el formulario del paciente (unos 20 segundos por pregunta).

Cómo quedan los detalles que el encargo no fijaba:

- Una plantilla nueva lleva el tronco con los cambios de la que sale por defecto (lo que la clínica ya ajustó), más
  los módulos elegidos. «Duplicar» copia una entera.
- El apartado propio de un módulo va antes de «Exploración física» (detrás de «Hábitos»); los apartados nuevos de la
  clínica, también. Se pueden subir y bajar.
- «Mostrar solo si…» y «Destacar» se ponen en las preguntas propias y en las de los módulos (las del tronco no se
  condicionan ni se destacan: las banderas rojas son aparte). Una condición que deja de valer (la pregunta de la que
  depende se oculta o se mueve) se ignora: la pregunta se ve siempre.
- Lo destacado sigue la configuración de ahora de la clínica (si deja de destacar una opción, deja de salir).
- Un módulo de la clínica tiene siempre su apartado (aunque esté vacío, para añadirle preguntas); al paciente solo le
  llegan los apartados con preguntas suyas.
- Las preguntas de un módulo se añaden en su apartado; después se pueden mover a uno del tronco desde su hoja.

## Anamnesis base y ampliada: hecha y publicada (11-11-2026, `d772a7c`)

El usuario pide lo mínimo para valorar: una **anamnesis base** súper reducida (la que sale siempre), una **ampliada**
(todo) y **modificar** (el editor). Decisiones:

19. **La base son 16 preguntas del tronco** (más la fecha, que se pone sola), elegidas porque son las que usa el
    resto de la app (el nombre del motivo, los tests por zona, el resumen, los consentimientos y el informe). No es
    una lista validada clínicamente: la aprobó el usuario. `CORE` en `src/clinical/anamnesis.ts`:
    motivo, zona, lado, fecha de inicio, EVA, agravantes, atenuantes, banderas rojas · enfermedades, cirugías,
    medicación, alergias, precauciones · diagnóstico, plan, observaciones. El tronco entero son 56 (no se quita
    ninguna): las otras 39 quedan en la ampliada.
20. **Un selector «Base · Ampliada» dentro de la misma anamnesis**, no dos plantillas: no hay que elegir plantilla y
    cada plantilla de especialidad tiene su base y su ampliada. Se abre siempre en la base.
21. **Una sola regla: lo que es base, es base para el fisio y para el paciente.** Al paciente, con la base, le llegan
    las preguntas de la base que contesta él (10: qué le pasa, desde cuándo, cuánto le duele, qué lo empeora, qué lo
    alivia, sus síntomas de alarma, enfermedades, operaciones, medicación y alergias; unos 4 minutos). Los síntomas
    de alarma (`ALWAYS_ASKED`) se le preguntan siempre, aunque en la ficha solo salgan en la ampliada (o cuando marcó
    alguno).
22. **Las preguntas propias de la clínica y las de sus módulos van en la base** si no se dice otra cosa (las añadió
    porque las quiere ver). En el editor, cada pregunta dice dónde sale: «Base · Ampliada · Oculta».
23. **Al paciente, las 10** (11-11-2026): el usuario deja «¿Qué lo empeora?» y «¿Qué lo alivia?» en lo que se le
    manda con la base.
24. **Banderas rojas y precauciones, siempre desplegadas** (11-11-2026): en el móvil ocupan más de media pantalla de
    la base, pero son de seguridad y el usuario no quiere el toque de más para abrirlas.

Cómo queda:

- **Datos**: `Field.extra` (solo en la ampliada). En el tronco lo decide `CORE`, y la clínica lo cambia por plantilla
  (`FieldPatch.level`, `"base" | "extra"`; lo igual que el original no se guarda). En las propias, `OwnField.extra`;
  en las de un módulo de OmniClin, `ModuleFieldPatch.extra` (es un cambio del módulo: se ve en todas sus
  plantillas). Sin migración: no cambia ninguna respuesta. La huella de las plantillas cambia una vez (las
  instantáneas de antes siguen leyéndose igual).
- **Ficha** (`src/clinical/AnamnesisPage.tsx`): al rellenar, arriba «Base · Ampliada» (`LevelSwitch`) y «Modificar»
  (lleva a Ajustes → Anamnesis de la clínica; si hay algo escrito, lo guarda antes). La base se ve en tres bloques sin
  plegar (`baseBlocks`: «Motivo de consulta», «Salud», «Diagnóstico y plan»; los apartados de la clínica y de los
  módulos, aparte con su nombre); la ampliada, apartado por apartado como siempre. **Lo ya respondido se ve siempre**:
  una pregunta de la ampliada con respuesta sale también en la base. Al leer, los apartados solo de la ampliada y sin
  nada escrito no salen, y la cuenta es «8 de 16 de la base · 3 de la ampliada».
- **Editor**: en la hoja de cada pregunta, «Sale en: Base · Ampliada · Oculta»; en cada fila, «Base» o «Ampliada»;
  arriba, «Base: 16 preguntas · Ampliada: 55»; en cada apartado, cuántas en la base.
- **Paciente**: al enviar su parte, «Base · Ampliada» con cuántas preguntas y cuántos minutos (solo si son
  distintas), y la vista previa de lo elegido. La bandeja de envíos manda la base. Lo que se le preguntó queda
  apuntado en el envío (`meta.fields`), así que la recogida no cambia.
- **Límites conocidos**: en la base, el resumen de la ficha no tiene localización ni objetivo salvo que se rellenen
  en la ampliada. Un móvil sin actualizar lo ve todo como ampliada (no conoce la base) y, si desde él se cambia una
  plantilla, se pierde dónde salía cada pregunta que la clínica hubiera cambiado (ajustes; nunca respuestas).
- **Pruebas**: `src/data/anamnesisLevels.test.ts` (10) y e2e `base.spec.ts` (AB1, AB2). Las pruebas de antes que
  rellenaban preguntas de la ampliada pasan antes a ella (`ampliada()` en `e2e/fixtures.ts`); CL12 manda la ampliada
  y CL18 comprueba que la base son dos pasos.

## Fase 2: hecha y publicada (09-11-2026, `679dd9d`)

- **Datos**: `src/data/anamnesisFields.ts` (las preguntas propias: tipos, comprobación, `ownToField`),
  `src/data/anamnesisModules.ts` (módulos de la clínica: `anamnesis_mod:<id>` e instantáneas `anamnesis_mod_v:`; los
  de OmniClin con los cambios de la clínica encima, «volver a la versión de OmniClin» y novedades por versión),
  `src/data/modulesLibrary.ts` (los de OmniClin, versión 1) y `src/data/anamnesisTemplates.ts` (hasta 20 plantillas,
  la de por defecto en `anamnesis_tpl_default`, archivar, duplicar, renombrar, apartados nuevos `s_<8 hex>`, mover
  preguntas y apartados, resolución con módulos, obligatorias, condiciones, lo que propone). Sin migración: una
  plantilla de la fase 1 se resuelve igual que antes (la misma huella; hay una prueba que lo compara).
- **Tipos nuevos**: Sí/No, número con unidad (veces, horas, semanas, días, cm, mm, %), fecha y zonas del cuerpo con
  su lado (`rodilla:derecho`). `visibleFields` en `src/clinical/anamnesis.ts` la usan la ficha, el formulario del
  paciente y la recogida.
- **Ficha**: cada anamnesis se ve con la plantilla de su motivo (`__tpl`), aunque se archive; al abrir un motivo se
  elige la plantilla (si hay más de una). «Destacado» en la anamnesis y en el resumen de la ficha, con el pie
  «Destacado según la configuración de tu clínica». Las banderas rojas solo buscan en las preguntas del tronco. En
  «Valorar», primero lo que propone la plantilla.
- **Editor**: chips de plantillas, «+ Nueva», «⋯», aviso de novedades de OmniClin, la hoja de cada pregunta con
  obligatoria, «Mostrar solo si…», destacar y apartado, «Añadir apartado», «Nombre y orden del apartado», la sección
  «Módulos» (de esta plantilla, de la clínica y de OmniClin) y «Al abrir un motivo con esta plantilla».
- **Paciente**: al enviar, la plantilla de su motivo, cuántas preguntas y «Ver cómo lo verá»; en el formulario, los
  apartados de los módulos como pasos, las condicionales debajo de su pregunta (lo de una que no se ve no se manda ni
  se guarda), «(necesaria)» con el bloqueo solo al pulsar «Siguiente» o «Enviar» y el foco en la primera que falta, y
  «¿Quién contesta?» si un módulo lo contesta un familiar. Al recoger nunca se bloquea nada.
- **Exportación**: cada anamnesis con los apartados de su plantilla; plantillas y módulos en el JSON.
- **Móviles sin actualizar** (fase 1): les sale el aviso de siempre «Hay una versión nueva de la app» (`pwa.tsx`).
  Mientras, siguen sincronizando: ven «General» con sus cambios de la fase 1, los tipos nuevos como texto y las
  respuestas de los módulos en «Respuestas a preguntas que ya no están». Límite conocido: si desde uno de esos móviles
  se cambia «General» antes de actualizar, se pueden perder de «General» el orden de los apartados, las obligatorias,
  las preguntas movidas de apartado y lo que propone (son ajustes de la clínica; nunca respuestas de pacientes).
- **Pruebas**: `anamnesisModules.test.ts` (12), `collect.test.ts` (recogida con módulo, condicional, tipos nuevos y
  quién contesta); e2e `modulos.spec.ts` (MD1, MD2) y CL22 (`clinics.spec.ts`).

## Fase 1: hecha y publicada (05-11-2026)

- **Datos** (`src/data/anamnesisTemplates.ts`): plantilla = tronco + cambios; `checkTemplate` con los límites; huella
  sha256 de 12 cifras; puntero `anamnesis_tpl:general` e instantáneas `anamnesis_tpl_v:general:<huella>` al usarse;
  doble escritura de `anamnesis_custom_fields`; operaciones del editor (ocultar, cambiar, subir/bajar, duplicar,
  retirar, volver al original por pregunta, por apartado y entera).
- **Claves internas** (`src/clinical/answerMeta.ts`): `__tpl` (al guardar por primera vez, o al recoger un enlace si
  la anamnesis estaba vacía), `__src` (quién y cuándo, por pregunta) y `__respondent` (menores). No salen como
  respuestas, ni en las banderas, ni en «Cambios sustituidos», ni se copian a otro motivo.
- **Ficha**: «Respuestas a preguntas que ya no están» con el texto de la instantánea; «Lo contestó el paciente, el…»
  y «El paciente contestó: …» si el fisio había escrito otra cosa. Sin enlace para cambiar la plantilla (decisión 15).
- **Editor** (`src/pages/CustomFieldsPage.tsx`): parece la anamnesis; un interruptor por pregunta; hoja «Pregunta»
  con «Así se ve»; añadir con chips (Texto · Opciones · Sí/No con detalle · Escala), presets y «Otro»; aviso al
  ocultar una fija; «Deshacer» de 6 s; solo administradores (los demás ven quién la cambia).
- **Paciente**: enlace v2 con la huella (`tpl`) y la recogida con esa instantánea; paso a paso; 15 preguntas por
  defecto; información de protección de datos siempre con «para qué»; menores; «Prefiero no responder»; textos con
  tope de 500 y contador desde 450.
- **Pruebas**: `src/data/anamnesisTemplates.test.ts`, `src/clinical/answerMeta.test.ts`, ampliadas
  `collect.test.ts`, `customFields.test.ts` y `fieldMerge.test.ts`; e2e `e2e/plantilla.spec.ts`, CL12, CL18 y CL19
  (`e2e/clinics.spec.ts`, el formulario por pasos de un menor) y MJ8.
- **Cambia para las clínicas**: al paciente le llegan 15 preguntas en vez de 33 (decisión 8); las otras 18 se
  encienden en el editor («La contesta: Los dos»).

## Pendiente

- El documento «Módulos de especialidad: contenido revisado v2»: los 6 módulos que faltan (pediátrica, ATM/orofacial,
  vestibular, geriátrica, oncológica y respiratoria) y la versión 2 de los 3 que hay (con lo que ocultan del tronco,
  lo que proponen y lo que destacan). No se inventa: van en `src/data/modulesLibrary.ts` cuando llegue.
- Un móvil sin actualizar ve `__tpl` y `__src` como dos líneas en «Otros datos guardados» (decisión 4).
