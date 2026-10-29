# Cuestionarios de OmniClin

Qué cuestionarios hay en la app y cómo se usa cada uno, tras la revisión legal del 29-10-2026 (producto sanitario y
licencias). Sale del catálogo (`src/clinical/questionnaires.ts` y `src/clinical/catalog`): si cambia, se vuelve a
generar. Aquí no van las preguntas de ningún cuestionario.

- **Libres, enteros en la app:** se rellenan en la app (o el paciente en su móvil) y la nota se calcula sola, con la
  cita de sus autores.
- **Solo la nota, con su hoja oficial:** la app no tiene su texto. Se pasan en la hoja oficial, que se consigue en el
  enlace (o pidiendo el permiso a quien se indica), y se anota la nota.
- **Fuera del servicio:** son de pago. Ni se pasan ni se anotan; lo guardado antes se sigue viendo como registro
  antiguo en la ficha, la evolución, el informe y la exportación.

Los enlaces se comprueban con `npm run check:links` (hace falta conexión) antes de publicar un cambio.

## Libres, enteros en la app (32)

| Cuestionario | Cita |
| --- | --- |
| PSFS · escala funcional específica del paciente | Con su propia pantalla en la app |
| Cambio global percibido | Con su propia pantalla en la app |
| Mapa del dolor | Con su propia pantalla en la app |
| FAAM AVD (tobillo y pie) | Martin et al., 2005 (FAAM original); versión española FAAM-Sp de Cervera-Garvi et al., 2017. |
| RAND-36 (calidad de vida relacionada con la salud) | RAND Health, 1992; Hays et al., 1993 (RAND 36-Item Health Survey 1.0, dominio público). Texto de trabajo: revisar con la versión española publicada. |
| PHQ-9 (síntomas depresivos) | Kroenke, Spitzer y Williams, 2001 (PHQ-9 original). Texto de trabajo: revisar con la versión española publicada. |
| GAD-7 (ansiedad) | Spitzer, Kroenke, Williams y Löwe, 2006 (GAD-7 original). Texto de trabajo: revisar con la versión española publicada. |
| IPAQ corto (actividad física) | Craig et al., 2003 (IPAQ, versión corta de los últimos 7 días; protocolo de puntuación IPAQ, 2005). Texto de trabajo: revisar con la versión española publicada. |
| JFLS-8 (ATM, limitación funcional mandibular) | Ohrbach, Larsson y List, 2008 (original), DOI no figura en PubMed (PMID 18780535); sin validación española en PubMed |
| TMD Pain Screener (ATM, cribado del dolor) | Gonzalez et al., 2011 (original), DOI 10.14219/jada.archive.2011.0088; sin validación española en PubMed |
| BCTQ (túnel carpiano, Boston) | Levine et al., 1993 (original), DOI 10.2106/00004623-199311000-00002; Oteo-Álvaro et al., 2016 (validación española), DOI 10.1016/j.medcli.2015.10.013 |
| ASES (hombro) | Richards et al., 1994 (original), DOI 10.1016/S1058-2746(09)80019-0; Vrotsou et al., 2016 (validación española), DOI 10.1186/s12955-016-0552-1; Michener et al., 2002 (MCID), DOI 10.1067/mse.2002.127096; Policastro et al., 2019 (versión argentina), DOI 10.1016/j.msksp.2019.05.010 |
| SST (test simple del hombro) | Lippitt et al., 1993 (original, capítulo de libro; referencia sin verificar, no está en PubMed); Membrilla-Mesa et al., 2015 (validación española), DOI 10.1007/s11136-014-0760-2 |
| Kujala / AKPS (dolor femoropatelar) | Kujala et al., 1993 (original), DOI 10.1016/s0749-8063(05)80366-4; Gil-Gámez et al., 2016 (validación española), DOI 10.1007/s00167-015-3521-z; Crossley et al., 2004 (MCID), DOI 10.1016/s0003-9993(03)00613-0 |
| Lysholm (rodilla) | Lysholm y Gillquist, 1982 (original), DOI 10.1177/036354658201000306; Arroyo-Morales et al., 2019 (validación española), DOI 10.1371/journal.pone.0221376; Briggs et al., 2009 (fiabilidad y cambio mínimo detectable), DOI 10.1177/0363546508330143 |
| Tegner (nivel de actividad) | Tegner y Lysholm, 1985 (original), sin DOI en PubMed; Pujol et al., 2025 (traducción y adaptación cultural al español), DOI 10.24875/CIRU.23000460; Briggs et al., 2009 (fiabilidad y cambio mínimo detectable), DOI 10.1177/0363546508330143 |
| Marx (actividad de rodilla) | Marx et al., 2001 (original), DOI 10.1177/03635465010290021601; validación española: no encontrada en PubMed |
| CAIT (inestabilidad crónica de tobillo) | Hiller et al., 2006 (original), DOI 10.1016/j.apmr.2006.05.022; Cruz-Díaz et al., 2013 (validación española), DOI 10.1007/s10067-012-2095-0; Rodríguez-Fernández et al., 2015 (validación española), DOI 10.3109/09638288.2014.984879; Wright et al., 2014 (punto de corte), DOI 10.1016/j.apmr.2014.04.017 |
| FAAM Deporte (tobillo y pie) | Martin et al., 2005 (original), DOI 10.1177/107110070502601113; Cervera-Garvi et al., 2017 (validación española, FAAM-Sp), DOI 10.1186/s13047-017-0221-6 |
| I-PRRS (preparación psicológica para volver al deporte) | Glazer, 2009 (original), DOI 10.4085/1062-6050-44.2.185; sin validación española en PubMed |
| PEG (dolor, disfrute de la vida y actividad) | Krebs et al., 2009 (original), DOI 10.1007/s11606-009-0981-1; sin validación española en PubMed para España; validación en español de EE. UU. (población hispana, PEG-S): Kapos et al., 2023, DOI 10.1016/j.jpain.2023.06.005 |
| Brief IPQ (percepción de la enfermedad) | Broadbent et al., 2006 (original), DOI 10.1016/j.jpsychores.2005.10.020; Pacheco-Huergo et al., 2011 (validación lingüística española), DOI 10.1016/j.aprim.2010.11.022 |
| DASS-21 (depresión, ansiedad y estrés) | Lovibond y Lovibond, 1995 (original), DOI 10.1016/0005-7967(94)00075-u; Bados et al., 2005 (validación española; sin verificar: no está en PubMed); Soria-Reyes et al., 2024 (muestra española), DOI 10.1038/s41598-024-68814-9 |
| PHQ-4 (cribado rápido de ánimo y ansiedad) | Kroenke et al., 2009 (original), DOI 10.1176/appi.psy.50.6.613; Cano-Vindel et al., 2018 (validación española, atención primaria), DOI 10.1016/j.jad.2018.01.030; Löwe et al., 2009 (normas en población general), DOI 10.1016/j.jad.2009.06.019 |
| Short FES-I (miedo a caerse) | Kempen et al., 2008 (original), DOI 10.1093/ageing/afm157; González Montaos et al., 2024 (validación española), DOI 10.1016/j.regg.2023.101436; Delbaere et al., 2010 (puntos de corte), DOI 10.1093/ageing/afp225 |
| SARC-F (cribado de sarcopenia) | Malmstrom y Morley, 2013 (original), DOI 10.1016/j.jamda.2013.05.018; Parra-Rodríguez et al., 2016 (validación al español, México), DOI 10.1016/j.jamda.2016.09.008; Malmstrom et al., 2016 (punto de corte), DOI 10.1002/jcsm.12048 |
| FRAIL (fragilidad) | Morley et al., 2012 (original), DOI 10.1007/s12603-012-0084-2; Rosas-Carrasco et al., 2016 (validación al español, México), DOI 10.1016/j.jamda.2016.07.008 |
| PFDI-20 (síntomas de suelo pélvico) | Barber et al., 2005 (original), DOI 10.1016/j.ajog.2004.12.025; Sánchez-Sánchez et al., 2013 (validación española), DOI 10.1016/j.ejogrb.2013.07.006 |
| PFIQ-7 (impacto del suelo pélvico) | Barber et al., 2005 (original), DOI 10.1016/j.ajog.2004.12.025; Sánchez-Sánchez et al., 2013 (validación española), DOI 10.1016/j.ejogrb.2013.07.006 |
| Nijmegen (respiración disfuncional) | van Dixhoorn y Duivenvoorden, 1985 (original), DOI 10.1016/0022-3999(85)90042-x; sin validación española en PubMed (versión española usada por Martínez-Moragón et al., 2005, DOI 10.1016/s1579-2129(06)60221-8) |
| mMRC (disnea) | Fletcher et al., 1959 (original), DOI 10.1136/bmj.2.5147.257; Bestall et al., 1999 (validación clínica), DOI 10.1136/thx.54.7.581; sin validación española en PubMed |
| 5PQ (hipermovilidad) | Hakim y Grahame, 2003 (original), PMID 12723715 (el DOI no figura en PubMed); Aranda-Sánchez et al., 2023 (adaptación cultural al español y fiabilidad, Perú), DOI 10.5867/medwave.2023.01.2575; sin validación en España |

## Solo la nota, con su hoja oficial (27)

| Cuestionario | Hoja oficial o permiso | Cita |
| --- | --- | --- |
| ACL-RSI (preparación psicológica) | [Artículo de la validación, en abierto, con el cuestionario](https://doi.org/10.1002/jeo2.70046) | Webster, Feller y Lambros, 2008 (original); Donat-Roca et al., 2024 (validación española), J Exp Orthop 11:e70046, DOI 10.1002/jeo2.70046 |
| NDI (cuello) | [ePROVIDE · Mapi Research Trust](https://eprovide.mapi-trust.org/instruments/neck-disability-index) | Vernon y Mior, 1991; versión española de Andrade Ortega et al., 2010 |
| Oswestry (lumbar) | [ePROVIDE · Mapi Research Trust](https://eprovide.mapi-trust.org/odi-oswestry-disability-index/) | Fairbank et al., 1980 (versión 2.1a); versión española de Flórez García et al., 1995 |
| QuickDASH (miembro superior) | [Institute for Work & Health (dash.iwh.on.ca)](https://dash.iwh.on.ca) | Beaton et al., 2005 (QuickDASH, Institute for Work & Health); versión española del IWH |
| SPADI (hombro) | [Artículo de la validación, en abierto, con el cuestionario](https://doi.org/10.1186/s12955-015-0397-z) | Roach et al., 1991 (original); Membrilla-Mesa et al., 2015 (validación española), Health Qual Life Outcomes 13:200, DOI 10.1186/s12955-015-0397-z |
| PCS (catastrofismo ante el dolor) | [Permiso: ePROVIDE · Mapi Research Trust](https://eprovide.mapi-trust.org) | Sullivan, Bishop y Pivik, 1995 (original) |
| CSI (sensibilización central) | [Artículo de la validación, en abierto, con el cuestionario](https://doi.org/10.1186/s40064-016-3515-4) | Mayer et al., 2012 (original); Cuesta-Vargas et al., 2016 (validación española), SpringerPlus 5:1837, DOI 10.1186/s40064-016-3515-4 |
| RMDQ (lumbar, Roland-Morris) | [rmdq.org](https://www.rmdq.org) | Roland y Morris, 1983 (original), DOI 10.1097/00007632-198303000-00004; Kovacs et al., 2002 (validación española), DOI 10.1097/00007632-200203010-00016; Ostelo et al., 2008 (cambio mínimo importante), DOI 10.1097/BRS.0b013e31815e3a10 |
| SBST (lumbar, STarT Back) | [Keele University (STarT Back)](https://startback.hfac.keele.ac.uk) | Hill et al., 2008 (original), DOI 10.1002/art.23563; Gusi et al., 2011 (versión española: traducción y adaptación transcultural, sin estudio psicométrico completo), DOI 10.1016/j.aprim.2010.05.019 |
| PGQ (cintura pélvica) | [Artículo de la validación, en abierto, con el cuestionario](https://doi.org/10.1186/s12955-017-0605-0) | Stuge et al., 2011 (original), DOI 10.2522/ptj.20100357; Rejano-Campo et al., 2017 (validación española), DOI 10.1186/s12955-017-0605-0 |
| MIDAS (discapacidad por migraña) | [PDF en headaches.org](https://headaches.org) | Stewart et al., 2001 (original), DOI 10.1212/wnl.56.suppl_1.s20; Rodríguez-Almagro et al., 2020 (validación española, estudiantes universitarios), DOI 10.1186/s12883-020-01646-y |
| DASH (miembro superior, versión completa) | [Institute for Work & Health (dash.iwh.on.ca)](https://dash.iwh.on.ca) | Hudak et al., 1996 (original), DOI 10.1002/(SICI)1097-0274(199606)29:6<602::AID-AJIM4>3.0.CO;2-L; Hervás et al., 2006 (validación española), DOI 10.1157/13093053; Franchignoni et al., 2014 (MCID), DOI 10.2519/jospt.2014.4893 |
| PRWE (muñeca) | [Artículo de la validación, en abierto, con el cuestionario](https://doi.org/10.1186/s12955-017-0745-2) | MacDermid et al., 1998 (original), DOI 10.1097/00005131-199811000-00009; Rosales et al., 2017 (validación española), DOI 10.1186/s12955-017-0745-2; Simental-Mendía et al., 2026 (versión mexicana), DOI 10.1080/09638288.2025.2574534 |
| IKDC subjetivo (rodilla) | [AOSSM (American Orthopaedic Society for Sports Medicine)](https://www.sportsmed.org) | Irrgang et al., 2001 (original), DOI 10.1177/03635465010290051301; Pujol et al., 2025 (traducción y adaptación cultural al español, sin estudio psicométrico completo), DOI 10.24875/CIRU.23000460; Irrgang et al., 2006 (MCID), DOI 10.1177/0363546506288855 |
| ALR-RSI (preparación psicológica, tobillo) | [Artículo original, en abierto, con la escala](https://pmc.ncbi.nlm.nih.gov/articles/PMC7669765/) | Sigonney et al., 2020 (original), DOI 10.1007/s00167-020-06020-6; Pioger et al., 2022 (validación tras Broström-Gould), DOI 10.1007/s00167-022-06895-7; Pérez-de la Cruz, 2023 (validación española), DOI 10.3390/jpm13040606 |
| OSTRC-H2 (problemas de salud en deportistas) | [Artículo de la validación, en abierto, con el cuestionario](https://doi.org/10.1177/2325967120968552) | Clarsen et al., 2013 (original, OSTRC-O), DOI 10.1136/bjsports-2012-091524; Clarsen et al., 2020 (versión 2, H2 y O2), DOI 10.1136/bjsports-2019-101337; Bailón-Cerezo et al., 2020 (validación española, deportistas de 12 a 17 años), DOI 10.1177/2325967120968552; Martínez-Cal et al., 2023 (validación española del OSTRC-O de primera versión, balonmano), DOI 10.3390/healthcare11060912 |
| painDETECT (componente neuropático) | Permiso: formulario de IQVIA | Freynhagen et al., 2006 (original), DOI 10.1185/030079906X132488; De Andrés et al., 2012 (validación española), DOI 10.1097/AJP.0b013e31822bb35b |
| BPI-SF (Cuestionario Breve del Dolor) | Permiso: Department of Symptom Research, MD Anderson Cancer Center | Cleeland y Ryan, 1994 (original), DOI no figura en PubMed; Badia et al., 2003 (validación española, dolor oncológico), DOI 10.1016/s0025-7753(03)73601-x; de Andrés Ares et al., 2015 (validación española de la forma corta, dolor no oncológico), DOI 10.1111/papr.12219 |
| CPAQ-8 (aceptación del dolor crónico) | [contextualscience.org](https://contextualscience.org) | Fish et al., 2010 (original), DOI 10.1016/j.pain.2009.12.016; sin validación española del CPAQ-8 en PubMed (sí del CPAQ completo: Rodero et al., 2010, DOI 10.1186/1477-7525-8-37); Baranoff et al., 2014 (CPAQ-8 en clínica del dolor), DOI 10.1007/s12529-012-9278-6 |
| Back-PAQ-10 (actitudes ante el dolor de espalda) | [Universidad de Otago (otago.ac.nz)](https://www.otago.ac.nz) | Darlow et al., 2014 (original), DOI 10.1136/bmjopen-2014-005251; sin validación española en PubMed para España; validación en español de Argentina (no consta si incluye la versión de 10 ítems): Pierobon et al., 2020, DOI 10.1016/j.msksp.2020.102125; Numanovic et al., 2024 (versión sueca, error de medida), DOI 10.1016/j.msksp.2024.102984 |
| rNPQ (neurofisiología del dolor) | [Artículo de la validación, en abierto, con el cuestionario](https://doi.org/10.3390/ijerph18094463) | Catley et al., 2013 (original, versión revisada), DOI 10.1016/j.jpain.2013.02.008; sin validación española (las hay en francés, alemán, italiano, neerlandés, danés, finés y turco) |
| ISI (gravedad del insomnio) | [Permiso: ePROVIDE · Mapi Research Trust](https://eprovide.mapi-trust.org/isi-insomnia-severity-index/) | Bastien et al., 2001 (original), DOI 10.1016/s1389-9457(00)00065-4; Fernandez-Mendoza et al., 2011 (validación española), DOI 10.1016/j.sleep.2011.06.019; Sierra et al., año sin verificar (validación española en mayores), DOI no figura en PubMed; Morin et al., 2011 (puntos de corte y cambio mínimo importante), DOI 10.1093/sleep/34.5.601 |
| PSS-10 (estrés percibido) | [Carnegie Mellon University (S. Cohen)](https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/) | Cohen et al., 1983 (original), DOI no figura en PubMed; Remor, 2006 (validación española, incluye la forma de 10 ítems), DOI 10.1017/s1138741600006004 |
| ICIQ-UI SF (incontinencia urinaria) | [ICIQ (iciq.net)](https://iciq.net) | Avery et al., 2004 (original), DOI 10.1002/nau.20041; Espuña Pons et al., 2004 (validación española), DOI 10.1016/s0025-7753(04)74212-8; Klovning et al., 2009 (gravedad), DOI 10.1002/nau.20674 |
| CAT (EPOC) | [catestonline.org](https://www.catestonline.org) | Jones et al., 2009 (original), DOI 10.1183/09031936.00102509; Agustí et al., 2012 (validez de la versión española), DOI 10.3109/15412555.2012.692409; Kon et al., 2014 (cambio mínimo importante), DOI 10.1016/S2213-2600(14)70001-3 |
| EQ-5D-5L (calidad de vida) | [EuroQol Research Foundation](https://euroqol.org) | Herdman et al., 2011 (original), DOI 10.1007/s11136-011-9903-x; Ramos-Goñi et al., 2018 (conjunto de valores español), DOI 10.1016/j.jval.2017.10.023 |
| PROMIS-10 (salud global) | [HealthMeasures](https://www.healthmeasures.net) | Hays et al., 2009 (original), DOI 10.1007/s11136-009-9496-9; sin validación española en PubMed |

## Fuera del servicio (39)

KOOS (rodilla), HOOS (cadera), KOOS-12 (rodilla, forma corta), HOOS-12 (cadera, forma corta), FAOS (pie y tobillo), OKS (rodilla, Oxford), OHS (cadera, Oxford), OSS (hombro, Oxford), OES (codo, Oxford), WOMAC (artrosis de cadera y rodilla), HIT-6 (impacto de la cefalea), TSK-11 (kinesiofobia), DN4 (dolor neuropático), iHOT-12 (cadera, paciente joven y activo), HAGOS (cadera e ingle), WOSI (inestabilidad de hombro), WORC (manguito rotador), MSWS-12 (marcha en esclerosis múltiple), ZCQ (estenosis de canal lumbar, Zúrich), PSEQ (autoeficacia ante el dolor), FSS (gravedad de la fatiga), ABC (confianza en el equilibrio), S-LANSS (dolor neuropático, Leeds), LEFS (miembro inferior), UEFI (miembro superior), PRTEE (codo de tenista), FFI (índice de función del pie), SIRSI (hombro, preparación psicológica), VISA-A (tendón de Aquiles), VISA-P (tendón rotuliano), VISA-G (tendinopatía glútea), FABQ (miedo y evitación), DHI (discapacidad por mareo), WDQ (latigazo cervical), EARS (adherencia al ejercicio), Örebro corto (riesgo de que el dolor se cronifique), BQ-L (lumbar, Bournemouth), BQ-C (cuello, Bournemouth), Keele STarT MSK (cribado pronóstico del dolor musculoesquelético).
