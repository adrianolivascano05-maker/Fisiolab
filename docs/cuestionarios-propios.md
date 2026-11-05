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

- El contenido exacto de los 4 cuestionarios de la biblioteca de OmniClin (`src/data/ownFormsLibrary.ts`): lo pasa el
  usuario. No se inventa.
