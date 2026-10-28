# Cuestionarios nuevos para OmniClin

Encargo para la sesión que programa la app. Búsqueda hecha el 22-10-2026 en PubMed. Cada referencia lleva el PMID y el
DOI tal como los dio PubMed. Lo que no se pudo confirmar va marcado **⚠ sin verificar**.

Hay **74 fichas** de cuestionarios validados que la app todavía no tiene, pensados para la consulta de fisioterapia. Cada
ficha trae:

- qué mide;
- id, grupo en la app, rango y qué es mejor;
- regla de puntuación e interpretación (MCID o puntos de corte);
- licencia;
- referencia original y validación española;
- instrucciones al paciente y, cuando se puede, todas las preguntas con sus respuestas y su valor.

## Para quien programe (léelo antes de empezar)

1. **Formato.** Cada cuestionario sigue el patrón que ya existe:
   - una entrada en `QUESTIONNAIRES` (`src/clinical/questionnaires.ts`);
   - un `QuestionForm` en `src/clinical/forms/<id>.ts`, con su `*.test.ts`;
   - su línea en `forms/index.ts`.

   En cada ficha:
   - «id propuesto» es el `id`;
   - «Grupo en la app» es `regions` o `topic`;
   - «Rango · qué es mejor» da `min`, `max` y `better`;
   - las «Referencias» van a `source`.

   Los `topic` nuevos son nombres legibles, como los que ya usa la app: «Tipo e impacto del dolor», «Vuelta al
   deporte», «Equilibrio, caídas y mareo», «Suelo pélvico», «Respiratorio», «Persona mayor», «Sueño», «Cefalea»,
   «Adherencia al ejercicio», «Neurológico» e «Hipermovilidad». Algunos van a temas que ya existen: «Dolor, miedo y
   creencias», «Estado de ánimo» y «Calidad de vida».
2. **Texto de los ítems.** Es una traducción de trabajo fiel al original, igual que los que ya tiene la app. Antes de
   usarlo en consulta hay que cotejarlo con la validación española citada. Pon en `source` la misma advertencia que
   llevan los demás.
3. **Licencias.** Mira la columna «Licencia» antes de meter nada:
   - **Libre:** se puede meter entero.
   - **Libre con permiso o registro:** se puede meter entero, pero la clínica tiene que pedir el permiso o registrarse
     (cada ficha dice a quién).
   - **Comprobar con el titular:** el uso clínico suele ser gratis, pero no se ha confirmado para una app comercial. Si
     la ficha trae ítems, se pueden programar, pero no publicarlos hasta que haya respuesta del titular.
   - **Licencia:** el titular cobra por el uso comercial. Esas fichas no traen el texto de las preguntas, a propósito.
     Métalos solo como «Solo anotar la nota» (el `QuestionnaireKind` con su rango y sin `QuestionForm`) hasta que la
     clínica tenga la licencia.
4. **Cuestionarios que reutilizan texto de la app:**
   - KOOS-12 y HOOS-12 son ítems sueltos del KOOS y del HOOS de la app;
   - FAOS es el KOOS adaptado a pie y tobillo;
   - ALR-RSI y SIRSI son el ACL-RSI cambiando «rodilla» por «tobillo» u «hombro»;
   - PHQ-4 son los dos primeros ítems del PHQ-9 y del GAD-7.

   Reutiliza esos textos en vez de duplicarlos.
5. **Lo marcado ⚠:** ni puntos de corte ni reglas inventadas. Si una cifra está marcada ⚠, la app no debe enseñarla
   como interpretación hasta comprobarla, o tiene que decir que es orientativa.
6. **Aviso sobre lo que ya hay:**
   - el QuickDASH, que la app ya tiene, es del Institute for Work & Health, el mismo titular que el DASH, que pide
     licencia para uso comercial: conviene revisar sus condiciones;
   - lo mismo con el Oswestry y el NDI, como ya dice `sheets.ts`.

## Por dónde empezar (prioridad clínica sugerida)

1. **Primera tanda (más uso en consulta, libres y con ítems completos):**
   - Kujala, Lysholm, IKDC, Tegner;
   - RMDQ, STarT Back, Bournemouth (cuello y lumbar);
   - PRWE, PRTEE, BCTQ, ASES, SST, UEFI;
   - CAIT, FAAM Deporte, I-PRRS;
   - DN4, S-LANSS, PEG;
   - Short FES-I, ABC, DHI.
2. **Segunda tanda:**
   - formas cortas que reutilizan texto: KOOS-12, HOOS-12, FAOS, ALR-RSI, SIRSI, PHQ-4;
   - JFLS-8 y TMD Pain Screener (ATM);
   - suelo pélvico: ICIQ-UI SF, PFDI-20, PFIQ-7;
   - respiratorio: Nijmegen, mMRC;
   - persona mayor: SARC-F, FRAIL;
   - OSTRC-H2/O2, Brief IPQ, DASS-21, PSS-10, FSS, 5PQ, PROMIS-10, FFI, MIDAS, Marx.
3. **Sin preguntas: solo la nota hasta tener la licencia o el texto:**
   - DASH, Oxford (hombro, codo, rodilla, cadera), WOMAC, HIT-6, painDETECT, BPI-SF, ISI, CAT, EQ-5D-5L, MSWS-12;
   - WOSI, WORC, iHOT-12, HAGOS, VISA-G, PGQ, WDQ, ZCQ, Keele STarT MSK;
   - CPAQ-8, Back-PAQ-10, rNPQ, EARS.

## Resumen

Columnas: **Ítems** dice si vienen las preguntas («sí» = completas, «reutiliza» = sale del texto de otro cuestionario de
la app, «no» = solo estructura y puntuación).

| Cuestionario | id | Grupo | Rango · mejor | Licencia | Ítems |
|---|---|---|---|---|---|
| **Columna, ATM y pelvis** | | | | | |
| RMDQ (Roland-Morris) | `rmdq` | lumbar | 0–24 · menos | Libre con permiso | sí |
| STarT Back (SBST) | `sbst` | lumbar | 0–9 · menos | Libre con permiso | sí |
| Keele STarT MSK | `start_msk` | Dolor, miedo y creencias | ⚠ 0–12 · menos | Comprobar | no |
| Bournemouth lumbar | `bq_lumbar` | lumbar | 0–70 · menos | Comprobar | sí |
| Bournemouth cuello | `bq_cuello` | cervical | 0–70 · menos | Comprobar | sí |
| WDQ (latigazo) | `wdq` | cervical | 0–130 · menos | Comprobar | no |
| JFLS-8 | `jfls8` | atm | 0–10 · menos | Libre | sí |
| TMD Pain Screener | `tmd_pain_screener` | atm | 0–7 · menos | Libre | sí |
| PGQ (cintura pélvica) | `pgq` | sacroiliaca | 0–100 · menos | Comprobar | no |
| HIT-6 | `hit6` | Cefalea | 36–78 · menos | Licencia | no |
| MIDAS | `midas` | Cefalea | 0–450 · menos | Comprobar | sí |
| ZCQ (estenosis) | `zcq` | lumbar | por subescala · menos | Comprobar | no |
| **Miembro superior** | | | | | |
| DASH completo | `dash` | hombro, codo, muñeca | 0–100 · menos | Licencia | no |
| PRWE | `prwe` | muneca_mano | 0–100 · menos | Comprobar | sí |
| PRTEE | `prtee` | codo | 0–100 · menos | Comprobar | sí |
| BCTQ (túnel carpiano) | `bctq` | muneca_mano | 1–5 · menos | Libre | sí |
| ASES | `ases` | hombro | 0–100 · más | Libre | sí |
| SST | `sst` | hombro | 0–12 · más | Libre | sí |
| WOSI | `wosi` | hombro | 0–2100 · menos | Comprobar | no |
| WORC | `worc` | hombro | 0–2100 · menos | Comprobar | no |
| Oxford Shoulder Score | `oss` | hombro | 0–48 · más | Licencia | no |
| Oxford Elbow Score | `oes` | codo | 0–100 · más | Licencia | no |
| SIRSI | `sirsi` | hombro | 0–100 · más | Comprobar | reutiliza (ACL-RSI) |
| UEFI | `uefi` | hombro, codo, muñeca | 0–80 · más | Comprobar | sí |
| **Miembro inferior y deporte** | | | | | |
| Kujala (AKPS) | `kujala` | rodilla | 0–100 · más | Libre | sí |
| Lysholm | `lysholm` | rodilla | 0–100 · más | Libre | sí |
| IKDC subjetivo | `ikdc` | rodilla | 0–100 · más | Libre con permiso | sí |
| Tegner | `tegner` | rodilla | 0–10 · más | Libre | sí |
| Marx | `marx` | rodilla | 0–16 · más | Libre | sí |
| KOOS-12 | `koos12` | rodilla | 0–100 · más | Comprobar | reutiliza (KOOS) |
| HOOS-12 | `hoos12` | cadera | 0–100 · más | Comprobar | reutiliza (HOOS) |
| iHOT-12 | `ihot12` | cadera | 0–100 · más | Comprobar | no |
| HAGOS | `hagos` | cadera | 0–100 · más | Comprobar | no |
| VISA-G | `visa_g` | cadera | 0–100 · más | Comprobar | no |
| FAOS | `faos` | tobillo_pie | 0–100 · más | Comprobar | reutiliza (KOOS) |
| CAIT | `cait` | tobillo_pie | 0–30 · más | Libre | sí |
| FAAM Deporte | `faam_deporte` | tobillo_pie | 0–100 · más | Libre | sí |
| FFI | `ffi` | tobillo_pie | 0–100 · menos | Comprobar | sí |
| ALR-RSI | `alr_rsi` | tobillo_pie | 0–100 · más | Comprobar | reutiliza (ACL-RSI) |
| I-PRRS | `iprrs` | Vuelta al deporte | 0–60 · más | Libre | sí |
| OSTRC-H2 / O2 | `ostrc_h2` | Vuelta al deporte | 0–100 · menos | Libre | sí |
| Oxford Knee Score | `oks` | rodilla | 0–48 · más | Licencia | no |
| Oxford Hip Score | `ohs` | cadera | 0–48 · más | Licencia | no |
| WOMAC | `womac` | cadera, rodilla | 0–96 · menos | Licencia | no |
| **Dolor, psicosocial, sueño y adherencia** | | | | | |
| DN4 | `dn4` | Tipo e impacto del dolor | 0–10 · menos | Comprobar | sí |
| S-LANSS | `s_lanss` | Tipo e impacto del dolor | 0–24 · menos | Comprobar | sí |
| painDETECT | `paindetect` | Tipo e impacto del dolor | −1–38 · menos | Licencia | no |
| PEG | `peg` | Tipo e impacto del dolor | 0–10 · menos | Libre | sí |
| BPI forma corta | `bpi_sf` | Tipo e impacto del dolor | 0–10 · menos | Licencia | no |
| CPAQ-8 | `cpaq8` | Dolor, miedo y creencias | 0–48 · más | Comprobar | no |
| Brief IPQ | `bipq` | Dolor, miedo y creencias | 0–80 · menos | Libre con permiso | sí |
| Back-PAQ-10 | `back_paq10` | Dolor, miedo y creencias | ⚠ ver ficha | Comprobar | no |
| rNPQ | `rnpq` | Dolor, miedo y creencias | 0–12 · más | Comprobar | no |
| ISI (insomnio) | `isi` | Sueño | 0–28 · menos | Licencia | no |
| DASS-21 | `dass21` | Estado de ánimo | 0–42 por subescala · menos | Libre | sí |
| PSS-10 | `pss10` | Estado de ánimo | 0–40 · menos | Libre con permiso | sí |
| EARS | `ears` | Adherencia al ejercicio | 0–24 · más | Comprobar | no |
| PHQ-4 | `phq4` | Estado de ánimo | 0–12 · menos | Libre | reutiliza (PHQ-9 y GAD-7) |
| **Equilibrio, suelo pélvico, respiratorio, neurológico, salud general** | | | | | |
| Short FES-I | `short_fes_i` | Equilibrio, caídas y mareo | 7–28 · menos | Libre | sí |
| ABC | `abc` | Equilibrio, caídas y mareo | 0–100 · más | Libre | sí |
| DHI | `dhi` | Equilibrio, caídas y mareo | 0–100 · menos | Libre | sí |
| SARC-F | `sarc_f` | Persona mayor | 0–10 · menos | Libre | sí |
| FRAIL | `frail` | Persona mayor | 0–5 · menos | Libre | sí |
| ICIQ-UI SF | `iciq_ui_sf` | Suelo pélvico | 0–21 · menos | Libre con permiso | sí |
| PFDI-20 | `pfdi_20` | Suelo pélvico | 0–300 · menos | Libre | sí |
| PFIQ-7 | `pfiq_7` | Suelo pélvico | 0–300 · menos | Libre | sí |
| Nijmegen | `nijmegen` | Respiratorio | 0–64 · menos | Libre | sí |
| mMRC (disnea) | `mmrc` | Respiratorio | 0–4 · menos | Libre | sí |
| CAT (EPOC) | `cat` | Respiratorio | 0–40 · menos | Licencia | no |
| FSS (fatiga) | `fss` | Neurológico | 1–7 · menos | Libre | sí |
| MSWS-12 | `msws_12` | Neurológico | 0–100 · menos | Comprobar | no |
| 5PQ (hipermovilidad) | `hipermovilidad_5pq` | Hipermovilidad | 0–5 · cribado | Libre | sí |
| EQ-5D-5L | `eq5d5l` | Calidad de vida | índice · más | Licencia | no |
| PROMIS-10 | `promis_10` | Calidad de vida | T 50±10 · más | Libre con permiso | sí |

Total: 74 fichas.
- 42 con las preguntas completas;
- 6 que reutilizan texto de la app;
- 26 solo con estructura y puntuación: 12 por licencia y 14 porque no se pudo comprobar el texto original o la licencia.

---

## Columna, ATM y pelvis

> Referencias comprobadas con PubMed (herramienta PubMed MCP) el 22-10-2026. Lo que no se pudo confirmar va marcado «⚠ sin verificar».
> Las traducciones de los ítems son fieles al original inglés. Cuando existe versión española validada, el programador debe cotejar la redacción final con el artículo de validación antes de publicar.

---

### RMDQ — Cuestionario de discapacidad por dolor lumbar de Roland-Morris (24 ítems)
| Campo | Valor |
|---|---|
| id propuesto | `rmdq` |
| Grupo en la app | `regions: ["lumbar"]` |
| Qué mide / cuándo usarlo en fisio | Discapacidad funcional por dolor lumbar en el día de hoy. Útil en dolor lumbar agudo y subagudo y con discapacidad leve-moderada (el Oswestry discrimina mejor la discapacidad grave). |
| Nº ítems · tiempo | 24 ítems sí/no · unos 5 min |
| Rango · qué es mejor | 0–24 · «menos es mejor» |
| Puntuación | 1 punto por cada frase marcada y 0 por cada frase sin marcar. Total = suma (0–24). No hay ítems invertidos ni subescalas. Una frase sin marcar cuenta como 0, así que no existen respuestas en blanco. Opcional: mostrar también el % (total/24×100). |
| Interpretación | Cambio mínimo importante: 5 puntos o una mejora del 30 % respecto al valor inicial (consenso de Ostelo et al., 2008; ref. 3). No hay puntos de corte de gravedad verificados. |
| Licencia | **Libre con permiso o registro / comprobar con el titular para software comercial.** Gratis en clínica e investigación no comercial. Copyright de M. Roland y R. Morris (información y condiciones en rmdq.org). En una app comercial hay que confirmar las condiciones con el titular. Versión española: Kovacs FM et al. (Fundación Kovacs). |

**Referencias**
1. Original: Roland M, Morris R. A study of the natural history of back pain. Part I: development of a reliable and sensitive measure of disability in low-back pain. Spine (Phila Pa 1976). 1983;8(2):141-4. PMID: 6222486. DOI: 10.1097/00007632-198303000-00004
2. Validación española: Kovacs FM, Llobera J, Gil Del Real MT, Abraira V, Gestoso M, Fernández C, et al. Validation of the Spanish version of the Roland-Morris questionnaire. Spine (Phila Pa 1976). 2002;27(5):538-42. PMID: 11880841. DOI: 10.1097/00007632-200203010-00016
3. MCID: Ostelo RW, Deyo RA, Stratford P, Waddell G, Croft P, Von Korff M, et al. Interpreting change scores for pain and functional status in low back pain: towards international consensus regarding minimal important change. Spine (Phila Pa 1976). 2008;33(1):90-4. PMID: 18165753. DOI: 10.1097/BRS.0b013e31815e3a10

**Instrucciones al paciente:** «Cuando le duele la espalda, puede que le cueste hacer algunas de las cosas que hace habitualmente. Esta lista contiene frases que la gente usa para describirse cuando le duele la espalda. Al leerlas, puede que alguna le llame la atención porque le describe a usted hoy. Léalas y marque solo las frases que le describan a usted hoy. Si una frase no le describe, déjela sin marcar y pase a la siguiente.»

**Ítems** (todos: marcada = 1; sin marcar = 0)
1. Me quedo en casa la mayor parte del tiempo por mi espalda.
2. Cambio de postura con frecuencia para intentar que mi espalda esté cómoda.
3. Ando más despacio de lo habitual por mi espalda.
4. Por mi espalda, no hago ninguna de las tareas que suelo hacer en casa.
5. Por mi espalda, me agarro a la barandilla para subir escaleras.
6. Por mi espalda, me tumbo a descansar más a menudo.
7. Por mi espalda, tengo que agarrarme a algo para levantarme de un sillón.
8. Por mi espalda, intento que otras personas hagan las cosas por mí.
9. Me visto más despacio de lo habitual por mi espalda.
10. Solo me quedo de pie durante ratos cortos por mi espalda.
11. Por mi espalda, procuro no agacharme ni arrodillarme.
12. Me cuesta levantarme de una silla por mi espalda.
13. Me duele la espalda casi todo el tiempo.
14. Me cuesta darme la vuelta en la cama por mi espalda.
15. Tengo poco apetito por mi dolor de espalda.
16. Me cuesta ponerme los calcetines (o las medias) por el dolor de espalda.
17. Solo ando distancias cortas por mi espalda.
18. Duermo peor por mi espalda.
19. Por mi dolor de espalda, necesito ayuda de otra persona para vestirme.
20. Paso sentado/a la mayor parte del día por mi espalda.
21. Evito las tareas pesadas de la casa por mi espalda.
22. Por mi dolor de espalda, estoy más irritable y de peor humor con la gente de lo habitual.
23. Por mi espalda, subo las escaleras más despacio de lo habitual.
24. Me quedo en la cama la mayor parte del tiempo por mi espalda.

---

### SBST — STarT Back Screening Tool (cribado pronóstico del dolor lumbar, 9 ítems)
| Campo | Valor |
|---|---|
| id propuesto | `sbst` |
| Grupo en la app | `regions: ["lumbar"]` |
| Qué mide / cuándo usarlo en fisio | Clasifica al paciente con dolor lumbar en riesgo bajo, medio o alto de mal pronóstico (cronificación o discapacidad persistente), para ajustar el tratamiento por estratos. Se usa en la primera visita. |
| Nº ítems · tiempo | 9 ítems · 2 min |
| Rango · qué es mejor | Total 0–9; subescala psicosocial 0–5 · «menos es mejor» |
| Puntuación | Ítems 1–8: De acuerdo = 1, En desacuerdo = 0. Ítem 9: Nada / Un poco / Moderadamente = 0; Mucho / Muchísimo = 1. **Total** = suma de los 9 ítems. **Subescala psicosocial** = suma de los ítems 5, 6, 7, 8 y 9. No hay ítems invertidos. Si falta algún ítem, no calcular el riesgo y pedir que se complete, porque los puntos de corte son de 1 punto. |
| Interpretación | Clasificación de Hill et al. (2008, ref. 1): **riesgo bajo** si el total es 0–3. **Riesgo alto** si el total es ≥4 y la subescala psicosocial es 4–5. **Riesgo medio** en el resto de casos (total ≥4 y psicosocial ≤3). |
| Licencia | **Libre con permiso o registro.** Copyright de Keele University. Uso clínico gratuito. Para integrarlo en software comercial hay que comprobarlo con Keele University (STarT Back, Keele University School of Medicine, keele.ac.uk/startback), que puede pedir un acuerdo de licencia. |

**Referencias**
1. Original: Hill JC, Dunn KM, Lewis M, Mullis R, Main CJ, Foster NE, et al. A primary care back pain screening tool: identifying patient subgroups for initial treatment. Arthritis Rheum. 2008;59(5):632-41. PMID: 18438893. DOI: 10.1002/art.23563
2. Validación española (traducción y adaptación transcultural con entrevistas cognitivas, sin estudio psicométrico completo): Gusi N, del Pozo-Cruz B, Olivares PR, Hernández-Mocholi M, Hill JC. The Spanish version of the "STarT Back Screening Tool" (SBST) in different subgroups. Aten Primaria. 2011;43(7):356-61. PMID: 21296465. DOI: 10.1016/j.aprim.2010.05.019

**Instrucciones al paciente:** «Piense en las **últimas 2 semanas** y marque su respuesta a cada una de las siguientes preguntas.»

**Ítems**
Opciones de los ítems 1–8: 0 = En desacuerdo; 1 = De acuerdo
1. En algún momento de las últimas 2 semanas, el dolor de espalda se me ha extendido a la pierna o las piernas.
2. En algún momento de las últimas 2 semanas, he tenido dolor en el hombro o en el cuello.
3. Por el dolor de espalda, solo he andado distancias cortas.
4. En las últimas 2 semanas, me he vestido más despacio de lo habitual por el dolor de espalda.
5. Para una persona con un problema como el mío, no es realmente seguro hacer actividad física.
6. He tenido pensamientos de preocupación en la cabeza gran parte del tiempo.
7. Siento que mi dolor de espalda es terrible y que nunca va a mejorar.
8. En general, no he disfrutado de todas las cosas con las que antes disfrutaba.
9. En general, ¿cuánto le ha molestado el dolor de espalda en las últimas 2 semanas? Opciones: 0 = Nada; 0 = Un poco; 0 = Moderadamente; 1 = Mucho; 1 = Muchísimo

---

### Keele STarT MSK — Keele STarT MSK Tool (cribado pronóstico del dolor musculoesquelético)
| Campo | Valor |
|---|---|
| id propuesto | `start_msk` |
| Grupo en la app | `topic: "Dolor, miedo y creencias"` (sirve para espalda, cuello, hombro, rodilla y dolor en varias zonas) |
| Qué mide / cuándo usarlo en fisio | Versión del STarT Back que vale para cualquier zona. Clasifica al paciente en riesgo bajo, medio o alto de mal pronóstico (salud física y dolor a los 6 meses) en dolor de espalda, cuello, hombro, rodilla o dolor en varias zonas. Se usa en la primera visita. |
| Nº ítems · tiempo | 10 ítems (Dunn et al., 2021) · 2–3 min |
| Rango · qué es mejor | ⚠ sin verificar: 0–12 · «menos es mejor» |
| Puntuación | ⚠ sin verificar con PubMed. No se pudo confirmar la regla exacta por ítem. Pedir el formulario y la guía de puntuación oficiales a Keele University. |
| Interpretación | Según el estudio de validación, el 24,9 % de la cohorte quedó en riesgo bajo, el 41,7 % en medio y el 33,4 % en alto (ref. 1). Los puntos de corte por puntuación no se pudieron verificar (⚠ sin verificar). |
| Licencia | **Libre con permiso o registro / comprobar con el titular.** Copyright de Keele University (School of Medicine, Primary Care Centre Versus Arthritis). Uso clínico gratuito. Para software comercial, confirmar las condiciones con Keele. |

**Referencias**
1. Original (refinamiento y validación de la versión de 10 ítems): Dunn KM, Campbell P, Lewis M, Hill JC, van der Windt DA, Afolabi E, et al. Refinement and validation of a tool for stratifying patients with musculoskeletal pain. Eur J Pain. 2021;25(10):2081-2093. PMID: 34101299. DOI: 10.1002/ejp.1821
2. Validación española: no encontrada en PubMed.
3. (Opcional) Protocolo del estudio de desarrollo: Campbell P, Hill JC, Protheroe J, Afolabi EK, Lewis M, Beardmore R, et al. Keele Aches and Pains Study protocol: validity, acceptability, and feasibility of the Keele STarT MSK tool for subgrouping musculoskeletal patients in primary care. J Pain Res. 2016;9:807-818. PMID: 27789972. DOI: 10.2147/JPR.S116614

**Instrucciones al paciente:** pendientes del formulario oficial.

**Ítems**
Ítems no incluidos: no se pudo comprobar el texto original.

---

### BQ-L — Cuestionario de Bournemouth, versión lumbar
| Campo | Valor |
|---|---|
| id propuesto | `bq_lumbar` |
| Grupo en la app | `regions: ["lumbar"]` |
| Qué mide / cuándo usarlo en fisio | Medida breve y biopsicosocial del dolor lumbar: dolor, discapacidad en AVD y en actividades sociales, ansiedad, depresión, efecto del trabajo y control del dolor. Sirve para seguir la evolución sesión a sesión. |
| Nº ítems · tiempo | 7 ítems (escala numérica 0–10) · 2–3 min |
| Rango · qué es mejor | 0–70 · «menos es mejor» |
| Puntuación | Cada ítem vale de 0 a 10 y el total es la suma de los 7 (0–70). La escala ya está orientada de modo que 10 es siempre lo peor (en el ítem 7, 0 = «Lo controlo por completo» y 10 = «No lo controlo en absoluto»), así que no hay que invertir nada al sumar. Si falta un ítem, no calcular el total (⚠ los autores no publicaron una regla de imputación que se haya podido verificar). Opcional: mostrar cada ítem por separado como perfil. |
| Interpretación | No hay puntos de corte ni MCID verificados para la versión lumbar. |
| Licencia | **Comprobar con el titular.** Copyright de J. E. Bolton (AECC University College, Bournemouth, Reino Unido). Los ítems están publicados en el artículo original y se usan mucho sin licencia comercial conocida, pero no se pudieron confirmar las condiciones de uso en software comercial. |

**Referencias**
1. Original: Bolton JE, Breen AC. The Bournemouth Questionnaire: a short-form comprehensive outcome measure. I. Psychometric properties in back pain patients. J Manipulative Physiol Ther. 1999;22(8):503-10. PMID: 10543579. DOI: 10.1016/s0161-4754(99)70001-1
2. Validación española: no encontrada en PubMed para la versión lumbar (solo existe la de cuello; véase BQ-C).

**Instrucciones al paciente:** «Las siguientes escalas sirven para medir cómo está su dolor de espalda y cómo le está afectando. Rodee con un círculo el número que mejor describa cómo se siente, pensando en la **última semana**.»

**Ítems** (en todos se marca un número del 0 al 10, y el valor es el número marcado)
1. Durante la última semana, de media, ¿cómo puntuaría su dolor de espalda? — 0 = Sin dolor … 10 = El peor dolor posible
2. Durante la última semana, ¿cuánto le ha impedido el dolor de espalda realizar sus actividades diarias (tareas de casa, lavarse, vestirse, caminar, subir escaleras, entrar o salir de la cama o de una silla)? — 0 = No me lo ha impedido … 10 = No he podido realizarlas
3. Durante la última semana, ¿cuánto le ha impedido el dolor de espalda participar en actividades recreativas, sociales y familiares? — 0 = No me lo ha impedido … 10 = No he podido realizarlas
4. Durante la última semana, ¿cuánta ansiedad ha sentido (tensión, nerviosismo, irritabilidad, dificultad para concentrarse o relajarse)? — 0 = Ninguna ansiedad … 10 = Muchísima ansiedad
5. Durante la última semana, ¿cuánto se ha sentido deprimido/a (decaído/a, triste, desanimado/a, pesimista, infeliz)? — 0 = Nada deprimido/a … 10 = Muy deprimido/a
6. Durante la última semana, ¿cómo cree que su trabajo (dentro y fuera de casa) ha afectado (o afectaría) a su dolor de espalda? — 0 = No lo ha empeorado … 10 = Lo ha empeorado mucho
7. Durante la última semana, ¿cuánto ha podido controlar (reducir o aliviar) por sí mismo/a su dolor de espalda? — 0 = Lo controlo por completo … 10 = No lo controlo en absoluto

---

### BQ-C — Cuestionario de Bournemouth, versión cuello (NBQ)
| Campo | Valor |
|---|---|
| id propuesto | `bq_cuello` |
| Grupo en la app | `regions: ["cervical"]` |
| Qué mide / cuándo usarlo en fisio | Las mismas 7 dimensiones biopsicosociales que la versión lumbar, aplicadas al dolor de cuello inespecífico. Sirve para seguir la evolución. |
| Nº ítems · tiempo | 7 ítems (escala numérica 0–10) · 2–3 min |
| Rango · qué es mejor | 0–70 · «menos es mejor» |
| Puntuación | Igual que en la BQ-L: suma de los 7 ítems (0–70), con 10 siempre como lo peor y sin ítems que invertir. Si falta un ítem, no calcular el total. |
| Interpretación | Versión española (NBQ-Sp): error estándar de medida (SEM) de 1,302 y cambio mínimo detectable (MDC) de 3,038 puntos (ref. 2). Un cambio de menos de unos 3 puntos puede deberse al error de medida. No hay MCID verificado. |
| Licencia | **Comprobar con el titular** (J. E. Bolton, AECC University College). Para la versión española, contactar con los autores de la validación (Pérez-García JJ et al.). |

**Referencias**
1. Original: Bolton JE, Humphreys BK. The Bournemouth Questionnaire: a short-form comprehensive outcome measure. II. Psychometric properties in neck pain patients. J Manipulative Physiol Ther. 2002;25(3):141-8. PMID: 11986574. DOI: 10.1067/mmt.2002.123333
2. Validación española: Pérez-García JJ, Molina-Torres G, Ventura-Miranda MI, Sandoval-Hernández I, Ruiz-Fernández MD, Martínez-Cal J, et al. Spanish Cross-Cultural Adaptation and Validation of Neck Bournemouth Questionnaire (NBQ) for Neck Pain Patients. Healthcare (Basel). 2023;11(13):1926. PMID: 37444760. DOI: 10.3390/healthcare11131926

**Instrucciones al paciente:** «Las siguientes escalas sirven para medir cómo está su dolor de cuello y cómo le está afectando. Rodee con un círculo el número que mejor describa cómo se siente, pensando en la **última semana**.»

**Ítems** (0–10; el valor es el número marcado)
1. Durante la última semana, de media, ¿cómo puntuaría su dolor de cuello? — 0 = Sin dolor … 10 = El peor dolor posible
2. Durante la última semana, ¿cuánto le ha impedido el dolor de cuello realizar sus actividades diarias (tareas de casa, lavarse, vestirse, levantar peso, leer, conducir)? — 0 = No me lo ha impedido … 10 = No he podido realizarlas
3. Durante la última semana, ¿cuánto le ha impedido el dolor de cuello participar en actividades recreativas, sociales y familiares? — 0 = No me lo ha impedido … 10 = No he podido realizarlas
4. Durante la última semana, ¿cuánta ansiedad ha sentido (tensión, nerviosismo, irritabilidad, dificultad para concentrarse o relajarse)? — 0 = Ninguna ansiedad … 10 = Muchísima ansiedad
5. Durante la última semana, ¿cuánto se ha sentido deprimido/a (decaído/a, triste, desanimado/a, pesimista, infeliz)? — 0 = Nada deprimido/a … 10 = Muy deprimido/a
6. Durante la última semana, ¿cómo cree que su trabajo (dentro y fuera de casa) ha afectado (o afectaría) a su dolor de cuello? — 0 = No lo ha empeorado … 10 = Lo ha empeorado mucho
7. Durante la última semana, ¿cuánto ha podido controlar (reducir o aliviar) por sí mismo/a su dolor de cuello? — 0 = Lo controlo por completo … 10 = No lo controlo en absoluto

> Nota para el programador: según Bolton y Humphreys (2002, ref. 1), la versión de cuello solo cambia la redacción del ítem 2 (los ejemplos de actividades diarias) respecto a la lumbar. Conviene un único componente con la región («espalda»/«cuello») como parámetro.

---

### WDQ — Cuestionario de discapacidad por latigazo cervical (Whiplash Disability Questionnaire)
| Campo | Valor |
|---|---|
| id propuesto | `wdq` |
| Grupo en la app | `regions: ["cervical"]` |
| Qué mide / cuándo usarlo en fisio | Discapacidad específica tras un latigazo cervical (WAD), por ejemplo tras un accidente de tráfico. Es más específico que el NDI en estos pacientes. |
| Nº ítems · tiempo | 13 ítems (escala numérica 0–10) · 5 min |
| Rango · qué es mejor | 0–130 · «menos es mejor» |
| Puntuación | Suma de los 13 ítems (0–130). En la validación española la media de los pacientes agudos fue de 62 (DE 31) (ref. 2). ⚠ La regla para respuestas en blanco no se pudo verificar. |
| Interpretación | No hay puntos de corte ni MCID verificados con PubMed. |
| Licencia | **Comprobar con el titular** (autores originales: Pinfold M, Niere KR et al.). Para la versión española, contactar con Barriga-Martín A et al. |

**Referencias**
1. Original: Pinfold M, Niere KR, O'Leary EF, Hoving JL, Green S, Buchbinder R. Validity and internal consistency of a whiplash-specific disability measure. Spine (Phila Pa 1976). 2004;29(3):263-8. PMID: 14752347. DOI: 10.1097/01.brs.0000107238.15526.4c
2. Validación española: Barriga-Martín A, Holgado-Moreno E, Ávila-Martín G, Galán-Arriero I, Romero-Muñoz LM, Segura-Fragoso A, et al. Spanish Version of the Whiplash Disability Questionnaire in Adults With Acute Whiplash-Associated Disorders. J Manipulative Physiol Ther. 2019;42(4):276-283. PMID: 31319929. DOI: 10.1016/j.jmpt.2018.11.013

**Instrucciones al paciente:** pendientes del formulario oficial.

**Ítems**
Ítems no incluidos: no se pudo comprobar el texto original.

---

### JFLS-8 — Escala de limitación funcional mandibular, 8 ítems (Jaw Functional Limitation Scale)
| Campo | Valor |
|---|---|
| id propuesto | `jfls8` |
| Grupo en la app | `regions: ["atm"]` |
| Qué mide / cuándo usarlo en fisio | Limitación funcional global de la mandíbula (masticar, abrir la boca, hablar, expresión facial) en trastornos temporomandibulares (TTM). Forma parte del Eje II de los DC/TMD. |
| Nº ítems · tiempo | 8 ítems (escala 0–10) · 2 min |
| Rango · qué es mejor | 0–10 (media) · «menos es mejor» |
| Puntuación | Cada ítem vale de 0 a 10. Puntuación global = **media** de los ítems respondidos. No hay ítems invertidos. ⚠ Regla del manual de puntuación DC/TMD (no verificada con PubMed): si faltan más de 2 ítems, no calcular la puntuación. |
| Interpretación | No hay puntos de corte ni MCID verificados con PubMed. |
| Licencia | **Libre.** Instrumento del protocolo DC/TMD, de uso libre sin permiso (International Network for Orofacial Pain and Related Disorders Methodology, INfORM; rdc-tmdinternational.org), donde también hay traducciones, entre ellas al español. |

**Referencias**
1. Original: Ohrbach R, Larsson P, List T. The jaw functional limitation scale: development, reliability, and validity of 8-item and 20-item versions. J Orofac Pain. 2008;22(3):219-30. PMID: 18780535. DOI: no figura en PubMed.
2. Validación española: no encontrada en PubMed.

**Instrucciones al paciente:** «Para cada una de las actividades siguientes, indique su grado de limitación **durante el último mes**. Si ha evitado por completo una actividad porque le resultaba demasiado difícil, marque 10. Si ha evitado una actividad por otros motivos que no sean el dolor o la dificultad, deje ese ítem en blanco.»

**Ítems**
Opciones: 0 = Sin limitación … 10 = Limitación grave (se marca un número del 0 al 10, y el valor es el número marcado)
1. Masticar alimentos duros
2. Masticar pollo (por ejemplo, hecho al horno)
3. Comer alimentos blandos que no hay que masticar (por ejemplo, puré de patatas, compota de manzana, natillas, comida triturada)
4. Abrir la boca lo suficiente para beber de una taza
5. Tragar
6. Bostezar
7. Hablar
8. Sonreír

---

### TMD-PS — Cuestionario de cribado del dolor por trastorno temporomandibular (TMD Pain Screener, 6 ítems)
| Campo | Valor |
|---|---|
| id propuesto | `tmd_pain_screener` |
| Grupo en la app | `regions: ["atm"]` |
| Qué mide / cuándo usarlo en fisio | Cribado rápido de un TTM doloroso (mialgia o artralgia). Útil en pacientes con cefalea, dolor cervical o facial para decidir si hay que explorar la ATM. |
| Nº ítems · tiempo | 6 ítems · 1 min |
| Rango · qué es mejor | 0–7 · «menos es mejor» |
| Puntuación | Ítem 1: 0, 1 o 2. Ítems 2–6: No = 0, Sí = 1. Total = suma (0–7). Si falta algún ítem, no calcular el resultado. |
| Interpretación | En el estudio original, con el punto de corte óptimo, la versión de 6 ítems tuvo una sensibilidad del 99 % y una especificidad del 97 % (ref. 1). ⚠ El punto de corte concreto no figura en el resumen. Según el protocolo DC/TMD es ≥3 = cribado positivo, pero no está verificado con PubMed. |
| Licencia | **Libre.** Instrumento del protocolo DC/TMD, de uso libre (INfORM / rdc-tmdinternational.org). |

**Referencias**
1. Original: Gonzalez YM, Schiffman E, Gordon SM, Seago B, Truelove EL, Slade G, et al. Development of a brief and effective temporomandibular disorder pain screening questionnaire: reliability and validity. J Am Dent Assoc. 2011;142(10):1183-91. PMID: 21965492. DOI: 10.14219/jada.archive.2011.0088
2. Validación española: no encontrada en PubMed.

**Instrucciones al paciente:** «Responda a las siguientes preguntas pensando en los **últimos 30 días**.»

**Ítems**
1. En los últimos 30 días, por término medio, ¿cuánto le duró el dolor en la mandíbula o en la sien, en cualquiera de los dos lados? — 0 = Sin dolor; 1 = El dolor va y viene; 2 = El dolor está siempre presente
2. En los últimos 30 días, ¿ha tenido dolor o rigidez en la mandíbula al despertarse? — 0 = No; 1 = Sí

En los últimos 30 días, ¿alguna de las siguientes actividades cambió el dolor (es decir, lo mejoró o lo empeoró) en la mandíbula o en la sien, en cualquiera de los dos lados? (0 = No; 1 = Sí)
3. Masticar alimentos duros o correosos
4. Abrir la boca o mover la mandíbula hacia delante o hacia los lados
5. Hábitos de la mandíbula, como mantener los dientes juntos, apretar o rechinar los dientes, o mascar chicle
6. Otras actividades de la mandíbula, como hablar, besar o bostezar

---

### PGQ — Cuestionario de la cintura pélvica (Pelvic Girdle Questionnaire)
| Campo | Valor |
|---|---|
| id propuesto | `pgq` |
| Grupo en la app | `regions: ["sacroiliaca"]` |
| Qué mide / cuándo usarlo en fisio | Limitación de la actividad y síntomas en el dolor de la cintura pélvica durante el embarazo y el posparto. Es el único instrumento específico para esta población. |
| Nº ítems · tiempo | 25 ítems: 20 de actividad y 5 de síntomas, cada uno con una escala de 4 opciones (0–3) · 5–10 min |
| Rango · qué es mejor | 0–100 (%) · «menos es mejor» |
| Puntuación | Dos subescalas (actividad y síntomas) y un total. ⚠ Regla habitual, no verificada en el resumen de PubMed: puntuación = suma de los ítems respondidos / (nº de ítems respondidos × 3) × 100. Los ítems marcados «no aplicable» o en blanco se excluyen del denominador. |
| Interpretación | No hay puntos de corte ni MCID verificados con PubMed. Fiabilidad test-retest (CCI) de 0,93 en la subescala de actividad y de 0,91 en la de síntomas (ref. 1). En la versión española, α de Cronbach de 0,961 y CCI de 0,962 (ref. 2). |
| Licencia | **Comprobar con el titular** (autora original: Britt Stuge). Para la versión española, contactar con Rejano-Campo M et al. |

**Referencias**
1. Original: Stuge B, Garratt A, Krogstad Jenssen H, Grotle M. The pelvic girdle questionnaire: a condition-specific instrument for assessing activity limitations and symptoms in people with pelvic girdle pain. Phys Ther. 2011;91(7):1096-108. PMID: 21596959. DOI: 10.2522/ptj.20100357
2. Validación española: Rejano-Campo M, Ferrer-Peña R, Urraca-Gesto MA, Gallego-Izquierdo T, Pecos-Martín D, Stuge B, et al. Transcultural adaptation and psychometric validation of a Spanish-language version of the "Pelvic Girdle Questionnaire". Health Qual Life Outcomes. 2017;15(1):30. PMID: 28143502. DOI: 10.1186/s12955-017-0605-0

**Instrucciones al paciente:** pendientes del formulario oficial.

**Ítems**
Ítems no incluidos: no se pudo comprobar el texto original.

---

### HIT-6 — Test del impacto de la cefalea (Headache Impact Test-6)
| Campo | Valor |
|---|---|
| id propuesto | `hit6` |
| Grupo en la app | `topic: "Cefalea"` |
| Qué mide / cuándo usarlo en fisio | Impacto de la cefalea en la vida diaria (dolor intenso, limitación de actividades, necesidad de tumbarse, cansancio, irritabilidad, concentración). Útil en cefalea tensional, cervicogénica y migraña. |
| Nº ítems · tiempo | 6 ítems con 5 opciones (Nunca / Rara vez / A veces / Muy a menudo / Siempre) · 1–2 min |
| Rango · qué es mejor | 36–78 · «menos es mejor» |
| Puntuación | Valores por opción: Nunca = 6, Rara vez = 8, A veces = 10, Muy a menudo = 11, Siempre = 13. Total = suma (36–78). La versión española describe dos subescalas, directa e indirecta (ref. 2). ⚠ Los valores por opción y las categorías de impacto (≤49 poco o ningún impacto; 50–55 algo; 56–59 importante; ≥60 grave) proceden de la guía de QualityMetric y no se han verificado con PubMed. |
| Interpretación | Ver la nota ⚠ anterior. No hay MCID verificado. |
| Licencia | **Licencia.** Titular: QualityMetric Incorporated, LLC / GlaxoSmithKline (copyright del HIT-6). El uso comercial o en software requiere una licencia de QualityMetric (qualitymetric.com). **No incluir el texto de los ítems.** |

**Referencias**
1. Original: Kosinski M, Bayliss MS, Bjorner JB, Ware JE, Garber WH, Batenhorst A, et al. A six-item short-form survey for measuring headache impact: the HIT-6. Qual Life Res. 2003;12(8):963-74. PMID: 14651415. DOI: 10.1023/a:1026119331193
2. Validación española (migraña episódica): Colorado-Martín Y, Pecos-Martín D, de Miguel-Hernando N, Cámara-Calmaestra R, Rodríguez-Almagro D, Ferragut-Garcías A, et al. Validation of the Spanish Version of the Headache Impact Test (HIT-6) in Patients With Episodic Migraine. Brain Behav. 2025;15(5):e70515. PMID: 40320979. DOI: 10.1002/brb3.70515

**Instrucciones al paciente:** se obtienen con la licencia.

**Ítems**
No incluidos por licencia. Estructura: 6 ítems, 5 opciones de frecuencia y una puntuación de 36 a 78. Pedir la versión española con licencia a QualityMetric.

---

### MIDAS — Cuestionario de evaluación de la discapacidad por migraña (Migraine Disability Assessment)
| Campo | Valor |
|---|---|
| id propuesto | `midas` |
| Grupo en la app | `topic: "Cefalea"` |
| Qué mide / cuándo usarlo en fisio | Días perdidos o con rendimiento reducido por la cefalea en los últimos 3 meses (trabajo o estudios, casa, ocio). Útil para cuantificar la discapacidad en migraña y cefaleas y para decidir si hay que derivar. |
| Nº ítems · tiempo | 5 ítems puntuables + 2 informativos (A y B) · 3–5 min |
| Rango · qué es mejor | 0–450 en teoría (5 × 90 días) · «menos es mejor» |
| Puntuación | Total = suma de los días de los ítems 1–5. Los ítems A (frecuencia) y B (intensidad 0–10) **no** suman, y se muestran aparte. No hay ítems invertidos. Si algún ítem 1–5 está en blanco, no calcular el total. Validar que cada ítem esté entre 0 y 90 días. |
| Interpretación | ⚠ Grados habituales (no verificados en el resumen de PubMed): I (0–5) poca o ninguna discapacidad; II (6–10) leve; III (11–20) moderada; IV (≥21) grave. En la validación española, el α de Cronbach fue 0,797 y el CCI de la escala principal 0,81 (ref. 2). |
| Licencia | **Comprobar con el titular.** Copyright de Innovative Medical Research Inc. (creado con apoyo de AstraZeneca). Se distribuye sin coste para uso clínico, pero no se pudieron confirmar las condiciones para software comercial. Mientras no se confirmen, no publicar. |

**Referencias**
1. Original: Stewart WF, Lipton RB, Dowson AJ, Sawyer J. Development and testing of the Migraine Disability Assessment (MIDAS) Questionnaire to assess headache-related disability. Neurology. 2001;56(6 Suppl 1):S20-8. PMID: 11294956. DOI: 10.1212/wnl.56.suppl_1.s20
2. Validación española (estudiantes universitarios): Rodríguez-Almagro D, Achalandabaso A, Rus A, Obrero-Gaitán E, Zagalaz-Anula N, Lomas-Vega R. Validation of the Spanish version of the migraine disability assessment questionnaire (MIDAS) in university students with migraine. BMC Neurol. 2020;20(1):67. PMID: 32093620. DOI: 10.1186/s12883-020-01646-y

**Instrucciones al paciente:** «Responda a las siguientes preguntas sobre TODOS los dolores de cabeza que ha tenido en los **últimos 3 meses**. Escriba 0 si no realizó esa actividad en los últimos 3 meses.»

**Ítems** (respuesta numérica en días, de 0 a 90; el valor es el número de días)
1. ¿Cuántos días de los últimos 3 meses faltó al trabajo o a clase por sus dolores de cabeza?
2. ¿Cuántos días de los últimos 3 meses se redujo a la mitad o más su rendimiento en el trabajo o en clase por sus dolores de cabeza? (No cuente los días que ya contó en la pregunta 1, en los que faltó al trabajo o a clase.)
3. ¿Cuántos días de los últimos 3 meses no hizo las tareas de casa por sus dolores de cabeza?
4. ¿Cuántos días de los últimos 3 meses se redujo a la mitad o más su rendimiento en las tareas de casa por sus dolores de cabeza? (No cuente los días que ya contó en la pregunta 3, en los que no hizo las tareas de casa.)
5. ¿Cuántos días de los últimos 3 meses se perdió actividades familiares, sociales o de ocio por sus dolores de cabeza?

No puntúan:
- A. ¿Cuántos días de los últimos 3 meses tuvo dolor de cabeza? (Si un dolor de cabeza duró más de un día, cuente cada día.) — número de días, 0–90
- B. En una escala de 0 a 10, de media, ¿cuánto le dolieron esos dolores de cabeza? — 0 = Sin dolor … 10 = El peor dolor posible

---

### ZCQ — Cuestionario de claudicación de Zúrich / Cuestionario suizo de estenosis espinal (Zurich Claudication Questionnaire / Swiss Spinal Stenosis Questionnaire)
| Campo | Valor |
|---|---|
| id propuesto | `zcq` |
| Grupo en la app | `regions: ["lumbar"]` |
| Qué mide / cuándo usarlo en fisio | Gravedad de los síntomas, función física (sobre todo la marcha) y satisfacción con el tratamiento en la estenosis de canal lumbar con claudicación neurógena. |
| Nº ítems · tiempo | 18 ítems en 3 escalas: 7 de gravedad de síntomas, 5 de función física y 6 de satisfacción (esta solo después del tratamiento) · 5–10 min |
| Rango · qué es mejor | ⚠ sin verificar con PubMed: síntomas 1–5, función 1–4, satisfacción 1–4 (media de cada escala) · «menos es mejor» en las tres |
| Puntuación | Cada escala se puntúa por separado. ⚠ Regla habitual, no verificada en el resumen: media de los ítems respondidos de cada escala. Se calcula si falta como mucho un ítem en síntomas o función. No hay total único. |
| Interpretación | Fiabilidad test-retest de 0,82–0,96 y respuesta al cambio (SRM) de 0,96–1,07 (ref. 1). No hay MCID verificado con PubMed. |
| Licencia | **Comprobar con el titular** (autores originales: Stucki G, Katz JN et al.). Para la versión española, contactar con Hidalgo Ovejero AM et al. (Complejo Hospitalario de Navarra). |

**Referencias**
1. Original: Stucki G, Daltroy L, Liang MH, Lipson SJ, Fossel AH, Katz JN. Measurement properties of a self-administered outcome measure in lumbar spinal stenosis. Spine (Phila Pa 1976). 1996;21(7):796-803. PMID: 8779009. DOI: 10.1097/00007632-199604010-00004
2. Validación española: Hidalgo Ovejero AM, Menéndez García M, Bermejo Fraile B, García Mata S, Forcén Alonso T, Mateo Sebastián P. Cross-cultural adaptation of the Zurich Claudication Questionnaire. Validation study of the Spanish version. An Sist Sanit Navar. 2015;38(1):41-52. PMID: 25963457. DOI: 10.23938/ASSN.0052

**Instrucciones al paciente:** pendientes del formulario oficial (versión española de Hidalgo Ovejero et al.).

**Ítems**
Ítems no incluidos: no se pudo comprobar el texto original (las opciones de respuesta cambian de un ítem a otro y no se pudieron confirmar).

---
## Miembro superior

> Notas generales del bloque
> - Referencias comprobadas en PubMed (herramienta PubMed MCP). En Vancouver se da el año de la edición impresa; PMID y DOI son los que devuelve PubMed. Cuando PubMed muestra otro año (fecha de publicación en línea o un error de indexación), se indica.
> - OpenAlex no respondía durante la sesión (error 403 del proxy), así que las referencias que no están en PubMed (capítulos de libro, *Physiotherapy Canada* de 2001) van marcadas «⚠ sin verificar».
> - Textos de los ítems: son traducciones propias, fieles al original inglés y dirigidas al paciente de «usted». **No reproducen literalmente la versión española validada**, porque no he tenido delante el texto publicado. Si el equipo consigue esa versión, debe sustituir mi texto por el suyo.
> - Aviso de coherencia: el **QuickDASH**, que ya está en la app, es del mismo titular que el DASH (Institute for Work & Health). Conviene revisar su licencia con el mismo criterio que la del DASH (ver abajo).

---

### DASH — Discapacidades del brazo, hombro y mano (versión completa de 30 ítems + módulos opcionales)
| Campo | Valor |
|---|---|
| id propuesto | `dash` |
| Grupo en la app | `regions: ["hombro", "codo", "muneca_mano"]` |
| Qué mide / cuándo usarlo en fisio | Discapacidad y síntomas del miembro superior en cualquier trastorno musculoesquelético de hombro, codo, muñeca o mano. Se elige la versión completa en lugar del QuickDASH cuando se necesita más precisión o los módulos de trabajo y de deporte/música. |
| Nº ítems · tiempo | 30 ítems en el cuerpo principal (21 de función física, 6 de síntomas y 3 de función social/rol) + módulo opcional de trabajo (4) + módulo opcional de deporte/artes escénicas (4) · unos 10 min |
| Rango · qué es mejor | 0–100 · «menos es mejor» (0 = sin discapacidad) |
| Puntuación | Cada ítem va de 1 a 5. **Cuerpo principal:** DASH = ((suma de las respuestas / nº de respuestas) − 1) × 25. Hacen falta al menos 27 de los 30 ítems respondidos; con más de 3 en blanco no se calcula. **Cada módulo opcional** se puntúa aparte con la misma fórmula sobre sus 4 ítems. En los módulos hay que responder los 4 ítems; si falta uno, ese módulo no se calcula. Los módulos no se suman al DASH principal. No hay ítems invertidos. |
| Interpretación | MCID 10,83 puntos (sensibilidad 82 %, especificidad 74 %) en trastornos musculoesqueléticos del miembro superior tratados con fisioterapia. Los autores lo proponen como límite inferior; como límite superior citan los 15 puntos que recomienda la web del DASH (Franchignoni 2014). Cambio mínimo detectable al 90 %: 10,81 puntos. |
| Licencia | **Licencia**. Titular: Institute for Work & Health (IWH, Toronto). El uso clínico y de investigación no comercial es gratuito, pero meterlo en un producto o software comercial exige un acuerdo de licencia con el IWH (dash.iwh.on.ca, apartado de permisos y licencias). Hay que pedirlo antes de publicarlo en la app; en ese trámite se obtiene también la traducción española oficial. |

**Referencias**
1. Original: Hudak PL, Amadio PC, Bombardier C. Development of an upper extremity outcome measure: the DASH (disabilities of the arm, shoulder and hand) [corrected]. The Upper Extremity Collaborative Group (UECG). Am J Ind Med. 1996;29(6):602-8. PMID: 8773720. DOI: 10.1002/(SICI)1097-0274(199606)29:6<602::AID-AJIM4>3.0.CO;2-L
2. Validación española (España): Hervás MT, Navarro Collado MJ, Peiró S, Rodrigo Pérez JL, López Matéu P, Martínez Tello I. [Spanish version of the DASH questionnaire. Cross-cultural adaptation, reliability, validity and responsiveness]. Med Clin (Barc). 2006;127(12):441-7. PMID: 17040628. DOI: 10.1157/13093053
3. MCID: Franchignoni F, Vercelli S, Giordano A, Sartorio F, Bravini E, Ferriero G. Minimal clinically important difference of the disabilities of the arm, shoulder and hand outcome measure (DASH) and its shortened version (QuickDASH). J Orthop Sports Phys Ther. 2014;44(1):30-9. PMID: 24175606. DOI: 10.2519/jospt.2014.4893 (PubMed le asigna fecha de 2013).

**Instrucciones al paciente:** No se incluyen porque el instrumento está sujeto a licencia. Usar el texto oficial que entregue el IWH.

**Ítems**
Ítems no incluidos: el instrumento está sujeto a licencia. Estructura para programarlo:
- **Cuerpo principal (30 ítems), referidos a la última semana.**
  - Ítems 1–21, dificultad para realizar actividades: 1 = ninguna dificultad; 2 = dificultad leve; 3 = dificultad moderada; 4 = dificultad grave; 5 = incapaz.
  - Ítem 22, interferencia con la actividad social: de 1 = nada a 5 = extremadamente.
  - Ítem 23, limitación en el trabajo u otras actividades diarias: de 1 = nada limitado a 5 = incapaz.
  - Ítems 24–28, intensidad de síntomas (dolor, dolor al hacer una actividad concreta, hormigueo, debilidad, rigidez): de 1 = ninguno a 5 = extremo.
  - Ítem 29, dificultad para dormir por el dolor: de 1 = ninguna dificultad a 5 = tanta dificultad que no puede dormir.
  - Ítem 30, sentirse menos capaz, menos seguro o menos útil: de 1 = totalmente en desacuerdo a 5 = totalmente de acuerdo.
- **Módulo de trabajo (4 ítems):** dificultad con la técnica habitual de trabajo, con hacer el trabajo habitual, con hacerlo tan bien como querría y con dedicarle el tiempo habitual. Escala 1–5, de ninguna dificultad a incapaz.
- **Módulo de deporte/artes escénicas (4 ítems):** los mismos cuatro conceptos aplicados a tocar un instrumento o practicar deporte. Escala 1–5.

---

### PRWE — Evaluación de la muñeca valorada por el paciente (Patient-Rated Wrist Evaluation)
| Campo | Valor |
|---|---|
| id propuesto | `prwe` |
| Grupo en la app | `regions: ["muneca_mano"]` |
| Qué mide / cuándo usarlo en fisio | Dolor y discapacidad de la muñeca. Es la referencia en fractura de radio distal y se usa también en otras lesiones de muñeca (esguinces, TFCC, rizartrosis con afectación de la muñeca). |
| Nº ítems · tiempo | 15 ítems (5 de dolor y 10 de función: 6 de actividades específicas y 4 de actividades habituales) · unos 5 min |
| Rango · qué es mejor | 0–100 · «menos es mejor» |
| Puntuación | Cada ítem va de 0 a 10. **Dolor** = suma de los 5 ítems (0–50). **Función** = suma de los 10 ítems ÷ 2 (0–50). **Total** = dolor + función (0–100). Si un ítem de función no se ha respondido, el manual del autor permite sustituirlo por la media de los demás ítems de función de esa subescala. No hay ítems invertidos. |
| Interpretación | En la versión española (fractura de radio distal), el cambio mínimo detectable (MDC90) fue de 12,1–13,7 puntos (Rosales 2017). No he verificado un MCID en PubMed. |
| Licencia | **Comprobar con el titular**. Titular: Joy C. MacDermid (copyright). Según el manual del autor, su uso clínico y de investigación es gratuito, pero no he podido confirmar qué condiciones aplica al uso dentro de software comercial. Hay que escribir a la autora (Western University, Canadá) antes de publicarlo en la app. |

**Referencias**
1. Original: MacDermid JC, Turgeon T, Richards RS, Beadle M, Roth JH. Patient rating of wrist pain and disability: a reliable and valid measurement tool. J Orthop Trauma. 1998;12(8):577-86. PMID: 9840793. DOI: 10.1097/00005131-199811000-00009
2. Validación española (España): Rosales RS, García-Gutierrez R, Reboso-Morales L, Atroshi I. The Spanish version of the Patient-Rated Wrist Evaluation outcome measure: cross-cultural adaptation process, reliability, measurement error and construct validity. Health Qual Life Outcomes. 2017;15(1):169. PMID: 28836994. DOI: 10.1186/s12955-017-0745-2
3. (Otra versión en español, México) Simental-Mendía M, Rodríguez-Azcona JC, García-Rodríguez SS, Carrillo-Cárdenas XG, Peña-Martínez VM, Acosta-Olivo CA. Translation, cross-cultural adaptation, and validation of the patient-rated wrist evaluation into Spanish (Mexico). Disabil Rehabil. 2026;48(7):2131-2140. PMID: 41086098. DOI: 10.1080/09638288.2025.2574534 (PubMed indica 2025 como fecha en línea).

**Instrucciones al paciente:** «Las siguientes preguntas nos ayudarán a saber cuánta dificultad ha tenido con la muñeca durante la última semana. Describa los síntomas de su muñeca como término medio a lo largo de la última semana, en una escala de 0 a 10. Responda a todas las preguntas. Si no realizó alguna actividad, calcule el dolor o la dificultad que habría tenido. Si nunca ha realizado esa actividad, puede dejarla en blanco.»

**Ítems**

*Dolor*: puntúe el dolor de su muñeca de 0 a 10 (0 = sin dolor; 10 = el peor dolor que haya tenido nunca). En el ítem 5: 0 = nunca; 10 = siempre.
1. En reposo
2. Al hacer una tarea con movimientos repetidos de la muñeca
3. Al levantar un objeto pesado
4. Cuando el dolor es máximo
5. ¿Con qué frecuencia tiene dolor? (0 = nunca; 10 = siempre)

*Función, actividades específicas*: puntúe la dificultad de 0 a 10 (0 = ninguna dificultad; 10 = incapaz de hacerlo).

6. Girar el pomo de una puerta con la mano afectada
7. Cortar carne con un cuchillo en la mano afectada
8. Abrocharse los botones de la camisa
9. Apoyarse en la mano afectada para levantarse de una silla
10. Llevar un objeto de unos 5 kg (10 libras) con la mano afectada
11. Usar el papel higiénico con la mano afectada

*Función, actividades habituales*: puntúe la dificultad para hacer sus actividades habituales en cada área de 0 a 10 (0 = ninguna dificultad; 10 = tanta dificultad que no pudo hacer ninguna de esas actividades).

12. Actividades de cuidado personal (vestirse, lavarse)
13. Tareas de la casa (limpieza, mantenimiento)
14. Trabajo (su empleo o su trabajo habitual de cada día)
15. Actividades de ocio

---

### PRTEE — Evaluación del codo de tenista valorada por el paciente (Patient-Rated Tennis Elbow Evaluation)
| Campo | Valor |
|---|---|
| id propuesto | `prtee` |
| Grupo en la app | `regions: ["codo"]` |
| Qué mide / cuándo usarlo en fisio | Dolor y discapacidad en la epicondilalgia o tendinopatía lateral del codo. Es la medida principal recomendada para seguir la evolución de la tendinopatía lateral. |
| Nº ítems · tiempo | 15 ítems (5 de dolor y 10 de función: 6 de actividades específicas y 4 de actividades habituales) · unos 5 min |
| Rango · qué es mejor | 0–100 · «menos es mejor» |
| Puntuación | Cada ítem va de 0 a 10. **Dolor** = suma de los 5 ítems (0–50). **Función** = suma de los 10 ítems ÷ 2 (0–50). **Total** = dolor + función (0–100). Un ítem de función sin responder se sustituye por la media de los demás ítems de su subescala. No hay ítems invertidos. |
| Interpretación | No he verificado un MCID en PubMed. En la versión española, el error estándar de medida fue del 11,9 % (Gallego-Izquierdo 2020). |
| Licencia | **Comprobar con el titular**. Titular: Joy C. MacDermid (copyright). En la práctica se distribuye gratis para uso clínico y de investigación, pero no he podido confirmar las condiciones para software comercial. |

**Referencias**
1. Original, publicada como *Patient-rated forearm evaluation questionnaire*: Overend TJ, Wuori-Fearn JL, Kramer JF, MacDermid JC. Reliability of a patient-rated forearm evaluation questionnaire for patients with lateral epicondylitis. J Hand Ther. 1999;12(1):31-7. PMID: 10192633. DOI: 10.1016/s0894-1130(99)80031-3
2. Validación como PRTEE: Rompe JD, Overend TJ, MacDermid JC. Validation of the Patient-rated Tennis Elbow Evaluation Questionnaire. J Hand Ther. 2007;20(1):3-10. PMID: 17254903. DOI: 10.1197/j.jht.2006.10.003
3. Validación española: Gallego-Izquierdo T, Ruiz-Vindel J, Ferragut-Garcías A, Martínez-Merinero P, Montañez-Aguilera FJ, Noriega-Matanza C, et al. Adaptation and transcultural translation into Spanish of the Patient-Rated Tennis Elbow Evaluation Questionnaire. J Orthop Res. 2020;38(12):2601-7. PMID: 32761913. DOI: 10.1002/jor.24820

**Instrucciones al paciente:** «Las siguientes preguntas nos ayudarán a saber cuánta dificultad ha tenido con el brazo durante la última semana. Describa los síntomas de su brazo como término medio a lo largo de la última semana, en una escala de 0 a 10. Responda a todas las preguntas. Si no realizó alguna actividad, calcule el dolor o la dificultad que habría tenido. Si nunca ha realizado esa actividad, puede dejarla en blanco.»

**Ítems**

*Dolor en el brazo afectado*: de 0 a 10 (0 = sin dolor; 10 = el peor dolor imaginable).
1. En reposo
2. Al hacer una tarea con movimientos repetidos del brazo
3. Al llevar una bolsa de la compra de plástico
4. Cuando el dolor fue mínimo
5. Cuando el dolor fue máximo

*Función, actividades específicas*: de 0 a 10 (0 = ninguna dificultad; 10 = incapaz de hacerlo).

6. Girar el pomo de una puerta o una llave
7. Llevar una bolsa de la compra o un maletín por el asa
8. Llevarse a la boca una taza de café o un vaso de leche llenos
9. Abrir un tarro
10. Subirse los pantalones
11. Escurrir un paño o una toalla mojados

*Función, actividades habituales*: dificultad de 0 a 10 (0 = ninguna dificultad; 10 = tanta dificultad que no pudo hacer ninguna de esas actividades).

12. Actividades personales (vestirse, lavarse)
13. Tareas de la casa (limpieza, mantenimiento)
14. Trabajo (su empleo o su trabajo habitual de cada día)
15. Actividades de ocio o deportivas

---

### BCTQ — Cuestionario de Boston del síndrome del túnel carpiano (Boston Carpal Tunnel Questionnaire)
| Campo | Valor |
|---|---|
| id propuesto | `bctq` |
| Grupo en la app | `regions: ["muneca_mano"]` |
| Qué mide / cuándo usarlo en fisio | Gravedad de los síntomas y estado funcional en el síndrome del túnel carpiano. Sirve para el seguimiento del tratamiento conservador (férulas, neurodinamia, terapia manual) y del postoperatorio. |
| Nº ítems · tiempo | 19 ítems: escala de gravedad de síntomas (SSS) con 11 y escala de estado funcional (FSS) con 8 · unos 5–10 min |
| Rango · qué es mejor | SSS de 1 a 5 y FSS de 1 a 5 · «menos es mejor» |
| Puntuación | Cada ítem va de 1 a 5. **SSS** = media de los ítems 1–11 que se hayan respondido. **FSS** = media de los ítems 12–19 que se hayan respondido. Las dos escalas se dan por separado y no se combinan. Si faltan ítems, se calcula la media de los respondidos. Como criterio práctico, propongo exigir al menos el 80 % de los ítems de cada escala (es decir, ≥ 9/11 y ≥ 7/8); es una regla mía, no la fija el artículo original. No hay ítems invertidos. |
| Interpretación | No he verificado puntos de corte ni MCID en PubMed. En la versión española el tamaño del efecto tras el tratamiento fue grande (d de −3,3 en SSS y −1,9 en FSS; Oteo-Álvaro 2016). |
| Licencia | **Libre**. Los ítems están publicados íntegros en el artículo original y no consta ningún titular que cobre por su uso. |

**Referencias**
1. Original: Levine DW, Simmons BP, Koris MJ, Daltroy LH, Hohl GG, Fossel AH, et al. A self-administered questionnaire for the assessment of severity of symptoms and functional status in carpal tunnel syndrome. J Bone Joint Surg Am. 1993;75(11):1585-92. PMID: 8245050. DOI: 10.2106/00004623-199311000-00002
2. Validación española (España): Oteo-Álvaro Á, Marín MT, Matas JA, Vaquero J. [Spanish validation of the Boston Carpal Tunnel Questionnaire]. Med Clin (Barc). 2016;146(6):247-53. PMID: 26683079. DOI: 10.1016/j.medcli.2015.10.013 (PubMed indica 2015 como fecha en línea).

**Instrucciones al paciente:** «Las siguientes preguntas se refieren a sus síntomas en un periodo típico de 24 horas durante las dos últimas semanas. Marque una respuesta en cada pregunta.»

**Ítems**

*Escala de gravedad de síntomas (SSS)*
1. ¿Cómo de intenso es el dolor de mano o muñeca que tiene por la noche? — 1 = no tengo dolor por la noche; 2 = leve; 3 = moderado; 4 = intenso; 5 = muy intenso
2. ¿Cuántas veces le ha despertado el dolor de mano o muñeca en una noche típica de las dos últimas semanas? — 1 = nunca; 2 = una vez; 3 = 2 o 3 veces; 4 = 4 o 5 veces; 5 = más de 5 veces
3. ¿Suele tener dolor en la mano o la muñeca durante el día? — 1 = nunca tengo dolor durante el día; 2 = leve; 3 = moderado; 4 = intenso; 5 = muy intenso
4. ¿Con qué frecuencia tiene dolor de mano o muñeca durante el día? — 1 = nunca; 2 = una o dos veces al día; 3 = de 3 a 5 veces al día; 4 = más de 5 veces al día; 5 = el dolor es constante
5. Como término medio, ¿cuánto dura un episodio de dolor durante el día? — 1 = nunca tengo dolor durante el día; 2 = menos de 10 minutos; 3 = de 10 a 60 minutos; 4 = más de 60 minutos; 5 = el dolor es constante durante todo el día
6. ¿Tiene entumecimiento (pérdida de sensibilidad) en la mano? — 1 = no; 2 = leve; 3 = moderado; 4 = intenso; 5 = muy intenso
7. ¿Tiene debilidad en la mano o la muñeca? — 1 = no; 2 = leve; 3 = moderada; 4 = intensa; 5 = muy intensa
8. ¿Tiene sensación de hormigueo en la mano? — 1 = no; 2 = leve; 3 = moderada; 4 = intensa; 5 = muy intensa
9. ¿Cómo de intenso es el entumecimiento (pérdida de sensibilidad) o el hormigueo por la noche? — 1 = no tengo entumecimiento ni hormigueo por la noche; 2 = leve; 3 = moderado; 4 = intenso; 5 = muy intenso
10. ¿Cuántas veces le han despertado el entumecimiento o el hormigueo de la mano en una noche típica de las dos últimas semanas? — 1 = nunca; 2 = una vez; 3 = 2 o 3 veces; 4 = 4 o 5 veces; 5 = más de 5 veces
11. ¿Tiene dificultad para agarrar y usar objetos pequeños, como llaves o bolígrafos? — 1 = ninguna dificultad; 2 = dificultad leve; 3 = dificultad moderada; 4 = dificultad intensa; 5 = dificultad muy intensa

*Escala de estado funcional (FSS)*: «¿Cuánta dificultad tiene para hacer las siguientes actividades por los síntomas de la mano y la muñeca?». Opciones para todos: 1 = ninguna dificultad; 2 = dificultad leve; 3 = dificultad moderada; 4 = dificultad intensa; 5 = no puedo hacerlo en absoluto por los síntomas de la mano o la muñeca.

12. Escribir
13. Abrocharse la ropa
14. Sujetar un libro mientras lee
15. Sujetar el auricular del teléfono
16. Abrir tarros
17. Tareas domésticas
18. Llevar las bolsas de la compra
19. Bañarse y vestirse

---

### ASES — Escala de la American Shoulder and Elbow Surgeons (sección del paciente)
| Campo | Valor |
|---|---|
| id propuesto | `ases` |
| Grupo en la app | `regions: ["hombro"]` |
| Qué mide / cuándo usarlo en fisio | Dolor y función del hombro en actividades de la vida diaria. Se usa mucho en patología del manguito, en artroplastia y en ensayos de fisioterapia de hombro. |
| Nº ítems · tiempo | 1 ítem de dolor (EVA/END de 0 a 10) + 10 ítems de AVD · unos 5 min |
| Rango · qué es mejor | 0–100 · «más es mejor» |
| Puntuación | **Dolor (0–50)** = (10 − dolor) × 5. **Función (0–50)** = (suma de los 10 ítems de AVD del lado afectado) × 5/3. Cada ítem de AVD va de 0 a 3, así que la suma va de 0 a 30. **ASES** = dolor + función. Las AVD se preguntan para el brazo derecho y el izquierdo; solo se puntúa el lado afectado. Ante ítems en blanco, lo habitual en la literatura es prorratear la función con la media de los ítems respondidos (suma media × 10 × 5/3). Es una convención, no una regla del artículo original. Propongo calcularlo solo si hay ≥ 8 de 10 respondidos. |
| Interpretación | MCID 6,4 puntos; cambio mínimo detectable al 90 %, 9,7 puntos (Michener 2002, pacientes de fisioterapia). |
| Licencia | **Libre**. Publicado por la American Shoulder and Elbow Surgeons como formulario estandarizado y de uso libre en clínica e investigación. No consta que cobre por su uso. |

**Referencias**
1. Original: Richards RR, An KN, Bigliani LU, Friedman RJ, Gartsman GM, Gristina AG, et al. A standardized method for the assessment of shoulder function. J Shoulder Elbow Surg. 1994;3(6):347-52. PMID: 22958838. DOI: 10.1016/S1058-2746(09)80019-0 (PubMed lo indexa por error con fecha de 2009).
2. Validación española (España): Vrotsou K, Cuéllar R, Silió F, Rodriguez MÁ, Garay D, Busto G, et al. Patient self-report section of the ASES questionnaire: a Spanish validation study using classical test theory and the Rasch model. Health Qual Life Outcomes. 2016;14(1):147. PMID: 27756317. DOI: 10.1186/s12955-016-0552-1
3. MCID: Michener LA, McClure PW, Sennett BJ. American Shoulder and Elbow Surgeons Standardized Shoulder Assessment Form, patient self-report section: reliability, validity, and responsiveness. J Shoulder Elbow Surg. 2002;11(6):587-94. PMID: 12469084. DOI: 10.1067/mse.2002.127096

Otra versión en español (Argentina): Policastro PO, Pierobon A, Pérez J, Novoa GA, Calvo Delfino M, Sajfar ME, et al. Cross-cultural adaptation and validation of the Argentine "American Shoulder and elbow surgeons, patient self-report section" questionnaire. Musculoskelet Sci Pract. 2019;43:37-44. PMID: 31220777. DOI: 10.1016/j.msksp.2019.05.010

**Instrucciones al paciente:** «Marque en la escala la intensidad de su dolor de hombro hoy. Después, indique para cada actividad cuánta dificultad tiene para hacerla con cada brazo.»

**Ítems**

1. ¿Cuánto le duele el hombro hoy? — escala de 0 a 10 (0 = ningún dolor; 10 = el peor dolor posible). Se recomienda un deslizador o una END de 0 a 10.

*Actividades*: responda por separado para el brazo derecho y para el izquierdo. Opciones para todos: 0 = incapaz de hacerlo; 1 = muy difícil; 2 = algo difícil; 3 = nada difícil.

2. Ponerse un abrigo
3. Dormir sobre el lado que le duele o que tiene afectado
4. Lavarse la espalda o abrocharse el sujetador por detrás
5. Asearse después de ir al baño
6. Peinarse
7. Alcanzar un estante alto
8. Levantar 4,5 kg (10 libras) por encima del hombro
9. Lanzar una pelota por encima de la cabeza
10. Hacer su trabajo habitual (indique cuál: ____)
11. Practicar su deporte habitual (indique cuál: ____)

Nota: el formulario original también trae preguntas de sí/no que no puntúan (dolor nocturno, analgésicos, inestabilidad, etc.). No las incluyo porque no he podido comprobar su texto exacto, y no afectan a la puntuación.

---

### SST — Test simple del hombro (Simple Shoulder Test)
| Campo | Valor |
|---|---|
| id propuesto | `sst` |
| Grupo en la app | `regions: ["hombro"]` |
| Qué mide / cuándo usarlo en fisio | Función del hombro con 12 preguntas de sí/no sobre tareas concretas. Es muy rápido y sirve para seguir la evolución en cualquier patología del hombro. |
| Nº ítems · tiempo | 12 · unos 2–3 min |
| Rango · qué es mejor | 0–12 (o 0–100 %) · «más es mejor» |
| Puntuación | Sí = 1; No = 0. **SST** = número de respuestas «sí» (0–12). Muchas veces se da en porcentaje: (nº de «sí» / nº de ítems respondidos) × 100. Con ítems en blanco, mostrar solo el porcentaje sobre los respondidos. No hay ítems invertidos: todos están redactados de forma que «sí» indica mejor función. |
| Interpretación | No he verificado puntos de corte ni MCID en PubMed. |
| Licencia | **Libre**. Desarrollado en la Universidad de Washington (Matsen y cols.) y difundido libremente para uso clínico. |

**Referencias**
1. Original: Lippitt SB, Harryman DT II, Matsen FA III. A practical tool for evaluating function: the Simple Shoulder Test. En: Matsen FA III, Fu FH, Hawkins RJ, editores. The shoulder: a balance of mobility and stability. Rosemont (IL): American Academy of Orthopaedic Surgeons; 1993. p. 501-18. ⚠ sin verificar (capítulo de libro: no está en PubMed y OpenAlex no estaba disponible).
2. Validación española (España): Membrilla-Mesa MD, Tejero-Fernández V, Cuesta-Vargas AI, Arroyo-Morales M. Validation and reliability of a Spanish version of Simple Shoulder Test (SST-Sp). Qual Life Res. 2015;24(2):411-6. PMID: 25038636. DOI: 10.1007/s11136-014-0760-2 (PubMed indica 2014 como fecha en línea).

**Instrucciones al paciente:** «Responda sí o no a cada pregunta pensando en su hombro afectado.»

**Ítems**: para todos, Sí = 1 y No = 0.
1. ¿Tiene el hombro cómodo cuando el brazo está en reposo junto al cuerpo?
2. ¿Su hombro le permite dormir cómodamente?
3. ¿Puede llegar con la mano a la parte baja de la espalda para meterse la camisa por dentro?
4. ¿Puede poner la mano detrás de la cabeza con el codo recto hacia el lado?
5. ¿Puede poner una moneda en un estante a la altura del hombro sin doblar el codo?
6. ¿Puede levantar medio kilo (por ejemplo, un envase lleno de medio litro) hasta la altura del hombro sin doblar el codo?
7. ¿Puede levantar unos 4 kg (por ejemplo, una garrafa llena de 4 litros) hasta la altura de la cabeza sin doblar el codo?
8. ¿Puede llevar unos 9 kg colgando del brazo afectado, junto al cuerpo?
9. ¿Cree que podría lanzar una pelota por debajo del hombro a unos 9 metros con el brazo afectado?
10. ¿Cree que podría lanzar una pelota por encima del hombro a unos 18 metros con el brazo afectado?
11. ¿Puede lavarse la parte de atrás del hombro contrario con el brazo afectado?
12. ¿Su hombro le permitiría trabajar a jornada completa en su trabajo habitual?

(Equivalencias del original: 1 libra ≈ 0,5 kg; 8 libras ≈ 3,6 kg; 20 libras ≈ 9 kg; 10 yardas ≈ 9 m; 20 yardas ≈ 18 m; la pelota del original es de *softball*.)

---

### WOSI — Índice de inestabilidad del hombro de Western Ontario (Western Ontario Shoulder Instability Index)
| Campo | Valor |
|---|---|
| id propuesto | `wosi` |
| Grupo en la app | `regions: ["hombro"]` |
| Qué mide / cuándo usarlo en fisio | Calidad de vida específica de la inestabilidad de hombro (luxación o subluxación glenohumeral), tanto en tratamiento conservador como después de una estabilización quirúrgica. |
| Nº ítems · tiempo | 21 ítems en 4 dominios: síntomas físicos (10), deporte/ocio/trabajo (4), estilo de vida (4) y emociones (3) · unos 10 min |
| Rango · qué es mejor | 0–2100 · «menos es mejor». Expresado como % de normalidad, 0–100 % · «más es mejor» |
| Puntuación | Cada ítem se responde en una escala analógica visual de 100 mm (0–100; 0 = ningún problema). **Total** = suma de los 21 ítems (0–2100). Cada dominio se puede dar como su suma. **% de normalidad** = (2100 − total) / 2100 × 100. No hay ítems invertidos. Los autores no definen cómo tratar las respuestas en blanco; propongo calcularlo solo con los 21 ítems completos. |
| Interpretación | No he verificado puntos de corte ni MCID en PubMed. |
| Licencia | **Comprobar con el titular**. Copyright de A. Kirkley y el Fowler Kennedy Sport Medicine Clinic (Western University, Canadá). Suele cederse gratis previa solicitud, pero no he podido confirmar las condiciones para uso comercial. |

**Referencias**
1. Original: Kirkley A, Griffin S, McLintock H, Ng L. The development and evaluation of a disease-specific quality of life measurement tool for shoulder instability. The Western Ontario Shoulder Instability Index (WOSI). Am J Sports Med. 1998;26(6):764-72. PMID: 9850776. DOI: 10.1177/03635465980260060501
2. Validación española (España): Yuguero M, Huguet J, Griffin S, Sirvent E, Marcano F, Balaguer M, et al. Transcultural adaptation, validation and assessment of the psychometric properties of the spanish version of the Western Ontario Shoulder Instability Index questionnaire. Rev Esp Cir Ortop Traumatol. 2016;60(6):335-45. PMID: 27553522. DOI: 10.1016/j.recot.2016.07.003

**Instrucciones al paciente:** No se incluyen porque no he podido comprobar el texto original. Pedir el texto oficial al titular o usar el de Yuguero 2016.

**Ítems**
Ítems no incluidos: no se pudo comprobar el texto original. Estructura: 21 ítems con escala analógica visual de 0 a 100 cada uno, referidos a la última semana. Ítems 1–10, síntomas físicos; 11–14, deporte, ocio y trabajo; 15–18, estilo de vida; 19–21, emociones.

---

### WORC — Índice del manguito rotador de Western Ontario (Western Ontario Rotator Cuff Index)
| Campo | Valor |
|---|---|
| id propuesto | `worc` |
| Grupo en la app | `regions: ["hombro"]` |
| Qué mide / cuándo usarlo en fisio | Calidad de vida específica de la patología del manguito rotador (tendinopatía, dolor subacromial, roturas tratadas con fisioterapia o con cirugía). |
| Nº ítems · tiempo | 21 ítems en 5 dominios: síntomas físicos (6), deporte/ocio (4), trabajo (4), estilo de vida (4) y emociones (3) · unos 10 min |
| Rango · qué es mejor | 0–2100 · «menos es mejor». Expresado en %, 0–100 % · «más es mejor» |
| Puntuación | Cada ítem se responde en una escala analógica visual de 100 mm (0–100). **Total** = suma de los 21 ítems (0–2100). **%** = (2100 − total) / 2100 × 100. Cada dominio se puede dar como su suma. No hay ítems invertidos. Propongo calcularlo solo con todos los ítems respondidos. |
| Interpretación | No he verificado puntos de corte ni MCID en PubMed. |
| Licencia | **Comprobar con el titular**. Copyright de A. Kirkley y el Fowler Kennedy Sport Medicine Clinic (Western University, Canadá); mismo titular que el WOSI. |

**Referencias**
1. Original: Kirkley A, Alvarez C, Griffin S. The development and evaluation of a disease-specific quality-of-life questionnaire for disorders of the rotator cuff: The Western Ontario Rotator Cuff Index. Clin J Sport Med. 2003;13(2):84-92. PMID: 12629425. DOI: 10.1097/00042752-200303000-00004
2. Validación española: no encontrada en PubMed. Lo que aparece en PubMed es la adaptación española de otro cuestionario distinto, el *Rotator Cuff Quality of Life* (RC-QOL): Rodríguez LR, Izquierdo TG, Martín DP. J Shoulder Elbow Surg. 2020;29(2):355-62. PMID: 31563505. DOI: 10.1016/j.jse.2019.07.015. No es el WORC.

**Instrucciones al paciente:** No se incluyen porque no he podido comprobar el texto original.

**Ítems**
Ítems no incluidos: no se pudo comprobar el texto original. Estructura: 21 ítems con escala analógica visual de 0 a 100, referidos a la última semana. Ítems 1–6, síntomas físicos; 7–10, deporte y ocio; 11–14, trabajo; 15–18, estilo de vida; 19–21, emociones.

---

### OSS — Escala de hombro de Oxford (Oxford Shoulder Score)
| Campo | Valor |
|---|---|
| id propuesto | `oss` |
| Grupo en la app | `regions: ["hombro"]` |
| Qué mide / cuándo usarlo en fisio | Dolor y función del hombro, sobre todo en patología degenerativa e inflamatoria y en el postoperatorio, salvo la cirugía de estabilización (para eso existe el Oxford Shoulder Instability Score). |
| Nº ítems · tiempo | 12 · unos 5 min |
| Rango · qué es mejor | 0–48 · «más es mejor» (sistema de puntuación actual) |
| Puntuación | Cada ítem tiene 5 opciones, puntuadas de 0 (peor) a 4 (mejor). **Total** = suma (0–48). La versión original de 1996 puntuaba de 1 a 5 por ítem y daba un total de 12 a 60, con «menos es mejor». Hay que usar el sistema actual 0–48 y dejar indicado cuál se usa. Las reglas para respuestas en blanco las da el manual del titular: aplicarlas según la licencia. |
| Interpretación | No he verificado puntos de corte ni MCID en PubMed. |
| Licencia | **Licencia**. Titular: Oxford University Innovation (Clinical Outcomes; innovation.ox.ac.uk/outcome-measures). El uso comercial y la inclusión en software requieren licencia de pago. Para uso clínico no comercial hay que registrarse. |

**Referencias**
1. Original: Dawson J, Fitzpatrick R, Carr A. Questionnaire on the perceptions of patients about shoulder surgery. J Bone Joint Surg Br. 1996;78(4):593-600. PMID: 8682827. DOI: no consta en PubMed.
2. Validación española (España, mujeres operadas de cáncer de mama): Torres-Lacomba M, Sánchez-Sánchez B, Prieto-Gómez V, Pacheco-da-Costa S, Yuste-Sánchez MJ, Navarro-Brazález B, et al. Spanish cultural adaptation and validation of the shoulder pain and disability index, and the oxford shoulder score after breast cancer surgery. Health Qual Life Outcomes. 2015;13:63. PMID: 26001890. DOI: 10.1186/s12955-015-0256-y

**Instrucciones al paciente:** No se incluyen porque el instrumento está sujeto a licencia.

**Ítems**
Ítems no incluidos: el instrumento está sujeto a licencia. Estructura: 12 ítems sobre las últimas 4 semanas, que tratan del dolor del hombro (intensidad, dolor nocturno, interferencia) y de actividades como vestirse, coger el transporte, comer con cubiertos, hacer la compra, llevar una bandeja, peinarse, colgar ropa en un armario, lavarse y secarse las axilas, y trabajar o hacer tareas domésticas. Tienen 5 opciones de respuesta, de 0 a 4.

---

### OES — Escala de codo de Oxford (Oxford Elbow Score)
| Campo | Valor |
|---|---|
| id propuesto | `oes` |
| Grupo en la app | `regions: ["codo"]` |
| Qué mide / cuándo usarlo en fisio | Función, dolor y repercusión psicosocial de los problemas de codo (artrosis, epicondilalgia, postoperatorios, secuelas de fracturas). |
| Nº ítems · tiempo | 12 ítems en 3 dominios de 4 ítems cada uno: función del codo, dolor y social-psicológico · unos 5 min |
| Rango · qué es mejor | Cada dominio va de 0 a 100 · «más es mejor» |
| Puntuación | Cada ítem va de 0 (peor) a 4 (mejor). **Puntuación de cada dominio** = suma de sus 4 ítems (0–16) × 100/16 → 0–100. Se dan tres puntuaciones por separado, una por dominio. Las reglas para respuestas en blanco las da el manual del titular. |
| Interpretación | No he verificado puntos de corte ni MCID en PubMed. |
| Licencia | **Licencia**. Titular: Oxford University Innovation (mismas condiciones que la OSS). |

**Referencias**
1. Original: Dawson J, Doll H, Boller I, Fitzpatrick R, Little C, Rees J, et al. The development and validation of a patient-reported questionnaire to assess outcomes of elbow surgery. J Bone Joint Surg Br. 2008;90(4):466-73. PMID: 18378921. DOI: 10.1302/0301-620X.90B4.20290
2. Validación española: no encontrada en PubMed.

**Instrucciones al paciente:** No se incluyen porque el instrumento está sujeto a licencia.

**Ítems**
Ítems no incluidos: el instrumento está sujeto a licencia. Estructura: 12 ítems sobre las últimas 4 semanas, con 5 opciones de respuesta de 0 a 4, repartidos en 3 dominios de 4 ítems (función del codo, dolor y social-psicológico).

---

### SIRSI — Escala de vuelta al deporte tras inestabilidad de hombro (Shoulder Instability-Return to Sport after Injury)
| Campo | Valor |
|---|---|
| id propuesto | `sirsi` |
| Grupo en la app | `regions: ["hombro"]` |
| Qué mide / cuándo usarlo en fisio | Preparación psicológica (confianza, emociones, valoración del riesgo) para volver al deporte tras una luxación o inestabilidad traumática del hombro, con o sin cirugía. Es el equivalente de hombro del ACL-RSI que ya tiene la app. |
| Nº ítems · tiempo | 12 · unos 3–5 min |
| Rango · qué es mejor | 0–100 % · «más es mejor» |
| Puntuación | Cada ítem va de 0 a 10. **Total** = suma de los 12 ítems (0–120) / 120 × 100 → 0–100 %. Los ítems de redacción negativa (2, 3, 6, 7, 9 y 10) se presentan con los extremos al revés, de modo que la puntuación más alta siempre corresponde a la respuesta más favorable. Si la app guarda la respuesta tal como la marca el paciente, hay que invertir esos ítems (10 − x). Respuestas en blanco: no definido por los autores. Propongo exigir los 12 ítems, igual que en el ACL-RSI de la app. |
| Interpretación | En el estudio original, los que volvieron al rugby tenían una media de 60,9 ± 26,6 % y los que no, 38,1 ± 25,6 %. No he verificado un punto de corte validado. |
| Licencia | **Comprobar con el titular**. Lo publicaron los autores (Gerometta y cols.) en *Knee Surg Sports Traumatol Arthrosc* (Springer) sin licencia declarada. Como deriva del ACL-RSI, conviene aplicar el mismo criterio de licencia que se usó para el ACL-RSI de la app. |

**Referencias**
1. Original: Gerometta A, Klouche S, Herman S, Lefevre N, Bohu Y. The Shoulder Instability-Return to Sport after Injury (SIRSI): a valid and reproducible scale to quantify psychological readiness to return to sport after traumatic shoulder instability. Knee Surg Sports Traumatol Arthrosc. 2018;26(1):203-11. PMID: 28707114. DOI: 10.1007/s00167-017-4645-0 (PubMed indica 2017 como fecha en línea).
2. Validación española: no encontrada en PubMed.

**Instrucciones al paciente:** «Responda a las siguientes preguntas pensando en el deporte que practicaba antes de lesionarse el hombro. Para cada pregunta, marque el número que mejor describa lo que siente ahora.»

**Ítems**
El resumen del artículo original confirma que el SIRSI es el ACL-RSI con «rodilla» cambiada por «hombro». **Para la app, lo más coherente es reutilizar el texto exacto de los 12 ítems del ACL-RSI que ya existe, cambiando «rodilla» por «hombro».** Como referencia, traducción del original:

Escala de 0 a 10 en todos. Junto a cada ítem se indica qué extremo vale 0 y cuál vale 10, para que siempre puntúe más alto la respuesta favorable.

1. ¿Confía en que podrá rendir en su deporte al mismo nivel que antes? — 0 = nada confiado; 10 = totalmente confiado
2. ¿Cree que es probable que vuelva a lesionarse el hombro practicando su deporte? — 0 = extremadamente probable; 10 = nada probable *(invertido)*
3. ¿Está nervioso por practicar su deporte? — 0 = extremadamente nervioso; 10 = nada nervioso *(invertido)*
4. ¿Confía en que su hombro no fallará al practicar su deporte? — 0 = nada confiado; 10 = totalmente confiado
5. ¿Confía en que podría practicar su deporte sin preocuparse por su hombro? — 0 = nada confiado; 10 = totalmente confiado
6. ¿Le resulta frustrante tener que tener en cuenta su hombro a la hora de practicar su deporte? — 0 = extremadamente frustrante; 10 = nada frustrante *(invertido)*
7. ¿Tiene miedo de volver a lesionarse el hombro practicando su deporte? — 0 = muchísimo miedo; 10 = ningún miedo *(invertido)*
8. ¿Confía en que su hombro aguantará bajo presión? — 0 = nada confiado; 10 = totalmente confiado
9. ¿Tiene miedo de lesionarse el hombro de forma accidental practicando su deporte? — 0 = muchísimo miedo; 10 = ningún miedo *(invertido)*
10. ¿Pensar que podría tener que pasar otra vez por una operación y la rehabilitación le impide practicar su deporte? — 0 = siempre; 10 = nunca *(invertido)*
11. ¿Confía en su capacidad para rendir bien en su deporte? — 0 = nada confiado; 10 = totalmente confiado
12. ¿Se siente tranquilo a la hora de practicar su deporte? — 0 = nada tranquilo; 10 = totalmente tranquilo

---

### UEFI — Índice funcional de la extremidad superior (Upper Extremity Functional Index)
| Campo | Valor |
|---|---|
| id propuesto | `uefi` |
| Grupo en la app | `regions: ["hombro", "codo", "muneca_mano"]` |
| Qué mide / cuándo usarlo en fisio | Función global del miembro superior en cualquier trastorno musculoesquelético. Es el equivalente del LEFS (que ya está en la app) para el miembro superior: mismo formato y misma lógica. |
| Nº ítems · tiempo | 20 (UEFI-20) · unos 3–5 min |
| Rango · qué es mejor | 0–80 · «más es mejor» |
| Puntuación | Cada ítem va de 0 a 4. **Total** = suma (0–80). Ítems en blanco: igual que en el LEFS, propongo prorratear (suma × 20 / nº de ítems respondidos) si faltan como mucho 2 ítems, y no calcularlo si faltan más. Es una convención práctica, no una regla de los autores. Existe además una versión de 15 ítems ajustada con Rasch (UEFI-15, 0–100) que exige una tabla de conversión; no se incluye aquí. |
| Interpretación | MCID positivo de 8 puntos sobre 80 en el UEFI-20 (6,7/100 en el UEFI-15); MDC de 9,4/80. El MCID es mayor si el brazo afectado es el no dominante (Chesworth 2014). |
| Licencia | **Comprobar con el titular**. Copyright de los autores (P. W. Stratford y J. M. Binkley, McMaster University). Se difunde gratis para uso clínico, igual que el LEFS, pero no he podido confirmar las condiciones para software comercial. Conviene aplicar el mismo criterio que se usó para el LEFS. |

**Referencias**
1. Original: Stratford PW, Binkley JM, Stratford DM. Development and initial validation of the upper extremity functional index. Physiother Can. 2001;53(4):259-67. ⚠ sin verificar (no está en PubMed y OpenAlex no estaba disponible).
2. Validación española: no encontrada en PubMed.
3. MCID: Chesworth BM, Hamilton CB, Walton DM, Benoit M, Blake TA, Bredy H, et al. Reliability and validity of two versions of the upper extremity functional index. Physiother Can. 2014;66(3):243-53. PMID: 25125777. DOI: 10.3138/ptc.2013-45

**Instrucciones al paciente:** «Nos interesa saber si tiene alguna dificultad, por el problema de su brazo, para hacer las actividades que se enumeran a continuación. Responda a cada actividad pensando en cómo se encuentra hoy.»

**Ítems**: opciones para todos: 0 = dificultad extrema o incapaz de hacerlo; 1 = mucha dificultad; 2 = dificultad moderada; 3 = poca dificultad; 4 = ninguna dificultad.
1. Cualquiera de sus tareas habituales del trabajo, de casa o de estudio
2. Sus aficiones habituales, actividades de ocio o deportivas
3. Levantar una bolsa de la compra hasta la cintura
4. Levantar una bolsa de la compra por encima de la cabeza
5. Peinarse o arreglarse el pelo
6. Apoyarse en las manos para incorporarse (por ejemplo, para salir de la bañera o levantarse de una silla)
7. Preparar comida (por ejemplo, pelar o cortar)
8. Conducir
9. Pasar la aspiradora, barrer o rastrillar
10. Vestirse
11. Abrocharse botones
12. Usar herramientas o electrodomésticos
13. Abrir puertas
14. Limpiar
15. Atarse los cordones de los zapatos
16. Dormir
17. Lavar la ropa (por ejemplo, lavar, planchar, doblar)
18. Abrir un tarro
19. Lanzar una pelota
20. Llevar una maleta pequeña con el brazo afectado

---
## Miembro inferior y deporte

> Todas las referencias con PMID/DOI se han comprobado en PubMed (herramienta PubMed MCP) en esta sesión. OpenAlex no estaba accesible (error de proxy), así que lo que no está en PubMed figura como «no encontrada en PubMed». Si una referencia no tiene DOI es porque PubMed no lo da.

---

### Kujala / AKPS — Escala de dolor femoropatelar de Kujala (Anterior Knee Pain Scale)
| Campo | Valor |
|---|---|
| id propuesto | `kujala` |
| Grupo en la app | `regions: ["rodilla"]` |
| Qué mide / cuándo usarlo en fisio | Síntomas y limitación funcional en el dolor femoropatelar / dolor anterior de rodilla (incluye inestabilidad rotuliana). Para la valoración inicial y el seguimiento del SDFP. |
| Nº ítems · tiempo | 13 ítems · 5 min |
| Rango · qué es mejor | 0–100 · más es mejor |
| Puntuación | Suma directa de los puntos de la opción elegida en cada ítem (máx. 100). Una sola respuesta por ítem. Si falta algún ítem no se puede calcular el total (no hay regla de prorrateo publicada): marcar como incompleto. |
| Interpretación | MCID ≈ 10 puntos sobre 100 (Crossley et al. 2004, ref. 3). |
| Licencia | **Libre**: escala publicada en el artículo original y de uso clínico generalizado; no tiene titular comercial conocido. |

**Referencias**
1. Original: Kujala UM, Jaakkola LH, Koskinen SK, Taimela S, Hurme M, Nelimarkka O. Scoring of patellofemoral disorders. Arthroscopy. 1993;9(2):159-63. PMID: 8461073. DOI: 10.1016/s0749-8063(05)80366-4
2. Validación española: Gil-Gámez J, Pecos-Martín D, Kujala UM, Martínez-Merinero P, Montañez-Aguilera FJ, Romero-Franco N, et al. Validation and cultural adaptation of "Kujala Score" in Spanish. Knee Surg Sports Traumatol Arthrosc. 2016;24(9):2845-53. PMID: 25649731. DOI: 10.1007/s00167-015-3521-z (España)
3. MCID: Crossley KM, Bennell KL, Cowan SM, Green S. Analysis of outcome measures for persons with patellofemoral pain: which are reliable and valid? Arch Phys Med Rehabil. 2004;85(5):815-22. PMID: 15129407. DOI: 10.1016/s0003-9993(03)00613-0

**Instrucciones al paciente:** «Para cada pregunta, marque la opción que mejor describa los síntomas actuales de su rodilla.»

**Ítems**
1. Cojera — opciones: 5 = no cojeo; 3 = cojeo leve o de vez en cuando; 0 = cojeo siempre.
2. Apoyo del peso — opciones: 5 = apoyo todo el peso sin dolor; 3 = apoyar me duele; 0 = no puedo apoyar el peso.
3. Caminar — opciones: 5 = sin límite; 3 = más de 2 km; 2 = entre 1 y 2 km; 0 = no puedo caminar.
4. Escaleras — opciones: 10 = sin dificultad; 8 = un poco de dolor al bajar; 5 = dolor al bajar y al subir; 0 = no puedo.
5. Ponerse en cuclillas — opciones: 5 = sin dificultad; 4 = me duele si lo hago repetidamente; 3 = me duele cada vez; 2 = solo puedo si no cargo todo el peso; 0 = no puedo.
6. Correr — opciones: 10 = sin dificultad; 8 = dolor después de más de 2 km; 6 = un poco de dolor desde el principio; 3 = dolor intenso; 0 = no puedo.
7. Saltar — opciones: 10 = sin dificultad; 7 = un poco de dificultad; 2 = dolor constante; 0 = no puedo.
8. Estar sentado mucho rato con las rodillas dobladas — opciones: 10 = sin dificultad; 8 = me duele después de hacer ejercicio; 6 = dolor constante; 4 = el dolor me obliga a estirar las rodillas de vez en cuando; 0 = no puedo.
9. Dolor — opciones: 10 = ninguno; 8 = leve y ocasional; 6 = me altera el sueño; 3 = a veces intenso; 0 = constante e intenso.
10. Hinchazón — opciones: 10 = ninguna; 8 = después de un esfuerzo intenso; 6 = después de las actividades diarias; 4 = todas las tardes; 0 = constante.
11. Movimientos anormales y dolorosos de la rótula (sensación de que se sale) — opciones: 10 = nunca; 6 = a veces, al hacer deporte; 4 = a veces, en la vida diaria; 2 = he tenido al menos una luxación confirmada; 0 = más de dos luxaciones.
12. Pérdida de masa muscular del muslo — opciones: 5 = no; 3 = leve; 0 = importante.
13. Dificultad para doblar la rodilla del todo — opciones: 5 = no; 3 = leve; 0 = importante.

---

### Lysholm — Escala de rodilla de Lysholm
| Campo | Valor |
|---|---|
| id propuesto | `lysholm` |
| Grupo en la app | `regions: ["rodilla"]` |
| Qué mide / cuándo usarlo en fisio | Síntomas y función de rodilla, sobre todo tras lesión ligamentosa (LCA) o meniscal. Se suele pasar junto con la escala de Tegner. |
| Nº ítems · tiempo | 8 ítems · 3–5 min |
| Rango · qué es mejor | 0–100 · más es mejor |
| Puntuación | Suma directa de los puntos de cada ítem (pesos distintos: cojera 5, apoyo 5, bloqueo 15, inestabilidad 25, dolor 25, hinchazón 10, escaleras 10, cuclillas 5). Sin prorrateo: si falta un ítem, total no calculable. |
| Interpretación | Cambio mínimo detectable 8,9 puntos (Briggs et al. 2009, ref. 3). Las categorías clásicas excelente/bueno/regular/malo no se han podido verificar con la herramienta: no mostrarlas. |
| Licencia | **Libre**: publicada en el artículo original, sin titular comercial conocido. |

**Referencias**
1. Original: Lysholm J, Gillquist J. Evaluation of knee ligament surgery results with special emphasis on use of a scoring scale. Am J Sports Med. 1982;10(3):150-4. PMID: 6896798. DOI: 10.1177/036354658201000306
2. Validación española: Arroyo-Morales M, Martin-Alguacil J, Lozano-Lozano M, Cuesta-Vargas AI, Fernández-Fernández AJ, González JA, et al. The Lysholm score: cross cultural validation and evaluation of psychometric properties of the Spanish version. PLoS One. 2019;14(8):e0221376. PMID: 31454386. DOI: 10.1371/journal.pone.0221376 (España)
3. Fiabilidad / MDC: Briggs KK, Lysholm J, Tegner Y, Rodkey WG, Kocher MS, Steadman JR. The reliability, validity, and responsiveness of the Lysholm score and Tegner activity scale for anterior cruciate ligament injuries of the knee: 25 years later. Am J Sports Med. 2009;37(5):890-7. PMID: 19261899. DOI: 10.1177/0363546508330143

**Instrucciones al paciente:** «Marque en cada apartado la opción que mejor describa cómo está su rodilla actualmente.»

**Ítems**
1. Cojera — opciones: 5 = no cojeo; 3 = cojeo leve o de vez en cuando; 0 = cojeo intenso y constante.
2. Apoyo — opciones: 5 = no necesito ayuda; 2 = uso bastón o muleta; 0 = no puedo apoyar el peso.
3. Bloqueo — opciones: 15 = ni bloqueos ni sensación de enganche; 10 = sensación de enganche pero sin bloqueo; 6 = bloqueo de vez en cuando; 2 = bloqueo frecuente; 0 = la rodilla está bloqueada ahora mismo.
4. Inestabilidad (la rodilla «falla» o «se va») — opciones: 25 = nunca; 20 = rara vez, durante el deporte u otros esfuerzos intensos; 15 = a menudo durante el deporte u otros esfuerzos intensos (o no puedo hacerlos); 10 = de vez en cuando en las actividades diarias; 5 = a menudo en las actividades diarias; 0 = a cada paso.
5. Dolor — opciones: 25 = ninguno; 20 = leve y ocasional con esfuerzos intensos; 15 = marcado con esfuerzos intensos; 10 = marcado al caminar más de 2 km o después; 5 = marcado al caminar menos de 2 km o después; 0 = constante.
6. Hinchazón — opciones: 10 = ninguna; 6 = con esfuerzos intensos; 2 = con esfuerzos normales; 0 = constante.
7. Subir escaleras — opciones: 10 = sin problema; 6 = un poco limitado; 2 = escalón a escalón; 0 = no puedo.
8. Ponerse en cuclillas — opciones: 5 = sin problema; 4 = un poco limitado; 2 = no más allá de 90° (ángulo recto); 0 = no puedo.

---

### IKDC — Formulario subjetivo de rodilla del International Knee Documentation Committee (IKDC 2000)
| Campo | Valor |
|---|---|
| id propuesto | `ikdc` |
| Grupo en la app | `regions: ["rodilla"]` |
| Qué mide / cuándo usarlo en fisio | Síntomas, función y actividad deportiva en cualquier patología de rodilla (ligamentos, menisco, cartílago, femoropatelar). Muy usado en rehabilitación de LCA. |
| Nº ítems · tiempo | 18 ítems puntuables (10 preguntas, la 9 con 9 apartados; la 10 tiene un apartado «antes de la lesión» que NO puntúa) · 5–10 min |
| Rango · qué es mejor | 0–100 · más es mejor |
| Puntuación | 1) Puntos de cada respuesta según se indica abajo. Los ítems 2 y 3 se invierten: puntos = 10 − número marcado. 2) Suma de los 18 ítems (máx. 87). 3) Puntuación = (suma obtenida − mínimo posible) / (máximo posible de los ítems respondidos − mínimo posible) × 100; como el mínimo es 0, es (suma / máximo de los ítems respondidos) × 100. 4) Se puede calcular si están respondidos al menos 16 de los 18 ítems (90 %); con más en blanco, no calcular. La función «antes de la lesión» (10a) se guarda pero no se suma. |
| Interpretación | Cambio de 11,5 puntos: el de mayor sensibilidad para detectar mejoría; 20,5 puntos: el de mayor especificidad (Irrgang et al. 2006, ref. 3). |
| Licencia | **Libre con permiso o registro**: el formulario lo distribuye gratis la AOSSM (American Orthopaedic Society for Sports Medicine) junto con el IKDC. Comprobar con la AOSSM las condiciones para meterlo en software comercial. |

**Referencias**
1. Original: Irrgang JJ, Anderson AF, Boland AL, Harner CD, Kurosaka M, Neyret P, et al. Development and validation of the international knee documentation committee subjective knee form. Am J Sports Med. 2001;29(5):600-13. PMID: 11573919. DOI: 10.1177/03635465010290051301
2. Validación española: Pujol O, González-Morgado D, Lara Y, Loya D, Batalla L, Minguell J. Translation and cultural adaptation into Spanish of the IKDC-Subjective knee form and Tegner Activity Scale. Cir Cir. 2025;93(5):518-22. PMID: 41094617. DOI: 10.24875/CIRU.23000460 (España; solo traducción y adaptación cultural, sin estudio psicométrico completo)
3. MCID: Irrgang JJ, Anderson AF, Boland AL, Harner CD, Neyret P, Richmond JC, et al. Responsiveness of the International Knee Documentation Committee Subjective Knee Form. Am J Sports Med. 2006;34(10):1567-73. PMID: 16870824. DOI: 10.1177/0363546506288855

**Instrucciones al paciente:** «Responda pensando en su rodilla. Para las actividades, escoja el nivel más alto que puede hacer sin que aparezca el síntoma que se indica, aunque no lo practique realmente.»

**Ítems**
Opciones de nivel de actividad (ítems 1, 5, 7 y 8): 4 = actividades muy intensas, como saltar o hacer giros bruscos (baloncesto, fútbol); 3 = actividades intensas, como trabajo físico duro, esquí o tenis; 2 = actividades moderadas, como trabajo físico moderado, correr o trotar; 1 = actividades ligeras, como caminar, tareas de la casa o del jardín; 0 = no puedo hacer ninguna de estas actividades por la rodilla.

1. ¿Cuál es el nivel de actividad más alto que puede hacer sin dolor importante en la rodilla? — opciones de nivel de actividad (4–0).
2. En las últimas 4 semanas, o desde su lesión, ¿con qué frecuencia ha tenido dolor? — escala 0 (nunca) a 10 (constantemente). Puntos = 10 − respuesta.
3. Si tiene dolor, ¿cuánto le duele? — escala 0 (nada) a 10 (el peor dolor imaginable). Puntos = 10 − respuesta.
4. En las últimas 4 semanas, o desde su lesión, ¿cuánta rigidez o hinchazón ha tenido en la rodilla? — opciones: 4 = nada; 3 = poca; 2 = moderada; 1 = mucha; 0 = muchísima.
5. ¿Cuál es el nivel de actividad más alto que puede hacer sin que se le hinche mucho la rodilla? — opciones de nivel de actividad (4–0).
6. En las últimas 4 semanas, o desde su lesión, ¿se le ha bloqueado o enganchado la rodilla? — opciones: 1 = no; 0 = sí.
7. ¿Cuál es el nivel de actividad más alto que puede hacer sin que la rodilla le falle de forma importante? — opciones de nivel de actividad (4–0).
8. ¿Cuál es el nivel de actividad más alto que puede practicar de forma habitual? — opciones de nivel de actividad (4–0).
9. ¿Cuánto le dificulta la rodilla…? — opciones (para cada apartado): 4 = ninguna dificultad; 3 = dificultad mínima; 2 = dificultad moderada; 1 = dificultad extrema; 0 = no puedo hacerlo.
   a. Subir escaleras
   b. Bajar escaleras
   c. Arrodillarse (apoyando la parte delantera de la rodilla)
   d. Ponerse en cuclillas
   e. Estar sentado con la rodilla doblada
   f. Levantarse de una silla
   g. Correr en línea recta
   h. Saltar y caer sobre la pierna afectada
   i. Parar y arrancar de golpe
10. Valore la función de su rodilla de 0 a 10, donde 10 es una función normal y excelente y 0 es no poder hacer ninguna de sus actividades diarias habituales, deporte incluido.
   a. Función antes de la lesión — 0–10 (no puntúa).
   b. Función actual — 0–10 (puntos = número marcado).

---

### Tegner — Escala de actividad de Tegner
| Campo | Valor |
|---|---|
| id propuesto | `tegner` |
| Grupo en la app | `regions: ["rodilla"]` |
| Qué mide / cuándo usarlo en fisio | Nivel de actividad laboral y deportiva (no la función). Se pide el nivel actual y el previo a la lesión para ver la pérdida de actividad; se suele pasar con el Lysholm. |
| Nº ítems · tiempo | 1 ítem (11 niveles) · 1 min. Recomendado preguntar dos veces: «antes de la lesión» y «ahora». |
| Rango · qué es mejor | 0–10 · más es mejor (más actividad) |
| Puntuación | La puntuación es el nivel marcado (0–10). Sin prorrateo. Guardar por separado el nivel previo y el actual. |
| Interpretación | Cambio mínimo detectable: 1 nivel (Briggs et al. 2009, ref. 3). No es una medida de función: no tiene puntos de corte de «bueno/malo». |
| Licencia | **Libre**: publicada en el artículo original, sin titular comercial conocido. |

**Referencias**
1. Original: Tegner Y, Lysholm J. Rating systems in the evaluation of knee ligament injuries. Clin Orthop Relat Res. 1985;(198):43-9. PMID: 4028566. DOI: no disponible en PubMed.
2. Validación española: Pujol O, González-Morgado D, Lara Y, Loya D, Batalla L, Minguell J. Translation and cultural adaptation into Spanish of the IKDC-Subjective knee form and Tegner Activity Scale. Cir Cir. 2025;93(5):518-22. PMID: 41094617. DOI: 10.24875/CIRU.23000460 (España; solo traducción y adaptación cultural)
3. Fiabilidad / MDC: Briggs KK, Lysholm J, Tegner Y, Rodkey WG, Kocher MS, Steadman JR. The reliability, validity, and responsiveness of the Lysholm score and Tegner activity scale for anterior cruciate ligament injuries of the knee: 25 years later. Am J Sports Med. 2009;37(5):890-7. PMID: 19261899. DOI: 10.1177/0363546508330143

**Instrucciones al paciente:** «Marque el nivel que mejor describa su actividad más alta (trabajo o deporte). Responda primero cómo era antes de la lesión y después cómo es ahora.»

**Ítems** (una sola respuesta; el valor es el nivel)
- 10 = Deporte de competición: fútbol, fútbol americano o rugby a nivel de élite nacional.
- 9 = Deporte de competición: fútbol, fútbol americano o rugby en categorías inferiores; hockey sobre hielo; lucha; gimnasia.
- 8 = Deporte de competición: bandy; squash o bádminton; atletismo (saltos, etc.); esquí alpino.
- 7 = Deporte de competición: tenis; atletismo (carreras); motocross o speedway; balonmano; baloncesto. Deporte recreativo: fútbol, fútbol americano, rugby, bandy, hockey sobre hielo, baloncesto, squash, atletismo (saltos); carrera de orientación (recreativa o de competición).
- 6 = Deporte recreativo: tenis y bádminton; balonmano; baloncesto; esquí alpino; correr al menos 5 veces por semana.
- 5 = Trabajo pesado (construcción, trabajo forestal). Deporte de competición: ciclismo; esquí de fondo. Deporte recreativo: correr por terreno irregular al menos 2 veces por semana.
- 4 = Trabajo moderadamente pesado (conducir camiones, tareas domésticas pesadas). Deporte recreativo: ciclismo; esquí de fondo; correr por terreno llano al menos 2 veces por semana.
- 3 = Trabajo ligero (p. ej., enfermería). Deporte de competición y recreativo: natación. Puedo caminar por el monte.
- 2 = Trabajo ligero. Puedo caminar por terreno irregular, pero no por el monte.
- 1 = Trabajo sedentario (p. ej., de oficina). Puedo caminar por terreno llano.
- 0 = Estoy de baja o tengo una pensión por incapacidad por problemas de rodilla.

---

### Marx — Escala de actividad de Marx (Marx Activity Rating Scale)
| Campo | Valor |
|---|---|
| id propuesto | `marx` |
| Grupo en la app | `regions: ["rodilla"]` |
| Qué mide / cuándo usarlo en fisio | Frecuencia con la que el paciente hace movimientos exigentes para la rodilla (correr, cambiar de dirección, frenar, pivotar), sin depender de un deporte concreto. Útil para describir el nivel de actividad en lesiones de rodilla del deportista. |
| Nº ítems · tiempo | 4 ítems · 1 min |
| Rango · qué es mejor | 0–16 · más es mejor (más actividad) |
| Puntuación | Suma de los 4 ítems (0–4 cada uno). Se pregunta por el momento de mayor actividad del último año, estando sano. Sin prorrateo. |
| Interpretación | Sin puntos de corte ni MCID verificados. Fiabilidad test-retest CCI 0,97 (ref. 1). |
| Licencia | **Libre**: publicada en el artículo original. Comprobar con el autor (R. G. Marx, Hospital for Special Surgery) solo si se va a comercializar la app. |

**Referencias**
1. Original: Marx RG, Stump TJ, Jones EC, Wickiewicz TL, Warren RF. Development and evaluation of an activity rating scale for disorders of the knee. Am J Sports Med. 2001;29(2):213-8. PMID: 11292048. DOI: 10.1177/03635465010290021601
2. Validación española: no encontrada en PubMed.

**Instrucciones al paciente:** «Indique con qué frecuencia hizo cada actividad en su momento más sano y activo del último año.»

**Ítems**
Opciones comunes: 0 = menos de una vez al mes; 1 = una vez al mes; 2 = una vez a la semana; 3 = 2 o 3 veces por semana; 4 = 4 o más veces por semana.
1. Correr: correr mientras practica un deporte o hace footing.
2. Cambiar de dirección: cambiar de dirección mientras corre.
3. Frenar: pararse de golpe mientras corre.
4. Pivotar: girar el cuerpo con el pie apoyado mientras practica un deporte (p. ej., esquiar, patinar, chutar, lanzar o golpear una pelota en golf, tenis, squash, etc.).

---

### KOOS-12 — Knee injury and Osteoarthritis Outcome Score, forma corta de 12 ítems
| Campo | Valor |
|---|---|
| id propuesto | `koos12` |
| Grupo en la app | `regions: ["rodilla"]` |
| Qué mide / cuándo usarlo en fisio | Versión corta del KOOS (que ya está en la app) con dolor, función y calidad de vida, más una puntuación resumen del impacto de la rodilla. Para el seguimiento rutinario cuando el KOOS completo resulta largo. |
| Nº ítems · tiempo | 12 ítems (dolor 4, función 4, calidad de vida 4) · 3 min |
| Rango · qué es mejor | 0–100 por subescala y resumen · más es mejor |
| Puntuación | Mismas opciones y valores 0–4 que en el KOOS. Cada subescala: 100 − (media de los ítems respondidos × 100 / 4). Resumen = media de las tres subescalas. Mínimo de ítems respondidos por subescala: ⚠ comprobar en la guía de puntuación KOOS-12 (koos.nu); hasta entonces, no calcular una subescala con más de 2 ítems en blanco. |
| Interpretación | Sin MCID verificado. |
| Licencia | **Comprobar con el titular**: es la misma que la del KOOS que ya tiene la app (Ewa M. Roos, koos.nu). Hay que confirmar que cubre también la forma corta. |

**Referencias**
1. Original (selección de ítems): Gandek B, Roos EM, Franklin PD, Ware JE. Item selection for 12-item short forms of the Knee injury and Osteoarthritis Outcome Score (KOOS-12) and Hip disability and Osteoarthritis Outcome Score (HOOS-12). Osteoarthritis Cartilage. 2019;27(5):746-53. PMID: 30593867. DOI: 10.1016/j.joca.2018.11.011
2. Validación (original): Gandek B, Roos EM, Franklin PD, Ware JE. A 12-item short form of the Knee injury and Osteoarthritis Outcome Score (KOOS-12): tests of reliability, validity and responsiveness. Osteoarthritis Cartilage. 2019;27(5):762-70. PMID: 30716536. DOI: 10.1016/j.joca.2019.01.011
3. Validación española: Horta-Baas G, Vargas-Mena R, Alejandre E, Peláez-Ballestas I, Romero-Figueroa MDS, Queipo G. Psychometric properties of the 12-item Knee injury and Osteoarthritis Outcome Score (KOOS-12) Spanish version for people with knee osteoarthritis. Clin Rheumatol. 2021;40(4):1547-58. PMID: 32948971. DOI: 10.1007/s10067-020-05403-x (**latinoamericana, México**)

**Instrucciones al paciente:** las mismas que el KOOS de la app.

**Ítems** (reutilizar el texto y las opciones que ya tiene la app para el KOOS; no redactarlos de nuevo)
- Dolor (4): frecuencia del dolor de rodilla; dolor al estar sentado o tumbado; dolor al caminar por terreno llano; dolor al subir o bajar escaleras.
- Función (4): estar de pie; levantarse de una silla; subir o bajar del coche; girar o pivotar sobre la rodilla lesionada.
- Calidad de vida (4): los 4 ítems de calidad de vida del KOOS (Q1–Q4).

---

### HOOS-12 — Hip disability and Osteoarthritis Outcome Score, forma corta de 12 ítems
| Campo | Valor |
|---|---|
| id propuesto | `hoos12` |
| Grupo en la app | `regions: ["cadera"]` |
| Qué mide / cuándo usarlo en fisio | Versión corta del HOOS (que ya está en la app): dolor, función, calidad de vida y resumen del impacto de la cadera. Seguimiento rutinario de cadera degenerativa o tras prótesis. |
| Nº ítems · tiempo | 12 ítems (dolor 4, función 4, calidad de vida 4) · 3 min |
| Rango · qué es mejor | 0–100 por subescala y resumen · más es mejor |
| Puntuación | Igual que en el KOOS-12: valores 0–4; subescala = 100 − (media × 100 / 4); resumen = media de las tres subescalas. Mínimo de ítems respondidos: ⚠ comprobar en la guía HOOS-12 (koos.nu). |
| Interpretación | Sin MCID verificado. |
| Licencia | **Comprobar con el titular**: la misma que la del HOOS de la app (koos.nu). |

**Referencias**
1. Original (selección de ítems): Gandek B, Roos EM, Franklin PD, Ware JE. Item selection for 12-item short forms of the Knee injury and Osteoarthritis Outcome Score (KOOS-12) and Hip disability and Osteoarthritis Outcome Score (HOOS-12). Osteoarthritis Cartilage. 2019;27(5):746-53. PMID: 30593867. DOI: 10.1016/j.joca.2018.11.011
2. Validación (original): Gandek B, Roos EM, Franklin PD, Ware JE. A 12-item short form of the Hip disability and Osteoarthritis Outcome Score (HOOS-12): tests of reliability, validity and responsiveness. Osteoarthritis Cartilage. 2019;27(5):754-61. PMID: 30419279. DOI: 10.1016/j.joca.2018.09.017
3. Validación española: no encontrada en PubMed.

**Instrucciones al paciente:** las mismas que el HOOS de la app.

**Ítems** (reutilizar el texto y las opciones del HOOS de la app)
- Dolor (4): frecuencia del dolor de cadera; dolor al estar sentado o tumbado; dolor al caminar por terreno llano; dolor al subir o bajar escaleras.
- Función (4): estar de pie; levantarse de una silla; subir o bajar del coche; caminar por terreno irregular.
- Calidad de vida (4): los 4 ítems de calidad de vida del HOOS (Q1–Q4).

---

### iHOT-12 — International Hip Outcome Tool, versión corta de 12 ítems
| Campo | Valor |
|---|---|
| id propuesto | `ihot12` |
| Grupo en la app | `regions: ["cadera"]` |
| Qué mide / cuándo usarlo en fisio | Calidad de vida relacionada con la cadera en pacientes jóvenes y activos (choque femoroacetabular, lesión del labrum, tras artroscopia). |
| Nº ítems · tiempo | 12 ítems · 3–5 min |
| Rango · qué es mejor | 0–100 · más es mejor |
| Puntuación | Cada ítem es una escala visual analógica de 100 mm (deslizador 0–100), con 100 en el extremo de «mejor». Puntuación total = media de los ítems respondidos. Regla para ítems en blanco: ⚠ comprobar con el titular. |
| Interpretación | Versión española: cambio mínimo detectable 17,22 puntos (González-de-la-Flor et al. 2022, ref. 2). |
| Licencia | **Comprobar con el titular** (grupo iHOT, Mohtadi NGH / Griffin DR; Universidad de Calgary): no se ha podido confirmar si el uso en software comercial requiere permiso. |

**Referencias**
1. Original: Griffin DR, Parsons N, Mohtadi NG, Safran MR, et al. A short version of the International Hip Outcome Tool (iHOT-12) for use in routine clinical practice. Arthroscopy. 2012;28(5):611-6. PMID: 22542434. DOI: 10.1016/j.arthro.2012.02.027
2. Validación española: González-de-la-Flor Á, López-de-Uralde-Villanueva I, Valera-Calero JA, Almazán-Polo J, López-Marcos JJ, Fernández-de-Las-Peñas C, et al. Validity and test-retest reliability of the Spanish version of the International Hip Outcome Tool (iHOT-12Sv). J Clin Med. 2022;11(21):6232. PMID: 36362462. DOI: 10.3390/jcm11216232 (España)
3. Relacionada: Ruiz-Ibán MA, Seijas R, Sallent A, Ares O, Marín-Peña O, Muriel A, et al. The international Hip Outcome Tool-33 (iHOT-33): multicenter validation and translation to Spanish. Health Qual Life Outcomes. 2015;13:62. PMID: 25986456. DOI: 10.1186/s12955-015-0255-z

**Instrucciones al paciente:** ⚠ tomarlas de la versión española iHOT-12Sv.

**Ítems:** no incluidos. Hay que confirmar la licencia y no se ha podido comprobar el texto exacto de la versión española. Estructura: 12 deslizadores de 0 a 100 sobre dolor, síntomas mecánicos, función, deporte, trabajo y aspectos sociales/emocionales.

---

### HAGOS — Copenhagen Hip and Groin Outcome Score
| Campo | Valor |
|---|---|
| id propuesto | `hagos` |
| Grupo en la app | `regions: ["cadera"]` |
| Qué mide / cuándo usarlo en fisio | Dolor de cadera e ingle de larga evolución en personas jóvenes o de mediana edad físicamente activas (pubalgia, dolor relacionado con aductores, choque femoroacetabular). Seis subescalas independientes. |
| Nº ítems · tiempo | 37 ítems · 10 min |
| Rango · qué es mejor | 0–100 por subescala · más es mejor |
| Puntuación | Formato tipo KOOS: cada ítem de 0 a 4 (Likert de 5 opciones). Cada subescala = 100 − (media de los ítems respondidos × 100 / 4). No hay puntuación total: se informan las 6 subescalas (síntomas, dolor, función en la vida diaria, función en deporte y ocio, participación en actividad física, calidad de vida). Regla para ítems en blanco: ⚠ comprobar en el manual de usuario de HAGOS. |
| Interpretación | Cambio mínimo detectable individual de 17,7 a 33,8 puntos según la subescala; en grupo, de 2,7 a 5,2 (Thorborg et al. 2011, ref. 1). |
| Licencia | **Comprobar con el titular** (Kristian Thorborg, Copenhague; se distribuye junto al KOOS/HOOS): se cree de uso gratuito, pero no se ha podido confirmar. |

**Referencias**
1. Original: Thorborg K, Hölmich P, Christensen R, Petersen J, Roos EM. The Copenhagen Hip and Groin Outcome Score (HAGOS): development and validation according to the COSMIN checklist. Br J Sports Med. 2011;45(6):478-91. PMID: 21478502. DOI: 10.1136/bjsm.2010.080937
2. Validación española: no encontrada en PubMed. (Hay estudios españoles que lo usan, p. ej. PMID 33317337 y 36265328, pero ninguno publica una validación.)

**Instrucciones al paciente:** ⚠ tomarlas de la versión oficial.

**Ítems:** no incluidos. No se ha podido comprobar el texto original de los 37 ítems. Reparto: síntomas 7, dolor 10, función en la vida diaria 5, función en deporte y ocio 8, participación en actividad física 2, calidad de vida 5.

---

### VISA-G — Victorian Institute of Sport Assessment, versión glútea
| Campo | Valor |
|---|---|
| id propuesto | `visa_g` |
| Grupo en la app | `regions: ["cadera"]` |
| Qué mide / cuándo usarlo en fisio | Gravedad de la discapacidad en la tendinopatía glútea / síndrome de dolor del trocánter mayor. Sigue el formato de VISA-A y VISA-P (ya en la app). |
| Nº ítems · tiempo | 8 ítems · 5 min |
| Rango · qué es mejor | 0–100 · más es mejor |
| Puntuación | Suma de los ítems (formato VISA). ⚠ Comprobar con el artículo original el valor de cada ítem y de cada opción antes de implementarlo. |
| Interpretación | Sin MCID verificado. Fiabilidad test-retest CCI 0,827; alfa de Cronbach 0,809 (ref. 1). |
| Licencia | **Comprobar con el titular** (Fearon AM, Australian National University). |

**Referencias**
1. Original: Fearon AM, Ganderton C, Scarvell JM, Smith PN, Neeman T, Nash C, et al. Development and validation of a VISA tendinopathy questionnaire for greater trochanteric pain syndrome, the VISA-G. Man Ther. 2015;20(6):805-13. PMID: 25870117. DOI: 10.1016/j.math.2015.03.009
2. Validación española: no encontrada en PubMed.

**Instrucciones al paciente:** ⚠ tomarlas del original.

**Ítems:** no incluidos. No se ha podido comprobar el texto original.

---

### FAOS — Foot and Ankle Outcome Score
| Campo | Valor |
|---|---|
| id propuesto | `faos` |
| Grupo en la app | `regions: ["tobillo_pie"]` |
| Qué mide / cuándo usarlo en fisio | Síntomas y función de pie y tobillo (esguinces, inestabilidad, tendinopatías, fascitis, posquirúrgicos). Es la adaptación del KOOS al pie y tobillo. |
| Nº ítems · tiempo | 42 ítems · 10 min |
| Rango · qué es mejor | 0–100 por subescala · más es mejor |
| Puntuación | Igual que el KOOS: cada ítem 0–4; subescala = 100 − (media de los ítems respondidos × 100 / 4). Cinco subescalas: dolor (9), otros síntomas (7), actividades de la vida diaria (17), deporte y ocio (5), calidad de vida (4). No hay total oficial. Ítems en blanco: la misma regla que el KOOS de la app (guía de koos.nu). |
| Interpretación | Sin MCID verificado. |
| Licencia | **Comprobar con el titular**: la misma que la del KOOS (koos.nu). |

**Referencias**
1. Original: Roos EM, Brandsson S, Karlsson J. Validation of the foot and ankle outcome score for ankle ligament reconstruction. Foot Ankle Int. 2001;22(10):788-94. PMID: 11642530. DOI: 10.1177/107110070102201004
2. Validación española: Navarro-Flores E, Losa-Iglesias ME, Becerro-de-Bengoa-Vallejo R, Reina-Bueno M, López-López D, Romero-Morales C, et al. Cross-cultural adaptation, translation, and validation of the Spanish Foot and Ankle Outcome Score questionnaire. Int Wound J. 2020;17(5):1384-90. PMID: 32459042. DOI: 10.1111/iwj.13400 (España)
3. Otra versión en español: Pellegrini MJ, Poniachik R, Nuñez A, Escudero MI, Carcuro G, Cortes AA. Cross-cultural adaptation and validation of the Foot and Ankle Outcome Score (FAOS) into Spanish (Chile). Foot Ankle Surg. 2020;26(7):790-6. PMID: 31735690. DOI: 10.1016/j.fas.2019.10.007 (latinoamericana, Chile)

**Instrucciones al paciente:** las del KOOS de la app, cambiando «rodilla» por «pie/tobillo».

**Ítems:** no se reescriben aquí. Partir del texto del KOOS de la app cambiando «rodilla» por «pie/tobillo» y cotejarlo, ítem a ítem, con la versión española FAOS (ref. 2) antes de publicarlo, porque algunos ítems de síntomas y de dolor no son una sustitución literal.

---

### CAIT — Herramienta de Cumberland para la inestabilidad de tobillo (Cumberland Ankle Instability Tool)
| Campo | Valor |
|---|---|
| id propuesto | `cait` |
| Grupo en la app | `regions: ["tobillo_pie"]` |
| Qué mide / cuándo usarlo en fisio | Presencia y gravedad de la inestabilidad crónica de tobillo. Útil para el cribado tras esguinces de repetición y para el seguimiento. |
| Nº ítems · tiempo | 9 ítems · 3–5 min. Se responde para cada tobillo (izquierdo y derecho por separado). |
| Rango · qué es mejor | 0–30 por tobillo · más es mejor (más estable) |
| Puntuación | Suma de los puntos de los 9 ítems, para cada tobillo por separado. Sin prorrateo: si falta un ítem, total no calculable. |
| Interpretación | Punto de corte original 27,5 (≤ 27 indica inestabilidad; Hiller et al. 2006, ref. 1). Punto de corte recalibrado ≤ 25 (sensibilidad 96,6 %, especificidad 86,8 %; Wright et al. 2014, ref. 4), que es el recomendado. |
| Licencia | **Libre**: publicada en el artículo original, de uso clínico libre. |

**Referencias**
1. Original: Hiller CE, Refshauge KM, Bundy AC, Herbert RD, Kilbreath SL. The Cumberland ankle instability tool: a report of validity and reliability testing. Arch Phys Med Rehabil. 2006;87(9):1235-41. PMID: 16935061. DOI: 10.1016/j.apmr.2006.05.022
2. Validación española: Cruz-Díaz D, Hita-Contreras F, Lomas-Vega R, Osuna-Pérez MC, Martínez-Amat A. Cross-cultural adaptation and validation of the Spanish version of the Cumberland Ankle Instability Tool (CAIT): an instrument to assess unilateral chronic ankle instability. Clin Rheumatol. 2013;32(1):91-8. PMID: 23053687. DOI: 10.1007/s10067-012-2095-0 (España)
3. Otra validación española: Rodríguez-Fernández ÁL, Rebollo-Roldán J, Jiménez-Rejano JJ, Güeita-Rodríguez J. Psychometric properties of the Spanish version of the Cumberland Ankle Instability Tool. Disabil Rehabil. 2015;37(20):1888-94. PMID: 26292174. DOI: 10.3109/09638288.2014.984879 (España)
4. Punto de corte: Wright CJ, Arnold BL, Ross SE, Linens SW. Recalibration and validation of the Cumberland Ankle Instability Tool cutoff score for individuals with chronic ankle instability. Arch Phys Med Rehabil. 2014;95(10):1853-9. PMID: 24814563. DOI: 10.1016/j.apmr.2014.04.017

**Instrucciones al paciente:** «Marque la frase que MEJOR describa su tobillo en cada pregunta. Responda por separado para el tobillo izquierdo y el derecho.»

**Ítems**
1. Tengo dolor en el tobillo — opciones: 5 = nunca; 4 = al hacer deporte; 3 = al correr por terreno irregular; 2 = al correr por terreno llano; 1 = al caminar por terreno irregular; 0 = al caminar por terreno llano.
2. Noto el tobillo INESTABLE — opciones: 4 = nunca; 3 = a veces al hacer deporte (no siempre); 2 = con frecuencia al hacer deporte (siempre); 1 = a veces en las actividades diarias; 0 = con frecuencia en las actividades diarias.
3. Cuando hago giros BRUSCOS, noto el tobillo INESTABLE — opciones: 3 = nunca; 2 = a veces, al correr; 1 = a menudo, al correr; 0 = al caminar.
4. Al bajar escaleras, noto el tobillo INESTABLE — opciones: 3 = nunca; 2 = si bajo deprisa; 1 = de vez en cuando; 0 = siempre.
5. Noto el tobillo INESTABLE al estar de pie sobre UNA pierna — opciones: 2 = nunca; 1 = de puntillas; 0 = con el pie plano.
6. Noto el tobillo INESTABLE cuando… — opciones: 3 = nunca; 2 = salto de un lado a otro; 1 = salto en el sitio; 0 = salto.
7. Noto el tobillo INESTABLE cuando… — opciones: 4 = nunca; 3 = corro por terreno irregular; 2 = troto por terreno irregular; 1 = camino por terreno irregular; 0 = camino por terreno llano.
8. NORMALMENTE, cuando empiezo a torcerme el tobillo, puedo pararlo — opciones: 3 = de inmediato; 2 = a menudo; 1 = a veces; 0 = nunca; 3 = nunca me he torcido el tobillo.
9. Después de una torcedura TÍPICA, mi tobillo vuelve a la «normalidad» — opciones: 3 = casi de inmediato; 2 = en menos de un día; 1 = en 1–2 días; 0 = en más de 2 días; 3 = nunca me he torcido el tobillo.

---

### FAAM-Deporte — Foot and Ankle Ability Measure, subescala Deporte
| Campo | Valor |
|---|---|
| id propuesto | `faam_deporte` |
| Grupo en la app | `regions: ["tobillo_pie"]` |
| Qué mide / cuándo usarlo en fisio | Función en actividades deportivas o de alta demanda en lesiones de pierna, tobillo y pie. Complementa la FAAM-AVD que ya tiene la app; se suele pasar a continuación de ella. |
| Nº ítems · tiempo | 8 ítems · 2 min |
| Rango · qué es mejor | 0–100 % · más es mejor |
| Puntuación | Cada ítem vale de 4 (ninguna dificultad) a 0 (no puedo hacerlo). «No aplicable» no puntúa y se excluye. Puntuación = (suma de puntos / (n.º de ítems respondidos sin contar los «no aplicable» × 4)) × 100. Mismo criterio que la FAAM-AVD de la app. |
| Interpretación | MCID 9 puntos; cambio mínimo detectable ±12,3 puntos (Martin et al. 2005, ref. 1). |
| Licencia | **Libre**: la misma situación que la FAAM-AVD que ya está en la app. |

**Referencias**
1. Original: Martin RL, Irrgang JJ, Burdett RG, Conti SF, Van Swearingen JM. Evidence of validity for the Foot and Ankle Ability Measure (FAAM). Foot Ankle Int. 2005;26(11):968-83. PMID: 16309613. DOI: 10.1177/107110070502601113
2. Validación española: Cervera-Garvi P, Ortega-Avila AB, Morales-Asencio JM, Cervera-Marin JA, Martin RR, Gijon-Nogueron G. Cross-cultural adaptation and validation of Spanish version of The Foot and Ankle Ability Measures (FAAM-Sp). J Foot Ankle Res. 2017;10:39. PMID: 28852426. DOI: 10.1186/s13047-017-0221-6 (España; valida la subescala Deporte con estructura de un factor)

**Instrucciones al paciente:** «Responda a cada pregunta con la opción que mejor describa su estado durante la última semana. Si no hace la actividad por un motivo distinto del pie o el tobillo, marque "no aplicable".»

**Ítems**
Opciones comunes: 4 = ninguna dificultad; 3 = dificultad leve; 2 = dificultad moderada; 1 = dificultad extrema; 0 = no puedo hacerlo; N/A = no aplicable (no puntúa).
Por culpa del pie o del tobillo, ¿cuánta dificultad tiene para…?
1. Correr
2. Saltar
3. Caer tras un salto
4. Arrancar y parar de golpe
5. Cambiar de dirección o moverse en lateral
6. Hacer actividades de bajo impacto
7. Hacer la actividad con su técnica habitual
8. Practicar su deporte preferido todo el tiempo que quiera

(Opcional, igual que en la FAAM-AVD, sin puntuar: «Valore su nivel actual de función en actividades deportivas de 0 a 100, donde 100 es su nivel antes del problema y 0 es no poder hacer ninguna».)

---

### FFI — Índice de función del pie (Foot Function Index)
| Campo | Valor |
|---|---|
| id propuesto | `ffi` |
| Grupo en la app | `regions: ["tobillo_pie"]` |
| Qué mide / cuándo usarlo en fisio | Dolor, discapacidad y limitación de actividad causados por problemas del pie (fascitis plantar, metatarsalgia, pie reumático). |
| Nº ítems · tiempo | 23 ítems (versión original) · 5–10 min |
| Rango · qué es mejor | 0–100 por subescala y total · menos es mejor |
| Puntuación | Cada ítem se responde en una escala de 0 a 10 (0 = sin dolor / sin dificultad / nunca; 10 = el peor dolor imaginable / tan difícil que necesita ayuda / siempre). Si un ítem no aplica, se deja sin marcar y se excluye. Subescala = (suma de los ítems respondidos / (n.º de ítems respondidos × 10)) × 100. Total = media de las tres subescalas. Hay que guardar las subescalas por separado. |
| Interpretación | Sin MCID verificado con la herramienta. |
| Licencia | **Comprobar con el titular** (Elly Budiman-Mak). El FFI original de 1991 se publicó abierto en el artículo; la versión revisada FFI-R (68 ítems y forma corta de 34) tiene copyright de la autora. No se incluye el FFI-R. |

**Referencias**
1. Original: Budiman-Mak E, Conrad KJ, Roach KE. The Foot Function Index: a measure of foot pain and disability. J Clin Epidemiol. 1991;44(6):561-70. PMID: 2037861. DOI: 10.1016/0895-4356(91)90220-4
2. Validación española: Paez-Moguer J, Budiman-Mak E, Cuesta-Vargas AI. Cross-cultural adaptation and validation of the Foot Function Index to Spanish. Foot Ankle Surg. 2014;20(1):34-9. PMID: 24480497. DOI: 10.1016/j.fas.2013.09.005 (España)
3. FFI-R (solo referencia): Budiman-Mak E, Conrad K, Stuck R, Matters M. Theoretical model and Rasch analysis to develop a revised Foot Function Index. Foot Ankle Int. 2006;27(7):519-27. PMID: 16842719. DOI: 10.1177/107110070602700707

**Instrucciones al paciente:** «Puntúe de 0 a 10 cada pregunta pensando en cómo ha estado su pie la última semana. Si una pregunta no se le aplica (por ejemplo, no usa plantillas), déjela en blanco.»

**Ítems** (escala 0–10 en todos; ⚠ cotejar la redacción con la versión española FFI-Sp, ref. 2)
Dolor (9) — «¿Cuánto dolor tiene en el pie…?» (0 = ninguno; 10 = el peor imaginable)
1. En su peor momento
2. Al dar los primeros pasos por la mañana
3. Al caminar descalzo
4. Al estar de pie descalzo
5. Al caminar con calzado
6. Al estar de pie con calzado
7. Al caminar con plantillas
8. Al estar de pie con plantillas
9. Al final del día

Discapacidad (9) — «¿Cuánta dificultad tiene para…?» (0 = ninguna; 10 = tanta que no puede hacerlo sin ayuda)
10. Caminar por casa
11. Caminar fuera de casa
12. Caminar 4 manzanas
13. Subir escaleras
14. Bajar escaleras
15. Ponerse de puntillas
16. Levantarse de una silla
17. Subir bordillos
18. Caminar deprisa

Limitación de actividad (5) — «Por culpa del pie, ¿con qué frecuencia…?» (0 = nunca; 10 = siempre)
19. Usa algún apoyo (bastón, andador, muletas) dentro de casa
20. Usa algún apoyo fuera de casa
21. Se queda en casa todo el día
22. Se queda en la cama todo el día
23. Limita sus actividades

---

### ALR-RSI — Escala de vuelta al deporte tras reconstrucción ligamentosa de tobillo (Ankle Ligament Reconstruction–Return to Sport after Injury)
| Campo | Valor |
|---|---|
| id propuesto | `alr_rsi` |
| Grupo en la app | `regions: ["tobillo_pie"]` |
| Qué mide / cuándo usarlo en fisio | Preparación psicológica (emociones, confianza en el rendimiento, valoración del riesgo) para volver al deporte tras una cirugía ligamentosa del tobillo o, por extensión, una inestabilidad lateral. |
| Nº ítems · tiempo | 12 ítems · 3–5 min |
| Rango · qué es mejor | 0–100 · más es mejor (más preparado) |
| Puntuación | Igual que el ACL-RSI de la app: cada ítem de 0 a 100 en saltos de 10 (o de 0 a 10 × 10). Total = media de los ítems respondidos. Los ítems redactados en negativo se presentan con el ancla «extremadamente» a la izquierda (0), igual que en el ACL-RSI. |
| Interpretación | En la validación original, media de 61,9 en quienes volvieron al deporte frente a 43,4 en quienes no lo hicieron (Pioger et al. 2022, ref. 2). Sin punto de corte ni MCID verificados. |
| Licencia | **Comprobar con el titular**: es una adaptación directa del ACL-RSI (Webster KE, La Trobe University), así que conviene aplicar el mismo criterio que con el ACL-RSI de la app y confirmarlo con los autores (Sigonney F, Hardy A). |

**Referencias**
1. Original: Sigonney F, Lopes R, Bouché PA, Kierszbaum E, Moslemi A, Anract P, et al. The ankle ligament reconstruction-return to sport after injury (ALR-RSI) is a valid and reproducible scale to quantify psychological readiness before returning to sport after ankle ligament reconstruction. Knee Surg Sports Traumatol Arthrosc. 2020;28(12):4003-10. PMID: 32356045. DOI: 10.1007/s00167-020-06020-6
2. Validación tras Broström-Gould: Pioger C, Guillo S, Bouché PA, Sigonney F, Elkaïm M, Bauer T, et al. The ALR-RSI score is a valid and reproducible scale to assess psychological readiness before returning to sport after modified Broström-Gould procedure. Knee Surg Sports Traumatol Arthrosc. 2022;30(7):2470-5. PMID: 35079843. DOI: 10.1007/s00167-022-06895-7
3. Validación española: Pérez-de la Cruz S. Validation and application of a Spanish version of the ALR-RSI scale (Ankle Ligament Reconstruction-Return to Sport after Injury) in an active non-athlete population. J Pers Med. 2023;13(4):606. PMID: 37108992. DOI: 10.3390/jpm13040606 (España)

**Instrucciones al paciente:** las del ACL-RSI de la app, cambiando «rodilla» por «tobillo».

**Ítems:** reutilizar los 12 ítems del ACL-RSI de la app cambiando «rodilla» por «tobillo» (es justo lo que hicieron los autores, ref. 2) y cotejarlos con la versión española (ref. 3). No se reescriben aquí.

---

### I-PRRS — Escala de preparación psicológica para volver al deporte tras una lesión (Injury-Psychological Readiness to Return to Sport)
| Campo | Valor |
|---|---|
| id propuesto | `iprrs` |
| Grupo en la app | `topic: "Vuelta al deporte"` |
| Qué mide / cuándo usarlo en fisio | Confianza del deportista lesionado para volver a entrenar y competir, sea cual sea la lesión. Se pasa antes de volver a entrenar y antes de volver a competir. |
| Nº ítems · tiempo | 6 ítems · 1–2 min |
| Rango · qué es mejor | 0–60 · más es mejor (más confianza) |
| Puntuación | Cada ítem de 0 a 100 en saltos de 10. Total = suma de los 6 ítems / 10 (rango 0–60). Sin prorrateo: si falta un ítem, total no calculable. |
| Interpretación | Sin puntos de corte ni MCID verificados con la herramienta. |
| Licencia | **Libre**: publicada en abierto en J Athl Train. Comprobar con la autora (Glazer DD) solo si hay uso comercial. |

**Referencias**
1. Original: Glazer DD. Development and preliminary validation of the Injury-Psychological Readiness to Return to Sport (I-PRRS) scale. J Athl Train. 2009;44(2):185-9. PMID: 19295964. DOI: 10.4085/1062-6050-44.2.185
2. Validación española: no encontrada en PubMed.

**Instrucciones al paciente:** «Puntúe su confianza de 0 a 100 en cada frase (en saltos de 10): 0 = ninguna confianza; 50 = confianza moderada; 100 = confianza total.»

**Ítems** (opciones: 0, 10, 20, …, 100)
1. Mi confianza general para jugar/competir es…
2. Mi confianza para jugar sin dolor es…
3. Mi confianza para darlo todo (100 % de esfuerzo) es…
4. Mi confianza para no estar pendiente de la lesión es…
5. Mi confianza en que la parte lesionada aguante lo que exige el deporte es…
6. Mi confianza en mi nivel técnico y mi capacidad es…

---

### OSTRC-H2 / OSTRC-O2 — Cuestionarios del Oslo Sports Trauma Research Center sobre problemas de salud y lesiones por sobrecarga (2.ª versión)
| Campo | Valor |
|---|---|
| id propuesto | `ostrc_h2` (problemas de salud: lesiones y enfermedades) y `ostrc_o2` (lesiones por sobrecarga de una zona concreta) |
| Grupo en la app | `topic: "Vuelta al deporte"` |
| Qué mide / cuándo usarlo en fisio | Registro semanal de lesiones y enfermedades en deportistas: participación, cantidad de entrenamiento, rendimiento y síntomas. El H2 recoge cualquier problema de salud; el O2 se pasa por zona (rodilla, hombro, lumbar…). Para seguir a un equipo o a un deportista a lo largo de la temporada. |
| Nº ítems · tiempo | 4 preguntas clave (+ preguntas de seguimiento en el H2 si hay problema) · 1–2 min por semana |
| Rango · qué es mejor | Gravedad 0–100 · menos es mejor |
| Puntuación | Gravedad = suma de los puntos de las 4 preguntas (máx. 100). Si en la P1 marca «participación completa sin problemas», el resto se rellena automáticamente con 0 (lógica del cuestionario v2). **Problema importante** («substantial»): en la P2 o la P3, respuesta «en moderada medida», «en gran medida» o «no puedo participar». En el H2, si hay problema: preguntar si es lesión o enfermedad, la zona o los síntomas y los días sin poder entrenar; cada problema se registra por separado con su propia puntuación. |
| Interpretación | Sin MCID. Se informa la prevalencia semanal de problemas totales e importantes. |
| Licencia | **Libre**: publicado en abierto por el OSTRC. |

**Referencias**
1. Original (OSTRC-O): Clarsen B, Myklebust G, Bahr R. Development and validation of a new method for the registration of overuse injuries in sports injury epidemiology: the Oslo Sports Trauma Research Centre (OSTRC) overuse injury questionnaire. Br J Sports Med. 2013;47(8):495-502. PMID: 23038786. DOI: 10.1136/bjsports-2012-091524
2. Versión 2 (H2/O2): Clarsen B, Bahr R, Myklebust G, Andersson SH, Docking SI, Drew M, et al. Improved reporting of overuse injuries and health problems in sport: an update of the Oslo Sport Trauma Research Center questionnaires. Br J Sports Med. 2020;54(7):390-6. PMID: 32060142. DOI: 10.1136/bjsports-2019-101337
3. Validación española: Bailón-Cerezo J, Clarsen B, Sánchez-Sánchez B, Torres-Lacomba M. Cross-cultural adaptation and validation of the Oslo Sports Trauma Research Center questionnaires on overuse injury and health problems (2nd version) in Spanish youth sports. Orthop J Sports Med. 2020;8(12):2325967120968552. PMID: 33354583. DOI: 10.1177/2325967120968552 (España; deportistas de 12 a 17 años)
4. Otra validación española (OSTRC-O, primera versión, balonmano): Martínez-Cal J, Molina-Torres G, Carrasco-Vega E, Barni L, Ventura-Miranda MI, Gonzalez-Sanchez M. Spanish cross-cultural adaptation and validation of the Oslo Sports Trauma Research Centre (OSTRC) Overuse Injury Questionnaire in handball players. Healthcare (Basel). 2023;11(6):912. PMID: 36981569. DOI: 10.3390/healthcare11060912

**Instrucciones al paciente:** «Responda pensando en los últimos 7 días, aunque no haya tenido ningún problema.» (En el O2, cambiar «lesión, enfermedad u otros problemas de salud» por «problemas en [zona]».)

**Ítems** (redacción del H2; ⚠ cotejar con la versión española de Bailón-Cerezo et al.)
1. ¿Ha tenido dificultades para participar con normalidad en los entrenamientos y la competición por una lesión, una enfermedad u otro problema de salud en la última semana? — opciones: 0 = participación completa sin problemas de salud; 8 = participación completa, pero con lesión o enfermedad; 17 = participación reducida por lesión o enfermedad; 25 = no he podido participar por lesión o enfermedad.
2. ¿En qué medida ha reducido el volumen de entrenamiento por una lesión, una enfermedad u otro problema de salud en la última semana? — opciones: 0 = nada; 6 = en poca medida; 13 = en moderada medida; 19 = en gran medida; 25 = no he podido participar.
3. ¿En qué medida ha afectado una lesión, una enfermedad u otro problema de salud a su rendimiento en la última semana? — opciones: 0 = nada; 6 = en poca medida; 13 = en moderada medida; 19 = en gran medida; 25 = no he podido participar.
4. ¿En qué medida ha tenido síntomas o molestias de salud en la última semana? (En el O2: «¿Cuánto dolor ha tenido en [zona]…?») — opciones: 0 = ninguno; 8 = leves; 17 = moderados; 25 = intensos.

---

### OKS — Oxford Knee Score (Puntuación de rodilla de Oxford)
| Campo | Valor |
|---|---|
| id propuesto | `oks` |
| Grupo en la app | `regions: ["rodilla"]` |
| Qué mide / cuándo usarlo en fisio | Dolor y función en la artrosis de rodilla y en la prótesis total de rodilla. |
| Nº ítems · tiempo | 12 ítems · 3–5 min |
| Rango · qué es mejor | 0–48 · más es mejor (sistema actual de puntuación) |
| Puntuación | 12 ítems de 5 opciones con valores de 0 a 4 (4 = mejor). Total = suma (0–48). Detalle de los ítems en blanco: según el manual del titular. |
| Interpretación | Versión española: MCID 6,1 puntos y cambio mínimo detectable 4,4 (Martín-Fernández et al. 2017, ref. 2). |
| Licencia | **Licencia**: Oxford University Innovation (Isis Innovation). Para uso comercial (software incluido) hay que pedir licencia de pago; para uso clínico sin ánimo de lucro, la licencia es gratuita pero también hay que registrarse. Contacto: Oxford University Innovation, Clinical Outcomes. |

**Referencias**
1. Original: Dawson J, Fitzpatrick R, Murray D, Carr A. Questionnaire on the perceptions of patients about total knee replacement. J Bone Joint Surg Br. 1998;80(1):63-9. PMID: 9460955. DOI: 10.1302/0301-620x.80b1.7859
2. Validación española: Martín-Fernández J, García-Maroto R, Sánchez-Jiménez FJ, Bau-González A, Valencia-García H, Gutiérrez-Teira B, et al. Validation of the Spanish version of the Oxford knee score and assessment of its utility to characterize quality of life of patients suffering from knee osteoarthritis: a multicentric study. Health Qual Life Outcomes. 2017;15(1):186. PMID: 28962613. DOI: 10.1186/s12955-017-0761-2 (España)

**Instrucciones al paciente:** no incluidas (licencia).

**Ítems:** no incluidos (licencia). Estructura: 12 preguntas sobre las últimas 4 semanas (dolor, cojera, arrodillarse, escaleras, levantarse, caminar, aseo, transporte, compras, tareas de casa, fallos de la rodilla, dolor nocturno), con 5 opciones cada una.

---

### OHS — Oxford Hip Score (Puntuación de cadera de Oxford)
| Campo | Valor |
|---|---|
| id propuesto | `ohs` |
| Grupo en la app | `regions: ["cadera"]` |
| Qué mide / cuándo usarlo en fisio | Dolor y función en la artrosis de cadera y en la prótesis total de cadera. |
| Nº ítems · tiempo | 12 ítems · 3–5 min |
| Rango · qué es mejor | 0–48 · más es mejor (sistema actual) |
| Puntuación | 12 ítems de 0 a 4 (4 = mejor); total = suma (0–48). Ítems en blanco: según el manual del titular. |
| Interpretación | Versión española: MCID 7,0 puntos y cambio mínimo detectable 5,5 (Martín-Fernández et al. 2017, ref. 2). |
| Licencia | **Licencia**: Oxford University Innovation (las mismas condiciones que el OKS). |

**Referencias**
1. Original: Dawson J, Fitzpatrick R, Carr A, Murray D. Questionnaire on the perceptions of patients about total hip replacement. J Bone Joint Surg Br. 1996;78(2):185-90. PMID: 8666621. DOI: no disponible en PubMed.
2. Validación española: Martín-Fernández J, Gray-Laymón P, Molina-Siguero A, Martínez-Martín J, García-Maroto R, García-Sánchez I, et al. Cross-cultural adaptation and validation of the Spanish version of the Oxford Hip Score in patients with hip osteoarthritis. BMC Musculoskelet Disord. 2017;18(1):205. PMID: 28532445. DOI: 10.1186/s12891-017-1568-3 (España)

**Instrucciones al paciente:** no incluidas (licencia).

**Ítems:** no incluidos (licencia). Estructura: 12 preguntas sobre las últimas 4 semanas, con 5 opciones cada una.

---

### WOMAC — Índice de artrosis de las universidades Western Ontario y McMaster
| Campo | Valor |
|---|---|
| id propuesto | `womac` |
| Grupo en la app | `regions: ["cadera", "rodilla"]` |
| Qué mide / cuándo usarlo en fisio | Dolor, rigidez y función física en la artrosis de cadera o rodilla. Referencia clásica en ensayos clínicos de artrosis. |
| Nº ítems · tiempo | 24 ítems (dolor 5, rigidez 2, función física 17) · 5–10 min |
| Rango · qué es mejor | Versión Likert LK3.1: dolor 0–20, rigidez 0–8, función 0–68, total 0–96 · menos es mejor |
| Puntuación | Likert de 5 opciones (0 = ninguno … 4 = extremo); subescalas = suma; total = suma de las tres (o normalizado a 0–100 según el manual). También hay versiones con EVA y escala numérica. Reglas de ítems en blanco: según el manual del titular. |
| Interpretación | Sin MCID verificado con la herramienta. |
| Licencia | **Licencia**: titular Nicholas Bellamy (WOMAC®, gestionado a través de womac.com). Hace falta un acuerdo de licencia, de pago para uso comercial. |

**Referencias**
1. Original: Bellamy N, Buchanan WW, Goldsmith CH, Campbell J, Stitt LW. Validation study of WOMAC: a health status instrument for measuring clinically important patient relevant outcomes to antirheumatic drug therapy in patients with osteoarthritis of the hip or knee. J Rheumatol. 1988;15(12):1833-40. PMID: 3068365. DOI: no disponible en PubMed.
2. Validación española: Escobar A, Quintana JM, Bilbao A, Azkárate J, Güenaga JI. Validation of the Spanish version of the WOMAC questionnaire for patients with hip or knee osteoarthritis. Clin Rheumatol. 2002;21(6):466-71. PMID: 12447629. DOI: 10.1007/s100670200117 (España)
3. Forma corta española (opcional): Bilbao A, Quintana JM, Escobar A, Las Hayas C, Orive M. Validation of a proposed WOMAC short form for patients with hip osteoarthritis. Health Qual Life Outcomes. 2011;9:75. PMID: 21936886. DOI: 10.1186/1477-7525-9-75

**Instrucciones al paciente:** no incluidas (licencia).

**Ítems:** no incluidos (licencia).

---
## Dolor, factores psicosociales, sueño y adherencia

Notas generales del bloque:
- Todas las fichas van con `topic` (no con `regions`). Temas usados: `"dolor"`, `"psicosocial"`, `"sueno"`, `"adherencia"`.
- Referencias comprobadas con PubMed (PMID y DOI copiados del resultado de la herramienta). OpenAlex no respondió en esta sesión (error de proxy), así que lo que no está en PubMed va marcado «⚠ sin verificar».
- Las cifras de corte que solo aparecen en el texto completo o en manuales (no en el resumen de PubMed) van marcadas «⚠».

---

### DN4 — Cuestionario de dolor neuropático en 4 preguntas (Douleur Neuropathique 4)
| Campo | Valor |
|---|---|
| id propuesto | `dn4` |
| Grupo en la app | `topic: "Tipo e impacto del dolor"` |
| Qué mide / cuándo usarlo en fisio | Cribado de dolor de características neuropáticas (radiculopatía, neuropatía periférica, dolor postquirúrgico persistente). Las 7 primeras preguntas son entrevista; las 3 últimas exigen exploración del fisioterapeuta, así que **no es autoadministrado completo**: la app debe mostrar los ítems 8-10 solo al clínico. |
| Nº ítems · tiempo | 10 ítems (7 de entrevista + 3 de exploración) · ~5 min |
| Rango · qué es mejor | 0–10 · «menos es mejor» (menos rasgos neuropáticos) |
| Puntuación | Cada «Sí» = 1, «No» = 0. Total = suma de los 10 ítems. No se calcula si falta algún ítem (es una herramienta de cribado con punto de corte; no se imputan blancos). Sin subescalas. |
| Interpretación | Total **≥ 4** = cribado positivo de dolor neuropático (punto de corte de la validación española, Pérez 2007, ref. 2, que es también el del original). |
| Licencia | **Comprobar con el titular**. Copyright de D. Bouhassira / grupo francés de dolor neuropático; el instrumento se distribuye a través de Mapi Research Trust (ePROVIDE), que suele exigir licencia para uso comercial. Confirmar antes de publicar los ítems en una app comercial. |

**Referencias**
1. Original: Bouhassira D, Attal N, Alchaar H, Boureau F, Brochet B, Bruxelle J, et al. Comparison of pain syndromes associated with nervous or somatic lesions and development of a new neuropathic pain diagnostic questionnaire (DN4). Pain. 2005;114(1-2):29-36. PMID: 15733628. DOI: 10.1016/j.pain.2004.12.010
2. Validación española: Perez C, Galvez R, Huelbes S, Insausti J, Bouhassira D, Diaz S, et al. Validity and reliability of the Spanish version of the DN4 (Douleur Neuropathique 4 questions) questionnaire for differential diagnosis of pain syndromes associated to a neuropathic or somatic component. Health Qual Life Outcomes. 2007;5:66. PMID: 18053212. DOI: 10.1186/1477-7525-5-66

**Instrucciones al paciente:** «Responda a las preguntas siguientes marcando “Sí” o “No” en cada característica. Piense en el dolor por el que consulta.»

**Ítems** (opciones para todos: 1 = Sí; 0 = No)

*Entrevista — Pregunta 1: ¿Tiene su dolor alguna de las siguientes características?*
1. Quemazón
2. Sensación de frío doloroso
3. Descargas eléctricas

*Entrevista — Pregunta 2: ¿Se asocia el dolor con alguno de los siguientes síntomas en la misma zona?*
4. Hormigueo
5. Sensación de alfileres y agujas (pinchazos)
6. Entumecimiento
7. Picazón (escozor)

*Exploración (la rellena el fisioterapeuta) — Pregunta 3: ¿Está el dolor localizado en una zona donde la exploración física muestra alguna de las siguientes características?*
8. Hipoestesia al tacto
9. Hipoestesia al pinchazo

*Exploración (la rellena el fisioterapeuta) — Pregunta 4: En la zona dolorosa, ¿el dolor puede ser provocado o aumentado por…?*
10. El roce (cepillado suave)

---

### S-LANSS — Escala autoadministrada de Leeds para síntomas y signos neuropáticos
| Campo | Valor |
|---|---|
| id propuesto | `s_lanss` |
| Grupo en la app | `topic: "Tipo e impacto del dolor"` |
| Qué mide / cuándo usarlo en fisio | Identifica dolor de origen predominantemente neuropático sin necesidad de exploración clínica (incluye dos autoexploraciones sencillas). Útil antes de la consulta o a distancia. |
| Nº ítems · tiempo | 7 ítems puntuables (5 de síntomas + 2 de autoexploración) · ~5 min. El original incluye además un dibujo para marcar la zona dolorosa y una escala 0-10 de intensidad de la última semana, que **no** suman. |
| Rango · qué es mejor | 0–24 · «menos es mejor» |
| Puntuación | Cada ítem tiene dos opciones; «No / sin diferencia» = 0 y «Sí / diferente» puntúa con un peso distinto por ítem: ítems 1, 2 y 6 = 5; ítems 3 y 7 = 3; ítem 4 = 2; ítem 5 = 1. Total = suma. No se calcula si falta algún ítem. |
| Interpretación | Total **≥ 12** = probable dolor de origen neuropático (punto de corte óptimo de la validación española: sensibilidad 88,7 %, especificidad 76,6 %; ref. 2). |
| Licencia | **Comprobar con el titular**. Autor: M. I. Bennett (Universidad de Leeds); publicado en *J Pain* (Elsevier). Se usa de forma libre en clínica e investigación, pero no consta una licencia explícita de uso comercial. |

**Referencias**
1. Original: Bennett MI, Smith BH, Torrance N, Potter J. The S-LANSS score for identifying pain of predominantly neuropathic origin: validation for use in clinical and postal research. J Pain. 2005;6(3):149-58. PMID: 15772908. DOI: 10.1016/j.jpain.2004.11.007
2. Validación española: López-de-Uralde-Villanueva I, Gil-Martínez A, Candelas-Fernández P, de Andrés-Ares J, Beltrán-Alacreu H, La Touche R. Validity and reliability of the Spanish-language version of the self-administered Leeds Assessment of Neuropathic Symptoms and Signs (S-LANSS) pain scale. Neurologia (Engl Ed). 2016;33(8):505-14. PMID: 27939112. DOI: 10.1016/j.nrl.2016.10.009

**Instrucciones al paciente:** «Este cuestionario nos ayuda a saber qué tipo de dolor tiene. Piense en cómo ha sentido el dolor durante la última semana. Marque la respuesta que mejor describa su dolor. En las preguntas 6 y 7 se le pide que se toque suavemente la piel.»

**Ítems**
1. En la zona donde tiene dolor, ¿nota también sensación de alfileres y agujas, hormigueo o pinchazos? — opciones: 0 = No; 5 = Sí
2. ¿Cambia de color la zona dolorosa (por ejemplo, se ve más roja o con manchas) cuando el dolor es especialmente fuerte? — opciones: 0 = No; 5 = Sí
3. ¿Hace el dolor que la piel de la zona afectada sea anormalmente sensible al tacto? Por ejemplo, notar sensaciones desagradables o dolor al rozar la piel suavemente. — opciones: 0 = No; 3 = Sí
4. ¿Aparece el dolor de repente y en forma de ráfagas, sin motivo aparente, cuando está completamente quieto? Palabras como «descargas eléctricas», «saltos» o «estallidos» podrían describirlo. — opciones: 0 = No; 2 = Sí
5. En la zona donde tiene dolor, ¿nota la piel anormalmente caliente, como un dolor que quema? — opciones: 0 = No; 1 = Sí
6. Frote suavemente la zona dolorosa con el dedo índice y después frote una zona sin dolor (por ejemplo, una zona de piel más alejada o del lado contrario). ¿Cómo nota este roce en la zona dolorosa? — opciones: 0 = La zona dolorosa no se nota diferente de la zona sin dolor; 5 = Noto molestias en la zona dolorosa, como alfileres y agujas, hormigueo o quemazón, distintas de la zona sin dolor
7. Presione suavemente la zona dolorosa con la yema del dedo y después presione de la misma manera una zona sin dolor (la misma que eligió en la pregunta anterior). ¿Cómo nota esto en la zona dolorosa? — opciones: 0 = La zona dolorosa no se nota diferente de la zona sin dolor; 3 = Noto adormecimiento o sensibilidad dolorosa en la zona dolorosa, distinta de la zona sin dolor

---

### painDETECT — Cuestionario painDETECT
| Campo | Valor |
|---|---|
| id propuesto | `paindetect` |
| Grupo en la app | `topic: "Tipo e impacto del dolor"` |
| Qué mide / cuándo usarlo en fisio | Cribado autoadministrado de componente neuropático, desarrollado en dolor lumbar crónico. Útil en lumbalgia/cervicalgia con irradiación. |
| Nº ítems · tiempo | 3 escalas de intensidad 0-10 (no puntúan) + 1 ítem gráfico de patrón temporal + 1 ítem de irradiación + 7 ítems de síntomas · ~5 min |
| Rango · qué es mejor | −1 a 38 · «menos es mejor» |
| Puntuación | Estructura (sin texto): 7 ítems de síntomas tipo Likert de 6 niveles, puntuados 0–5 (de «nunca» a «muy intensamente»); ítem de patrón temporal con 4 dibujos puntuados −1, 0, +1 o +1; ítem de irradiación del dolor (sí = +2, no = 0). Total = suma de las tres partes. Las tres escalas de intensidad (ahora, peor y media de las últimas 4 semanas) son informativas y no suman. |
| Interpretación | ≤ 12 = componente neuropático improbable; 13–18 = resultado dudoso; **≥ 19** = componente neuropático probable. Validación española: con ≥ 19, sensibilidad 75 % y especificidad 84 %; con ≤ 12, sensibilidad 93 % y especificidad 68 % (ref. 2). |
| Licencia | **Licencia**. Copyright de Pfizer Pharma GmbH; se distribuye a través de Mapi Research Trust (ePROVIDE, eprovide.mapi-trust.org). Hay que pedir allí la versión española y las condiciones de uso comercial. **No se incluyen ítems.** |

**Referencias**
1. Original: Freynhagen R, Baron R, Gockel U, Tölle TR. painDETECT: a new screening questionnaire to identify neuropathic components in patients with back pain. Curr Med Res Opin. 2006;22(10):1911-20. PMID: 17022849. DOI: 10.1185/030079906X132488
2. Validación española: De Andrés J, Pérez-Cajaraville J, Lopez-Alarcón MD, López-Millán JM, Margarit C, Rodrigo-Royo MD, et al. Cultural adaptation and validation of the painDETECT scale into Spanish. Clin J Pain. 2012;28(3):243-53. PMID: 21926908. DOI: 10.1097/AJP.0b013e31822bb35b

**Instrucciones al paciente:** usar las de la versión española con licencia.

**Ítems:** no incluidos (instrumento con licencia).

---

### PEG — Escala PEG de dolor, disfrute de la vida y actividad general
| Campo | Valor |
|---|---|
| id propuesto | `peg` |
| Grupo en la app | `topic: "Tipo e impacto del dolor"` |
| Qué mide / cuándo usarlo en fisio | Intensidad media del dolor e interferencia en el disfrute de la vida y en la actividad general. Versión ultracorta derivada del BPI; ideal para seguimiento sesión a sesión del dolor crónico. |
| Nº ítems · tiempo | 3 ítems · < 1 min |
| Rango · qué es mejor | 0–10 · «menos es mejor» |
| Puntuación | Cada ítem de 0 a 10. PEG = media de los 3 ítems (suma / 3), redondeada a 1 decimal. No se calcula si falta algún ítem. Sin subescalas. |
| Interpretación | Sin puntos de corte ni MCID verificados con la herramienta. |
| Licencia | **Libre**. Desarrollada con financiación pública (VA / NIH); de uso libre. |

**Referencias**
1. Original: Krebs EE, Lorenz KA, Bair MJ, Damush TM, Wu J, Sutherland JM, et al. Development and initial validation of the PEG, a three-item scale assessing pain intensity and interference. J Gen Intern Med. 2009;24(6):733-8. PMID: 19418100. DOI: 10.1007/s11606-009-0981-1
2. Validación española: no encontrada en PubMed para España. Validación en español **latinoamericano/EE. UU.** (población hispana, mayoritariamente de origen mexicano): Kapos FP, Hancock C, Guerrero Torres V, Gonzalez Antonio MI, Do A, Jensen MP. Validation of the PEG Scale in Spanish (PEG-S) Among Adults Receiving Care for Pain in US Primary Care. J Pain. 2023;24(11):1897-904. PMID: 37315727. DOI: 10.1016/j.jpain.2023.06.005

**Instrucciones al paciente:** «Responda a cada pregunta marcando el número que mejor describa su caso durante la última semana.»

**Ítems**
1. ¿Qué número describe mejor su dolor, por término medio, durante la última semana? — opciones: 0 = Sin dolor … 10 = El peor dolor que pueda imaginar (valores enteros 0 a 10)
2. ¿Qué número describe mejor cuánto ha interferido el dolor, durante la última semana, en su disfrute de la vida? — opciones: 0 = No interfiere … 10 = Interfiere por completo (valores enteros 0 a 10)
3. ¿Qué número describe mejor cuánto ha interferido el dolor, durante la última semana, en su actividad general? — opciones: 0 = No interfiere … 10 = Interfiere por completo (valores enteros 0 a 10)

---

### BPI-SF — Cuestionario Breve del Dolor, forma corta (Brief Pain Inventory)
| Campo | Valor |
|---|---|
| id propuesto | `bpi_sf` |
| Grupo en la app | `topic: "Tipo e impacto del dolor"` |
| Qué mide / cuándo usarlo en fisio | Intensidad del dolor e interferencia del dolor en la vida diaria. Muy usado en dolor crónico no oncológico y oncológico; recomendado en ensayos de dolor. |
| Nº ítems · tiempo | Forma corta: 4 ítems de intensidad + 7 de interferencia (puntuables), más un dibujo corporal, preguntas sobre tratamiento y % de alivio (no puntuables) · ~5 min |
| Rango · qué es mejor | Dos puntuaciones 0–10 · «menos es mejor» |
| Puntuación | Estructura (sin texto): **Intensidad** = media de 4 ítems 0–10 (dolor máximo, mínimo y medio de las últimas 24 h, y dolor ahora). **Interferencia** = media de 7 ítems 0–10 (actividad general, estado de ánimo, capacidad de caminar, trabajo habitual, relaciones con otras personas, sueño, disfrute de la vida). Regla de respuestas en blanco: seguir la guía de usuario del titular (⚠ sin verificar con la herramienta; se suele exigir al menos 4 de 7 ítems respondidos para la interferencia). |
| Interpretación | Sin puntos de corte ni MCID verificados con la herramienta. La validación española en dolor no oncológico mostró buena sensibilidad al cambio a los 3 meses (ref. 3). |
| Licencia | **Licencia**. Copyright de Charles S. Cleeland; lo gestiona The University of Texas MD Anderson Cancer Center (Department of Symptom Research), que exige solicitud y puede cobrar por uso comercial. **No se incluyen ítems.** |

**Referencias**
1. Original: Cleeland CS, Ryan KM. Pain assessment: global use of the Brief Pain Inventory. Ann Acad Med Singap. 1994;23(2):129-38. PMID: 8080219. DOI: no figura en PubMed
2. Validación española (dolor oncológico): Badia X, Muriel C, Gracia A, Núñez-Olarte JM, Perulero N, Gálvez R, et al. [Validation of the Spanish version of the Brief Pain Inventory in patients with oncological pain]. Med Clin (Barc). 2003;120(2):52-9. PMID: 12570914. DOI: 10.1016/s0025-7753(03)73601-x
3. Validación española de la forma corta (dolor no oncológico): de Andrés Ares J, Cruces Prado LM, Canos Verdecho MA, Penide Villanueva L, Del Valle Hoyos M, Herdman M, et al. Validation of the Short Form of the Brief Pain Inventory (BPI-SF) in Spanish Patients with Non-Cancer-Related Pain. Pain Pract. 2015;15(7):643-53. PMID: 24766769. DOI: 10.1111/papr.12219

**Instrucciones al paciente:** usar las de la versión española con licencia.

**Ítems:** no incluidos (instrumento con licencia).

---

### CPAQ-8 — Cuestionario de Aceptación del Dolor Crónico, versión de 8 ítems
| Campo | Valor |
|---|---|
| id propuesto | `cpaq8` |
| Grupo en la app | `topic: "Dolor, miedo y creencias"` |
| Qué mide / cuándo usarlo en fisio | Aceptación del dolor crónico: seguir haciendo actividades valiosas a pesar del dolor (implicación en actividades) y dejar de luchar por controlarlo (disposición ante el dolor). Útil en abordajes de tipo ACT o de exposición gradual. |
| Nº ítems · tiempo | 8 ítems · ~2 min |
| Rango · qué es mejor | 0–48 · «más es mejor» |
| Puntuación | Estructura: 8 ítems de 0 («nunca es cierto») a 6 («siempre es cierto»). Dos subescalas de 4 ítems: **Implicación en actividades** (0–24, puntuación directa) y **Disposición ante el dolor** (0–24, ítems invertidos: 6 − respuesta). Total = suma de las dos subescalas. Mayor puntuación = mayor aceptación (ref. 1). |
| Interpretación | Sin puntos de corte ni MCID verificados con la herramienta. |
| Licencia | **Comprobar con el titular**. El CPAQ es de L. M. McCracken; la forma de 8 ítems es de Fish et al. (2010). Se usa libremente en clínica e investigación; sin condiciones comerciales confirmadas. |

**Referencias**
1. Original: Fish RA, McGuire B, Hogan M, Morrison TG, Stewart I. Validation of the chronic pain acceptance questionnaire (CPAQ) in an Internet sample and development and preliminary validation of the CPAQ-8. Pain. 2010;149(3):435-43. PMID: 20188472. DOI: 10.1016/j.pain.2009.12.016
2. Validación española: no encontrada en PubMed para el CPAQ-8. Sí existe para el CPAQ completo: Rodero B, García-Campayo J, Casanueva B, del Hoyo YL, Serrano-Blanco A, Luciano JV. Validation of the Spanish version of the Chronic Pain Acceptance Questionnaire (CPAQ) for the assessment of acceptance in fibromyalgia. Health Qual Life Outcomes. 2010;8:37. PMID: 20385016. DOI: 10.1186/1477-7525-8-37
3. (Opcional) Validación del CPAQ-8 en clínica del dolor: Baranoff J, Hanrahan SJ, Kapur D, Connor JP. Validation of the Chronic Pain Acceptance Questionnaire-8 in an Australian pain clinic sample. Int J Behav Med. 2014;21(1):177-85. PMID: 23179676. DOI: 10.1007/s12529-012-9278-6

**Instrucciones al paciente:** «A continuación encontrará una lista de afirmaciones. Indique con qué frecuencia es cierta cada una para usted, de 0 (nunca es cierto) a 6 (siempre es cierto).»

**Ítems:** no incluidos. No se pudo comprobar el texto original de cuáles 8 ítems del CPAQ forman la versión corta; tomarlos de Fish 2010 (ref. 1) y de la versión española del CPAQ de Rodero 2010 (ref. 2), indicando qué ítems van invertidos.

---

### Brief IPQ — Cuestionario Breve de Percepción de la Enfermedad
| Campo | Valor |
|---|---|
| id propuesto | `bipq` |
| Grupo en la app | `topic: "Dolor, miedo y creencias"` |
| Qué mide / cuándo usarlo en fisio | Representación cognitiva y emocional que tiene el paciente de su problema (consecuencias, duración, control, eficacia del tratamiento, síntomas, preocupación, comprensión, impacto emocional, causas). Útil para orientar la educación en dolor y detectar creencias amenazantes. |
| Nº ítems · tiempo | 9 ítems (8 de 0 a 10 + 1 abierto de causas) · ~3 min |
| Rango · qué es mejor | 0–80 · «menos es mejor» (menos amenaza percibida) |
| Puntuación | Ítems 1–8 de 0 a 10. Los ítems 3, 4 y 7 se invierten (10 − respuesta). Total = ítems 1 + 2 + 5 + 6 + 8 + (10 − 3) + (10 − 4) + (10 − 7). Mayor total = visión más amenazante de la enfermedad. Lo habitual es analizar también cada ítem por separado. El ítem 9 (causas) es texto libre y no puntúa. Si falta algún ítem del 1 al 8, mostrar los ítems sueltos y no calcular el total. |
| Interpretación | Sin puntos de corte ni MCID verificados con la herramienta (los autores no proponen cortes). |
| Licencia | **Libre con permiso o registro**. Uso libre no comercial según los autores (E. Broadbent, Universidad de Auckland; web del grupo IPQ); para uso comercial, comprobar con los autores. |

**Referencias**
1. Original: Broadbent E, Petrie KJ, Main J, Weinman J. The brief illness perception questionnaire. J Psychosom Res. 2006;60(6):631-7. PMID: 16731240. DOI: 10.1016/j.jpsychores.2005.10.020
2. Validación española (validación lingüística, España): Pacheco-Huergo V, Viladrich C, Pujol-Ribera E, Cabezas-Peña C, Núñez M, Roura-Olmeda P, et al. [Perception in chronic illnesses: linguistic validation of the revised Illness Perception Questionnaire and the Brief Illness Perception Questionnaire for a Spanish population]. Aten Primaria. 2011;44(5):280-7. PMID: 21955598. DOI: 10.1016/j.aprim.2010.11.022

**Instrucciones al paciente:** «Para cada pregunta, marque el número que mejor refleje su opinión sobre su problema de salud (su dolor o lesión).»

**Ítems** (ítems 1–8: valores enteros de 0 a 10; se indican los extremos)
1. ¿Cuánto afecta su problema a su vida? — 0 = No afecta nada … 10 = Afecta gravemente a mi vida
2. ¿Cuánto tiempo cree que va a durar su problema? — 0 = Muy poco tiempo … 10 = Para siempre
3. ¿Cuánto control cree que tiene usted sobre su problema? — 0 = Ningún control … 10 = Control total *(invertido)*
4. ¿Hasta qué punto cree que su tratamiento puede ayudar a su problema? — 0 = Nada … 10 = Muchísimo *(invertido)*
5. ¿Cuántos síntomas de su problema nota? — 0 = Ningún síntoma … 10 = Muchos síntomas graves
6. ¿Cuánto le preocupa su problema? — 0 = Nada … 10 = Muchísimo
7. ¿Hasta qué punto cree que entiende su problema? — 0 = No lo entiendo nada … 10 = Lo entiendo muy claramente *(invertido)*
8. ¿Cuánto le afecta emocionalmente su problema? (por ejemplo, ¿le hace sentir enfado, miedo, disgusto o tristeza?) — 0 = No me afecta nada emocionalmente … 10 = Me afecta muchísimo emocionalmente
9. Escriba, por orden de importancia, los tres factores que usted cree que causaron su problema. Las causas más importantes para mí: 1. … 2. … 3. … — texto libre, no puntúa

---

### Back-PAQ-10 — Cuestionario de Actitudes ante el Dolor de Espalda, versión de 10 ítems
| Campo | Valor |
|---|---|
| id propuesto | `back_paq10` |
| Grupo en la app | `topic: "Dolor, miedo y creencias"` (específico de espalda; si la app permite combinar, mostrarlo también en lumbar) |
| Qué mide / cuándo usarlo en fisio | Creencias y actitudes sobre el dolor de espalda: vulnerabilidad de la espalda, relación entre dolor y lesión, participación en actividades con dolor, pronóstico e influencias psicológicas. Útil para detectar creencias poco útiles y medir el efecto de la educación. |
| Nº ítems · tiempo | 10 ítems (5 componentes de 2 ítems) · ~3 min |
| Rango · qué es mejor | Ver hoja de puntuación del autor (rango y sentido según la codificación usada) |
| Puntuación | Estructura: 10 afirmaciones con 5 opciones de respuesta (de «falso» a «verdadero», pasando por «posiblemente falso», «no estoy seguro» y «posiblemente verdadero»). Componentes (2 ítems cada uno): vulnerabilidad de la espalda; relación entre dolor de espalda y lesión; participación en actividades con dolor; pronóstico; influencias psicológicas en la recuperación (ref. 1). El sentido de la codificación (qué opción puntúa alto) **no se pudo comprobar**: tomarlo de la hoja de puntuación de los autores. En la versión sueca, la puntuación se correlaciona positivamente con el BBQ y negativamente con la TSK (ref. 3), lo que indica que en esa codificación más alto = creencias más útiles. |
| Interpretación | Sin puntos de corte verificados. Versión sueca de 10 ítems: error estándar de medida 1,66 y cambio mínimo detectable 4,59 puntos (ref. 3). |
| Licencia | **Comprobar con el titular**. Autor: B. Darlow (Universidad de Otago, Nueva Zelanda). Publicado en acceso abierto en *BMJ Open*; no consta licencia comercial. |

**Referencias**
1. Original: Darlow B, Perry M, Mathieson F, Stanley J, Melloh M, Marsh R, et al. The development and exploratory analysis of the Back Pain Attitudes Questionnaire (Back-PAQ). BMJ Open. 2014;4(5):e005251. PMID: 24860003. DOI: 10.1136/bmjopen-2014-005251
2. Validación española: no encontrada en PubMed para España. Validación en español **argentino** (Latinoamérica): Pierobon A, Policastro PO, Soliño S, Darlow B, Andreu M, Novoa GA, et al. Spanish translation, cross-cultural adaptation and validation of the Argentine version of the Back Pain Attitudes Questionnaire. Musculoskelet Sci Pract. 2020;46:102125. PMID: 32217271. DOI: 10.1016/j.msksp.2020.102125 (el resumen no aclara si se validó también la versión de 10 ítems).
3. (Opcional) Error de medida de la versión de 10 ítems: Numanovic P, Darlow B, Larsson ME. The Swedish version of the back pain attitudes questionnaire - Translation, cross-cultural adaptation and validation. Musculoskelet Sci Pract. 2024;72:102984. PMID: 38851177. DOI: 10.1016/j.msksp.2024.102984

**Instrucciones al paciente:** usar las de la versión publicada (argentina o la del autor).

**Ítems:** no incluidos: no se pudo comprobar el texto original de los 10 ítems.

---

### rNPQ — Cuestionario de Neurofisiología del Dolor, versión revisada
| Campo | Valor |
|---|---|
| id propuesto | `rnpq` |
| Grupo en la app | `topic: "Dolor, miedo y creencias"` |
| Qué mide / cuándo usarlo en fisio | Conocimiento del paciente sobre la biología del dolor. Sirve para valorar el punto de partida y el efecto de la educación en neurociencia del dolor. |
| Nº ítems · tiempo | 12 ítems · ~5 min |
| Rango · qué es mejor | 0–12 · «más es mejor» |
| Puntuación | Cada afirmación se responde «Verdadero», «Falso» o «No estoy seguro». Respuesta correcta = 1; incorrecta o «No estoy seguro» = 0. Total = número de aciertos. La versión revisada surge de quitar 7 ítems problemáticos del NPQ original de 19 ítems tras un análisis Rasch (ref. 1). |
| Interpretación | Sin puntos de corte ni MCID verificados con la herramienta. |
| Licencia | **Comprobar con el titular**. Autores: M. J. Catley, N. E. O'Connell, G. L. Moseley (NPQ original de G. L. Moseley). Uso académico habitual; sin condiciones comerciales confirmadas. |

**Referencias**
1. Original (versión revisada): Catley MJ, O'Connell NE, Moseley GL. How good is the neurophysiology of pain questionnaire? A Rasch analysis of psychometric properties. J Pain. 2013;14(8):818-27. PMID: 23651882. DOI: 10.1016/j.jpain.2013.02.008
2. Validación española: no encontrada en PubMed. Hay versiones validadas en francés, alemán, italiano, neerlandés, danés, finés y turco, pero no en español.

**Instrucciones al paciente:** «Lea cada afirmación y marque si cree que es verdadera o falsa. Si no está seguro, marque “No estoy seguro”.»

**Ítems:** no incluidos: no se pudo comprobar el texto original de los 12 ítems ni la clave de respuestas correctas. Tomarlos de Catley 2013 (ref. 1).

---

### ISI — Índice de Gravedad del Insomnio (Insomnia Severity Index)
| Campo | Valor |
|---|---|
| id propuesto | `isi` |
| Grupo en la app | `topic: "Sueño"` |
| Qué mide / cuándo usarlo en fisio | Gravedad percibida del insomnio y su impacto diurno en las últimas 2 semanas. Útil en dolor crónico, donde el mal sueño es frecuente y empeora el pronóstico. |
| Nº ítems · tiempo | 7 ítems · ~2 min |
| Rango · qué es mejor | 0–28 · «menos es mejor» |
| Puntuación | Estructura: 7 ítems de 0 a 4 (dificultad para conciliar el sueño, para mantenerlo y despertar demasiado pronto; satisfacción con el sueño; cuánto se nota el problema; preocupación; interferencia diurna). Total = suma. |
| Interpretación | 0–7 sin insomnio clínico; 8–14 insomnio subumbral; 15–21 insomnio clínico moderado; 22–28 insomnio clínico grave (Bastien 2001, ref. 1; ⚠ categorías tomadas del texto completo, no comprobadas en el resumen). Población general: corte **≥ 10** para detectar insomnio (sensibilidad 86,1 %, especificidad 87,7 %). Cambio de **−8,4 puntos** asociado a mejoría moderada tras el tratamiento (ref. 3). |
| Licencia | **Licencia**. Copyright de Charles M. Morin (Université Laval); se distribuye a través de Mapi Research Trust (ePROVIDE). Uso comercial con licencia. **No se incluyen ítems.** |

**Referencias**
1. Original: Bastien CH, Vallières A, Morin CM. Validation of the Insomnia Severity Index as an outcome measure for insomnia research. Sleep Med. 2001;2(4):297-307. PMID: 11438246. DOI: 10.1016/s1389-9457(00)00065-4
2. Validación española: Fernandez-Mendoza J, Rodriguez-Muñoz A, Vela-Bueno A, Olavarrieta-Bernardino S, Calhoun SL, Bixler EO, et al. The Spanish version of the Insomnia Severity Index: a confirmatory factor analysis. Sleep Med. 2011;13(2):207-10. PMID: 22172961. DOI: 10.1016/j.sleep.2011.06.019. Otra en mayores, España: Sierra JC, Guillén-Serrano V, Santos-Iglesias P. [Insomnia Severity Index: some indicators about its reliability and validity on an older adults sample]. Rev Neurol. 47(11):566-70. PMID: 19048535. DOI: no figura en PubMed (⚠ año no devuelto por la herramienta)
3. Puntos de corte y cambio mínimo importante: Morin CM, Belleville G, Bélanger L, Ivers H. The Insomnia Severity Index: psychometric indicators to detect insomnia cases and evaluate treatment response. Sleep. 2011;34(5):601-8. PMID: 21532953. DOI: 10.1093/sleep/34.5.601

**Instrucciones al paciente:** usar las de la versión española con licencia.

**Ítems:** no incluidos (instrumento con licencia).

---

### DASS-21 — Escalas de Depresión, Ansiedad y Estrés, 21 ítems
| Campo | Valor |
|---|---|
| id propuesto | `dass21` |
| Grupo en la app | `topic: "Estado de ánimo"` |
| Qué mide / cuándo usarlo en fisio | Malestar emocional en la última semana en tres subescalas: depresión, ansiedad y estrés. Alternativa a PHQ-9 + GAD-7 cuando interesa también el estrés. No sirve para diagnosticar. |
| Nº ítems · tiempo | 21 ítems (7 por subescala) · ~5 min |
| Rango · qué es mejor | Cada subescala 0–42 (tras multiplicar por 2) · «menos es mejor» |
| Puntuación | Cada ítem de 0 a 3. Subescalas: **Depresión** = ítems 3, 5, 10, 13, 16, 17, 21; **Ansiedad** = ítems 2, 4, 7, 9, 15, 19, 20; **Estrés** = ítems 1, 6, 8, 11, 12, 14, 18. Suma de cada subescala (0–21) × 2 = puntuación equivalente al DASS-42 (0–42), que es la que se compara con las categorías. Sin ítems invertidos. Si falta un ítem en una subescala, no calcular esa subescala. |
| Interpretación | Categorías del manual de los autores (Lovibond y Lovibond, 1995; ⚠ sin verificar, manual no indexado), con puntuaciones ya multiplicadas por 2. **Depresión**: normal 0–9, leve 10–13, moderada 14–20, grave 21–27, extremadamente grave ≥ 28. **Ansiedad**: normal 0–7, leve 8–9, moderada 10–14, grave 15–19, extremadamente grave ≥ 20. **Estrés**: normal 0–14, leve 15–18, moderado 19–25, grave 26–33, extremadamente grave ≥ 34. |
| Licencia | **Libre**. Dominio público según los autores (P. F. Lovibond, University of New South Wales); se puede copiar y usar sin permiso. El manual se vende aparte. |

**Referencias**
1. Original: Lovibond PF, Lovibond SH. The structure of negative emotional states: comparison of the Depression Anxiety Stress Scales (DASS) with the Beck Depression and Anxiety Inventories. Behav Res Ther. 1995;33(3):335-43. PMID: 7726811. DOI: 10.1016/0005-7967(94)00075-u
2. Validación española: Bados A, Solanas A, Andrés R. Propiedades psicométricas de la versión española de las Escalas de Depresión, Ansiedad y Estrés (DASS). Psicothema. 2005;17(4):679-83. ⚠ sin verificar (no está en PubMed y OpenAlex no respondió). Evidencia comprobada en muestra española: Soria-Reyes LM, Alarcón R, Cerezo MV, Blanca MJ. Psychometric properties of the Depression Anxiety Stress Scales (DASS-21) in women with breast cancer. Sci Rep. 2024;14(1):20473. PMID: 39227677. DOI: 10.1038/s41598-024-68814-9

**Instrucciones al paciente:** «Lea cada frase y marque el número (0, 1, 2 o 3) que indique cuánto le ha pasado durante la última semana. No hay respuestas buenas ni malas. No dedique demasiado tiempo a cada frase.»

**Ítems** (opciones para todos: 0 = No me ha pasado; 1 = Me ha pasado un poco, o durante parte del tiempo; 2 = Me ha pasado bastante, o durante una buena parte del tiempo; 3 = Me ha pasado mucho, o la mayor parte del tiempo)
1. Me ha costado mucho calmarme. *(E)*
2. Me he dado cuenta de que tenía la boca seca. *(A)*
3. No he podido sentir ninguna emoción positiva. *(D)*
4. He tenido dificultad para respirar (por ejemplo, respiración muy rápida o falta de aire sin haber hecho esfuerzo). *(A)*
5. Me ha costado mucho tomar la iniciativa para hacer cosas. *(D)*
6. He tendido a reaccionar de forma exagerada ante las situaciones. *(E)*
7. He notado temblores (por ejemplo, en las manos). *(A)*
8. He sentido que estaba gastando mucha energía nerviosa. *(E)*
9. Me han preocupado situaciones en las que podría tener pánico y hacer el ridículo. *(A)*
10. He sentido que no tenía nada que esperar del futuro. *(D)*
11. Me he notado agitado. *(E)*
12. Me ha costado relajarme. *(E)*
13. Me he sentido triste y desanimado. *(D)*
14. No he tolerado nada que me impidiera seguir con lo que estaba haciendo. *(E)*
15. He sentido que estaba a punto de tener pánico. *(A)*
16. No he podido entusiasmarme con nada. *(D)*
17. He sentido que valía muy poco como persona. *(D)*
18. He sentido que estaba muy susceptible. *(E)*
19. He notado los latidos de mi corazón sin haber hecho esfuerzo físico (por ejemplo, aumento del ritmo cardiaco o latidos irregulares). *(A)*
20. Me he sentido asustado sin motivo. *(A)*
21. He sentido que la vida no tenía sentido. *(D)*

(D = Depresión, A = Ansiedad, E = Estrés; la letra no se muestra al paciente.)

---

### PSS-10 — Escala de Estrés Percibido, 10 ítems
| Campo | Valor |
|---|---|
| id propuesto | `pss10` |
| Grupo en la app | `topic: "Estado de ánimo"` |
| Qué mide / cuándo usarlo en fisio | Grado en que la persona percibe su vida del último mes como impredecible, incontrolable y sobrecargada. Útil como factor de contexto en dolor persistente y en la vuelta al trabajo. |
| Nº ítems · tiempo | 10 ítems · ~3 min |
| Rango · qué es mejor | 0–40 · «menos es mejor» |
| Puntuación | Cada ítem de 0 a 4. Los ítems 4, 5, 7 y 8 (formulados en positivo) se invierten (4 − respuesta). Total = suma de los 10 ítems. Si falta algún ítem, no calcular el total. |
| Interpretación | Sin puntos de corte clínicos verificados (los autores no los proponen; se compara con normas de población). |
| Licencia | **Libre con permiso o registro**. Uso libre sin permiso para investigación y fines no lucrativos (S. Cohen, Carnegie Mellon University); para uso comercial, comprobar con el titular (también se distribuye a través de Mind Garden). |

**Referencias**
1. Original: Cohen S, Kamarck T, Mermelstein R. A global measure of perceived stress. J Health Soc Behav. 1983;24(4):385-96. PMID: 6668417. DOI: no figura en PubMed
2. Validación española: Remor E. Psychometric properties of a European Spanish version of the Perceived Stress Scale (PSS). Span J Psychol. 2006;9(1):86-93. PMID: 16673626. DOI: 10.1017/s1138741600006004 (incluye la forma de 10 ítems).

**Instrucciones al paciente:** «Las preguntas de esta escala tratan sobre sus sentimientos y pensamientos durante el último mes. En cada pregunta, indique con qué frecuencia se ha sentido o ha pensado de esa manera.»

**Ítems** (opciones para todos: 0 = Nunca; 1 = Casi nunca; 2 = De vez en cuando; 3 = A menudo; 4 = Muy a menudo). Cada ítem empieza por «En el último mes, ¿con qué frecuencia…»
1. …se ha sentido afectado por algo que ha ocurrido inesperadamente?
2. …se ha sentido incapaz de controlar las cosas importantes de su vida?
3. …se ha sentido nervioso o estresado?
4. …se ha sentido seguro de su capacidad para manejar sus problemas personales? *(invertido)*
5. …ha sentido que las cosas le iban bien? *(invertido)*
6. …ha sentido que no podía con todas las cosas que tenía que hacer?
7. …ha podido controlar las cosas que le irritan en su vida? *(invertido)*
8. …ha sentido que lo tenía todo bajo control? *(invertido)*
9. …se ha enfadado por cosas que estaban fuera de su control?
10. …ha sentido que las dificultades se acumulaban tanto que no podía superarlas?

---

### EARS — Escala de Valoración de la Adherencia al Ejercicio (Exercise Adherence Rating Scale)
| Campo | Valor |
|---|---|
| id propuesto | `ears` |
| Grupo en la app | `topic: "Adherencia al ejercicio"` |
| Qué mide / cuándo usarlo en fisio | Adherencia al programa de ejercicio domiciliario pautado. Pasarla en las revisiones (por ejemplo, 2–4 semanas después de pautar los ejercicios). |
| Nº ítems · tiempo | La puntuación usa los 6 ítems de conducta de adherencia (sección B). El cuestionario completo tiene además una sección A descriptiva y una sección C de motivos de adherencia o no adherencia (10 ítems), que no puntúan en la escala de 6 ítems · ~3–4 min (versión mexicana: 219 s de media, ref. 2) |
| Rango · qué es mejor | 0–24 · «más es mejor» |
| Puntuación | Estructura: 6 afirmaciones con 5 opciones de acuerdo (0–4). Unas están redactadas a favor de la adherencia y otras en contra; estas últimas se invierten para que siempre más puntos = más adherencia. Total = suma (0–24). Factor único (ref. 1). |
| Interpretación | Versión brasileña en lumbalgia crónica: **≥ 17/24** = adherencia aceptable asociada a mejoría; cambio mínimo importante de **5,5 puntos** (ref. 3). |
| Licencia | **Comprobar con el titular**. Autora de referencia: E. L. Godfrey (King's College London). Sin condiciones comerciales confirmadas. |

**Referencias**
1. Original: Newman-Beinart NA, Norton S, Dowling D, Gavriloff D, Vari C, Weinman JA, et al. The development and initial psychometric evaluation of a measure assessing adherence to prescribed exercise: the Exercise Adherence Rating Scale (EARS). Physiotherapy. 2017;103(2):180-5. PMID: 27913064. DOI: 10.1016/j.physio.2016.11.001
2. Validación española: no encontrada en PubMed para España. Validación en español **mexicano** (Latinoamérica), en lumbalgia crónica: Pérez-Huerta BD, Díaz-Pulido B, Godínez-Jaimes F, Gómez-Rodríguez R, Godfrey EL, Sánchez-Sánchez B. Cultural adaptation and psychometric validation of the exercise adherence Rating scale Mexican Spanish version (EARS-Mx). Musculoskelet Sci Pract. 2025;77:103308. PMID: 40090120. DOI: 10.1016/j.msksp.2025.103308
3. (Opcional) Punto de corte y cambio mínimo importante: de Lira MR, de Oliveira AS, França RA, Pereira AC, Godfrey EL, Chaves TC. The Brazilian Portuguese version of the Exercise Adherence Rating Scale (EARS-Br) showed acceptable reliability, validity and responsiveness in chronic low back pain. BMC Musculoskelet Disord. 2020;21(1):294. PMID: 32398068. DOI: 10.1186/s12891-020-03308-z

**Instrucciones al paciente:** «Piense en los ejercicios que su fisioterapeuta le ha pautado para hacer en casa. Indique hasta qué punto está de acuerdo con cada frase.»

**Ítems:** no incluidos: no se pudo comprobar con seguridad el texto exacto de los 6 ítems ni cuáles se invierten. Tomarlos de la versión mexicana EARS-Mx (ref. 2) o de la autora.

---

### PHQ-4 — Cuestionario de Salud del Paciente de 4 ítems (cribado rápido de ánimo y ansiedad)
| Campo | Valor |
|---|---|
| id propuesto | `phq4` |
| Grupo en la app | `topic: "Estado de ánimo"` |
| Qué mide / cuándo usarlo en fisio | **Forma corta** que junta el PHQ-2 (los 2 primeros ítems del PHQ-9) y el GAD-2 (los 2 primeros ítems del GAD-7), que la app ya tiene. Sirve de cribado de 1 minuto; si sale positivo, pasar el PHQ-9 o el GAD-7 completo. Conviene reutilizar los textos y opciones de `phq9.ts` y `gad7.ts` para que coincidan. |
| Nº ítems · tiempo | 4 ítems · ~1 min |
| Rango · qué es mejor | 0–12 · «menos es mejor» |
| Puntuación | Cada ítem de 0 a 3. **Ansiedad (GAD-2)** = ítems 1 + 2 (0–6). **Depresión (PHQ-2)** = ítems 3 + 4 (0–6). Total = suma de los 4 ítems (0–12). Sin ítems invertidos. Si falta un ítem, no calcular. |
| Interpretación | Subescala **≥ 3** en GAD-2 o PHQ-2 = cribado positivo de ansiedad o depresión; validado en atención primaria española (sensibilidad 0,88 y 0,90; ref. 2). Total: 0–2 normal, 3–5 leve, 6–8 moderado, 9–12 grave (Kroenke 2009, ref. 1; ⚠ categorías tomadas del texto completo, no comprobadas en el resumen). |
| Licencia | **Libre**. Los cuestionarios PHQ son de Pfizer, que permite reproducirlos, traducirlos y usarlos sin pedir permiso. |

**Referencias**
1. Original: Kroenke K, Spitzer RL, Williams JB, Löwe B. An ultra-brief screening scale for anxiety and depression: the PHQ-4. Psychosomatics. 2009;50(6):613-21. PMID: 19996233. DOI: 10.1176/appi.psy.50.6.613
2. Validación española: Cano-Vindel A, Muñoz-Navarro R, Medrano LA, Ruiz-Rodríguez P, González-Blanch C, Gómez-Castillo MD, et al. A computerized version of the Patient Health Questionnaire-4 as an ultra-brief screening tool to detect emotional disorders in primary care. J Affect Disord. 2018;234:247-55. PMID: 29549826. DOI: 10.1016/j.jad.2018.01.030
3. (Opcional) Normas en población general: Löwe B, Wahl I, Rose M, Spitzer C, Glaesmer H, Wingenfeld K, et al. A 4-item measure of depression and anxiety: validation and standardization of the Patient Health Questionnaire-4 (PHQ-4) in the general population. J Affect Disord. 2009;122(1-2):86-95. PMID: 19616305. DOI: 10.1016/j.jad.2009.06.019

**Instrucciones al paciente:** «Piense en las últimas 2 semanas. En cada pregunta, marque con qué frecuencia le ha pasado. No hay respuestas buenas ni malas; responda a todas.» (igual que en PHQ-9 y GAD-7 de la app)

**Ítems** (encabezado: «Durante las últimas 2 semanas, ¿con qué frecuencia le ha pasado lo siguiente?»; opciones para todos: 0 = Nunca; 1 = Varios días; 2 = Más de la mitad de los días; 3 = Casi todos los días)
1. Sentirse nervioso, ansioso o con los nervios de punta *(GAD-2; = ítem 1 del GAD-7)*
2. No poder dejar de preocuparse o no poder controlar la preocupación *(GAD-2; = ítem 2 del GAD-7)*
3. Tener poco interés en hacer cosas o disfrutar poco haciéndolas *(PHQ-2; = ítem 1 del PHQ-9)*
4. Sentirse decaído, deprimido o sin esperanza *(PHQ-2; = ítem 2 del PHQ-9)*

---
## Equilibrio, vestibular, suelo pélvico, respiratorio, neurológico y salud general

> Temas (`topic`) propuestos en este bloque: `equilibrio_caidas`, `vestibular`, `persona_mayor`, `suelo_pelvico`, `respiratorio`, `neurologico`, `hipermovilidad`, `salud_general`.
>
> Referencias comprobadas con PubMed (PMID y DOI tomados de la herramienta). OpenAlex y la web no estaban accesibles en esta sesión (error de proxy), así que las condiciones de licencia se basan en lo que se sabe de cada titular; donde hay duda se indica «Comprobar con el titular».
>
> Cuando el titular ofrece una traducción oficial al español (FES-I, ICIQ, PROMIS, EQ-5D, CAT), conviene usar ese texto en vez de la traducción de esta ficha.

---

### Short FES-I — Escala Internacional de Eficacia ante las Caídas, versión corta
| Campo | Valor |
|---|---|
| id propuesto | `short_fes_i` |
| Grupo en la app | `topic: "Equilibrio, caídas y mareo"` |
| Qué mide / cuándo usarlo en fisio | Mide la preocupación (miedo) a caerse en 7 actividades cotidianas. Sirve en personas mayores, en la valoración del riesgo de caídas y en programas de equilibrio. |
| Nº ítems · tiempo | 7 ítems · 2-3 min |
| Rango · qué es mejor | 7–28 · «menos es mejor» |
| Puntuación | Suma de los 7 ítems (1-4 cada uno). Si falta 1 ítem: media de los ítems contestados × 7, redondeado. Si faltan 2 o más, el cuestionario no es válido (regla del manual FES-I, ⚠ sin verificar en PubMed). No tiene subescalas. |
| Interpretación | Validación española (González Montaos 2024): un valor > 8 indica miedo moderado o alto. Delbaere 2010 propuso puntos de corte con curvas ROC; los valores que se suelen citar son 7-8 bajo, 9-13 moderado y 14-28 alto (⚠ no figuran en el resumen de PubMed; comprobar en el texto completo). |
| Licencia | **Libre** (uso gratuito citando la fuente). El grupo FES-I (ProFaNE, Univ. de Manchester) publica traducciones oficiales, la española incluida, y pide que se informe del uso. Comprobar en su web si hay que registrarse. |

**Referencias**
1. Original: Kempen GI, Yardley L, van Haastregt JC, Zijlstra GA, Beyer N, Hauer K, et al. The Short FES-I: a shortened version of the falls efficacy scale-international to assess fear of falling. Age Ageing. 2008;37(1):45-50. PMID: 18032400. DOI: 10.1093/ageing/afm157
2. Validación española (España): González Montaos A, Castaño Carou A, López Fernández MD, Barreiro Casal L, Villanueva Otero C, Gayoso Diz P. [Validation of the short FES-I scale in Spanish population over 70 years]. Rev Esp Geriatr Gerontol. 2024;59(1):101436. PMID: 37992483. DOI: 10.1016/j.regg.2023.101436
3. Puntos de corte: Delbaere K, Close JC, Mikolaizak AS, Sachdev PS, Brodaty H, Lord SR. The Falls Efficacy Scale International (FES-I). A comprehensive longitudinal validation study. Age Ageing. 2010;39(2):210-6. PMID: 20061508. DOI: 10.1093/ageing/afp225

**Instrucciones al paciente:** «Nos gustaría hacerle algunas preguntas sobre su preocupación por la posibilidad de caerse. Para cada actividad, conteste pensando en cómo la hace normalmente. Si ahora no hace la actividad (por ejemplo, si otra persona le hace la compra), conteste según lo preocupado/a que cree que estaría por caerse SI la hiciera.»

**Ítems.** Pregunta común: «¿Le preocupa la posibilidad de caerse al…?». Opciones: 1 = Nada preocupado/a; 2 = Algo preocupado/a; 3 = Bastante preocupado/a; 4 = Muy preocupado/a.
1. Vestirse o desvestirse
2. Bañarse o ducharse
3. Sentarse o levantarse de una silla
4. Subir o bajar escaleras
5. Alcanzar algo por encima de la cabeza o del suelo
6. Subir o bajar una cuesta
7. Salir a un acto social (por ejemplo, un oficio religioso, una reunión familiar o una reunión de una asociación)

---

### ABC — Escala de Confianza en el Equilibrio Específica de Actividades (Activities-specific Balance Confidence)
| Campo | Valor |
|---|---|
| id propuesto | `abc` |
| Grupo en la app | `topic: "Equilibrio, caídas y mareo"` |
| Qué mide / cuándo usarlo en fisio | Mide la confianza en no perder el equilibrio en 16 actividades de dificultad creciente. Útil en personas mayores con buena función, en trastornos vestibulares y en neurología. Tiene menos efecto techo que la FES. |
| Nº ítems · tiempo | 16 ítems · 5-10 min |
| Rango · qué es mejor | 0–100 % · «más es mejor» |
| Puntuación | Cada ítem de 0 a 100 en pasos de 10. Total = media de los ítems contestados (suma ÷ nº de ítems contestados). Si se deja un ítem en blanco, se calcula la media con los demás. No tiene subescalas oficiales. |
| Interpretación | Versión española en pacientes vestibulares (Montilla-Ibáñez 2017): SEM 8,64 y cambio mínimo detectable (MDC) 16,94 puntos. Riesgo de caídas: Lajoie y Gallagher 2004 calcularon puntos de corte para separar a quienes se caen de quienes no; el valor que se suele citar (< 67 %) no figura en el resumen (⚠ comprobar en el texto completo). |
| Licencia | **Libre** (publicada por los autores y de uso clínico muy extendido). Para uso comercial, comprobar con los autores (Powell y Myers, Univ. de Waterloo). |

**Referencias**
1. Original: Powell LE, Myers AM. The Activities-specific Balance Confidence (ABC) Scale. J Gerontol A Biol Sci Med Sci. 1995;50A(1):M28-34. PMID: 7814786. DOI: 10.1093/gerona/50a.1.m28
2. Validación española (España): Montilla-Ibáñez A, Martínez-Amat A, Lomas-Vega R, Cruz-Díaz D, Torre-Cruz MJ, Casuso-Pérez R, et al. The Activities-specific Balance Confidence scale: reliability and validity in Spanish patients with vestibular disorders. Disabil Rehabil. 2017;39(7):697-703. PMID: 27008458. DOI: 10.3109/09638288.2016.1161087
3. Puntos de corte: Lajoie Y, Gallagher SP. Predicting falls within the elderly community: comparison of postural sway, reaction time, the Berg balance scale and the Activities-specific Balance Confidence (ABC) scale for comparing fallers and non-fallers. Arch Gerontol Geriatr. 2004;38(1):11-26. PMID: 14599700. DOI: 10.1016/s0167-4943(03)00082-7

**Instrucciones al paciente:** «Para cada una de las siguientes actividades, indique qué confianza tiene en poder hacerla sin perder el equilibrio ni sentirse inestable. Elija un porcentaje de la escala, de 0 % (ninguna confianza) a 100 % (confianza total). Si ahora no hace esa actividad, imagine qué confianza tendría si tuviera que hacerla. Si normalmente usa un bastón u otra ayuda, o se agarra a alguien, puntúe su confianza como si usara esa ayuda.»

**Ítems.** Pregunta común: «¿Qué confianza tiene en que no perderá el equilibrio ni se sentirá inestable cuando…?». Opciones: 0 %, 10 %, 20 %, 30 %, 40 %, 50 %, 60 %, 70 %, 80 %, 90 %, 100 % (0 = ninguna confianza; 100 = confianza total).
1. …camina por casa?
2. …sube o baja escaleras?
3. …se agacha y recoge una zapatilla del suelo del armario?
4. …coge una lata pequeña de una estantería a la altura de los ojos?
5. …se pone de puntillas y coge algo por encima de la cabeza?
6. …se sube a una silla para coger algo?
7. …barre el suelo?
8. …sale de casa y va hasta un coche aparcado en la entrada?
9. …entra o sale de un coche?
10. …cruza un aparcamiento para ir a un centro comercial?
11. …sube o baja una rampa?
12. …camina por un centro comercial lleno de gente que pasa deprisa a su lado?
13. …le empujan sin querer mientras camina por el centro comercial?
14. …sube o baja de una escalera mecánica agarrado/a al pasamanos?
15. …sube o baja de una escalera mecánica con paquetes en las manos, sin poder agarrarse al pasamanos?
16. …camina por la calle sobre aceras heladas?

---

### DHI — Inventario de Discapacidad por Mareo (Dizziness Handicap Inventory)
| Campo | Valor |
|---|---|
| id propuesto | `dhi` |
| Grupo en la app | `topic: "Equilibrio, caídas y mareo"` |
| Qué mide / cuándo usarlo en fisio | Mide cuánto limitan el mareo y la inestabilidad en lo físico, lo funcional y lo emocional. Es el cuestionario de referencia en rehabilitación vestibular (VPPB, hipofunción vestibular, mareo cervicogénico). |
| Nº ítems · tiempo | 25 ítems · 5-10 min |
| Rango · qué es mejor | 0–100 · «menos es mejor» |
| Puntuación | Sí = 4; A veces = 2; No = 0. Total = suma (0-100). Subescalas: **Física (P)**, ítems 1, 4, 8, 11, 13, 17, 25 (0-28); **Emocional (E)**, ítems 2, 9, 10, 15, 18, 20, 21, 22, 23 (0-36); **Funcional (F)**, ítems 3, 5, 6, 7, 12, 14, 16, 19, 24 (0-36). No hay regla publicada para los ítems en blanco: recomendación de la app, pedir que se conteste todo; si faltan ítems, marcar el total como incompleto. |
| Interpretación | Whitney 2004: 0-30 leve, 31-60 moderada, 61-100 grave (verificado en el resumen). Cambio clínicamente relevante: el valor de 18 puntos que se suele citar de Jacobson y Newman 1990 no figura en el resumen (⚠ comprobar en el texto completo). |
| Licencia | **Libre** (de uso clínico y académico muy extendido; publicado en el artículo original). Para uso comercial, comprobar con los autores (Jacobson GP, Newman CW). |

**Referencias**
1. Original: Jacobson GP, Newman CW. The development of the Dizziness Handicap Inventory. Arch Otolaryngol Head Neck Surg. 1990;116(4):424-7. PMID: 2317323. DOI: 10.1001/archotol.1990.01870040046011
2. Validación española (España): Pérez N, Garmendia I, Martín E, García-Tapia R. [Cultural adaptation of 2 questionnaires for health measurement in patients with vertigo]. Acta Otorrinolaringol Esp. 2000;51(7):572-80. PMID: 11270034. DOI: no figura en PubMed.
3. Puntos de corte: Whitney SL, Wrisley DM, Brown KE, Furman JM. Is perception of handicap related to functional performance in persons with vestibular dysfunction? Otol Neurotol. 2004;25(2):139-43. PMID: 15021773. DOI: 10.1097/00129492-200403000-00010

**Instrucciones al paciente:** «Este cuestionario sirve para saber qué dificultades le causa su mareo o inestabilidad. Conteste a cada pregunta con "Sí", "A veces" o "No", pensando solo en su problema de mareo o inestabilidad.»

**Ítems.** Opciones: 4 = Sí; 2 = A veces; 0 = No. (Entre corchetes, la subescala.)
1. [P] ¿Le aumenta el problema al mirar hacia arriba?
2. [E] Por su problema, ¿se siente frustrado/a?
3. [F] Por su problema, ¿limita sus viajes de trabajo o de ocio?
4. [P] ¿Le aumenta el problema al caminar por el pasillo de un supermercado?
5. [F] Por su problema, ¿le cuesta acostarse o levantarse de la cama?
6. [F] ¿Su problema le limita bastante para participar en actividades sociales, como salir a cenar, ir al cine, bailar o ir a fiestas?
7. [F] Por su problema, ¿le cuesta leer?
8. [P] ¿Le aumenta el problema al hacer actividades más exigentes, como deporte, bailar o tareas de casa como barrer o guardar los platos?
9. [E] Por su problema, ¿le da miedo salir de casa sin que alguien le acompañe?
10. [E] Por su problema, ¿ha pasado vergüenza delante de otras personas?
11. [P] ¿Le aumentan el problema los movimientos rápidos de la cabeza?
12. [F] Por su problema, ¿evita las alturas?
13. [P] ¿Le aumenta el problema al darse la vuelta en la cama?
14. [F] Por su problema, ¿le cuesta hacer tareas pesadas de la casa o del jardín?
15. [E] Por su problema, ¿le da miedo que la gente piense que está bebido/a?
16. [F] Por su problema, ¿le cuesta salir a pasear solo/a?
17. [P] ¿Le aumenta el problema al caminar por la acera?
18. [E] Por su problema, ¿le cuesta concentrarse?
19. [F] Por su problema, ¿le cuesta caminar por su casa a oscuras?
20. [E] Por su problema, ¿le da miedo quedarse solo/a en casa?
21. [E] Por su problema, ¿se siente discapacitado/a?
22. [E] ¿Su problema le ha causado tensiones en la relación con familiares o amigos?
23. [E] Por su problema, ¿se siente deprimido/a?
24. [F] ¿Su problema le dificulta su trabajo o sus responsabilidades en casa?
25. [P] ¿Le aumenta el problema al agacharse?

---

### SARC-F — Cuestionario de cribado de sarcopenia
| Campo | Valor |
|---|---|
| id propuesto | `sarc_f` |
| Grupo en la app | `topic: "Persona mayor"` |
| Qué mide / cuándo usarlo en fisio | Cribado rápido de sarcopenia según fuerza, ayuda para caminar, levantarse de la silla, subir escaleras y caídas. Un resultado positivo lleva a medir la fuerza de prensión, la masa muscular y el rendimiento físico (EWGSOP2). |
| Nº ítems · tiempo | 5 ítems · 1-2 min |
| Rango · qué es mejor | 0–10 · «menos es mejor» |
| Puntuación | Suma de los 5 ítems (0-2 cada uno). Sin ítems invertidos. Si falta algún ítem, el cribado queda incompleto (no hay regla para imputarlo). |
| Interpretación | ≥ 4 = cribado positivo (riesgo de sarcopenia y de malos resultados funcionales), según Malmstrom 2016 (verificado en el resumen). |
| Licencia | **Libre** (publicado por los autores, Saint Louis University; uso clínico gratuito). |

**Referencias**
1. Original: Malmstrom TK, Morley JE. SARC-F: a simple questionnaire to rapidly diagnose sarcopenia. J Am Med Dir Assoc. 2013;14(8):531-2. PMID: 23810110. DOI: 10.1016/j.jamda.2013.05.018
2. Validación al español (México, latinoamericana): Parra-Rodríguez L, Szlejf C, García-González AI, Malmstrom TK, Cruz-Arenas E, Rosas-Carrasco O. Cross-Cultural Adaptation and Validation of the Spanish-Language Version of the SARC-F to Assess Sarcopenia in Mexican Community-Dwelling Older Adults. J Am Med Dir Assoc. 2016;17(12):1142-6. PMID: 27815111. DOI: 10.1016/j.jamda.2016.09.008
3. Punto de corte: Malmstrom TK, Miller DK, Simonsick EM, Ferrucci L, Morley JE. SARC-F: a symptom score to predict persons with sarcopenia at risk for poor functional outcomes. J Cachexia Sarcopenia Muscle. 2016;7(1):28-36. PMID: 27066316. DOI: 10.1002/jcsm.12048

**Instrucciones al paciente:** «Conteste a estas preguntas sobre sus actividades de cada día. Elija la respuesta que mejor describa su situación.»

**Ítems**
1. Fuerza: ¿Qué dificultad tiene para levantar y llevar 4,5 kg (por ejemplo, una bolsa de la compra pesada)? — opciones: 0 = Ninguna; 1 = Alguna; 2 = Mucha o no puedo
2. Ayuda para caminar: ¿Qué dificultad tiene para cruzar caminando una habitación? — opciones: 0 = Ninguna; 1 = Alguna; 2 = Mucha, necesito ayuda (bastón, andador) o no puedo
3. Levantarse de una silla: ¿Qué dificultad tiene para pasar de una silla o de la cama a estar de pie? — opciones: 0 = Ninguna; 1 = Alguna; 2 = Mucha o no puedo sin ayuda
4. Subir escaleras: ¿Qué dificultad tiene para subir un tramo de 10 escalones? — opciones: 0 = Ninguna; 1 = Alguna; 2 = Mucha o no puedo
5. Caídas: ¿Cuántas veces se ha caído en el último año? — opciones: 0 = Ninguna; 1 = De 1 a 3 caídas; 2 = 4 caídas o más

---

### FRAIL — Escala FRAIL de fragilidad
| Campo | Valor |
|---|---|
| id propuesto | `frail` |
| Grupo en la app | `topic: "Persona mayor"` |
| Qué mide / cuándo usarlo en fisio | Cribado de fragilidad con 5 preguntas: fatiga, resistencia, deambulación, enfermedades y pérdida de peso. Ayuda a orientar la dosis de ejercicio y a derivar a geriatría. |
| Nº ítems · tiempo | 5 ítems · 2-3 min |
| Rango · qué es mejor | 0–5 · «menos es mejor» |
| Puntuación | Cada componente vale 0 o 1; total = suma. Fatiga: 1 si contesta «siempre» o «casi siempre». Resistencia y Deambulación: 1 si contesta «sí». Enfermedades: 1 si tiene 5 o más de las 11 marcadas. Pérdida de peso: 1 si ha perdido más del 5 % del peso en el último año: ((peso hace 1 año − peso actual) ÷ peso hace 1 año) × 100 > 5. Si falta un componente, el total queda incompleto. |
| Interpretación | 0 = robusto; 1-2 = prefrágil; 3-5 = frágil (es la definición de la escala; ⚠ los números no figuran en el resumen de Morley 2012, comprobar en el texto completo). Según el resumen, la prefragilidad y la fragilidad predijeron discapacidad en AVD y mortalidad. |
| Licencia | **Libre** (publicada por los autores, Saint Louis University; uso clínico gratuito). |

**Referencias**
1. Original: Morley JE, Malmstrom TK, Miller DK. A simple frailty questionnaire (FRAIL) predicts outcomes in middle aged African Americans. J Nutr Health Aging. 2012;16(7):601-8. PMID: 22836700. DOI: 10.1007/s12603-012-0084-2
2. Validación al español (México, latinoamericana): Rosas-Carrasco O, Cruz-Arenas E, Parra-Rodríguez L, García-González AI, Contreras-González LH, Szlejf C. Cross-Cultural Adaptation and Validation of the FRAIL Scale to Assess Frailty in Mexican Adults. J Am Med Dir Assoc. 2016;17(12):1094-8. PMID: 27567463. DOI: 10.1016/j.jamda.2016.07.008

**Instrucciones al paciente:** «Conteste a estas preguntas sobre su salud y sus actividades.»

**Ítems**
1. Fatiga: En las últimas 4 semanas, ¿cuánto tiempo se ha sentido cansado/a? — opciones: 1 = Siempre; 1 = Casi siempre; 0 = Algunas veces; 0 = Pocas veces; 0 = Nunca
2. Resistencia: Solo/a y sin ayudas, ¿le cuesta subir 10 escalones sin descansar? — opciones: 1 = Sí; 0 = No
3. Deambulación: Solo/a y sin ayudas, ¿le cuesta caminar unos 300 metros? — opciones: 1 = Sí; 0 = No
4. Enfermedades: ¿Le ha dicho alguna vez un médico que tiene alguna de estas enfermedades? (marque todas las que tenga): hipertensión; diabetes; cáncer (salvo un cáncer de piel leve); enfermedad pulmonar crónica; infarto de miocardio; insuficiencia cardiaca congestiva; angina de pecho; asma; artritis; ictus; enfermedad renal. — puntuación: 0 = de 0 a 4 marcadas; 1 = 5 o más
5. Pérdida de peso: ¿Cuánto pesa ahora, vestido/a y sin zapatos? ___ kg. ¿Cuánto pesaba hace un año? ___ kg. — puntuación: 1 = pérdida > 5 %; 0 = el resto (calculado por la app)

---

### ICIQ-UI SF — Cuestionario de Incontinencia Urinaria de la International Consultation on Incontinence, versión corta
| Campo | Valor |
|---|---|
| id propuesto | `iciq_ui_sf` |
| Grupo en la app | `topic: "Suelo pélvico"` |
| Qué mide / cuándo usarlo en fisio | Frecuencia, cantidad e impacto de la pérdida de orina. Incluye una pregunta sin puntuación para orientar el tipo de incontinencia (de esfuerzo, de urgencia o mixta). Se usa al inicio y en el seguimiento de la fisioterapia de suelo pélvico, tanto en mujeres como en hombres. |
| Nº ítems · tiempo | 4 ítems (3 puntúan + 1 sin puntuación) · 3-4 min |
| Rango · qué es mejor | 0–21 · «menos es mejor» |
| Puntuación | Total = ítem 1 (0-5) + ítem 2 (0, 2, 4 o 6) + ítem 3 (0-10). El ítem 4 no puntúa: se guarda como lista de situaciones. Si falta un ítem que puntúa, no se calcula el total. |
| Interpretación | Gravedad según Klovning 2009 (verificado en el resumen): 1-5 leve; 6-12 moderada; 13-18 grave; 19-21 muy grave. |
| Licencia | **Libre con permiso o registro** para uso clínico y académico no comercial: hay que pedirlo y firmar el acuerdo de licencia del ICIQ (Bristol Urological Institute, iciq.net), que también facilita la versión española oficial. El uso comercial (por ejemplo, en software que se vende) lleva tarifa: en ese caso, **Licencia**. No se pudo consultar iciq.net en esta sesión, así que hay que confirmar las condiciones con el ICIQ antes de publicar. |

**Referencias**
1. Original: Avery K, Donovan J, Peters TJ, Shaw C, Gotoh M, Abrams P. ICIQ: a brief and robust measure for evaluating the symptoms and impact of urinary incontinence. Neurourol Urodyn. 2004;23(4):322-30. PMID: 15227649. DOI: 10.1002/nau.20041
2. Validación española (España): Espuña Pons M, Rebollo Álvarez P, Puig Clota M. [Validation of the Spanish version of the International Consultation on Incontinence Questionnaire-Short Form. A questionnaire for assessing the urinary incontinence]. Med Clin (Barc). 2004;122(8):288-92. PMID: 15030739. DOI: 10.1016/s0025-7753(04)74212-8
3. Puntos de corte: Klovning A, Avery K, Sandvik H, Hunskaar S. Comparison of two questionnaires for assessing the severity of urinary incontinence: The ICIQ-UI SF versus the incontinence severity index. Neurourol Urodyn. 2009;28(5):411-5. PMID: 19214996. DOI: 10.1002/nau.20674

**Instrucciones al paciente:** «Mucha gente pierde orina alguna vez. Queremos saber cuántas personas pierden orina y cuánto les afecta. Le agradeceremos que conteste a estas preguntas pensando en cómo se ha encontrado, de media, durante las últimas 4 semanas.»

**Ítems** (sujetos al permiso del ICIQ; usar el texto oficial español que facilite el ICIQ)
1. ¿Con qué frecuencia pierde orina? — opciones: 0 = Nunca; 1 = Una vez a la semana o menos; 2 = Dos o tres veces a la semana; 3 = Una vez al día; 4 = Varias veces al día; 5 = Continuamente
2. Nos gustaría saber cuánta orina cree usted que pierde. ¿Qué cantidad de orina pierde habitualmente (tanto si lleva protección como si no)? — opciones: 0 = Nada; 2 = Muy poca cantidad; 4 = Una cantidad moderada; 6 = Mucha cantidad
3. En general, ¿cuánto afectan las pérdidas de orina a su vida diaria? — escala de 0 (nada) a 10 (mucho); puntúa el número elegido
4. ¿Cuándo pierde orina? (marque todo lo que le pase; no puntúa): Nunca; Antes de llegar al servicio; Al toser o estornudar; Mientras duerme; Al hacer esfuerzos físicos o ejercicio; Cuando ha terminado de orinar y ya se ha vestido; Sin motivo evidente; De forma continua

---

### PFDI-20 — Inventario de Molestias del Suelo Pélvico, versión corta (Pelvic Floor Distress Inventory-20)
| Campo | Valor |
|---|---|
| id propuesto | `pfdi_20` |
| Grupo en la app | `topic: "Suelo pélvico"` |
| Qué mide / cuándo usarlo en fisio | Presencia de síntomas de prolapso, colorrectoanales y urinarios, y cuánto molestan. Se usa en mujeres con disfunción del suelo pélvico, antes y después del tratamiento. |
| Nº ítems · tiempo | 20 ítems · unos 10 min |
| Rango · qué es mejor | 0–300 (3 subescalas de 0 a 100) · «menos es mejor» |
| Puntuación | Por ítem: No = 0; Sí → «¿Cuánto le molesta?»: Nada = 1, Un poco = 2, Moderadamente = 3, Bastante = 4. Subescalas: **POPDI-6** (ítems 1-6), **CRADI-8** (ítems 7-14), **UDI-6** (ítems 15-20). Cada subescala = media de los ítems contestados de esa subescala × 25 (0-100). Total = POPDI-6 + CRADI-8 + UDI-6 (0-300). Los ítems en blanco se excluyen de la media de su subescala (regla de Barber 2005, ⚠ el resumen no la detalla). |
| Interpretación | No hay MCID verificado en PubMed en esta búsqueda. |
| Licencia | **Libre** (publicado en el artículo original y de uso académico y clínico gratuito). No hay un titular comercial conocido; si se va a distribuir comercialmente, comprobar con el autor (Barber MD, Cleveland Clinic). |

**Referencias**
1. Original: Barber MD, Walters MD, Bump RC. Short forms of two condition-specific quality-of-life questionnaires for women with pelvic floor disorders (PFDI-20 and PFIQ-7). Am J Obstet Gynecol. 2005;193(1):103-13. PMID: 16021067. DOI: 10.1016/j.ajog.2004.12.025
2. Validación española (España): Sánchez-Sánchez B, Torres-Lacomba M, Yuste-Sánchez MJ, Navarro-Brazález B, Pacheco-da-Costa S, Gutiérrez-Ortega C, et al. Cultural adaptation and validation of the Pelvic Floor Distress Inventory short form (PFDI-20) and Pelvic Floor Impact Questionnaire short form (PFIQ-7) Spanish versions. Eur J Obstet Gynecol Reprod Biol. 2013;170(1):281-5. PMID: 23891390. DOI: 10.1016/j.ejogrb.2013.07.006

**Instrucciones al paciente:** «Conteste a cada pregunta pensando en los síntomas que ha tenido en los últimos 3 meses. Si tiene el síntoma, marque "Sí" e indique cuánto le molesta. Si no lo tiene, marque "No".»

**Ítems.** Opciones: 0 = No; si es Sí: 1 = Nada; 2 = Un poco; 3 = Moderadamente; 4 = Bastante (cuánto le molesta).
*POPDI-6 (prolapso)*
1. ¿Siente normalmente presión en la parte baja del abdomen?
2. ¿Siente normalmente pesadez o tirantez en la zona de la pelvis?
3. ¿Tiene normalmente un bulto o algo que se sale y que puede ver o notar en la zona de la vagina?
4. ¿Tiene alguna vez que presionar la vagina o alrededor del ano para poder hacer de vientre o terminar de hacerlo?
5. ¿Tiene normalmente la sensación de no vaciar del todo la vejiga?
6. ¿Tiene alguna vez que empujar con los dedos un bulto en la zona de la vagina para empezar a orinar o terminar de hacerlo?

*CRADI-8 (colorrectoanal)*
7. ¿Siente que tiene que hacer demasiada fuerza para hacer de vientre?
8. ¿Siente que no ha vaciado del todo el intestino al terminar de hacer de vientre?
9. ¿Se le escapan normalmente las heces sin poder controlarlo cuando son de consistencia normal?
10. ¿Se le escapan normalmente las heces sin poder controlarlo cuando son blandas o líquidas?
11. ¿Se le escapan normalmente los gases sin poder controlarlo?
12. ¿Tiene normalmente dolor al hacer de vientre?
13. ¿Siente unas ganas tan fuertes de hacer de vientre que tiene que correr al servicio?
14. ¿Se le sale alguna vez parte del intestino por el ano durante o después de hacer de vientre?

*UDI-6 (urinario)*
15. ¿Orina con frecuencia?
16. ¿Se le escapa normalmente la orina con una sensación de urgencia, es decir, con unas ganas muy fuertes de ir al servicio?
17. ¿Se le escapa normalmente la orina al toser, estornudar o reírse?
18. ¿Se le escapan normalmente pequeñas cantidades de orina (unas gotas)?
19. ¿Tiene normalmente dificultad para vaciar la vejiga?
20. ¿Tiene normalmente dolor o molestias en la parte baja del abdomen o en la zona genital?

---

### PFIQ-7 — Cuestionario de Impacto del Suelo Pélvico, versión corta (Pelvic Floor Impact Questionnaire-7)
| Campo | Valor |
|---|---|
| id propuesto | `pfiq_7` |
| Grupo en la app | `topic: "Suelo pélvico"` |
| Qué mide / cuándo usarlo en fisio | Impacto de los síntomas de vejiga, intestino y vagina o pelvis en las actividades, la vida social y las emociones. Se usa junto con el PFDI-20. |
| Nº ítems · tiempo | 7 preguntas × 3 columnas (21 respuestas) · unos 7-8 min |
| Rango · qué es mejor | 0–300 (3 subescalas de 0 a 100) · «menos es mejor» |
| Puntuación | Por respuesta: Nada = 0; Un poco = 1; Moderadamente = 2; Bastante = 3. Subescalas por columna: **UIQ-7** (vejiga u orina), **CRAIQ-7** (intestino o recto), **POPIQ-7** (vagina o pelvis). Cada subescala = media de las respuestas contestadas de esa columna × 100/3 (0-100). Total = UIQ-7 + CRAIQ-7 + POPIQ-7 (0-300). Los ítems en blanco se excluyen de la media (⚠ regla no detallada en el resumen). |
| Interpretación | No hay MCID verificado en PubMed en esta búsqueda. La versión española tiene efecto techo (25,4 %, Sánchez-Sánchez 2013). |
| Licencia | **Libre** (igual que el PFDI-20). |

**Referencias**
1. Original: Barber MD, Walters MD, Bump RC. Short forms of two condition-specific quality-of-life questionnaires for women with pelvic floor disorders (PFDI-20 and PFIQ-7). Am J Obstet Gynecol. 2005;193(1):103-13. PMID: 16021067. DOI: 10.1016/j.ajog.2004.12.025
2. Validación española (España): Sánchez-Sánchez B, Torres-Lacomba M, Yuste-Sánchez MJ, Navarro-Brazález B, Pacheco-da-Costa S, Gutiérrez-Ortega C, et al. Eur J Obstet Gynecol Reprod Biol. 2013;170(1):281-5. PMID: 23891390. DOI: 10.1016/j.ejogrb.2013.07.006

**Instrucciones al paciente:** «Algunas mujeres notan que los síntomas de la vejiga, del intestino o de la vagina afectan a sus actividades, sus relaciones y sus sentimientos. Para cada pregunta, marque la respuesta que mejor describa cuánto le han afectado los síntomas de vejiga, de intestino o de vagina en los últimos 3 meses. Conteste en cada una de las 3 columnas.»

**Ítems.** Pregunta común: «¿En qué medida los síntomas o problemas relacionados con… [Vejiga u orina] / [Intestino o recto] / [Vagina o pelvis] … afectan normalmente a su…?». Opciones en cada columna: 0 = Nada; 1 = Un poco; 2 = Moderadamente; 3 = Bastante.
1. …capacidad para hacer las tareas de casa (cocinar, limpiar, lavar la ropa)?
2. …capacidad para hacer actividades físicas como caminar, nadar u otro ejercicio?
3. …ocio, como ir al cine o a un concierto?
4. …capacidad para viajar en coche o autobús a más de 30 minutos de casa?
5. …participación en actividades sociales fuera de casa?
6. …salud emocional (nervios, depresión, etc.)?
7. …sensación de frustración?

---

### Nijmegen — Cuestionario de Nijmegen (respiración disfuncional / hiperventilación)
| Campo | Valor |
|---|---|
| id propuesto | `nijmegen` |
| Grupo en la app | `topic: "Respiratorio"` |
| Qué mide / cuándo usarlo en fisio | Síntomas relacionados con la hiperventilación y la respiración disfuncional. Se usa como cribado y para seguir la reeducación respiratoria, en ansiedad, asma, COVID persistente y disnea sin causa orgánica clara. |
| Nº ítems · tiempo | 16 ítems · 2-3 min |
| Rango · qué es mejor | 0–64 · «menos es mejor» |
| Puntuación | Suma de los 16 ítems (0-4 cada uno). Sin ítems invertidos. Si falta un ítem, el total queda incompleto. Van Dixhoorn y Duivenvoorden describieron 3 dimensiones (falta de aire, tetania periférica y tetania central), pero en la práctica clínica se usa el total. |
| Interpretación | ≥ 23 = sugestivo de síndrome de hiperventilación (punto de corte aplicado en Martínez-Moragón 2005, verificado en el resumen). En el estudio original: sensibilidad del 91 % y especificidad del 95 % (verificado en el resumen). |
| Licencia | **Libre** (de dominio público en la práctica; publicado en la literatura y de uso clínico gratuito). |

**Referencias**
1. Original: van Dixhoorn J, Duivenvoorden HJ. Efficacy of Nijmegen Questionnaire in recognition of the hyperventilation syndrome. J Psychosom Res. 1985;29(2):199-206. PMID: 4009520. DOI: 10.1016/0022-3999(85)90042-x
2. Validación española: no encontrada en PubMed. Hay una versión española usada en un estudio clínico: Martínez-Moragón E, Perpiñá M, Belloch A, de Diego A. [Prevalence of hyperventilation syndrome in patients treated for asthma in a pulmonology clinic]. Arch Bronconeumol. 2005;41(5):267-71. PMID: 15919008. DOI: 10.1016/s1579-2129(06)60221-8

**Instrucciones al paciente:** «A continuación hay una lista de síntomas. Indique con qué frecuencia los tiene.»

**Ítems.** Opciones: 0 = Nunca; 1 = Rara vez; 2 = A veces; 3 = A menudo; 4 = Muy a menudo.
1. Dolor en el pecho
2. Sensación de tensión
3. Visión borrosa
4. Mareos
5. Sensación de confusión o de estar desorientado/a
6. Respiración más rápida o más profunda
7. Falta de aire
8. Opresión en el pecho
9. Sensación de hinchazón en el estómago
10. Hormigueo en los dedos
11. No poder respirar hondo
12. Rigidez en los dedos o en los brazos
13. Sensación de tirantez alrededor de la boca
14. Manos o pies fríos
15. Palpitaciones (el corazón se acelera)
16. Sensación de ansiedad

---

### mMRC — Escala de disnea modificada del Medical Research Council
| Campo | Valor |
|---|---|
| id propuesto | `mmrc` |
| Grupo en la app | `topic: "Respiratorio"` |
| Qué mide / cuándo usarlo en fisio | Grado de discapacidad por falta de aire en la vida diaria. Se usa en EPOC, rehabilitación respiratoria, COVID persistente y cardiopatía. Es un solo ítem para clasificar, no para detectar cambios pequeños. |
| Nº ítems · tiempo | 1 ítem (5 grados) · < 1 min |
| Rango · qué es mejor | 0–4 · «menos es mejor» |
| Puntuación | Se elige un único grado (0-4): el valor es el número del grado. Equivale a la escala MRC original de 1 a 5 (grado mMRC = grado MRC − 1). Bestall 1999 usó la numeración MRC de 1 a 5. |
| Interpretación | Más grado = más discapacidad. Bestall 1999 encontró relación entre el grado MRC y la distancia en la prueba de lanzadera, la calidad de vida y las AVD (verificado en el resumen). No hay MCID verificado en PubMed en esta búsqueda. |
| Licencia | **Libre** (de dominio público; MRC/UKRI). |

**Referencias**
1. Original: Fletcher CM, Elmes PC, Fairbairn AS, Wood CH. The significance of respiratory symptoms and the diagnosis of chronic bronchitis in a working population. Br Med J. 1959;2(5147):257-66. PMID: 13823475. DOI: 10.1136/bmj.2.5147.257
2. Validación clínica: Bestall JC, Paul EA, Garrod R, Garnham R, Jones PW, Wedzicha JA. Usefulness of the Medical Research Council (MRC) dyspnoea scale as a measure of disability in patients with chronic obstructive pulmonary disease. Thorax. 1999;54(7):581-6. PMID: 10377201. DOI: 10.1136/thx.54.7.581
3. Validación española: no encontrada en PubMed.

**Instrucciones al paciente:** «Marque la frase que mejor describa su falta de aire.»

**Ítems** (un único ítem; elegir una opción)
- 0 = Solo me falta el aire al hacer un ejercicio intenso.
- 1 = Me falta el aire al andar deprisa en llano o al subir una cuesta poco pronunciada.
- 2 = Por la falta de aire, ando en llano más despacio que otras personas de mi edad, o tengo que pararme a respirar cuando ando a mi paso en llano.
- 3 = Tengo que pararme a respirar después de andar unos 100 metros o tras unos pocos minutos en llano.
- 4 = Me falta tanto el aire que no puedo salir de casa, o me falta el aire al vestirme o desvestirme.

---

### CAT — Test de Evaluación de la EPOC (COPD Assessment Test)
| Campo | Valor |
|---|---|
| id propuesto | `cat` |
| Grupo en la app | `topic: "Respiratorio"` |
| Qué mide / cuándo usarlo en fisio | Impacto de la EPOC en el estado de salud. Se usa al inicio y al final de la rehabilitación pulmonar. También se ha usado en bronquiectasias. |
| Nº ítems · tiempo | 8 ítems · 2-3 min |
| Rango · qué es mejor | 0–40 · «menos es mejor» |
| Puntuación | 8 ítems de diferencial semántico de 0 a 5: el paciente se sitúa entre dos frases opuestas, de mejor (0) a peor (5). Total = suma. Dominios de los ítems: tos, flemas, opresión en el pecho, falta de aire al subir cuestas o escaleras, limitación de las actividades en casa, confianza para salir de casa, sueño y energía. Si faltan ítems, según la guía de usuario del CAT (⚠ sin verificar), no se calcula el total. |
| Interpretación | MCID = 2 puntos (Kon 2014, verificado en el resumen). Niveles de impacto de la guía de usuario del CAT/GOLD: < 10 bajo, 10-20 medio, 21-30 alto, > 30 muy alto (⚠ no verificado en PubMed). |
| Licencia | **Licencia** (copyright y marca de GlaxoSmithKline). Su uso clínico suele ser gratuito, pero para integrarlo en una app o software, o para uso comercial, hace falta el permiso o la licencia de GSK, que se gestiona a través de catestonline.org o de Mapi Research Trust / ePROVIDE (comprobar el canal vigente). Por eso **no se incluye el texto de los ítems**. |

**Referencias**
1. Original: Jones PW, Harding G, Berry P, Wiklund I, Chen WH, Kline Leidy N. Development and first validation of the COPD Assessment Test. Eur Respir J. 2009;34(3):648-54. PMID: 19720809. DOI: 10.1183/09031936.00102509
2. Validación española (España): Agustí A, Soler JJ, Molina J, Muñoz MJ, García-Losa M, Roset M, et al. Is the CAT questionnaire sensitive to changes in health status in patients with severe COPD exacerbations? COPD. 2012;9(5):492-8. PMID: 22958111. DOI: 10.3109/15412555.2012.692409. (Estudio en 49 centros españoles que aporta pruebas de la validez de la versión española.)
3. MCID: Kon SS, Canavan JL, Jones SE, Nolan CM, Clark AL, Dickson MJ, et al. Minimum clinically important difference for the COPD Assessment Test: a prospective analysis. Lancet Respir Med. 2014;2(3):195-203. PMID: 24621681. DOI: 10.1016/S2213-2600(14)70001-3

**Instrucciones al paciente:** usar las del formulario oficial que facilite el titular.

**Ítems:** no incluidos (instrumento con licencia). Estructura: 8 ítems, cada uno con una escala de 0 a 5 entre dos frases opuestas.

---

### FSS — Escala de Gravedad de la Fatiga (Fatigue Severity Scale)
| Campo | Valor |
|---|---|
| id propuesto | `fss` |
| Grupo en la app | `topic: "Neurológico"` |
| Qué mide / cuándo usarlo en fisio | Gravedad de la fatiga y cómo afecta a la función. Se usa en esclerosis múltiple, lupus, Parkinson, ictus, COVID persistente, fibromialgia y para dosificar el ejercicio. |
| Nº ítems · tiempo | 9 ítems · 2-3 min |
| Rango · qué es mejor | 1–7 (media) o 9–63 (suma) · «menos es mejor» |
| Puntuación | Cada ítem de 1 a 7 (1 = muy en desacuerdo; 7 = muy de acuerdo). Puntuación habitual = media de los 9 ítems (1-7). Algunos estudios usan la suma (9-63). Sin ítems invertidos. Si falta algún ítem, calcular la media con los contestados solo si falta como mucho 1 (criterio práctico; ⚠ no hay regla oficial verificada). |
| Interpretación | El punto de corte que se suele citar es media ≥ 4 (o suma ≥ 36) para fatiga relevante (⚠ no verificado en PubMed en esta búsqueda). Krupp 1989 mostró que la escala distingue a pacientes de controles y detecta cambios en el tiempo (verificado en el resumen). |
| Licencia | **Libre** (publicada en el artículo original y de uso clínico muy extendido). Para uso comercial, comprobar con la autora (Lauren B. Krupp). |

**Referencias**
1. Original: Krupp LB, LaRocca NG, Muir-Nash J, Steinberg AD. The fatigue severity scale. Application to patients with multiple sclerosis and systemic lupus erythematosus. Arch Neurol. 1989;46(10):1121-3. PMID: 2803071. DOI: 10.1001/archneur.1989.00520460115022
2. Validación española: no encontrada en PubMed. (Hay estudios españoles que usan la FSS, por ejemplo Kos 2005, PMID: 15732270, sobre la MFIS, pero ninguno valida la FSS en español.)

**Instrucciones al paciente:** «Lea cada frase y elija el número del 1 al 7 que mejor indique su grado de acuerdo, pensando en la última semana. 1 = muy en desacuerdo; 7 = muy de acuerdo.»

**Ítems.** Opciones: 1, 2, 3, 4, 5, 6, 7 (1 = muy en desacuerdo … 7 = muy de acuerdo; puntúa el número elegido).
1. Cuando estoy fatigado/a, tengo menos motivación.
2. El ejercicio me produce fatiga.
3. Me fatigo con facilidad.
4. La fatiga interfiere en mi funcionamiento físico.
5. La fatiga me causa problemas con frecuencia.
6. La fatiga me impide mantener una actividad física de forma continuada.
7. La fatiga interfiere en el cumplimiento de algunas de mis obligaciones y responsabilidades.
8. La fatiga es uno de mis tres síntomas más incapacitantes.
9. La fatiga interfiere en mi trabajo, mi familia o mi vida social.

---

### MSWS-12 — Escala de Marcha en Esclerosis Múltiple de 12 ítems (Multiple Sclerosis Walking Scale-12)
| Campo | Valor |
|---|---|
| id propuesto | `msws_12` |
| Grupo en la app | `topic: "Neurológico"` |
| Qué mide / cuándo usarlo en fisio | Impacto de la esclerosis múltiple en la capacidad de caminar, percibido por el paciente. Se usa para seguir la rehabilitación de la marcha y los tratamientos (por ejemplo, fampridina). |
| Nº ítems · tiempo | 12 ítems · 3-5 min |
| Rango · qué es mejor | 0–100 · «menos es mejor» |
| Puntuación | Versión 1: cada ítem de 1 a 5 (de «nada» a «muchísimo»). Bruto = suma (12-60). Transformado = (suma − 12) ÷ 48 × 100. Hay una versión 2 con 3 opciones por ítem (1-3) y transformación (suma − 12) ÷ 24 × 100 (⚠ comprobar con el titular qué versión se licencia). Periodo de recuerdo: últimas 2 semanas. |
| Interpretación | No hay punto de corte ni MCID verificados en PubMed en esta búsqueda. |
| Licencia | **Comprobar con el titular**: el copyright es de los autores (Hobart JC y cols., UCL / Universidad de Plymouth). No se pudo confirmar si es de uso libre o si exige licencia para software comercial. Mientras tanto, **no se incluye el texto de los ítems**. |

**Referencias**
1. Original: Hobart JC, Riazi A, Lamping DL, Fitzpatrick R, Thompson AJ. Measuring the impact of MS on walking ability: the 12-Item MS Walking Scale (MSWS-12). Neurology. 2003;60(1):31-6. PMID: 12525714. DOI: 10.1212/wnl.60.1.31
2. Validación española: no encontrada en PubMed. (La guía española de Ramió-Torrentà et al., Neurologia 2018, PMID: 26873645, recomienda la MSWS-12, pero no es una validación.)

**Instrucciones al paciente:** pendiente del texto autorizado.

**Ítems:** no incluidos (licencia por confirmar). Estructura: 12 ítems sobre cuánto ha limitado la EM, en las últimas 2 semanas, distintos aspectos de la marcha (capacidad de caminar, correr, subir escaleras, estar de pie, equilibrio, distancia, esfuerzo, necesidad de apoyo, velocidad, fluidez, concentración necesaria para caminar).

---

### 5PQ — Cuestionario de 5 preguntas de hipermovilidad (Hakim y Grahame)
| Campo | Valor |
|---|---|
| id propuesto | `hipermovilidad_5pq` |
| Grupo en la app | `topic: "Hipermovilidad"` |
| Qué mide / cuándo usarlo en fisio | Cribado autoinformado de hipermovilidad articular generalizada. Se usa en dolor musculoesquelético difuso, inestabilidad articular recurrente y sospecha de trastorno del espectro de la hipermovilidad o de Ehlers-Danlos hipermóvil, como complemento a la escala de Beighton. |
| Nº ítems · tiempo | 5 ítems · 1 min |
| Rango · qué es mejor | 0–5 · no es una escala de «mejor o peor»: es un cribado (≥ 2 = positivo) |
| Puntuación | Sí = 1; No = 0. Total = suma. Si falta un ítem, se puntúa con los contestados y se marca incompleto. |
| Interpretación | ≥ 2 respuestas «sí» = probable hipermovilidad. Sensibilidad del 84 % y especificidad del 80-89 % (Hakim y Grahame 2003, verificado en el resumen). |
| Licencia | **Libre** (publicado en el artículo original; uso clínico gratuito). |

**Referencias**
1. Original: Hakim AJ, Grahame R. A simple questionnaire to detect hypermobility: an adjunct to the assessment of patients with diffuse musculoskeletal pain. Int J Clin Pract. 2003;57(3):163-6. PMID: 12723715. DOI: no figura en PubMed (no se pudo verificar con OpenAlex).
2. Validación al español (Perú, latinoamericana; adaptación cultural y fiabilidad test-retest): Aranda-Sánchez M, Huaco MD, Bravo-Cucci S. Cultural adaptation and reliability of the instrument Five-part questionnaire on hypermobility to the Peruvian context. Medwave. 2023;23:e2575. PMID: 36720108. DOI: 10.5867/medwave.2023.01.2575. No se encontró en PubMed una validación en España.

**Instrucciones al paciente:** «Conteste "Sí" o "No" a cada pregunta.»

**Ítems.** Opciones: 1 = Sí; 0 = No.
1. ¿Puede ahora (o pudo alguna vez) apoyar las palmas de las manos en el suelo sin doblar las rodillas?
2. ¿Puede ahora (o pudo alguna vez) doblar el pulgar hasta tocar el antebrazo?
3. De niño/a, ¿divertía a sus amigos contorsionando el cuerpo en posturas raras, o podía hacer el spagat (abrirse de piernas del todo)?
4. De niño/a o adolescente, ¿se le salió (luxó) el hombro o la rótula en más de una ocasión?
5. ¿Se considera una persona «con articulaciones dobles» (muy flexible o «descoyuntada»)?

---

### EQ-5D-5L — Cuestionario EuroQol de 5 dimensiones y 5 niveles
| Campo | Valor |
|---|---|
| id propuesto | `eq5d5l` |
| Grupo en la app | `topic: "Calidad de vida"` |
| Qué mide / cuándo usarlo en fisio | Calidad de vida relacionada con la salud, de forma genérica: 5 dimensiones más una escala visual (EQ VAS). Sirve para comparar entre patologías y para el análisis de coste-utilidad. |
| Nº ítems · tiempo | 5 ítems + EQ VAS · 2-3 min |
| Rango · qué es mejor | Perfil de 5 dígitos (11111 = sin problemas … 55555); índice con el conjunto de valores español (máximo 1 = salud plena; puede bajar de 0); EQ VAS de 0 a 100 · «más es mejor» (índice y VAS) |
| Puntuación | Dimensiones: movilidad, autocuidado, actividades cotidianas, dolor/malestar y ansiedad/depresión, cada una con 5 niveles (1 = sin problemas … 5 = problemas extremos o no poder). Se guarda el perfil (por ejemplo, 21132). Índice = conjunto de valores español EQ-5D-5L (modelo 3 de Ramos-Goñi 2018), que facilita EuroQol con la licencia. EQ VAS = número de 0 a 100 marcado por el paciente. Si falta una dimensión, no se calcula el índice. |
| Interpretación | No hay MCID verificado en PubMed en esta búsqueda. |
| Licencia | **Licencia / registro obligatorio** (EuroQol Research Foundation, euroqol.org). Hay que registrar el uso antes de empezar. El uso no comercial (clínico o académico) suele ser gratuito; el comercial tiene tarifa. Las versiones electrónicas deben seguir el formato autorizado por EuroQol. Por eso **no se incluye el texto de los ítems**. |

**Referencias**
1. Original: Herdman M, Gudex C, Lloyd A, Janssen M, Kind P, Parkin D, et al. Development and preliminary testing of the new five-level version of EQ-5D (EQ-5D-5L). Qual Life Res. 2011;20(10):1727-36. PMID: 21479777. DOI: 10.1007/s11136-011-9903-x (desarrollado en Reino Unido y España).
2. España (conjunto de valores): Ramos-Goñi JM, Craig BM, Oppe M, Ramallo-Fariña Y, Pinto-Prades JL, Luo N, et al. Handling Data Quality Issues to Estimate the Spanish EQ-5D-5L Value Set Using a Hybrid Interval Regression Approach. Value Health. 2018;21(5):596-604. PMID: 29753358. DOI: 10.1016/j.jval.2017.10.023

**Instrucciones al paciente:** usar las del formulario oficial de EuroQol.

**Ítems:** no incluidos (instrumento con licencia). Estructura: 5 preguntas de una sola respuesta con 5 niveles cada una, más la EQ VAS (escala vertical de 0 a 100: «la peor salud que se pueda imaginar» / «la mejor salud que se pueda imaginar»).

---

### PROMIS-10 — Salud Global PROMIS (PROMIS Global Health, 10 ítems)
| Campo | Valor |
|---|---|
| id propuesto | `promis_10` |
| Grupo en la app | `topic: "Calidad de vida"` |
| Qué mide / cuándo usarlo en fisio | Salud global física y mental en 10 ítems. Es una alternativa breve y de uso libre a la RAND-36, para el seguimiento general de cualquier paciente. |
| Nº ítems · tiempo | 10 ítems · 2-3 min |
| Rango · qué es mejor | Puntuaciones T (media 50, DE 10) para Salud Física Global (GPH) y Salud Mental Global (GMH) · «más es mejor» |
| Puntuación | Ítems de 1 a 5 (5 = mejor). El ítem de dolor (Global07, de 0 a 10) se recodifica: 0 → 5; 1-3 → 4; 4-6 → 3; 7-9 → 2; 10 → 1. **GPH** = Global03 + Global06 + Global07 recodificado + Global08 (bruto 4-20). **GMH** = Global02 + Global04 + Global05 + Global10 (bruto 4-20). Los brutos se convierten a T con la tabla oficial de HealthMeasures (no se reproduce aquí: usar la tabla o el manual oficial). Global01 (salud general) y Global09 (rol social) se informan como ítems sueltos. Si falta algún ítem de una escala, no se calcula esa escala. Composición de las escalas según Hays 2009 (verificado en el resumen). |
| Interpretación | T = 50 es la media de la población general de EE. UU. Más alto = mejor salud. No hay MCID verificado en PubMed en esta búsqueda. |
| Licencia | **Libre con permiso o registro**: los instrumentos PROMIS son gratuitos para uso clínico y de investigación (HealthMeasures / PROMIS Health Organization). Para integrarlos en software comercial hace falta un acuerdo con la PHO o HealthMeasures (comprobar). Existe una traducción oficial al español, que debe usarse en lugar de la de esta ficha. |

**Referencias**
1. Original: Hays RD, Bjorner JB, Revicki DA, Spritzer KL, Cella D. Development of physical and mental health summary scores from the patient-reported outcomes measurement information system (PROMIS) global items. Qual Life Res. 2009;18(7):873-80. PMID: 19543809. DOI: 10.1007/s11136-009-9496-9
2. Validación española: no encontrada en PubMed.

**Instrucciones al paciente:** «Por favor, conteste a cada pregunta marcando una sola respuesta.»

**Ítems**
1. (Global01) En general, ¿diría que su salud es…? — opciones: 5 = Excelente; 4 = Muy buena; 3 = Buena; 2 = Regular; 1 = Mala
2. (Global02) En general, ¿diría que su calidad de vida es…? — opciones: 5 = Excelente; 4 = Muy buena; 3 = Buena; 2 = Regular; 1 = Mala
3. (Global03) En general, ¿cómo calificaría su salud física? — opciones: 5 = Excelente; 4 = Muy buena; 3 = Buena; 2 = Regular; 1 = Mala
4. (Global04) En general, ¿cómo calificaría su salud mental, incluidos su estado de ánimo y su capacidad de pensar? — opciones: 5 = Excelente; 4 = Muy buena; 3 = Buena; 2 = Regular; 1 = Mala
5. (Global05) En general, ¿cómo calificaría su satisfacción con sus actividades sociales y sus relaciones? — opciones: 5 = Excelente; 4 = Muy buena; 3 = Buena; 2 = Regular; 1 = Mala
6. (Global09) En general, califique cómo realiza sus actividades y funciones sociales habituales (en casa, en el trabajo y en su comunidad, y sus responsabilidades como padre o madre, hijo/a, pareja, trabajador/a, amigo/a, etc.). — opciones: 5 = Excelente; 4 = Muy bien; 3 = Bien; 2 = Regular; 1 = Mal
7. (Global06) ¿Hasta qué punto puede hacer sus actividades físicas de cada día, como caminar, subir escaleras, llevar la compra o mover una silla? — opciones: 5 = Completamente; 4 = Casi del todo; 3 = Moderadamente; 2 = Un poco; 1 = Nada
8. (Global10) En los últimos 7 días, ¿con qué frecuencia le han molestado problemas emocionales, como sentirse ansioso/a, deprimido/a o irritable? — opciones: 5 = Nunca; 4 = Rara vez; 3 = A veces; 2 = A menudo; 1 = Siempre
9. (Global08) En los últimos 7 días, ¿cómo calificaría su fatiga, de media? — opciones: 5 = Ninguna; 4 = Leve; 3 = Moderada; 2 = Grave; 1 = Muy grave
10. (Global07) En los últimos 7 días, ¿cómo calificaría su dolor, de media? — opciones: 0 (sin dolor) a 10 (el peor dolor imaginable). Se recodifica para la GPH: 0 → 5; 1-3 → 4; 4-6 → 3; 7-9 → 2; 10 → 1

---
