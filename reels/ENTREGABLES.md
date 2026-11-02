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

# Propuesta de guion · Parte 2: el test de Kemp

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
Kemp positivo. Y anotas: facetario. Pues ese test ni confirma ni descarta. / Lo dice una revisión de 2024 que reunió los datos de los estudios que lo midieron. / Sensibilidad: de 0,23… a 1. Especificidad: de 0,116… a 0,673. / Entonces, un Kemp positivo, ¿confirma o descarta? / Con esa especificidad, sale positivo en mucha gente sin dolor facetario. Y con esa sensibilidad, un negativo tampoco te deja tranquilo. / La revisión no dice que no sirva. Dice que es una pieza: dolor que aumenta al extender, que no suele pasar de la rodilla, y exploración neurológica normal. / Así que no escribas «facetario» solo por un Kemp. Anota las cuatro piezas. / Comenta «Kemp» si lo usas a diario. Y en la parte 3: la sacroilíaca, donde un test no basta y necesitas tres.

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

# Propuesta de guion · Parte 3: la sacroilíaca, un test no basta

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

# Reel 3 · «El 91,4 % del test del 4: leímos el original» · entregables

**Pilar:** Lectura crítica · **Público:** fisios clínicos y estudiantes · **Duración:** 52,6 s · Composición `Sacroiliaca` (`src/videos/sacroiliaca/`, assets en `public/sacroiliaca/`).

## Por qué este enfoque
El guion propuesto para la parte 3 (Custers 2024, reel 6) repetía dos cosas de la revisión que no aguantan la lectura del original:
1. La revisión cita «Telli et al. 2008». El estudio es de **2018** (Pain Physician 21(4):E367-E376; PMID 30045603; así figura también en la propia bibliografía de Custers, ref. 28).
2. La revisión llama «sensibilidad» al 91,4 % del FABER. En el original es el **porcentaje de positivos entre 117 pacientes ya diagnosticados** de disfunción sacroilíaca, y el diagnóstico se hizo con **3 de 6 tests de provocación positivos**. No hubo comparación con infiltración ni grupo sin el diagnóstico, así que no es una sensibilidad en sentido estricto.
Por eso el reel pasa de «aplicación clínica» a **lectura crítica**, manteniendo el mensaje práctico (batería de tests, no un test suelto), que sí sostienen los autores.

## Portada
Línea 1: **El test del 4 detecta el** · Dato: **91,4 %** · Subtítulo: ¿SEGURO? LEÍMOS EL ORIGINAL (`npx remotion still Sacroiliaca-Portada out/portada-sacroiliaca.png`).

## Guion locutado
91,4 %. Según una revisión de 2024, eso detecta el test del 4. Fuimos al estudio original: no es lo que parece. / Primer error: la revisión dice 2008, y es de 2018. / 117 pacientes, todos ya diagnosticados de disfunción sacroilíaca. ¿Cómo? Con 3 de 6 tests de provocación positivos. / Entonces, ¿qué mide ese 91? / En cuántos de esos pacientes salió positivo el test. Pacientes diagnosticados con esos mismos tests. / No se comparó con la infiltración, ni con gente sin el diagnóstico. No es una sensibilidad de verdad. / Y según los autores, un test suelto vale poco; la batería, más. / Mañana: no etiquetes sacroilíaca por un test del 4; haz la batería y cuenta positivos. / Comenta «original» si quieres más lecturas así. Y en la parte 4: el Lasègue, que esta revisión interpreta al revés.

## Descripción del post
Una revisión de 2024 dice que el test del 4 (FABER) tiene un 91,4 % de sensibilidad para la sacroilíaca. Fuimos al estudio original.

- **La fecha está mal:** la revisión dice 2008; el estudio es de 2018.
- **No es una sensibilidad:** el 91,4 % es cuántos dieron positivo entre 117 pacientes que ya tenían el diagnóstico, y ese diagnóstico se hizo con 3 de 6 tests de provocación, entre ellos el propio FABER.
- **Faltan las comparaciones:** no hubo infiltración de referencia ni grupo sin el diagnóstico. Los propios autores lo reconocen como limitación.
- **Lo que sí sostiene el estudio:** cada test por separado tiene fiabilidad y validez limitadas; la batería de tests de provocación es más fiable.

Mañana en consulta: no etiquetes «sacroilíaca» por un test del 4 positivo. Haz la batería de provocación y cuenta positivos.

Aviso: estudio retrospectivo de una sola clínica (117 pacientes), con concordancia solo intraobservador. Tómalo como orientación.

Referencias:
1. Telli H, Telli S, Topal M. The Validity and Reliability of Provocation Tests in the Diagnosis of Sacroiliac Joint Dysfunction. Pain Physician. 2018;21(4):E367-E376. PMID: 30045603.
2. Custers P, Van de Kelft E, Eeckhaut B, et al. Clinical Examination, Diagnosis, and Conservative Treatment of Chronic Low Back Pain: A Narrative Review. Life (Basel). 2024;14(9):1090. doi:10.3390/life14091090

¿Lees el original antes de citar una revisión? Comenta «original».

#fisioterapia #lumbalgia #sacroiliaca #fisioterapeuta #evidenciacientifica #estudiantesdefisio #lecturacritica #dolorlumbar

## 3 ganchos alternativos (A/B)
1. «91,4 % de sensibilidad. Spoiler: no es una sensibilidad.»
2. «La revisión dice 2008. El estudio es de 2018. Y eso es lo de menos.»
3. «Si citas el test del 4 con este dato, lee esto antes.»

## Dónde verificarlo
- Telli 2018, resumen (PubMed 30045603): 117 pacientes ya diagnosticados por evaluación clínica; criterio de 3 de 6 tests positivos; FABER positivo en el 91,4 %, Gaenslen en el 56,4 %; limitaciones: sin concordancia interobservador y sin comparación con infiltración; conclusión: los tests sueltos tienen fiabilidad y validez limitadas y la batería es fiable.
- Custers 2024: apartado 3.4.3 «Specificity and Sensitivity» (dice «Telli et al. from 2008» y «highest sensitivity… FABERE (91.4%)»); bibliografía, ref. 28 (Pain Physician 2018).

---

# Propuesta de guion · Parte 4: el Lasègue, interpretado al revés

**Pilar:** Lectura crítica · Datos de Custers 2024 (apartado 3.2.5, «Straight Leg Raise» y «Crossed SLR», tabla 5 y «Summary of Specificity and Sensitivity»). Corresponde al reel 2 del doc de guiones de Custers, ya escrito y verificado.

| Escena | Voz | En pantalla |
|---|---|---|
| Gancho | «Lasègue o Lasègue cruzado: ¿cuál confirma y cuál descarta? Esta revisión lo dice al revés.» | Dos camillas a pantalla partida; «AL REVÉS» de golpe |
| Prueba | «La revisión de la parte 3 otra vez: Life, 2024.» | Tarjeta Life 2024 con lupa |
| Datos | «Lasègue: sensibilidad de 0,73 a 0,98. El cruzado: especificidad de 0,88 a 0,98.» | Dos barras de rango |
| Quiz | «¿Cuál te ayuda a descartar si sale negativo?» | Opciones LASÈGUE / CRUZADO |
| Hallazgo | «Muy sensible y negativo, descarta. Muy específico y positivo, confirma.» | Regla con dos flechas |
| Giro | «La revisión escribe justo lo contrario.» | Cita de la revisión tachada |
| Qué hacer | «Si el Lasègue sale positivo, no pares: añade el cruzado.» | Checklist |
| CTA | «Comenta "cruzado" si lo haces siempre. Y en la parte 5…» | Botón y teaser |

Limitación obligatoria: la regla «sensible y negativo descarta, específico y positivo confirma» es la interpretación estándar de esos valores, no una frase del paper; los rangos proceden de estudios distintos que la revisión agrega.
