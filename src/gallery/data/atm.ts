import type { SpecialTest } from "../types";

const DCTMD = {
  source: "Schiffman et al., 2014",
  citation:
    "Schiffman E, Ohrbach R, Truelove E, et al. Diagnostic Criteria for Temporomandibular Disorders (DC/TMD) for clinical and research applications: recommendations of the International RDC/TMD Consortium Network and Orofacial Pain Special Interest Group. Journal of Oral & Facial Pain and Headache. 2014;28:6-27.",
};

export const atmTests: SpecialTest[] = [
  {
    id: "atm-apertura-maxima",
    region: "atm",
    group: "Movilidad y desplazamiento discal",
    name: "Apertura bucal máxima y patrón de apertura",
    aka: ["Maximum mouth opening", "Apertura interincisal máxima", "Desviación y deflexión"],
    kind: "test",
    purpose: "Medir la apertura de la boca y ver si la mandíbula se desvía al abrir.",
    position: "Paciente sentado con la cabeza en posición neutra. Examinador delante con una regla milimetrada.",
    steps: [
      "Pide al paciente que abra la boca todo lo que pueda sin dolor y mide la distancia entre incisivos.",
      "Pide la apertura máxima aunque duela y vuelve a medir.",
      "Haz la apertura asistida: empuja con suavidad con los dedos para notar el tope final.",
      "Observa la línea media: desviación en S que vuelve al centro o deflexión mantenida hacia un lado.",
    ],
    positive:
      "Apertura máxima asistida menor de 40 mm (sumando el resalte vertical de los incisivos) o deflexión hacia un lado; anota si reproduce el dolor habitual.",
    interpretation:
      "Junto al antecedente de bloqueo mandibular, una apertura limitada es el único criterio intraarticular del DC/TMD con buena validez (desplazamiento discal sin reducción con apertura limitada). La deflexión hacia un lado sugiere bloqueo de la ATM de ese lado.",
    accuracy: [
      {
        ...DCTMD,
        sens: 80,
        spec: 97,
        context: "Criterio DC/TMD de desplazamiento discal sin reducción con apertura limitada (anamnesis + apertura < 40 mm), frente a evaluación con imagen.",
      },
    ],
    utility: "alta",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { jaw: 0 },
        to: { jaw: 30 },
        arrows: [{ at: "jaw", dir: "caudal", kind: "move", label: "apertura", len: 12 }],
        pain: ["r_tmj"],
        caption: "Medición de la apertura interincisal máxima.",
        side: "both",
        script: {
          start: { jaw: { flex: 0 } },
          steps: [{ to: { jaw: { flex: 30 } }, by: "patient", dur: 1.6, hold: 1.4, pain: true, text: "Pide que abra la boca al máximo y mide la distancia entre los incisivos; mira si la mandíbula se desvía." }],
        },
        text: {
          setup: "Paciente sentado con la cabeza en posición neutra. El examinador, delante, con una regla milimetrada.",
          look: "Positivo si la apertura máxima asistida es menor de 40 mm (sumando el resalte de los incisivos) o la mandíbula se desvía hacia un lado. Anota si reproduce su dolor.",
        },
        supuestos: ["Apertura de 30° del maniquí como apertura máxima."],
      },
    ],
    related: ["atm-ruidos", "atm-palpacion"],
  },
  {
    id: "atm-palpacion",
    region: "atm",
    group: "Dolor muscular y articular (DC/TMD)",
    name: "Palpación de ATM y maseteros (DC/TMD)",
    aka: ["Palpación DC/TMD", "Myalgia and arthralgia examination", "Palpación de temporal y masetero"],
    kind: "test",
    purpose: "Saber si el dolor es muscular (mialgia), articular (artralgia) o ambos, reproduciendo el dolor habitual.",
    position: "Paciente sentado con la mandíbula relajada. Examinador delante, palpando con la yema de los dedos.",
    steps: [
      "Palpa el temporal y el masetero en varios puntos con 1 kg de presión durante 2 s (5 s si buscas dolor referido).",
      "Palpa el polo lateral del cóndilo con 0,5 kg y alrededor del cóndilo con 1 kg mientras el paciente abre y cierra.",
      "Pregunta en cada punto si duele y si es «su dolor de siempre» (dolor familiar).",
      "Registra también el dolor con la apertura máxima y los movimientos laterales.",
    ],
    positive:
      "Dolor familiar a la palpación del temporal o el masetero (mialgia) o de la ATM (artralgia), en un paciente con dolor en esa zona que cambia con la función mandibular.",
    interpretation:
      "Los criterios DC/TMD completos (anamnesis + exploración) para los trastornos dolorosos más frecuentes son muy precisos para confirmar y descartar. La palpación sola es solo una parte del criterio.",
    accuracy: [
      {
        ...DCTMD,
        sens: 86,
        spec: 98,
        reliability: "kappa ≥ 0,85 entre examinadores",
        context: "Criterios DC/TMD para TMD dolorosa (mialgia/artralgia); valores mínimos publicados (≥), frente al diagnóstico de examinadores expertos.",
      },
    ],
    utility: "alta",
    cautions: "Si hay dolor facial con fiebre, inflamación, entumecimiento o pérdida de peso, piensa en otras causas y deriva.",
    figures: [
      {
        view: "side",
        posture: "sitting",
        hands: ["r_tmj"],
        grips: [{ kind: "tips", face: "lateral" }],
        pain: ["r_tmj"],
        caption: "Palpación del masetero, el temporal y el cóndilo: ¿es su dolor de siempre?",
        side: "r",
        script: {
          steps: [{ by: "examiner", dur: 0.8, hold: 1.6, path: false, pain: true, marks: [{ kind: "push", at: "r_tmj", dir: "medial", label: "Palpa la ATM y el masetero" }], text: "Palpa con la yema de los dedos el temporal, el masetero y el cóndilo: ¿es su dolor de siempre?" }],
        },
        text: {
          setup: "Paciente sentado con la mandíbula relajada. El examinador, delante.",
          look: "Positivo si la palpación da su dolor familiar en el temporal o el masetero (mialgia) o en la ATM (artralgia).",
        },
      },
    ],
    related: ["atm-carga-mordida", "atm-isometrico"],
  },
  {
    id: "atm-carga-mordida",
    region: "atm",
    group: "Dolor muscular y articular (DC/TMD)",
    name: "Test de carga dinámica (mordida unilateral)",
    aka: ["Dynamic loading test", "Tongue blade bite test", "Mordida sobre depresor"],
    kind: "test",
    purpose: "Diferenciar dolor articular de dolor muscular cargando y descargando cada ATM.",
    position: "Paciente sentado. Examinador delante con un depresor lingual (o rollo de algodón).",
    steps: [
      "Coloca el depresor entre los molares de un lado.",
      "Pide al paciente que muerda con fuerza unos segundos.",
      "Pregunta en qué lado nota el dolor.",
      "Repite en el otro lado.",
    ],
    positive:
      "Dolor en la ATM del lado contrario al depresor (articulación cargada) sugiere origen articular; dolor en la del mismo lado o en los músculos que cierran sugiere origen muscular.",
    interpretation:
      "Sin datos de precisión comprobados. Úsalo como orientación junto a la palpación y la apertura, no como prueba diagnóstica aislada.",
    accuracy: [],
    utility: "desconocida",
    cautions: "No lo hagas si hay sospecha de fractura o dolor dental agudo.",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { jaw: 2 },
        prop: "depressor",
        arrows: [{ at: "jaw", dir: "cranial", label: "mordida", len: 12 }],
        pain: ["r_tmj"],
        caption: "Mordida fuerte sobre un depresor colocado entre los molares de un lado.",
        side: "r",
        script: {
          start: { jaw: { flex: 2 } },
          steps: [{ by: "patient", dur: 0.8, hold: 1.6, path: false, pain: true, marks: [{ kind: "resist", at: "jaw", dir: "cranial", label: "Muerde fuerte" }], text: "Con el depresor entre los molares de un lado, pide que muerda fuerte." }],
        },
        text: {
          setup: "Paciente sentado. El examinador, delante, coloca un depresor lingual (o un rollo de algodón) entre los molares de un lado.",
          look: "Dolor en la ATM del lado contrario al depresor (la articulación cargada): origen articular. Dolor del mismo lado o en los músculos que cierran: origen muscular.",
        },
      },
    ],
    related: ["atm-palpacion", "atm-isometrico"],
  },
  {
    id: "atm-ruidos",
    region: "atm",
    group: "Movilidad y desplazamiento discal",
    name: "Clics y crepitación a la palpación o auscultación",
    aka: ["TMJ noises", "Chasquidos articulares", "Crepitación de la ATM"],
    kind: "test",
    purpose: "Detectar ruidos articulares que orientan a desplazamiento discal (clic) o a cambios degenerativos (crepitación).",
    position: "Paciente sentado. Examinador delante con los dedos sobre ambos cóndilos (o un fonendoscopio).",
    steps: [
      "Pide al paciente que abra y cierre la boca despacio tres veces.",
      "Pide movimientos laterales y protrusión.",
      "Nota si hay clic (ruido breve) o crepitación (roce largo) y en qué momento aparece.",
      "Comprueba si el clic de apertura se repite al cerrar (clic recíproco) y si desaparece al abrir desde protrusión.",
    ],
    positive: "Clic reproducible en apertura y cierre (desplazamiento discal con reducción) o crepitación (enfermedad degenerativa).",
    interpretation:
      "Los criterios DC/TMD basados en ruidos solo sirven como cribado: no tienen validez suficiente para diagnosticar sin imagen. Un clic sin dolor ni bloqueo no suele necesitar tratamiento.",
    accuracy: [],
    utility: "desconocida",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { jaw: 0 },
        to: { jaw: 22 },
        hands: ["r_tmj", "l_tmj"],
        grips: [{ kind: "tips", face: "lateral" }, { kind: "tips", face: "lateral" }],
        arrows: [{ at: "jaw", dir: "caudal", kind: "move", label: "abre/cierra", len: 12 }],
        caption: "Palpación de los cóndilos durante la apertura y el cierre.",
        side: "both",
        script: {
          start: { jaw: { flex: 0 } },
          steps: [
            { to: { jaw: { flex: 22 } }, by: "patient", dur: 1.4, hold: 0.3, text: "Con los dedos sobre los dos cóndilos, pide que abra la boca…" },
            { to: { jaw: { flex: 0 } }, by: "patient", dur: 1.4, hold: 1.0, text: "…y la cierre. Busca un clic o crepitación." },
          ],
        },
        text: {
          setup: "Paciente sentado. El examinador, delante, con los dedos sobre los dos cóndilos (o un fonendoscopio).",
          look: "Clic reproducible al abrir y al cerrar: desplazamiento discal con reducción. Crepitación: enfermedad degenerativa.",
        },
      },
    ],
    related: ["atm-apertura-maxima"],
  },
  {
    id: "atm-isometrico",
    region: "atm",
    group: "Dolor muscular y articular (DC/TMD)",
    name: "Test de resistencia isométrica mandibular",
    aka: ["Isometric resistance test", "Contracción isométrica de la mandíbula"],
    kind: "test",
    purpose: "Ver si el dolor viene de los músculos masticadores provocándolo con una contracción sin movimiento.",
    position: "Paciente sentado con la boca ligeramente abierta. Examinador delante con la mano en el mentón o a un lado de la mandíbula.",
    steps: [
      "Pide al paciente que intente abrir la boca contra tu mano bajo el mentón, sin moverla (5 s).",
      "Repite intentando cerrar, desplazar la mandíbula a cada lado y protruir.",
      "Pregunta en cada dirección si aparece su dolor y dónde.",
    ],
    positive: "Reproduce el dolor familiar en un músculo concreto durante la contracción sin movimiento.",
    interpretation:
      "Sin datos de precisión comprobados. Un dolor claro con la contracción isométrica apoya el origen muscular; combínalo con la palpación y el test de carga.",
    accuracy: [],
    utility: "desconocida",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { jaw: 0 },
        to: { jaw: 4 },
        hands: ["jaw"],
        grips: [{ kind: "tips", face: "caudal" }],
        arrows: [{ at: "jaw", dir: "cranial", label: "resistencia", len: 12 }],
        pain: ["r_tmj"],
        caption: "Intento de apertura contra la mano bajo el mentón.",
        side: "both",
        script: {
          start: { jaw: { flex: 4 } },
          steps: [{ by: "patient", dur: 0.8, hold: 1.6, path: false, pain: true, marks: [{ kind: "resist", at: "jaw", dir: "caudal", label: "Intenta abrir contra la mano" }], text: "Con la boca algo abierta, pide que intente abrir contra tu mano bajo el mentón, sin moverse." }],
        },
        text: {
          setup: "Paciente sentado con la boca ligeramente abierta. La mano del examinador, bajo el mentón.",
          look: "Positivo si la contracción sin movimiento reproduce su dolor familiar en un músculo concreto.",
        },
        supuestos: ["Solo se dibuja la apertura resistida; el cierre y los laterales van igual."],
      },
    ],
    related: ["atm-palpacion", "atm-carga-mordida"],
  },
  {
    id: "atm-depresor-fractura",
    region: "atm",
    group: "Fractura mandibular",
    name: "Test del depresor lingual (fractura mandibular)",
    aka: ["Tongue blade test", "Test de la paleta"],
    kind: "test",
    purpose: "Descartar una fractura de mandíbula tras un traumatismo facial antes de pedir imagen.",
    position: "Paciente sentado tras un golpe en la mandíbula. Examinador delante con un depresor lingual de madera.",
    steps: [
      "Coloca el depresor entre los molares de un lado.",
      "Pide al paciente que muerda con fuerza y lo sujete.",
      "Gira el depresor intentando romperlo mientras el paciente lo retiene.",
      "Repite en el otro lado.",
    ],
    positive: "El paciente no puede sujetar el depresor (lo suelta o el dolor se lo impide). Negativo si el depresor se rompe sin que lo suelte.",
    interpretation:
      "Muy sensible: si el paciente rompe el depresor en ambos lados, la fractura es poco probable. Poco específico: un positivo pide radiografía o TC. Combínalo con maloclusión, dolor a la palpación e hinchazón.",
    accuracy: [
      {
        source: "Alonso y Purcell, 1995",
        citation: "Alonso LL, Purcell TB. Accuracy of the tongue blade test in patients with suspected mandibular fracture. Journal of Emergency Medicine. 1995;13(3):297-304.",
        sens: 95.7,
        spec: 63.5,
        context: "110 pacientes en urgencias con sospecha de fractura mandibular, frente a radiografía.",
      },
    ],
    utility: "alta",
    cautions: "Si hay maloclusión evidente, herida abierta intraoral o sospecha de lesión cervical o craneal, no lo hagas y deriva directamente.",
    figures: [
      {
        view: "side",
        posture: "sitting",
        joints: { jaw: 2 },
        prop: "depressor",
        hands: ["depressor"],
        grips: [{ kind: "grasp", face: "cranial" }],
        arrows: [{ at: "depressor", rotate: "cw", label: "giro" }],
        pain: ["jaw"],
        caption: "Mordida sobre el depresor mientras el examinador lo gira.",
        side: "both",
        script: {
          start: { jaw: { flex: 2 } },
          steps: [{ by: "patient", dur: 0.8, hold: 1.6, path: false, pain: true, marks: [{ kind: "resist", at: "jaw", dir: "cranial", label: "Muerde el depresor" }], text: "Pide que muerda el depresor mientras lo giras." }],
        },
        text: {
          setup: "Paciente sentado tras un golpe en la mandíbula. El examinador, delante, con un depresor lingual de madera entre sus dientes.",
          look: "Positivo si no puede sujetar el depresor (lo suelta o el dolor se lo impide). Negativo si el depresor se rompe sin que lo suelte.",
        },
        supuestos: ["El giro del depresor no se dibuja."],
      },
    ],
    related: ["atm-carga-mordida"],
  },
];
