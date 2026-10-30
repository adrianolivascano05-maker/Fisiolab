import type { SpecialTest } from "../types";

const DEVILLE_2000 =
  "Devillé WL, van der Windt DA, Dzaferagić A, Bezemer PD, Bouter LM. The test of Lasègue: systematic review of the accuracy in diagnosing herniated discs. Spine. 2000;25(9):1140-7.";
const VANDERWINDT_2010 =
  "van der Windt DA, et al. Physical examination for lumbar radiculopathy due to disc herniation in patients with low-back pain. Cochrane Database of Systematic Reviews. 2010;(2):CD007431.";
const ALNEZARI_2013 =
  "Al Nezari NH, Schneiders AG, Hendrick PA. Neurological examination of the peripheral nervous system to diagnose lumbar spinal disc herniation with suspected radiculopathy: a systematic review and meta-analysis. Spine J. 2013;13(6):657-74.";
const HICKS_2005 =
  "Hicks GE, Fritz JM, Delitto A, McGill SM. Preliminary development of a clinical prediction rule for determining which patients with low back pain will respond to a stabilization exercise program. Arch Phys Med Rehabil. 2005;86(9):1753-62.";

const ALARMA_RADICULAR =
  "Derivar con urgencia si hay anestesia en silla de montar, retención o incontinencia urinaria o fecal, o déficit motor progresivo (posible síndrome de cola de caballo).";

const SIEPER_2009 = {
  source: "Sieper et al., 2009",
  citation:
    "Sieper J, van der Heijde D, Landewé R, et al. New criteria for inflammatory back pain in patients with chronic back pain: a real patient exercise by experts from the Assessment of SpondyloArthritis international Society (ASAS). Ann Rheum Dis. 2009;68(6):784-788.",
  doi: "10.1136/ard.2008.101501",
};

export const lumbarTests: SpecialTest[] = [
  // ───────────── Radiculopatía lumbar ─────────────
  {
    id: "lum-slr",
    region: "lumbar",
    group: "Radiculopatía lumbar",
    name: "Elevación de la pierna recta (Lasègue)",
    aka: ["Straight leg raise (SLR)", "Signo de Lasègue", "Test de Lasègue"],
    kind: "test",
    purpose: "Provoca tensión de las raíces L5-S1 y del nervio ciático para detectar una radiculopatía por hernia discal.",
    position: "Paciente en decúbito supino, sin almohada y con las piernas extendidas. El examinador, del lado que explora, sujeta el talón y apoya la otra mano sobre la rodilla para mantenerla extendida.",
    steps: [
      "Eleva despacio la pierna recta flexionando la cadera, sin dejar que rote ni que se doble la rodilla.",
      "Pregunta qué siente y dónde a medida que sube la pierna.",
      "Anota el ángulo de cadera al que aparece el síntoma.",
      "Si aparece, baja unos grados y añade flexión dorsal del tobillo o flexión del cuello para comprobar que el síntoma es neural.",
    ],
    positive: "Reproduce el dolor irradiado por la pierna (por debajo de la rodilla), típicamente entre 30° y 70° de flexión de cadera, y aumenta con la maniobra de sensibilización.",
    interpretation:
      "Muy sensible pero poco específico: un resultado negativo hace menos probable la hernia con compresión radicular (ayuda a descartar), uno positivo confirma poco. Combínalo con el SLR cruzado y el slump para confirmar.",
    accuracy: [
      {
        sens: 91,
        spec: 26,
        context: "Metaanálisis de 11 estudios, frente a cirugía (hernia discal); series quirúrgicas",
        source: "Devillé et al., 2000",
        citation: DEVILLE_2000,
      },
      {
        sens: 92,
        spec: 28,
        context: "Revisión Cochrane, poblaciones quirúrgicas (prevalencia alta de hernia)",
        source: "van der Windt et al., 2010",
        citation: VANDERWINDT_2010,
      },
    ],
    utility: "moderada",
    cautions: ALARMA_RADICULAR,
    figures: [
      {
        view: "side",
        posture: "supine",
        to: { r_hip: 70 },
        hands: ["r_shank@0.95", "r_knee"],
        grips: [{ kind: "press", face: "posterior" }, { kind: "press", face: "anterior" }],
        arrows: [{ at: "r_shank@0.9", dir: "anterior", kind: "move", label: "flexión" }],
        pain: ["lumbar", "r_shank@0.5"],
        caption: "Elevación pasiva de la pierna con la rodilla extendida",
        side: "r",
        script: {
          start: { r_hip: { flex: 0 }, r_ankle: { flex: 0 } },
          steps: [
            { to: { r_hip: { flex: 35 } }, by: "examiner", dur: 1.6, text: "Eleva pasivamente la pierna con la rodilla extendida…" },
            { to: { r_hip: { flex: 60 } }, by: "examiner", dur: 1.4, hold: 0.6, pain: true, text: "…entre 30° y 70° aparece el dolor irradiado por debajo de la rodilla." },
            { to: { r_ankle: { flex: 15 } }, by: "examiner", dur: 0.9, hold: 1.0, text: "Sensibilización: la flexión dorsal del tobillo lo aumenta." },
          ],
        },
        text: {
          setup: "Paciente en supino, sin almohada y con las piernas extendidas. El examinador, del lado que explora, sujeta el talón y apoya la otra mano sobre la rodilla para mantenerla extendida.",
          look: "Positivo si reproduce el dolor irradiado por la pierna (por debajo de la rodilla), típicamente entre 30° y 70°, y aumenta con la sensibilización.",
        },
        supuestos: ["Se enseña un positivo: el dolor aparece a 60°.", "Flexión dorsal de 15° para sensibilizar."],
      },
    ],
    related: ["lum-slr-cruzado", "lum-slump", "lum-bragard"],
  },
  {
    id: "lum-slr-cruzado",
    region: "lumbar",
    group: "Radiculopatía lumbar",
    name: "Elevación de la pierna recta cruzada",
    aka: ["Crossed straight leg raise", "SLR contralateral", "Signo de Fajersztajn"],
    kind: "test",
    purpose: "Busca dolor en la pierna afectada al elevar la pierna sana, indicio de una hernia discal grande o medial.",
    position: "Paciente en decúbito supino con las piernas extendidas. El examinador se coloca del lado de la pierna sana.",
    steps: [
      "Eleva la pierna no dolorosa recta, como en el SLR.",
      "Pregunta si aparece dolor en la espalda o en la pierna contraria (la sintomática).",
      "Anota el ángulo al que aparece.",
    ],
    positive: "Reproduce el dolor irradiado en la pierna sintomática al elevar la contraria.",
    interpretation:
      "Poco sensible pero bastante específico: cuando es positivo apoya la hernia discal, pero un negativo no la descarta. Úsalo junto al SLR homolateral, que aporta la sensibilidad.",
    accuracy: [
      {
        sens: 29,
        spec: 88,
        context: "Metaanálisis, frente a cirugía (hernia discal)",
        source: "Devillé et al., 2000",
        citation: DEVILLE_2000,
      },
      {
        sens: 28,
        spec: 90,
        context: "Revisión Cochrane, poblaciones quirúrgicas",
        source: "van der Windt et al., 2010",
        citation: VANDERWINDT_2010,
      },
    ],
    utility: "moderada",
    cautions: ALARMA_RADICULAR,
    figures: [
      {
        view: "side",
        posture: "supine",
        to: { r_hip: 70 },
        hands: ["r_shank@0.95", "r_knee"],
        grips: [{ kind: "press", face: "posterior" }, { kind: "press", face: "anterior" }],
        arrows: [{ at: "r_shank@0.9", dir: "anterior", kind: "move", label: "pierna sana" }],
        pain: ["l_shank@0.5", "lumbar"],
        caption: "Se eleva la pierna sana; el dolor aparece en la contraria",
        side: "r",
        script: {
          start: { r_hip: { flex: 0 } },
          steps: [
            { to: { r_hip: { flex: 35 } }, by: "examiner", dur: 1.6, text: "Eleva la pierna sana (aquí la derecha) con la rodilla extendida…" },
            { to: { r_hip: { flex: 65 } }, by: "examiner", dur: 1.6, hold: 1.2, pain: true, text: "…y el dolor irradiado aparece en la pierna contraria (la izquierda, la sintomática)." },
          ],
        },
        text: {
          setup: "Paciente en supino con las piernas extendidas. El examinador, del lado de la pierna sana (derecha).",
          look: "Positivo si al elevar la pierna sana se reproduce el dolor irradiado en la pierna sintomática.",
        },
        supuestos: ["Se dibuja con la pierna sana a la derecha y la sintomática a la izquierda; el lado marcado (D) es la pierna que se eleva."],
      },
    ],
    related: ["lum-slr", "lum-slump"],
  },
  {
    id: "lum-slump",
    region: "lumbar",
    group: "Radiculopatía lumbar",
    name: "Slump test",
    aka: ["Test de desplome", "Slump"],
    kind: "test",
    purpose: "Pone en tensión todo el sistema neural (médula, raíces y nervio ciático) sumando flexión de tronco, cuello y extensión de rodilla.",
    position: "Paciente sentado al borde de la camilla con las manos a la espalda y los muslos apoyados. El examinador a su lado, con una mano sobre la nuca o los hombros.",
    steps: [
      "Pide que deje caer el tronco en flexión (que se «desplome») y añade presión suave sobre los hombros.",
      "Pide flexión del cuello (barbilla al pecho) y mantén la presión.",
      "Pide que extienda la rodilla y luego que lleve el pie en flexión dorsal.",
      "Si aparece el síntoma, pide que suelte el cuello (extensión cervical) y observa si cede.",
      "Compara con el otro lado.",
    ],
    positive: "Reproduce el dolor del paciente en la pierna o la espalda y el síntoma cambia al soltar la flexión del cuello (diferenciación estructural).",
    interpretation:
      "Más específico que el SLR en el estudio de referencia y bastante sensible; útil para confirmar y para descartar en combinación con el SLR. La respuesta tiene que cambiar con la flexión-extensión del cuello para atribuirla al tejido neural.",
    accuracy: [
      {
        sens: 84,
        spec: 83,
        context: "75 pacientes, frente a RM (hernia discal lumbar); diseño casos-controles",
        source: "Majlesi et al., 2008",
        citation:
          "Majlesi J, Togay H, Ünalan H, Toprak S. The sensitivity and specificity of the Slump and the Straight Leg Raising tests in patients with lumbar disc herniation. J Clin Rheumatol. 2008;14(2):87-91.",
        doi: "10.1097/RHU.0b013e31816b2f99",
      },
    ],
    utility: "moderada",
    cautions: "Una ligera sensación de tirantez detrás de la rodilla es normal; no la confundas con un positivo.",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { trunk: 30, neck: 40, r_hip: 120, l_hip: 120 },
        to: { r_knee: 10, r_ankle: 15 },
        hands: ["head", "shoulder"],
        grips: [{ kind: "press", face: "posterior" }, { kind: "press", face: "cranial" }],
        arrows: [
          { at: "shoulder", dir: "caudal", label: "flexión" },
          { at: "r_foot", dir: "anterior", kind: "move", label: "extensión" },
        ],
        pain: ["lumbar", "r_shank@0.4"],
        caption: "Tronco y cuello en flexión, después extensión de rodilla y tobillo",
        side: "r",
        script: {
          start: { trunk: { flex: 0 }, neck: { flex: 0 }, r_knee: { flex: 90 }, r_ankle: { flex: 0 } },
          steps: [
            { to: { trunk: { flex: 30 } }, by: "patient", dur: 1.4, text: "Pide que se desplome: flexión de la columna dorsal y lumbar." },
            { to: { neck: { flex: 40 } }, by: "examiner", dur: 1.2, marks: [{ kind: "push", at: "head", dir: "caudal", label: "Flexión del cuello" }], text: "Añade flexión del cuello y mantenla." },
            { to: { r_knee: { flex: 10 } }, by: "patient", dur: 1.6, text: "Pide que extienda la rodilla…" },
            { to: { r_ankle: { flex: 15 } }, by: "patient", dur: 1.0, hold: 0.8, pain: true, text: "…y que lleve el pie a flexión dorsal." },
            { to: { neck: { flex: 0 } }, by: "examiner", dur: 1.2, hold: 1.0, painEnd: true, text: "Diferenciación: al soltar la flexión del cuello, los síntomas cambian." },
          ],
        },
        text: {
          setup: "Paciente sentado al borde de la camilla con las manos a la espalda y los muslos apoyados. El examinador, al lado, con una mano sobre la nuca.",
          look: "Positivo si reproduce el dolor de la pierna o la espalda y cambia al soltar la flexión del cuello (diferenciación estructural).",
        },
        supuestos: ["Se enseña un positivo.", "No se dibujan las manos a la espalda.", "Desplome de 30°, flexión cervical de 40°, extensión de rodilla hasta 10° y flexión dorsal de 15°."],
        place: { stance: "stand", from: "side" },
      },
    ],
    related: ["lum-slr", "lum-slr-cruzado"],
  },
  {
    id: "lum-bragard",
    region: "lumbar",
    group: "Radiculopatía lumbar",
    name: "Test de Bragard",
    aka: ["Bragard's sign", "Bragard modificado"],
    kind: "test",
    purpose: "Confirma que el dolor del SLR es de origen neural sumando flexión dorsal del tobillo.",
    position: "Paciente en decúbito supino. El examinador sujeta el talón y el antepié de la pierna explorada.",
    steps: [
      "Realiza el SLR hasta que aparezca el dolor irradiado.",
      "Baja la pierna unos 5-10° hasta que el dolor desaparezca.",
      "Lleva el tobillo a flexión dorsal (puedes añadir eversión).",
      "Pregunta si vuelve el dolor.",
    ],
    positive: "La flexión dorsal del tobillo hace reaparecer el dolor irradiado que había cedido al bajar la pierna.",
    interpretation:
      "Ayuda a distinguir el dolor neural del estiramiento de isquiotibiales. Por sí solo confirma y descarta poco; combinado con el SLR mejora la capacidad de descartar una radiculopatía.",
    accuracy: [
      {
        sens: 69.3,
        spec: 67.4,
        lrPos: 2.13,
        lrNeg: 0.46,
        context: "506 pacientes con sospecha de radiculopatía L5-S1, frente a electrodiagnóstico; Bragard modificado",
        source: "Homayouni et al., 2018",
        citation:
          "Homayouni K, Jafari SH, Yari H. Sensitivity and Specificity of Modified Bragard Test in Patients With Lumbosacral Radiculopathy Using Electrodiagnosis as a Reference Standard. J Chiropr Med. 2018;17(1):36-43.",
        doi: "10.1016/j.jcm.2017.10.004",
      },
    ],
    utility: "moderada",
    figures: [
      {
        view: "side",
        posture: "supine",
        joints: { r_hip: 50 },
        to: { r_ankle: 20 },
        hands: ["r_foot@0.7", "r_knee"],
        grips: [{ kind: "press", face: "caudal" }, { kind: "press", face: "anterior" }],
        arrows: [{ at: "r_foot@0.9", dir: "cranial", label: "dorsiflexión" }],
        pain: ["r_shank@0.5"],
        caption: "Pierna bajada justo por debajo del dolor y flexión dorsal del tobillo",
        side: "r",
        script: {
          start: { r_hip: { flex: 0 }, r_ankle: { flex: 0 } },
          steps: [
            { to: { r_hip: { flex: 60 } }, by: "examiner", dur: 2.0, hold: 0.4, pain: true, text: "Eleva la pierna recta hasta que aparece el dolor irradiado…" },
            { to: { r_hip: { flex: 50 } }, by: "examiner", dur: 0.9, hold: 0.4, painEnd: true, text: "…bájala justo hasta que cede…" },
            { to: { r_ankle: { flex: 20 } }, by: "examiner", dur: 0.9, hold: 1.2, pain: true, text: "…y lleva el tobillo a flexión dorsal: el dolor reaparece." },
          ],
        },
        text: {
          setup: "Paciente en supino. El examinador sujeta el antepié de la pierna derecha y apoya la otra mano sobre la rodilla para mantenerla extendida.",
          look: "Positivo si la flexión dorsal del tobillo hace reaparecer el dolor irradiado que había cedido al bajar la pierna.",
        },
        supuestos: ["Se enseña un positivo: dolor a 60°, cede a 50°."],
      },
    ],
    related: ["lum-slr"],
  },
  {
    id: "lum-nervio-femoral",
    region: "lumbar",
    group: "Radiculopatía lumbar",
    name: "Test del nervio femoral (flexión de rodilla en prono)",
    aka: ["Prone knee bend", "Femoral nerve stretch test", "Test de Wassermann"],
    kind: "test",
    purpose: "Pone en tensión el nervio femoral y las raíces L2-L4 para detectar una radiculopatía lumbar alta.",
    position: "Paciente en decúbito prono con la cabeza en posición neutra. El examinador al lado, con una mano en la pelvis y la otra en el tobillo.",
    steps: [
      "Estabiliza la pelvis para que no se eleve ni rote.",
      "Flexiona la rodilla pasivamente llevando el talón hacia el glúteo.",
      "Si no aparece síntoma, puedes añadir algo de extensión de cadera.",
      "Pregunta dónde nota el síntoma y compara con el otro lado.",
    ],
    positive: "Dolor o parestesias en la cara anterior del muslo o en la zona lumbar, distinto de la simple tirantez del cuádriceps.",
    interpretation:
      "Útil para confirmar una radiculopatía L2-L4 cuando es positivo; un negativo no la descarta. Complétalo con la exploración neurológica (fuerza del cuádriceps, reflejo rotuliano).",
    accuracy: [
      {
        sens: 50,
        spec: 100,
        context: "Frente a RM, compresión radicular L2-L4; estudio de un solo centro",
        source: "Suri et al., 2011",
        citation:
          "Suri P, et al. The accuracy of the physical examination for the diagnosis of midlumbar and low lumbar nerve root impingement. Spine. 2011;36(1):63-73.",
      },
    ],
    utility: "alta",
    cautions: "Distingue el dolor neural de la tensión del recto femoral o de un problema de cadera. " + ALARMA_RADICULAR,
    figures: [
      {
        view: "side",
        posture: "prone",
        joints: { r_knee: 20 },
        to: { r_knee: 115 },
        hands: ["r_shank@0.9", "pelvis"],
        grips: [{ kind: "grasp", face: "posterior" }, { kind: "press", face: "posterior" }],
        arrows: [{ at: "r_shank@0.9", dir: "posterior", kind: "move", label: "flexión" }],
        pain: ["r_thigh@0.5", "lumbar"],
        caption: "Flexión pasiva de rodilla en prono con la pelvis fijada",
        side: "r",
        script: {
          start: { r_knee: { flex: 20 } },
          steps: [{ to: { r_knee: { flex: 115 } }, by: "examiner", dur: 2.4, hold: 1.2, pain: true, marks: [{ kind: "push", at: "pelvis", dir: "anterior", label: "Fija la pelvis" }], text: "Con la pelvis fijada, flexiona pasivamente la rodilla." }],
        },
        text: {
          setup: "Paciente en prono con la cabeza en posición neutra. El examinador, al lado, con una mano en la pelvis y otra en el tobillo.",
          look: "Positivo si aparece dolor o parestesias en la cara anterior del muslo o en la zona lumbar, distinto de la simple tirantez del cuádriceps.",
        },
      },
    ],
    related: ["lum-exploracion-neurologica", "lum-slr"],
  },
  {
    id: "lum-exploracion-neurologica",
    region: "lumbar",
    group: "Radiculopatía lumbar",
    name: "Exploración neurológica (miotomas, reflejos y sensibilidad)",
    aka: ["Neurological examination", "Paresia, reflejos y dermatomas"],
    kind: "test",
    purpose: "Busca signos de déficit de una raíz lumbosacra concreta: debilidad, hiporreflexia o alteración sensitiva.",
    position: "Paciente sentado para los reflejos y la fuerza en cadena abierta, y de pie para la marcha de talones y puntillas. El examinador delante.",
    steps: [
      "Fuerza: flexión de cadera (L2), extensión de rodilla (L3-L4), flexión dorsal del tobillo (L4), extensión del primer dedo (L5) y flexión plantar o puntillas (S1).",
      "Reflejos: rotuliano (L3-L4) y aquíleo (S1), comparando ambos lados.",
      "Sensibilidad: tacto ligero y pinchazo en los dermatomas de la pierna.",
      "Anota el lado y el nivel que parecen afectados.",
    ],
    positive: "Debilidad, reflejo disminuido o alteración sensitiva en el territorio de una raíz, asimétrico respecto al otro lado.",
    interpretation:
      "Cada componente por separado aporta poco para identificar la hernia o su nivel, pero es imprescindible para detectar y seguir un déficit. Interprétalo junto a los tests neurodinámicos (SLR, slump) y la distribución del dolor.",
    accuracy: [
      {
        sens: 31,
        spec: 76,
        context: "Paresia en miotomas; metaanálisis de 14 estudios, frente a cirugía o imagen (nivel discal)",
        source: "Al Nezari et al., 2013",
        citation: ALNEZARI_2013,
      },
      {
        sens: 35,
        spec: 64,
        context: "Alteración sensitiva en dermatomas; mismo metaanálisis",
        source: "Al Nezari et al., 2013",
        citation: ALNEZARI_2013,
      },
    ],
    utility: "baja",
    cautions: ALARMA_RADICULAR,
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { r_knee: 60 },
        hands: ["r_shank@0.85", "r_thigh@0.8"],
        grips: [{ kind: "press", face: "anterior" }, { kind: "press", face: "anterior" }],
        arrows: [{ at: "r_shank@0.85", dir: "posterior", label: "resistencia" }],
        caption: "Ejemplo: extensión de rodilla contra resistencia (L3-L4)",
        side: "r",
        script: {
          start: { r_knee: { flex: 60 } },
          steps: [{ by: "patient", dur: 0.8, hold: 1.6, marks: [{ kind: "resist", joint: "r_knee", dof: "flex", sign: -1, label: "Extiende la rodilla contra la mano" }], text: "Ejemplo de miotoma (L3-L4): pide que extienda la rodilla contra tu resistencia y compara con el otro lado." }],
        },
        text: {
          setup: "Paciente sentado. El examinador, delante, con una mano sobre el muslo y otra sobre la pierna.",
          look: "Positivo si hay debilidad, un reflejo disminuido o alteración sensitiva en el territorio de una raíz, asimétricos respecto al otro lado.",
        },
        supuestos: ["Solo se dibuja un ejemplo (extensión de rodilla, L3-L4); el resto va en el texto."],
        place: { stance: "sit", from: "side" },
      },
    ],
    related: ["lum-nervio-femoral", "lum-slr"],
  },

  // ───────────── Estenosis de canal lumbar ─────────────
  {
    id: "lum-cluster-estenosis",
    region: "lumbar",
    group: "Estenosis de canal lumbar",
    name: "Cluster de estenosis de canal (Cook)",
    aka: ["Lumbar spinal stenosis cluster", "Cook et al. 2011"],
    kind: "cluster",
    purpose: "Agrupa datos de la historia y la observación para estimar la probabilidad de estenosis de canal lumbar.",
    position: "Entrevista y observación del paciente, de pie y sentado.",
    steps: [
      "Síntomas en ambas piernas.",
      "Dolor de pierna mayor que el de espalda.",
      "Dolor al caminar o al estar de pie.",
      "Alivio al sentarse.",
      "Edad mayor de 48 años.",
    ],
    positive: "Cuatro o más de los cinco hallazgos apoyan la estenosis; ninguno de los cinco hace muy improbable la estenosis.",
    interpretation:
      "Sirve sobre todo para descartar: si no se cumple ninguno de los criterios, la estenosis es poco probable. Con 4 de 5 la probabilidad sube de forma moderada; la confirmación se hace con la prueba de marcha y con imagen.",
    accuracy: [
      {
        sens: 96,
        lrNeg: 0.19,
        context: "Al menos 1 de 5 positivo; 1.448 pacientes con dolor lumbar, diagnóstico por cirujano con clínica e imagen",
        source: "Cook et al., 2011",
        citation:
          "Cook C, et al. The clinical value of a cluster of patient history and observational findings as a diagnostic support tool for lumbar spine stenosis. Physiother Res Int. 2011;16(3):170-8.",
      },
      {
        lrPos: 4.6,
        context: "4 de 5 positivos; misma muestra",
        source: "Cook et al., 2011",
        citation:
          "Cook C, et al. The clinical value of a cluster of patient history and observational findings as a diagnostic support tool for lumbar spine stenosis. Physiother Res Int. 2011;16(3):170-8.",
      },
    ],
    utility: "alta",
    cautions: "Distingue la claudicación neurógena de la vascular (pulsos, alivio al pararse de pie sin sentarse). " + ALARMA_RADICULAR,
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { r_hip: 15, l_hip: -10, r_knee: 10 },
        arrows: [{ at: "pelvis", dir: "anterior", kind: "move", label: "caminar" }],
        pain: ["r_shank@0.5", "l_shank@0.5"],
        caption: "Dolor en ambas piernas al caminar o estar de pie",
        side: "both",
        script: {
          steps: [{ to: { r_hip: { flex: 25 }, r_knee: { flex: 15 }, l_hip: { flex: -10 } }, by: "patient", dur: 1.4, hold: 1.0, path: false, pain: true, text: "Dolor en las dos piernas al caminar o estar de pie, que mejora al sentarse." }],
        },
        text: {
          setup: "Entrevista y observación del paciente, de pie y sentado.",
          look: "Los cinco hallazgos: dolor en las dos piernas, más dolor de piernas que de espalda, dolor al caminar o estar de pie, alivio al sentarse y edad > 48. Cuatro o más apoyan la estenosis; ninguno la hace muy improbable.",
        },
        supuestos: ["Solo se dibuja un paso de la marcha."],
      },
    ],
    related: ["lum-marcha-cinta", "lum-alivio-sedestacion"],
  },
  {
    id: "lum-marcha-cinta",
    region: "lumbar",
    group: "Estenosis de canal lumbar",
    name: "Prueba de marcha en cinta en dos fases",
    aka: ["Two-stage treadmill test", "Test de la cinta", "Test de la bicicleta (variante)"],
    kind: "test",
    purpose: "Compara la tolerancia a la marcha en llano y en pendiente: la estenosis empeora en extensión (llano) y mejora en ligera flexión (cuesta arriba).",
    position: "Paciente de pie sobre una cinta rodante; el examinador a su lado con cronómetro.",
    steps: [
      "Caminar en llano a velocidad cómoda hasta 10 minutos o hasta que los síntomas obliguen a parar.",
      "Anotar el tiempo hasta el primer síntoma y el tiempo total.",
      "Descansar sentado 10 minutos y anotar cuánto tardan en ceder los síntomas.",
      "Repetir la marcha con la cinta inclinada unos 15° y comparar.",
    ],
    positive: "Tolera más tiempo caminando en pendiente que en llano, los síntomas aparecen antes en llano o tarda más en recuperarse tras la marcha en llano.",
    interpretation:
      "Más útil para confirmar que para descartar. Una alternativa sin cinta es comparar la tolerancia a caminar con la de pedalear en bicicleta estática (la flexión del tronco al pedalear alivia la estenosis).",
    accuracy: [
      {
        sens: 50,
        spec: 92.3,
        context: "Mayor tiempo de marcha en pendiente; frente a imagen; estudio preliminar",
        source: "Fritz et al., 1997",
        citation:
          "Fritz JM, et al. Preliminary results of the use of a two-stage treadmill test as a clinical diagnostic tool in the differential diagnosis of lumbar spinal stenosis. J Spinal Disord. 1997;10(5):410-6.",
      },
    ],
    utility: "alta",
    cautions: "Vigila la respuesta cardiovascular y la estabilidad en pacientes mayores; detén la prueba ante dolor torácico, disnea o mareo.",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { trunk: 10, r_hip: 30, l_hip: -5, r_knee: 15 },
        arrows: [{ at: "pelvis", dir: "anterior", kind: "move", label: "pendiente" }],
        pain: ["r_thigh@0.5", "r_shank@0.5"],
        caption: "Cuesta arriba el tronco se inclina hacia delante y los síntomas tardan más",
        side: "both",
        script: {
          steps: [
            { to: { r_hip: { flex: 25 }, r_knee: { flex: 15 }, l_hip: { flex: -10 } }, by: "patient", dur: 1.4, hold: 0.6, path: false, pain: true, text: "En llano, los síntomas aparecen antes…" },
            { to: { trunk: { flex: 12 }, r_hip: { flex: 37 }, l_hip: { flex: 2 } }, by: "patient", dur: 1.4, hold: 1.0, path: false, painEnd: true, text: "…y en pendiente, con el tronco inclinado hacia delante, tarda más en aparecer." },
          ],
        },
        text: {
          setup: "Paciente de pie sobre una cinta rodante; el examinador, al lado, con cronómetro.",
          look: "Positivo si tolera más tiempo caminando en pendiente que en llano, los síntomas aparecen antes en llano o tarda más en recuperarse tras caminar en llano.",
        },
        supuestos: ["La cinta no se dibuja; la pendiente se ve en la inclinación del tronco (12°)."],
      },
    ],
    related: ["lum-cluster-estenosis", "lum-alivio-sedestacion"],
  },
  {
    id: "lum-alivio-sedestacion",
    region: "lumbar",
    group: "Estenosis de canal lumbar",
    name: "Alivio en sedestación o flexión",
    aka: ["No pain when seated", "Signo del carro de la compra", "Shopping cart sign"],
    kind: "test",
    purpose: "Comprueba si los síntomas de pierna ceden al sentarse o al inclinarse hacia delante, típico de la estenosis de canal.",
    position: "Paciente de pie hasta que aparecen los síntomas y después sentado o inclinado hacia delante (por ejemplo, apoyado en un carro).",
    steps: [
      "Pregunta si el dolor aparece al estar de pie o caminar y si desaparece al sentarse.",
      "Pide que permanezca de pie o camine hasta que aparezcan los síntomas.",
      "Pide que se siente o se incline hacia delante y anota si ceden y en cuánto tiempo.",
    ],
    positive: "Los síntomas de pierna desaparecen o mejoran claramente al sentarse o al flexionar el tronco.",
    interpretation:
      "No tener dolor sentado es de los datos de la historia que más aumentan la probabilidad de estenosis (ayuda a confirmar). Combínalo con el resto del cluster de Cook.",
    accuracy: [
      {
        lrPos: 7.4,
        context: "«Sin dolor al estar sentado»; revisión sistemática JAMA, 4 estudios, 741 pacientes",
        source: "Suri et al., 2010",
        citation:
          "Suri P, Rainville J, Kalichman L, Katz JN. Does this older adult with lower extremity pain have the clinical syndrome of lumbar spinal stenosis? JAMA. 2010;304(23):2628-36.",
      },
    ],
    utility: "alta",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { trunk: 25, r_hip: 115, l_hip: 115, r_shoulder: 30, l_shoulder: 30 },
        arrows: [{ at: "shoulder", dir: "anterior", kind: "move", label: "flexión" }],
        caption: "Sentado o inclinado hacia delante, los síntomas ceden",
        side: "both",
        script: {
          start: { trunk: { flex: 0 } },
          steps: [
            { by: "patient", dur: 0.6, hold: 1.0, path: false, pain: true, text: "Con el tronco erguido, los síntomas de las piernas están presentes." },
            { to: { trunk: { flex: 25 }, r_shoulder: { flex: 30 }, l_shoulder: { flex: 30 } }, by: "patient", dur: 1.8, hold: 1.2, painEnd: true, text: "Al sentarse o inclinarse hacia delante, ceden." },
          ],
        },
        text: {
          setup: "Paciente de pie hasta que aparecen los síntomas y después sentado o inclinado hacia delante (por ejemplo, apoyado en un carro).",
          look: "Positivo si los síntomas de las piernas desaparecen o mejoran claramente al sentarse o al flexionar el tronco.",
        },
        supuestos: ["Se dibuja ya sentado."],
      },
    ],
    related: ["lum-cluster-estenosis", "lum-marcha-cinta"],
  },

  // ───────────── Inestabilidad lumbar ─────────────
  {
    id: "lum-inestabilidad-prono",
    region: "lumbar",
    group: "Inestabilidad lumbar",
    name: "Test de inestabilidad en prono",
    aka: ["Prone instability test (PIT)"],
    kind: "test",
    purpose: "Valora si la activación de los extensores de la espalda reduce el dolor provocado por presión posteroanterior, señal de inestabilidad clínica.",
    position: "Paciente con el tronco en prono sobre la camilla, las caderas al borde y los pies apoyados en el suelo. El examinador al lado, con las manos sobre la apófisis espinosa dolorosa.",
    steps: [
      "Aplica presión posteroanterior sobre cada nivel lumbar y anota cuál reproduce el dolor.",
      "Pide que levante ligeramente los pies del suelo (se agarra a la camilla) para activar la musculatura.",
      "Repite la presión en el nivel doloroso con las piernas elevadas.",
    ],
    positive: "Dolor con la presión con los pies en el suelo que desaparece o disminuye claramente con las piernas elevadas.",
    interpretation:
      "Por sí solo no confirma ni descarta una inestabilidad radiológica. Su papel principal es formar parte de la regla de Hicks para elegir ejercicios de estabilización.",
    accuracy: [],
    utility: "desconocida",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { trunk: 85, r_hip: 85, l_hip: 85, r_shoulder: 85, l_shoulder: 85 },
        pose3d: { r_shoulder: { flex: 170, abd: 25 }, l_shoulder: { flex: 170, abd: 25 }, r_elbow: { flex: 40 }, l_elbow: { flex: 40 } },
        hands: ["lumbar"],
        grips: [{ kind: "press", face: "posterior" }],
        arrows: [{ at: "lumbar", dir: "anterior", label: "presión PA" }],
        pain: ["lumbar"],
        caption: "1) Pies en el suelo: la presión posteroanterior duele",
        side: "both",
        script: {
          start: { pelvis: { flex: 80 }, trunk: { flex: 5 }, r_hip: { flex: 80 }, l_hip: { flex: 80 }, r_shoulder: { flex: 170, abd: 25 }, l_shoulder: { flex: 170, abd: 25 }, r_elbow: { flex: 40 }, l_elbow: { flex: 40 } },
          steps: [{ by: "examiner", dur: 0.8, hold: 1.6, path: false, pain: true, marks: [{ kind: "push", at: "lumbar", dir: "anterior", label: "Presión posteroanterior" }], text: "1) Con los pies en el suelo, presiona la apófisis espinosa dolorosa: duele." }],
        },
        text: {
          setup: "Paciente con el tronco en prono sobre la camilla, las caderas al borde y los pies en el suelo. El examinador, al lado, con las manos sobre la espinosa dolorosa.",
          look: "Positivo si la presión duele con los pies en el suelo y deja de doler (o mucho menos) con las piernas elevadas (siguiente figura).",
        },
      },
      {
        view: "side",
        posture: "standing",
        joints: { trunk: 85, r_hip: 85, l_hip: 85, r_shoulder: 85, l_shoulder: 85 },
        pose3d: { r_shoulder: { flex: 170, abd: 25 }, l_shoulder: { flex: 170, abd: 25 }, r_elbow: { flex: 40 }, l_elbow: { flex: 40 } },
        to: { r_hip: 15, l_hip: 15 },
        hands: ["lumbar"],
        grips: [{ kind: "press", face: "posterior" }],
        arrows: [{ at: "lumbar", dir: "anterior" }],
        caption: "2) Piernas elevadas: con los extensores activos el dolor cede",
        side: "both",
        script: {
          start: { pelvis: { flex: 80 }, trunk: { flex: 5 }, r_hip: { flex: 80 }, l_hip: { flex: 80 }, r_shoulder: { flex: 170, abd: 25 }, l_shoulder: { flex: 170, abd: 25 }, r_elbow: { flex: 40 }, l_elbow: { flex: 40 } },
          steps: [
            { to: { r_hip: { flex: 15 }, l_hip: { flex: 15 } }, by: "patient", dur: 1.6, hold: 0.3, painEnd: true, text: "2) Pide que levante las piernas del suelo (se contraen los extensores)…" },
            { by: "examiner", dur: 0.8, hold: 1.4, path: false, marks: [{ kind: "push", at: "lumbar", dir: "anterior", label: "Misma presión" }], text: "…y repite la presión: el dolor cede." },
          ],
        },
        text: {
          setup: "Misma posición; el paciente se sujeta a la camilla y levanta las piernas.",
          look: "Positivo si el dolor que daba la presión desaparece o disminuye claramente con las piernas elevadas.",
        },
      },
    ],
    related: ["lum-regla-estabilizacion", "lum-extension-pasiva", "lum-aberraciones"],
  },
  {
    id: "lum-extension-pasiva",
    region: "lumbar",
    group: "Inestabilidad lumbar",
    name: "Extensión lumbar pasiva (PLE)",
    aka: ["Passive lumbar extension test", "Test de Kasai"],
    kind: "test",
    purpose: "Detecta inestabilidad segmentaria lumbar al llevar la columna a extensión pasiva elevando ambas piernas.",
    position: "Paciente en decúbito prono. El examinador a los pies, sujetando ambos tobillos.",
    steps: [
      "Eleva a la vez ambas piernas extendidas unos 30 cm de la camilla.",
      "Tracciona suavemente hacia ti mientras las mantienes elevadas.",
      "Pregunta por el dolor lumbar y vuelve a bajar las piernas.",
    ],
    positive: "Dolor lumbar intenso, sensación de pesadez o de que la espalda «se va a salir» con las piernas elevadas, que desaparece al bajarlas.",
    interpretation:
      "Es el test clínico de inestabilidad con mejores datos: un positivo ayuda a confirmar inestabilidad radiológica. Combínalo con el test de inestabilidad en prono y las aberraciones del movimiento.",
    accuracy: [
      {
        sens: 84.2,
        spec: 90.4,
        context: "Frente a radiografía dinámica en flexión-extensión (inestabilidad segmentaria)",
        source: "Kasai et al., 2006",
        citation:
          "Kasai Y, Morishita K, Kawakita E, Kondo T, Uchida A. A new evaluation method for lumbar spinal instability: passive lumbar extension test. Phys Ther. 2006;86(12):1661-7.",
      },
    ],
    utility: "alta",
    cautions: "No lo hagas si hay sospecha de fractura o espondilolistesis de alto grado no estudiada.",
    figures: [
      {
        view: "side",
        posture: "prone",
        to: { r_hip: -25, l_hip: -25 },
        hands: ["r_ankle", "l_ankle"],
        grips: [{ kind: "press", face: "anterior" }, { kind: "press", face: "anterior" }],
        arrows: [{ at: "r_ankle", dir: "posterior", kind: "move", label: "elevar" }],
        pain: ["lumbar"],
        caption: "Elevación pasiva de ambas piernas extendidas",
        side: "both",
        script: {
          start: { r_hip: { flex: 0 }, l_hip: { flex: 0 } },
          steps: [
            { to: { r_hip: { flex: -20 }, l_hip: { flex: -20 } }, by: "examiner", dur: 1.8, hold: 1.2, pain: true, text: "Eleva pasivamente las dos piernas extendidas unos 30 cm, sujetándolas por los tobillos." },
            { to: { r_hip: { flex: 0 }, l_hip: { flex: 0 } }, by: "examiner", dur: 1.6, hold: 0.8, painEnd: true, text: "Al bajarlas, el dolor desaparece." },
          ],
        },
        text: {
          setup: "Paciente en prono. El examinador, a los pies, sujeta los dos tobillos.",
          look: "Positivo si con las piernas elevadas aparece dolor lumbar intenso, pesadez o sensación de que la espalda «se va a salir», que desaparece al bajarlas.",
        },
        supuestos: ["30 cm de elevación: unos 20° de extensión de cadera con una pierna de unos 90 cm."],
      },
    ],
    related: ["lum-inestabilidad-prono", "lum-aberraciones"],
  },
  {
    id: "lum-aberraciones",
    region: "lumbar",
    group: "Inestabilidad lumbar",
    name: "Aberraciones del movimiento lumbar",
    aka: ["Aberrant movement patterns", "Arco doloroso", "Signo de Gowers", "Instability catch"],
    kind: "test",
    purpose: "Observa alteraciones del control lumbopélvico durante la flexión y el regreso, asociadas a inestabilidad clínica.",
    position: "Paciente de pie, con la espalda descubierta. El examinador detrás o de lado.",
    steps: [
      "Pide una flexión de tronco completa y el regreso a la posición erguida, varias veces.",
      "Observa si hay arco doloroso al bajar o al subir.",
      "Observa si se ayuda subiendo las manos por los muslos (signo de Gowers).",
      "Busca un «enganche» brusco o un ritmo lumbopélvico invertido (sube primero la pelvis).",
    ],
    positive: "Aparece al menos una de las aberraciones: arco doloroso, signo de Gowers, enganche o inversión del ritmo lumbopélvico.",
    interpretation:
      "Observación con fiabilidad moderada; sin datos de precisión frente a una referencia. Forma parte de la regla de Hicks para indicar ejercicios de estabilización.",
    accuracy: [
      {
        reliability: "kappa 0,60 entre examinadores (presencia de cualquier aberración)",
        context: "63 pacientes con dolor lumbar; estudio de fiabilidad",
        source: "Hicks et al., 2003",
        citation:
          "Hicks GE, Fritz JM, Delitto A, Mishock J. Interrater reliability of clinical examination measures for identification of lumbar segmental instability. Arch Phys Med Rehabil. 2003;84(12):1858-64.",
      },
    ],
    utility: "desconocida",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { trunk: 80, r_hip: 80, l_hip: 80, r_shoulder: 80, l_shoulder: 80 },
        to: { trunk: 0, r_hip: 0, l_hip: 0, r_shoulder: 0, l_shoulder: 0 },
        pose3d: { r_shoulder: { flex: 80, abd: 16 }, l_shoulder: { flex: 80, abd: 16 } },
        to3d: { r_shoulder: { flex: 0, abd: 9 }, l_shoulder: { flex: 0, abd: 9 } },
        arrows: [{ at: "thoracic", dir: "posterior", kind: "move", label: "regreso" }],
        pain: ["lumbar"],
        caption: "Regreso desde la flexión: arco doloroso, enganche o ayuda de las manos",
        side: "both",
        script: {
          start: { pelvis: { flex: 50 }, trunk: { flex: 30 }, r_hip: { flex: 50 }, l_hip: { flex: 50 } },
          steps: [
            { to: { pelvis: { flex: 30 }, trunk: { flex: 18 }, r_hip: { flex: 30 }, l_hip: { flex: 30 } }, by: "patient", dur: 1.2, text: "Desde la flexión, pide que vuelva a la posición erguida…" },
            { to: { pelvis: { flex: 15 }, trunk: { flex: 8 }, r_hip: { flex: 15 }, l_hip: { flex: 15 } }, by: "patient", dur: 1.2, pain: true, text: "…a mitad de camino aparece el dolor (arco doloroso)…" },
            { to: { pelvis: { flex: 0 }, trunk: { flex: 0 }, r_hip: { flex: 0 }, l_hip: { flex: 0 } }, by: "patient", dur: 1.2, hold: 1.0, painEnd: true, text: "…y cede al llegar arriba. Busca también enganches, el signo de Gowers o un ritmo lumbopélvico invertido." },
          ],
        },
        text: {
          setup: "Paciente de pie con la espalda descubierta. El examinador, detrás o de lado.",
          look: "Positivo si aparece al menos una aberración: arco doloroso, signo de Gowers (se ayuda con las manos en los muslos), enganche o inversión del ritmo lumbopélvico.",
        },
        supuestos: ["Se enseña un arco doloroso al volver de la flexión."],
      },
    ],
    related: ["lum-regla-estabilizacion", "lum-inestabilidad-prono"],
  },
  {
    id: "lum-regla-estabilizacion",
    region: "lumbar",
    group: "Inestabilidad lumbar",
    name: "Regla de predicción de Hicks (ejercicios de estabilización)",
    aka: ["Stabilization clinical prediction rule", "Hicks et al. 2005"],
    kind: "rule",
    purpose: "Regla de predicción publicada (Hicks et al., 2005) para identificar a los pacientes con dolor lumbar no radicular que probablemente respondan a un programa de ejercicios de estabilización.",
    position: "Combina edad, SLR, observación del movimiento y test de inestabilidad en prono.",
    steps: [
      "Edad menor de 40 años.",
      "SLR medio mayor de 91°.",
      "Presencia de aberraciones del movimiento.",
      "Test de inestabilidad en prono positivo.",
    ],
    positive: "En el estudio de derivación, tres o más de los cuatro criterios se asociaron a éxito con ejercicios de estabilización.",
    interpretation:
      "Es una regla pronóstica (orienta el tratamiento), no un diagnóstico de inestabilidad. Procede de un estudio de derivación pequeño sin validación posterior: úsala como orientación, no como criterio único.",
    accuracy: [
      {
        lrPos: 4.0,
        context: "3 o más de 4 criterios; derivación, 54 pacientes con dolor lumbar no radicular, éxito a las 8 semanas (Oswestry)",
        source: "Hicks et al., 2005",
        citation: HICKS_2005,
      },
    ],
    utility: "moderada",
    figures: [
      {
        view: "side",
        posture: "supine",
        to: { r_hip: 95 },
        hands: ["r_shank@0.95", "r_knee"],
        grips: [{ kind: "press", face: "posterior" }, { kind: "press", face: "anterior" }],
        arrows: [{ at: "r_shank@0.9", dir: "anterior", kind: "move", label: "> 91°" }],
        caption: "Uno de los criterios: SLR mayor de 91°",
        side: "r",
        script: {
          start: { r_hip: { flex: 0 } },
          steps: [{ to: { r_hip: { flex: 92 } }, by: "examiner", dur: 2.6, hold: 1.2, text: "Uno de los cuatro criterios: elevación de la pierna recta mayor de 91°." }],
        },
        text: {
          setup: "Paciente en supino. Se combinan la edad, la elevación de la pierna recta, la observación del movimiento y el test de inestabilidad en prono.",
          look: "Tres o más de los cuatro criterios (edad < 40, SLR > 91°, aberraciones del movimiento, inestabilidad en prono positiva) predicen éxito con ejercicios de estabilización.",
        },
        supuestos: ["Solo se dibuja uno de los criterios (SLR de 92°, justo por encima de 91°)."],
      },
    ],
    related: ["lum-inestabilidad-prono", "lum-aberraciones", "lum-slr"],
  },

  // ───────────── Espondilólisis ─────────────
  {
    id: "lum-ciguena",
    region: "lumbar",
    group: "Espondilólisis",
    name: "Extensión monopodal (test de la cigüeña)",
    aka: ["One-legged hyperextension test", "Stork test", "Test de la cigüeña"],
    kind: "test",
    purpose: "Provoca carga en la pars interarticularis para buscar una espondilólisis, sobre todo en jóvenes deportistas.",
    position: "Paciente de pie sobre una pierna con la otra cadera y rodilla flexionadas. El examinador detrás, preparado para sujetarlo.",
    steps: [
      "Pide que se apoye sobre una pierna y flexione la otra.",
      "Pide que extienda la columna lumbar hacia atrás (puede añadir rotación hacia el lado de apoyo).",
      "Repite apoyado en la otra pierna.",
    ],
    positive: "Dolor lumbar del lado de la pierna de apoyo durante la extensión.",
    interpretation:
      "No sirve ni para confirmar ni para descartar una espondilólisis activa. Si la sospecha es alta (deportista joven con dolor en extensión), la decisión depende de la imagen.",
    accuracy: [
      {
        sens: 55.2,
        spec: 45.5,
        context: "Lado derecho; jóvenes activos con dolor lumbar, frente a gammagrafía con SPECT",
        source: "Masci et al., 2006",
        citation:
          "Masci L, et al. Use of the one-legged hyperextension test and magnetic resonance imaging in the diagnosis of active spondylolysis. Br J Sports Med. 2006;40(11):940-6.",
      },
      {
        sens: 50,
        spec: 67.6,
        context: "Lado izquierdo; misma muestra",
        source: "Masci et al., 2006",
        citation:
          "Masci L, et al. Use of the one-legged hyperextension test and magnetic resonance imaging in the diagnosis of active spondylolysis. Br J Sports Med. 2006;40(11):940-6.",
      },
    ],
    utility: "baja",
    cautions: "Sujeta al paciente durante la extensión para evitar caídas.",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { l_hip: 60, l_knee: 90 },
        to: { trunk: -25, r_hip: -25, l_hip: 35 },
        hands: ["r_hip", "l_hip"],
        grips: [{ kind: "press", face: "lateral" }, { kind: "press", face: "lateral" }],
        arrows: [{ at: "shoulder", dir: "posterior", kind: "move", label: "extensión" }],
        pain: ["lumbar"],
        caption: "Apoyo monopodal y extensión lumbar",
        side: "r",
        script: {
          steps: [
            { to: { l_hip: { flex: 60 }, l_knee: { flex: 90 }, l_ankle: { flex: 20 } }, by: "patient", dur: 1.4, text: "Pide que se apoye en la pierna derecha y levante la otra." },
            { to: { trunk: { flex: -25 } }, by: "patient", dur: 1.6, hold: 1.2, pain: true, text: "Sobre una pierna, pide que extienda la espalda hacia atrás." },
          ],
        },
        text: {
          setup: "Paciente de pie sobre una pierna. El examinador, detrás, preparado para sujetarlo por la pelvis.",
          look: "Positivo si aparece dolor lumbar del lado de la pierna de apoyo durante la extensión.",
        },
        supuestos: ["Extensión lumbar de 25°."],
      },
    ],
  },

  // ───────────── Centralización y preferencia direccional ─────────────
  {
    id: "lum-centralizacion",
    region: "lumbar",
    group: "Centralización y preferencia direccional",
    name: "Centralización y preferencia direccional (McKenzie)",
    aka: ["Centralization phenomenon", "Directional preference", "Movimientos repetidos", "MDT"],
    kind: "test",
    purpose: "Observa si los movimientos repetidos en una dirección hacen que el dolor referido retroceda hacia la línea media.",
    position: "Paciente de pie y después en prono o supino según la dirección que se explore. El examinador anota la localización del dolor antes y después.",
    steps: [
      "Registra dónde está el dolor más distal antes de empezar.",
      "Pide 10 repeticiones de un movimiento (p. ej. extensión de pie o en prono) y vuelve a preguntar.",
      "Repite series mientras el dolor siga centralizándose; si se periferaliza, para y prueba otra dirección.",
      "Explora flexión y deslizamientos laterales si la extensión no centraliza.",
    ],
    positive: "Centralización: el dolor más distal desaparece y retrocede hacia la columna con una dirección concreta (preferencia direccional).",
    interpretation:
      "La centralización es poco sensible pero bastante específica de dolor discogénico (ayuda a confirmar). La preferencia direccional orienta además el tratamiento con ejercicios en esa dirección.",
    accuracy: [
      {
        sens: 40,
        spec: 94,
        context: "Frente a discografía de provocación (dolor discogénico), dolor lumbar crónico",
        source: "Laslett et al., 2005",
        citation:
          "Laslett M, Öberg B, Aprill CN, McDonald B. Centralization as a predictor of provocation discography results in chronic low back pain, and the influence of disability and distress on diagnostic power. Spine J. 2005;5(4):370-80.",
        doi: "10.1016/j.spinee.2004.11.007",
      },
    ],
    utility: "alta",
    cautions: "Si un movimiento periferaliza el dolor o aumenta el déficit neurológico, detente. " + ALARMA_RADICULAR,
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { r_shoulder: -30, l_shoulder: -30, r_elbow: 90, l_elbow: 90 },
        to: { trunk: -25, r_hip: -25, l_hip: -25 },
        arrows: [{ at: "shoulder", dir: "posterior", kind: "move", label: "x10" }],
        pain: ["lumbar", "r_thigh@0.5"],
        caption: "Extensiones repetidas: el dolor de la pierna retrocede hacia la espalda",
        side: "both",
        script: {
          start: { r_shoulder: { flex: -30 }, l_shoulder: { flex: -30 }, r_elbow: { flex: 90 }, l_elbow: { flex: 90 }, trunk: { flex: 0 } },
          steps: [
            { to: { trunk: { flex: -25 } }, by: "patient", dur: 1.0, hold: 0.1, pain: true, text: "Pide extensiones repetidas de pie (con las manos en la zona lumbar)…" },
            { to: { trunk: { flex: 0 } }, by: "patient", dur: 0.8, hold: 0.1, text: "…una y otra vez…" },
            { to: { trunk: { flex: -25 } }, by: "patient", dur: 1.0, hold: 0.1, text: "…una y otra vez…" },
            { to: { trunk: { flex: 0 } }, by: "patient", dur: 0.8, hold: 1.2, painEnd: true, text: "…y anota dónde está el dolor: el de la pierna retrocede hacia la espalda." },
          ],
        },
        text: {
          setup: "Paciente de pie. El examinador anota la localización del dolor antes y después.",
          look: "Centralización: el dolor más distal desaparece y retrocede hacia la columna con una dirección concreta (preferencia direccional).",
        },
        supuestos: ["Se dibujan dos extensiones de 25° (en la clínica, unas 10).", "Solo se marca el dolor de la pierna: al final desaparece (el de la espalda puede quedar)."],
      },
    ],
  },

  // ───────────── Movilidad y espondiloartritis ─────────────
  {
    id: "lum-schober",
    region: "lumbar",
    group: "Movilidad y espondiloartritis",
    name: "Test de Schober modificado",
    aka: ["Modified Schober test", "Schober"],
    kind: "test",
    purpose: "Mide la flexión de la columna lumbar con marcas en la piel; se usa sobre todo para seguir a pacientes con espondiloartritis.",
    position: "Paciente de pie con los pies separados a la anchura de las caderas. El examinador detrás, con una cinta métrica.",
    steps: [
      "Marca la línea que une los hoyuelos de Venus (espinas ilíacas posterosuperiores).",
      "Marca un punto 10 cm por encima y otro 5 cm por debajo.",
      "Pide una flexión de tronco máxima con las rodillas extendidas.",
      "Mide la nueva distancia entre las marcas superior e inferior.",
    ],
    positive: "Un aumento menor de unos 5 cm (distancia final por debajo de ~20 cm desde 15 cm) indica movilidad lumbar reducida.",
    interpretation:
      "Útil para medir y seguir la movilidad, no para diagnosticar: en fases iniciales de espondiloartritis las medidas de movilidad tienen poco valor diagnóstico. El dolor inflamatorio (inicio antes de los 45 años, rigidez matutina, mejora con el ejercicio) se asocia a espondiloartritis; su diagnóstico requiere analítica e imagen.",
    accuracy: [],
    utility: "desconocida",
    figures: [
      {
        view: "side",
        posture: "standing",
        to: { trunk: 80, r_hip: 80, l_hip: 80, r_shoulder: 80, l_shoulder: 80 },
        pose3d: { r_shoulder: { flex: 0, abd: 9 }, l_shoulder: { flex: 0, abd: 9 } },
        to3d: { r_shoulder: { flex: 80, abd: 16 }, l_shoulder: { flex: 80, abd: 16 } },
        hands: ["lumbar"],
        grips: [{ kind: "tips", face: "posterior" }],
        arrows: [{ at: "shoulder", dir: "anterior", kind: "move", label: "flexión" }],
        caption: "Se mide cuánto se separan las marcas al flexionar",
        side: "both",
        script: {
          start: { pelvis: { flex: 0 }, trunk: { flex: 0 }, r_hip: { flex: 0 }, l_hip: { flex: 0 } },
          steps: [{ to: { pelvis: { flex: 50 }, trunk: { flex: 35 }, r_hip: { flex: 50 }, l_hip: { flex: 50 } }, by: "patient", dur: 2.4, hold: 1.2, text: "Con las marcas hechas (5 cm por debajo y 10 cm por encima de la línea de las EIPS), pide que se incline hacia delante todo lo que pueda y mide la nueva distancia." }],
        },
        text: {
          setup: "Paciente de pie con los pies a la anchura de las caderas. El examinador, detrás, con una cinta métrica.",
          look: "Positivo si la distancia aumenta menos de unos 5 cm (de 15 a menos de 20 cm): movilidad lumbar reducida.",
        },
        supuestos: ["Las marcas y la cinta no se dibujan."],
      },
    ],
    related: ["lum-dolor-inflamatorio-asas"],
  },

  // ───────────── Signos no orgánicos ─────────────
  {
    id: "lum-waddell",
    region: "lumbar",
    group: "Signos no orgánicos",
    name: "Signos de Waddell",
    aka: ["Waddell's signs", "Signos no orgánicos"],
    kind: "cluster",
    purpose: "Detecta respuestas a la exploración que no encajan con una lesión anatómica y que sugieren influencia de factores psicosociales.",
    position: "Se integran en la exploración habitual con el paciente de pie, sentado y en supino.",
    steps: [
      "Hipersensibilidad: dolor superficial o no anatómico a la palpación leve.",
      "Simulación: dolor lumbar con carga axial ligera sobre la cabeza o con rotación conjunta de hombros y pelvis.",
      "Distracción: SLR positivo en supino pero negativo sentado (extensión de rodilla distraída).",
      "Alteraciones regionales: debilidad o pérdida sensitiva que no sigue un patrón neurológico.",
      "Sobrerreacción: quejas, gestos o temblores desproporcionados.",
    ],
    positive: "Tres o más de las cinco categorías positivas.",
    interpretation:
      "No distinguen el dolor orgánico del no orgánico ni detectan simulación o búsqueda de ganancia. Se asocian a peor evolución y deben llevar a explorar factores psicosociales (miedo, catastrofismo), no a dudar del paciente.",
    accuracy: [],
    utility: "desconocida",
    cautions: "No los uses para etiquetar simulación ni para negar tratamiento. Pueden coexistir con patología orgánica grave.",
    figures: [
      {
        view: "front",
        posture: "standing",
        hands: ["head"],
        grips: [{ kind: "press", face: "cranial" }],
        arrows: [{ at: "head", dir: "caudal", label: "carga axial" }],
        pain: ["lumbar"],
        caption: "Ejemplo: una carga axial ligera no debería provocar dolor lumbar",
        side: "both",
        script: {
          steps: [{ by: "examiner", dur: 0.8, hold: 1.6, path: false, pain: true, marks: [{ kind: "push", at: "head", dir: "caudal", label: "Carga axial ligera" }], text: "Ejemplo: una carga axial ligera sobre la cabeza no debería provocar dolor lumbar." }],
        },
        text: {
          setup: "Los signos se integran en la exploración habitual, de pie, sentado y en supino.",
          look: "Tres o más de las cinco categorías positivas (dolor a la palpación no anatómico, simulación, distracción, alteraciones regionales y reacción exagerada).",
        },
        supuestos: ["Solo se dibuja un ejemplo de simulación (carga axial)."],
      },
    ],
  },

  // ───────────── Reglas de tratamiento ─────────────
  {
    id: "lum-regla-manipulacion",
    region: "lumbar",
    group: "Reglas de tratamiento",
    name: "Regla de predicción de manipulación (Flynn/Childs)",
    aka: ["Manipulation clinical prediction rule", "Flynn et al. 2002", "Childs et al. 2004"],
    kind: "rule",
    purpose: "Regla de predicción publicada (Flynn/Childs) para identificar a los pacientes con dolor lumbar no radicular que probablemente mejoren a corto plazo con manipulación lumbopélvica.",
    position: "Combina historia, un cuestionario y la exploración en prono.",
    steps: [
      "Duración del episodio actual menor de 16 días.",
      "Puntuación del FABQ (subescala de trabajo) menor de 19.",
      "Hipomovilidad en al menos un nivel lumbar a la presión posteroanterior.",
      "Rotación interna de al menos una cadera mayor de 35°.",
      "Ningún síntoma por debajo de la rodilla.",
    ],
    positive: "Cuatro o más de los cinco criterios.",
    interpretation:
      "Con 4 de 5 criterios la probabilidad de éxito con manipulación aumenta mucho (ayuda a confirmar). El valor procede del estudio de derivación; un ensayo posterior (Childs 2004) confirmó el beneficio en este subgrupo. Aplícala solo a pacientes parecidos a los de esos estudios.",
    accuracy: [
      {
        lrPos: 24.38,
        context: "4 o más de 5 criterios; derivación, 71 pacientes con dolor lumbar no radicular; éxito a corto plazo con manipulación",
        source: "Flynn et al., 2002",
        citation:
          "Flynn T, et al. A clinical prediction rule for classifying patients with low back pain who demonstrate short-term improvement with spinal manipulation. Spine. 2002;27(24):2835-43.",
      },
    ],
    utility: "alta",
    cautions: "Contraindicaciones descritas para la manipulación: signos de alarma, osteoporosis, fractura, déficit neurológico progresivo o anticoagulación mal controlada.",
    figures: [
      {
        view: "side",
        posture: "prone",
        joints: { r_knee: 90 },
        hands: ["r_ankle", "pelvis"],
        grips: [{ kind: "grasp", face: "caudal" }, { kind: "press", face: "posterior" }],
        arrows: [{ at: "r_shank@0.8", rotate: "cw", label: "RI > 35°" }],
        caption: "Uno de los criterios: rotación interna de cadera mayor de 35°",
        side: "r",
        script: {
          start: { r_knee: { flex: 90 }, r_hip: { rot: 0 } },
          steps: [{ to: { r_hip: { rot: 40 } }, by: "examiner", dur: 1.6, hold: 1.2, text: "Uno de los cinco criterios: rotación interna de cadera mayor de 35°." }],
        },
        text: {
          setup: "Paciente en prono con la rodilla derecha a 90°. Una mano fija la pelvis y la otra sujeta el tobillo.",
          look: "Cuatro o más de los cinco criterios (dolor < 16 días, sin síntomas por debajo de la rodilla, FABQ < 19, hipomovilidad lumbar y RI de cadera > 35°) predicen buena respuesta a la manipulación.",
        },
        supuestos: ["Solo se dibuja uno de los criterios (RI de 40°)."],
      },
    ],
    related: ["lum-regla-estabilizacion"],
  },
  {
    id: "lum-dolor-inflamatorio-asas",
    region: "lumbar",
    group: "Movilidad y espondiloartritis",
    name: "Criterios ASAS de dolor lumbar inflamatorio",
    aka: ["ASAS inflammatory back pain criteria", "Criterios de expertos de dolor lumbar inflamatorio"],
    kind: "rule",
    purpose: "Identifica, con cinco preguntas, el dolor lumbar crónico de perfil inflamatorio que hace sospechar una espondiloartritis axial.",
    position: "Paciente con dolor lumbar de más de 3 meses. Se pregunta en la entrevista.",
    steps: [
      "Mejora con el ejercicio.",
      "Dolor por la noche (que mejora al levantarse).",
      "Comienzo insidioso.",
      "Comienzo antes de los 40 años.",
      "No mejora con el reposo.",
    ],
    positive: "Al menos 4 de los 5.",
    interpretation:
      "Ayudan a reconocer el dolor inflamatorio, no confirman la enfermedad: en la cohorte de validación la especificidad bajó al 72 %. Si se cumplen, sobre todo en un adulto joven, la bibliografía recomienda valoración reumatológica (analítica e imagen de las sacroilíacas). Las medidas de movilidad (Schober) sirven más para el seguimiento que para el diagnóstico.",
    accuracy: [
      { sens: 77, spec: 91.7, context: "Dolor lumbar crónico; referencia: juicio de 13 reumatólogos expertos que exploraron a 20 pacientes", ...SIEPER_2009 },
      { sens: 79.6, spec: 72.4, context: "Cohorte de validación de 648 pacientes con dolor lumbar crónico", ...SIEPER_2009 },
    ],
    utility: "moderada",
    figures: [
      {
        view: "side",
        posture: "standing",
        to: { trunk: 60, r_hip: 60, l_hip: 60, r_shoulder: 60, l_shoulder: 60 },
        arrows: [{ at: "shoulder", dir: "anterior", kind: "move", label: "se mueve y mejora" }],
        pain: ["lumbar"],
        caption: "Dolor que mejora con el movimiento y no con el reposo",
        side: "both",
        script: {
          start: { pelvis: { flex: 0 }, trunk: { flex: 0 }, r_hip: { flex: 0 }, l_hip: { flex: 0 } },
          steps: [
            { dur: 0.6, hold: 1.4, pain: true, path: false, text: "Pregunta por la rigidez y el dolor de madrugada, que mejoran al levantarse y moverse." },
            { to: { pelvis: { flex: 35 }, trunk: { flex: 25 }, r_hip: { flex: 35 }, l_hip: { flex: 35 } }, by: "patient", dur: 2.2, hold: 0.6, painEnd: true, label: "Ejercicio", text: "El dolor inflamatorio mejora con el ejercicio y no con el reposo." },
          ],
        },
        text: {
          setup: "Se pregunta en la entrevista a un paciente con dolor lumbar de más de 3 meses.",
          look: "Al menos 4 de 5: mejora con el ejercicio, dolor nocturno, comienzo insidioso, comienzo antes de los 40 y no mejora con el reposo.",
        },
        supuestos: ["Los criterios son preguntas: la figura solo representa la mejora con el movimiento."],
      },
    ],
    related: ["lum-schober"],
  },
];
