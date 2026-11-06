# Cuestionarios propios de la clínica (anamnesis adaptable, fase 3)

Pedido el 05-11-2026. Cada clínica crea sus cuestionarios (satisfacción, adherencia, control semanal…), aunque no
estén validados, y se usan como los demás: en consulta o por enlace, y salen en la ficha, la evolución, la gráfica,
el informe y la exportación. La app calcula suma, media o % del máximo y **nunca interpreta la nota**: sin umbrales,
categorías, colores ni alertas. Etiqueta fija «Cuestionario propio de la clínica · no validado». Regla de oro: **lo ya
respondido no se pierde nunca ni cambia de significado**. No se sube nada sin el visto bueno del usuario.

## Decisiones tomadas con el usuario (05-11-2026)

1. **Orden.** La fase 3 va encima de la fase 1 (publicada el 05-11-2026, `21caa67`); no espera a la fase 2 (módulos),
   que sigue pendiente de su documento. Los cuestionarios propios no dependen de los módulos.
2. **Móviles sin actualizar.** Son pocos: no se hace nada especial para ellos (ni recálculo de pendientes ni formato
   antiguo duplicado). Si alguno tiene problemas, avisará.
3. **Lista: botón «⋯»** de 44 px al final de cada fila con «Duplicar · Renombrar · Archivar», en vez de «mantener
   pulsado». Tocar la fila abre el cuestionario.
4. **Editor con botón «Guardar»** (no se guarda solo): cada guardado es una versión con su huella; a medio montar no
   sale en «Pasar» ni en «Enviar». El borrador se queda en el móvil y, al salir sin guardar, avisa «Tienes cambios sin
   guardar · Guardar · Descartar». Las comprobaciones salen al guardar, junto a cada campo.
5. **Archivar no anula los enlaces ya enviados.** Siguen valiendo hasta su fecha límite (14 días, `FORM_DAYS`) y se
   recogen con la versión enviada; después dejan de valer solos. Se pueden anular a mano antes, desde la ficha del
   paciente (Formularios enviados). La hoja de archivar dice cuántos hay sin contestar.
6. **El paciente rellena por pasos solo si el cuestionario tiene apartados**: un apartado por pantalla («Paso 2 de
   3», «Siguiente», «Atrás»). Sin apartados, todo en una pantalla, como los demás. Los cuestionarios de la app no
   cambian.
7. **Biblioteca, «Satisfacción»** (06-11-2026): la frase «Es anónimo para el resto del equipo: solo lo ve tu
   fisioterapeuta» no es cierta (el equipo con acceso a la ficha lo ve y no es anónimo). Queda: «Lo leerán tu
   fisioterapeuta y el equipo de la clínica que te atiende.», editable como todo lo demás. Criterio del usuario para
   lo que quede: práctico y cuanto más personalizable, mejor.

8. **Biblioteca de OmniClin, añadir = copia de la clínica** (06-11-2026, propuesta 2): «Añadir» guarda una copia
   entera (`own:<uuid>`) con `from: {lib, v}`; desde ese momento es de la clínica y se cambia a gusto. Se puede añadir
   más de una vez (sale «(2)» en el nombre) para tener variantes. La biblioteca no se actualiza sola en las copias.
9. **«Sí/No con detalle»** (06-11-2026, propuesta 3): si contesta «Sí», se le pregunta lo que la clínica escriba
   («Cuéntanos qué») y escribe hasta 500 letras. No puntúa nunca. Se guarda aparte de las respuestas (`details.texts`
   en el registro y `__texts` en el enlace), solo si la pregunta tiene detalle y se contestó «Sí»; se ve en la ficha,
   en la línea de la evolución y en la exportación («Sí: …»).
10. **Por pregunta, en el editor** (06-11-2026, propuesta 4): «Cuenta en la nota» (`uncounted`), «Puede marcar
    varias» (`multiple`: se guardan juntas en un número, una cifra binaria por opción; nunca cuentan ni tienen línea),
    «Casilla para no contestar» (ninguna, «No aplica» o «Prefiero no responder» para las delicadas; las dos cuentan
    como sin responder) y «Verla en la evolución con su línea» (`track`) con «Más es mejor / Menos es mejor / Sin
    flecha», que solo orienta. Una pregunta que no cuenta y no tiene línea no necesita puntos en sus opciones. En las
    instrucciones, «[Clínica]» se cambia por el nombre de la clínica (en el enlace, en consulta, en «Así lo verá» y en
    la Biblioteca; en consulta, el de Ajustes › Clínica o, si está vacío, el de la clínica en la nube).
11. **Instrucciones una sola vez en el enlace** (06-11-2026): en el formulario del paciente, las instrucciones de un
    cuestionario (de la app o propio) van solo en su tarjeta, encima de las preguntas; el saludo ya no las repite.

## Biblioteca de OmniClin (publicada el 06-11-2026, `a9900a0`)

- **Contenido** (`src/data/ownFormsLibrary.ts`), tal como lo pasó el usuario: `lib_satisfaccion` (5 escalas 0-10,
  media, mínimo 3 contestadas), `lib_adherencia` (suma de q1 + q2, 0-7; q3 de varias, q4 con su línea y q5 sin
  puntos no cuentan), `lib_control_semanal` (sin nota; 5 escalas y un Sí/No con detalle, las 6 con su línea; el
  ánimo con «Prefiero no responder») y `lib_vuelta_deporte` (8 Sí/No con «No aplica», suma de Sí, mínimo 6). Todos v1,
  ids de pregunta estables (`q_00000001`…), con la etiqueta fija y sin interpretar nada.
- **Pantallas**: en Ajustes › Cuestionarios propios, debajo de los de la clínica, «Biblioteca de OmniClin» con
  «Añadir» en cada fila; al tocar la fila, la nota para el profesional y «Así lo verá el paciente» antes de añadirlo.
  «Ya lo tienes» si hay una copia. El editor, con los interruptores de la decisión 10.
- **Evolución**: en la tarjeta del cuestionario, «Pregunta a pregunta» con cada pregunta seguida, su última respuesta
  en texto, «más/menos es mejor» si la tiene y su línea. Cada pase se lee con su versión (`src/clinical/ownTrack.ts`).
- **Pruebas**: `ownFormsLibrary.test.ts`, `ownTrack.test.ts`, más casos en `own.test.ts` y `collect.test.ts`; e2e
  CP3 (`cuestionarios-propios.spec.ts`, en 360 px) y CL21 (`clinics.spec.ts`, por enlace).

## Hecho y publicado (05-11-2026, `5317538`)

- **Motor** (`src/clinical/forms/own.ts`): `OwnFormSpec` como datos; `buildForm` lo convierte en un cuestionario de
  la app; nota con suma, media o % del máximo (y subescalas), «No aplica» con block o skip y mínimo de contestadas.
  Las opciones y el Sí/No se guardan por su posición (dos opciones con los mismos puntos no se confunden).
  `checkOwnForm`: ≤ 10 apartados, ≤ 60 preguntas, ≤ 32 KB, textos acotados, ids `q_<8 hex>`, opciones ≥ 2 sin repetir,
  puntos numéricos, rangos coherentes; las claves que no conoce se quitan (no se puede guardar un umbral).
- **Versiones** (`src/data/ownForms.ts`): puntero `own_q:<uuid>` y cada versión en `own_q_v:<uuid>:<huella>`;
  archivar, duplicar, renombrar; aviso de derechos `own_q_notice`. La nota para el profesional lleva el nombre de la
  clínica y la fecha en que se escribió.
- **Catálogo** (`src/clinical/ownCatalog.ts` y `OwnFormsLoader.tsx`): los propios entran en `getKind`, `formFor`
  (con huella, la versión exacta), `activeKinds`, `sendableKinds`, el selector («De la clínica») y la Biblioteca.
- **Resultados**: `details.own` con la huella, el nombre, el rango, «más/menos es mejor» y la nota para el
  profesional de esa versión. Sin nota: se guardan las respuestas y se ve «Sin nota». En el alta, solo el cambio
  («+3», «Igual»), sin «Mejor» ni «Peor».
- **Etiqueta fija** «Cuestionario propio de la clínica · no validado»: en el formulario del paciente («de [Clínica]»),
  al pasarlo, en la ficha y las tarjetas con la gráfica, la línea de tiempo, el informe, el alta, la carta de
  derivación y la exportación.
- **Enlace**: va la versión entera (`FormRequest.form`) y su huella (`meta.hash`); se recoge y puntúa con ella.
- **Pantallas**: Ajustes › Cuestionarios propios (lista con «⋯») y el editor con «Guardar», «Así lo verá» y aviso al
  salir con cambios.
- **Pruebas**: `own.test.ts`, `ownForms.test.ts`, `questionnaires.test.ts`, `collect.test.ts`; e2e
  `cuestionarios-propios.spec.ts` (CP1, CP2) y CL20 en `clinics.spec.ts`.

## Pendiente

- Nada de la biblioteca. Lo que queda para más adelante está en `docs/ideas-pendientes.md`.
