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

## Pendiente

- El contenido exacto de los 4 cuestionarios de la biblioteca de OmniClin (`src/data/ownFormsLibrary.ts`): lo pasa el
  usuario. No se inventa.
