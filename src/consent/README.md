# Consentimientos informados

Documentos que el paciente (o su representante) firma antes de un tratamiento, preparados con su anamnesis. Se
firman en la pantalla, con el dedo, o se imprimen y se firman en papel. Se pueden retirar.

**No es asesoramiento legal ni está validado clínicamente.** Los textos son modelos de trabajo: hay que revisarlos
con el colegio profesional o la asesoría jurídica de la clínica antes de usarlos.

## Qué pide la ley (resumen)

- **Ley 41/2002, de autonomía del paciente, art. 8.** El consentimiento es verbal por regla general, pero **por
  escrito** en los procedimientos diagnósticos y terapéuticos **invasores** y en los que tienen **riesgos de notoria
  y previsible repercusión negativa** sobre la salud. En fisioterapia: punción seca, electrólisis percutánea,
  neuromodulación percutánea y exploración o tratamiento intracavitario (suelo pélvico), y lo recomendable en la
  manipulación de alta velocidad. Se puede **retirar por escrito en cualquier momento** (art. 8.5).
- **Art. 10.** Antes de firmar hay que informar de las consecuencias seguras, los **riesgos relacionados con las
  circunstancias personales** del paciente, los riesgos probables y las contraindicaciones. Los riesgos personales
  son los que salen de la anamnesis.
- **Art. 9.** Desde los 16 años firma el propio paciente; por debajo, su representante legal, después de escuchar al
  menor según su madurez. En actuaciones de grave riesgo, también los representantes de los de 16 y 17 años.
- **Protección de datos (RGPD y LOPDGDD).** Es aparte: la información del art. 13 y los consentimientos opcionales
  (fotos y vídeos, contacto, docencia) están en la ficha → Protección de datos (`src/privacy`).
- **Firma en la pantalla.** Es una firma electrónica simple (Reglamento eIDAS): vale como prueba, menos que una
  firma avanzada. Se guarda el documento entero tal como se firmó, con la fecha y las firmas, dentro de la historia
  (cifrada si la copia de la nube lo está). Si la clínica quiere más garantía, que imprima y firme en papel.

## Cómo se hace en la app

| Qué | Dónde | Archivo |
| --- | --- | --- |
| Precauciones de la anamnesis (anticoagulantes, marcapasos, embarazo, osteoporosis…) y las palabras que las delatan en el texto libre | anamnesis → Antecedentes → Precauciones | `precautions.ts` |
| Cinco plantillas cortas, una por grupo de técnicas: valoración y tratamiento (con las pruebas físicas), tratamientos invasivos, manipulaciones, electroterapia y otros aparatos (con las ondas de choque) y suelo pélvico; cuándo se proponen y qué añaden según la anamnesis | — | `templates.ts`, `types.ts` |
| Lo que importa de la ficha para los consentimientos | — | `context.ts` |
| Lista (firmados, propuestos, otros), preparar, firmar, imprimir y retirar | ficha → Resumen → Consentimientos (`/pacientes/:id/consentimientos`) | `ConsentPages.tsx`, `ConsentDocumentView.tsx`, `../ui/SignaturePad.tsx` |
| Guardar y retirar | — | `../data/consents.ts`, migración `011_consents.sql` |

- **Cortos y por grupos**: cada documento nombra el grupo con ejemplos («Tratamientos invasivos, como la punción
  seca, la electrólisis percutánea o la neuromodulación percutánea, etc.») y tiene cinco apartados: qué es,
  riesgos, lo de su caso según su historia (solo si hay algo), cuándo no se aplica y alternativas. La declaración
  de la firma resume los derechos: ha podido preguntar, el resultado no se garantiza, lo puede retirar por escrito
  y recibe una copia.
- **Se proponen solos**: el de valoración y tratamiento siempre; los demás si el plan de intervención o el
  diagnóstico los nombran (punción, electrólisis, manipulación, TENS, ondas de choque, suelo pélvico…). El resumen
  de la ficha avisa de los que la ley pide por escrito y faltan.
- **Riesgos personales**: cada plantilla añade los suyos según las precauciones marcadas, la zona, la edad y las
  banderas rojas («Como toma anticoagulantes, el riesgo de hematoma es mayor…»). Las contraindicaciones absolutas
  salen en rojo para el fisioterapeuta. Lo que está escrito en el texto libre y no marcado («Sintrom») solo avisa al
  fisioterapeuta: no pasa al documento hasta que se marca.
- **Lo firmado no cambia**: se guarda el texto entero y la versión de la plantilla. Un consentimiento firmado no se
  borra (es historia clínica): se retira, con fecha, motivo y, si está, la firma del paciente.
- **Motivo de consulta**: cada consentimiento va al motivo que se está viendo, como las sesiones.

## ¿Y la inteligencia artificial?

Generar el texto con un modelo de IA haría falta una API de pago y mandar la anamnesis (datos de salud) a otro
proveedor, que sería otro encargado del tratamiento. Además, cada vez saldría un texto distinto y podría inventar
riesgos. Por eso la app **los genera sola con reglas**: el texto base es fijo y revisable, y lo personal sale de la
anamnesis de forma predecible. El mismo paciente con la misma anamnesis tiene siempre el mismo documento.

## Fuentes

- Ley 41/2002, básica reguladora de la autonomía del paciente (arts. 8, 9 y 10), BOE.
- Consentimiento informado en fisioterapia: revisión en *Enfermería Clínica* (Elsevier), congreso «Fisioterapia y
  práctica clínica diaria», y el modelo de la Junta de Andalucía para la electroestimulación del suelo pélvico.
- Reglamento (UE) 910/2014 (eIDAS) y Ley 6/2020 de servicios electrónicos de confianza.

**Marca de la clínica (25-10-2026).** El documento guarda en `brand` la marca con la que se firmó (nombre, colores,
logo, placa y si llevaba marca de agua; null si era la de Cénit): `ConsentDocumentView` lo pinta siempre con esa,
aunque la clínica cambie de marca después. Los firmados antes de haber marca no llevan el campo y se ven como
entonces, con la de Cénit (`src/brand/docs.tsx`).
