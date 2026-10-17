import type { SpecialTest } from "../types";

const WAINNER = {
  source: "Wainner et al., 2003",
  citation:
    "Wainner RS, Fritz JM, Irrgang JJ, et al. Reliability and diagnostic accuracy of the clinical examination and patient self-report measures for cervical radiculopathy. Spine. 2003;28(1):52-62.",
};
const COOK_2010 = {
  source: "Cook et al., 2010",
  citation: "Cook C, et al. Clustered clinical findings for diagnosis of cervical spine myelopathy. Journal of Manual & Manipulative Therapy. 2010;18(4):175.",
};
const STIELL_2003 = {
  source: "Stiell et al., 2003",
  citation: "Stiell IG, Clement CM, McKnight RD, et al. The Canadian C-spine rule versus the NEXUS low-risk criteria in patients with trauma. New England Journal of Medicine. 2003;349:2510-2518.",
};

const RADICULO = "Radiculopatía cervical";
const MIELO = "Mielopatía cervical";
const INESTAB = "Inestabilidad cervical superior";
const CEFALEA = "Cefalea cervicogénica";
const CONTROL = "Control motor";
const TRAUMA = "Traumatismo cervical: ¿hace falta imagen?";
const VASCULAR = "Cribado vascular";

export const cervicalTests: SpecialTest[] = [
  // ───────────── Radiculopatía cervical ─────────────
  {
    id: "cer-spurling",
    region: "cervical",
    group: RADICULO,
    name: "Test de Spurling",
    aka: ["Compresión foraminal", "Spurling's test", "Spurling A"],
    kind: "test",
    purpose: "Reproducir el dolor radicular cerrando el agujero de conjunción del lado sintomático.",
    position: "Paciente sentado con la espalda apoyada. Examinador de pie detrás, con las manos entrelazadas sobre la cabeza.",
    steps: [
      "Lleva el cuello del paciente a inclinación lateral hacia el lado sintomático.",
      "Aplica una compresión axial suave y progresiva sobre la cabeza (unos 7 kg).",
      "Mantén unos segundos y pregunta qué nota y dónde.",
      "Si es negativo, puede añadirse extensión y rotación hacia el mismo lado (variante B).",
    ],
    positive: "Reaparece el dolor o las parestesias en el brazo con distribución dermatómica. El dolor local de cuello no cuenta.",
    interpretation:
      "Muy específico y poco sensible: un positivo apoya la radiculopatía, un negativo no la descarta. Combínalo con la distracción, el ULNT1 y la rotación (cluster de Wainner).",
    accuracy: [{ ...WAINNER, sens: 50, spec: 86, context: "Frente a estudio electrodiagnóstico (EMG). Variante con inclinación lateral (Spurling A)." }],
    utility: "moderada",
    cautions: "No lo hagas si hay sospecha de fractura, inestabilidad, mielopatía o tras un traumatismo reciente. Para en cuanto aparezcan síntomas en el brazo.",
    figures: [
      {
        view: "front",
        posture: "sitting",
        joints: { neck: 25 },
        hands: ["head"],
        arrows: [{ at: "head", dir: "caudal", label: "compresión" }],
        pain: ["r_upperarm@0.5", "r_forearm@0.6"],
        caption: "Inclinación hacia el lado sintomático y compresión axial.",
      },
    ],
    related: ["cer-distraccion", "cer-ulnt1-mediano", "cer-rotacion-60", "cer-cluster-wainner"],
  },
  {
    id: "cer-distraccion",
    region: "cervical",
    group: RADICULO,
    name: "Test de distracción cervical",
    aka: ["Neck distraction test", "Tracción axial manual"],
    kind: "test",
    purpose: "Ver si al abrir los agujeros de conjunción se alivian los síntomas radiculares.",
    position: "Paciente en decúbito supino (o sentado). Examinador a la cabecera, una mano bajo el occipital y otra en el mentón.",
    steps: [
      "Coloca el cuello en una posición cómoda, ligeramente flexionado.",
      "Aplica una tracción suave y progresiva en el eje del cuello (unos 14 kg).",
      "Mantén unos segundos y pregunta por el dolor del brazo.",
    ],
    positive: "Disminuyen o desaparecen el dolor o las parestesias del brazo durante la tracción.",
    interpretation:
      "Las revisiones lo describen como específico y poco sensible: un alivio claro apoya el origen radicular. Forma parte del cluster de Wainner; no lo uses solo para descartar.",
    accuracy: [],
    utility: "desconocida",
    cautions: "Evítalo si hay sospecha de inestabilidad cervical superior, traumatismo reciente o artritis reumatoide.",
    figures: [
      {
        view: "side",
        posture: "supine",
        joints: { neck: 10 },
        hands: ["head", "neck@0.9"],
        arrows: [{ at: "head", dir: "cranial", kind: "move", label: "tracción" }],
        pain: ["r_upperarm@0.5"],
        caption: "Tracción axial: se busca que el dolor del brazo se alivie.",
      },
    ],
    related: ["cer-spurling", "cer-cluster-wainner"],
  },
  {
    id: "cer-ulnt1-mediano",
    region: "cervical",
    group: RADICULO,
    name: "ULNT1 (sesgo mediano)",
    aka: ["ULTT A", "Upper limb neurodynamic test 1", "Test de tensión neural del miembro superior 1"],
    kind: "test",
    purpose: "Poner en tensión el plexo braquial y el nervio mediano para provocar síntomas neurógenos.",
    position: "Paciente en decúbito supino cerca del borde de la camilla. Examinador junto al brazo a explorar, mirando hacia la cabeza.",
    steps: [
      "Fija la cintura escapular hacia abajo (depresión) con una mano.",
      "Abduce el hombro a unos 110° con el codo flexionado.",
      "Supina el antebrazo y extiende muñeca y dedos; añade rotación externa del hombro.",
      "Extiende el codo poco a poco hasta que aparezcan síntomas.",
      "Diferenciación: pide inclinación del cuello hacia el lado contrario (aumenta) o hacia el mismo lado (alivia).",
    ],
    positive:
      "Reproduce los síntomas del paciente, hay asimetría de más de 10° de extensión de codo con el otro lado o los síntomas cambian con la inclinación del cuello.",
    interpretation:
      "Muy sensible y poco específico: un ULNT1 negativo hace improbable la radiculopatía. Revisiones posteriores dan valores más modestos, así que combínalo con Spurling, distracción y rotación.",
    accuracy: [
      { ...WAINNER, sens: 97, spec: 22, context: "Frente a estudio electrodiagnóstico (EMG)." },
      {
        source: "Koulidis et al., 2019",
        citation:
          "Koulidis K, et al. Diagnostic accuracy of upper limb neurodynamic tests for the assessment of peripheral neuropathic pain: a systematic review. Musculoskeletal Science and Practice. 2019.",
        sens: 97,
        context: "Revisión sistemática (8 estudios, calidad baja o muy baja) para radiculopatía cervical.",
      },
    ],
    utility: "alta",
    cautions: "Hazlo con suavidad y para al primer síntoma; no lo fuerces si hay síntomas neurológicos agudos o irritabilidad alta.",
    figures: [
      {
        view: "front",
        posture: "supine",
        joints: { r_shoulder: 105, r_elbow: 0 },
        to: { neck: -20 },
        hands: ["r_shoulder", "r_hand"],
        arrows: [
          { at: "r_shoulder", dir: "caudal", label: "depresión" },
          { at: "r_hand", dir: "posterior", label: "ext. muñeca" },
        ],
        pain: ["r_forearm@0.5"],
        caption: "Vista desde arriba. En discontinua, inclinación contralateral del cuello para sensibilizar.",
      },
    ],
    related: ["cer-ulnt2b-radial", "cer-ulnt3-cubital", "cer-cluster-wainner", "cer-spurling"],
  },
  {
    id: "cer-ulnt2b-radial",
    region: "cervical",
    group: RADICULO,
    name: "ULNT2b (sesgo radial)",
    aka: ["ULTT B", "Upper limb neurodynamic test 2b"],
    kind: "test",
    purpose: "Poner en tensión el nervio radial para provocar síntomas neurógenos en su territorio.",
    position: "Paciente en decúbito supino, en diagonal con el hombro fuera de la camilla. Examinador junto al brazo, con el muslo apoyado en la mano del paciente o en su hombro.",
    steps: [
      "Deprime la cintura escapular y mantenla.",
      "Extiende el codo y rota el hombro hacia dentro (rotación interna).",
      "Prona el antebrazo y flexiona muñeca, dedos y pulgar.",
      "Añade abducción del hombro poco a poco.",
      "Diferencia con la inclinación cervical o soltando la depresión escapular.",
    ],
    positive: "Reproduce los síntomas del paciente en la cara dorsorradial del antebrazo o la mano y cambian con la maniobra de diferenciación.",
    interpretation:
      "Sin datos de precisión comprobados. Úsalo como complemento del ULNT1 cuando los síntomas siguen el territorio radial; el conjunto de varios ULNT negativos ayuda a descartar.",
    accuracy: [],
    utility: "desconocida",
    cautions: "Movimiento combinado y algo incómodo: avanza despacio y para al primer síntoma.",
    figures: [
      {
        view: "front",
        posture: "supine",
        joints: { r_shoulder: 15, r_elbow: 0 },
        hands: ["r_shoulder", "r_hand"],
        arrows: [
          { at: "r_shoulder", dir: "caudal", label: "depresión" },
          { at: "r_forearm@0.6", rotate: "ccw", label: "RI + pron." },
        ],
        pain: ["r_forearm@0.4"],
        caption: "Depresión escapular, rotación interna, pronación y flexión de muñeca.",
      },
    ],
    related: ["cer-ulnt1-mediano", "cer-ulnt3-cubital"],
  },
  {
    id: "cer-ulnt3-cubital",
    region: "cervical",
    group: RADICULO,
    name: "ULNT3 (sesgo cubital)",
    aka: ["ULTT cubital", "Upper limb neurodynamic test 3"],
    kind: "test",
    purpose: "Poner en tensión el nervio cubital y las raíces C8-T1.",
    position: "Paciente en decúbito supino. Examinador junto al brazo, sujetando la mano y fijando el hombro.",
    steps: [
      "Extiende muñeca y dedos (sobre todo 4.º y 5.º) y prona el antebrazo.",
      "Flexiona el codo al máximo.",
      "Deprime la cintura escapular y abduce el hombro a unos 90°, con rotación externa.",
      "La mano del paciente queda cerca de su oreja («máscara»).",
      "Diferencia con la inclinación cervical.",
    ],
    positive: "Reproduce síntomas en el borde cubital del antebrazo y en los dedos 4.º y 5.º, y cambian con la maniobra de diferenciación.",
    interpretation:
      "Según la revisión de Koulidis fue el ULNT más específico; aun así la calidad de los estudios es baja. Útil como parte de la batería de ULNT, no como test aislado.",
    accuracy: [
      {
        source: "Koulidis et al., 2019",
        citation:
          "Koulidis K, et al. Diagnostic accuracy of upper limb neurodynamic tests for the assessment of peripheral neuropathic pain: a systematic review. Musculoskeletal Science and Practice. 2019.",
        spec: 87,
        context: "Revisión sistemática (8 estudios, calidad baja o muy baja); solo se comprobó la especificidad.",
      },
    ],
    utility: "desconocida",
    cautions: "Para al primer síntoma; cuidado si hay patología de codo o inestabilidad del nervio cubital.",
    figures: [
      {
        view: "front",
        posture: "supine",
        joints: { r_shoulder: 90, r_elbow: 125 },
        hands: ["r_shoulder", "r_hand"],
        arrows: [{ at: "r_shoulder", dir: "caudal", label: "depresión" }],
        pain: ["r_forearm@0.5", "r_hand"],
        caption: "Abducción, flexión de codo y extensión de muñeca: la mano hacia la oreja.",
      },
    ],
    related: ["cer-ulnt1-mediano", "cer-ulnt2b-radial"],
  },
  {
    id: "cer-rotacion-60",
    region: "cervical",
    group: RADICULO,
    name: "Rotación cervical activa < 60°",
    aka: ["Cervical rotation < 60°"],
    kind: "test",
    purpose: "Detectar la pérdida de rotación hacia el lado sintomático que acompaña a la radiculopatía.",
    position: "Paciente sentado, con la espalda recta. Examinador delante o al lado, con un goniómetro o inclinómetro.",
    steps: [
      "Pide al paciente que gire la cabeza todo lo que pueda hacia el lado sintomático.",
      "Mide el ángulo de rotación activa.",
      "Compara con el lado contrario.",
    ],
    positive: "Rotación activa hacia el lado sintomático menor de 60°.",
    interpretation:
      "Sensible pero poco específico: si la rotación supera 60° la radiculopatía es algo menos probable. Su valor está en el cluster de Wainner.",
    accuracy: [{ ...WAINNER, sens: 89, spec: 49, context: "Frente a estudio electrodiagnóstico (EMG)." }],
    utility: "moderada",
    figures: [
      {
        view: "front",
        posture: "sitting",
        arrows: [{ at: "head", rotate: "ccw", label: "rotación" }],
        caption: "Rotación activa hacia el lado sintomático; positivo si < 60°.",
      },
    ],
    related: ["cer-cluster-wainner"],
  },
  {
    id: "cer-abduccion-hombro",
    region: "cervical",
    group: RADICULO,
    name: "Signo de abducción del hombro (Bakody)",
    aka: ["Shoulder abduction relief sign", "Signo de Bakody"],
    kind: "test",
    purpose: "Ver si al acortar la tensión sobre las raíces C4-C6 se alivia el dolor del brazo.",
    position: "Paciente sentado. Examinador delante, observando.",
    steps: [
      "Pregunta por la intensidad del dolor del brazo.",
      "Pide al paciente que apoye la mano del lado afectado sobre la cabeza.",
      "Mantén unos 30 segundos y vuelve a preguntar.",
    ],
    positive: "El dolor radicular del brazo disminuye o desaparece al colocar la mano sobre la cabeza.",
    interpretation:
      "Las revisiones lo describen como poco sensible y bastante específico: un alivio claro apoya la radiculopatía (a menudo C5-C6). Los datos publicados son escasos y dispares.",
    accuracy: [],
    utility: "desconocida",
    figures: [
      {
        view: "front",
        posture: "sitting",
        joints: { r_shoulder: 150, r_elbow: 140 },
        pain: ["r_upperarm@0.5"],
        caption: "Mano sobre la cabeza: se busca alivio del dolor del brazo.",
      },
    ],
    related: ["cer-spurling", "cer-distraccion"],
  },
  {
    id: "cer-cluster-wainner",
    region: "cervical",
    group: RADICULO,
    name: "Cluster de Wainner",
    aka: ["Clinical prediction rule for cervical radiculopathy", "Cluster de radiculopatía cervical"],
    kind: "cluster",
    purpose: "Confirmar una radiculopatía cervical combinando cuatro hallazgos de la exploración.",
    position: "Se hacen los cuatro tests en la misma sesión: sentado (Spurling, rotación) y en supino (ULNT1, distracción).",
    steps: [
      "ULNT1 (sesgo mediano) positivo.",
      "Spurling A positivo.",
      "Test de distracción positivo (alivio).",
      "Rotación cervical activa hacia el lado sintomático < 60°.",
    ],
    positive: "Tres o cuatro de los cuatro tests positivos.",
    interpretation:
      "Sirve para confirmar: con 3 de 4 la probabilidad sube bastante y con 4 de 4 mucho (intervalo de confianza muy amplio por la muestra pequeña). Pocos positivos no descartan; para descartar, mejor un ULNT1 negativo. Una validación externa reciente encontró menos rendimiento.",
    accuracy: [
      { ...WAINNER, lrPos: 6.1, context: "3 de 4 tests positivos; frente a estudio electrodiagnóstico." },
      { ...WAINNER, lrPos: 30.3, context: "4 de 4 tests positivos (IC 95 % 1,7-538,2)." },
    ],
    utility: "alta",
    cautions: "Si hay signos de mielopatía o déficit neurológico progresivo, deriva antes de seguir explorando.",
    figures: [
      {
        view: "front",
        posture: "sitting",
        joints: { neck: 25 },
        hands: ["head"],
        arrows: [
          { at: "head", dir: "caudal", label: "Spurling" },
          { at: "neck", rotate: "ccw", label: "rot. < 60°" },
        ],
        pain: ["r_upperarm@0.5", "r_forearm@0.6"],
        caption: "Spurling, distracción, ULNT1 y rotación: 3 o 4 positivos confirman.",
      },
    ],
    related: ["cer-spurling", "cer-distraccion", "cer-ulnt1-mediano", "cer-rotacion-60"],
  },

  // ───────────── Mielopatía cervical ─────────────
  {
    id: "cer-hoffmann",
    region: "cervical",
    group: MIELO,
    name: "Signo de Hoffmann",
    aka: ["Hoffmann's sign", "Reflejo de Hoffmann"],
    kind: "test",
    purpose: "Buscar hiperreflexia en la mano como signo de afectación de la primera motoneurona.",
    position: "Paciente sentado con la mano relajada, muñeca en ligera extensión. Examinador delante, sujetando el dedo medio.",
    steps: [
      "Sujeta la falange media del dedo medio del paciente.",
      "Con tu pulgar, da un golpe seco hacia abajo sobre la uña (flexión brusca de la falange distal).",
      "Observa el pulgar y el índice.",
      "Repite varias veces y compara con la otra mano.",
    ],
    positive: "Flexión refleja del pulgar y del índice (pinza) al soltar el estímulo, sobre todo si es asimétrica.",
    interpretation:
      "Precisión modesta en el metaanálisis: ni confirma ni descarta por sí solo. Hay personas sanas con Hoffmann bilateral. Valóralo junto a marcha, Babinski, supinador invertido y edad (cluster de Cook).",
    accuracy: [
      {
        source: "Metaanálisis Hoffmann, 2026",
        citation: "Hoffmann's sign as a diagnostic marker for cervical myelopathy: systematic review and meta-analysis. 2026.",
        doi: "10.4103/njsoma.njsoma_6_26",
        sens: 58,
        spec: 69,
        context: "Metaanálisis de 9 estudios (modelo bivariante).",
      },
    ],
    utility: "baja",
    figures: [
      {
        view: "front",
        posture: "sitting",
        joints: { r_shoulder: 25, r_elbow: 70 },
        hands: ["r_hand"],
        arrows: [{ at: "r_hand", dir: "caudal", label: "golpe uña" }],
        caption: "Golpe seco sobre la uña del dedo medio; positivo si se flexionan pulgar e índice.",
      },
    ],
    related: ["cer-babinski", "cer-supinador-invertido", "cer-cluster-cook"],
  },
  {
    id: "cer-babinski",
    region: "cervical",
    group: MIELO,
    name: "Signo de Babinski",
    aka: ["Reflejo cutáneo plantar extensor", "Babinski sign"],
    kind: "test",
    purpose: "Buscar una respuesta plantar extensora como signo de lesión de la primera motoneurona.",
    position: "Paciente en decúbito supino con la pierna relajada. Examinador a los pies, sujetando el tobillo.",
    steps: [
      "Con un objeto romo, recorre el borde lateral de la planta desde el talón.",
      "Sigue en curva por debajo de los dedos hacia el dedo gordo.",
      "Observa el primer dedo y el resto.",
      "Compara con el otro pie.",
    ],
    positive: "Extensión lenta del dedo gordo, a veces con apertura en abanico de los demás dedos.",
    interpretation:
      "Las revisiones lo sitúan entre los signos más específicos de mielopatía, pero poco sensible: si aparece, deriva; si no aparece, no descarta. Forma parte del cluster de Cook.",
    accuracy: [],
    utility: "desconocida",
    cautions: "Un Babinski positivo de nueva aparición es un signo de alarma: deriva a médico.",
    figures: [
      {
        view: "side",
        posture: "supine",
        hands: ["r_ankle"],
        arrows: [{ at: "r_foot@0.3", dir: "anterior", kind: "move", label: "estímulo" }],
        pain: ["r_foottip"],
        caption: "Estímulo por el borde lateral de la planta; positivo si se extiende el dedo gordo.",
      },
    ],
    related: ["cer-hoffmann", "cer-clonus", "cer-cluster-cook"],
  },
  {
    id: "cer-clonus",
    region: "cervical",
    group: MIELO,
    name: "Clonus aquíleo",
    aka: ["Ankle clonus", "Clono de tobillo"],
    kind: "test",
    purpose: "Detectar contracciones rítmicas involuntarias por hiperreflexia de origen central.",
    position: "Paciente en decúbito supino con rodilla y cadera algo flexionadas. Examinador sujeta la pierna bajo la rodilla y el antepié.",
    steps: [
      "Relaja el tobillo con unos movimientos suaves.",
      "Haz una flexión dorsal rápida y enérgica del pie.",
      "Mantén la presión y cuenta las sacudidas.",
    ],
    positive: "Más de 3-4 sacudidas rítmicas (clonus agotable) o clonus mantenido.",
    interpretation:
      "Muy específico y poco sensible según las revisiones: un clonus mantenido apoya mucho la afectación medular; su ausencia no la descarta.",
    accuracy: [],
    utility: "desconocida",
    cautions: "Un clonus mantenido de nueva aparición es un signo de alarma: deriva a médico.",
    figures: [
      {
        view: "side",
        posture: "supine",
        joints: { r_hip: 30, r_knee: 40 },
        to: { r_ankle: 20 },
        hands: ["r_shank@0.2", "r_foot@0.7"],
        arrows: [{ at: "r_foot@0.7", dir: "cranial", label: "FD brusca" }],
        caption: "Flexión dorsal rápida y mantenida del tobillo.",
      },
    ],
    related: ["cer-babinski", "cer-hoffmann"],
  },
  {
    id: "cer-lhermitte",
    region: "cervical",
    group: MIELO,
    name: "Signo de Lhermitte",
    aka: ["Lhermitte's sign"],
    kind: "test",
    purpose: "Provocar una sensación eléctrica medular al flexionar el cuello.",
    position: "Paciente sentado en la camilla con las piernas extendidas (o sentado normal). Examinador al lado.",
    steps: [
      "Pide al paciente que flexione el cuello, llevando el mentón al pecho (o hazlo pasivamente con suavidad).",
      "Puede añadirse flexión de cadera con las rodillas extendidas.",
      "Pregunta si nota algo como una corriente.",
    ],
    positive: "Sensación de descarga eléctrica que baja por la columna y se irradia a brazos o piernas.",
    interpretation:
      "Poco sensible según los pocos estudios que hay: su ausencia no descarta. Si aparece, piensa en mielopatía (o esclerosis múltiple) y deriva.",
    accuracy: [],
    utility: "desconocida",
    cautions: "Si es positivo, no sigas con la exploración del cuello y deriva a médico.",
    figures: [
      {
        view: "side",
        posture: "longsitting",
        to: { neck: 45 },
        arrows: [{ at: "head", dir: "anterior", kind: "move", label: "flexión" }],
        pain: ["thoracic", "lumbar", "r_shank@0.5"],
        caption: "Flexión del cuello: descarga eléctrica por la espalda y las extremidades.",
      },
    ],
    related: ["cer-cluster-cook"],
  },
  {
    id: "cer-supinador-invertido",
    region: "cervical",
    group: MIELO,
    name: "Reflejo del supinador invertido",
    aka: ["Inverted supinator sign", "Signo del braquiorradial invertido"],
    kind: "test",
    purpose: "Detectar una respuesta anómala del reflejo estilorradial que sugiere afectación medular en C5-C6.",
    position: "Paciente sentado con el antebrazo apoyado en el muslo, en posición neutra. Examinador delante con el martillo de reflejos.",
    steps: [
      "Percute el radio distal, justo por encima de la estiloides.",
      "Observa el codo y los dedos.",
      "Compara con el otro lado.",
    ],
    positive: "Respuesta del supinador débil o ausente con flexión refleja de los dedos (o extensión del codo).",
    interpretation:
      "Sin datos de precisión comprobados. Las revisiones lo incluyen entre los signos específicos; tiene más valor dentro del cluster de Cook.",
    accuracy: [],
    utility: "desconocida",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { r_elbow: 90 },
        hands: ["r_forearm@0.85"],
        arrows: [{ at: "r_forearm@0.85", dir: "caudal", label: "percusión" }],
        caption: "Percusión del radio distal; positivo si se flexionan los dedos.",
      },
    ],
    related: ["cer-hoffmann", "cer-cluster-cook"],
  },
  {
    id: "cer-cluster-cook",
    region: "cervical",
    group: MIELO,
    name: "Cluster de Cook para mielopatía",
    aka: ["Clustered clinical findings for cervical myelopathy"],
    kind: "cluster",
    purpose: "Confirmar o descartar una mielopatía cervical con cinco hallazgos sencillos.",
    position: "Exploración neurológica completa: marcha, reflejos de miembros superiores e inferiores.",
    steps: [
      "Marcha alterada (base ancha, torpe o inestable; puede valorarse con la marcha en tándem).",
      "Signo de Hoffmann positivo.",
      "Reflejo del supinador invertido.",
      "Signo de Babinski positivo.",
      "Edad mayor de 45 años.",
    ],
    positive: "Para confirmar: 3 o más de 5. Para descartar: como mucho 1 de 5.",
    interpretation:
      "Con 3 de 5 la mielopatía es muy probable (deriva). Si no hay ninguno o solo uno, es poco probable. Es un estudio de derivación: los intervalos de confianza son amplios.",
    accuracy: [
      { ...COOK_2010, sens: 94, lrNeg: 0.18, context: "Umbral 1 de 5 positivo, para descartar. Estudio de derivación, 249 pacientes." },
      { ...COOK_2010, sens: 19, spec: 99, lrPos: 30.9, context: "Umbral 3 de 5 positivos, para confirmar (IC 95 % del LR+ 5,5-181,8)." },
    ],
    utility: "alta",
    cautions: "Ante sospecha de mielopatía evita la manipulación y las técnicas en posiciones extremas, y deriva a médico.",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { r_hip: 20, l_hip: -10, r_shoulder: -15, l_shoulder: 15 },
        arrows: [{ at: "pelvis", dir: "anterior", kind: "move", label: "marcha" }],
        caption: "Observa la marcha y explora Hoffmann, supinador invertido y Babinski.",
      },
    ],
    related: ["cer-hoffmann", "cer-supinador-invertido", "cer-babinski", "cer-clonus", "cer-lhermitte"],
  },

  // ───────────── Inestabilidad cervical superior ─────────────
  {
    id: "cer-sharp-purser",
    region: "cervical",
    group: INESTAB,
    name: "Test de Sharp-Purser",
    aka: ["Sharp-Purser test"],
    kind: "test",
    purpose: "Detectar una subluxación anterior del atlas sobre el axis por insuficiencia del ligamento transverso.",
    position: "Paciente sentado con el cuello relajado en ligera flexión. Examinador al lado, con una mano en la frente y la otra pinzando la espinosa de C2.",
    steps: [
      "Pide al paciente que flexione un poco la cabeza y pregunta si nota síntomas.",
      "Fija la apófisis espinosa de C2 con pinza de pulgar e índice.",
      "Empuja con suavidad la frente hacia atrás (traslación posterior de la cabeza).",
      "Observa si hay desplazamiento, ruido o cambio de síntomas.",
    ],
    positive: "Se nota un deslizamiento posterior de la cabeza (a veces con un «clunk») o se alivian los síntomas que provocaba la flexión.",
    interpretation:
      "En artritis reumatoide mostró buena capacidad para confirmar, pero estudios posteriores dan cifras muy variables y poca fiabilidad (revisión de Hutting, 2013). No sirve como cribado: ante sospecha clínica, pide imagen.",
    accuracy: [
      {
        source: "Uitvlugt e Indenbaum, 1988",
        citation: "Uitvlugt G, Indenbaum S. Clinical assessment of atlantoaxial instability using the Sharp-Purser test. Arthritis & Rheumatism. 1988.",
        sens: 69,
        spec: 96,
        lrPos: 17.3,
        lrNeg: 0.32,
        context: "123 pacientes con artritis reumatoide, frente a radiografía en flexión-extensión (laxitud > 3 mm).",
      },
    ],
    utility: "alta",
    cautions:
      "Test potencialmente peligroso. No lo hagas si hay síntomas neurológicos, traumatismo reciente o sospecha clara (artritis reumatoide, Down, uso crónico de corticoides): deriva para imagen. Movimiento mínimo y suave.",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { neck: 15 },
        hands: ["head", "neck@0.3"],
        arrows: [{ at: "head", dir: "posterior", label: "posterior" }],
        caption: "C2 fijada; la cabeza se desliza suavemente hacia atrás.",
      },
    ],
    related: ["cer-ligamento-transverso", "cer-ligamentos-alares"],
  },
  {
    id: "cer-ligamento-transverso",
    region: "cervical",
    group: INESTAB,
    name: "Test del ligamento transverso",
    aka: ["Transverse ligament stress test", "Test de cizalla anterior del atlas"],
    kind: "test",
    purpose: "Valorar la integridad del ligamento transverso del atlas con una traslación anterior de C1 sobre C2.",
    position: "Paciente en decúbito supino con la cabeza apoyada en las manos del examinador, sentado a la cabecera.",
    steps: [
      "Coloca los dedos índices bajo el arco posterior del atlas y los pulgares sobre la cara anterior del cuerpo de C2 (suavemente).",
      "Mantén cabeza y C1 juntas, en posición neutra.",
      "Eleva el atlas y la cabeza en bloque hacia delante, mientras la gravedad mantiene C2.",
      "Mantén 10-20 segundos y pregunta por síntomas.",
    ],
    positive:
      "Aparecen síntomas como mareo, nistagmo, parestesias en labios o extremidades, nudo en la garganta o sensación de «se me cae la cabeza».",
    interpretation:
      "Sin datos de precisión comprobados; la revisión de Hutting (2013) concluye que la evidencia de estos tests es escasa. Úsalo solo con prudencia y nunca como única base para decidir.",
    accuracy: [],
    utility: "desconocida",
    cautions:
      "Si aparece cualquier síntoma neurológico o vascular, para, mantén al paciente quieto y deriva urgente. No lo hagas tras un traumatismo agudo: aplica antes la regla canadiense.",
    figures: [
      {
        view: "side",
        posture: "supine",
        hands: ["neck@0.8", "head"],
        arrows: [{ at: "neck@0.8", dir: "anterior", label: "anterior" }],
        caption: "Cabeza y atlas elevados en bloque hacia delante.",
      },
    ],
    related: ["cer-sharp-purser", "cer-ligamentos-alares"],
  },
  {
    id: "cer-ligamentos-alares",
    region: "cervical",
    group: INESTAB,
    name: "Test de los ligamentos alares",
    aka: ["Alar ligament stress test", "Test de inclinación lateral de los alares"],
    kind: "test",
    purpose: "Valorar la integridad de los ligamentos alares viendo si C2 acompaña a la inclinación de la cabeza.",
    position: "Paciente en decúbito supino o sentado. Examinador con una mano fijando la espinosa (o láminas) de C2 y la otra en la cabeza.",
    steps: [
      "Fija C2 con una pinza entre pulgar e índice.",
      "Inclina la cabeza hacia un lado de forma suave alrededor del eje de la apófisis odontoides.",
      "Nota si C2 se mueve enseguida (normal) o si la cabeza sigue inclinándose sin tope.",
      "Repite en flexión, neutro y extensión, y hacia el otro lado (o prueba la rotación).",
    ],
    positive: "Con C2 fijada, la cabeza se inclina o rota de más sin tope firme; o el paciente presenta síntomas neurológicos o vasculares.",
    interpretation:
      "Sin datos de precisión comprobados y con fiabilidad discutida. Un resultado anómalo exige imagen; un resultado normal no garantiza la estabilidad.",
    accuracy: [],
    utility: "desconocida",
    cautions: "Movimientos mínimos y lentos. Para ante cualquier síntoma y deriva. No lo uses tras traumatismo agudo sin descartar fractura.",
    figures: [
      {
        view: "front",
        posture: "sitting",
        to: { neck: 15 },
        hands: ["neck@0.5", "head"],
        caption: "C2 fijada; la cabeza se inclina: debería notarse tope enseguida.",
      },
    ],
    related: ["cer-sharp-purser", "cer-ligamento-transverso"],
  },

  // ───────────── Cefalea cervicogénica ─────────────
  {
    id: "cer-flexion-rotacion",
    region: "cervical",
    group: CEFALEA,
    name: "Test de flexión-rotación (C1-C2)",
    aka: ["Flexion-rotation test", "FRT", "Cervical flexion-rotation test"],
    kind: "test",
    purpose: "Medir la rotación de C1-C2 aislada para identificar una cefalea cervicogénica de origen alto.",
    position: "Paciente en decúbito supino. Examinador a la cabecera, sujetando la cabeza con las manos y el cuerpo.",
    steps: [
      "Flexiona pasivamente la columna cervical al máximo para bloquear los segmentos inferiores.",
      "Rota la cabeza hacia un lado hasta notar tope firme o dolor.",
      "Mide o estima el ángulo de rotación.",
      "Repite hacia el otro lado y compara.",
    ],
    positive: "Rotación de 32° o menos, o una diferencia de 10° o más respecto al otro lado (normal: unos 44°).",
    interpretation:
      "Buena capacidad tanto para confirmar como para descartar disfunción C1-C2 en pacientes con cefalea, con buena fiabilidad en manos entrenadas. Úsalo para diferenciar de la migraña.",
    accuracy: [
      {
        source: "Hall et al., 2008",
        citation: "Hall TM, et al. Intertester reliability and diagnostic validity of the cervical flexion-rotation test. Journal of Manipulative and Physiological Therapeutics. 2008.",
        sens: 90,
        spec: 88,
        reliability: "kappa 0,85 entre examinadores con experiencia",
        context: "Cefalea cervicogénica frente a controles sin cefalea; examinadores con experiencia.",
      },
      {
        source: "Ogince et al., 2007",
        citation: "Ogince M, Hall T, Robinson K, Blackmore AM. The diagnostic validity of the cervical flexion-rotation test in C1/2-related cervicogenic headache. Manual Therapy. 2007.",
        sens: 91,
        spec: 90,
        context: "23 con cefalea cervicogénica, 23 asintomáticos y 12 con migraña con aura; examinadores ciegos.",
      },
    ],
    utility: "alta",
    cautions: "Hazlo con suavidad. Descarta antes inestabilidad cervical superior y signos de alarma de cefalea.",
    figures: [
      {
        view: "side",
        posture: "supine",
        joints: { neck: 45 },
        hands: ["head"],
        arrows: [{ at: "head", rotate: "cw", label: "rotación" }],
        pain: ["head"],
        caption: "Flexión cervical máxima y rotación pasiva; positivo si ≤ 32°.",
      },
    ],
    related: ["cer-flexores-profundos"],
  },

  // ───────────── Control motor ─────────────
  {
    id: "cer-flexores-profundos",
    region: "cervical",
    group: CONTROL,
    name: "Test de flexión craneocervical",
    aka: ["Craniocervical flexion test", "CCFT", "Test de flexores profundos del cuello"],
    kind: "test",
    purpose: "Valorar el control y la resistencia de los flexores profundos del cuello (largo del cuello y de la cabeza).",
    position: "Paciente en decúbito supino con rodillas flexionadas y un biofeedback de presión bajo la lordosis cervical, inflado a 20 mmHg. Examinador al lado.",
    steps: [
      "Enseña al paciente a hacer un gesto de «sí» suave (cabeceo) sin levantar la cabeza.",
      "Pide que suba la presión por escalones de 2 mmHg (22, 24, 26, 28, 30) y mantenga 10 s en cada uno.",
      "Observa si usa el esternocleidomastoideo o los escalenos, o si hace retracción o extensión.",
      "Registra el nivel más alto que mantiene bien y cuántas repeticiones de 10 s consigue.",
    ],
    positive: "No llega a 26 mmHg o no mantiene un nivel sin compensar con la musculatura superficial.",
    interpretation:
      "No es un test diagnóstico: detecta un déficit de control motor que se trata con ejercicio. Las revisiones lo consideran útil para eso, pero con fiabilidad limitada si el examinador no está entrenado.",
    accuracy: [],
    utility: "desconocida",
    figures: [
      {
        view: "side",
        posture: "hooklying",
        hands: ["neck@0.5"],
        arrows: [{ at: "head", rotate: "ccw", label: "cabeceo" }],
        caption: "Cabeceo suave sobre el biofeedback de presión.",
      },
    ],
    related: ["cer-flexion-rotacion"],
  },

  // ───────────── Traumatismo cervical ─────────────
  {
    id: "cer-regla-canadiense",
    region: "cervical",
    group: TRAUMA,
    name: "Regla canadiense de la columna cervical",
    aka: ["Canadian C-spine rule", "CCR"],
    kind: "rule",
    purpose: "Decidir si un paciente alerta y estable tras un traumatismo necesita prueba de imagen cervical.",
    position: "Paciente alerta (Glasgow 15) y estable tras un traumatismo. Valoración con el cuello inmovilizado hasta llegar al paso 3.",
    steps: [
      "1. ¿Algún factor de alto riesgo? Edad ≥ 65, mecanismo peligroso (caída > 1 m o 5 escalones, carga axial, accidente a alta velocidad, vuelco, salida del vehículo, bici) o parestesias en extremidades. Si sí: imagen.",
      "2. ¿Algún factor de bajo riesgo que permita explorar el movimiento? Alcance trasero simple, sentado en urgencias, ha caminado en algún momento, dolor cervical de aparición tardía o sin dolor en la línea media posterior. Si no hay ninguno: imagen.",
      "3. ¿Puede rotar activamente el cuello 45° a derecha e izquierda? Si no: imagen.",
    ],
    positive: "Indica imagen cualquier factor de alto riesgo, la ausencia de factores de bajo riesgo o la incapacidad para rotar 45° a ambos lados.",
    interpretation:
      "Muy sensible: si la regla dice que no hace falta imagen, la lesión importante es muy improbable. Más sensible y específica que NEXUS en la comparación directa.",
    accuracy: [{ ...STIELL_2003, sens: 99.4, spec: 45.1, context: "8283 pacientes en urgencias; lesión cervical clínicamente importante." }],
    utility: "alta",
    cautions: "No aplicable a menores de 16 años, Glasgow < 15, constantes inestables, parálisis aguda o enfermedad vertebral conocida. Ante la duda, inmoviliza y deriva.",
    figures: [
      {
        view: "front",
        posture: "sitting",
        arrows: [{ at: "head", rotate: "ccw", label: "45° y 45°" }],
        caption: "Paso final: rotación activa de 45° a cada lado.",
      },
    ],
    related: ["cer-nexus"],
  },
  {
    id: "cer-nexus",
    region: "cervical",
    group: TRAUMA,
    name: "Criterios NEXUS",
    aka: ["NEXUS low-risk criteria", "National Emergency X-Radiography Utilization Study"],
    kind: "rule",
    purpose: "Identificar pacientes con traumatismo de bajo riesgo que no necesitan imagen cervical.",
    position: "Paciente tras traumatismo cerrado, valorado con el cuello inmovilizado.",
    steps: [
      "Sin dolor a la palpación de la línea media posterior cervical.",
      "Sin déficit neurológico focal.",
      "Nivel de conciencia normal.",
      "Sin intoxicación.",
      "Sin lesión dolorosa que distraiga (p. ej. fractura de un hueso largo).",
    ],
    positive: "Si falla cualquiera de los cinco criterios, hace falta imagen. Si se cumplen los cinco, el riesgo es bajo.",
    interpretation:
      "Muy sensible en el estudio original, aunque menos en la comparación con la regla canadiense, que es preferible en adultos alertas. Sirve para descartar, no para confirmar.",
    accuracy: [
      {
        source: "Hoffman et al., 2000",
        citation:
          "Hoffman JR, Mower WR, Wolfson AB, et al. Validity of a set of clinical criteria to rule out injury to the cervical spine in patients with blunt trauma. New England Journal of Medicine. 2000;343:94-99.",
        sens: 99.6,
        spec: 12.9,
        context: "34 069 pacientes con traumatismo cerrado en 21 urgencias (algunas fuentes dan sensibilidad del 99,0 %).",
      },
      { ...STIELL_2003, sens: 90.7, spec: 36.8, context: "Comparación directa con la regla canadiense, 8283 pacientes alertas y estables." },
    ],
    utility: "alta",
    cautions: "Ante cualquier criterio positivo, inmoviliza y deriva a urgencias.",
    figures: [
      {
        view: "side",
        posture: "sitting",
        hands: ["neck@0.5"],
        pain: ["neck@0.4"],
        caption: "Palpación de la línea media posterior: si duele, imagen.",
      },
    ],
    related: ["cer-regla-canadiense"],
  },

  // ───────────── Cribado vascular ─────────────
  {
    id: "cer-arteria-vertebral",
    region: "cervical",
    group: VASCULAR,
    name: "Tests premanipulativos de arteria vertebral",
    aka: ["Test de extensión-rotación", "Test de De Kleyn", "Vertebrobasilar insufficiency tests", "VBI tests"],
    kind: "test",
    purpose: "Intentar provocar síntomas de insuficiencia vertebrobasilar antes de tratar el cuello.",
    position: "Paciente en decúbito supino (o sentado). Examinador a la cabecera sujetando la cabeza.",
    steps: [
      "Lleva el cuello a extensión y rotación hacia un lado (o la posición que se vaya a tratar).",
      "Mantén unos 10-30 segundos, hablando con el paciente y mirando sus ojos.",
      "Vuelve a neutro, espera y repite hacia el otro lado.",
    ],
    positive: "Mareo, visión doble, disartria, disfagia, caída brusca, náuseas, nistagmo o entumecimiento facial.",
    interpretation:
      "Validez muy escasa: según la revisión de Hutting (2013) la sensibilidad es baja (0-57 %), así que un test negativo no da seguridad. El cribado debe basarse en la anamnesis de riesgo vascular y los signos de alarma (las «5 D y 3 N»), no en este test.",
    accuracy: [],
    utility: "desconocida",
    cautions:
      "Puede provocar síntomas: si aparecen, para y deriva. Ante sospecha de disección arterial (dolor de cuello o cabeza brusco e intenso, distinto de lo habitual) no explores: deriva urgente.",
    figures: [
      {
        view: "side",
        posture: "supine",
        joints: { neck: -30 },
        hands: ["head"],
        arrows: [{ at: "head", rotate: "cw", label: "ext. + rot." }],
        pain: ["head"],
        caption: "Extensión y rotación mantenidas; se vigilan síntomas vertebrobasilares.",
      },
    ],
    related: ["cer-ligamento-transverso", "cer-sharp-purser"],
  },
];
