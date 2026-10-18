import type { SpecialTest } from "../types";

// Fuentes reutilizadas (cita corta + cita completa).
const HEGEDUS_2012 = {
  source: "Hegedus et al., 2012",
  citation:
    "Hegedus EJ, et al. Which physical examination tests provide clinicians with the most value when examining the shoulder? Update of a systematic review with meta-analysis of individual tests. Br J Sports Med. 2012;46(14):964-978.",
  doi: "10.1136/bjsports-2012-091066",
};
const HEGEDUS_2008 = {
  source: "Hegedus et al., 2008",
  citation:
    "Hegedus EJ, et al. Physical examination tests of the shoulder: a systematic review with meta-analysis of individual tests. Br J Sports Med. 2008;42(2):80-92.",
};
const HERMANS_2013 = {
  source: "Hermans et al., 2013",
  citation:
    "Hermans J, et al. Does this patient with shoulder pain have rotator cuff disease? The Rational Clinical Examination systematic review. JAMA. 2013;310(8):837-847.",
};
const PARK_2005 = {
  source: "Park et al., 2005",
  citation:
    "Park HB, Yokota A, Gill HS, El Rassi G, et al. Diagnostic accuracy of clinical tests for the different degrees of subacromial impingement syndrome. J Bone Joint Surg Am. 2005;87(7):1446-1455.",
  doi: "10.2106/JBJS.D.02335",
};
const MICHENER_2009 = {
  source: "Michener et al., 2009",
  citation:
    "Michener LA, et al. Reliability and diagnostic accuracy of 5 physical examination tests and combination of tests for subacromial impingement. Arch Phys Med Rehabil. 2009;90(11):1898-1903.",
};
const JAIN_2017 = {
  source: "Jain et al., 2017",
  citation:
    "Jain NB, Luz J, Higgins LD, Dong Y, Warner JJ, Matzkin E, Katz JN. The diagnostic accuracy of special tests for rotator cuff tear: the ROW cohort study. Am J Phys Med Rehabil. 2017;96(3):176-183.",
};
const MILLER_2008 = {
  source: "Miller et al., 2008",
  citation:
    "Miller CA, Forrester GA, Lewis JS. The validity of the lag signs in diagnosing full-thickness tears of the rotator cuff: a preliminary investigation. Arch Phys Med Rehabil. 2008;89(6):1162-1168.",
};
const BARTH_2006 = {
  source: "Barth et al., 2006",
  citation:
    "Barth JR, Burkhart SS, De Beer JF. The bear-hug test: a new and sensitive test for diagnosing a subscapularis tear. Arthroscopy. 2006;22(10):1076-1084.",
};
const FARBER_2006 = {
  source: "Farber et al., 2006",
  citation:
    "Farber AJ, et al. Clinical assessment of three common tests for traumatic anterior shoulder instability. J Bone Joint Surg Am. 2006;88(7):1467-1474.",
};
const LO_2004 = {
  source: "Lo et al., 2004",
  citation:
    "Lo IK, et al. An evaluation of the apprehension, relocation, and surprise tests for anterior shoulder instability. Am J Sports Med. 2004;32(2):301-307.",
};
const KIM_2005 = {
  source: "Kim et al., 2005",
  citation:
    "Kim SH, et al. The Kim test: a novel test for posteroinferior labral lesion of the shoulder--a comparison to the jerk test. Am J Sports Med. 2005;33(8):1188-1192.",
};
const KIBLER_2009 = {
  source: "Kibler et al., 2009",
  citation:
    "Kibler WB, et al. Clinical utility of traditional and new tests in the diagnosis of biceps tendon injuries and superior labrum anterior and posterior lesions in the shoulder. Am J Sports Med. 2009;37(9):1840-1847.",
};
const CHRONOPOULOS_2004 = {
  source: "Chronopoulos et al., 2004",
  citation:
    "Chronopoulos E, et al. Diagnostic value of physical tests for isolated chronic acromioclavicular lesions. Am J Sports Med. 2004;32(3):655-661.",
};

const G_SUB = "Síndrome de dolor subacromial";
const G_RC = "Rotura del manguito rotador";
const G_INS = "Inestabilidad glenohumeral";
const G_SLAP = "Lesión SLAP (labrum superior)";
const G_BIC = "Porción larga del bíceps";
const G_AC = "Articulación acromioclavicular";
const G_CAP = "Capsulitis adhesiva";
const G_TOS = "Síndrome del desfiladero torácico";

export const hombroTests: SpecialTest[] = [
  // ───────────── Síndrome de dolor subacromial ─────────────
  {
    id: "hom-neer",
    region: "hombro",
    group: G_SUB,
    name: "Test de Neer",
    aka: ["Neer impingement sign", "Signo de Neer"],
    kind: "test",
    purpose: "Provoca el dolor subacromial al llevar el troquíter contra el arco coracoacromial en flexión máxima.",
    position: "Paciente de pie o sentado. El examinador se coloca detrás o al lado y fija la escápula con una mano.",
    steps: [
      "Fija la escápula presionando el acromion hacia abajo.",
      "Coloca el brazo del paciente en rotación interna (pulgar hacia abajo).",
      "Eleva pasivamente el brazo en flexión hasta el final del recorrido.",
      "Pregunta por dolor y dónde lo nota.",
    ],
    positive: "Dolor en la cara anterior o lateral del hombro durante la elevación, sobre todo al final del recorrido.",
    interpretation:
      "Sensible pero poco específico: un resultado negativo ayuda algo a descartar, pero un positivo por sí solo confirma poco. Combínalo con Hawkins-Kennedy, arco doloroso y rotación externa resistida (cluster de Park).",
    accuracy: [
      { ...HEGEDUS_2012, sens: 72, spec: 60, context: "Síndrome subacromial; metaanálisis de estudios frente a cirugía o imagen" },
      { ...MICHENER_2009, lrNeg: 0.35, context: "Síndrome subacromial frente a diagnóstico quirúrgico" },
    ],
    utility: "moderada",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { r_shoulder: 20 },
        to: { r_shoulder: 170 },
        hands: ["r_forearm@0.5", "r_shoulder"],
        grips: [{ kind: "grasp", face: "lateral" }, { kind: "press", face: "cranial" }],
        arrows: [{ at: "r_elbow", dir: "cranial", kind: "move", label: "flexión" }],
        pain: ["r_shoulder"],
        caption: "Flexión pasiva máxima en rotación interna con la escápula fijada",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 10, rot: 0 }, r_elbow: { flex: 8, pron: 0 } },
          steps: [
            { to: { r_shoulder: { rot: 40 }, r_elbow: { pron: 60 } }, by: "examiner", dur: 1.2, text: "Coloca el brazo en rotación interna (pulgar hacia abajo).", label: "RI 40° + pronación" },
            {
              to: { r_shoulder: { flex: 165 } },
              by: "examiner",
              dur: 2.6,
              hold: 1.0,
              pain: true,
              marks: [{ kind: "push", at: "r_shoulder", dir: "caudal", label: "Fija la escápula" }],
              text: "Con la escápula fijada, eleva pasivamente el brazo en flexión hasta el final del recorrido.",
            },
          ],
        },
        text: {
          setup: "Paciente de pie. El examinador, detrás o al lado, fija la escápula con una mano y sujeta el antebrazo derecho con la otra.",
          look: "Positivo si duele la cara anterior o lateral del hombro durante la elevación, sobre todo al final del recorrido.",
        },
        supuestos: ["Rotación interna de 40° con el antebrazo en pronación para dejar el pulgar hacia abajo; flexión hasta 165° (la fuente dice «hasta el final del recorrido»)."],
      },
    ],
    related: ["hom-hawkins-kennedy", "hom-arco-doloroso", "hom-cluster-park-subacromial"],
  },
  {
    id: "hom-hawkins-kennedy",
    region: "hombro",
    group: G_SUB,
    name: "Test de Hawkins-Kennedy",
    aka: ["Hawkins-Kennedy test", "Hawkins"],
    kind: "test",
    purpose: "Provoca dolor subacromial al rotar internamente el húmero con el hombro en flexión de 90°.",
    position: "Paciente de pie o sentado. El examinador, delante o al lado, sujeta el codo y la muñeca.",
    steps: [
      "Lleva el hombro a 90° de flexión con el codo a 90°.",
      "Sujeta el codo para que no baje.",
      "Rota internamente el húmero empujando el antebrazo hacia abajo.",
      "Pregunta por dolor en el hombro.",
    ],
    positive: "Dolor en la cara anterolateral del hombro al rotar internamente.",
    interpretation:
      "Es de los más sensibles para dolor subacromial, pero poco específico. Un negativo baja algo la sospecha; un positivo aislado no confirma. Úsalo dentro del cluster de Park con arco doloroso y rotación externa resistida.",
    accuracy: [{ ...HEGEDUS_2012, sens: 79, spec: 59, context: "Síndrome subacromial; metaanálisis" }],
    utility: "moderada",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { r_shoulder: 90, r_elbow: 90 },
        pose3d: { r_shoulder: { flex: 90, abd: -10 } },
        to3d: { r_shoulder: { flex: 90, abd: -10, rot: 70 } },
        hands: ["r_upperarm@0.8", "r_wrist"],
        grips: [{ kind: "grasp", face: "caudal" }, { kind: "grasp", face: "anterior" }],
        arrows: [{ at: "r_wrist", rotate: "cw", label: "RI" }],
        pain: ["r_shoulder"],
        caption: "Flexión de 90°, codo a 90° y rotación interna pasiva",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 90, abd: -10, rot: 0 }, r_elbow: { flex: 90, pron: 0 } },
          steps: [{ to: { r_shoulder: { rot: 70 } }, by: "examiner", dur: 1.8, hold: 1.0, pain: true, text: "Con el codo sujeto para que no baje, rota internamente el húmero llevando el antebrazo hacia abajo." }],
        },
        text: {
          setup: "Paciente de pie con el hombro derecho a 90° de flexión y el codo a 90°. El examinador sujeta el codo y la muñeca.",
          look: "Positivo si duele la cara anterolateral del hombro al rotar internamente.",
        },
        supuestos: ["Rotación interna de 70° y 10° de aducción horizontal (la fuente no da grados)."],
      },
    ],
    related: ["hom-neer", "hom-cluster-park-subacromial"],
  },
  {
    id: "hom-arco-doloroso",
    region: "hombro",
    group: G_SUB,
    name: "Arco doloroso",
    aka: ["Painful arc", "Arco doloroso de abducción"],
    kind: "test",
    purpose: "Detecta dolor subacromial en el tramo medio de la elevación activa en abducción.",
    position: "Paciente de pie, brazos relajados. El examinador observa por delante o por detrás.",
    steps: [
      "Pide al paciente que eleve el brazo en abducción hasta arriba.",
      "Pide que lo baje despacio por el mismo camino.",
      "Anota en qué grados aparece y desaparece el dolor.",
    ],
    positive: "Dolor entre unos 60° y 120° de abducción que mejora por encima y por debajo de ese tramo.",
    interpretation:
      "Es de las pruebas más útiles de la exploración del manguito: un positivo aumenta de forma moderada la probabilidad y un arco sin dolor ayuda algo a descartar. Combínalo con Hawkins-Kennedy y rotación externa resistida.",
    accuracy: [
      { ...HEGEDUS_2012, sens: 53, spec: 76, context: "Síndrome subacromial; metaanálisis" },
      { ...MICHENER_2009, lrPos: 2.25, lrNeg: 0.38, context: "Síndrome subacromial frente a diagnóstico quirúrgico" },
      { ...HERMANS_2013, lrPos: 3.7, lrNeg: 0.36, context: "Enfermedad del manguito rotador; revisión sistemática en pacientes derivados a especialista" },
    ],
    utility: "moderada",
    figures: [
      {
        view: "front",
        posture: "standing",
        joints: { r_shoulder: 20 },
        to: { r_shoulder: 170 },
        arrows: [{ at: "r_elbow", dir: "lateral", kind: "move", label: "abducción" }],
        pain: ["r_shoulder"],
        caption: "Abducción activa: dolor entre 60° y 120°",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 10 } },
          steps: [
            { to: { r_shoulder: { abd: 60 } }, by: "patient", dur: 1.4, hold: 0.2, text: "Pide que eleve el brazo en abducción…" },
            { to: { r_shoulder: { abd: 120 } }, by: "patient", dur: 1.6, hold: 0.4, pain: true, text: "Entre 60° y 120° aparece el dolor…" },
            { to: { r_shoulder: { abd: 170 } }, by: "patient", dur: 1.2, hold: 0.6, painEnd: true, text: "…y por encima de 120° cede. Después lo baja despacio por el mismo camino." },
          ],
        },
        text: {
          setup: "Paciente de pie con los brazos relajados. El examinador observa por delante o por detrás.",
          look: "Positivo si duele entre unos 60° y 120° de abducción y mejora por encima y por debajo de ese tramo. Anota en qué grados aparece y desaparece.",
        },
        supuestos: ["Se enseña un positivo: dolor entre 60° y 120°. En la bajada vuelve a doler en el mismo tramo (no se dibuja)."],
      },
    ],
    related: ["hom-cluster-park-subacromial", "hom-cluster-park-rotura"],
  },
  {
    id: "hom-rotacion-externa-resistida",
    region: "hombro",
    group: G_SUB,
    name: "Rotación externa resistida",
    aka: ["External rotation resistance test", "Test del infraespinoso", "Infraspinatus muscle test"],
    kind: "test",
    purpose: "Valora dolor y fuerza del infraespinoso al resistir la rotación externa con el brazo junto al cuerpo.",
    position: "Paciente de pie o sentado, codo a 90° pegado al costado y antebrazo en rotación neutra. El examinador, delante.",
    steps: [
      "Sujeta el codo del paciente contra el tronco.",
      "Apoya la otra mano en la cara dorsal de la muñeca.",
      "Pide al paciente que rote hacia fuera con fuerza mientras resistes.",
      "Compara con el otro lado.",
    ],
    positive: "Dolor o debilidad en la rotación externa respecto al lado sano.",
    interpretation:
      "Un positivo aumenta de forma moderada la probabilidad de síndrome subacromial; la debilidad marcada orienta a rotura del infraespinoso. Forma parte de los clusters de Park.",
    accuracy: [{ ...MICHENER_2009, lrPos: 4.39, lrNeg: 0.5, context: "Síndrome subacromial frente a diagnóstico quirúrgico" }],
    utility: "moderada",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { r_elbow: 90 },
        hands: ["r_wrist", "r_elbow"],
        grips: [{ kind: "press", face: "lateral" }, { kind: "press", face: "lateral" }],
        arrows: [{ at: "r_wrist", dir: "medial", label: "resiste RE" }],
        pain: ["r_shoulder"],
        caption: "Codo pegado al cuerpo; el paciente rota hacia fuera contra resistencia",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 0, rot: 0 }, r_elbow: { flex: 90, pron: 0 } },
          steps: [
            {
              marks: [
                { kind: "resist", joint: "r_shoulder", dof: "rot", sign: -1, label: "Empuja hacia RE; el examinador lo frena" },
              ],
              dur: 0.4,
              hold: 3.2,
              pain: true,
              text: "El paciente intenta rotar el brazo hacia fuera con fuerza; el examinador lo impide en la muñeca y le sujeta el codo contra el tronco. No hay movimiento (isométrico).",
            },
          ],
        },
        text: {
          setup: "Paciente de pie, codo derecho a 90° pegado al costado y antebrazo en posición neutra (pulgar arriba). Examinador delante.",
          look: "Positivo si hay dolor o debilidad en la rotación externa respecto al lado sano.",
        },
        place: { stance: "stand", from: "side" },
        supuestos: ["Se muestra de pie (la fuente admite de pie o sentado)."],
      },
    ],
    related: ["hom-cluster-park-subacromial", "hom-cluster-park-rotura", "hom-lag-rotacion-externa"],
  },
  {
    id: "hom-cluster-park-subacromial",
    region: "hombro",
    group: G_SUB,
    name: "Cluster de Park para síndrome subacromial",
    aka: ["Park cluster", "Hawkins-Kennedy + arco doloroso + infraespinoso"],
    kind: "cluster",
    purpose: "Combina tres pruebas para confirmar o descartar el síndrome subacromial con más fuerza que cada una por separado.",
    position: "Paciente de pie. Se hacen las tres pruebas seguidas en la misma sesión.",
    steps: [
      "Haz el test de Hawkins-Kennedy.",
      "Valora el arco doloroso en abducción activa.",
      "Haz la rotación externa resistida (test del infraespinoso).",
      "Cuenta cuántas de las tres son positivas.",
    ],
    positive: "Las tres positivas apoyan con fuerza el diagnóstico; dos de tres lo apoyan de forma moderada. Las tres negativas lo hacen poco probable.",
    interpretation:
      "Útil en los dos sentidos: 3 de 3 positivas ayuda a confirmar y 0 de 3 ayuda a descartar. Las cifras proceden de un único estudio quirúrgico y se citan a partir de sus tablas en fuentes secundarias.",
    accuracy: [
      { ...PARK_2005, lrPos: 10.56, lrNeg: 0.17, context: "3 de 3 positivas (LR+) o 3 de 3 negativas (LR−); frente a artroscopia" },
      { ...PARK_2005, lrPos: 5.03, context: "2 de 3 positivas; frente a artroscopia" },
    ],
    utility: "alta",
    figures: [
      {
        view: "front",
        posture: "standing",
        joints: { r_shoulder: 30 },
        to: { r_shoulder: 160 },
        arrows: [{ at: "r_elbow", dir: "lateral", kind: "move", label: "arco" }],
        pain: ["r_shoulder"],
        caption: "Hawkins-Kennedy + arco doloroso + rotación externa resistida",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 10 } },
          steps: [
            { to: { r_shoulder: { abd: 60 } }, by: "patient", dur: 1.4, hold: 0.2, text: "Pide que eleve el brazo en abducción…" },
            { to: { r_shoulder: { abd: 120 } }, by: "patient", dur: 1.6, hold: 0.4, pain: true, text: "Entre 60° y 120° aparece el dolor…" },
            { to: { r_shoulder: { abd: 170 } }, by: "patient", dur: 1.2, hold: 0.6, painEnd: true, text: "…y por encima de 120° cede. Después lo baja despacio por el mismo camino." },
          ],
        },
        text: {
          setup: "Paciente de pie. Se hacen seguidas tres pruebas: Hawkins-Kennedy, arco doloroso y rotación externa resistida.",
          look: "Las tres positivas apoyan con fuerza el síndrome subacromial; dos de tres, de forma moderada; las tres negativas lo hacen poco probable.",
        },
        supuestos: ["Solo se dibuja una de las tres pruebas (el arco doloroso, positivo entre 60° y 120°)."],
      },
    ],
    related: ["hom-hawkins-kennedy", "hom-arco-doloroso", "hom-rotacion-externa-resistida"],
  },

  // ───────────── Rotura del manguito rotador ─────────────
  {
    id: "hom-jobe",
    region: "hombro",
    group: G_RC,
    name: "Test de Jobe (lata vacía) y lata llena",
    aka: ["Empty can test", "Full can test", "Test del supraespinoso"],
    kind: "test",
    purpose: "Valora dolor y fuerza del supraespinoso resistiendo la elevación en el plano de la escápula.",
    position: "Paciente de pie, brazos a 90° de elevación en el plano escapular (unos 30° por delante del plano frontal). El examinador, delante.",
    steps: [
      "Lata vacía: brazos en rotación interna, pulgares hacia abajo.",
      "Empuja los antebrazos hacia abajo mientras el paciente resiste.",
      "Lata llena: repite con los pulgares hacia arriba (rotación externa).",
      "Compara fuerza y dolor entre ambos lados.",
    ],
    positive: "Debilidad (con o sin dolor) del lado afectado. La debilidad orienta más a rotura que el dolor aislado.",
    interpretation:
      "La lata vacía es sensible para rotura del supraespinoso pero poco específica; la lata llena es algo más específica y molesta menos. Ninguna confirma por sí sola: combínalas con arco doloroso, brazo caído y signos de retraso.",
    accuracy: [
      { ...JAIN_2017, sens: 88, spec: 62, context: "Lata vacía; rotura del supraespinoso confirmada por resonancia" },
      { ...JAIN_2017, sens: 70, spec: 81, context: "Lata llena; rotura del supraespinoso confirmada por resonancia" },
      { ...MICHENER_2009, lrPos: 3.9, context: "Lata vacía; síndrome subacromial frente a diagnóstico quirúrgico" },
    ],
    utility: "moderada",
    figures: [
      {
        view: "front",
        posture: "standing",
        joints: { r_shoulder: 90, l_shoulder: 90 },
        hands: ["r_forearm@0.6", "l_forearm@0.6"],
        grips: [{ kind: "press", face: "cranial" }, { kind: "press", face: "cranial" }],
        arrows: [
          { at: "r_wrist", dir: "caudal", label: "resiste" },
          { at: "r_forearm@0.5", rotate: "cw", label: "pulgar abajo" },
        ],
        pain: ["r_shoulder"],
        caption: "Lata vacía: elevación a 90° con los pulgares hacia abajo",
        side: "both",
        script: {
          start: { r_shoulder: { flex: 90, abd: 60, rot: 0 }, l_shoulder: { flex: 90, abd: 60, rot: 0 }, r_elbow: { flex: 5, pron: 0 }, l_elbow: { flex: 5, pron: 0 } },
          steps: [
            { to: { r_shoulder: { rot: 80 }, l_shoulder: { rot: 80 }, r_elbow: { pron: 90 }, l_elbow: { pron: 90 } }, by: "patient", dur: 1.4, text: "Lata vacía: con los brazos a 90° en el plano escapular, gira los pulgares hacia abajo.", label: "Pulgares hacia abajo" },
            {
              by: "examiner",
              dur: 0.8,
              hold: 1.4,
              pain: true,
              marks: [
                { kind: "push", at: "r_forearm@0.6", dir: "caudal", label: "Empuja hacia abajo" },
                { kind: "resist", joint: "r_shoulder", dof: "flex", sign: 1, label: "Resiste hacia arriba" },
              ],
              text: "Empuja los antebrazos hacia abajo mientras el paciente resiste; compara los dos lados.",
            },
          ],
        },
        text: {
          setup: "Paciente de pie con los dos brazos a 90° de elevación en el plano escapular (unos 30° por delante del plano frontal) y los codos extendidos. El examinador, delante.",
          look: "Positivo si el lado afectado está más débil (con o sin dolor). La debilidad orienta más a rotura que el dolor aislado.",
        },
        supuestos: ["Pulgar hacia abajo con 80° de rotación interna y 90° de pronación; plano escapular a 30° del frontal (60° de abducción horizontal)."],
      },
      {
        view: "front",
        posture: "standing",
        joints: { r_shoulder: 90, l_shoulder: 90 },
        hands: ["r_forearm@0.6", "l_forearm@0.6"],
        grips: [{ kind: "press", face: "cranial" }, { kind: "press", face: "cranial" }],
        arrows: [
          { at: "r_wrist", dir: "caudal", label: "resiste" },
          { at: "r_forearm@0.5", rotate: "ccw", label: "pulgar ↑" },
        ],
        pain: ["r_shoulder"],
        caption: "Lata llena: misma posición con los pulgares hacia arriba",
        side: "both",
        script: {
          start: { r_shoulder: { flex: 90, abd: 60, rot: 0 }, l_shoulder: { flex: 90, abd: 60, rot: 0 }, r_elbow: { flex: 5, pron: 0 }, l_elbow: { flex: 5, pron: 0 } },
          steps: [
            {
              by: "examiner",
              dur: 0.8,
              hold: 1.4,
              pain: true,
              marks: [
                { kind: "push", at: "r_forearm@0.6", dir: "caudal", label: "Empuja hacia abajo" },
                { kind: "resist", joint: "r_shoulder", dof: "flex", sign: 1, label: "Resiste hacia arriba" },
              ],
              text: "Lata llena: con los pulgares hacia arriba, empuja los antebrazos hacia abajo mientras el paciente resiste.",
            },
          ],
        },
        text: {
          setup: "Paciente de pie con los dos brazos a 90° de elevación en el plano escapular, codos extendidos y pulgares hacia arriba. El examinador, delante.",
          look: "Positivo si el lado afectado está más débil (con o sin dolor).",
        },
        supuestos: ["Plano escapular a 30° del frontal (60° de abducción horizontal)."],
      },
    ],
    related: ["hom-brazo-caido", "hom-arco-doloroso"],
  },
  {
    id: "hom-brazo-caido",
    region: "hombro",
    group: G_RC,
    name: "Test del brazo caído",
    aka: ["Drop arm test", "Test de Codman"],
    kind: "test",
    purpose: "Detecta una rotura amplia del supraespinoso por incapacidad de bajar el brazo de forma controlada.",
    position: "Paciente de pie. El examinador al lado, preparado para sujetar el brazo.",
    steps: [
      "Lleva el brazo del paciente a unos 90° de abducción (o más alto).",
      "Suelta el brazo y pide que lo baje despacio hasta el costado.",
      "Observa si el descenso es controlado.",
    ],
    positive: "El brazo cae de golpe o el paciente no consigue bajarlo de forma suave, a menudo con dolor.",
    interpretation:
      "Muy poco sensible: un negativo no descarta rotura. Un positivo aumenta de forma moderada la probabilidad de rotura de espesor completo. Combínalo con arco doloroso y rotación externa resistida (cluster de Park).",
    accuracy: [
      { ...HERMANS_2013, lrPos: 3.3, context: "Enfermedad del manguito rotador; revisión sistemática" },
      { ...PARK_2005, sens: 34.9, spec: 87.5, context: "Rotura de espesor completo frente a artroscopia" },
    ],
    utility: "moderada",
    cautions: "Sujeta el brazo si cae para evitar dolor brusco.",
    figures: [
      {
        view: "front",
        posture: "standing",
        joints: { r_shoulder: 90 },
        to: { r_shoulder: 15 },
        arrows: [{ at: "r_wrist", dir: "caudal", kind: "move", label: "descenso" }],
        pain: ["r_shoulder"],
        caption: "Desde 90° de abducción, el paciente baja el brazo despacio",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 90, rot: 0 } },
          steps: [
            { to: { r_shoulder: { abd: 70 } }, by: "patient", dur: 1.6, hold: 0.1, label: "Baja despacio", text: "Pide que baje el brazo despacio hasta el costado…" },
            { to: { r_shoulder: { abd: 10 } }, dur: 0.4, hold: 1.2, pain: true, label: "Cae de golpe", text: "…a mitad de camino no puede controlarlo y el brazo cae de golpe." },
          ],
        },
        text: {
          setup: "El examinador ha llevado el brazo derecho a 90° de abducción y lo suelta. Paciente de pie.",
          look: "Positivo si el brazo cae de golpe o no consigue bajarlo de forma suave, a menudo con dolor.",
        },
        supuestos: ["Se enseña un positivo: baja controlado hasta unos 70° y cae de golpe.", "No se dibuja al examinador levantando y soltando el brazo."],
      },
    ],
    related: ["hom-cluster-park-rotura", "hom-jobe"],
  },
  {
    id: "hom-lag-rotacion-externa",
    region: "hombro",
    group: G_RC,
    name: "Signo de retraso en rotación externa",
    aka: ["External rotation lag sign (ERLS)", "Signo de caída en rotación externa"],
    kind: "test",
    purpose: "Detecta rotura completa del supraespinoso e infraespinoso por incapacidad de mantener la rotación externa.",
    position: "Paciente sentado, de espaldas al examinador, codo a 90° y hombro con unos 20° de elevación en el plano escapular.",
    steps: [
      "Sujeta el codo con una mano y la muñeca con la otra.",
      "Lleva el hombro pasivamente a rotación externa casi máxima (unos 5° menos del tope).",
      "Pide al paciente que mantenga esa posición y suelta la muñeca, sin soltar el codo.",
      "Observa si el antebrazo vuelve hacia dentro.",
    ],
    positive: "El antebrazo cae hacia la rotación interna (retraso) porque el paciente no puede mantener la rotación externa.",
    interpretation:
      "Muy específico: un positivo ayuda a confirmar rotura de espesor completo del manguito posterosuperior. Poco sensible, así que un negativo no descarta.",
    accuracy: [
      { ...HERMANS_2013, lrPos: 7.2, context: "Rotura de espesor completo; revisión sistemática" },
      { ...JAIN_2017, spec: 98, lrPos: 6.06, context: "Rotura del infraespinoso confirmada por resonancia (retraso a 0°)" },
      { ...MILLER_2008, sens: 46, spec: 94, lrNeg: 0.57, context: "Rotura de espesor completo confirmada por ecografía; 37 pacientes" },
    ],
    utility: "alta",
    figures: [
      {
        view: "front",
        posture: "sitting",
        joints: { r_shoulder: 20, r_elbow: 70 },
        hands: ["r_elbow", "r_wrist"],
        grips: [{ kind: "grasp", face: "caudal" }, { kind: "grasp", face: "anterior" }],
        arrows: [{ at: "r_wrist", dir: "medial", kind: "move", label: "cae a RI" }],
        caption: "Se suelta la muñeca en rotación externa: el antebrazo cae hacia dentro",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 20, rot: 0 }, r_elbow: { flex: 90, pron: 0 } },
          steps: [
            { to: { r_shoulder: { rot: -50 } }, by: "examiner", dur: 1.6, hold: 0.4, text: "Lleva el hombro pasivamente a rotación externa casi máxima." },
            { to: { r_shoulder: { rot: -15 } }, dur: 0.8, hold: 1.2, release: [1], label: "Cae hacia RI", text: "Pide que mantenga la posición y suelta la muñeca sin soltar el codo: el antebrazo vuelve hacia dentro." },
          ],
        },
        text: {
          setup: "Paciente sentado, de espaldas al examinador, con el codo derecho a 90° y unos 20° de abducción. El examinador sujeta el codo y la muñeca.",
          look: "Positivo si el antebrazo cae hacia la rotación interna porque no puede mantener la rotación externa.",
        },
        supuestos: ["Se enseña un positivo: de 50° de rotación externa cae a 15°.", "Abducción de 20° en el plano frontal (la fuente dice plano escapular)."],
      },
    ],
    related: ["hom-hornblower", "hom-rotacion-externa-resistida"],
  },
  {
    id: "hom-hornblower",
    region: "hombro",
    group: G_RC,
    name: "Signo de Hornblower",
    aka: ["Hornblower's sign", "Signo del trompetista", "Patte"],
    kind: "test",
    purpose: "Valora el redondo menor y el infraespinoso pidiendo rotación externa con el brazo en abducción.",
    position: "Paciente sentado o de pie. El examinador sostiene el brazo a 90° de abducción en el plano escapular con el codo a 90°.",
    steps: [
      "Sostén el brazo en 90° de abducción y codo a 90°.",
      "Pide al paciente que rote hacia fuera (llevar la mano hacia atrás) contra tu resistencia.",
      "Observa también si, al llevar la mano a la boca, necesita separar el codo.",
    ],
    positive: "No puede rotar hacia fuera o mantener la rotación externa; para llevar la mano a la boca levanta el codo (gesto del trompetista).",
    interpretation:
      "Muy específico: un positivo apoya rotura del infraespinoso o del redondo menor. Poco sensible: un negativo no descarta. Combínalo con el signo de retraso en rotación externa.",
    accuracy: [{ ...JAIN_2017, spec: 96, lrPos: 4.81, context: "Rotura del infraespinoso confirmada por resonancia" }],
    utility: "moderada",
    figures: [
      {
        view: "front",
        posture: "standing",
        joints: { r_shoulder: 90, r_elbow: 90 },
        hands: ["r_elbow", "r_wrist"],
        grips: [{ kind: "grasp", face: "caudal" }, { kind: "press", face: "posterior" }],
        arrows: [{ at: "r_wrist", dir: "anterior", label: "resiste RE" }],
        caption: "Brazo en 90/90: el paciente intenta rotar hacia fuera contra resistencia",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 90, rot: 0 }, r_elbow: { flex: 90, pron: 0 } },
          steps: [{ by: "patient", dur: 0.8, hold: 1.6, marks: [{ kind: "resist", joint: "r_shoulder", dof: "rot", sign: -1, label: "Rota hacia fuera contra la mano" }], text: "Pide que rote hacia fuera (llevar la mano hacia atrás) contra tu resistencia." }],
        },
        text: {
          setup: "El examinador sostiene el brazo derecho a 90° de abducción con el codo a 90°.",
          look: "Positivo si no puede rotar hacia fuera ni mantener la rotación externa. Al llevar la mano a la boca, levanta el codo (gesto del trompetista).",
        },
        supuestos: ["Abducción en el plano frontal (la fuente dice plano escapular): así 0° de rotación es el antebrazo hacia delante.", "No se dibuja el gesto de llevar la mano a la boca."],
      },
    ],
    related: ["hom-lag-rotacion-externa"],
  },
  {
    id: "hom-lift-off",
    region: "hombro",
    group: G_RC,
    name: "Test de lift-off (Gerber)",
    aka: ["Lift-off test", "Test de despegue"],
    kind: "test",
    purpose: "Valora el subescapular pidiendo separar la mano de la espalda en rotación interna.",
    position: "Paciente de pie con el dorso de la mano apoyado en la zona lumbar. El examinador, detrás.",
    steps: [
      "Coloca el dorso de la mano del paciente sobre la zona lumbar media.",
      "Pide que separe la mano de la espalda hacia atrás.",
      "Si lo consigue, puedes añadir resistencia suave.",
    ],
    positive: "No consigue separar la mano de la espalda o lo hace extendiendo el codo o el hombro para compensar.",
    interpretation:
      "Muy específico pero muy poco sensible: un positivo ayuda a confirmar rotura del subescapular; un negativo no descarta. Combínalo con belly press y bear hug.",
    accuracy: [{ ...BARTH_2006, sens: 17.6, spec: 100, context: "Rotura del subescapular frente a artroscopia; 68 pacientes" }],
    utility: "alta",
    cautions: "Requiere rotación interna suficiente para llevar la mano a la espalda; si duele o no llega, usa el belly press.",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { r_shoulder: -30, r_elbow: 30 },
        pose3d: { r_shoulder: { flex: -18, abd: 23, rot: 88 }, r_elbow: { flex: 87 }, r_wrist: { flex: -20 } },
        arrows: [{ at: "r_hand", dir: "posterior", kind: "move", label: "separa" }],
        caption: "Mano en la zona lumbar: el paciente intenta separarla hacia atrás",
        side: "r",
        camera: { from: [-0.6, 0.1, -0.8] },
        script: {
          start: { r_shoulder: { flex: -25, abd: 20, rot: 70 }, r_elbow: { flex: 70 } },
          steps: [{ to: { r_shoulder: { rot: 85 } }, by: "patient", dur: 1.6, hold: 1.2, label: "Separa la mano (RI)", text: "Pide que separe la mano de la espalda hacia atrás, sin extender el codo ni el hombro." }],
        },
        text: {
          setup: "Paciente de pie con el dorso de la mano derecha apoyado en la zona lumbar media. El examinador, detrás.",
          look: "Positivo si no consigue separar la mano o lo hace extendiendo el codo o el hombro para compensar.",
        },
        supuestos: ["Se enseña la respuesta normal: con 15° más de rotación interna la mano se separa unos 7 cm de la espalda."],
      },
    ],
    related: ["hom-belly-press", "hom-bear-hug"],
  },
  {
    id: "hom-belly-press",
    region: "hombro",
    group: G_RC,
    name: "Test de presión abdominal (belly press)",
    aka: ["Belly press test", "Napoleon (variante)"],
    kind: "test",
    purpose: "Valora el subescapular pidiendo presionar el abdomen con la mano manteniendo el codo delante.",
    position: "Paciente de pie con la palma sobre el abdomen y la muñeca recta. El examinador, delante.",
    steps: [
      "Coloca la palma del paciente sobre el abdomen.",
      "Pide que presione el abdomen manteniendo el codo hacia delante.",
      "Observa la muñeca y el codo durante la presión.",
    ],
    positive: "El codo se va hacia atrás o la muñeca se flexiona para poder presionar.",
    interpretation:
      "Muy específico: un positivo ayuda a confirmar rotura del subescapular. Sensibilidad baja: un negativo no descarta. Útil cuando el lift-off no se puede hacer.",
    accuracy: [{ ...BARTH_2006, sens: 40, spec: 97.9, context: "Rotura del subescapular frente a artroscopia; 68 pacientes" }],
    utility: "alta",
    figures: [
      {
        view: "front",
        posture: "standing",
        joints: { r_elbow: -90 },
        pose3d: { r_shoulder: { flex: 27, abd: 28, rot: 90 }, r_elbow: { flex: 102 } },
        arrows: [
          { at: "r_hand", dir: "posterior", kind: "move", label: "presiona" },
          { at: "r_elbow", dir: "anterior", kind: "move" },
        ],
        caption: "Mano en el abdomen: presiona sin que el codo se vaya atrás",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 27, abd: 28, rot: 90 }, r_elbow: { flex: 102 } },
          steps: [{ by: "patient", dur: 0.8, hold: 1.6, marks: [{ kind: "resist", at: "r_hand", dir: "posterior", label: "Presiona el abdomen" }], text: "Pide que presione el abdomen manteniendo el codo hacia delante y la muñeca recta." }],
        },
        text: {
          setup: "Paciente de pie con la palma derecha sobre el abdomen y la muñeca recta. El examinador, delante.",
          look: "Positivo si para presionar el codo se va hacia atrás o la muñeca se flexiona.",
        },
        supuestos: ["Se enseña la respuesta normal (el codo no se mueve)."],
      },
    ],
    related: ["hom-lift-off", "hom-bear-hug"],
  },
  {
    id: "hom-bear-hug",
    region: "hombro",
    group: G_RC,
    name: "Test del abrazo de oso (bear hug)",
    aka: ["Bear hug test"],
    kind: "test",
    purpose: "Valora la porción superior del subescapular resistiendo la rotación interna con la mano en el hombro contrario.",
    position: "Paciente de pie con la palma sobre el hombro contrario, dedos extendidos y codo delante del cuerpo. El examinador, delante.",
    steps: [
      "Coloca la mano del paciente sobre el hombro contrario con el codo elevado hacia delante.",
      "Pide que mantenga la mano apretada contra el hombro.",
      "Intenta separar la mano del hombro tirando de la muñeca en rotación externa.",
    ],
    positive: "No puede mantener la mano sobre el hombro o muestra más de un 20 % de debilidad respecto al lado sano.",
    interpretation:
      "Es la prueba más sensible del subescapular y tiene buena especificidad: un positivo ayuda a confirmar. Un negativo no descarta del todo; combínalo con belly press.",
    accuracy: [{ ...BARTH_2006, sens: 60, spec: 91.7, context: "Rotura del subescapular frente a artroscopia; 68 pacientes" }],
    utility: "alta",
    figures: [
      {
        view: "front",
        posture: "standing",
        joints: { r_shoulder: -45, r_elbow: -108 },
        pose3d: { r_shoulder: { flex: 90, abd: -20, rot: 90 }, r_elbow: { flex: 113 } },
        hands: ["r_wrist"],
        grips: [{ kind: "grasp", face: "lateral" }],
        arrows: [{ at: "r_wrist", dir: "anterior", label: "separa" }],
        caption: "Mano en el hombro contrario: el examinador intenta separarla",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 90, abd: -20, rot: 90 }, r_elbow: { flex: 113 } },
          steps: [
            {
              by: "examiner",
              dur: 0.8,
              hold: 1.6,
              marks: [
                { kind: "pull", at: "r_wrist", dir: "anterior", label: "Intenta separar la mano" },
                { kind: "resist", joint: "r_shoulder", dof: "rot", sign: 1, label: "Aprieta contra el hombro" },
              ],
              text: "Pide que mantenga la mano apretada contra el hombro e intenta separarla tirando de la muñeca hacia rotación externa.",
            },
          ],
        },
        text: {
          setup: "Paciente de pie con la palma derecha sobre el hombro izquierdo y el codo elevado por delante. El examinador, delante.",
          look: "Positivo si no puede mantener la mano sobre el hombro o tiene más de un 20 % de debilidad respecto al lado sano.",
        },
      },
    ],
    related: ["hom-belly-press", "hom-lift-off"],
  },
  {
    id: "hom-cluster-park-rotura",
    region: "hombro",
    group: G_RC,
    name: "Cluster de Park para rotura completa del manguito",
    aka: ["Park cluster (rotator cuff tear)", "Brazo caído + arco doloroso + infraespinoso"],
    kind: "cluster",
    purpose: "Combina tres pruebas para reconocer una rotura de espesor completo del manguito.",
    position: "Paciente de pie. Se hacen las tres pruebas seguidas.",
    steps: [
      "Valora el arco doloroso en abducción activa.",
      "Haz el test del brazo caído.",
      "Haz la rotación externa resistida buscando debilidad (test del infraespinoso).",
      "Cuenta cuántas son positivas.",
    ],
    positive: "Las tres positivas: alta probabilidad de rotura de espesor completo.",
    interpretation:
      "Sirve sobre todo para confirmar: con las tres positivas la probabilidad postest fue alta en el estudio original. Con pocos positivos no se descarta: pide ecografía si la clínica lo sugiere (edad avanzada, traumatismo, debilidad). El signo de retraso en rotación externa añade especificidad.",
    accuracy: [
      { ...PARK_2005, context: "Probabilidad postest del 91 % con las tres positivas para rotura de espesor completo; frente a artroscopia (sin razones de verosimilitud confirmadas)" },
    ],
    utility: "alta",
    figures: [
      {
        view: "front",
        posture: "standing",
        joints: { r_shoulder: 90 },
        to: { r_shoulder: 15 },
        arrows: [{ at: "r_wrist", dir: "caudal", kind: "move", label: "cae" }],
        pain: ["r_shoulder"],
        caption: "Arco doloroso + brazo caído + debilidad en rotación externa",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 90, rot: 0 } },
          steps: [
            { to: { r_shoulder: { abd: 70 } }, by: "patient", dur: 1.6, hold: 0.1, label: "Baja despacio", text: "Pide que baje el brazo despacio hasta el costado…" },
            { to: { r_shoulder: { abd: 10 } }, dur: 0.4, hold: 1.2, pain: true, label: "Cae de golpe", text: "…a mitad de camino no puede controlarlo y el brazo cae de golpe." },
          ],
        },
        text: {
          setup: "Paciente de pie. Se hacen seguidas tres pruebas: arco doloroso, brazo caído y rotación externa resistida buscando debilidad.",
          look: "Las tres positivas: alta probabilidad de rotura de espesor completo del manguito.",
        },
        supuestos: ["Solo se dibuja una de las tres pruebas (el brazo caído, positivo)."],
      },
    ],
    related: ["hom-arco-doloroso", "hom-brazo-caido", "hom-rotacion-externa-resistida", "hom-lag-rotacion-externa"],
  },

  // ───────────── Inestabilidad glenohumeral ─────────────
  {
    id: "hom-aprension",
    region: "hombro",
    group: G_INS,
    name: "Test de aprensión anterior",
    aka: ["Apprehension test", "Crank test de aprensión"],
    kind: "test",
    purpose: "Reproduce la sensación de luxación anterior llevando el hombro a abducción y rotación externa.",
    position: "Paciente en decúbito supino con el hombro en el borde de la camilla. El examinador al lado, sujetando muñeca y codo.",
    steps: [
      "Lleva el hombro a 90° de abducción y el codo a 90°.",
      "Rota externamente el hombro de forma lenta y progresiva.",
      "Observa la cara y la reacción del paciente.",
    ],
    positive: "Aprensión (miedo a que se salga, defensa muscular), no solo dolor.",
    interpretation:
      "Muy específico cuando el criterio es la aprensión: un positivo ayuda a confirmar inestabilidad anterior traumática. Si solo hay dolor, su valor baja mucho. Complétalo con recolocación y sorpresa.",
    accuracy: [{ ...FARBER_2006, sens: 72, spec: 96, lrPos: 20.2, context: "Inestabilidad anterior traumática frente a artroscopia; criterio: aprensión" }],
    utility: "alta",
    cautions: "No lo hagas en una luxación aguda o sin reducir. Avanza despacio y para en cuanto aparezca aprensión.",
    figures: [
      {
        view: "front",
        posture: "supine",
        joints: { r_shoulder: 90, r_elbow: 90 },
        hands: ["r_wrist", "r_elbow"],
        grips: [{ kind: "grasp", face: "anterior" }, { kind: "grasp", face: "posterior" }],
        arrows: [{ at: "r_forearm@0.8", rotate: "ccw", label: "RE" }],
        pain: ["r_shoulder"],
        caption: "Supino, 90° de abducción: rotación externa progresiva",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 90, rot: 0 }, r_elbow: { flex: 90, pron: 0 } },
          steps: [{ to: { r_shoulder: { rot: -80 } }, by: "examiner", dur: 2.6, hold: 1.2, pain: true, text: "Rota externamente el hombro de forma lenta y progresiva, mirando la cara del paciente." }],
        },
        text: {
          setup: "Paciente en supino con el hombro derecho en el borde de la camilla, a 90° de abducción y el codo a 90°. El examinador sujeta la muñeca y el codo.",
          look: "Positivo si aparece aprensión (miedo a que se salga, defensa muscular), no solo dolor.",
        },
        supuestos: ["Rotación externa hasta 80° (la fuente dice «progresiva»; con 90° el examinador tendría que girar la muñeca más de lo posible)."],
        place: { stance: "sit", from: "side" },
      },
    ],
    related: ["hom-recolocacion", "hom-sorpresa"],
  },
  {
    id: "hom-recolocacion",
    region: "hombro",
    group: G_INS,
    name: "Test de recolocación (Jobe)",
    aka: ["Relocation test", "Fowler"],
    kind: "test",
    purpose: "Confirma la inestabilidad anterior comprobando que la aprensión cede al empujar la cabeza humeral hacia atrás.",
    position: "Igual que el test de aprensión, en decúbito supino con el hombro en 90° de abducción y rotación externa.",
    steps: [
      "Lleva el hombro a la posición de aprensión.",
      "Empuja la cabeza humeral hacia posterior con la palma sobre la cara anterior del hombro.",
      "Manteniendo el empuje, aumenta algo más la rotación externa.",
    ],
    positive: "Desaparece o disminuye la aprensión al empujar hacia atrás y se tolera más rotación externa.",
    interpretation:
      "Muy específico: ayuda a confirmar inestabilidad anterior traumática si se usa el alivio de la aprensión como criterio. Se combina con la aprensión y la sorpresa.",
    accuracy: [{ ...FARBER_2006, sens: 81, spec: 92, lrPos: 10.4, context: "Inestabilidad anterior traumática frente a artroscopia; criterio: alivio de la aprensión" }],
    utility: "alta",
    cautions: "No lo hagas en una luxación aguda.",
    figures: [
      {
        view: "front",
        posture: "supine",
        joints: { r_shoulder: 90, r_elbow: 90 },
        hands: ["r_wrist", "r_shoulder"],
        grips: [{ kind: "grasp", face: "anterior" }, { kind: "press", face: "anterior" }],
        arrows: [
          { at: "r_shoulder", dir: "posterior", label: "posterior" },
          { at: "r_forearm@0.8", rotate: "ccw", label: "RE" },
        ],
        caption: "Empuje posterior sobre la cabeza humeral en la posición de aprensión",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 90, rot: -75 }, r_elbow: { flex: 90, pron: 0 } },
          steps: [
            { by: "examiner", dur: 0.8, hold: 0.4, marks: [{ kind: "push", at: "r_shoulder", dir: "posterior", label: "Empuja la cabeza humeral hacia atrás" }], text: "En la posición de aprensión, empuja la cabeza humeral hacia atrás con la palma sobre la cara anterior del hombro." },
            { to: { r_shoulder: { rot: -90 } }, by: "examiner", dur: 1.6, hold: 1.0, marks: [{ kind: "push", at: "r_shoulder", dir: "posterior", label: "Mantén el empuje" }], text: "Manteniendo el empuje, aumenta algo más la rotación externa." },
          ],
        },
        text: {
          setup: "Paciente en supino con el hombro derecho a 90° de abducción y en rotación externa (posición de aprensión).",
          look: "Positivo si la aprensión desaparece o disminuye al empujar hacia atrás y se tolera más rotación externa.",
        },
        supuestos: ["Posición de aprensión a 75° de rotación externa; con el empuje llega a 90°."],
      },
    ],
    related: ["hom-aprension", "hom-sorpresa"],
  },
  {
    id: "hom-sorpresa",
    region: "hombro",
    group: G_INS,
    name: "Test de sorpresa (release)",
    aka: ["Surprise test", "Anterior release test"],
    kind: "test",
    purpose: "Reproduce la inestabilidad anterior al soltar de repente el empuje posterior del test de recolocación.",
    position: "Decúbito supino, hombro en 90° de abducción y rotación externa con el empuje posterior del test de recolocación.",
    steps: [
      "Haz el test de recolocación y mantén el empuje posterior.",
      "Retira la mano de golpe sin cambiar la posición del brazo.",
      "Observa la reacción del paciente.",
    ],
    positive: "Reaparición brusca de la aprensión (o del dolor) al soltar.",
    interpretation:
      "Es el más específico de los tres: un positivo ayuda mucho a confirmar inestabilidad anterior. Si la aprensión aparece en los tres tests (aprensión, recolocación y sorpresa), el valor predictivo positivo fue del 93,6 % en el mismo estudio.",
    accuracy: [{ ...LO_2004, sens: 63.9, spec: 98.9, context: "Inestabilidad anterior; 46 pacientes, cuatro examinadores ciegos" }],
    utility: "alta",
    cautions: "Puede provocar una subluxación: no lo hagas en hombros muy inestables o con luxación reciente.",
    figures: [
      {
        view: "front",
        posture: "supine",
        joints: { r_shoulder: 90, r_elbow: 90 },
        hands: ["r_wrist", "r_shoulder"],
        grips: [{ kind: "grasp", face: "anterior" }, { kind: "press", face: "anterior" }],
        arrows: [{ at: "r_shoulder", dir: "anterior", kind: "move", label: "suelta" }],
        pain: ["r_shoulder"],
        caption: "Se retira de golpe el empuje posterior",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 90, rot: -85 }, r_elbow: { flex: 90, pron: 0 } },
          steps: [
            { by: "examiner", dur: 0.8, hold: 0.8, marks: [{ kind: "push", at: "r_shoulder", dir: "posterior", label: "Empuje hacia atrás" }], text: "Haz el test de recolocación y mantén el empuje posterior." },
            { by: "examiner", dur: 0.3, hold: 1.6, release: [1], pain: true, text: "Retira la mano de golpe sin cambiar la posición del brazo y mira la reacción del paciente." },
          ],
        },
        text: {
          setup: "Paciente en supino con el hombro derecho a 90° de abducción y en rotación externa, con el empuje posterior del test de recolocación.",
          look: "Positivo si reaparece de golpe la aprensión (o el dolor) al soltar.",
        },
        supuestos: ["Rotación externa de 85°."],
      },
    ],
    related: ["hom-aprension", "hom-recolocacion"],
  },
  {
    id: "hom-surco",
    region: "hombro",
    group: G_INS,
    name: "Signo del surco",
    aka: ["Sulcus sign"],
    kind: "test",
    purpose: "Valora la laxitud inferior de la glenohumeral (sospecha de inestabilidad multidireccional).",
    position: "Paciente sentado, brazo relajado junto al cuerpo. El examinador al lado.",
    steps: [
      "Sujeta el brazo por encima del codo.",
      "Tracciona hacia abajo a lo largo del húmero.",
      "Observa y mide el hueco que aparece bajo el acromion.",
      "Compara con el otro lado y repite en rotación externa.",
    ],
    positive: "Aparece un surco bajo el acromion mayor que en el lado sano (habitualmente > 1-2 cm), sobre todo si reproduce los síntomas.",
    interpretation:
      "Indica laxitud, no necesariamente inestabilidad: muchas personas laxas sanas lo tienen bilateral. Interprétalo junto con la historia (episodios, síntomas) y la laxitud general. Si persiste en rotación externa sugiere lesión del intervalo rotador.",
    accuracy: [],
    utility: "desconocida",
    figures: [
      {
        view: "front",
        posture: "sitting",
        hands: ["r_upperarm@0.85"],
        grips: [{ kind: "grasp", face: "anterior" }],
        arrows: [{ at: "r_elbow", dir: "caudal", label: "tracción" }],
        pain: ["r_shoulder"],
        caption: "Tracción caudal del brazo: surco bajo el acromion",
        side: "r",
        script: {
          steps: [{ shift: { seg: "r_upperarm", dir: "caudal", cm: 1.5 }, by: "examiner", dur: 1.0, hold: 1.4, path: false, text: "Sujeta el brazo por encima del codo y tracciona hacia abajo a lo largo del húmero; mira el hueco bajo el acromion." }],
        },
        text: {
          setup: "Paciente sentado con el brazo derecho relajado junto al cuerpo. El examinador, al lado.",
          look: "Positivo si aparece un surco bajo el acromion mayor que en el lado sano (habitualmente más de 1-2 cm), sobre todo si reproduce los síntomas. Repite en rotación externa.",
        },
        supuestos: ["Se enseña un positivo con un descenso exagerado (1,5 cm); el surco de la piel no se dibuja."],
      },
    ],
    related: ["hom-aprension"],
  },
  {
    id: "hom-jerk",
    region: "hombro",
    group: G_INS,
    name: "Jerk test (aprensión posterior)",
    aka: ["Jerk test", "Test de sacudida"],
    kind: "test",
    purpose: "Detecta inestabilidad posterior y lesión del labrum posteroinferior por subluxación posterior con carga axial.",
    position: "Paciente sentado. El examinador detrás, con una mano fijando la escápula y la otra en el codo.",
    steps: [
      "Lleva el brazo a 90° de flexión (o abducción) con rotación interna y codo a 90°.",
      "Aplica carga axial a lo largo del húmero hacia atrás.",
      "Manteniendo la carga, lleva el brazo en aducción horizontal.",
      "Busca un resalte o chasquido y pregunta por dolor.",
    ],
    positive: "Resalte o salto de la cabeza humeral (al salir o volver a su sitio), con o sin dolor agudo.",
    interpretation:
      "Muy específico: un positivo apoya lesión posteroinferior del labrum. Combinado con el test de Kim la sensibilidad sube al 97 % en el estudio original, así que ambos negativos ayudan a descartar.",
    accuracy: [{ ...KIM_2005, sens: 73, spec: 98, context: "Lesión del labrum posteroinferior frente a artroscopia; 172 hombros" }],
    utility: "alta",
    cautions: "No lo hagas con dolor agudo intenso o luxación posterior reciente.",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { r_shoulder: 90, r_elbow: 90 },
        hands: ["r_elbow", "r_shoulder"],
        grips: [{ kind: "grasp", face: "caudal" }, { kind: "press", face: "posterior" }],
        arrows: [
          { at: "r_elbow", dir: "posterior", label: "carga axial" },
          { at: "r_wrist", dir: "medial", kind: "move", label: "aducción" },
        ],
        pain: ["r_shoulder"],
        caption: "Carga axial hacia atrás y aducción horizontal",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 90, abd: 0, rot: 30 }, r_elbow: { flex: 90, pron: 0 } },
          steps: [
            { by: "examiner", dur: 0.8, hold: 0.4, marks: [{ kind: "push", at: "r_elbow", dir: "posterior", label: "Carga axial hacia atrás" }], text: "Con el brazo a 90° de flexión y en rotación interna, aplica carga axial a lo largo del húmero hacia atrás." },
            { to: { r_shoulder: { abd: -30 } }, by: "examiner", dur: 1.8, hold: 1.0, pain: true, marks: [{ kind: "push", at: "r_elbow", dir: "posterior", label: "Mantén la carga" }], text: "Manteniendo la carga, lleva el brazo en aducción horizontal y busca un resalte." },
          ],
        },
        text: {
          setup: "Paciente sentado. El examinador, detrás, fija la escápula con una mano y sujeta el codo derecho con la otra.",
          look: "Positivo si hay un resalte o salto de la cabeza humeral (al salir o al volver a su sitio), con o sin dolor agudo.",
        },
        supuestos: ["Rotación interna de 30° y aducción horizontal de 30° (la fuente no da grados)."],
      },
    ],
    related: ["hom-kim"],
  },
  {
    id: "hom-kim",
    region: "hombro",
    group: G_INS,
    name: "Test de Kim",
    aka: ["Kim test"],
    kind: "test",
    purpose: "Detecta lesión del labrum posteroinferior con carga axial en elevación diagonal.",
    position: "Paciente sentado con la espalda apoyada. El examinador al lado, sujetando el codo y la parte proximal del brazo.",
    steps: [
      "Lleva el brazo a 90° de abducción.",
      "Aplica carga axial a lo largo del húmero.",
      "Eleva el brazo unos 45° en diagonal mientras empujas la parte proximal hacia abajo y atrás.",
    ],
    positive: "Dolor posterior brusco en el hombro, con o sin chasquido.",
    interpretation:
      "Muy específico y bastante sensible: un positivo ayuda a confirmar. Es más sensible para lesiones inferiores y el jerk test para las posteriores; juntos detectan casi todas.",
    accuracy: [{ ...KIM_2005, sens: 80, spec: 94, context: "Lesión del labrum posteroinferior frente a artroscopia; 172 hombros" }],
    utility: "alta",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { r_shoulder: 90 },
        to: { r_shoulder: 135 },
        hands: ["r_elbow", "r_upperarm@0.3"],
        grips: [{ kind: "grasp", face: "posterior" }, { kind: "press", face: "cranial" }],
        arrows: [
          { at: "r_elbow", dir: "posterior", label: "carga axial" },
          { at: "r_upperarm@0.3", dir: "caudal", label: "abajo-atrás" },
        ],
        pain: ["r_shoulder"],
        caption: "Carga axial y elevación diagonal de 45°",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 90 } },
          steps: [
            { by: "examiner", dur: 0.8, hold: 0.4, marks: [{ kind: "push", at: "r_elbow", dir: "medial", label: "Carga axial" }], text: "Con el brazo a 90° de abducción, aplica carga axial a lo largo del húmero." },
            {
              to: { r_shoulder: { flex: 135, abd: 45 } },
              by: "examiner",
              dur: 2.0,
              hold: 1.0,
              pain: true,
              marks: [{ kind: "push", at: "r_upperarm@0.3", dir: "caudal", label: "Abajo y atrás" }],
              text: "Eleva el brazo unos 45° en diagonal mientras empujas la parte proximal hacia abajo y atrás.",
              label: "Elevación en diagonal",
            },
          ],
        },
        text: {
          setup: "Paciente sentado con la espalda apoyada. El examinador, al lado, sujeta el codo y la parte proximal del brazo.",
          look: "Positivo si aparece un dolor posterior brusco en el hombro, con o sin chasquido.",
        },
        supuestos: ["Elevación diagonal hasta 135° entre el plano frontal y el sagital."],
      },
    ],
    related: ["hom-jerk"],
  },

  // ───────────── Lesión SLAP ─────────────
  {
    id: "hom-obrien",
    region: "hombro",
    group: G_SLAP,
    name: "Test de O'Brien (compresión activa)",
    aka: ["Active compression test", "O'Brien test"],
    kind: "test",
    purpose: "Busca dolor de origen labral superior o acromioclavicular al resistir la flexión con el brazo en aducción y rotación interna.",
    position: "Paciente de pie. El examinador, delante o detrás del lado explorado.",
    steps: [
      "Coloca el brazo a 90° de flexión, 10-15° de aducción horizontal y codo extendido.",
      "Rota internamente (pulgar hacia abajo) y empuja el antebrazo hacia abajo mientras el paciente resiste.",
      "Repite con la palma hacia arriba (rotación externa).",
      "Pregunta dónde nota el dolor en cada fase.",
    ],
    positive: "Dolor con el pulgar abajo que disminuye con la palma arriba. Si el dolor es profundo (dentro del hombro) orienta a SLAP; si es encima del hombro, a la acromioclavicular.",
    interpretation:
      "Para SLAP aporta muy poco: ni confirma ni descarta. Para la acromioclavicular es bastante específico (si el dolor es encima del hombro) y entra en el cluster acromioclavicular.",
    accuracy: [
      { ...HEGEDUS_2012, sens: 67, spec: 37, context: "Lesión SLAP; metaanálisis (cifras citadas en fuentes secundarias)" },
      { ...CHRONOPOULOS_2004, sens: 41, spec: 95, context: "Lesión acromioclavicular crónica; casos y controles, 35 pacientes operados" },
    ],
    utility: "baja",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { r_shoulder: 90 },
        hands: ["r_wrist"],
        grips: [{ kind: "press", face: "cranial" }],
        arrows: [
          { at: "r_wrist", dir: "caudal", label: "resiste" },
          { at: "r_forearm@0.5", rotate: "cw", label: "pulgar abajo" },
        ],
        pain: ["r_shoulder"],
        caption: "Flexión de 90° en aducción y RI: resistencia hacia abajo",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 90, abd: -15, rot: 0 }, r_elbow: { flex: 5, pron: 0 } },
          steps: [
            { to: { r_shoulder: { rot: 80 }, r_elbow: { pron: 90 } }, by: "patient", dur: 1.2, text: "Con el brazo a 90° de flexión y 15° de aducción horizontal, gira el pulgar hacia abajo.", label: "Pulgar hacia abajo" },
            { by: "examiner", dur: 0.8, hold: 1.0, pain: true, marks: [{ kind: "push", at: "r_forearm@0.7", dir: "caudal", label: "Empuja hacia abajo; resiste" }], text: "Empuja el antebrazo hacia abajo mientras el paciente resiste. Pregunta dónde duele." },
            { to: { r_shoulder: { rot: 0 }, r_elbow: { pron: -85 } }, by: "patient", dur: 1.4, text: "Repite con la palma hacia arriba.", label: "Palma hacia arriba" },
            { by: "examiner", dur: 0.8, hold: 1.2, painEnd: true, marks: [{ kind: "push", at: "r_forearm@0.7", dir: "caudal", label: "Empuja hacia abajo; resiste" }], text: "Empuja otra vez: con la palma arriba el dolor disminuye." },
          ],
        },
        text: {
          setup: "Paciente de pie con el brazo derecho a 90° de flexión, 15° de aducción horizontal y el codo extendido. El examinador, delante.",
          look: "Positivo si duele con el pulgar abajo y disminuye con la palma arriba. Dolor profundo (dentro del hombro): SLAP. Dolor encima del hombro: acromioclavicular.",
        },
        supuestos: ["Se enseña un positivo.", "Pulgar abajo con 80° de rotación interna y 90° de pronación."],
      },
    ],
    related: ["hom-biceps-load-ii", "hom-cluster-acromioclavicular"],
  },
  {
    id: "hom-biceps-load-ii",
    region: "hombro",
    group: G_SLAP,
    name: "Test de carga del bíceps II",
    aka: ["Biceps load test II"],
    kind: "test",
    purpose: "Tensa el anclaje del bíceps en el labrum superior con flexión resistida del codo en abducción y rotación externa.",
    position: "Paciente en decúbito supino. El examinador al lado, sujetando muñeca y codo.",
    steps: [
      "Lleva el hombro a 120° de abducción y rotación externa máxima.",
      "Coloca el codo a 90° de flexión con el antebrazo en supinación.",
      "Pide al paciente que flexione el codo contra tu resistencia.",
    ],
    positive: "Aparece o aumenta el dolor en el hombro con la flexión resistida.",
    interpretation:
      "En el estudio de sus autores tuvo muy buena precisión, pero es un único estudio sin replicar con la misma calidad; tómalo como apoyo, no como confirmación. Combínalo con la historia (mecanismo de tracción o lanzamiento) y otras pruebas.",
    accuracy: [{ source: "Kim et al., 2001", citation: "Kim SH, et al. Biceps load test II: a clinical test for SLAP lesions of the shoulder. Arthroscopy. 2001;17(2):160-164.", sens: 89.7, spec: 96.9, context: "Lesión SLAP frente a artroscopia; estudio prospectivo de los autores del test, 127 pacientes" }],
    utility: "alta",
    figures: [
      {
        view: "front",
        posture: "supine",
        joints: { r_shoulder: 120, r_elbow: 90 },
        hands: ["r_wrist", "r_elbow"],
        grips: [{ kind: "grasp", face: "anterior" }, { kind: "grasp", face: "posterior" }],
        arrows: [{ at: "r_elbow", rotate: "cw", label: "flexión" }],
        pain: ["r_shoulder"],
        caption: "120° de abducción y RE: flexión de codo resistida",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 120, rot: -85 }, r_elbow: { flex: 90, pron: -80 } },
          steps: [{ by: "patient", dur: 0.8, hold: 1.6, pain: true, marks: [{ kind: "resist", joint: "r_elbow", dof: "flex", sign: 1, label: "Flexiona el codo contra la mano" }], text: "Con el hombro a 120° de abducción y en rotación externa máxima, pide que flexione el codo contra tu resistencia." }],
        },
        text: {
          setup: "Paciente en supino con el hombro derecho a 120° de abducción y en rotación externa máxima, el codo a 90° y el antebrazo en supinación. El examinador sujeta la muñeca y el codo.",
          look: "Positivo si aparece o aumenta el dolor en el hombro con la flexión resistida.",
        },
        supuestos: ["Rotación externa máxima tomada como 85°."],
        place: { stance: "stand", from: "side" },
      },
    ],
    related: ["hom-obrien", "hom-crank"],
  },
  {
    id: "hom-crank",
    region: "hombro",
    group: G_SLAP,
    name: "Crank test",
    aka: ["Crank test (Liu)", "Test de manivela"],
    kind: "test",
    purpose: "Atrapa el labrum entre húmero y glenoides con carga axial y rotaciones en elevación máxima.",
    position: "Paciente sentado o en decúbito supino. El examinador sujeta el codo y la muñeca.",
    steps: [
      "Eleva el brazo a unos 160° en el plano escapular con el codo flexionado.",
      "Aplica carga axial a lo largo del húmero.",
      "Rota interna y externamente el húmero manteniendo la carga.",
    ],
    positive: "Dolor, con o sin chasquido o bloqueo, durante las rotaciones (sobre todo en rotación externa).",
    interpretation:
      "Las cifras altas proceden del estudio original; trabajos posteriores han encontrado una precisión menor. Úsalo junto a otras pruebas y la historia; no confirma una lesión SLAP por sí solo.",
    accuracy: [{ source: "Liu et al., 1996", citation: "Liu SH, et al. A prospective evaluation of a new physical examination in predicting glenoid labral tears. Am J Sports Med. 1996;24(6):721-725.", sens: 91, spec: 93, context: "Rotura del labrum; estudio original del test (cifras citadas en una revisión secundaria)" }],
    utility: "alta",
    figures: [
      {
        view: "front",
        posture: "supine",
        joints: { r_shoulder: 160, r_elbow: 90 },
        pose3d: { r_shoulder: { abd: 160 }, r_elbow: { flex: 90 } },
        hands: ["r_elbow", "r_wrist"],
        grips: [{ kind: "grasp", face: "cranial" }, { kind: "grasp", face: "anterior" }],
        arrows: [
          { at: "r_elbow", dir: "caudal", label: "carga axial" },
          { at: "r_forearm@0.7", rotate: "cw", label: "RI/RE" },
        ],
        pain: ["r_shoulder"],
        caption: "Elevación máxima con carga axial y rotaciones",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 160, rot: 0 }, r_elbow: { flex: 90, pron: 0 } },
          steps: [
            { by: "examiner", dur: 0.8, hold: 0.3, marks: [{ kind: "push", at: "r_elbow", dir: "caudal", label: "Carga axial" }], text: "Con el brazo elevado a unos 160°, aplica carga axial a lo largo del húmero." },
            { to: { r_shoulder: { rot: 40 } }, by: "examiner", dur: 1.4, marks: [{ kind: "push", at: "r_elbow", dir: "caudal", label: "" }], text: "Manteniendo la carga, rota internamente…" },
            { to: { r_shoulder: { rot: -40 } }, by: "examiner", dur: 2.0, hold: 1.0, pain: true, marks: [{ kind: "push", at: "r_elbow", dir: "caudal", label: "" }], text: "…y externamente (sobre todo duele en rotación externa)." },
          ],
        },
        text: {
          setup: "Paciente en supino con el brazo derecho elevado a unos 160° y el codo flexionado. El examinador sujeta el codo y la muñeca.",
          look: "Positivo si aparece dolor, con o sin chasquido o bloqueo, durante las rotaciones (sobre todo en rotación externa).",
        },
        supuestos: ["Elevación en el plano frontal (la fuente dice plano escapular) y rotaciones de 40° (la fuente no da grados)."],
        place: { stance: "sit", from: "side" },
      },
    ],
    related: ["hom-compresion-rotacion", "hom-biceps-load-ii"],
  },
  {
    id: "hom-compresion-rotacion",
    region: "hombro",
    group: G_SLAP,
    name: "Test de compresión-rotación",
    aka: ["Compression-rotation test", "Grind test de hombro"],
    kind: "test",
    purpose: "Busca atrapamiento del labrum comprimiendo la cabeza humeral contra la glenoides mientras se rota.",
    position: "Paciente en decúbito supino. El examinador sujeta el codo y la muñeca.",
    steps: [
      "Lleva el hombro a 90° de abducción con el codo a 90°.",
      "Empuja el húmero hacia la glenoides a lo largo de su eje.",
      "Rota el húmero en pequeños círculos y en rotación interna y externa.",
    ],
    positive: "Dolor con chasquido o sensación de enganche dentro del hombro.",
    interpretation:
      "En el metaanálisis tuvo la mejor razón de verosimilitud positiva para SLAP, pero modesta: aumenta algo la sospecha sin confirmarla. Combínalo con historia y otras pruebas.",
    accuracy: [{ ...HEGEDUS_2012, lrPos: 2.81, context: "Lesión SLAP; metaanálisis" }],
    utility: "moderada",
    figures: [
      {
        view: "front",
        posture: "supine",
        joints: { r_shoulder: 90, r_elbow: 90 },
        hands: ["r_elbow", "r_wrist"],
        grips: [{ kind: "press", face: "lateral" }, { kind: "grasp", face: "anterior" }],
        arrows: [
          { at: "r_elbow", dir: "medial", label: "compresión" },
          { at: "r_forearm@0.6", rotate: "cw", label: "rotación" },
        ],
        pain: ["r_shoulder"],
        caption: "Compresión axial del húmero y rotaciones",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 90, rot: 0 }, r_elbow: { flex: 90, pron: 0 } },
          steps: [
            { by: "examiner", dur: 0.8, hold: 0.3, marks: [{ kind: "push", at: "r_elbow", dir: "medial", label: "Compresión hacia la glenoides" }], text: "Empuja el húmero hacia la glenoides a lo largo de su eje." },
            { to: { r_shoulder: { rot: 40 } }, by: "examiner", dur: 1.4, marks: [{ kind: "push", at: "r_elbow", dir: "medial", label: "" }], text: "Manteniendo la compresión, rota el húmero hacia dentro…" },
            { to: { r_shoulder: { rot: -40 } }, by: "examiner", dur: 2.0, hold: 1.0, pain: true, marks: [{ kind: "push", at: "r_elbow", dir: "medial", label: "" }], text: "…y hacia fuera (también en pequeños círculos)." },
          ],
        },
        text: {
          setup: "Paciente en supino con el hombro derecho a 90° de abducción y el codo a 90°. El examinador sujeta el codo y la muñeca.",
          look: "Positivo si duele con chasquido o sensación de enganche dentro del hombro.",
        },
        supuestos: ["Rotaciones de 40°; los pequeños círculos no se dibujan."],
        place: { stance: "sit", from: "side" },
      },
    ],
    related: ["hom-crank"],
  },

  // ───────────── Porción larga del bíceps ─────────────
  {
    id: "hom-speed",
    region: "hombro",
    group: G_BIC,
    name: "Test de Speed",
    aka: ["Speed's test", "Palm-up test"],
    kind: "test",
    purpose: "Provoca dolor en la corredera bicipital resistiendo la flexión del hombro con el codo extendido y la palma hacia arriba.",
    position: "Paciente de pie. El examinador delante, con una mano en el antebrazo y la otra palpando la corredera bicipital.",
    steps: [
      "Coloca el hombro a unos 90° de flexión, codo extendido y antebrazo en supinación.",
      "Empuja el antebrazo hacia abajo mientras el paciente resiste.",
      "Pregunta por dolor en la cara anterior del hombro.",
    ],
    positive: "Dolor localizado en la corredera bicipital.",
    interpretation:
      "Poco útil por sí solo: algo específico para patología del bíceps, pero para SLAP aporta poco. Combínalo con el upper cut.",
    accuracy: [
      { ...KIBLER_2009, spec: 81, context: "Patología del bíceps; 101 pacientes operados" },
      { ...HEGEDUS_2008, sens: 32, spec: 61, context: "Lesión SLAP; metaanálisis" },
    ],
    utility: "baja",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { r_shoulder: 90 },
        hands: ["r_wrist", "r_upperarm@0.1"],
        grips: [{ kind: "press", face: "cranial" }, { kind: "tips", face: "cranial" }],
        arrows: [{ at: "r_wrist", dir: "caudal", label: "resiste" }],
        pain: ["r_upperarm@0.12"],
        caption: "Flexión resistida con codo extendido y palma arriba",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 90, abd: 0, rot: 0 }, r_elbow: { flex: 5, pron: -85 } },
          steps: [{ by: "examiner", dur: 0.8, hold: 1.6, pain: true, marks: [{ kind: "push", at: "r_wrist", dir: "caudal", label: "Empuja hacia abajo; resiste" }], text: "Con el codo extendido y la palma hacia arriba, empuja el antebrazo hacia abajo mientras el paciente resiste y palpas la corredera." }],
        },
        text: {
          setup: "Paciente de pie con el hombro derecho a 90° de flexión, el codo extendido y el antebrazo en supinación. Una mano en el antebrazo y la otra palpa la corredera bicipital.",
          look: "Positivo si el dolor se localiza en la corredera bicipital.",
        },
      },
    ],
    related: ["hom-upper-cut", "hom-yergason"],
  },
  {
    id: "hom-yergason",
    region: "hombro",
    group: G_BIC,
    name: "Test de Yergason",
    aka: ["Yergason's test"],
    kind: "test",
    purpose: "Provoca dolor o inestabilidad de la porción larga del bíceps con supinación y rotación externa resistidas.",
    position: "Paciente de pie o sentado, codo a 90° pegado al cuerpo y antebrazo en pronación. El examinador delante.",
    steps: [
      "Sujeta la muñeca del paciente y palpa la corredera bicipital con la otra mano.",
      "Pide que supine el antebrazo y rote hacia fuera contra tu resistencia.",
      "Pregunta por dolor y palpa si el tendón se sale de la corredera.",
    ],
    positive: "Dolor en la corredera bicipital o sensación de que el tendón se luxa.",
    interpretation:
      "Muy específico para SLAP según el metaanálisis, pero poco sensible y sus razones de verosimilitud en estudios con artroscopia no son concluyentes. Úsalo como apoyo, no para descartar.",
    accuracy: [{ ...HEGEDUS_2012, spec: 95, context: "Lesión SLAP; metaanálisis (la especificidad más alta de las pruebas analizadas)" }],
    utility: "baja",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { r_elbow: 90 },
        hands: ["r_wrist", "r_upperarm@0.1"],
        grips: [{ kind: "grasp", face: "anterior" }, { kind: "tips", face: "anterior" }],
        arrows: [{ at: "r_forearm@0.7", rotate: "ccw", label: "supinación" }],
        pain: ["r_upperarm@0.12"],
        caption: "Codo a 90°: supinación y RE contra resistencia",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 0, rot: 0 }, r_elbow: { flex: 90, pron: 70 } },
          steps: [{ by: "patient", dur: 0.8, hold: 1.6, pain: true, marks: [{ kind: "resist", joint: "r_elbow", dof: "pron", sign: -1, label: "Supina contra la mano" }], text: "Pide que supine el antebrazo y rote hacia fuera contra tu resistencia; palpa la corredera." }],
        },
        text: {
          setup: "Paciente de pie con el codo derecho a 90° pegado al cuerpo y el antebrazo en pronación. Una mano sujeta la muñeca y la otra palpa la corredera bicipital.",
          look: "Positivo si duele la corredera bicipital o se nota que el tendón se luxa.",
        },
        supuestos: ["Solo se dibuja la resistencia a la supinación; la rotación externa va en el texto."],
      },
    ],
    related: ["hom-speed", "hom-upper-cut"],
  },
  {
    id: "hom-upper-cut",
    region: "hombro",
    group: G_BIC,
    name: "Test del upper cut",
    aka: ["Upper cut test"],
    kind: "test",
    purpose: "Provoca dolor de la porción larga del bíceps con un gesto de gancho de boxeo contra resistencia.",
    position: "Paciente de pie, brazo junto al cuerpo, codo a 90°, antebrazo en supinación y puño cerrado. El examinador delante.",
    steps: [
      "Coloca tu mano sobre el puño del paciente.",
      "Pide un gancho hacia arriba (flexión de hombro y codo) hacia la barbilla contra tu resistencia.",
      "Pregunta por dolor en la cara anterior del hombro.",
    ],
    positive: "Dolor o chasquido doloroso en la cara anterior del hombro durante el gesto.",
    interpretation:
      "Fue la prueba más precisa para patología del bíceps en su estudio, con razón de verosimilitud positiva moderada. Combinado con Speed mejora la detección de lesiones del bíceps.",
    accuracy: [{ ...KIBLER_2009, sens: 73, lrPos: 3.38, context: "Patología del bíceps; 101 pacientes operados" }],
    utility: "moderada",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { r_elbow: 90 },
        to: { r_shoulder: 50, r_elbow: 120 },
        hands: ["r_hand"],
        grips: [{ kind: "press", face: "cranial" }],
        arrows: [{ at: "r_hand", dir: "caudal", label: "resiste" }],
        pain: ["r_upperarm@0.12"],
        caption: "Gancho hacia la barbilla contra la mano del examinador",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0 }, r_elbow: { flex: 90, pron: -80 } },
          steps: [{ by: "patient", dur: 0.8, hold: 1.6, pain: true, marks: [{ kind: "resist", joint: "r_shoulder", dof: "flex", sign: 1, label: "Gancho hacia la barbilla" }], text: "Con tu mano sobre su puño, pide un gancho hacia arriba, hacia la barbilla, contra tu resistencia." }],
        },
        text: {
          setup: "Paciente de pie con el brazo derecho junto al cuerpo, el codo a 90°, el antebrazo en supinación y el puño cerrado. El examinador, delante.",
          look: "Positivo si aparece dolor o un chasquido doloroso en la cara anterior del hombro durante el gesto.",
        },
        supuestos: ["Se dibuja como un esfuerzo isométrico (el examinador no deja que el puño suba)."],
      },
    ],
    related: ["hom-speed", "hom-yergason"],
  },

  // ───────────── Articulación acromioclavicular ─────────────
  {
    id: "hom-aduccion-horizontal",
    region: "hombro",
    group: G_AC,
    name: "Aducción horizontal cruzada",
    aka: ["Cross-body adduction test", "Scarf test", "Cross-arm test"],
    kind: "test",
    purpose: "Comprime la articulación acromioclavicular llevando el brazo en aducción horizontal por delante del tronco.",
    position: "Paciente de pie o sentado. El examinador al lado, sujetando el codo.",
    steps: [
      "Lleva el brazo a 90° de flexión.",
      "Empújalo en aducción horizontal hacia el hombro contrario hasta el final del recorrido.",
      "Pregunta dónde aparece el dolor.",
    ],
    positive: "Dolor localizado encima del hombro, en la articulación acromioclavicular.",
    interpretation:
      "Es la prueba más sensible para la acromioclavicular: un negativo ayuda bastante a descartarla. Un positivo aumenta de forma moderada la probabilidad; combínalo con O'Brien y extensión resistida (cluster acromioclavicular).",
    accuracy: [{ ...CHRONOPOULOS_2004, sens: 77, spec: 79, lrPos: 3.67, lrNeg: 0.29, context: "Lesión acromioclavicular crónica; casos y controles, 35 pacientes operados" }],
    utility: "moderada",
    figures: [
      {
        view: "front",
        posture: "standing",
        joints: { r_shoulder: -90 },
        pose3d: { r_shoulder: { flex: 90, abd: -40 }, r_elbow: { flex: 10 } },
        hands: ["r_elbow"],
        grips: [{ kind: "press", face: "lateral" }],
        arrows: [{ at: "r_elbow", dir: "medial", label: "aducción" }],
        pain: ["r_shoulder"],
        caption: "Brazo a 90° llevado hacia el hombro contrario",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 90, abd: 0 }, r_elbow: { flex: 10 } },
          steps: [{ to: { r_shoulder: { abd: -40 } }, by: "examiner", dur: 1.8, hold: 1.0, pain: true, marks: [{ kind: "push", at: "r_elbow", dir: "medial", label: "Hacia el hombro contrario" }], text: "Con el brazo a 90° de flexión, empújalo en aducción horizontal hacia el hombro contrario hasta el final del recorrido.", label: "Aducción horizontal 40°" }],
        },
        text: {
          setup: "Paciente de pie con el brazo derecho a 90° de flexión. El examinador, al lado, sujeta el codo.",
          look: "Positivo si el dolor se localiza encima del hombro, en la articulación acromioclavicular.",
        },
        supuestos: ["Aducción horizontal de 40° (la fuente dice «hasta el final del recorrido»)."],
      },
    ],
    related: ["hom-paxinos", "hom-cluster-acromioclavicular"],
  },
  {
    id: "hom-paxinos",
    region: "hombro",
    group: G_AC,
    name: "Signo de Paxinos",
    aka: ["Paxinos sign", "Paxinos test"],
    kind: "test",
    purpose: "Provoca dolor acromioclavicular comprimiendo acromion y clavícula entre el pulgar y los dedos.",
    position: "Paciente sentado con el brazo relajado junto al cuerpo. El examinador detrás o al lado.",
    steps: [
      "Coloca el pulgar bajo la cara posterolateral del acromion.",
      "Apoya el índice y el medio sobre el tercio medio de la clavícula.",
      "Empuja el acromion hacia delante y arriba y la clavícula hacia abajo a la vez.",
    ],
    positive: "Aparece o aumenta el dolor en la articulación acromioclavicular.",
    interpretation:
      "Bastante sensible pero poco específico: un negativo ayuda algo a descartar. En el estudio original, Paxinos positivo junto con gammagrafía positiva dio una probabilidad postest muy alta.",
    accuracy: [
      {
        source: "Walton et al., 2004",
        citation: "Walton J, et al. Diagnostic values of tests for acromioclavicular joint pain. J Bone Joint Surg Am. 2004;86(4):807-812.",
        doi: "10.2106/00004623-200404000-00021",
        sens: 79,
        lrPos: 1.58,
        lrNeg: 0.42,
        context: "Dolor acromioclavicular confirmado por infiltración; 38 pacientes (razones de verosimilitud citadas en fuente secundaria)",
      },
    ],
    utility: "moderada",
    figures: [
      {
        view: "side",
        posture: "sitting",
        hands: ["r_shoulder"],
        grips: [{ kind: "grasp", face: "cranial" }],
        arrows: [
          { at: "r_shoulder", dir: "anterior", label: "acromion" },
          { at: "trunk@0.97", dir: "caudal", label: "clavícula" },
        ],
        pain: ["r_shoulder"],
        caption: "Acromion hacia delante y arriba, clavícula hacia abajo",
        side: "r",
        script: {
          steps: [
            {
              by: "examiner",
              dur: 0.8,
              hold: 1.6,
              pain: true,
              marks: [
                { kind: "push", at: "r_shoulder", dir: "anterior", label: "Acromion hacia delante y arriba" },
                { kind: "push", at: "trunk@0.97", dir: "caudal", label: "Clavícula hacia abajo" },
              ],
              text: "Con el pulgar bajo la cara posterolateral del acromion y dos dedos sobre la clavícula, empuja el acromion hacia delante y arriba y la clavícula hacia abajo a la vez.",
            },
          ],
        },
        text: {
          setup: "Paciente sentado con el brazo derecho relajado junto al cuerpo. El examinador, detrás o al lado.",
          look: "Positivo si aparece o aumenta el dolor en la articulación acromioclavicular.",
        },
      },
    ],
    related: ["hom-aduccion-horizontal", "hom-cluster-acromioclavicular"],
  },
  {
    id: "hom-cluster-acromioclavicular",
    region: "hombro",
    group: G_AC,
    name: "Cluster acromioclavicular (Chronopoulos)",
    aka: ["AC joint cluster"],
    kind: "cluster",
    purpose: "Combina tres pruebas para confirmar que el dolor viene de la articulación acromioclavicular.",
    position: "Paciente de pie o sentado. Se hacen las tres pruebas seguidas.",
    steps: [
      "Aducción horizontal cruzada.",
      "Extensión resistida acromioclavicular: brazo a 90° de flexión y 90° de rotación interna con el codo a 90°; el paciente empuja hacia atrás (abducción horizontal) contra resistencia.",
      "Test de O'Brien (compresión activa) buscando dolor encima del hombro.",
      "Cuenta cuántas son positivas.",
    ],
    positive: "Las tres positivas con dolor localizado en la acromioclavicular.",
    interpretation:
      "Con las tres positivas es muy específico y ayuda a confirmar; como es poco sensible, para descartar es mejor una aducción horizontal negativa. La infiltración anestésica diagnóstica sigue siendo la referencia.",
    accuracy: [{ ...CHRONOPOULOS_2004, sens: 25, spec: 97, context: "3 de 3 positivas; lesión acromioclavicular crónica (cifras del cluster citadas en fuente secundaria)" }],
    utility: "alta",
    figures: [
      {
        view: "front",
        posture: "standing",
        joints: { r_shoulder: -90 },
        pose3d: { r_shoulder: { flex: 90, abd: -40 }, r_elbow: { flex: 10 } },
        hands: ["r_elbow"],
        grips: [{ kind: "press", face: "lateral" }],
        arrows: [{ at: "r_elbow", dir: "medial", label: "aducción" }],
        pain: ["r_shoulder"],
        caption: "Aducción horizontal + extensión resistida + O'Brien",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 90, abd: 0 }, r_elbow: { flex: 10 } },
          steps: [{ to: { r_shoulder: { abd: -40 } }, by: "examiner", dur: 1.8, hold: 1.0, pain: true, marks: [{ kind: "push", at: "r_elbow", dir: "medial", label: "Hacia el hombro contrario" }], text: "Con el brazo a 90° de flexión, empújalo en aducción horizontal hacia el hombro contrario hasta el final del recorrido.", label: "Aducción horizontal 40°" }],
        },
        text: {
          setup: "Paciente de pie. Se hacen seguidas tres pruebas: aducción horizontal cruzada, extensión resistida acromioclavicular y O'Brien.",
          look: "Positivo si las tres dan dolor localizado en la acromioclavicular.",
        },
        supuestos: ["Solo se dibuja una de las tres pruebas (la aducción horizontal, hasta 40°)."],
      },
    ],
    related: ["hom-aduccion-horizontal", "hom-obrien", "hom-paxinos"],
  },

  // ───────────── Capsulitis adhesiva ─────────────
  {
    id: "hom-patron-capsular",
    region: "hombro",
    group: G_CAP,
    name: "Pérdida de rotación externa pasiva (patrón capsular)",
    aka: ["Capsular pattern", "Passive external rotation loss"],
    kind: "test",
    purpose: "Reconoce la rigidez capsular comprobando que la rotación externa pasiva con el brazo junto al cuerpo está muy limitada.",
    position: "Paciente en decúbito supino o sentado, codo a 90° pegado al costado. El examinador sujeta codo y muñeca.",
    steps: [
      "Mide la rotación externa activa y luego la pasiva con el brazo junto al cuerpo.",
      "Compara con el lado sano.",
      "Valora también abducción y rotación interna pasivas.",
      "Fíjate en el tope final: firme y doloroso en la capsulitis.",
    ],
    positive: "Rotación externa pasiva muy reducida (a menudo menos de la mitad que el lado sano), igual de limitada en activo y en pasivo, con abducción y rotación interna también limitadas.",
    interpretation:
      "Es la base clínica del diagnóstico: la pérdida pasiva distingue la capsulitis de los problemas del manguito, en los que el pasivo suele conservarse. Antes de diagnosticarla, descarta artrosis glenohumeral y luxación posterior con una radiografía.",
    accuracy: [],
    utility: "desconocida",
    cautions: "Una limitación pasiva global tras un traumatismo exige descartar luxación posterior o fractura con radiografía.",
    figures: [
      {
        view: "front",
        posture: "standing",
        joints: { r_elbow: 30, l_elbow: 90 },
        hands: ["r_wrist", "r_elbow"],
        grips: [{ kind: "grasp", face: "anterior" }, { kind: "press", face: "lateral" }],
        arrows: [{ at: "r_forearm@0.8", rotate: "cw", label: "RE pasiva" }],
        pain: ["r_shoulder"],
        caption: "RE pasiva con el codo pegado: muy limitada frente al lado sano",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 0, rot: 0 }, r_elbow: { flex: 90, pron: 0 } },
          steps: [{ to: { r_shoulder: { rot: -25 } }, by: "examiner", dur: 1.8, hold: 1.2, pain: true, text: "Con el codo pegado al costado, lleva el hombro a rotación externa pasiva: se para pronto, con un tope firme y doloroso.", label: "RE 25°" }],
        },
        text: {
          setup: "Paciente de pie con el codo derecho a 90° pegado al costado. El examinador sujeta el codo y la muñeca.",
          look: "Positivo si la rotación externa pasiva está muy reducida (a menudo menos de la mitad que en el lado sano), igual en activo que en pasivo, y también se limitan la abducción y la rotación interna.",
        },
        supuestos: ["Se enseña un positivo: 25° de rotación externa (en un hombro sano, unos 60° o más)."],
      },
    ],
    related: ["hom-dolor-coracoideo"],
  },
  {
    id: "hom-dolor-coracoideo",
    region: "hombro",
    group: G_CAP,
    name: "Test del dolor coracoideo",
    aka: ["Coracoid pain test"],
    kind: "test",
    purpose: "Orienta a capsulitis adhesiva por dolor a la presión de la coracoides mayor que en otras zonas del hombro.",
    position: "Paciente sentado. El examinador delante.",
    steps: [
      "Presiona la apófisis coracoides con el pulgar.",
      "Presiona también la acromioclavicular y la zona subacromial anterolateral.",
      "Pide al paciente que puntúe el dolor de cada zona de 0 a 10.",
    ],
    positive: "El dolor en la coracoides supera en más de 3 puntos al de las otras dos zonas.",
    interpretation:
      "En su estudio original fue muy sensible y específico frente a otras patologías del hombro, por lo que un negativo ayuda a descartar capsulitis. Úsalo junto a la pérdida de rotación externa pasiva; falta confirmación en otros estudios.",
    accuracy: [
      {
        source: "Carbone et al., 2010",
        citation: "Carbone S, et al. Coracoid pain test: a new clinical sign of shoulder adhesive capsulitis. Int Orthop. 2010;34(3):385-388.",
        sens: 96,
        spec: 87,
        context: "Capsulitis frente a rotura del manguito, tendinitis calcificante, artrosis glenohumeral o acromioclavicular (especificidad 87-89 %)",
      },
    ],
    utility: "alta",
    figures: [
      {
        view: "front",
        posture: "sitting",
        hands: ["r_shoulder"],
        grips: [{ kind: "tips", face: "anterior" }],
        arrows: [{ at: "r_shoulder", dir: "posterior", label: "presión" }],
        pain: ["r_shoulder"],
        caption: "Presión sobre la coracoides",
        side: "r",
        script: {
          steps: [{ by: "examiner", dur: 0.8, hold: 1.6, path: false, pain: true, marks: [{ kind: "push", at: "r_shoulder", dir: "posterior", label: "Presiona la coracoides" }], text: "Presiona la apófisis coracoides con el pulgar; después, la acromioclavicular y la zona subacromial anterolateral. Pide una puntuación de 0 a 10 de cada zona." }],
        },
        text: {
          setup: "Paciente sentado. El examinador, delante.",
          look: "Positivo si el dolor en la coracoides supera en más de 3 puntos al de las otras dos zonas.",
        },
        supuestos: ["Solo se dibuja la presión sobre la coracoides."],
      },
    ],
    related: ["hom-patron-capsular"],
  },

  // ───────────── Síndrome del desfiladero torácico ─────────────
  {
    id: "hom-roos",
    region: "hombro",
    group: G_TOS,
    name: "Test de Roos (EAST)",
    aka: ["Elevated arm stress test", "Roos test", "Test de estrés con brazos elevados"],
    kind: "test",
    purpose: "Reproduce los síntomas del desfiladero torácico manteniendo los brazos en 90/90 mientras se abren y cierran las manos.",
    position: "Paciente sentado o de pie con ambos hombros a 90° de abducción y rotación externa y codos a 90°.",
    steps: [
      "Coloca los brazos en posición de «manos arriba» (90/90), con los hombros un poco hacia atrás.",
      "Pide que abra y cierre las manos despacio durante hasta 3 minutos.",
      "Observa el color de las manos y pregunta por síntomas.",
    ],
    positive: "Reproduce los síntomas habituales (hormigueo, pesadez, dolor, fatiga) o el paciente no completa los 3 minutos.",
    interpretation:
      "Da muchos falsos positivos, también en personas sanas: no lo uses para confirmar. En Gillard et al. (2001) las pruebas de provocación tuvieron de media una sensibilidad del 72 % y una especificidad del 53 %; la combinación de varias pruebas positivas mejora la especificidad.",
    accuracy: [],
    utility: "desconocida",
    cautions: "Signos de alarma vascular (frialdad, palidez o cianosis, edema del brazo, úlceras digitales) requieren derivación urgente, no más pruebas.",
    figures: [
      {
        view: "front",
        posture: "sitting",
        joints: { r_shoulder: 90, r_elbow: 90, l_shoulder: 90, l_elbow: 90 },
        arrows: [
          { at: "r_hand", rotate: "cw", label: "abre/cierra" },
          { at: "l_hand", rotate: "ccw", label: "abre/cierra" },
        ],
        pain: ["r_forearm@0.5"],
        caption: "Brazos en 90/90 abriendo y cerrando las manos hasta 3 minutos",
        side: "both",
        script: {
          start: { r_shoulder: { flex: 0, abd: 90, rot: -90 }, l_shoulder: { flex: 0, abd: 90, rot: -90 }, r_elbow: { flex: 90, pron: 0 }, l_elbow: { flex: 90, pron: 0 } },
          steps: [{ by: "patient", dur: 1.0, hold: 2.0, path: false, pain: true, text: "Con los brazos en «manos arriba» (90/90), pide que abra y cierre las manos despacio durante hasta 3 minutos." }],
        },
        text: {
          setup: "Paciente sentado con los dos hombros a 90° de abducción y rotación externa y los codos a 90°, con los hombros un poco hacia atrás.",
          look: "Positivo si reproduce sus síntomas (hormigueo, pesadez, dolor, fatiga) o no completa los 3 minutos. Observa el color de las manos.",
        },
        supuestos: ["Los dedos del maniquí no se abren ni se cierran: va en el texto."],
      },
    ],
    related: ["hom-adson", "hom-wright"],
  },
  {
    id: "hom-adson",
    region: "hombro",
    group: G_TOS,
    name: "Test de Adson",
    aka: ["Adson's test", "Maniobra de Adson"],
    kind: "test",
    purpose: "Busca compresión de la arteria subclavia en el desfiladero de los escalenos.",
    position: "Paciente sentado. El examinador detrás o al lado, palpando el pulso radial.",
    steps: [
      "Palpa el pulso radial con el brazo ligeramente separado y extendido.",
      "Pide al paciente que extienda el cuello y gire la cabeza hacia el lado explorado.",
      "Pide que inspire hondo y aguante la respiración.",
      "Valora cambios del pulso y la aparición de síntomas.",
    ],
    positive: "Reproducción de los síntomas del paciente; la disminución o desaparición del pulso por sí sola es frecuente en personas sanas.",
    interpretation:
      "Poco específico: muchos sanos pierden el pulso en esta maniobra. Valóralo solo junto a otras pruebas de provocación y la clínica; la reproducción de síntomas es más relevante que el cambio de pulso.",
    accuracy: [],
    utility: "desconocida",
    cautions: "Interrumpe la maniobra si aparece mareo. No lo hagas con sospecha de patología vascular cervical o arteria vertebral.",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { neck: -20, r_shoulder: -15 },
        pose3d: { r_shoulder: { flex: -10, abd: 40, rot: -20 }, r_elbow: { flex: 8 } },
        hands: ["r_wrist"],
        grips: [{ kind: "tips", face: "anterior" }],
        arrows: [{ at: "head", rotate: "cw", label: "gira cabeza" }],
        pain: ["r_hand"],
        caption: "Extensión y giro del cuello hacia el lado explorado, palpando el pulso",
        side: "r",
        script: {
          start: { r_shoulder: { flex: -10, abd: 40, rot: -20 }, r_elbow: { flex: 8 }, neck: { flex: 0, rot: 0 } },
          steps: [
            { to: { neck: { flex: -20, rot: 40 } }, by: "patient", dur: 1.8, text: "Palpando el pulso radial, pide que extienda el cuello y gire la cabeza hacia el lado explorado." },
            { by: "patient", dur: 0.6, hold: 1.6, path: false, pain: true, text: "Pide que inspire hondo y aguante la respiración. Valora el pulso y los síntomas." },
          ],
        },
        text: {
          setup: "Paciente sentado con el brazo derecho algo separado y extendido. El examinador palpa el pulso radial.",
          look: "Positivo si reproduce sus síntomas. Que el pulso disminuya o desaparezca, por sí solo, es frecuente en personas sanas.",
        },
        supuestos: ["Extensión de cuello de 20° y rotación de 40° (la fuente no da grados).", "La inspiración no se dibuja."],
      },
    ],
    related: ["hom-roos", "hom-wright"],
  },
  {
    id: "hom-wright",
    region: "hombro",
    group: G_TOS,
    name: "Test de Wright (hiperabducción)",
    aka: ["Hyperabduction test", "Wright's test"],
    kind: "test",
    purpose: "Busca compresión neurovascular bajo el pectoral menor al llevar el brazo a hiperabducción.",
    position: "Paciente sentado. El examinador al lado, palpando el pulso radial.",
    steps: [
      "Palpa el pulso radial con el brazo junto al cuerpo.",
      "Lleva el brazo pasivamente a abducción máxima con algo de rotación externa.",
      "Mantén la posición unos segundos (hasta 1 minuto) y pregunta por síntomas.",
    ],
    positive: "Reproducción de los síntomas (hormigueo, pesadez) y, con menos valor, disminución del pulso.",
    interpretation:
      "Igual que el resto de pruebas de provocación, es poco específico. En Gillard et al. (2001) la hiperabducción fue de las que mejor valor predictivo positivo mostraron, pero sigue sin confirmar el diagnóstico por sí sola.",
    accuracy: [],
    utility: "desconocida",
    figures: [
      {
        view: "front",
        posture: "sitting",
        joints: { r_shoulder: 30 },
        to: { r_shoulder: 175 },
        hands: ["r_wrist"],
        grips: [{ kind: "tips", face: "lateral" }],
        arrows: [{ at: "r_elbow", dir: "lateral", kind: "move", label: "hiperabd." }],
        pain: ["r_hand"],
        caption: "Hiperabducción pasiva palpando el pulso radial",
        side: "r",
        script: {
          start: { r_shoulder: { flex: 0, abd: 10, rot: 0 } },
          steps: [{ to: { r_shoulder: { abd: 170, rot: -30 } }, by: "examiner", dur: 2.6, hold: 1.6, pain: true, text: "Palpando el pulso radial, lleva el brazo pasivamente a abducción máxima con algo de rotación externa y mantén hasta 1 minuto." }],
        },
        text: {
          setup: "Paciente sentado. El examinador, al lado, palpa el pulso radial con el brazo derecho junto al cuerpo.",
          look: "Positivo si reproduce los síntomas (hormigueo, pesadez); la disminución del pulso tiene menos valor.",
        },
        supuestos: ["Abducción de 170° con 30° de rotación externa."],
      },
    ],
    related: ["hom-roos", "hom-adson"],
  },
];
