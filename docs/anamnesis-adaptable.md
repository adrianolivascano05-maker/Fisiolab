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

## Fase 1: hecha (pendiente del visto bueno para subir)

- **Datos** (`src/data/anamnesisTemplates.ts`): plantilla = tronco + cambios; `checkTemplate` con los límites; huella
  sha256 de 12 cifras; puntero `anamnesis_tpl:general` e instantáneas `anamnesis_tpl_v:general:<huella>` al usarse;
  doble escritura de `anamnesis_custom_fields`; operaciones del editor (ocultar, cambiar, subir/bajar, duplicar,
  retirar, volver al original por pregunta, por apartado y entera).
- **Claves internas** (`src/clinical/answerMeta.ts`): `__tpl` (al guardar por primera vez, o al recoger un enlace si
  la anamnesis estaba vacía), `__src` (quién y cuándo, por pregunta) y `__respondent` (menores). No salen como
  respuestas, ni en las banderas, ni en «Cambios sustituidos», ni se copian a otro motivo.
- **Ficha**: «Respuestas a preguntas que ya no están» con el texto de la instantánea; «Lo contestó el paciente, el…»
  y «El paciente contestó: …» si el fisio había escrito otra cosa; enlace «Ajustar la plantilla de la clínica».
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

- El documento «Módulos de especialidad: contenido revisado v2» (los 9 módulos de OmniClin). No se inventa: hasta
  que llegue, la fase 2 se hace sin contenido de módulos.
- Los paquetes «Para empezar, por especialidad» siguen en el editor (ahora añaden preguntas a la plantilla); en la
  fase 2 los sustituyen los módulos.
- Un móvil sin actualizar ve `__tpl` y `__src` como dos líneas en «Otros datos guardados» (decisión 4).
