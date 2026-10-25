// Los casos clínicos inventados de la clínica de prueba (src/demo/README.md): doce motivos de consulta habituales en
// fisioterapia, cada uno con textos de anamnesis, exploración, sesiones y plan para elegir al azar. Todo es ficticio;
// los textos evitan las palabras que la app toma por banderas rojas (src/clinical/redFlags.ts) salvo en los pocos
// pacientes que las llevan a propósito.

/** «{lado}»: derecho/derecha o izquierdo/izquierda, según `femenino`. */
export type DemoCase = {
  id: string;
  /** Nombre del motivo («Lumbalgia mecánica»). */
  title: string;
  /** Zonas de la anamnesis (ids de BODY_REGIONS). */
  regions: string[];
  /** Si tiene lado, y si la palabra que lo lleva es femenina («rodilla derecha»). */
  sided: boolean;
  femenino?: boolean;
  /** Zonas del mapa del dolor (src/clinical/bodyMap.ts); «_x» se cambia por el lado (_d o _i). */
  zones: string[];
  age: [number, number];
  motivo: string[];
  inicio: string[];
  forma: string[];
  localizacion: string[];
  tipo: string[];
  agravantes: string[];
  atenuantes: string[];
  ritmo: string[];
  irradiacion: string[];
  evolucion: string[];
  pruebas: string[];
  inspeccion: string[];
  palpacion: string[];
  movilidad: string[];
  balance: string[];
  marcha: string[];
  diagnostico: string[];
  estructuras: string;
  /** Códigos de la CIF con sus calificadores (src/clinical/cif/cif.ts): el título sale del catálogo. */
  cif: string[];
  objetivosCorto: string[];
  objetivosLargo: string[];
  plan: string[];
  sesiones: [number, number];
  /** Los tests de la galería de su zona cuyo grupo encaja; el primero que encaja sale positivo. */
  tests: RegExp;
  /** Cuestionarios que se rellenan en la app (ids de src/clinical/forms). */
  questionnaires: string[];
  /** Mediciones de movilidad (src/calc/rom.ts): grados al empezar y lo que se gana. */
  rom: { movement: string; start: number; gain: number }[];
  psfs: string[];
  tratamiento: string[];
  /** Consentimientos que se firman (src/consent/templates.ts). */
  consents: string[];
  /** Deportista: salen saltos en Valoración. */
  sport?: boolean;
};

export const CASES: DemoCase[] = [
  {
    id: "lumbalgia",
    title: "Lumbalgia mecánica",
    regions: ["lumbar"],
    sided: false,
    zones: ["lumbar", "gluteo_x"],
    age: [28, 68],
    motivo: [
      "Dolor en la zona baja de la espalda desde hace unas semanas, sobre todo al estar mucho rato sentado en el trabajo.",
      "Molestia lumbar que empezó al mover muebles en casa. Le cuesta agacharse y ponerse los calcetines.",
      "Dolor lumbar recurrente, tercer episodio este año. Esta vez le limita para jugar con sus hijos.",
    ],
    inicio: ["Hace 3 semanas", "Hace mes y medio", "Hace 10 días", "Hace 2 meses"],
    forma: ["Progresivo", "Súbito, al levantar peso", "Progresivo, tras varios días de mucho trabajo"],
    localizacion: ["Zona lumbar baja, a los dos lados", "Lumbar baja, más hacia el lado {lado}", "Lumbar y parte alta del glúteo {lado}"],
    tipo: ["Sordo, a veces punzante al moverse", "Como una tirantez", "Opresivo, de rigidez"],
    agravantes: ["Estar sentado más de una hora, agacharse, levantarse de la silla.", "Flexionar el tronco, conducir, coger peso del suelo.", "Estar de pie quieto mucho rato y cargar la compra."],
    atenuantes: ["Caminar, cambiar de postura, calor local.", "Tumbarse de lado con las piernas dobladas.", "Moverse y estirarse un poco."],
    ritmo: ["Mecánico", "Mecánico, peor al final del día"],
    irradiacion: ["No irradia", "Hacia el glúteo {lado}, sin pasar de la rodilla"],
    evolucion: ["Ha mejorado algo con reposo relativo pero vuelve con la actividad.", "Estable, con días mejores y peores.", "Algo mejor que al principio, pero sigue limitándole."],
    pruebas: ["No aporta pruebas de imagen.", "RX lumbar del médico de cabecera sin hallazgos relevantes.", "Ninguna, el médico le recomendó fisioterapia."],
    inspeccion: ["Postura antiálgica leve en bipedestación.", "Sin alteraciones posturales llamativas.", "Ligera rectificación de la lordosis lumbar."],
    palpacion: ["Hipertonía paravertebral lumbar bilateral, más a la {lado}.", "Dolor a la presión en L4-L5 y en la musculatura paravertebral.", "Sensibilidad en cuadrado lumbar {lado}."],
    movilidad: ["Flexión limitada por dolor (dedos a 20 cm del suelo). Extensión conservada.", "Flexión y rotación hacia la {lado} dolorosas al final del recorrido."],
    balance: ["Fuerza de miembros inferiores conservada. Poca resistencia de la musculatura del tronco.", "Glúteo medio algo débil a la {lado} (4/5)."],
    marcha: ["Marcha normal.", "Marcha normal, algo rígida al levantarse."],
    diagnostico: [
      "Dolor lumbar inespecífico de perfil mecánico, con miedo al movimiento leve y baja tolerancia a estar sentado.",
      "Lumbalgia mecánica con preferencia direccional en extensión y buena respuesta a la carga progresiva.",
    ],
    estructuras: "Musculatura paravertebral lumbar, articulaciones facetarias L4-L5",
    cif: ["b28013.2", "b7101.1", "d4105.22", "d4153.2", "d850.1", "e1101+1"],
    objetivosCorto: ["Reducir el dolor a 3/10 y aguantar sentado una hora.", "Volver a agacharse sin miedo."],
    objetivosLargo: ["Volver a su actividad laboral y deportiva sin limitación.", "Saber manejar un nuevo episodio por su cuenta."],
    plan: [
      "Educación en dolor, ejercicio terapéutico progresivo (control motor y fuerza de tronco y cadera), terapia manual los primeros días y pautas de actividad.",
      "Terapia manual, ejercicio de extensión según preferencia direccional, fuerza de glúteos y caminar a diario.",
    ],
    sesiones: [6, 10],
    tests: /inestabilidad lumbar|centralizaci|reglas de tratamiento|movilidad/i,
    questionnaires: ["odi", "rmdq", "tsk11"],
    rom: [],
    psfs: ["Estar sentado en el trabajo", "Agacharse a coger algo del suelo", "Jugar con mis hijos", "Conducir más de una hora"],
    tratamiento: [
      "Movilización lumbar en decúbito lateral, ejercicios de control motor en cuadrupedia, puente de glúteos 3x12.",
      "Masaje paravertebral, extensiones en prono (McKenzie) 3x10, peso muerto con mancuerna ligera.",
      "Educación en dolor (la espalda es fuerte), sentadilla a cajón 3x10, plancha lateral 3x20 s.",
      "Ejercicio de fuerza de tronco y cadera, caminar 30 minutos en días alternos.",
    ],
    consents: ["general"],
  },
  {
    id: "cervicalgia",
    title: "Cervicalgia",
    regions: ["cervical"],
    sided: false,
    zones: ["cervical", "hombro_x"],
    age: [24, 62],
    motivo: [
      "Dolor de cuello y tensión en los trapecios desde que teletrabaja muchas horas con el portátil.",
      "Cuello cargado y dolor al girar la cabeza al conducir.",
      "Dolor cervical con dolor de cabeza en la nuca al final del día.",
    ],
    inicio: ["Hace 2 meses", "Hace 3 semanas", "Desde hace más de 6 meses, con temporadas"],
    forma: ["Progresivo", "Progresivo, con épocas de más trabajo"],
    localizacion: ["Cervical baja y trapecio {lado}", "Nuca y zona entre cuello y hombros", "Cervical, a los dos lados"],
    tipo: ["Tirantez y peso", "Sordo, como una contractura", "Molestia continua que aumenta con la postura"],
    agravantes: ["Ordenador, mirar el móvil, conducir.", "Girar la cabeza hacia la {lado}, estar mucho rato quieto.", "Estrés y pocas horas de descanso."],
    atenuantes: ["Calor, moverse, fines de semana.", "Estirar y masaje.", "Cambiar de postura con frecuencia."],
    ritmo: ["Mecánico", "Mecánico, peor por la tarde"],
    irradiacion: ["No irradia", "Hacia el trapecio {lado}", "Hacia la zona occipital"],
    evolucion: ["Va y viene según la carga de trabajo.", "Algo peor en las últimas semanas."],
    pruebas: ["Ninguna.", "No aporta pruebas."],
    inspeccion: ["Cabeza adelantada y hombros enrollados.", "Postura cifótica en sedestación."],
    palpacion: ["Puntos sensibles en trapecio superior y elevador de la escápula {lado}.", "Hipertonía suboccipital bilateral."],
    movilidad: ["Rotación hacia la {lado} limitada y dolorosa al final.", "Flexión y rotaciones conservadas, extensión molesta."],
    balance: ["Flexores profundos del cuello con poca resistencia (test de flexión craneocervical bajo).", "Fuerza de miembros superiores conservada."],
    marcha: ["Sin alteraciones."],
    diagnostico: [
      "Dolor cervical mecánico asociado a postura mantenida y baja tolerancia a la carga de la musculatura cervicoescapular.",
      "Cervicalgia con componente de cefalea cervicogénica, sin signos neurológicos.",
    ],
    estructuras: "Musculatura cervical posterior y trapecio superior, articulaciones cervicales bajas",
    cif: ["b28010.2", "b7100.1", "d4158.1", "d4751.1", "d850.1", "e1150+2"],
    objetivosCorto: ["Reducir el dolor durante la jornada laboral.", "Recuperar la rotación completa del cuello."],
    objetivosLargo: ["Trabajar con el ordenador sin dolor.", "Mantener un programa de ejercicio por su cuenta."],
    plan: [
      "Terapia manual cervical y dorsal, ejercicio de flexores profundos y de la musculatura escapular, pautas ergonómicas.",
      "Ejercicio terapéutico progresivo, educación sobre carga y pausas activas en el trabajo.",
    ],
    sesiones: [5, 8],
    tests: /cefalea|control motor/i,
    questionnaires: ["ndi", "tsk11"],
    rom: [
      { movement: "neck_rotation", start: 58, gain: 14 },
      { movement: "neck_extension", start: 45, gain: 10 },
    ],
    psfs: ["Trabajar con el ordenador", "Conducir y mirar por el retrovisor", "Dormir de lado", "Leer en el sofá"],
    tratamiento: [
      "Movilización dorsal en prono, masaje de trapecio, flexores profundos 10x10 s.",
      "Ejercicio escapular con banda elástica (remo y rotación externa) 3x12.",
      "Pausas activas: retracción cervical y movilidad dorsal cada hora.",
      "Fuerza de trapecio inferior y serrato, revisión del puesto de trabajo.",
    ],
    consents: ["general"],
  },
  {
    id: "hombro",
    title: "Hombro doloroso",
    regions: ["hombro"],
    sided: true,
    zones: ["hombro_x", "brazo_x"],
    age: [35, 72],
    motivo: [
      "Dolor en el hombro {lado} al levantar el brazo, sobre todo al tender la ropa o coger cosas de un armario alto.",
      "Dolor de hombro {lado} desde que empezó a pintar la casa. Le molesta tumbarse sobre ese lado.",
      "Dolor en la cara externa del hombro {lado} al jugar al pádel.",
    ],
    inicio: ["Hace 2 meses", "Hace 6 semanas", "Hace 4 meses"],
    forma: ["Progresivo", "Progresivo, tras un esfuerzo"],
    localizacion: ["Cara anterolateral del hombro {lado}", "Hombro {lado}, cara externa, hacia el deltoides"],
    tipo: ["Punzante al elevar el brazo", "Sordo, con pinchazos al hacer ciertos gestos"],
    agravantes: ["Elevar el brazo por encima de la cabeza, ponerse la chaqueta.", "Tumbarse sobre el hombro {lado}, cargar bolsas.", "Gesto de remate en el pádel."],
    atenuantes: ["Reposo del brazo, hielo.", "Dejar de hacer deporte unos días."],
    ritmo: ["Mecánico"],
    irradiacion: ["Hacia el deltoides, sin pasar del codo", "No irradia"],
    evolucion: ["Sin cambios desde el inicio.", "Ha mejorado algo con antiinflamatorios pero vuelve con el esfuerzo."],
    pruebas: ["Ecografía: tendinopatía del supraespinoso sin rotura.", "No aporta pruebas.", "RX de hombro normal."],
    inspeccion: ["Escápula {lado} algo adelantada en reposo.", "Sin atrofias visibles."],
    palpacion: ["Dolor en la inserción del supraespinoso.", "Sensibilidad en troquíter y porción larga del bíceps."],
    movilidad: ["Arco doloroso entre 70° y 120° de abducción.", "Elevación completa con dolor al final, rotación interna algo limitada."],
    balance: ["Rotación externa resistida dolorosa y algo débil (4/5).", "Abducción resistida dolorosa a 90°."],
    marcha: ["Sin alteraciones."],
    diagnostico: [
      "Dolor de hombro relacionado con el manguito rotador, con baja tolerancia a la carga por encima de la cabeza.",
      "Tendinopatía del supraespinoso con discinesia escapular leve.",
    ],
    estructuras: "Tendón del supraespinoso, bursa subacromial, musculatura escapular",
    cif: ["b28014.2", "b7100.1", "b7300.1", "s7202.1", "d4452.2", "d6400.1", "d9201.2"],
    objetivosCorto: ["Elevar el brazo sin dolor hasta la altura del hombro.", "Dormir sobre el lado {lado}."],
    objetivosLargo: ["Volver a jugar al pádel.", "Hacer las tareas de casa sin limitación."],
    plan: [
      "Ejercicio de carga progresiva del manguito y la escápula, terapia manual y pautas de actividad.",
      "Isométricos al principio, después fuerza progresiva en rotación externa y elevación; vuelta al deporte por fases.",
    ],
    sesiones: [8, 12],
    tests: /manguito|subacromial|rotador|choque/i,
    questionnaires: ["spadi", "quickdash"],
    rom: [
      { movement: "shoulder_flexion", start: 130, gain: 35 },
      { movement: "shoulder_external_rotation", start: 55, gain: 25 },
    ],
    psfs: ["Tender la ropa", "Coger cosas de un armario alto", "Jugar al pádel", "Peinarme"],
    tratamiento: [
      "Isométricos de rotación externa 5x30 s, movilización glenohumeral, control escapular.",
      "Rotación externa con banda 3x15, elevación en plano escapular con mancuerna de 1 kg.",
      "Fuerza excéntrica de rotadores, press militar con poca carga, punción seca en infraespinoso.",
      "Pliometría ligera con balón, gesto deportivo progresivo.",
    ],
    consents: ["general", "invasiva"],
  },
  {
    id: "esguince",
    title: "Esguince de tobillo",
    regions: ["tobillo_pie"],
    sided: true,
    zones: ["pie_x"],
    age: [16, 45],
    sport: true,
    motivo: [
      "Torcedura del tobillo {lado} hacia dentro jugando al fútbol sala. Se hinchó la cara externa.",
      "Esguince de tobillo {lado} al bajar un bordillo. Sigue con molestias al correr.",
      "Ha tenido varios esguinces del tobillo {lado} y nota que le falla en terreno irregular.",
    ],
    inicio: ["Hace 2 semanas", "Hace 10 días", "Hace un mes"],
    forma: ["Súbito, mecanismo de inversión"],
    localizacion: ["Cara externa del tobillo {lado}", "Delante del maléolo externo {lado}"],
    tipo: ["Sordo, con pinchazos al apoyar", "Molestia y sensación de inestabilidad"],
    agravantes: ["Correr, cambios de dirección, terreno irregular.", "Bajar escaleras y estar mucho rato de pie."],
    atenuantes: ["Reposo, elevar el pie, hielo.", "Vendaje funcional."],
    ritmo: ["Mecánico"],
    irradiacion: ["No irradia"],
    evolucion: ["Mejorando, ya camina sin cojear.", "Le baja la inflamación, pero le falla al girar."],
    pruebas: ["RX en urgencias sin fractura.", "Ecografía: esguince del ligamento peroneoastragalino anterior grado II."],
    inspeccion: ["Edema leve perimaleolar externo.", "Equimosis en la cara externa del pie, ya amarillenta."],
    palpacion: ["Dolor en el ligamento peroneoastragalino anterior.", "Sin dolor en la base del quinto metatarsiano ni en el borde del maléolo."],
    movilidad: ["Flexión dorsal limitada respecto al otro lado.", "Inversión dolorosa al final del recorrido."],
    balance: ["Peroneos 4/5.", "Equilibrio unipodal peor que en el otro lado (12 s frente a 30 s)."],
    marcha: ["Marcha con leve cojera al principio, ya normal.", "Marcha normal; le cuesta caminar de puntillas."],
    diagnostico: [
      "Esguince lateral de tobillo grado II en fase subaguda, con déficit de flexión dorsal y de control postural.",
      "Inestabilidad funcional de tobillo tras esguinces de repetición.",
    ],
    estructuras: "Ligamento peroneoastragalino anterior, peroneos",
    cif: ["b28015.2", "b7150.2", "b7600.1", "s75021.111", "d4552.3", "d9201.3"],
    objetivosCorto: ["Recuperar la flexión dorsal completa.", "Equilibrio en un pie igual que el otro lado."],
    objetivosLargo: ["Volver a entrenar y jugar sin vendaje.", "Prevenir un nuevo esguince."],
    plan: [
      "Movilidad, fuerza de peroneos y gemelos, propiocepción progresiva y vuelta al deporte por fases con criterios.",
      "Terapia manual articular, ejercicios de equilibrio y saltos progresivos.",
    ],
    sesiones: [6, 10],
    tests: /esguince|inestabilidad|sindesmosis/i,
    questionnaires: ["faam", "lefs"],
    rom: [{ movement: "ankle_lunge", start: 30, gain: 9 }],
    psfs: ["Correr", "Cambios de dirección", "Bajar escaleras", "Jugar al fútbol sala"],
    tratamiento: [
      "Movilización talocrural con cinta, equilibrio unipodal en suelo estable 3x30 s.",
      "Elevaciones de talón 3x15, fuerza de peroneos con banda, equilibrio sobre cojín.",
      "Saltos a la comba, saltos laterales, carrera suave en recta.",
      "Cambios de dirección progresivos, test de salto y pautas de prevención.",
    ],
    consents: ["general"],
  },
  {
    id: "rotuliana",
    title: "Tendinopatía rotuliana",
    regions: ["rodilla"],
    sided: true,
    femenino: true,
    zones: ["rodilla_x"],
    age: [17, 38],
    sport: true,
    motivo: [
      "Dolor debajo de la rótula de la rodilla {lado} al saltar. Juega al voleibol 3 días a la semana.",
      "Dolor en la parte delantera de la rodilla {lado} al empezar a correr y al subir escaleras.",
    ],
    inicio: ["Hace 3 meses", "Hace 5 semanas", "Desde el inicio de la temporada"],
    forma: ["Progresivo, al subir la carga de entrenamiento"],
    localizacion: ["Polo inferior de la rótula {lado}", "Tendón rotuliano {lado}"],
    tipo: ["Punzante al saltar, sordo después", "Molestia que calienta y vuelve en frío"],
    agravantes: ["Saltar, sentadilla profunda, subir escaleras.", "Estar mucho rato sentado con la rodilla doblada."],
    atenuantes: ["Reposo, hielo después de entrenar.", "Calentar bien."],
    ritmo: ["Mecánico, ligado a la carga"],
    irradiacion: ["No irradia"],
    evolucion: ["Va a más con los partidos.", "Igual desde el inicio."],
    pruebas: ["Ecografía: engrosamiento del tendón rotuliano proximal.", "No aporta pruebas."],
    inspeccion: ["Sin derrame articular.", "Atrofia leve del cuádriceps {lado}."],
    palpacion: ["Dolor en el polo inferior de la rótula.", "Tendón rotuliano engrosado y sensible."],
    movilidad: ["Flexión y extensión completas.", "Flexión completa con molestia al final."],
    balance: ["Sentadilla unipodal dolorosa a 60°.", "Cuádriceps {lado} con menos fuerza que el otro."],
    marcha: ["Normal."],
    diagnostico: ["Tendinopatía rotuliana reactiva por aumento de la carga de saltos.", "Tendinopatía rotuliana con baja capacidad del cuádriceps."],
    estructuras: "Tendón rotuliano proximal, cuádriceps",
    cif: ["b28015.2", "b7300.1", "s75011.172", "d4552.2", "d9201.3"],
    objetivosCorto: ["Bajar el dolor al saltar a 3/10.", "Mejorar la fuerza del cuádriceps."],
    objetivosLargo: ["Volver a competir sin dolor."],
    plan: ["Isométricos analgésicos, fuerza lenta y pesada, después pliometría y vuelta progresiva al deporte."],
    sesiones: [8, 12],
    tests: /rotuliana|femoropatelar/i,
    questionnaires: ["visa_p", "lefs"],
    rom: [],
    psfs: ["Saltar", "Subir escaleras", "Sentadilla", "Correr"],
    tratamiento: [
      "Isométricos en prensa 5x45 s, educación sobre la carga.",
      "Sentadilla búlgara lenta 4x8, extensión de rodilla en máquina 4x10.",
      "Pliometría baja (saltos a cajón), carrera progresiva.",
      "Saltos con cambio de dirección, vuelta al entrenamiento de equipo.",
    ],
    consents: ["general", "invasiva"],
  },
  {
    id: "lca",
    title: "Reconstrucción del cruzado anterior",
    regions: ["rodilla"],
    sided: true,
    femenino: true,
    zones: ["rodilla_x", "muslo_x"],
    age: [18, 35],
    sport: true,
    motivo: ["Rehabilitación tras la reconstrucción del ligamento cruzado anterior de la rodilla {lado} (plastia de isquiotibiales).", "Viene derivado del traumatólogo tras plastia de LCA de la rodilla {lado} con hueso-tendón-hueso."],
    inicio: ["Operado hace 3 semanas", "Operado hace 2 meses", "Operado hace 4 meses"],
    forma: ["Lesión en un cambio de dirección jugando al fútbol"],
    localizacion: ["Rodilla {lado}, cara anterior e interna"],
    tipo: ["Rigidez y molestia al doblar"],
    agravantes: ["Doblar la rodilla del todo, bajar escaleras.", "Estar mucho rato de pie."],
    atenuantes: ["Hielo y elevar la pierna."],
    ritmo: ["Mecánico"],
    irradiacion: ["No irradia"],
    evolucion: ["Buena evolución postoperatoria, ya camina sin muletas.", "Le cuesta ganar la flexión."],
    pruebas: ["RM previa: rotura completa del LCA. Informe quirúrgico aportado."],
    inspeccion: ["Cicatrices quirúrgicas bien cerradas.", "Derrame leve, atrofia del cuádriceps."],
    palpacion: ["Sin signos de complicación.", "Calor local leve."],
    movilidad: ["Flexión 110°, extensión completa.", "Falta de extensión de 3°, flexión 95°."],
    balance: ["Cuádriceps débil, le cuesta la extensión activa completa.", "Fuerza de cuádriceps al 60 % del otro lado."],
    marcha: ["Marcha sin muletas con poca extensión en el apoyo.", "Marcha normal."],
    diagnostico: ["Postoperatorio de reconstrucción de LCA en fase de recuperación de movilidad y fuerza.", "Postoperatorio de LCA con déficit de fuerza del cuádriceps."],
    estructuras: "Plastia de LCA, cuádriceps, isquiotibiales",
    cif: ["b28015.2", "b7100.2", "b7301.3", "s75011.373", "d4552.4", "d9201.4"],
    objetivosCorto: ["Extensión completa y flexión de 120°.", "Caminar sin cojera."],
    objetivosLargo: ["Volver al fútbol a partir del noveno mes con los criterios de vuelta al deporte."],
    plan: ["Protocolo por fases con criterios: movilidad, activación del cuádriceps, fuerza, carrera, saltos y vuelta al deporte."],
    sesiones: [12, 20],
    tests: /cruzado anterior|derrame/i,
    questionnaires: ["acl_rsi", "lysholm"],
    rom: [],
    psfs: ["Bajar escaleras", "Correr", "Ponerme en cuclillas", "Jugar al fútbol"],
    tratamiento: [
      "Movilidad en flexión, activación del cuádriceps con electroestimulación, extensión pasiva.",
      "Prensa 4x10, puente con una pierna, bici estática 15 min.",
      "Sentadilla, peso muerto rumano, equilibrio unipodal con perturbaciones.",
      "Carrera en cinta, saltos bipodales, trabajo de cambio de dirección.",
    ],
    consents: ["general", "electroterapia"],
  },
  {
    id: "epicondilalgia",
    title: "Epicondilalgia lateral",
    regions: ["codo"],
    sided: true,
    zones: ["codo_x", "antebrazo_x"],
    age: [32, 60],
    motivo: ["Dolor en la parte externa del codo {lado} al coger objetos con la mano. Trabaja de carpintero.", "Dolor en el codo {lado} desde que juega más al pádel. Le duele al abrir botes."],
    inicio: ["Hace 2 meses", "Hace 4 meses", "Hace 6 semanas"],
    forma: ["Progresivo"],
    localizacion: ["Epicóndilo {lado} y musculatura extensora del antebrazo"],
    tipo: ["Punzante al agarrar"],
    agravantes: ["Agarrar, girar llaves, levantar una taza.", "Golpe de revés en el pádel."],
    atenuantes: ["Reposo de la mano.", "Hielo."],
    ritmo: ["Mecánico"],
    irradiacion: ["Hacia el antebrazo, por la cara dorsal"],
    evolucion: ["Va a más con el trabajo.", "Estable, con días peores."],
    pruebas: ["Ecografía: tendinopatía de los extensores comunes.", "No aporta pruebas."],
    inspeccion: ["Sin alteraciones."],
    palpacion: ["Dolor a la presión en el epicóndilo.", "Puntos sensibles en el extensor radial corto del carpo."],
    movilidad: ["Movilidad del codo completa."],
    balance: ["Fuerza de prensión menor en el lado {lado} y con dolor.", "Extensión resistida de muñeca dolorosa."],
    marcha: ["Sin alteraciones."],
    diagnostico: ["Epicondilalgia lateral por sobrecarga de la musculatura extensora."],
    estructuras: "Tendón común de los extensores, extensor radial corto del carpo",
    cif: ["b28014.2", "b7300.1", "s73001.171", "d4401.2", "d850.2"],
    objetivosCorto: ["Agarrar sin dolor objetos ligeros."],
    objetivosLargo: ["Trabajar toda la jornada sin dolor.", "Volver al pádel."],
    plan: ["Carga progresiva de la musculatura extensora (isométricos, excéntricos y concéntricos), terapia manual y ajuste de la carga en el trabajo."],
    sesiones: [6, 10],
    tests: /epicondilalgia lateral/i,
    questionnaires: ["quickdash"],
    rom: [],
    psfs: ["Agarrar herramientas", "Abrir botes", "Jugar al pádel"],
    tratamiento: [
      "Isométricos de extensión de muñeca 5x45 s, masaje de los extensores.",
      "Excéntricos de muñeca con mancuerna 3x15, ejercicio de prensión.",
      "Punción seca en extensor radial corto del carpo, fuerza de hombro y escápula.",
    ],
    consents: ["general", "invasiva"],
  },
  {
    id: "tunel",
    title: "Síndrome del túnel carpiano",
    regions: ["muneca_mano"],
    sided: true,
    femenino: true,
    zones: ["mano_x"],
    age: [38, 70],
    motivo: ["Hormigueo en los dedos pulgar, índice y medio de la mano {lado}, sobre todo al conducir y al despertarse.", "Adormecimiento de la mano {lado} al usar el ratón y al coser."],
    inicio: ["Hace 3 meses", "Hace 6 meses"],
    forma: ["Progresivo"],
    localizacion: ["Palma y tres primeros dedos de la mano {lado}"],
    tipo: ["Hormigueo y adormecimiento"],
    agravantes: ["Conducir, sujetar el móvil, coser.", "Doblar la muñeca mucho rato."],
    atenuantes: ["Sacudir la mano.", "Férula por la noche."],
    ritmo: ["Mecánico, también al despertar"],
    irradiacion: ["A los tres primeros dedos"],
    evolucion: ["Igual desde hace meses.", "Algo mejor con la férula."],
    pruebas: ["Electromiograma: afectación leve del nervio mediano en el carpo.", "Pendiente de electromiograma."],
    inspeccion: ["Sin atrofia de la eminencia tenar."],
    palpacion: ["Sin dolor a la palpación del carpo."],
    movilidad: ["Movilidad de muñeca completa."],
    balance: ["Abductor corto del pulgar 5/5."],
    marcha: ["Sin alteraciones."],
    diagnostico: ["Síndrome del túnel carpiano leve, con síntomas posturales y nocturnos."],
    estructuras: "Nervio mediano en el carpo",
    cif: ["b265.1", "b28014.1", "s73011.121", "d4402.2", "d4751.1"],
    objetivosCorto: ["Reducir los episodios de hormigueo."],
    objetivosLargo: ["Conducir y coser sin síntomas."],
    plan: ["Educación, férula nocturna en posición neutra, deslizamientos neurales y tendinosos, y control de la carga."],
    sesiones: [4, 8],
    tests: /túnel carpiano/i,
    questionnaires: ["quickdash"],
    rom: [],
    psfs: ["Conducir", "Coser", "Usar el ratón"],
    tratamiento: [
      "Deslizamientos del nervio mediano 3x10, deslizamientos tendinosos, educación.",
      "Movilización de los huesos del carpo, revisión de la férula.",
      "Ejercicio de fuerza de la mano y pautas en el trabajo.",
    ],
    consents: ["general"],
  },
  {
    id: "fascitis",
    title: "Fascitis plantar",
    regions: ["tobillo_pie"],
    sided: true,
    zones: ["pie_x"],
    age: [35, 65],
    motivo: ["Dolor en el talón {lado} al dar los primeros pasos por la mañana.", "Dolor en la planta del pie {lado} al caminar mucho rato. Trabaja de pie en un comercio."],
    inicio: ["Hace 3 meses", "Hace 5 meses"],
    forma: ["Progresivo"],
    localizacion: ["Talón {lado}, cara interna y plantar"],
    tipo: ["Punzante con los primeros pasos, después sordo"],
    agravantes: ["Primeros pasos de la mañana, estar de pie mucho rato, caminar descalzo."],
    atenuantes: ["Calzado con buena amortiguación, estirar."],
    ritmo: ["Mecánico, con rigidez matutina"],
    irradiacion: ["No irradia"],
    evolucion: ["Igual desde hace semanas.", "Va mejorando poco a poco."],
    pruebas: ["Ecografía: engrosamiento de la fascia plantar.", "No aporta pruebas."],
    inspeccion: ["Pie algo pronado en carga."],
    palpacion: ["Dolor en la inserción de la fascia en el calcáneo."],
    movilidad: ["Flexión dorsal algo limitada por el gemelo."],
    balance: ["Elevaciones de talón con una pierna: 12 en el lado {lado} frente a 20 en el otro."],
    marcha: ["Normal, algo de cojera al levantarse."],
    diagnostico: ["Fasciopatía plantar con baja capacidad de la musculatura de la pantorrilla."],
    estructuras: "Fascia plantar, tríceps sural",
    cif: ["b28015.2", "b7300.1", "s75023.1", "d4500.2", "d4154.2"],
    objetivosCorto: ["Bajar el dolor matutino a 2/10."],
    objetivosLargo: ["Trabajar de pie la jornada entera sin dolor."],
    plan: ["Fuerza de la musculatura del pie y la pantorrilla con carga progresiva, estiramiento de la fascia y consejo de calzado."],
    sesiones: [5, 8],
    tests: /fascitis|gemelo/i,
    questionnaires: ["faam", "lefs"],
    rom: [{ movement: "ankle_lunge", start: 32, gain: 6 }],
    psfs: ["Caminar al levantarme", "Estar de pie en el trabajo", "Pasear"],
    tratamiento: [
      "Elevación de talón con toalla bajo los dedos (Rathleff) 3x12, estiramiento de la fascia.",
      "Fuerza de musculatura intrínseca del pie, masaje plantar.",
      "Progresión de carga con mochila, pautas de calzado.",
    ],
    consents: ["general"],
  },
  {
    id: "gluteo",
    title: "Dolor lateral de cadera",
    regions: ["cadera"],
    sided: true,
    femenino: true,
    zones: ["ingle_x", "gluteo_x"],
    age: [42, 70],
    motivo: ["Dolor en la parte externa de la cadera {lado} al tumbarse sobre ese lado y al subir escaleras.", "Dolor en la cara lateral de la cadera {lado} al caminar más de media hora."],
    inicio: ["Hace 4 meses", "Hace más de medio año"],
    forma: ["Progresivo"],
    localizacion: ["Trocánter mayor {lado}"],
    tipo: ["Sordo, a veces punzante"],
    agravantes: ["Tumbarse de lado, cruzar las piernas, subir escaleras."],
    atenuantes: ["Una almohada entre las rodillas para dormir."],
    ritmo: ["Mecánico"],
    irradiacion: ["Por la cara lateral del muslo, sin pasar de la rodilla"],
    evolucion: ["Va a más.", "Sin cambios."],
    pruebas: ["Ecografía: tendinopatía del glúteo medio.", "No aporta pruebas."],
    inspeccion: ["Ligero Trendelenburg en apoyo unipodal {lado}."],
    palpacion: ["Dolor a la presión en el trocánter mayor."],
    movilidad: ["Movilidad de cadera completa; aducción dolorosa al final."],
    balance: ["Abducción de cadera {lado} 4/5 y dolorosa."],
    marcha: ["Marcha con leve descenso de la pelvis al apoyar el lado {lado}."],
    diagnostico: ["Tendinopatía glútea con compresión del tendón en aducción."],
    estructuras: "Tendones del glúteo medio y menor",
    cif: ["b28015.2", "b7301.1", "s7402.1", "d4551.2", "d4500.2"],
    objetivosCorto: ["Dormir sobre el lado {lado}."],
    objetivosLargo: ["Caminar una hora sin dolor."],
    plan: ["Educación sobre posturas que comprimen el tendón, isométricos y fuerza progresiva de abductores."],
    sesiones: [6, 10],
    tests: /tendinopatía glútea|trocant/i,
    questionnaires: ["lefs"],
    rom: [{ movement: "hip_internal_rotation", start: 28, gain: 6 }],
    psfs: ["Subir escaleras", "Dormir de lado", "Caminar una hora"],
    tratamiento: [
      "Isométricos de abducción en decúbito supino 5x45 s, educación.",
      "Puente lateral, sentadilla a cajón, step-up 3x10.",
      "Fuerza de abductores con banda, caminar en cuesta.",
    ],
    consents: ["general"],
  },
  {
    id: "dorsal",
    title: "Dolor dorsal",
    regions: ["dorsal"],
    sided: false,
    zones: ["dorsal", "escapula_x"],
    age: [22, 55],
    motivo: ["Dolor entre las escápulas al final de la jornada. Trabaja muchas horas sentado.", "Dolor dorsal al respirar hondo después de un día de mudanza."],
    inicio: ["Hace un mes", "Hace 2 semanas"],
    forma: ["Progresivo", "Súbito"],
    localizacion: ["Zona interescapular"],
    tipo: ["Sordo, de carga"],
    agravantes: ["Estar sentado, girar el tronco."],
    atenuantes: ["Moverse, calor."],
    ritmo: ["Mecánico"],
    irradiacion: ["No irradia"],
    evolucion: ["Mejorando."],
    pruebas: ["No aporta pruebas."],
    inspeccion: ["Aumento de la cifosis dorsal."],
    palpacion: ["Sensibilidad en romboides y paravertebrales dorsales."],
    movilidad: ["Rotación dorsal limitada a la {lado}."],
    balance: ["Trapecio medio e inferior con poca resistencia."],
    marcha: ["Sin alteraciones."],
    diagnostico: ["Dolor dorsal mecánico por sobrecarga postural."],
    estructuras: "Musculatura interescapular, articulaciones costovertebrales",
    cif: ["b28013.2", "b7100.1", "d4158.1", "d850.1"],
    objetivosCorto: ["Terminar la jornada sin dolor."],
    objetivosLargo: ["Mantener ejercicio de fuerza dos veces por semana."],
    plan: ["Terapia manual dorsal y costal, ejercicio de movilidad y fuerza de la musculatura escapular."],
    sesiones: [3, 6],
    tests: /movilidad torácica|costillas/i,
    questionnaires: ["tsk11"],
    rom: [],
    psfs: ["Trabajar sentado", "Girarme en la cama"],
    tratamiento: ["Movilización dorsal, ejercicios de rotación torácica 3x10.", "Remo con banda 3x15, movilidad con foam roller."],
    consents: ["general"],
  },
  {
    id: "atm",
    title: "Dolor de la articulación temporomandibular",
    regions: ["atm"],
    sided: true,
    femenino: true,
    zones: ["cabeza"],
    age: [22, 50],
    motivo: ["Dolor en la mandíbula {lado} al masticar y chasquido al abrir la boca.", "Aprieta los dientes por la noche y se levanta con la mandíbula cargada."],
    inicio: ["Hace 2 meses", "Hace 5 meses"],
    forma: ["Progresivo"],
    localizacion: ["Delante del oído {lado}, músculo masetero"],
    tipo: ["Sordo, de cansancio al masticar"],
    agravantes: ["Masticar alimentos duros, bostezar, épocas de estrés."],
    atenuantes: ["Dieta blanda, calor local."],
    ritmo: ["Mecánico, peor al levantarse"],
    irradiacion: ["Hacia la sien {lado}"],
    evolucion: ["Va y viene con el estrés."],
    pruebas: ["El dentista le ha hecho una férula de descarga."],
    inspeccion: ["Apertura con desviación hacia la {lado}."],
    palpacion: ["Dolor en masetero y temporal {lado}."],
    movilidad: ["Apertura de 38 mm."],
    balance: ["Sin alteraciones."],
    marcha: ["Sin alteraciones."],
    diagnostico: ["Dolor miofascial masticatorio con chasquido articular, relacionado con el apretamiento."],
    estructuras: "Músculos masetero y temporal, articulación temporomandibular",
    cif: ["b28010.2", "b5102.1", "d550.1"],
    objetivosCorto: ["Masticar sin dolor."],
    objetivosLargo: ["Saber controlar el apretamiento."],
    plan: ["Terapia manual de la musculatura masticatoria, ejercicios de control de la apertura y educación sobre hábitos."],
    sesiones: [4, 6],
    tests: /dolor muscular y articular|movilidad y desplazamiento/i,
    questionnaires: ["jfls8"],
    rom: [],
    psfs: ["Masticar carne", "Bostezar"],
    tratamiento: ["Masaje de masetero y temporal, ejercicios de apertura controlada.", "Educación sobre hábitos, relajación de la mandíbula."],
    consents: ["general"],
  },
];

// ---------- Datos personales y hábitos ----------

export const FEMALE = [
  "Lucía", "María", "Carmen", "Ana", "Laura", "Marta", "Sara", "Paula", "Elena", "Cristina", "Isabel", "Raquel", "Pilar", "Irene", "Nuria",
  "Alba", "Silvia", "Beatriz", "Rocío", "Patricia", "Noelia", "Teresa", "Eva", "Julia", "Claudia", "Rosa", "Inés", "Lorena", "Sonia", "Andrea",
];
export const MALE = [
  "Antonio", "Manuel", "José", "Francisco", "David", "Javier", "Daniel", "Carlos", "Miguel", "Alejandro", "Pablo", "Sergio", "Jorge", "Álvaro",
  "Rubén", "Adrián", "Diego", "Raúl", "Iván", "Alberto", "Fernando", "Luis", "Óscar", "Hugo", "Marcos", "Víctor", "Mario", "Andrés", "Ignacio", "Gonzalo",
];
export const SURNAMES = [
  "García", "Fernández", "González", "Rodríguez", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Martín", "Jiménez", "Ruiz", "Hernández",
  "Díaz", "Moreno", "Muñoz", "Álvarez", "Romero", "Alonso", "Gutiérrez", "Navarro", "Torres", "Domínguez", "Vázquez", "Ramos", "Gil", "Ramírez",
  "Serrano", "Blanco", "Molina", "Morales", "Suárez", "Ortega", "Delgado", "Castro", "Ortiz", "Rubio", "Marín", "Sanz", "Iglesias", "Medina",
  "Garrido", "Cortés", "Castillo", "Santos", "Lozano", "Guerrero", "Cano", "Prieto", "Méndez", "Cruz", "Calvo", "Gallego", "Vidal", "León",
];

export const PROFESSIONS = [
  "Administrativa", "Profesor de secundaria", "Enfermera", "Camarero", "Programador", "Dependienta", "Conductor de reparto", "Estudiante",
  "Jubilado", "Abogada", "Mecánico", "Cocinera", "Auxiliar de geriatría", "Arquitecto", "Teleoperadora", "Electricista", "Peluquera",
  "Carpintero", "Comercial", "Limpiadora", "Policía local", "Diseñadora gráfica", "Agricultor", "Farmacéutica",
];
export const DERIVED = ["Viene por su cuenta", "Médico de cabecera", "Traumatólogo", "Recomendación de otro paciente", "Mutua deportiva", "Viene por su cuenta"];
export const ACTIVITY = ["Caminar a diario", "Gimnasio 3 días por semana", "Pádel", "Correr", "Fútbol sala", "Natación", "Ciclismo", "Yoga", "Ninguna", "Senderismo"];
export const FREQUENCY = ["2 veces por semana", "3 veces por semana", "A diario", "Los fines de semana", "Poco, de vez en cuando"];
export const POSTURE = ["Sentado con ordenador", "De pie casi toda la jornada", "Trabajo físico con cargas", "Conduce muchas horas", "Alterna sentado y de pie"];
export const HABITS = ["No fuma, alcohol ocasional", "No fuma ni bebe", "Fuma 10 cigarrillos al día", "Exfumador, alcohol los fines de semana"];
export const SLEEP = ["Duerme bien, 7-8 horas", "Duerme unas 6 horas, se despierta descansado", "Le cuesta conciliar el sueño en épocas de trabajo", "Sueño reparador"];
export const STRESS = ["Bajo", "Moderado por el trabajo", "Alto en los últimos meses por cuidados familiares", "Moderado"];
export const DISEASES = ["Sin enfermedades de interés.", "Hipercolesterolemia en tratamiento.", "Asma leve.", "Hipotiroidismo en tratamiento.", "Migrañas ocasionales.", "Sin antecedentes de interés."];
export const SURGERIES = ["No refiere.", "Apendicectomía de pequeño.", "Menisectomía en la otra rodilla hace años.", "Cesárea.", "No refiere."];
export const PREVIOUS = ["No refiere.", "Fractura de muñeca de pequeño, sin secuelas.", "Esguince de tobillo hace años.", "No refiere."];
export const MEDICATION = ["Ninguna.", "Ibuprofeno a demanda.", "Paracetamol cuando le duele.", "Levotiroxina.", "Anticonceptivos orales.", "Estatinas."];
export const ALLERGIES = ["No conocidas", "Penicilina", "Ácaros", "No conocidas"];
export const FAMILY = ["Sin antecedentes familiares de interés.", "Madre con artrosis de rodillas.", "Padre con artrosis de cadera.","Madre con osteoporosis."];
export const PREV_PHYSIO = ["Ninguna.", "Hace dos años por otro problema, le fue bien.", "Unas sesiones de masaje que le aliviaron unos días.", "Ninguna para este problema."];
export const OTHER_TREATMENTS = ["Antiinflamatorios unos días.", "Ninguno.", "Calor y reposo.", "Le recomendaron estiramientos en internet."];
export const RESPONSE = ["Alivio pasajero.", "Le ayudó moverse más que el reposo.", "Sin cambios.", "Mejoró con el calor."];
export const BELIEFS = [
  "Cree que es por la postura en el trabajo.", "Piensa que tiene algo desgastado.", "Lo relaciona con el aumento del deporte.",
  "No sabe por qué le pasa y le preocupa.", "Cree que es una contractura.",
];
export const EXPECTATIONS = ["Quiere mejorar en pocas semanas y aprender qué hacer.", "Espera quitarse el dolor del todo.", "Quiere volver a su deporte cuanto antes.", "Quiere entender qué le pasa."];
export const OBSERVATIONS = ["Paciente colaborador y motivado.", "Disponibilidad solo por las tardes.", "Prefiere que le escriban por WhatsApp.", "Viene acompañado de su pareja."];

// ---------- Sesiones ----------

export const SUBJECTIVE = {
  early: ["Sigue con dolor parecido a la primera visita.", "Ha notado algo de alivio los días siguientes.", "Le molestó un poco después de la sesión, ya está mejor."],
  mid: ["Va mejor, ya hace más cosas sin dolor.", "Ha tenido un día peor por más carga de trabajo, pero en general mejor.", "Hace los ejercicios en casa casi todos los días."],
  late: ["Casi sin dolor en su día a día.", "Ya hace su actividad normal con alguna molestia puntual.", "Muy contento con la evolución."],
};
export const OBJECTIVE = ["Mejor movilidad que la sesión anterior.", "Menos dolor a la palpación.", "Tolera más carga en los ejercicios.", "Ejecuta bien los ejercicios."];
export const NEXT_PLAN = ["Progresar la carga.", "Mantener el programa y revisar en la próxima.", "Introducir gesto específico.", "Reducir frecuencia a una sesión por semana."];
export const RECOMMENDATIONS = ["Mantener el ejercicio de fuerza dos o tres veces por semana.", "Seguir activo y volver si reaparecen los síntomas.", "Progresar la carga de forma gradual."];

/** Los fisios de la clínica de prueba (correos de example.com, que no son de nadie). */
export const STAFF = [
  { email: "laura.ortega@example.com", name: "Laura Ortega" },
  { email: "javier.molina@example.com", name: "Javier Molina" },
  { email: "marta.iglesias@example.com", name: "Marta Iglesias" },
  { email: "pablo.serrano@example.com", name: "Pablo Serrano" },
  { email: "sara.cano@example.com", name: "Sara Cano" },
];
