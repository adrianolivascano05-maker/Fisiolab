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
        grips: [{ kind: "grasp", face: "cranial" }],
        arrows: [{ at: "head", dir: "caudal", label: "compresión" }],
        pain: ["r_upperarm@0.5", "r_forearm@0.6"],
        caption: "Inclinación hacia el lado sintomático y compresión axial.",
        side: "r",
        script: {
          start: { neck: { lat: 0 } },
          steps: [
            { to: { neck: { lat: 25 } }, by: "examiner", dur: 1.6, text: "Inclina la cabeza hacia el lado de los síntomas (derecho)." },
            { by: "examiner", dur: 0.8, hold: 1.4, pain: true, marks: [{ kind: "push", at: "head", dir: "caudal", label: "Compresión axial" }], text: "Con las manos entrelazadas sobre la cabeza, aplica una compresión axial suave." },
          ],
        },
        text: {
          setup: "Paciente sentado con la espalda apoyada. El examinador, de pie detrás, con las manos entrelazadas sobre la cabeza.",
          look: "Positivo si reaparece el dolor o las parestesias del brazo con distribución dermatómica. El dolor local de cuello no cuenta.",
        },
        supuestos: ["Inclinación de 25° sin extensión (la fuente no da grados)."],
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
        hands: ["head", "jaw"],
        grips: [{ kind: "grasp", face: "posterior" }, { kind: "grasp", face: "caudal" }],
        arrows: [{ at: "head", dir: "cranial", kind: "move", label: "tracción" }],
        pain: ["r_upperarm@0.5"],
        caption: "Tracción axial: se busca que el dolor del brazo se alivie.",
        side: "r",
        script: {
          start: { neck: { flex: 10 } },
          steps: [
            { dur: 0.6, hold: 0.8, path: false, pain: true, text: "Antes de traccionar, el dolor del brazo está presente." },
            { by: "examiner", dur: 1.0, hold: 1.6, painEnd: true, marks: [{ kind: "pull", at: "head", dir: "cranial", label: "Tracción axial" }], text: "Con una mano bajo el occipital y otra en el mentón, tracciona suavemente: el dolor del brazo disminuye." },
          ],
        },
        text: {
          setup: "Paciente en supino. El examinador, a la cabecera, con una mano bajo el occipital y otra en el mentón.",
          look: "Positivo si disminuyen o desaparecen el dolor o las parestesias del brazo durante la tracción.",
        },
        supuestos: ["Se enseña un positivo.", "La separación de la cabeza (unos milímetros) no se dibuja: la marca la flecha."],
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
        hands: ["r_shoulder", "r_forearm@0.9"],
        grips: [{ kind: "press", face: "cranial" }, { kind: "grasp", face: "posterior" }],
        arrows: [
          { at: "r_shoulder", dir: "caudal", label: "depresión" },
          { at: "r_hand", dir: "posterior", label: "ext. muñeca" },
        ],
        pain: ["r_forearm@0.5"],
        caption: "Vista desde arriba. En discontinua, inclinación contralateral del cuello para sensibilizar.",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 110, rot: -60 }, r_elbow: { flex: 90, pron: -80 }, r_wrist: { flex: -60 }, neck: { lat: 0 } },
          steps: [
            { by: "examiner", dur: 0.8, hold: 0.4, path: false, marks: [{ kind: "push", at: "r_shoulder", dir: "caudal", label: "Depresión del hombro" }], text: "Con el hombro a 110° de abducción y en rotación externa, el antebrazo supinado y la muñeca y los dedos extendidos, fija el hombro hacia abajo (depresión de la cintura escapular)." },
            { to: { r_elbow: { flex: 0 } }, by: "examiner", dur: 1.8, pain: true, marks: [{ kind: "push", at: "r_shoulder", dir: "caudal", label: "" }], text: "Extiende el codo poco a poco hasta los síntomas o el final del recorrido." },
            { to: { neck: { lat: -20 } }, by: "patient", dur: 1.4, hold: 1.0, marks: [{ kind: "push", at: "r_shoulder", dir: "caudal", label: "" }], text: "Diferenciación: inclinar el cuello hacia el otro lado aumenta los síntomas si son neurales." },
          ],
        },
        text: {
          setup: "Paciente en supino cerca del borde de la camilla. El examinador, junto al brazo derecho mirando hacia la cabeza, fija el hombro y sujeta el antebrazo junto a la muñeca. Se parte con el hombro en abducción y rotación externa, el antebrazo supinado y la muñeca extendida.",
          look: "Positivo si reproduce los síntomas, hay más de 10° de diferencia en la extensión del codo con el otro lado o los síntomas cambian con la inclinación del cuello.",
        },
        supuestos: [
          "Abducción de 110°, extensión de muñeca de 60°, supinación de 80°, rotación externa de 60° e inclinación contralateral de 20° (la fuente no da todos los grados).",
          "La animación parte con la abducción, la rotación externa, la supinación y la extensión de muñeca ya colocadas y anima la extensión del codo y la diferenciación con el cuello: animarlas una a una obligaba al examinador a girar la muñeca más de lo posible.",
          "El examinador sujeta el antebrazo junto a la muñeca; en la clínica sujeta la mano y los dedos en extensión (el maniquí no tiene dedos articulados).",
        ],
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
        grips: [{ kind: "press", face: "cranial" }, { kind: "grasp", face: "posterior" }],
        arrows: [
          { at: "r_shoulder", dir: "caudal", label: "depresión" },
          { at: "r_forearm@0.6", rotate: "ccw", label: "RI + pron." },
        ],
        pain: ["r_forearm@0.4"],
        caption: "Depresión escapular, rotación interna, pronación y flexión de muñeca.",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 10, rot: 0 }, r_elbow: { flex: 20, pron: 0 }, r_wrist: { flex: 0, abd: 0 } },
          steps: [
            { by: "examiner", dur: 0.8, hold: 0.2, path: false, marks: [{ kind: "push", at: "r_shoulder", dir: "caudal", label: "Depresión del hombro" }], text: "Fija el hombro hacia abajo (depresión de la cintura escapular)." },
            { to: { r_elbow: { flex: 0 }, r_shoulder: { rot: 60 } }, by: "examiner", dur: 1.4, marks: [{ kind: "push", at: "r_shoulder", dir: "caudal", label: "" }], text: "Extiende el codo y rota el hombro hacia dentro.", label: "RI 60° + extensión de codo" },
            { to: { r_elbow: { pron: 80 }, r_wrist: { flex: 60, abd: -20 } }, by: "examiner", dur: 1.6, pain: true, marks: [{ kind: "push", at: "r_shoulder", dir: "caudal", label: "" }], text: "Prona el antebrazo y flexiona la muñeca con desviación cubital.", label: "Pronación + flexión de muñeca" },
            { to: { r_shoulder: { abd: 35 } }, by: "examiner", dur: 1.4, hold: 1.0, marks: [{ kind: "push", at: "r_shoulder", dir: "caudal", label: "" }], text: "Añade abducción del hombro hasta los síntomas." },
          ],
        },
        text: {
          setup: "Paciente en supino, en diagonal, con el hombro derecho fuera de la camilla. El examinador, junto al brazo, fija el hombro y sujeta la mano.",
          look: "Positivo si reproduce los síntomas en la cara dorsorradial del antebrazo o la mano y cambian con la maniobra de diferenciación.",
        },
        supuestos: ["Rotación interna de 60°, pronación de 80°, flexión de muñeca de 60° con 20° de desviación cubital y abducción de 35° (la fuente no da grados).", "No se dibuja el muslo del examinador ni la diferenciación con el cuello."],
        place: { stance: "stand", from: "side" },
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
        grips: [{ kind: "press", face: "cranial" }, { kind: "grasp", face: "anterior" }],
        arrows: [{ at: "r_shoulder", dir: "caudal", label: "depresión" }],
        pain: ["r_forearm@0.5", "r_hand"],
        caption: "Abducción, flexión de codo y extensión de muñeca: la mano hacia la oreja.",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 10, rot: -60 }, r_elbow: { flex: 125, pron: 70 }, r_wrist: { flex: -60 } },
          steps: [
            { by: "examiner", dur: 0.8, hold: 0.4, path: false, marks: [{ kind: "push", at: "r_shoulder", dir: "caudal", label: "Depresión del hombro" }], text: "Con la muñeca extendida, el antebrazo en pronación, el codo flexionado y el hombro en rotación externa, fija el hombro hacia abajo (depresión de la cintura escapular)." },
            { to: { r_shoulder: { abd: 90 } }, by: "examiner", dur: 1.8, hold: 1.0, pain: true, marks: [{ kind: "push", at: "r_shoulder", dir: "caudal", label: "" }], text: "Abduce el hombro llevando la mano hacia la oreja." },
          ],
        },
        text: {
          setup: "Paciente en supino. El examinador, junto al brazo derecho, sujeta la mano y fija el hombro. Se parte con la muñeca en extensión, el antebrazo en pronación, el codo flexionado y el hombro en rotación externa.",
          look: "Positivo si reproduce síntomas en el borde cubital del antebrazo y en los dedos 4.º y 5.º, y cambian con la maniobra de diferenciación.",
        },
        supuestos: [
          "Extensión de muñeca de 60°, pronación de 70°, flexión de codo de 125°, rotación externa de 60° y abducción de 90° (la fuente no da grados).",
          "La animación parte con la muñeca, el antebrazo, el codo y la rotación ya colocados y solo anima la depresión y la abducción final: animarlos uno a uno obligaba al examinador a girar la muñeca más de lo posible.",
        ],
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
        side: "r",
        script: {
          steps: [
            {
              to: { neck: { rot: 55 } },
              by: "patient",
              dur: 2.0,
              hold: 1.2,
              text: "Gira la cabeza todo lo que pueda hacia el lado sintomático (aquí, la derecha): llega a 55°, menos de 60°.",
              label: "Rotación derecha 55°",
            },
            { to: { neck: { rot: -75 } }, by: "patient", dur: 2.6, hold: 1.0, text: "Compara con el otro lado: hacia la izquierda llega a 75°.", label: "Rotación izquierda 75°" },
          ],
        },
        text: {
          setup: "Paciente sentado con la espalda recta y mirando al frente. El examinador mide con un goniómetro o un inclinómetro.",
          look: "Positivo si la rotación activa hacia el lado sintomático no llega a 60° (aquí, 55°).",
        },
        camera: { from: [-0.2, 0.62, 0.76] },
        supuestos: ["Lado sintomático: derecho.", "Se dibuja una rotación de 55° hacia el lado sintomático (un positivo) y de 75° hacia el otro."],
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
        pose3d: { r_shoulder: { flex: 165, abd: 26, rot: 74 }, r_elbow: { flex: 100 } },
        pain: ["r_upperarm@0.5"],
        caption: "Mano sobre la cabeza: se busca alivio del dolor del brazo.",
        side: "r",
        script: {
          steps: [
            { dur: 0.6, hold: 0.8, path: false, pain: true, text: "Con el brazo abajo, el dolor radicular está presente." },
            { to: { r_shoulder: { flex: 165, abd: 26, rot: 74 }, r_elbow: { flex: 100 } }, by: "patient", dur: 2.4, hold: 1.4, painEnd: true, label: "Mano sobre la cabeza", text: "Pide que coloque la mano sobre la cabeza: el dolor del brazo disminuye." },
          ],
        },
        text: {
          setup: "Paciente sentado. El examinador, delante, observa.",
          look: "Positivo si el dolor radicular del brazo disminuye o desaparece al poner la mano sobre la cabeza.",
        },
        supuestos: ["Se enseña un positivo."],
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
        grips: [{ kind: "grasp", face: "cranial" }],
        arrows: [
          { at: "head", dir: "caudal", label: "Spurling" },
          { at: "neck", rotate: "ccw", label: "rot. < 60°" },
        ],
        pain: ["r_upperarm@0.5", "r_forearm@0.6"],
        caption: "Spurling, distracción, ULNT1 y rotación: 3 o 4 positivos confirman.",
        side: "r",
        script: {
          start: { neck: { lat: 0 } },
          steps: [
            { to: { neck: { lat: 25 } }, by: "examiner", dur: 1.6, text: "Inclina la cabeza hacia el lado de los síntomas (derecho)." },
            { by: "examiner", dur: 0.8, hold: 1.4, pain: true, marks: [{ kind: "push", at: "head", dir: "caudal", label: "Compresión axial" }], text: "Con las manos entrelazadas sobre la cabeza, aplica una compresión axial suave." },
          ],
        },
        text: {
          setup: "Se hacen en la misma sesión Spurling, distracción, ULNT1 y rotación cervical. Aquí, Spurling: paciente sentado, examinador detrás.",
          look: "Tres o cuatro de los cuatro tests positivos confirman la radiculopatía cervical.",
        },
        supuestos: ["Solo se dibuja uno de los cuatro tests (Spurling)."],
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
        hands: ["r_hand@0.85"],
        grips: [{ kind: "grasp", face: "posterior" }],
        arrows: [{ at: "r_hand", dir: "caudal", label: "golpe uña" }],
        caption: "Golpe seco sobre la uña del dedo medio; positivo si se flexionan pulgar e índice.",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 25 }, r_elbow: { flex: 70 }, r_wrist: { flex: -15 } },
          steps: [{ by: "examiner", dur: 0.3, hold: 1.6, path: false, marks: [{ kind: "push", at: "r_hand@0.9", dir: "caudal", label: "Golpe seco sobre la uña" }], text: "Sujetando el dedo medio, da un golpe seco sobre su uña y mira el pulgar y el índice." }],
        },
        text: {
          setup: "Paciente sentado con la mano derecha relajada y la muñeca en ligera extensión. El examinador, delante, sujeta el dedo medio.",
          look: "Positivo si el pulgar y el índice se flexionan de forma refleja (pinza) al soltar, sobre todo si es asimétrico.",
        },
        supuestos: ["Los dedos del maniquí no se mueven: la respuesta va en el texto."],
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
        grips: [{ kind: "grasp", face: "posterior" }],
        arrows: [{ at: "r_foot@0.3", dir: "anterior", kind: "move", label: "estímulo" }],
        pain: ["r_foottip"],
        caption: "Estímulo por el borde lateral de la planta; positivo si se extiende el dedo gordo.",
        side: "r",
        script: {
          steps: [{ by: "examiner", dur: 1.2, hold: 1.4, path: false, marks: [{ kind: "slide", at: "r_foot@0.5", face: "caudal", dir: "anterior", label: "Por el borde lateral de la planta" }], text: "Con un objeto romo, recorre el borde lateral de la planta desde el talón hacia los dedos." }],
        },
        text: {
          setup: "Paciente en supino con la pierna derecha relajada. El examinador, a los pies, sujeta el tobillo.",
          look: "Positivo si el dedo gordo se extiende lentamente, a veces con los demás dedos en abanico.",
        },
        supuestos: ["Los dedos del maniquí no se mueven: la respuesta va en el texto."],
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
        grips: [{ kind: "grasp", face: "posterior" }, { kind: "press", face: "caudal" }],
        arrows: [{ at: "r_foot@0.7", dir: "cranial", label: "FD brusca" }],
        caption: "Flexión dorsal rápida y mantenida del tobillo.",
        side: "r",
        script: {
          start: { r_hip: { flex: 30 }, r_knee: { flex: 40 }, r_ankle: { flex: -10 } },
          steps: [
            { to: { r_ankle: { flex: 20 } }, by: "examiner", dur: 0.3, hold: 0.3, path: ["r_ankle"], text: "Lleva el tobillo a flexión dorsal de forma brusca y mantén la presión." },
            { to: { r_ankle: { flex: 10 } }, dur: 0.16, hold: 0, path: false, text: "Sacudidas rítmicas del tobillo: clonus (positivo si son más de 3-4)." },
            { to: { r_ankle: { flex: 20 } }, dur: 0.16, hold: 0, path: false, text: "Sacudidas rítmicas del tobillo: clonus (positivo si son más de 3-4)." },
            { to: { r_ankle: { flex: 10 } }, dur: 0.16, hold: 0, path: false, text: "Sacudidas rítmicas del tobillo: clonus (positivo si son más de 3-4)." },
            { to: { r_ankle: { flex: 20 } }, dur: 0.16, hold: 0, path: false, text: "Sacudidas rítmicas del tobillo: clonus (positivo si son más de 3-4)." },
            { to: { r_ankle: { flex: 10 } }, dur: 0.16, hold: 0, path: false, text: "Sacudidas rítmicas del tobillo: clonus (positivo si son más de 3-4)." },
            { to: { r_ankle: { flex: 20 } }, dur: 0.16, hold: 1.0, path: false, text: "Sacudidas rítmicas del tobillo: clonus (positivo si son más de 3-4)." },
          ],
        },
        text: {
          setup: "Paciente en supino con la cadera y la rodilla derechas algo flexionadas. El examinador sujeta la pierna bajo la rodilla y el antepié.",
          look: "Positivo si hay más de 3-4 sacudidas rítmicas (clonus agotable) o el clonus se mantiene.",
        },
        supuestos: ["Se enseña un positivo con 6 sacudidas de 10°."],
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
        side: "both",
        script: {
          steps: [{ to: { neck: { flex: 45 } }, by: "patient", dur: 1.8, hold: 1.4, pain: true, text: "Pide que flexione el cuello (barbilla al pecho)." }],
        },
        text: {
          setup: "Paciente sentado en la camilla con las piernas extendidas. El examinador, al lado.",
          look: "Positivo si nota una descarga eléctrica que baja por la columna y se irradia a los brazos o las piernas.",
        },
        supuestos: ["Flexión cervical de 45°."],
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
        grips: [{ kind: "tips", face: "cranial" }],
        arrows: [{ at: "r_forearm@0.85", dir: "caudal", label: "percusión" }],
        caption: "Percusión del radio distal; positivo si se flexionan los dedos.",
        side: "r",
        script: {
          start: { r_elbow: { flex: 90 } },
          steps: [{ by: "examiner", dur: 0.25, hold: 1.6, path: false, marks: [{ kind: "push", at: "r_forearm@0.85", dir: "caudal", label: "Percute el radio distal" }], text: "Con el martillo de reflejos, percute el radio distal." }],
        },
        text: {
          setup: "Paciente sentado con el antebrazo derecho apoyado en el muslo, en posición neutra. El examinador, delante, con el martillo.",
          look: "Positivo si la respuesta del supinador es débil o no existe y se flexionan los dedos (o se extiende el codo).",
        },
        supuestos: ["Los dedos del maniquí no se mueven: la respuesta va en el texto."],
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
        side: "both",
        script: {
          steps: [{ to: { r_hip: { flex: 25 }, r_knee: { flex: 15 }, l_hip: { flex: -10 }, r_shoulder: { flex: -15 }, l_shoulder: { flex: 15 } }, by: "patient", dur: 1.4, hold: 1.0, path: false, text: "Observa la marcha (inestable, con la base ancha) y explora después Hoffmann, supinador invertido y Babinski." }],
        },
        text: {
          setup: "Exploración neurológica completa: marcha y reflejos de los miembros superiores e inferiores.",
          look: "Para confirmar la mielopatía: 3 o más de 5 hallazgos. Para descartarla: como mucho 1 de 5.",
        },
        supuestos: ["Solo se dibuja un paso de la marcha; los reflejos están en sus propias figuras."],
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
        hands: ["head", "neck@0.8"],
        grips: [{ kind: "press", face: "anterior" }, { kind: "tips", face: "posterior" }],
        arrows: [{ at: "head", dir: "posterior", label: "posterior" }],
        caption: "C2 fijada; la cabeza se desliza suavemente hacia atrás.",
        side: "both",
        script: {
          start: { neck: { flex: 15 } },
          steps: [{ by: "examiner", dur: 1.0, hold: 1.6, path: false, marks: [{ kind: "push", at: "head", dir: "posterior", label: "Empuja la frente hacia atrás" }], text: "Con C2 pinzada, empuja suavemente la frente hacia atrás." }],
        },
        text: {
          setup: "Paciente sentado con el cuello relajado en ligera flexión. El examinador, al lado, con una mano en la frente y la otra pinzando la espinosa de C2.",
          look: "Positivo si la cabeza se desliza hacia atrás (a veces con un «clunk») o se alivian los síntomas que daba la flexión.",
        },
        supuestos: ["El deslizamiento de la cabeza (unos milímetros) no se dibuja."],
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
        joints: { neck: 20 },
        hands: ["neck@0.8", "head"],
        grips: [{ kind: "tips", face: "posterior" }, { kind: "grasp", face: "posterior" }],
        arrows: [{ at: "neck@0.8", dir: "anterior", label: "anterior" }],
        caption: "Cabeza y atlas elevados en bloque hacia delante.",
        side: "both",
        script: {
          start: { neck: { flex: 20 } },
          steps: [{ by: "examiner", dur: 1.0, hold: 1.8, path: false, pain: true, marks: [{ kind: "push", at: "neck@0.8", dir: "anterior", label: "Eleva cabeza y atlas en bloque" }], text: "Con la cabeza apoyada en tus manos, eleva en bloque la cabeza y el atlas hacia delante y mantén unos segundos." }],
        },
        text: {
          setup: "Paciente en supino con la cabeza apoyada en las manos del examinador, sentado a la cabecera.",
          look: "Positivo si aparecen mareo, nistagmo, parestesias en labios o extremidades, nudo en la garganta o sensación de que «se cae la cabeza».",
        },
        supuestos: ["El desplazamiento del atlas no se dibuja: lo marca la flecha."],
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
        hands: ["neck@0.8", "head"],
        grips: [{ kind: "tips", face: "posterior" }, { kind: "press", face: "lateral" }],
        caption: "C2 fijada; la cabeza se inclina: debería notarse tope enseguida.",
        side: "r",
        script: {
          start: { neck: { lat: 0 } },
          steps: [{ to: { neck: { lat: 10 } }, by: "examiner", dur: 1.4, hold: 1.4, text: "Con C2 fijada, inclina la cabeza: el tope debe notarse enseguida." }],
        },
        text: {
          setup: "Paciente sentado. Una mano fija la espinosa (o las láminas) de C2 y la otra va sobre la cabeza.",
          look: "Positivo si, con C2 fijada, la cabeza se inclina o rota de más sin tope firme, o aparecen síntomas neurológicos o vasculares.",
        },
        supuestos: ["Se enseña la respuesta normal: tope a unos 10°."],
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
        grips: [{ kind: "grasp", face: "posterior" }],
        arrows: [{ at: "head", rotate: "cw", label: "rotación" }],
        pain: ["head"],
        caption: "Flexión cervical máxima y rotación pasiva; positivo si ≤ 32°.",
        side: "r",
        script: {
          start: { neck: { flex: 45, rot: 0 } },
          steps: [{ to: { neck: { rot: 30 } }, by: "examiner", dur: 2.0, hold: 1.4, pain: true, text: "Con el cuello en flexión máxima, rota la cabeza de forma pasiva hasta el tope." }],
        },
        text: {
          setup: "Paciente en supino. El examinador, a la cabecera, sujeta la cabeza con las manos y el cuerpo.",
          look: "Positivo si la rotación es de 32° o menos o hay 10° o más de diferencia con el otro lado. Lo normal son unos 44°.",
        },
        supuestos: ["Se enseña un positivo: 30° de rotación.", "Flexión cervical de 45° como «flexión máxima»."],
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
        grips: [{ kind: "tips", face: "lateral" }],
        arrows: [{ at: "head", rotate: "ccw", label: "cabeceo" }],
        caption: "Cabeceo suave sobre el biofeedback de presión.",
        side: "both",
        script: {
          steps: [{ to: { neck: { flex: 8 } }, by: "patient", dur: 1.6, hold: 1.6, text: "Pide un cabeceo suave, como para decir «sí», sin levantar la cabeza y subiendo la presión de 2 en 2 mmHg." }],
        },
        text: {
          setup: "Paciente en supino con las rodillas flexionadas y un biofeedback de presión bajo la lordosis cervical, inflado a 20 mmHg. El examinador, al lado.",
          look: "Positivo si no llega a 26 mmHg o no mantiene un nivel sin compensar con la musculatura superficial.",
        },
        supuestos: ["El biofeedback no se dibuja.", "Cabeceo de 8°."],
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
        side: "both",
        script: {
          steps: [
            { to: { neck: { rot: 45 } }, by: "patient", dur: 1.6, hold: 0.6, text: "Paso final: pide que gire la cabeza 45° hacia un lado…" },
            { to: { neck: { rot: -45 } }, by: "patient", dur: 2.4, hold: 0.8, text: "…y 45° hacia el otro." },
          ],
        },
        text: {
          setup: "Paciente alerta (Glasgow 15) y estable tras un traumatismo. Antes se han valorado los factores de alto y bajo riesgo.",
          look: "Imagen si hay cualquier factor de alto riesgo, ningún factor de bajo riesgo o no consigue rotar 45° a los dos lados.",
        },
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
        grips: [{ kind: "tips", face: "posterior" }],
        pain: ["neck@0.4"],
        caption: "Palpación de la línea media posterior: si duele, imagen.",
        side: "both",
        script: {
          steps: [{ by: "examiner", dur: 0.8, hold: 1.6, path: false, pain: true, marks: [{ kind: "push", at: "neck@0.5", dir: "anterior", label: "Palpa la línea media" }], text: "Palpa la línea media posterior del cuello." }],
        },
        text: {
          setup: "Paciente tras un traumatismo cerrado, con el cuello inmovilizado.",
          look: "Hace falta imagen si falla cualquiera de los cinco criterios (dolor en la línea media, déficit neurológico, alteración de la conciencia, intoxicación o lesión que distrae). Con los cinco, el riesgo es bajo.",
        },
        supuestos: ["Solo se dibuja la palpación de la línea media."],
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
        grips: [{ kind: "grasp", face: "posterior" }],
        arrows: [{ at: "head", rotate: "cw", label: "ext. + rot." }],
        pain: ["head"],
        caption: "Extensión y rotación mantenidas; se vigilan síntomas vertebrobasilares.",
        side: "r",
        script: {
          steps: [{ to: { neck: { flex: -30, rot: 45 } }, by: "examiner", dur: 2.4, hold: 2.0, pain: true, text: "Lleva el cuello a extensión y rotación y mantén unos 10 segundos vigilando los síntomas." }],
        },
        text: {
          setup: "Paciente en supino. El examinador, a la cabecera, sujeta la cabeza.",
          look: "Positivo si aparecen mareo, visión doble, disartria, disfagia, caída brusca, náuseas, nistagmo o entumecimiento facial.",
        },
        supuestos: ["Extensión de 30° con rotación de 45° (la fuente no da grados)."],
      },
    ],
    related: ["cer-ligamento-transverso", "cer-sharp-purser"],
  },
];
