import type { SpecialTest } from "../types";

// Tobillo y pie. Datos de precisión comprobados con búsqueda (ver `accuracy` de cada test).

const bachmann = "Bachmann LM, Kolb E, Koller MT, Steurer J, ter Riet G. Accuracy of Ottawa ankle rules to exclude fractures of the ankle and mid-foot: systematic review. BMJ. 2003;326(7386):417-423.";
const beceren = "Beceren GN, Yolcu S, Tomruk O, Atay T, Baykal YB. Ottawa versus Bernese: which is better? Eur J Trauma Emerg Surg. 2013;39(2).";
const sman = "Sman AD, et al. Diagnostic accuracy of clinical tests for ankle syndesmosis injury. Br J Sports Med. 2015;49(5):323-329.";
const sindesmosis2021 = "Diagnostic accuracy of clinical tests assessing ligamentous injury of the ankle syndesmosis: a systematic review with meta-analysis. 2021 (6 estudios, 512 participantes; repositorio de la Universidad de Ulster).";
const netterstrom = "Netterström-Wedin F, Matthews M, Bleakley C. Diagnostic accuracy of clinical tests assessing ligamentous injury of the talocrural and subtalar joints: a systematic review with meta-analysis. Sports Health. 2021.";
const li2020 = "Li Q, Tu Y, Chen J, Shan J, Yung PS, Ling SK, Hua Y. Reverse anterolateral drawer test is more sensitive and accurate for diagnosing chronic anterior talofibular ligament injury. Knee Surg Sports Traumatol Arthrosc. 2020;28:55-62.";
const maffulli = "Maffulli N. The clinical diagnosis of subcutaneous tear of the Achilles tendon. A prospective study in 174 patients. Am J Sports Med. 1998;26(2):266-270.";
const reiman = "Reiman M, et al. The utility of clinical measures for the diagnosis of Achilles tendon injuries: a systematic review with meta-analysis. J Athl Train. 2014;49(6):820-829.";

export const tobilloPieTests: SpecialTest[] = [
  // ───────────── Esguince lateral e inestabilidad ─────────────
  {
    id: "tob-cajon-anterior",
    region: "tobillo_pie",
    group: "Esguince lateral e inestabilidad",
    name: "Cajón anterior del tobillo",
    aka: ["Anterior drawer test", "ADT"],
    kind: "test",
    purpose: "Valora la laxitud del ligamento peroneoastragalino anterior (LPAA) tras un esguince en inversión.",
    position: "Paciente en supino o sentado con la rodilla flexionada y el tobillo en unos 10-20° de flexión plantar. El examinador fija la tibia distal con una mano y sujeta el talón con la otra.",
    steps: [
      "Relaja al paciente con la rodilla flexionada para destensar el gemelo.",
      "Estabiliza la tibia distal por su cara anterior.",
      "Con la mano en el talón, lleva el pie hacia delante respecto a la tibia.",
      "Compara el desplazamiento y la sensación final con el lado sano.",
    ],
    positive: "Desplazamiento anterior mayor que en el lado sano, tope blando o aparición de un hoyuelo (signo de succión) delante del maléolo lateral.",
    interpretation:
      "Más útil para confirmar que para descartar: especificidad aceptable y sensibilidad baja en el metaanálisis. Combínalo con la palpación del LPAA (sensible) y hazlo a los 4-5 días, cuando ha bajado el dolor y la inflamación.",
    accuracy: [
      { sens: 54, spec: 87, context: "Metaanálisis, 6 estudios (885 observaciones), lesión del LPAA", source: "Netterström-Wedin et al., 2021", citation: netterstrom },
      { sens: 74, spec: 38, lrPos: 1.21, context: "Laxitud medida con ecografía (intervalo peroneoastragalino ≥ 2,3 mm), 66 personas con esguince previo", source: "Croy et al., 2013", citation: "Croy T, Koppenhaver S, Saliba S, Hertel J. Anterior talocrural joint laxity: diagnostic accuracy of the anterior drawer test of the ankle. J Orthop Sports Phys Ther. 2013;43(12):911-919." },
      { sens: 39.5, spec: 100, context: "Lesión crónica del LPAA frente a ecografía, 72 tobillos (examinador experto)", source: "Li et al., 2020", citation: li2020, doi: "10.1007/s00167-019-05705-x" },
    ],
    utility: "moderada",
    cautions: "Descarta antes una fractura (reglas de Ottawa). En fase aguda el dolor y la defensa muscular dan falsos negativos.",
    figures: [
      {
        view: "side",
        posture: "supine",
        joints: { r_hip: 30, r_knee: 60, r_ankle: -15 },
        hands: ["r_shank@0.85", "r_ankle"],
        grips: [{ kind: "press", face: "anterior" }, { kind: "grasp", face: "posterior" }],
        arrows: [{ at: "r_foot@0.15", dir: "anterior", label: "anterior" }],
        pain: ["r_ankle"],
        side: "r",
        script: {
          start: { r_hip: { flex: 30 }, r_knee: { flex: 60 }, r_ankle: { flex: -15 } },
          steps: [
            { shift: { seg: "r_foot", dir: "anterior", cm: 1.0 }, by: "examiner", dur: 0.8, hold: 1.2, path: false, text: "Fija la tibia distal y, con la mano en el talón, lleva el pie hacia delante." },
          ],
        },
        text: {
          setup: "Paciente en supino con la rodilla derecha flexionada y el tobillo en unos 15° de flexión plantar. Una mano fija la tibia distal y la otra sujeta el talón.",
          look: "Positivo si el pie avanza más que en el lado sano, el tope es blando o aparece un hoyuelo delante del maléolo lateral.",
        },
        supuestos: ["Desplazamiento exagerado (1 cm) para que se vea."],
      },
    ],
    related: ["tob-cajon-anterolateral", "tob-exploracion-diferida", "tob-inclinacion-talar"],
  },
  {
    id: "tob-cajon-anterolateral",
    region: "tobillo_pie",
    group: "Esguince lateral e inestabilidad",
    name: "Cajón anterolateral",
    aka: ["Anterolateral drawer test", "ALDT", "Cajón anterior con rotación interna"],
    kind: "test",
    purpose: "Variante del cajón anterior que añade rotación interna del astrágalo para tensar mejor el LPAA.",
    position: "Paciente sentado o en supino con la rodilla flexionada y el tobillo relajado en ligera flexión plantar. El examinador fija la tibia distal y sujeta el retropié.",
    steps: [
      "Estabiliza la tibia distal con una mano.",
      "Con la otra mano en el talón, desplaza el pie hacia delante mientras lo giras hacia dentro (rotación interna).",
      "Deja libre el lado medial para que el astrágalo pivote sobre el ligamento deltoideo.",
      "Compara con el lado sano.",
    ],
    positive: "Mayor desplazamiento anterolateral del astrágalo que en el lado sano, a veces con hoyuelo anterolateral.",
    interpretation:
      "En un estudio pequeño de lesión crónica tuvo especificidad máxima y sensibilidad moderada, algo mejor que el cajón clásico: un positivo apoya la lesión, un negativo no la descarta. Confírmalo con ecografía si cambia la decisión.",
    accuracy: [
      { sens: 50, spec: 100, context: "Lesión crónica del LPAA frente a ecografía, 72 tobillos (examinador experto)", source: "Li et al., 2020", citation: li2020, doi: "10.1007/s00167-019-05705-x" },
    ],
    utility: "alta",
    cautions: "Datos de un solo estudio pequeño. No forzar si se sospecha fractura.",
    figures: [
      {
        view: "side",
        posture: "supine",
        joints: { r_hip: 30, r_knee: 60, r_ankle: -15 },
        hands: ["r_shank@0.85", "r_ankle"],
        grips: [{ kind: "press", face: "anterior" }, { kind: "grasp", face: "posterior" }],
        arrows: [
          { at: "r_foot@0.15", dir: "anterior", label: "anterior" },
          { at: "r_foot@0.6", rotate: "ccw", label: "RI" },
        ],
        pain: ["r_ankle"],
        side: "r",
        script: {
          start: { r_hip: { flex: 30 }, r_knee: { flex: 60 }, r_ankle: { flex: -15, rot: 0 } },
          steps: [
            {
              to: { r_ankle: { rot: 15 } },
              shift: { seg: "r_foot", dir: "anterior", cm: 0.8 },
              by: "examiner",
              dur: 1.0,
              hold: 1.2,
              text: "Fija la tibia y lleva el pie hacia delante mientras lo giras hacia dentro, dejando libre el lado medial.",
              label: "RI del pie 15°",
            },
          ],
        },
        text: {
          setup: "Paciente en supino con la rodilla derecha flexionada y el tobillo relajado en ligera flexión plantar. Una mano fija la tibia distal y la otra sujeta el retropié.",
          look: "Positivo si el astrágalo se desplaza hacia delante y fuera más que en el lado sano, a veces con un hoyuelo anterolateral.",
        },
        supuestos: ["Giro interno de 15° y desplazamiento de 0,8 cm, exagerados para que se vean (la fuente no da valores)."],
      },
    ],
    related: ["tob-cajon-anterior"],
  },
  {
    id: "tob-inclinacion-talar",
    region: "tobillo_pie",
    group: "Esguince lateral e inestabilidad",
    name: "Inclinación astragalina (talar tilt)",
    aka: ["Talar tilt test", "Bostezo en varo del tobillo", "Inversion stress test"],
    kind: "test",
    purpose: "Valora la integridad del ligamento peroneocalcáneo (LPC) y, en parte, del LPAA.",
    position: "Paciente en supino o en decúbito lateral con el tobillo en posición neutra. El examinador fija la tibia distal y sujeta el calcáneo.",
    steps: [
      "Coloca el tobillo en neutro (90°) para tensar el LPC.",
      "Fija la tibia distal por encima de los maléolos.",
      "Lleva el calcáneo y el astrágalo en inversión (varo).",
      "Compara la apertura lateral y el tope con el lado sano.",
    ],
    positive: "Mayor inclinación en varo o tope blando respecto al lado sano, con dolor lateral.",
    interpretation:
      "La revisión de Netterström-Wedin (2021) concluye que sirve para confirmar lesión del LPC pero que no hay un test sensible para ese ligamento; no se han comprobado cifras agrupadas. Interprétalo junto al cajón anterior.",
    accuracy: [],
    utility: "desconocida",
    cautions: "Descarta antes fractura de maléolo o del 5.º metatarsiano.",
    figures: [
      {
        view: "front",
        posture: "supine",
        hands: ["r_shank@0.85", "r_foot@0.25"],
        grips: [{ kind: "grasp", face: "anterior" }, { kind: "grasp", face: "lateral" }],
        arrows: [{ at: "r_foot@0.5", dir: "medial", label: "inversión" }],
        pain: ["r_ankle"],
        caption: "Visto desde arriba",
        side: "r",
        script: {
          start: { r_ankle: { flex: 0, inv: 0 } },
          steps: [{ to: { r_ankle: { inv: 25 } }, by: "examiner", dur: 1.4, hold: 1.2, text: "Con el tobillo en neutro y la tibia fijada, lleva el calcáneo y el astrágalo a inversión (varo)." }],
        },
        text: {
          setup: "Paciente en supino con el tobillo derecho en neutro (90°). Una mano fija la tibia distal por encima de los maléolos y la otra sujeta el calcáneo.",
          look: "Positivo si la inclinación en varo es mayor o el tope más blando que en el lado sano, con dolor lateral.",
        },
        supuestos: ["Se dibuja la inversión de todo el retropié (25°); la inclinación del astrágalo dentro de la mortaja no se puede separar en el maniquí."],
      },
    ],
    related: ["tob-cajon-anterior"],
  },
  {
    id: "tob-exploracion-diferida",
    region: "tobillo_pie",
    group: "Esguince lateral e inestabilidad",
    name: "Exploración diferida a los 4-5 días (van Dijk)",
    aka: ["Delayed physical examination", "Exploración física diferida del esguince"],
    kind: "cluster",
    purpose: "Detecta la rotura de los ligamentos laterales combinando varios hallazgos explorados unos días después del esguince.",
    position: "Paciente sentado o en supino, 4-5 días después de la lesión. El examinador inspecciona, palpa y hace el cajón anterior.",
    steps: [
      "Espera a que pasen 4-5 días desde la torcedura (antes, el dolor y la hinchazón confunden).",
      "Busca hematoma en la cara lateral del tobillo.",
      "Palpa el LPAA delante del maléolo lateral buscando dolor.",
      "Haz el cajón anterior y compáralo con el lado sano.",
    ],
    positive: "Dolor a la palpación del LPAA con hematoma lateral y, sobre todo, cajón anterior positivo indican rotura ligamentosa; si no hay dolor a la palpación, la rotura es poco probable.",
    interpretation:
      "Sirve tanto para confirmar como para descartar rotura ligamentosa, mejor que la exploración en las primeras 48 h y sin que la artrografía o la ecografía añadan mucho. Es la forma recomendada de explorar el esguince lateral.",
    accuracy: [
      {
        sens: 96,
        spec: 84,
        context: "160 pacientes con traumatismo en inversión; exploración a los 5 días comparada con artrografía, radiografía de estrés y ecografía",
        source: "van Dijk et al., 1996",
        citation: "van Dijk CN, et al. Diagnosis of ligament rupture of the ankle joint: physical examination, arthrography, stress radiography and sonography compared in 160 patients after inversion trauma. Acta Orthop Scand. 1996;67(6):566-570.",
      },
    ],
    utility: "alta",
    cautions: "Antes, aplica las reglas de Ottawa para decidir si hace falta radiografía.",
    figures: [
      {
        view: "side",
        posture: "supine",
        joints: { r_hip: 30, r_knee: 60, r_ankle: -10 },
        hands: ["r_ankle"],
        grips: [{ kind: "tips", face: "lateral" }],
        pain: ["r_ankle"],
        caption: "Palpación del LPAA a los 4-5 días",
        side: "r",
        script: {
          start: { r_hip: { flex: 30 }, r_knee: { flex: 60 }, r_ankle: { flex: -10 } },
          steps: [{ dur: 0.8, hold: 1.6, path: false, marks: [{ kind: "push", at: "r_ankle", dir: "medial", label: "Palpa el LPAA" }], text: "A los 4-5 días, busca hematoma lateral y palpa el LPAA delante del maléolo lateral." }],
        },
        text: {
          setup: "Paciente en supino, 4-5 días después de la torcedura, con la rodilla derecha flexionada.",
          look: "Dolor en el LPAA con hematoma lateral y, sobre todo, cajón anterior positivo: rotura ligamentosa. Sin dolor a la palpación, la rotura es poco probable.",
        },
        supuestos: ["Solo se dibuja la palpación; el cajón anterior está en su propia figura."],
      },
    ],
    related: ["tob-cajon-anterior", "tob-ottawa"],
  },

  // ───────────── Sindesmosis (esguince alto) ─────────────
  {
    id: "tob-squeeze",
    region: "tobillo_pie",
    group: "Sindesmosis (esguince alto)",
    name: "Test de compresión peroneotibial (squeeze)",
    aka: ["Squeeze test", "Test de Hopkinson", "Compresión de la pierna"],
    kind: "test",
    purpose: "Busca lesión de la sindesmosis tibioperonea distal comprimiendo peroné y tibia a media pierna.",
    position: "Paciente en supino o sentado con la pierna relajada. El examinador rodea la pierna con las manos a media altura.",
    steps: [
      "Coloca las manos en la mitad de la pierna, una en el peroné y otra en la tibia.",
      "Aprieta el peroné contra la tibia de forma progresiva.",
      "Mantén unos segundos y suelta.",
      "Pregunta dónde nota el dolor.",
    ],
    positive: "Dolor en la zona de la sindesmosis distal (encima del tobillo, por delante) al comprimir lejos de ella.",
    interpretation:
      "Es el más específico de los tests de sindesmosis, pero poco sensible: ayuda algo a confirmar y no sirve para descartar. Úsalo después de los tests sensibles (palpación del LTPA, dorsiflexión con compresión).",
    accuracy: [
      { sens: 26, spec: 88, lrPos: 2.15, context: "87 pacientes con esguince de tobillo, frente a RM", source: "Sman et al., 2015", citation: sman },
      { spec: 85, context: "Metaanálisis, 4 estudios (especificidad agrupada)", source: "Metaanálisis de sindesmosis, 2021", citation: sindesmosis2021 },
    ],
    utility: "moderada",
    cautions: "Si el dolor es intenso o hay sospecha de fractura del peroné, pide radiografía antes.",
    figures: [
      {
        view: "front",
        posture: "supine",
        hands: ["r_shank@0.5", "r_shank@0.5"],
        grips: [{ kind: "press", face: "lateral" }, { kind: "press", face: "medial" }],
        arrows: [{ at: "r_shank@0.5", dir: "medial", label: "compresión" }],
        pain: ["r_shank@0.92"],
        caption: "Visto desde arriba",
        side: "r",
        script: {
          steps: [{ by: "examiner", dur: 1.0, hold: 1.4, path: false, pain: true, marks: [{ kind: "push", at: "r_shank@0.5", dir: "medial", label: "Aprieta el peroné contra la tibia" }], text: "A media pierna, aprieta el peroné contra la tibia de forma progresiva; mantén unos segundos y suelta." }],
        },
        text: {
          setup: "Paciente en supino con la pierna derecha relajada. Las manos rodean la pierna a media altura.",
          look: "Positivo si duele en la sindesmosis distal (encima del tobillo, por delante) al comprimir lejos de ella.",
        },
      },
    ],
    related: ["tob-cluster-sindesmosis", "tob-rotacion-externa", "tob-dorsiflexion-compresion", "tob-palpacion-ltpa"],
  },
  {
    id: "tob-rotacion-externa",
    region: "tobillo_pie",
    group: "Sindesmosis (esguince alto)",
    name: "Test de rotación externa (Kleiger)",
    aka: ["External rotation test", "Kleiger test", "Dorsiflexion-external rotation stress test"],
    kind: "test",
    purpose: "Tensa la sindesmosis distal llevando el astrágalo en rotación externa, con el tobillo en flexión dorsal.",
    position: "Paciente sentado con la rodilla a 90° y la pierna colgando. El examinador fija la pierna con una mano y sujeta el pie con la otra.",
    steps: [
      "Estabiliza la tibia distal sin comprimir la sindesmosis.",
      "Lleva el tobillo a flexión dorsal (versión más usada en estudios).",
      "Gira el pie hacia fuera (rotación externa).",
      "Pregunta por dolor y dónde aparece.",
    ],
    positive: "Dolor en la sindesmosis anterior o posterior (encima del tobillo). El dolor medial puede indicar lesión del deltoideo.",
    interpretation:
      "Precisión limitada por separado: especificidad moderada y sensibilidad media. Útil dentro de la secuencia de sindesmosis, como test de confirmación junto al squeeze.",
    accuracy: [
      { sens: 71, spec: 63, lrPos: 1.93, lrNeg: 0.46, context: "Versión en flexión dorsal; 87 pacientes, frente a RM", source: "Sman et al., 2015", citation: sman },
      { spec: 78, context: "Metaanálisis, 4 estudios (especificidad agrupada)", source: "Metaanálisis de sindesmosis, 2021", citation: sindesmosis2021 },
    ],
    utility: "moderada",
    cautions: "No forzar si se sospecha fractura o inestabilidad franca.",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { r_ankle: 10 },
        hands: ["r_shank@0.75", "r_foot@0.6"],
        grips: [{ kind: "grasp", face: "anterior" }, { kind: "grasp", face: "medial" }],
        arrows: [{ at: "r_foot@0.6", rotate: "cw", label: "RE" }],
        pain: ["r_shank@0.95"],
        side: "r",
        script: {
          start: { r_ankle: { flex: 0, rot: 0 } },
          steps: [
            { to: { r_ankle: { flex: 10 } }, by: "examiner", dur: 1.0, text: "Con la tibia estabilizada, lleva el tobillo a flexión dorsal." },
            { to: { r_ankle: { rot: -25 } }, by: "examiner", dur: 1.4, hold: 1.2, text: "Gira el pie hacia fuera (rotación externa) y pregunta dónde duele.", label: "RE del pie 25°" },
          ],
        },
        text: {
          setup: "Paciente sentado con la rodilla derecha a 90° y la pierna colgando. Una mano fija la pierna sin comprimir la sindesmosis y la otra sujeta el pie.",
          look: "Positivo si duele la sindesmosis anterior o posterior (encima del tobillo). El dolor medial puede indicar lesión del deltoideo.",
        },
        supuestos: ["Flexión dorsal de 10° y rotación externa de 25° (la fuente no da grados)."],
      },
    ],
    related: ["tob-squeeze", "tob-cluster-sindesmosis"],
  },
  {
    id: "tob-dorsiflexion-compresion",
    region: "tobillo_pie",
    group: "Sindesmosis (esguince alto)",
    name: "Zancada en flexión dorsal con compresión",
    aka: ["Dorsiflexion lunge with compression", "Dorsiflexion compression test"],
    kind: "test",
    purpose: "Compara el dolor y el rango de flexión dorsal en carga con y sin compresión manual de los maléolos.",
    position: "Paciente de pie en zancada con el pie afectado delante. El examinador se coloca a su lado y rodea los maléolos con las manos.",
    steps: [
      "Pide al paciente que lleve la rodilla hacia delante, sobre los dedos, sin levantar el talón.",
      "Anota el dolor y hasta dónde llega.",
      "Repite mientras comprimes los maléolos entre sí.",
      "Compara ambas repeticiones.",
    ],
    positive: "Menos dolor o más flexión dorsal cuando se comprimen los maléolos.",
    interpretation:
      "Más sensible que específico: sirve como test inicial para no pasar por alto la lesión, no para confirmarla. Si es positivo, sigue con squeeze y rotación externa.",
    accuracy: [
      { sens: 69, spec: 41, context: "87 pacientes con esguince, frente a RM", source: "Sman et al., 2015", citation: sman },
      { sens: 75, context: "Metaanálisis, 2 estudios (sensibilidad agrupada)", source: "Metaanálisis de sindesmosis, 2021", citation: sindesmosis2021 },
    ],
    utility: "baja",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { trunk: 10, r_hip: 45, r_knee: 80, r_ankle: 35, l_hip: -40, l_ankle: 30 },
        hands: ["r_shank@0.92", "r_shank@0.92"],
        grips: [{ kind: "press", face: "lateral" }, { kind: "press", face: "medial" }],
        arrows: [
          { at: "r_knee", dir: "anterior", kind: "move" },
          { at: "r_shank@0.92", dir: "medial", label: "compresión" },
        ],
        pain: ["r_ankle"],
        side: "r",
        script: {
          start: { pelvis: { flex: 5 }, trunk: { flex: 5 }, r_hip: { flex: 38 }, r_knee: { flex: 58 }, r_ankle: { flex: 25 }, l_hip: { flex: -23 }, l_knee: { flex: 2 }, l_ankle: { flex: 30 } },
          steps: [
            { to: { r_knee: { flex: 63 }, r_ankle: { flex: 30 }, l_hip: { flex: -26.5 }, l_ankle: { flex: 31.5 } }, by: "patient", dur: 1.6, hold: 0.8, path: ["r_hip"], label: "Rodilla hacia delante", pain: true, text: "Lleva la rodilla hacia delante, sobre los dedos, sin levantar el talón. Anota el dolor y hasta dónde llega." },
            { to: { pelvis: { flex: 5 }, trunk: { flex: 5 }, r_hip: { flex: 38 }, r_knee: { flex: 58 }, r_ankle: { flex: 25 }, l_hip: { flex: -23 }, l_knee: { flex: 2 }, l_ankle: { flex: 30 } }, by: "patient", dur: 1.2, path: false, text: "Vuelve atrás." },
            { by: "examiner", dur: 0.6, hold: 0.3, path: false, marks: [{ kind: "push", at: "r_shank@0.92", dir: "medial", label: "Comprime los maléolos" }], text: "Ahora comprime los maléolos entre sí…" },
            {
              to: { r_knee: { flex: 68 }, r_ankle: { flex: 35 }, l_hip: { flex: -29 }, l_ankle: { flex: 34 } },
              by: "patient",
              dur: 1.6,
              hold: 0.8,
              path: ["r_hip"],
              label: "Rodilla hacia delante",
              marks: [{ kind: "push", at: "r_shank@0.92", dir: "medial", label: "" }],
              text: "…y repite: con la compresión llega más lejos y duele menos.",
            },
          ],
        },
        text: {
          setup: "Paciente de pie en zancada con el pie derecho delante. El examinador, a su lado, rodea los maléolos con las manos.",
          look: "Positivo si con la compresión duele menos o la flexión dorsal es mayor.",
        },
        supuestos: ["Se enseña un positivo: la flexión dorsal pasa de 30° sin compresión a 35° con ella (la fuente no da grados).", "Zancada de unos 47 cm, con los dos pies apoyados, 5° de anteversión pélvica y el tronco inclinado 10°."],
        camera: { from: [0.95, 0.05, 0.3], zoom: 1.1 },
      },
    ],
    related: ["tob-cluster-sindesmosis", "tob-palpacion-ltpa"],
  },
  {
    id: "tob-palpacion-ltpa",
    region: "tobillo_pie",
    group: "Sindesmosis (esguince alto)",
    name: "Palpación del ligamento tibioperoneo anterior",
    aka: ["AITFL palpation", "Palpación de la sindesmosis anterior"],
    kind: "test",
    purpose: "Busca dolor localizado en el ligamento tibioperoneo anteroinferior (LTPA), por encima del LPAA.",
    position: "Paciente en supino o sentado con el tobillo relajado. El examinador palpa con el pulgar la cara anterior del tobillo.",
    steps: [
      "Localiza el maléolo lateral y la interlínea articular anterior.",
      "Sube un poco por encima de la interlínea, entre tibia y peroné.",
      "Presiona de forma mantenida y compara con el LPAA y con el lado sano.",
    ],
    positive: "Dolor claro sobre el LTPA, por encima de la interlínea.",
    interpretation:
      "Es el test más sensible de la sindesmosis: si no duele, la lesión es menos probable. Poco específico, por lo que un positivo debe confirmarse con squeeze o rotación externa.",
    accuracy: [{ sens: 92, context: "Metaanálisis (sensibilidad agrupada)", source: "Metaanálisis de sindesmosis, 2021", citation: sindesmosis2021 }],
    utility: "moderada",
    figures: [
      {
        view: "side",
        posture: "supine",
        joints: { r_hip: 30, r_knee: 60, r_ankle: -5 },
        hands: ["r_shank@0.95"],
        grips: [{ kind: "tips", face: "anterior" }],
        pain: ["r_shank@0.95"],
        side: "r",
        script: {
          start: { r_hip: { flex: 30 }, r_knee: { flex: 60 }, r_ankle: { flex: -5 } },
          steps: [{ dur: 0.8, hold: 1.6, path: false, marks: [{ kind: "push", at: "r_shank@0.95", dir: "posterior", label: "Presiona el LTPA" }], text: "Algo por encima de la interlínea, entre tibia y peroné, presiona de forma mantenida y compara con el LPAA y con el otro lado." }],
        },
        text: {
          setup: "Paciente en supino con la rodilla derecha flexionada y el tobillo relajado.",
          look: "Positivo si duele claramente sobre el LTPA, por encima de la interlínea.",
        },
      },
    ],
    related: ["tob-cluster-sindesmosis", "tob-squeeze"],
  },
  {
    id: "tob-cluster-sindesmosis",
    region: "tobillo_pie",
    group: "Sindesmosis (esguince alto)",
    name: "Secuencia de tests de sindesmosis",
    aka: ["Syndesmosis cluster", "Esguince alto de tobillo"],
    kind: "cluster",
    purpose: "Ordena los tests de sindesmosis: primero los sensibles para descartar, después el más específico para confirmar.",
    position: "Paciente en supino o sentado para la palpación y el squeeze; de pie para la zancada en flexión dorsal.",
    steps: [
      "Palpa el LTPA (sensible).",
      "Haz la zancada en flexión dorsal con y sin compresión (sensible).",
      "Si ambos son negativos, la lesión de sindesmosis es poco probable.",
      "Si alguno es positivo, haz el squeeze (y la rotación externa) para confirmar.",
    ],
    positive: "Tests sensibles positivos más squeeze positivo: sospecha alta de lesión de sindesmosis; derivar para imagen.",
    interpretation:
      "Ningún test aislado es a la vez sensible y específico; la revisión de 2021 recomienda esta secuencia. Los tests clínicos no distinguen entre lesión estable e inestable: esa decisión requiere RM o artroscopia.",
    accuracy: [],
    utility: "desconocida",
    cautions: "Sospecha alta: inmovilizar y derivar para imagen (RM, radiografía en carga).",
    figures: [
      {
        view: "front",
        posture: "supine",
        hands: ["r_shank@0.5", "r_shank@0.5"],
        grips: [{ kind: "press", face: "lateral" }, { kind: "press", face: "medial" }],
        arrows: [{ at: "r_shank@0.5", dir: "medial", label: "squeeze" }],
        pain: ["r_shank@0.92"],
        caption: "Paso final: squeeze",
        side: "r",
        script: {
          steps: [{ by: "examiner", dur: 1.0, hold: 1.4, path: false, pain: true, marks: [{ kind: "push", at: "r_shank@0.5", dir: "medial", label: "Squeeze" }], text: "Paso final de la secuencia: si la palpación del LTPA o la zancada son positivas, confirma con el squeeze." }],
        },
        text: {
          setup: "Paciente en supino con la pierna derecha relajada.",
          look: "Palpación del LTPA y zancada en flexión dorsal negativas: lesión poco probable. Si alguna es positiva y el squeeze también, sospecha alta: derivar para imagen.",
        },
        supuestos: ["Solo se dibuja el último paso (squeeze)."],
      },
    ],
    related: ["tob-palpacion-ltpa", "tob-dorsiflexion-compresion", "tob-squeeze", "tob-rotacion-externa"],
  },

  // ───────────── Fracturas ─────────────
  {
    id: "tob-ottawa",
    region: "tobillo_pie",
    group: "Fracturas",
    name: "Reglas de Ottawa para tobillo y mediopié",
    aka: ["Ottawa ankle rules", "Ottawa foot rules"],
    kind: "rule",
    purpose: "Decide si un traumatismo de tobillo o mediopié necesita radiografía.",
    position: "Paciente sentado o en supino para la palpación y luego de pie para valorar la carga.",
    steps: [
      "Palpa los 6 cm distales del borde posterior y la punta del maléolo lateral.",
      "Palpa los 6 cm distales del borde posterior y la punta del maléolo medial.",
      "Palpa la base del 5.º metatarsiano y el escafoides (navicular).",
      "Pide que dé 4 pasos apoyando el pie (vale cojeando), justo tras la lesión y en la consulta.",
    ],
    positive:
      "Radiografía de tobillo si hay dolor en zona maleolar y dolor óseo en un borde posterior o punta de maléolo o incapacidad para 4 pasos. Radiografía de pie si hay dolor en mediopié y dolor en base del 5.º metatarsiano o escafoides o incapacidad para 4 pasos.",
    interpretation:
      "Excelente para descartar fractura: si la regla es negativa, la probabilidad de fractura es muy baja y se evita la radiografía. Su especificidad es modesta, por lo que un positivo solo indica que hay que hacer radiografía.",
    accuracy: [
      { sens: 97.6, context: "Revisión sistemática; sensibilidad agrupada de todos los estudios (15 581 pacientes)", source: "Bachmann et al., 2003", citation: bachmann },
      { lrNeg: 0.08, context: "Tobillo (revisión sistemática)", source: "Bachmann et al., 2003", citation: bachmann },
      { lrNeg: 0.08, context: "Mediopié (revisión sistemática)", source: "Bachmann et al., 2003", citation: bachmann },
      { lrNeg: 0.07, context: "Niños, tobillo y mediopié (revisión sistemática)", source: "Bachmann et al., 2003", citation: bachmann },
      { sens: 74.8, spec: 68.6, context: "Estudio prospectivo, 962 adultos, todos con radiografía", source: "Beceren et al., 2013", citation: beceren },
    ],
    utility: "alta",
    cautions: "No aplicable con intoxicación, lesiones distractoras, alteración sensitiva o en niños muy pequeños. Ante deformidad evidente, radiografía directa.",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { r_hip: 15, l_hip: -15 },
        arrows: [{ at: "r_knee", dir: "anterior", kind: "move", label: "4 pasos" }],
        pain: ["r_shank@0.97", "r_foot@0.55"],
        caption: "Puntos óseos y prueba de carga",
        side: "r",
        script: {
          steps: [{ to: { l_hip: { flex: 25 }, l_knee: { flex: 15 }, r_hip: { flex: -10 } }, by: "patient", dur: 1.4, hold: 1.0, path: false, text: "Pide que dé un paso apoyando el pie derecho (vale cojeando)." }],
        },
        text: {
          setup: "Paciente tras una torcedura del tobillo derecho. Primero se palpan los puntos óseos; luego se valora la carga.",
          look: "Radiografía de tobillo: dolor maleolar y dolor óseo en el borde posterior o la punta de un maléolo, o no da 4 pasos. De pie: dolor en el mediopié y en la base del 5.º metatarsiano o el escafoides, o no da 4 pasos.",
        },
        supuestos: ["Solo se dibuja el paso con carga; la palpación de los puntos óseos va en el texto."],
      },
    ],
    related: ["tob-bernese"],
  },
  {
    id: "tob-bernese",
    region: "tobillo_pie",
    group: "Fracturas",
    name: "Reglas de Berna (Bernese ankle rules)",
    aka: ["Bernese ankle rules", "Reglas de Berna"],
    kind: "rule",
    purpose: "Decide la necesidad de radiografía tras un traumatismo en supinación de baja energía mediante tres maniobras de estrés indirecto.",
    position: "Paciente en supino con la pierna relajada. El examinador realiza las maniobras sin palpar directamente la zona dolorosa.",
    steps: [
      "Estrés indirecto del peroné: comprime peroné contra tibia unos 10 cm por encima de la punta del maléolo lateral.",
      "Estrés directo del maléolo medial: presiona sobre él con la punta de los dedos.",
      "Compresión del retropié y mediopié: fija el tobillo y aprieta el pie en sentido longitudinal.",
    ],
    positive: "Dolor en cualquiera de las tres maniobras: pedir radiografía.",
    interpretation:
      "En su estudio original fue muy sensible y específica, pero un estudio comparativo posterior obtuvo cifras mucho peores que la regla de Ottawa. Úsala como complemento, no en lugar de Ottawa.",
    accuracy: [
      { sens: 100, spec: 91, context: "Estudio de derivación, 354 pacientes con traumatismo en supinación de baja energía", source: "Eggli et al., 2005", citation: "Eggli S, et al. The Bernese ankle rules: a fast, reliable test after low-energy, supination-type malleolar and midfoot trauma. J Trauma. 2005." },
      { sens: 55.7, spec: 79, context: "Estudio prospectivo, 962 adultos, todos con radiografía", source: "Beceren et al., 2013", citation: beceren },
    ],
    utility: "moderada",
    cautions: "Solo validada en traumatismos de baja energía en supinación. Resultados no replicados de forma consistente.",
    figures: [
      {
        view: "front",
        posture: "supine",
        hands: ["r_shank@0.7"],
        grips: [{ kind: "press", face: "lateral" }],
        arrows: [{ at: "r_shank@0.7", dir: "medial", label: "compresión" }],
        pain: ["r_shank@0.97"],
        caption: "Estrés indirecto del peroné",
        side: "r",
        script: {
          steps: [{ by: "examiner", dur: 1.0, hold: 1.4, path: false, pain: true, marks: [{ kind: "push", at: "r_shank@0.7", dir: "medial", label: "Comprime el peroné contra la tibia" }], text: "Estrés indirecto del peroné: comprime peroné contra tibia unos 10 cm por encima de la punta del maléolo." }],
        },
        text: {
          setup: "Paciente en supino con la pierna derecha relajada. Sin palpar directamente la zona dolorosa.",
          look: "Radiografía si duele cualquiera de las tres maniobras: estrés indirecto del peroné, presión del maléolo medial o compresión longitudinal del retropié y el mediopié.",
        },
        supuestos: ["Solo se dibuja la primera de las tres maniobras."],
      },
    ],
    related: ["tob-ottawa"],
  },
  {
    id: "tob-hop",
    region: "tobillo_pie",
    group: "Fracturas",
    name: "Test de salto monopodal (fractura de estrés)",
    aka: ["Hop test", "Single-leg hop test"],
    kind: "test",
    purpose: "Provoca el dolor de una posible fractura de estrés de tibia, peroné o metatarsianos mediante saltos sobre una pierna.",
    position: "Paciente de pie sobre la pierna afectada. El examinador se coloca cerca por si pierde el equilibrio.",
    steps: [
      "Pide que se apoye solo sobre la pierna afectada.",
      "Pide de 10 a 20 saltos pequeños sobre esa pierna.",
      "Pregunta por dolor y dónde aparece.",
    ],
    positive: "Dolor localizado y punzante en la zona sospechosa (tibia, peroné o metatarsiano).",
    interpretation:
      "Útil sobre todo para descartar: en el único estudio disponible ningún caso con fractura de estrés tuvo el test negativo, pero muchos sin fractura lo tuvieron positivo. Si es positivo y hay dolor óseo localizado, deriva para imagen (la radiografía puede ser normal al principio; RM).",
    accuracy: [
      {
        sens: 100,
        spec: 45,
        context: "Fractura de estrés de tibia; único estudio publicado (cifras tomadas de un resumen secundario)",
        source: "Milgrom et al., 2021",
        citation: "Milgrom C, et al. Estudio de tests clínicos para la fractura de estrés de tibia (2021), PMID 33298373. Cifras citadas en el resumen de Physiotutors (hop test); título y revista no comprobados.",
      },
    ],
    utility: "alta",
    cautions: "Datos de un solo estudio, no confirmados en el original. No lo hagas si el dolor en carga ya es claro o si se sospecha fractura aguda.",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { l_hip: 40, l_knee: 80 },
        arrows: [{ at: "pelvis", dir: "cranial", kind: "move", label: "saltos" }],
        pain: ["r_shank@0.6"],
        side: "r",
        script: {
          steps: [
            { to: { l_hip: { flex: 40 }, l_knee: { flex: 60 }, l_ankle: { flex: 20 } }, by: "patient", dur: 1.2, path: false, text: "Se apoya solo sobre la pierna derecha." },
            { to: { r_hip: { flex: 20 }, r_knee: { flex: 30 }, r_ankle: { flex: 10 } }, by: "patient", dur: 0.6, hold: 0.1, path: false, text: "Pequeños saltos sobre esa pierna (de 10 a 20)…" },
            { to: { r_hip: { flex: 0 }, r_knee: { flex: 2 }, r_ankle: { flex: -30 } }, by: "patient", dur: 0.4, hold: 0.6, path: false, pain: true, text: "…y pregunta por dolor y dónde aparece." },
          ],
        },
        text: {
          setup: "Paciente de pie. El examinador, cerca por si pierde el equilibrio.",
          look: "Positivo si aparece un dolor localizado y punzante en la zona sospechosa (tibia, peroné o metatarsiano).",
        },
        supuestos: ["El maniquí no se despega del suelo: se dibuja el impulso (flexión y extensión de la pierna hasta las puntillas)."],
      },
    ],
  },

  // ───────────── Tendón de Aquiles: rotura ─────────────
  {
    id: "tob-thompson",
    region: "tobillo_pie",
    group: "Tendón de Aquiles: rotura",
    name: "Test de Thompson (Simmonds)",
    aka: ["Thompson test", "Simmonds test", "Calf squeeze test"],
    kind: "test",
    purpose: "Detecta la rotura completa del tendón de Aquiles comprobando si la compresión del tríceps sural produce flexión plantar.",
    position: "Paciente en prono con los pies fuera de la camilla (o de rodillas en una silla). El examinador se sitúa a su lado.",
    steps: [
      "Deja el pie colgando y relajado.",
      "Aprieta con la mano la parte más ancha de la pantorrilla.",
      "Observa si el pie se mueve en flexión plantar.",
      "Compara con el lado sano.",
    ],
    positive: "Ausencia (o clara disminución) de la flexión plantar al apretar la pantorrilla.",
    interpretation:
      "Muy útil para confirmar y para descartar la rotura completa. Combínalo con el test de Matles y la palpación del hueco; si hay duda, ecografía.",
    accuracy: [{ sens: 96, spec: 93, context: "Estudio prospectivo, 174 pacientes", source: "Maffulli, 1998", citation: maffulli }],
    utility: "alta",
    cautions: "Las roturas parciales o con plantares y flexores largos intactos pueden dar algo de movimiento (falso negativo).",
    figures: [
      {
        view: "side",
        posture: "prone",
        to: { r_ankle: -35 },
        hands: ["r_shank@0.35"],
        grips: [{ kind: "grasp", face: "posterior" }],
        arrows: [{ at: "r_shank@0.35", dir: "medial", label: "apretar" }],
        pain: ["r_shank@0.85"],
        caption: "Discontinua: respuesta normal",
        side: "r",
        script: {
          start: { r_ankle: { flex: -30 } },
          steps: [{ to: { r_ankle: { flex: -50 } }, dur: 0.8, hold: 1.2, marks: [{ kind: "push", at: "r_shank@0.35", dir: "medial", label: "Aprieta la pantorrilla" }], text: "Aprieta la parte más ancha de la pantorrilla: lo normal es que el pie haga flexión plantar." }],
        },
        text: {
          setup: "Paciente en prono con los pies fuera de la camilla, relajados. El examinador, a su lado.",
          look: "Se enseña la respuesta normal. Positivo si el pie no se mueve (o mucho menos que el otro) al apretar.",
        },
        supuestos: ["Se enseña la respuesta normal: 20° de flexión plantar al apretar."],
      },
    ],
    related: ["tob-matles", "tob-hueco-aquiles"],
  },
  {
    id: "tob-matles",
    region: "tobillo_pie",
    group: "Tendón de Aquiles: rotura",
    name: "Test de Matles",
    aka: ["Matles test", "Knee flexion test"],
    kind: "test",
    purpose: "Detecta la rotura del Aquiles observando la posición del pie en reposo con la rodilla flexionada.",
    position: "Paciente en prono con ambos pies fuera de la camilla. El examinador observa desde el lateral.",
    steps: [
      "Pide al paciente que flexione activamente ambas rodillas a 90°.",
      "Observa la posición de ambos tobillos en reposo.",
      "Compara el lado afectado con el sano.",
    ],
    positive: "El pie afectado cae en posición neutra o en flexión dorsal, mientras el sano queda en ligera flexión plantar.",
    interpretation:
      "Ayuda a confirmar y a descartar la rotura. Útil también en roturas antiguas, en las que el hueco ya no se palpa. Combínalo con Thompson.",
    accuracy: [{ sens: 88, spec: 85, context: "Estudio prospectivo, 174 pacientes", source: "Maffulli, 1998", citation: maffulli }],
    utility: "alta",
    figures: [
      {
        view: "side",
        posture: "prone",
        joints: { r_knee: 90, l_knee: 90, r_ankle: 5, l_ankle: -25 },
        arrows: [{ at: "r_foot@0.8", dir: "anterior", kind: "move", label: "cae" }],
        pain: ["r_shank@0.85"],
        caption: "Pie afectado en neutro; sano en flexión plantar",
        side: "r",
        script: {
          start: { r_knee: { flex: 0 }, l_knee: { flex: 0 }, r_ankle: { flex: -40 }, l_ankle: { flex: -40 } },
          steps: [{ to: { r_knee: { flex: 90 }, l_knee: { flex: 90 }, r_ankle: { flex: 5 }, l_ankle: { flex: -25 } }, by: "patient", dur: 2.2, hold: 1.6, text: "El paciente flexiona las dos rodillas a 90°: compara la posición de los dos tobillos." }],
        },
        text: {
          setup: "Paciente en prono con los dos pies fuera de la camilla. El examinador observa desde el lateral.",
          look: "Positivo si el pie afectado cae en neutro o en flexión dorsal mientras el sano queda en ligera flexión plantar.",
        },
        supuestos: ["Se enseña un positivo en el lado derecho: el derecho queda a 5° de flexión dorsal y el izquierdo a 25° de flexión plantar."],
      },
    ],
    related: ["tob-thompson", "tob-hueco-aquiles"],
  },
  {
    id: "tob-hueco-aquiles",
    region: "tobillo_pie",
    group: "Tendón de Aquiles: rotura",
    name: "Palpación del hueco en el tendón de Aquiles",
    aka: ["Palpable gap", "Signo del hachazo"],
    kind: "test",
    purpose: "Busca una depresión palpable en el trayecto del Aquiles que indique rotura.",
    position: "Paciente en prono con los pies fuera de la camilla. El examinador palpa el tendón con el pulgar y el índice.",
    steps: [
      "Recorre el tendón desde la inserción en el calcáneo hacia arriba.",
      "Insiste en la zona de 2-6 cm por encima de la inserción.",
      "Compara con el lado sano.",
    ],
    positive: "Hueco o depresión palpable en el tendón, a menudo doloroso.",
    interpretation:
      "Si se nota el hueco, la rotura es muy probable; si no, no la descarta (sensibilidad moderada, sobre todo pasados unos días, cuando el hematoma rellena el defecto).",
    accuracy: [{ sens: 73, spec: 89, context: "Estudio prospectivo, 174 pacientes", source: "Maffulli, 1998", citation: maffulli }],
    utility: "alta",
    figures: [
      {
        view: "side",
        posture: "prone",
        hands: ["r_shank@0.88"],
        grips: [{ kind: "tips", face: "posterior" }],
        pain: ["r_shank@0.88"],
        side: "r",
        script: {
          start: { r_ankle: { flex: -30 } },
          steps: [{ dur: 1.4, hold: 1.2, path: false, marks: [{ kind: "slide", at: "r_shank@0.9", face: "posterior", dir: "cranial", label: "Recorre el tendón hacia arriba" }], text: "Recorre el tendón con pulgar e índice desde la inserción hacia arriba, insistiendo 2-6 cm por encima." }],
        },
        text: {
          setup: "Paciente en prono con los pies fuera de la camilla.",
          look: "Positivo si hay un hueco o una depresión palpable en el tendón, a menudo dolorosa.",
        },
        supuestos: ["La mano no se desliza en la animación: la flecha marca el recorrido."],
      },
    ],
    related: ["tob-thompson", "tob-matles"],
  },

  // ───────────── Tendón de Aquiles: tendinopatía ─────────────
  {
    id: "tob-signo-arco",
    region: "tobillo_pie",
    group: "Tendón de Aquiles: tendinopatía",
    name: "Signo del arco",
    aka: ["Arc sign", "Painful arc sign"],
    kind: "test",
    purpose: "Distingue la tendinopatía del cuerpo del Aquiles de la paratendinopatía según si el engrosamiento se mueve con el tendón.",
    position: "Paciente en prono con los pies fuera de la camilla. El examinador sujeta el engrosamiento del tendón entre pulgar e índice.",
    steps: [
      "Localiza el engrosamiento o nódulo del tendón.",
      "Pide al paciente que mueva el tobillo activamente de flexión dorsal a flexión plantar.",
      "Observa si el engrosamiento se desplaza con el movimiento.",
    ],
    positive: "El engrosamiento se desplaza con el tendón (tendinopatía del cuerpo). Si no se mueve, sugiere afectación del paratendón.",
    interpretation:
      "Moderadamente útil para confirmar tendinopatía; poco sensible, no sirve para descartarla. Combínalo con el test de Royal London Hospital.",
    accuracy: [{ sens: 42, spec: 88, context: "Metaanálisis (estudios de tendinopatía aquílea)", source: "Reiman et al., 2014", citation: reiman }],
    utility: "moderada",
    figures: [
      {
        view: "side",
        posture: "prone",
        joints: { r_ankle: 10 },
        to: { r_ankle: -30 },
        hands: ["r_shank@0.8"],
        grips: [{ kind: "tips", face: "posterior" }],
        pain: ["r_shank@0.8"],
        side: "r",
        script: {
          start: { r_ankle: { flex: 0 } },
          steps: [{ to: { r_ankle: { flex: -35 } }, by: "patient", dur: 2.0, hold: 1.0, text: "Sujetando el engrosamiento, pide que mueva el tobillo de flexión dorsal a flexión plantar y mira si el engrosamiento se desplaza." }],
        },
        text: {
          setup: "Paciente en prono con los pies fuera de la camilla. El examinador sujeta el engrosamiento del tendón entre pulgar e índice.",
          look: "Si el engrosamiento se desplaza con el tendón: tendinopatía del cuerpo. Si no se mueve: afectación del paratendón.",
        },
        supuestos: ["El tendón no se dibuja: el engrosamiento está bajo los dedos del examinador."],
      },
    ],
    related: ["tob-royal-london"],
  },
  {
    id: "tob-royal-london",
    region: "tobillo_pie",
    group: "Tendón de Aquiles: tendinopatía",
    name: "Test del Royal London Hospital",
    aka: ["Royal London Hospital test", "RLHT"],
    kind: "test",
    purpose: "Valora la tendinopatía del cuerpo del Aquiles comprobando si el dolor a la palpación disminuye al tensar el tendón.",
    position: "Paciente en prono con los pies fuera de la camilla. El examinador palpa el tendón.",
    steps: [
      "Palpa el tendón con el tobillo en neutro y localiza el punto más doloroso.",
      "Pide flexión plantar activa y vuelve a palpar el mismo punto.",
      "Pide flexión dorsal activa máxima y vuelve a palpar.",
    ],
    positive: "El dolor a la palpación disminuye claramente o desaparece en flexión dorsal máxima.",
    interpretation:
      "Moderadamente útil para confirmar tendinopatía aquílea. Combínalo con el signo del arco y con la historia (dolor matutino y al inicio de la carga).",
    accuracy: [{ lrPos: 3.84, context: "Metaanálisis (estudios de tendinopatía aquílea)", source: "Reiman et al., 2014", citation: reiman }],
    utility: "moderada",
    figures: [
      {
        view: "side",
        posture: "prone",
        joints: { r_ankle: 0 },
        to: { r_ankle: 25 },
        hands: ["r_shank@0.8"],
        grips: [{ kind: "tips", face: "posterior" }],
        pain: ["r_shank@0.8"],
        side: "r",
        script: {
          start: { r_ankle: { flex: 0 } },
          steps: [
            { dur: 0.8, hold: 0.6, path: false, marks: [{ kind: "push", at: "r_shank@0.8", dir: "anterior", label: "Palpa el punto más doloroso" }], text: "Con el tobillo en neutro, palpa el tendón y localiza el punto más doloroso." },
            { to: { r_ankle: { flex: -30 } }, by: "patient", dur: 1.4, hold: 0.6, marks: [{ kind: "push", at: "r_shank@0.8", dir: "anterior", label: "Palpa otra vez" }], text: "Pide flexión plantar activa y vuelve a palpar el mismo punto." },
            { to: { r_ankle: { flex: 25 } }, by: "patient", dur: 2.0, hold: 0.8, marks: [{ kind: "push", at: "r_shank@0.8", dir: "anterior", label: "Palpa otra vez" }], text: "Pide flexión dorsal activa máxima y vuelve a palpar." },
          ],
        },
        text: {
          setup: "Paciente en prono con los pies fuera de la camilla. El examinador palpa el tendón de Aquiles.",
          look: "Positivo si el dolor a la palpación disminuye claramente o desaparece en flexión dorsal máxima.",
        },
        supuestos: ["Flexión plantar de 30° y dorsal de 25° (la fuente no da grados)."],
      },
    ],
    related: ["tob-signo-arco"],
  },

  // ───────────── Fascitis plantar ─────────────
  {
    id: "tob-windlass",
    region: "tobillo_pie",
    group: "Fascitis plantar",
    name: "Test de Windlass",
    aka: ["Windlass test", "Test del cabrestante", "Jack's test"],
    kind: "test",
    purpose: "Tensa la fascia plantar con la extensión del primer dedo para reproducir el dolor de la fascitis plantar.",
    position: "Paciente de pie en carga (versión más sensible) o sentado. El examinador se coloca delante del pie.",
    steps: [
      "Con el paciente de pie y el peso repartido, coloca el pie sobre el borde de un escalón con los dedos libres.",
      "Extiende de forma pasiva el primer dedo hasta el final del recorrido o hasta que aparezca dolor.",
      "Mantén unos segundos y pregunta dónde duele.",
    ],
    positive: "Reproducción del dolor en la inserción de la fascia en el talón o a lo largo del arco plantar.",
    interpretation:
      "Muy específico pero poco sensible: un positivo apoya la fascitis plantar; un negativo no la descarta. Haz siempre la versión en carga y combínalo con la palpación del tubérculo medial del calcáneo y el dolor de los primeros pasos.",
    accuracy: [
      {
        sens: 31.8,
        spec: 100,
        context: "Versión en carga; 22 pacientes con fascitis plantar frente a 23 con otro dolor de pie y 30 controles",
        source: "De Garceau et al., 2003",
        citation: "De Garceau D, et al. Estudio del test de Windlass en carga y sin carga en la fascitis plantar. Foot Ankle Int. 2003.",
      },
    ],
    utility: "alta",
    figures: [
      {
        view: "side",
        posture: "standing",
        hands: ["r_foot@0.95"],
        grips: [{ kind: "grasp", face: "anterior" }],
        arrows: [{ at: "r_foot@0.95", dir: "cranial", kind: "move", label: "ext. dedo" }],
        pain: ["r_foot@0.1"],
        side: "r",
        script: {
          steps: [{ by: "examiner", dur: 1.2, hold: 1.4, path: false, pain: true, marks: [{ kind: "pull", at: "r_foot@0.95", dir: "cranial", label: "Extiende el primer dedo" }], text: "Con el peso repartido, extiende de forma pasiva el primer dedo hasta el final o hasta que duela; mantén unos segundos." }],
        },
        text: {
          setup: "Paciente de pie con el peso repartido y el pie derecho sobre el borde de un escalón, con los dedos libres. El examinador, delante.",
          look: "Positivo si reproduce el dolor en la inserción de la fascia en el talón o a lo largo del arco plantar.",
        },
        supuestos: ["Los dedos del maniquí no se mueven: la flecha marca la extensión del primer dedo.", "No se dibuja el escalón."],
      },
    ],
  },

  // ───────────── Neuroma de Morton ─────────────
  {
    id: "tob-squeeze-intermetatarsal",
    region: "tobillo_pie",
    group: "Neuroma de Morton",
    name: "Compresión del espacio intermetatarsiano (pulgar-índice)",
    aka: ["Thumb index finger squeeze test", "Web space tenderness test"],
    kind: "test",
    purpose: "Busca dolor del neuroma de Morton comprimiendo el espacio interdigital entre pulgar e índice.",
    position: "Paciente en supino o sentado con el pie relajado. El examinador coloca el pulgar en la planta y el índice en el dorso del espacio afectado.",
    steps: [
      "Localiza el espacio intermetatarsiano sospechoso (con frecuencia el 3.º).",
      "Coloca el índice en el dorso y el pulgar en la planta, justo proximal a las cabezas metatarsianas.",
      "Aprieta entre ambos dedos.",
      "Compara con los espacios vecinos.",
    ],
    positive: "Dolor intenso, quemazón u hormigueo que reproduce los síntomas del paciente.",
    interpretation:
      "En el estudio de Mahadevan fue el test clínico más preciso, útil para confirmar y para descartar el neuroma. Complétalo con el test de Mulder y, si hay dudas, ecografía.",
    accuracy: [
      {
        sens: 96,
        spec: 100,
        context: "Frente a ecografía, 54 pies",
        source: "Mahadevan et al., 2015",
        citation: "Mahadevan D, Venkatesan M, Bhatt R, Bhatia M. Diagnostic accuracy of clinical tests for Morton's neuroma compared with ultrasonography. J Foot Ankle Surg. 2015.",
      },
    ],
    utility: "alta",
    figures: [
      {
        view: "side",
        posture: "sitting",
        hands: ["r_foot@0.8"],
        grips: [{ kind: "grasp", face: "caudal" }],
        arrows: [{ at: "r_foot@0.8", dir: "caudal", label: "presión" }],
        pain: ["r_foot@0.8"],
        side: "r",
        script: {
          steps: [{ by: "examiner", dur: 1.0, hold: 1.4, path: false, pain: true, marks: [{ kind: "push", at: "r_foot@0.8", dir: "caudal", label: "Aprieta entre pulgar e índice" }], text: "Con el índice en el dorso y el pulgar en la planta del espacio sospechoso, justo antes de las cabezas metatarsianas, aprieta." }],
        },
        text: {
          setup: "Paciente sentado con el pie derecho relajado.",
          look: "Positivo si aparece un dolor intenso, quemazón u hormigueo que reproduce los síntomas; compara con los espacios vecinos.",
        },
      },
    ],
    related: ["tob-mulder"],
  },
  {
    id: "tob-mulder",
    region: "tobillo_pie",
    group: "Neuroma de Morton",
    name: "Test de Mulder",
    aka: ["Mulder's click", "Signo de Mulder"],
    kind: "test",
    purpose: "Busca un chasquido doloroso al comprimir lateralmente el antepié, causado por el desplazamiento del neuroma.",
    position: "Paciente en supino o sentado. El examinador abraza el antepié con una mano y coloca el pulgar de la otra en la planta del espacio afectado.",
    steps: [
      "Comprime los metatarsianos entre sí de lateral a medial con una mano.",
      "A la vez, presiona con el pulgar de la otra mano en la planta, en el espacio sospechoso.",
      "Nota si hay un chasquido y si reproduce el dolor.",
    ],
    positive: "Chasquido palpable (a veces audible) con dolor o parestesias que reproducen los síntomas.",
    interpretation:
      "Un chasquido doloroso apoya el diagnóstico, pero en el estudio de Mahadevan su exactitud global fue claramente menor (61 %) que la de la compresión pulgar-índice. Úsalo junto a esta.",
    accuracy: [],
    utility: "desconocida",
    figures: [
      {
        view: "side",
        posture: "sitting",
        hands: ["r_foot@0.75", "r_foot@0.65"],
        grips: [{ kind: "grasp", face: "lateral" }, { kind: "tips", face: "caudal" }],
        arrows: [{ at: "r_foot@0.75", dir: "medial", label: "compresión" }],
        pain: ["r_foot@0.8"],
        side: "r",
        script: {
          steps: [
            {
              by: "examiner",
              dur: 1.0,
              hold: 1.4,
              path: false,
              pain: true,
              marks: [
                { kind: "push", at: "r_foot@0.75", dir: "medial", label: "Comprime los metatarsianos" },
                { kind: "push", at: "r_foot@0.65", dir: "cranial", label: "Pulgar en la planta" },
              ],
              text: "Comprime los metatarsianos de fuera adentro con una mano y, a la vez, presiona con el pulgar de la otra en la planta del espacio sospechoso.",
            },
          ],
        },
        text: {
          setup: "Paciente sentado. Una mano abraza el antepié derecho y el pulgar de la otra va en la planta.",
          look: "Positivo si hay un chasquido palpable (a veces audible) con dolor o parestesias que reproducen los síntomas.",
        },
      },
    ],
    related: ["tob-squeeze-intermetatarsal"],
  },

  // ───────────── Túnel del tarso ─────────────
  {
    id: "tob-dorsiflexion-eversion",
    region: "tobillo_pie",
    group: "Túnel del tarso",
    name: "Test de dorsiflexión-eversión (con Tinel)",
    aka: ["Dorsiflexion-eversion test", "Test de Kinoshita", "Tinel en el túnel del tarso"],
    kind: "test",
    purpose: "Comprime el nervio tibial bajo el retináculo flexor para reproducir los síntomas del síndrome del túnel del tarso.",
    position: "Paciente en supino o sentado. El examinador sujeta el pie y fija la pierna.",
    steps: [
      "Percute el nervio tibial por detrás del maléolo medial (Tinel) y anota si hay hormigueo irradiado a la planta.",
      "Lleva el tobillo a eversión y flexión dorsal máximas.",
      "Extiende a la vez todos los dedos (articulaciones metatarsofalángicas).",
      "Mantén 5-10 segundos y vuelve a percutir o palpar el túnel.",
    ],
    positive: "Aparición o aumento del dolor, entumecimiento u hormigueo en la planta, o Tinel más intenso en la posición mantenida.",
    interpretation:
      "En el estudio original la maniobra aumentó el dolor a la palpación y el Tinel en casi todos los pies operados y en ningún voluntario sano; reprodujo el entumecimiento con mucha menos frecuencia. Al comparar con sanos y no con otras causas de dolor, sobrestima la precisión: confirma con estudio neurofisiológico o imagen.",
    accuracy: [
      {
        sens: 98,
        spec: 100,
        context: "Aumento del dolor a la palpación; 44 pies operados frente a 100 pies de voluntarios sanos (cifras de un resumen secundario)",
        source: "Kinoshita et al., 2001",
        citation: "Kinoshita M, et al. The dorsiflexion-eversion test for diagnosis of tarsal tunnel syndrome. J Bone Joint Surg Am. 2001;83(12):1835-1839.",
      },
      {
        sens: 25,
        spec: 100,
        context: "Reproducción del entumecimiento; mismo estudio de casos y controles sanos",
        source: "Kinoshita et al., 2001",
        citation: "Kinoshita M, et al. The dorsiflexion-eversion test for diagnosis of tarsal tunnel syndrome. J Bone Joint Surg Am. 2001;83(12):1835-1839.",
      },
    ],
    utility: "alta",
    cautions: "Estudio con controles sanos (sesgo de espectro): la precisión real en consulta será menor.",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { r_ankle: 15 },
        hands: ["r_shank@0.8", "r_foot@0.8"],
        grips: [{ kind: "grasp", face: "anterior" }, { kind: "press", face: "caudal" }],
        arrows: [
          { at: "r_foot@0.8", dir: "cranial", label: "flex. dorsal" },
          { at: "r_foot@0.4", dir: "lateral", label: "eversión" },
        ],
        pain: ["r_ankle"],
        side: "r",
        script: {
          start: { r_ankle: { flex: 0, inv: 0 } },
          steps: [{ to: { r_ankle: { flex: 15, inv: -15 } }, by: "examiner", dur: 1.6, hold: 1.6, pain: true, text: "Lleva el tobillo a eversión y flexión dorsal máximas y mantén 5-10 segundos; después vuelve a percutir el túnel." }],
        },
        text: {
          setup: "Paciente sentado. Una mano fija la pierna derecha y la otra sujeta el pie. Antes, percute el nervio tibial por detrás del maléolo medial (Tinel).",
          look: "Positivo si aparece o aumenta el dolor, el entumecimiento o el hormigueo en la planta, o el Tinel es más intenso en esa posición.",
        },
        supuestos: ["Flexión dorsal de 15° y eversión de 15° (la fuente dice «máximas»).", "No se dibujan la extensión de los dedos ni la percusión."],
      },
    ],
  },

  // ───────────── Disfunción del tibial posterior ─────────────
  {
    id: "tob-elevacion-talon",
    region: "tobillo_pie",
    group: "Disfunción del tibial posterior",
    name: "Elevación de talón monopodal",
    aka: ["Single heel rise test", "Single-limb heel raise"],
    kind: "test",
    purpose: "Valora la función del tibial posterior: capacidad de elevar el talón sobre un pie y de invertir el retropié al hacerlo.",
    position: "Paciente de pie sobre la pierna afectada, apoyado con las manos en una pared. El examinador observa por detrás.",
    steps: [
      "Pide que se ponga de puntillas sobre el pie afectado.",
      "Observa si el talón se va a varo (inversión) al subir.",
      "Pide varias repeticiones y compara con el lado sano.",
      "Desde detrás, cuenta los dedos que se ven por fuera del talón (signo de demasiados dedos).",
    ],
    positive: "No consigue elevar el talón, lo hace sin invertir el retropié o con menos repeticiones que el lado sano. Más dedos visibles que en el lado sano indican abducción del antepié.",
    interpretation:
      "Es el test más usado para la disfunción del tibial posterior, pero no se han comprobado cifras de precisión y puede ser normal en fases iniciales. Combínalo con dolor y engrosamiento retromaleolar medial y el signo de demasiados dedos.",
    accuracy: [],
    utility: "desconocida",
    figures: [
      {
        view: "side",
        posture: "standing",
        joints: { r_ankle: -35, l_hip: 20, l_knee: 70 },
        arrows: [{ at: "pelvis", dir: "cranial", kind: "move", label: "puntillas" }],
        pain: ["r_ankle"],
        side: "r",
        script: {
          start: { r_ankle: { flex: 0, inv: 0 } },
          steps: [
            { to: { l_hip: { flex: 30 }, l_knee: { flex: 45 }, l_ankle: { flex: 15 } }, by: "patient", dur: 1.2, path: false, text: "Se apoya sobre el pie derecho." },
            { to: { r_ankle: { flex: -35, inv: 10 } }, by: "patient", dur: 1.6, hold: 1.2, pain: true, text: "Se pone de puntillas: mira si el talón se va a varo al subir." },
          ],
        },
        text: {
          setup: "Paciente de pie, apoyado con las manos en la pared. El examinador observa por detrás.",
          look: "Positivo si no sube el talón, sube sin invertir el retropié o hace menos repeticiones que con el otro. Más dedos visibles por fuera del talón que en el lado sano: abducción del antepié.",
        },
        supuestos: ["Se enseña la subida normal: 35° de flexión plantar con 10° de inversión.", "No se dibujan las manos en la pared."],
      },
    ],
  },

  // ───────────── Acortamiento del gemelo ─────────────
  {
    id: "tob-silfverskiold",
    region: "tobillo_pie",
    group: "Acortamiento del gemelo",
    name: "Test de Silfverskiöld",
    aka: ["Silfverskiöld test"],
    kind: "test",
    purpose: "Distingue si la falta de flexión dorsal del tobillo se debe al gemelo o al complejo sóleo-Aquiles.",
    position: "Paciente en supino. El examinador sujeta el retropié con el subastragalino en neutro.",
    steps: [
      "Con la rodilla extendida, lleva el tobillo a flexión dorsal pasiva máxima y mide el ángulo.",
      "Flexiona la rodilla unos 90° y repite la flexión dorsal.",
      "Compara ambas mediciones.",
    ],
    positive: "La flexión dorsal mejora claramente al flexionar la rodilla (acortamiento del gemelo). Si no mejora, la limitación es del sóleo-Aquiles o articular.",
    interpretation:
      "Orienta el tratamiento (estiramiento o cirugía del gemelo), pero la fiabilidad de la versión clínica manual se ha descrito como baja; mide con goniómetro o inclinómetro. No es un test diagnóstico con cifras de precisión.",
    accuracy: [],
    utility: "desconocida",
    figures: [
      {
        view: "side",
        posture: "supine",
        joints: { r_ankle: 0 },
        hands: ["r_ankle", "r_foot@0.65"],
        grips: [{ kind: "grasp", face: "posterior" }, { kind: "press", face: "caudal" }],
        arrows: [{ at: "r_ankle", rotate: "ccw", label: "flex. dorsal" }],
        caption: "Rodilla extendida",
        side: "r",
        script: {
          start: { r_ankle: { flex: 0 } },
          steps: [{ to: { r_ankle: { flex: 10 } }, by: "examiner", dur: 1.4, hold: 1.4, text: "Con la rodilla extendida, lleva el tobillo a flexión dorsal pasiva máxima y mide el ángulo." }],
        },
        text: {
          setup: "Paciente en supino con la rodilla derecha extendida. El examinador sujeta el retropié con el subastragalino en neutro.",
          look: "Compárala con la flexión dorsal con la rodilla flexionada (siguiente figura): si mejora claramente, el acortamiento es del gemelo.",
        },
        supuestos: ["Se enseña un acortamiento del gemelo: 10° con la rodilla extendida y 25° con la rodilla flexionada."],
      },
      {
        view: "side",
        posture: "supine",
        joints: { r_hip: 60, r_knee: 90, r_ankle: 15 },
        hands: ["r_ankle", "r_foot@0.65"],
        grips: [{ kind: "grasp", face: "posterior" }, { kind: "press", face: "caudal" }],
        arrows: [{ at: "r_ankle", rotate: "ccw", label: "flex. dorsal" }],
        caption: "Rodilla flexionada",
        side: "r",
        script: {
          start: { r_hip: { flex: 60 }, r_knee: { flex: 90 }, r_ankle: { flex: 0 } },
          steps: [{ to: { r_ankle: { flex: 25 } }, by: "examiner", dur: 1.6, hold: 1.4, text: "Con la rodilla a unos 90°, repite la flexión dorsal pasiva máxima." }],
        },
        text: {
          setup: "Paciente en supino con la cadera y la rodilla derechas flexionadas.",
          look: "Positivo si la flexión dorsal mejora claramente al flexionar la rodilla (acortamiento del gemelo). Si no mejora, la limitación es del sóleo-Aquiles o articular.",
        },
        supuestos: ["Se enseña un acortamiento del gemelo: 10° con la rodilla extendida y 25° con la rodilla flexionada."],
      },
    ],
  },

  // ───────────── Pinzamiento anterior ─────────────
  {
    id: "tob-pinzamiento-anterolateral",
    region: "tobillo_pie",
    group: "Pinzamiento anterior del tobillo",
    name: "Test de pinzamiento anterolateral (Molloy)",
    aka: ["Lateral synovial impingement test", "Forced dorsiflexion sign", "Test de Molloy"],
    kind: "test",
    purpose: "Reproduce el dolor del pinzamiento sinovial anterolateral comprimiendo la gotera anterolateral durante la flexión dorsal forzada.",
    position: "Paciente sentado con la pierna colgando. El examinador sujeta el pie con una mano y coloca el pulgar de la otra en la gotera anterolateral.",
    steps: [
      "Lleva el pie a flexión plantar y algo de eversión.",
      "Presiona con el pulgar en la gotera anterolateral del tobillo.",
      "Sin soltar, lleva el pie a flexión dorsal máxima.",
    ],
    positive: "Dolor anterolateral con la presión, que aumenta al llevar el tobillo a flexión dorsal.",
    interpretation:
      "En el estudio original fue útil para confirmar y para descartar el pinzamiento anterolateral, aunque con riesgo de sesgo y muestra pequeña. Combínalo con la historia (esguince previo, dolor anterolateral persistente).",
    accuracy: [
      {
        sens: 94.8,
        spec: 88,
        context: "Estudio clínico prospectivo, 73 pacientes",
        source: "Molloy et al., 2003",
        citation: "Molloy S, et al. Synovial impingement in the ankle. A new physical sign. J Bone Joint Surg Br. 2003;85(3):330-333.",
        doi: "10.1302/0301-620X.85B3.12873",
      },
    ],
    utility: "alta",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { r_ankle: -20 },
        to: { r_ankle: 20 },
        hands: ["r_ankle", "r_foot@0.75"],
        grips: [{ kind: "tips", face: "anterior" }, { kind: "press", face: "caudal" }],
        arrows: [{ at: "r_foot@0.75", dir: "cranial", label: "flex. dorsal" }],
        pain: ["r_ankle"],
        side: "r",
        script: {
          start: { r_ankle: { flex: -20, inv: -5 } },
          steps: [
            { by: "examiner", dur: 0.8, hold: 0.4, path: false, marks: [{ kind: "push", at: "r_ankle", dir: "posterior", label: "Pulgar en la gotera anterolateral" }], text: "Con el pie en flexión plantar y algo de eversión, presiona con el pulgar en la gotera anterolateral." },
            { to: { r_ankle: { flex: 20, inv: 0 } }, by: "examiner", dur: 1.8, hold: 1.2, pain: true, marks: [{ kind: "push", at: "r_ankle", dir: "posterior", label: "Sin soltar" }], text: "Sin soltar, lleva el pie a flexión dorsal máxima." },
          ],
        },
        text: {
          setup: "Paciente sentado con la pierna derecha colgando. Una mano sujeta el pie y el pulgar de la otra va en la gotera anterolateral del tobillo.",
          look: "Positivo si la presión duele en la cara anterolateral y el dolor aumenta al llevar el tobillo a flexión dorsal.",
        },
        supuestos: ["Flexión plantar de 20° con 5° de eversión y flexión dorsal de 20° (la fuente no da grados)."],
      },
    ],
  },
];
