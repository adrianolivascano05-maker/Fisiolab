# Reel «Palpamos el nivel correcto la mitad de las veces» · entregables

**Pilar:** Mito vs. evidencia · **Público:** estudiantes y fisios clínicos · **Formato:** 1080×1920, 30 fps, H.264 CRF 18, AAC.

## Portada
Línea 1: **¿Seguro que es L4?**
Dato grande: **47 %**
Subtítulo: ACIERTOS DE VÉRTEBRA EXACTA
(Se renderiza con `npx remotion still Portada out/portada.png`.)

## Descripción del post
Cinco fisioterapeutas de terapia manual con experiencia palparon L1, L3 y L5 en 75 pacientes con lumbalgia. Marcador radiopaco en la piel y radiografía lateral para comprobarlo.

- **47 %** de los marcadores quedaron exactamente sobre la espinosa indicada.
- **72 %** quedaron exactos o, de forma consistente, a un nivel de distancia.
- IMC, edad y sexo no influyeron. **El mayor efecto fue el terapeuta** que palpaba (variabilidad entre terapeutas).

Lo que significa: la palpación te lleva a la zona, no a la vértebra. Mañana en consulta: habla de «zona lumbar baja» y busca el dolor que el paciente reconoce como suyo.

Aviso: estudio pequeño (5 terapeutas, 75 pacientes) y de 2007: tómalo como orientación, no como verdad absoluta.

Referencias:
1. Harlick JC, Milosavljevic S, Milburn PD. Palpation identification of spinous processes in the lumbar spine. Man Ther. 2007;12(1):56-62. doi:10.1016/j.math.2006.02.008
2. Custers P, Van de Kelft E, Eeckhaut B, et al. Clinical Examination, Diagnosis, and Conservative Treatment of Chronic Low Back Pain: A Narrative Review. Life (Basel). 2024;14(9):1090. doi:10.3390/life14091090

¿Tú lo dices en consulta? Comenta «L4».

#fisioterapia #lumbalgia #fisioterapeuta #terapiamanual #evidenciacientifica #estudiantesdefisio #dolorlumbar

## 3 ganchos alternativos (A/B)
1. «¿Seguro que eso que tocas es L4?»
2. «Este estudio debería enseñarse en primero de fisio.»
3. «Lo que más influye en acertar la vértebra no es el paciente. Eres tú.»

## Cambio de guion (v2)
Se añade una frase de quiz antes del dato, para que el espectador apueste: «¿Cuántos crees que acertaron?» (en pantalla: 90 % · 75 % · 60 %, un dedo pulsa el 75 % y luego las tres se tachan cuando llega el 47 %). No cambia ningún dato.

## Notas de rigor aplicadas
- No se dice que el estudio midiera L4 (midió L1, L3 y L5). «L4» aparece solo como ejemplo de lo que se dice en consulta.
- No se dice «como lanzar una moneda»: la moneda es solo imagen en el gancho (si prefieres quitarla, borra `<Coin>` en `src/scenes/Gancho.tsx`).
- Custers 2024 atribuye el 47 % a «Nolet et al.» por error; se cita el original (Harlick 2007).
- Fuente en pantalla durante los datos y al final.

---

# Propuesta de guion (ya producida) · El test de Kemp

**Pilar:** Mito vs. evidencia · **Público:** fisios clínicos · Datos solo de Custers et al., Life 2024 (apartado 3.2.5 «Prueba de Kemp» y «Resumen de especificidad y sensibilidad»; apartado 5.2 «Dolor facetario unilateral»).

| Escena | Voz | En pantalla |
|---|---|---|
| Gancho | «Extensión con rotación, dolor… y escribes "facetario". Ese test ni confirma ni descarta.» | «NI CONFIRMA NI DESCARTA» de golpe con temblor; silueta haciendo el Kemp |
| Prueba | «Lo dice una revisión de 2024 que juntó los datos de los estudios que lo midieron.» | Fogonazo; «REVISIÓN 2024» en cian; chip «revisión narrativa» |
| Hallazgo | «Sensibilidad: de 0,23… a 1. Especificidad: de 0,116… a 0,673.» | Dos barras que oscilan entre su mínimo y su máximo; contador que no se decide |
| Giro | «Con esa especificidad, el Kemp sale positivo en mucha gente sin dolor facetario. Y con esa sensibilidad, un negativo tampoco te deja tranquilo.» | Fila de siluetas: muchas se iluminan en rojo «positivo» sin facetas; ✗ sobre «negativo = descartado» |
| Matiz | «La revisión no dice que no sirva. Dice que es una pieza: dolor que aumenta con la extensión, que no suele pasar de la rodilla y exploración neurológica normal.» | Puzle de 4 piezas: Kemp + extensión + «no pasa de la rodilla» + «neuro normal» |
| Qué hacer | «Así que no escribas "facetario" solo por un Kemp. Anota los cuatro datos.» | Ficha clínica con «facetario» tachado → lista de 4 ✓ |
| CTA | «Comenta "Kemp" si lo usas a diario. Y en la parte 3: la sacroilíaca, donde un test no basta y necesitas tres.» | Botón «Comenta Kemp»; tarjeta «PARTE 3 →» |

Duración objetivo: 40–45 s. Limitación obligatoria en la descripción: revisión narrativa (no sistemática) que recoge datos de otros estudios; los rangos tan amplios reflejan estudios heterogéneos.
Sello final sugerido: «VALOR LIMITADO». Teaser verificado en el reel 6 de Custers (Telli 2008: tres o más pruebas de provocación positivas; FABERE el más sensible, 91,4 %).

---

# Reel 2 · «El test de Kemp no confirma ni descarta» · entregables

**Pilar:** Mito vs. evidencia · **Público:** fisios clínicos y estudiantes · **Duración:** 47,6 s · Composición `Kemp` (carpeta `src/videos/kemp/`, assets en `public/kemp/`).

## Portada
Línea 1: **Kemp positivo** · Dato: **≠ facetario** · Subtítulo: NI CONFIRMA NI DESCARTA (`npx remotion still Kemp-Portada out/portada-kemp.png`).

## Guion locutado
Kemp positivo. Y anotas: facetario. Pues ese test ni confirma ni descarta. / Lo dice una revisión de 2024 que reunió los datos de los estudios que lo midieron. / Sensibilidad: de 0,23… a 1. Especificidad: de 0,116… a 0,673. / Entonces, un Kemp positivo, ¿confirma o descarta? / Con esa especificidad, sale positivo en mucha gente sin dolor facetario. Y con esa sensibilidad, un negativo tampoco te deja tranquilo. / La revisión no dice que no sirva. Dice que es una pieza: dolor que aumenta al extender, que no suele pasar de la rodilla, y exploración neurológica normal. / Así que no escribas «facetario» solo por un Kemp. Anota las cuatro piezas. / Comenta «Kemp» si lo usas a diario.

## Descripción del post
Extensión con rotación, duele, y escribimos «facetario». Pero el test de Kemp, por sí solo, no lo sostiene.

- **Sensibilidad: de 0,23 a 1.** Tan variable que un negativo no te deja tranquilo.
- **Especificidad: de 0,116 a 0,673.** Tan baja que sale positivo en mucha gente sin dolor facetario.
- Conclusión de la revisión: **ni confirma ni descarta de forma fiable**. Es una pieza, no un veredicto.

Mañana en consulta: no escribas «facetario» por un Kemp. Júntalo con dolor que aumenta al extender, que no suele pasar de la rodilla y exploración neurológica normal (así describe la revisión el dolor facetario unilateral).

Aviso: revisión narrativa (no sistemática) que recoge los valores de una revisión sistemática de 2014; los rangos tan amplios reflejan estudios heterogéneos. «Sensible y negativo descarta, específico y positivo confirma» es la interpretación estándar de esos valores, no una frase del paper.

Referencias:
1. Stuber K, Lerede C, Kristmanson K, Sajko S, Bruno P. The diagnostic accuracy of the Kemp's test: a systematic review. J Can Chiropr Assoc. 2014;58(3):258-267.
2. Custers P, Van de Kelft E, Eeckhaut B, et al. Clinical Examination, Diagnosis, and Conservative Treatment of Chronic Low Back Pain: A Narrative Review. Life (Basel). 2024;14(9):1090. doi:10.3390/life14091090

¿Qué combinas tú con el Kemp? Comenta «Kemp».

#fisioterapia #lumbalgia #fisioterapeuta #terapiamanual #evidenciacientifica #estudiantesdefisio #dolorlumbar #testdekemp

## 3 ganchos alternativos (A/B)
1. «Un Kemp positivo no te dice que el dolor sea facetario.»
2. «Especificidad 0,116. Repito: cero coma ciento dieciséis.»
3. «El test que haces a diario y que la evidencia no respalda solo.»

## Dónde verificarlo
Custers 2024: apartado 3.2.5 «Kemp's Test» (valores y «neither reliably confirms nor excludes»), tabla 5 (referencia 25 = Stuber 2014) y apartado 5.2 «Unilateral Facet Joint Pain» (dolor que aumenta con la extensión, no suele pasar de la rodilla, Kemp a menudo positivo, exploración neurológica normal).

---

# Propuesta de guion (descartada) · La sacroilíaca, un test no basta

**Pilar:** Aplicación clínica en 1 minuto · **Público:** fisios clínicos · Datos de Custers 2024, apartados 3.4 (30 % de las lumbalgias atribuidas a la sacroilíaca), 3.4.1 (FABERE), 3.4.2 (provocación) y 3.4.3 (Telli et al. 2008).

| Escena | Voz | En pantalla |
|---|---|---|
| Gancho | «Para la sacroilíaca, un test no basta. Necesitas tres.» | «1 TEST» tachado → «3» gigante |
| Prueba | «Lo dice una revisión de 2024 que cita un estudio de Telli, de 2008, sobre fiabilidad y validez de estos tests.» | Tarjeta «Life 2024» → ficha «Telli 2008» |
| Problema | «La revisión atribuye a la sacroilíaca el 30 % de las lumbalgias. Y muchas veces se etiqueta con un solo test positivo.» | 10 siluetas, 3 se iluminan; ficha con «sacroilíaca» por un solo test |
| Hallazgo | «Ese estudio concluyó que se puede hablar de disfunción sacroilíaca cuando tres o más pruebas de provocación son positivas: distracción, compresión, empuje del muslo, Gaenslen y cizallamiento.» | Contador 1-2-3 con las cinco pruebas en pictogramas |
| Giro | «Y el más sensible fue el FABERE, el del cuatro: noventa y uno coma cuatro por ciento.» | Pierna en «4» y «91,4 %» con anillo |
| Matiz | «Un test muy sensible sirve sobre todo para descartar: si sale negativo, la sacroilíaca baja en tu lista. Y ojo: la revisión admite que la sacroilíaca está menos investigada.» | «NEGATIVO → BAJA EN LA LISTA»; chip «menos investigada» |
| Qué hacer | «Mañana: haz las cinco de provocación y cuenta positivos antes de etiquetar.» | Lista de cinco con contador de positivos |
| CTA | «Comenta "tres" si ya las cuentas. Y en la parte 4: el Lasègue, el test que la propia revisión interpreta al revés.» | Botón «Comenta tres»; tarjeta «PARTE 4 →» |

Limitación obligatoria: revisión narrativa; el criterio «3 o más positivas» y el 91,4 % salen de un único estudio (Telli 2008); «sensible y negativo descarta» es interpretación estándar, no frase del paper. Teaser verificado: Custers invierte la interpretación de SLR y SLR cruzada (reel 2 de Custers).

---

# Reel 3 · «Test del 4 positivo: ¿qué mide de verdad el 91,4 %?» · entregables

**Pilar:** Lectura crítica · **Público:** fisios clínicos y estudiantes · **Duración:** 60,4 s · Composición `Sacroiliaca` (`src/videos/sacroiliaca/`, assets en `public/sacroiliaca/`).

## Hilo de la narración (v2)
1. **Caso clínico:** dolor en la nalga, test del 4 positivo, ¿ya es la sacroilíaca?
2. **Lo que dice la revisión:** Custers 2024 afirma que el test detecta el 91,4 %.
3. **Lo que hizo el estudio original** (Telli 2018): 117 pacientes que ya tenían el diagnóstico; el diagnóstico era tener 3 o más de 6 tests de provocación positivos, y el test del 4 estaba en esa batería.
4. **La trampa:** el 91,4 % solo dice cuántos dieron positivo en un test que ya formaba parte de su diagnóstico. Analogía: probar un detector de humo usando, en parte, ese mismo detector para decidir si había fuego. Sin infiltración de referencia ni pacientes sin el problema, no sabemos cuánto acierta.
5. **Lo útil:** según los autores, un test suelto vale poco; la batería, más.
6. **Mañana:** no etiquetes sacroilíaca por un test del 4; haz la batería y cuenta positivos.
7. **CTA** «original» y teaser de la parte 4 (Lasègue).

El error de fecha de la revisión (dice 2008; el estudio es de 2018) ya no se narra para no romper el hilo: el vídeo dice «estudio original, de 2018» y el error queda en la descripción.

## Portada
Línea 1: **Test del 4 positivo:** · Dato: **91,4 %** · Subtítulo: ¿QUÉ MIDE DE VERDAD? (`npx remotion still Sacroiliaca-Portada out/portada-sacroiliaca.png`).

## Guion locutado
Dolor en la nalga. Test del 4, positivo. ¿Ya es la sacroilíaca? / Una revisión de 2024 dice que este test detecta el 91,4 %. Fui al estudio original, de 2018. Y ese número cuenta otra historia. / 117 pacientes, todos ya diagnosticados. ¿Cómo? Con 6 tests: 3 positivos o más, y era sacroilíaca. Y el test del 4 estaba en esa misma batería. / Entonces, ¿qué mide ese 91? / Cuántos dieron positivo en un test que ya formaba parte de su diagnóstico. / Es como probar un detector de humo usando, en parte, ese mismo detector para decidir si había fuego. Sin compararlo con una infiltración, ni con pacientes sin el problema, no sabemos cuánto acierta. / Lo útil: según los autores, un test suelto vale poco; la batería, más. / Mañana: no etiquetes sacroilíaca por un test del 4. Haz la batería y cuenta positivos. / Comenta «original» si quieres más lecturas así. Y en la parte 4: el Lasègue, que esta revisión interpreta al revés.

## Descripción del post
Test del 4 (FABER) positivo y escribimos «sacroilíaca». Una revisión de 2024 dice que este test detecta el 91,4 % de los casos. Fuimos al estudio original.

- **Quiénes:** 117 pacientes que ya tenían el diagnóstico de disfunción sacroilíaca.
- **Cómo se diagnosticaron:** 3 o más positivos en una batería de 6 tests de provocación, y el test del 4 era uno de ellos.
- **Qué es el 91,4 %:** cuántos de esos pacientes dieron positivo en el test del 4. Como el test ayudó a decidir el diagnóstico, el dato se infla: es como probar un detector de humo usando ese mismo detector para decidir si había fuego.
- **Qué faltó:** compararlo con una infiltración y con pacientes sin el problema. Sin eso no sabemos cuánto acierta de verdad.
- **Lo útil:** según los autores, cada test por separado tiene fiabilidad y validez limitadas; la batería de provocación es más fiable.

Mañana en consulta: no etiquetes «sacroilíaca» por un test del 4 positivo. Haz la batería y cuenta positivos.

Detalle extra: la revisión cita el estudio como «Telli 2008», pero es de 2018 (Pain Physician 21(4)).

Aviso: estudio retrospectivo de una sola clínica (117 pacientes), con concordancia solo intraobservador. Tómalo como orientación.

Referencias:
1. Telli H, Telli S, Topal M. The Validity and Reliability of Provocation Tests in the Diagnosis of Sacroiliac Joint Dysfunction. Pain Physician. 2018;21(4):E367-E376. PMID: 30045603.
2. Custers P, Van de Kelft E, Eeckhaut B, et al. Clinical Examination, Diagnosis, and Conservative Treatment of Chronic Low Back Pain: A Narrative Review. Life (Basel). 2024;14(9):1090. doi:10.3390/life14091090

¿Lees el original antes de citar una revisión? Comenta «original».

#fisioterapia #lumbalgia #sacroiliaca #fisioterapeuta #evidenciacientifica #estudiantesdefisio #lecturacritica #dolorlumbar

## 3 ganchos alternativos (A/B)
1. «Test del 4 positivo. ¿Ya es la sacroilíaca? Mira cómo se sacó el 91 %.»
2. «Un detector de humo que decide si había fuego. Así se calculó este 91,4 %.»
3. «El 91,4 % del test del 4 tiene trampa. Y está en el método.»

## Dónde verificarlo
- Telli 2018, resumen (PubMed 30045603): pacientes «diagnosed with SIJD through clinical evaluation»; «Positivity in 3 out of 6 provocation tests was adopted as the criterion»; «When SI joint provocation tests were analyzed individually, the highest positivity, in 91.4% patients diagnosed with SIJD, was in the FABER test»; limitaciones: sin concordancia interobservador y sin comparación con infiltración; conclusión: los tests sueltos tienen fiabilidad y validez limitadas y la batería es fiable.
- **Pendiente de comprobar en el texto completo** (no accesible desde aquí): la lista exacta de los 6 tests del criterio. Que el FABER esté entre ellos se deduce del resumen (el 91,4 % sale de analizar «los tests de provocación» uno a uno) y de Custers 2024, que lista FABER + 5 de provocación. Si al leer los Métodos el FABER no estuviera en el criterio, hay que cambiar la frase «el test del 4 estaba en esa misma batería» y la analogía.
- Custers 2024: apartado 3.4.3 «Specificity and Sensitivity» (dice «Telli et al. from 2008» y «highest sensitivity… FABERE (91.4%)»); bibliografía, ref. 28 (Pain Physician 2018).

---

# Vídeo · «Lasègue: ¿confirma o descarta? La revisión lo dice al revés» · entregables

Cada vídeo se entiende solo: ninguno anuncia «la parte siguiente», así que puedes publicarlos en el orden que quieras. El reel de la sacroilíaca queda aparcado (`src/videos/sacroiliaca/`).
**Pilar:** Lectura crítica · **Público:** estudiantes y fisios clínicos · **Duración:** 64,2 s · Composición `Lasegue` (`src/videos/lasegue/`, assets en `public/lasegue/`).

## Hilo
1. **Caso:** dolor que baja por la pierna, Lasègue positivo: ¿confirma o descarta?
2. **Lo que responde la revisión:** confirma. **Pero sus propios números** dicen lo contrario.
3. **Los números:** sensibilidad hasta 0,98 (casi todos los que tienen el problema dan positivo); especificidad que baja hasta 0,10 (también positivo en mucha gente sin el problema).
4. **Quiz:** un Lasègue negativo, ¿qué te dice?
5. **Respuesta:** la tensión de la raíz se vuelve poco probable. Muy sensible y negativo: descarta.
6. **El cruzado, al revés:** se eleva la pierna sana y duele la otra; especificidad hasta 0,98. Muy específico y positivo: confirma.
7. **La revisión lo escribe al revés.** Lección: lee los números, no solo la conclusión.
8. **Mañana:** Lasègue negativo, la raíz baja en tu lista; Lasègue positivo, no pares: añade el cruzado.
9. **CTA:** comenta «cruzado».

## Portada
Línea 1: **Lasègue positivo:** · Dato: **¿confirma?** · Subtítulo: LA REVISIÓN LO DICE AL REVÉS (`npx remotion still Lasegue-Portada out/portada-lasegue.png`).

## Descripción del post
Lasègue positivo. ¿Confirma o descarta? Una revisión de 2024 responde «confirma». Sus propios números dicen lo contrario.

- **Lasègue (elevación de la pierna recta):** sensibilidad de 0,73 a 0,98; especificidad de 0,10 a 1. Muy sensible: si sale **negativo**, la tensión de la raíz (L5-S1) se vuelve poco probable.
- **Lasègue cruzado** (se eleva la pierna sana y duele la otra): sensibilidad de 0,23 a 0,43; especificidad de 0,88 a 0,98. Muy específico: si sale **positivo**, la hace mucho más probable.
- **La revisión lo interpreta al revés:** dice que el Lasègue sirve para confirmar y el cruzado para descartar.

Mañana en consulta: Lasègue negativo, la raíz baja en tu lista. Lasègue positivo, no pares ahí: añade el cruzado.

Aviso: revisión narrativa que agrega estudios distintos, por eso los rangos son tan amplios. «Muy sensible y negativo descarta; muy específico y positivo confirma» es la regla clásica de interpretación de esos valores, no una frase de la revisión.

Referencia:
Custers P, Van de Kelft E, Eeckhaut B, et al. Clinical Examination, Diagnosis, and Conservative Treatment of Chronic Low Back Pain: A Narrative Review. Life (Basel). 2024;14(9):1090. doi:10.3390/life14091090 (valores tomados de Deyo 2016, Vroomen 1999, Devillé 2000, van der Windt 2010 y Braddom, refs. 2 y 21-24).

¿Haces siempre el cruzado? Comenta «cruzado».

#fisioterapia #lumbalgia #lasegue #fisioterapeuta #evidenciacientifica #estudiantesdefisio #lecturacritica #ciatica

## 3 ganchos alternativos (A/B)
1. «Lasègue positivo no confirma. Y la revisión que lo dice se contradice con sus propios números.»
2. «Sensibilidad 0,98. ¿Para confirmar o para descartar?»
3. «El test que todos hacemos para la ciática, explicado al revés en una revisión de 2024.»

## Dónde verificarlo
Custers 2024, apartado 3.2.5: «Straight Leg Raising» (sensibilidad «consistently above 0.73, reaching up to 0.98»; especificidad «from 0.10 to 1»; «robust tool for ruling in neural tension»), «Crossed Straight Leg Raise» (sensibilidad 0,23-0,43; especificidad 0,88-0,98; «useful for confirming the absence of neural tension») y «Summary of Specificity and Sensitivity» (repite la inversión). Teaser verificado en 4.1.8 «Exercise» (metaanálisis de Fernández et al.: todos los tipos de ejercicio fueron eficaces salvo los estiramientos para el dolor).

## Cambio en los cierres (todos los vídeos)
Se ha quitado la frase final «Y en la parte…» de los tres vídeos (palpación, Kemp y Lasègue) sin regenerar la voz: se recorta de la toma y el cierre pasa a ser el comentario con la palabra clave, «SÍGUEME» y «guárdalo para consulta».

---

# Propuesta de guion (pendiente) · Estirar, el único ejercicio que no funcionó

**Pilar:** Mito vs. evidencia · **Público:** pacientes, deportistas y fisios · Datos de Custers 2024, apartado 4.1.8 (metaanálisis de Fernández et al., refs. 49-51) y frase sobre el yoga (ref. 61). Corresponde al reel 7 del doc de guiones de Custers, ya verificado.

| Escena | Voz | En pantalla |
|---|---|---|
| Gancho | «Te duele la espalda y lo primero que haces es estirar. Para el dolor, fue lo único que no funcionó.» | Figura estirando con ✗ |
| Prueba | «Lo recoge la misma revisión de 2024, citando un metanálisis.» | Tarjeta Life 2024 + «metanálisis» |
| Datos | «Todos los tipos de ejercicio fueron eficaces para el dolor… menos los estiramientos.» | Fila de ejercicios con ✓ y estiramientos ✗ |
| Quiz | «¿Cuál salió el más eficaz?» | Opciones: FUERZA / PILATES / YOGA |
| Hallazgo | «Pilates, para el dolor y la discapacidad. Detrás, mente-cuerpo, core y fuerza.» | Podio |
| Giro | «Y para el yoga, evidencia sólida a corto y largo plazo.» | Barra de evidencia |
| Matiz | «Ojo: son datos citados, y la revisión admite que cuesta señalar un ejercicio superior.» | Sello «orientación» |
| Qué hacer | «Mañana: control y carga antes que solo estirar.» | Checklist |
| CTA | «Comenta "pilates" si lo recomiendas.» | Botón y comentario |

---


---

# Vídeo · «Tu tendón cambia 2 días después del partido (y vuelve al 4)» · entregables

**Artículo:** Cook JL, Rio E, Purdam CR, Docking SI. Revisiting the continuum model of tendon pathology: what is its merit in clinical practice and research? Br J Sports Med 2016;50:1187-1191. doi:10.1136/bjsports-2015-095422 (Cook 2016 · reel 7).
**Pilar:** El dato que nadie te contó · **Público:** fisios clínicos y deportistas · **Duración:** ~51 s · Composición `Tendon` (`src/videos/tendon/`, assets en `public/tendon/`).
**Tipo de datos (nuevo):** curso temporal en días (0, 2, 4), mecanismo biológico (proteoglicanos que atrapan agua) y una incógnita abierta. Nada de sensibilidad ni especificidad.

## Hilo
1. **Caso:** partido el domingo; el martes su Aquiles sale distinto en la ecografía. ¿Se está lesionando?
2. **Quién lo dice:** revisión de 2016 de los creadores del modelo continuo, con futbolistas australianos y caballos de carreras.
3. **La evolución:** día 0, carga alta; día 2, un cambio claro pero sutil en la imagen; día 4, vuelve a la normalidad.
4. **Quiz:** ¿qué ha cambiado en esos 2 días? (se ha roto / inflamación / otra cosa).
5. **El mecanismo probable:** el «relleno»: proteoglicanos, moléculas que atrapan agua, que tardan 2-3 días en fabricarse y romperse: el mismo ritmo.
6. **El giro:** el colágeno apenas se renueva en el adulto; lo rápido no parecen ser las fibras.
7. **Lo que no se sabe:** si es adaptación o el comienzo de un problema.
8. **Mañana:** antes de mirar una ecografía, pregunta cuándo fue la última carga alta; el día 2 y el día 4 no muestran el mismo tendón.
9. **CTA:** comenta «día 2».

## Portada
Línea 1: **Día 2 cambia,** · Dato: **día 4 vuelve** · Subtítulo: TU TENDÓN TRAS UN PARTIDO (`npx remotion still Tendon-Portada out/portada-tendon.png`).

## Descripción del post
Partido el domingo. El martes, la ecografía del Aquiles sale distinta. ¿Se está lesionando? No necesariamente.

- **Día 2:** tras cargas altas, el tendón muestra un cambio claro pero sutil en la imagen (Aquiles de futbolistas australianos y tendón flexor de caballos de carreras).
- **Día 4:** vuelve a la normalidad.
- **El porqué probable:** los proteoglicanos, moléculas del «relleno» que atrapan agua, tardan 2-3 días en fabricarse y degradarse; la resonancia también sugiere más proteoglicanos y agua ligada tras cargas altas. El colágeno, en cambio, apenas se renueva en el adulto.
- **Lo que no se sabe:** si este cambio es adaptativo o el inicio de un problema, ni si deja efecto duradero.

Mañana en consulta: antes de interpretar una ecografía de tendón, pregunta cuándo fue la última carga alta.

Aviso: revisión narrativa de los autores del modelo; los datos de imagen salen de estudios pequeños (futbolistas de élite y caballos) con una técnica específica de ecografía (UTC, caracterización tisular por ultrasonidos).

Referencias:
1. Cook JL, Rio E, Purdam CR, Docking SI. Revisiting the continuum model of tendon pathology: what is its merit in clinical practice and research? Br J Sports Med. 2016;50(19):1187-1191. doi:10.1136/bjsports-2015-095422
2. Rosengarten SD, Cook JL, Bryant AL, et al. Australian football players' Achilles tendons respond to game loads within 2 days: an ultrasound tissue characterisation (UTC) study. Br J Sports Med. 2015;49:183-187.
3. Docking SI, Daffy J, van Schie HT, Cook JL. Tendon structure changes after maximal exercise in the Thoroughbred horse: use of ultrasound tissue characterisation to detect in vivo tendon response. Vet J. 2012;194:338-342.

¿Cuándo haces tú las ecografías de control? Comenta «día 2».

#fisioterapia #tendinopatia #tendon #aquiles #ecografia #fisioterapiadeportiva #evidenciacientifica #estudiantesdefisio

## 3 ganchos alternativos (A/B)
1. «Su Aquiles salió distinto en la eco. Dos días después, normal.»
2. «Tu tendón no es el mismo el martes que el jueves.»
3. «Lo que cambia en tu tendón tras un partido no son las fibras.»

## Dónde verificarlo
Cook 2016, apartado «Is a response to load part of an adaptive or pathological process?», párrafos primero y segundo: recambio de colágeno mínimo tras la madurez esquelética y proteoglicanos en días (refs. 11-12); respuesta «definite but subtle» en imagen 2 días después de cargas altas que vuelve a la normalidad hacia el día 4 en el Aquiles (ref. 62, Rosengarten 2015) y en el flexor digital superficial del caballo (ref. 63, Docking 2012); 2-3 días para expresar y degradar proteoglicanos grandes como el agrecano (refs. 64-67); respuesta similar en resonancia (ref. 68); «unclear whether these changes are adaptive or pathological».

---

# Vídeo · «Fibromialgia y túnel carpiano: ¿qué va primero?» · entregables

**Artículo:** Fitzcharles M-A, Deamo Assis R, Polly DW, Cohen SP. Mixed pain phenotypes in musculoskeletal disorders: mechanisms and management. Nat Rev Rheumatol 2026. doi:10.1038/s41584-026-01443-w (online anticipada). Estudio original citado: Magen E, et al. Fibromyalgia and hand diseases: a case–control study. J Hand Ther 2025. doi:10.1016/j.jht.2025.07.003 (Fitzcharles 2026 · reel 13).
**Pilar:** Lectura crítica · **Público:** fisios clínicos · Composición `Carpiano` (`src/videos/carpiano/`, assets en `public/carpiano/`).
**Tipo de datos (nuevo):** odds ratios de un estudio de casos y controles (gráfico con la línea del 1) y qué no pueden decir: ni el orden ni la causa. No es lumbar ni de sensibilidad/especificidad.
**Tipos de estudio que se dicen en el vídeo:** revisión narrativa (Fitzcharles) y estudio de casos y controles (Magen).

## Hilo
1. **Caso:** paciente con fibromialgia y dolor en la muñeca; encaja con un túnel carpiano. ¿Caso cerrado?
2. **Quién lo dice:** revisión narrativa de 2026 (Nature Reviews Rheumatology); el estudio original es de casos y controles con 9.232 personas con fibromialgia.
3. **Los datos:** túnel carpiano OR 2,98 (casi el triple); también suben dedo en resorte (1,77), De Quervain (1,96), tendinitis (2,16) y artrosis de mano (2,99).
4. **Quiz:** ¿qué va primero? (la fibro / la mano / no se sabe).
5. **El hallazgo:** una odds ratio solo dice que van juntas; no dice cuál llega antes ni cuál causa a cuál.
6. **El giro:** otro dato de la revisión: usaban más el sistema sanitario y se operaban más. Una explicación posible, **que no da la revisión** y que en pantalla aparece marcada como «hipótesis»: a más consultas, más diagnósticos (sesgo de detección).
7. **Matiz:** asociación ≠ causa.
8. **Mañana:** confirma el túnel carpiano con la exploración y mira si el dolor sigue el recorrido del nervio mediano.
9. **CTA:** comenta «mano» o «fibro».

## Portada
Línea 1: **Fibro y túnel carpiano:** · Dato: **¿qué va primero?** · Subtítulo: LO QUE NO TE DICE UNA ODDS RATIO (`npx remotion still Carpiano-Portada out/portada-carpiano.png`).

## Descripción del post
Paciente con fibromialgia y dolor en la muñeca. Encaja con un túnel carpiano… ¿caso cerrado?

- En un estudio de casos y controles con 9.232 personas con fibromialgia, las odds de túnel carpiano eran casi el triple (OR 2,98). También subían las de dedo en resorte (1,77), De Quervain (1,96), tendinitis (2,16) y artrosis de mano (2,99), todas con P < 0,001.
- Una odds ratio solo dice que dos cosas van juntas. No dice cuál llega antes ni cuál causa a cuál.
- Las personas con fibromialgia también usaban más el sistema sanitario y se operaban más. Una explicación posible (nuestra, no de la revisión): más consultas, más diagnósticos, es decir, sesgo de detección.

Mañana en consulta: confirma el túnel carpiano con la exploración y mira si el dolor sigue el recorrido del nervio mediano.

Aviso: los datos los resume una revisión narrativa; la revisión no da intervalos de confianza ni detalla los controles de ese estudio. Es una asociación, no una causa.

Referencias:
1. Fitzcharles M-A, Deamo Assis R, Polly DW, Cohen SP. Mixed pain phenotypes in musculoskeletal disorders: mechanisms and management. Nat Rev Rheumatol. 2026. doi:10.1038/s41584-026-01443-w
2. Magen E, et al. Fibromyalgia and hand diseases: a case–control study. J Hand Ther. 2025. doi:10.1016/j.jht.2025.07.003

¿Qué crees que va primero? Comenta «mano» o «fibro».

#fisioterapia #fibromialgia #tunelcarpiano #mano #dolorcronico #evidenciacientifica #lecturacritica #estudiantesdefisio

## 3 ganchos alternativos (A/B)
1. «Casi el triple de túnel carpiano con fibromialgia. ¿Por qué?»
2. «Una odds ratio de 2,98 y aun así no sabes qué va primero.»
3. «Fibro y muñeca: el diagnóstico que parece obvio.»

## Dónde verificarlo
Fitzcharles 2026, sección «Mixed pain in the musculoskeletal context», apartado «Soft-tissue conditions» (ref. 113): «In a case–control study of 9,232 individuals with fibromyalgia, the odds of carpal tunnel syndrome (odds ratio 2.98), trigger finger (odds ratio 1.77), De Quervain's tenosynovitis (odds ratio 1.96), tendinitis (odds ratio 2.16) and hand osteoarthritis (odds ratio 2.99) were all significantly increased (all P < 0.001). Patients with fibromyalgia also had higher healthcare utilization and surgery rates.» La revisión no da IC, número de controles ni discute el orden temporal o el sesgo de detección: eso es lectura crítica nuestra, y el vídeo lo dice («que no da la revisión»).
