// Columna lumbar: tests de control del movimiento (Luomajoki) y pruebas funcionales (Denteneer et al., 2018).
// Datos comprobados en PubMed el 03-11-2026 (resúmenes y texto completo de PMC). Lo que la fuente no da va en
// `supuestos` de cada figura o se dice en el texto («sin verificar»); nada de esto está validado clínicamente.
import type { Accuracy, SpecialTest } from "../types";

const CONTROL = "Control del movimiento (Luomajoki)";
const FUNCION = "Pruebas funcionales";

const LUOMAJOKI_2007 = {
  source: "Luomajoki et al., 2007",
  citation:
    "Luomajoki H, Kool J, de Bruin ED, Airaksinen O. Reliability of movement control tests in the lumbar spine. BMC Musculoskelet Disord. 2007;8:90. PMID 17850669.",
  doi: "10.1186/1471-2474-8-90",
};
const LUOMAJOKI_2008 = {
  source: "Luomajoki et al., 2008",
  citation:
    "Luomajoki H, Kool J, de Bruin ED, Airaksinen O. Movement control tests of the low back; evaluation of the difference between patients with low back pain and healthy controls. BMC Musculoskelet Disord. 2008;9:170. PMID 19108735.",
  doi: "10.1186/1471-2474-9-170",
};
const SALVIOLI_2019 = {
  source: "Salvioli et al., 2019",
  citation:
    "Salvioli S, Pozzi A, Testa M. Movement Control Impairment and Low Back Pain: State of the Art of Diagnostic Framing. Medicina (Kaunas). 2019;55(9):548. PMID 31470684.",
  doi: "10.3390/medicina55090548",
};
const CARLSSON_2013 = {
  source: "Carlsson y Rasmussen-Barr, 2013",
  citation:
    "Carlsson H, Rasmussen-Barr E. Clinical screening tests for assessing movement control in non-specific low-back pain. A systematic review of intra- and inter-observer reliability studies. Man Ther. 2013;18(2):103-10. PMID 23018080.",
  doi: "10.1016/j.math.2012.08.004",
};
const DENTENEER_2018 = {
  source: "Denteneer et al., 2018",
  citation:
    "Denteneer L, Van Daele U, Truijen S, De Hertogh W, Meirte J, Stassijns G. Reliability of physical functioning tests in patients with low back pain: a systematic review. Spine J. 2018;18(1):190-207. PMID 28882521.",
  doi: "10.1016/j.spinee.2017.08.257",
};
const SIMMONDS_1998 = {
  source: "Simmonds et al., 1998",
  citation:
    "Simmonds MJ, Olson SL, Jones S, Hussein T, Lee CE, Novy D, Radwan H. Psychometric characteristics and clinical usefulness of physical performance tests in patients with low back pain. Spine. 1998;23(22):2412-21. PMID 9836355.",
  doi: "10.1097/00007632-199811150-00011",
};

/** Kappa de Luomajoki 2007 (tabla 2): entre examinadores (dos parejas) y del mismo examinador (dos observadores). */
const kappa2007 = (inter: string, intra: string): Accuracy => ({
  ...LUOMAJOKI_2007,
  reliability: `kappa entre examinadores ${inter}; del mismo examinador ${intra}`,
  context: "Vídeos de 40 personas (con y sin dolor lumbar) valorados por 4 fisioterapeutas; tabla 2 del artículo",
});
const icc2018 = (range: string): Accuracy => ({
  ...DENTENEER_2018,
  reliability: `test-retest CCI ${range}`,
  context: "Revisión sistemática en pacientes con dolor lumbar (rango entre estudios, según el resumen)",
});

const CONTROL_INTERPRETATION =
  "Test de observación del control lumbopélvico, sin patrón de referencia: no tiene sensibilidad ni especificidad publicadas. Una revisión concluye que no se puede afirmar nada sobre la validez de estos tests (Salvioli et al., 2019). Forma parte de la batería de Luomajoki.";
/** Cuadrupedia con la zona lumbar neutra: la pelvis inclinada 90° hacia delante (tronco horizontal), caderas, rodillas
 *  y hombros a 90° y muñecas en extensión, con los brazos algo separados para no rozar los muslos. */
const quad = (pelvis: number, hip: number, knee: number, shoulder: number) => ({
  pelvis: { flex: pelvis },
  trunk: { flex: 0 },
  r_hip: { flex: hip },
  l_hip: { flex: hip },
  r_knee: { flex: knee },
  l_knee: { flex: knee },
  r_shoulder: { flex: shoulder, abd: 5 },
  l_shoulder: { flex: shoulder, abd: 5 },
  r_wrist: { flex: -80 },
  l_wrist: { flex: -80 },
});
const CONTROL_RULE = "Solo cuenta como incorrecto si la alteración es clara; si mejora al explicarlo o corregirlo, se considera correcto (Luomajoki et al., 2007).";

export const lumbarFuncionTests: SpecialTest[] = [
  // ───────────── Control del movimiento (Luomajoki) ─────────────
  {
    id: "lum-luomajoki-bateria",
    region: "lumbar",
    group: CONTROL,
    name: "Batería de control del movimiento lumbar (Luomajoki)",
    aka: ["Movement control impairment test battery", "MCI tests", "Luomajoki"],
    kind: "cluster",
    purpose: "Conjunto de tests de observación que valoran si el paciente controla la zona lumbar mientras mueve las caderas o las piernas.",
    position: "Paciente en ropa interior para ver columna, caderas y piernas. Se hace de pie, sentado, en cuadrupedia, en prono y en supino.",
    steps: [
      "Reverencia del camarero (de pie).",
      "Basculación de la pelvis (de pie).",
      "Apoyo sobre una pierna, a cada lado (de pie).",
      "Extensión de rodilla sentado.",
      "Balanceo hacia atrás en cuadrupedia.",
      "Balanceo hacia delante en cuadrupedia.",
      "Flexión activa de rodilla en prono (se valoran extensión y rotación).",
      "Abducción de cadera en supino con las rodillas flexionadas.",
    ],
    positive:
      "Se cuenta el número de tests incorrectos (positivos). En el estudio de fiabilidad (2007) se puntuaron 10 ítems; en el de 2008, una batería de 6 tests (0 a 6). No hay punto de corte publicado.",
    interpretation:
      "En 2008, los pacientes con dolor lumbar tuvieron de media 2,21 tests positivos de 6 (IC 95 % 1,94-2,48) y los controles 0,75 (0,55-0,95); d = 1,18. Es una descripción de grupos, no un umbral: sin patrón de referencia no hay sensibilidad ni especificidad. La batería entera dura unos 10 minutos (2007). Las revisiones recomiendan sobre todo la reverencia del camarero, la extensión de rodilla sentado y el apoyo sobre una pierna, por su fiabilidad (Salvioli et al., 2019), y no permiten afirmar nada sobre su validez.",
    accuracy: [
      {
        ...LUOMAJOKI_2007,
        reliability: "kappa entre examinadores 0,38-0,72 y del mismo examinador 0,51-0,95 según el test (medias de la tabla 2)",
        context: "10 ítems; vídeos de 40 personas valorados por 4 fisioterapeutas",
      },
      {
        ...CARLSSON_2013,
        reliability: "fiabilidad moderada del prono con flexión de rodilla y buena del apoyo sobre una pierna",
        context: "Revisión sistemática de 8 estudios de fiabilidad",
      },
      { ...SALVIOLI_2019, reliability: "buena a excelente en la reverencia del camarero, la extensión de rodilla sentado y el apoyo sobre una pierna", context: "Revisión" },
    ],
    utility: "desconocida",
    figures: [
      {
        view: "side",
        posture: "standing",
        caption: "Primer test de la batería: reverencia del camarero",
        side: "both",
        script: {
          steps: [
            {
              to: { pelvis: { flex: 60 }, r_hip: { flex: 60 }, l_hip: { flex: 60 } },
              by: "patient",
              dur: 2.2,
              hold: 1.2,
              text: "Ejemplo, primer test: inclinarse hacia delante desde las caderas sin mover la zona lumbar.",
            },
          ],
        },
        text: {
          setup: "Paciente en ropa interior. La batería pasa por de pie, sentado, cuadrupedia, prono y supino.",
          look: "Se cuenta cuántos tests son incorrectos. No hay punto de corte publicado.",
        },
        supuestos: ["Solo se dibuja el primer test (60° de flexión de cadera con la zona lumbar quieta)."],
      },
    ],
    related: [
      "lum-luomajoki-camarero",
      "lum-luomajoki-basculacion",
      "lum-luomajoki-monopodal",
      "lum-luomajoki-rodilla-sentado",
      "lum-luomajoki-balanceo-atras",
      "lum-luomajoki-balanceo-delante",
      "lum-luomajoki-prono-rodilla",
      "lum-luomajoki-abduccion-supino",
    ],
  },
  {
    id: "lum-luomajoki-camarero",
    region: "lumbar",
    group: CONTROL,
    name: "Reverencia del camarero",
    aka: ["Waiter's bow"],
    kind: "test",
    purpose: "Valora el control de la flexión: si el paciente puede flexionar las caderas sin flexionar la zona lumbar.",
    position: "De pie, erguido. El examinador de lado.",
    steps: ["Pide que se incline hacia delante desde las caderas, sin mover la zona lumbar.", "Observa cuánto flexiona las caderas antes de que se mueva la zona lumbar."],
    positive: "Menos de 50° de flexión de cadera sin movimiento lumbar, o flexión de la zona lumbar. Correcto: 50-70° de flexión de cadera sin movimiento lumbar.",
    interpretation: CONTROL_INTERPRETATION,
    accuracy: [kappa2007("0,71 y 0,52 (media 0,62)", "0,75 y 1,0 (media 0,88)"), { ...SALVIOLI_2019, reliability: "kappa entre examinadores 0,62 y 0,78 en dos estudios", context: "Revisión" }],
    utility: "desconocida",
    cautions: CONTROL_RULE,
    figures: [
      {
        view: "side",
        posture: "standing",
        caption: "Flexión de caderas con la zona lumbar quieta",
        side: "both",
        script: {
          steps: [
            {
              to: { pelvis: { flex: 60 }, r_hip: { flex: 60 }, l_hip: { flex: 60 } },
              by: "patient",
              dur: 2.2,
              hold: 1.2,
              text: "Pide que se incline hacia delante desde las caderas sin mover la zona lumbar.",
            },
          ],
        },
        text: {
          setup: "Paciente de pie, erguido. El examinador, de lado.",
          look: "Incorrecto si flexiona menos de 50° las caderas sin mover la zona lumbar, o si flexiona la zona lumbar. Correcto: 50-70° de flexión de cadera sin movimiento lumbar.",
        },
        supuestos: ["Se enseña el movimiento correcto, con 60° de flexión de cadera."],
      },
    ],
    related: ["lum-luomajoki-bateria"],
  },
  {
    id: "lum-luomajoki-basculacion",
    region: "lumbar",
    group: CONTROL,
    name: "Basculación de la pelvis de pie",
    aka: ["Pelvic tilt (standing)", "Dorsal tilt of the pelvis"],
    kind: "test",
    purpose: "Valora el control de la extensión: si el paciente puede bascular la pelvis hacia atrás de forma aislada.",
    position: "De pie, erguido. El examinador de lado.",
    steps: ["Pide que bascule la pelvis hacia atrás (retroversión) con actividad de los glúteos.", "La zona lumbar va hacia flexión y la columna torácica se queda neutra."],
    positive: "La pelvis no bascula, la zona lumbar va hacia extensión, no hay actividad de los glúteos o aparece flexión torácica para compensar.",
    interpretation: CONTROL_INTERPRETATION,
    accuracy: [kappa2007("0,60 y 0,70 (media 0,65)", "0,80 y 0,8 (media 0,80)")],
    utility: "desconocida",
    cautions: CONTROL_RULE,
    figures: [
      {
        view: "side",
        posture: "standing",
        caption: "Retroversión de la pelvis con el tórax quieto",
        side: "both",
        script: {
          steps: [
            {
              to: { pelvis: { flex: -15 }, r_hip: { flex: -15 }, l_hip: { flex: -15 }, trunk: { flex: 15 } },
              by: "patient",
              dur: 1.8,
              hold: 1.2,
              text: "Pide que bascule la pelvis hacia atrás apretando los glúteos, sin mover el tórax.",
            },
          ],
        },
        text: {
          setup: "Paciente de pie, erguido. El examinador, de lado.",
          look: "Incorrecto si la pelvis no bascula, la zona lumbar se extiende, no trabajan los glúteos o se flexiona el tórax para compensar.",
        },
        supuestos: ["Retroversión de 15°; la fuente no da grados."],
      },
    ],
    related: ["lum-luomajoki-bateria"],
  },
  {
    id: "lum-luomajoki-monopodal",
    region: "lumbar",
    group: CONTROL,
    name: "Apoyo sobre una pierna (control lumbopélvico)",
    aka: ["One leg stance"],
    kind: "test",
    purpose: "Valora el control de la inclinación lateral y la rotación al pasar a apoyo sobre una pierna.",
    position: "De pie, con los pies separados un tercio de la distancia entre los trocánteres. El examinador delante.",
    steps: [
      "Pide que pase a apoyarse sobre una pierna.",
      "Mide cuánto se desplaza el ombligo hacia el lado de apoyo.",
      "Repite sobre la otra pierna y compara los dos lados.",
    ],
    positive: "Desplazamiento lateral del ombligo de más de 10 cm, o diferencia de más de 2 cm entre los dos lados.",
    interpretation: CONTROL_INTERPRETATION,
    accuracy: [
      { ...kappa2007("derecha media 0,43; izquierda media 0,65", "derecha media 0,67; izquierda media 0,84"), context: "Cada lado se puntuó por separado; tabla 2 del artículo" },
      { ...LUOMAJOKI_2008, reliability: "kappa 0,54 (sin separar lados)", context: "Batería de 2008" },
    ],
    utility: "desconocida",
    cautions: CONTROL_RULE,
    figures: [
      {
        view: "front",
        posture: "standing",
        caption: "Paso a apoyo sobre la pierna derecha",
        side: "r",
        camera: { from: [0.2, 0.05, 1], zoom: 0.4 },
        script: {
          steps: [
            {
              to: { l_hip: { flex: 40 }, l_knee: { flex: 70 } },
              by: "patient",
              dur: 1.6,
              hold: 1.4,
              text: "Pide que se apoye sobre la pierna derecha. Mide el desplazamiento lateral del ombligo y repite sobre la izquierda.",
            },
          ],
        },
        text: {
          setup: "Paciente de pie, con los pies separados un tercio de la distancia entre trocánteres. El examinador, delante.",
          look: "Incorrecto si el ombligo se desplaza más de 10 cm hacia el lado o si la diferencia entre los dos lados es de más de 2 cm.",
        },
        supuestos: ["La altura a la que se levanta la otra pierna no está en la fuente (40° de cadera, 70° de rodilla).", "La cinta métrica no se dibuja."],
      },
    ],
    related: ["lum-luomajoki-bateria"],
  },
  {
    id: "lum-luomajoki-rodilla-sentado",
    region: "lumbar",
    group: CONTROL,
    name: "Extensión de rodilla sentado (control lumbopélvico)",
    aka: ["Sitting knee extension"],
    kind: "test",
    purpose: "Valora el control de la flexión: si el paciente extiende la rodilla sin que la zona lumbar se flexione.",
    position: "Sentado, erguido, con la lordosis lumbar corregida. El examinador de lado.",
    steps: ["Pide que extienda la rodilla sin mover la zona lumbar.", "Observa si la zona lumbar se va a flexión (el paciente no suele notarlo)."],
    positive: "La zona lumbar se mueve hacia flexión al extender la rodilla.",
    interpretation: `${CONTROL_INTERPRETATION} El estudio da como normal un rango de 30-50° de «extensión» (copiado tal cual de la fuente).`,
    accuracy: [kappa2007("0,80 y 0,64 (media 0,72)", "1,0 y 0,9 (media 0,95)")],
    utility: "desconocida",
    cautions: CONTROL_RULE,
    figures: [
      {
        view: "side",
        posture: "sitting",
        caption: "Extensión de rodilla con la zona lumbar quieta",
        side: "r",
        script: {
          start: { r_knee: { flex: 90 } },
          steps: [{ to: { r_knee: { flex: 45 } }, by: "patient", dur: 1.8, hold: 1.2, text: "Pide que extienda la rodilla sin mover la zona lumbar." }],
        },
        text: {
          setup: "Paciente sentado, erguido, con la lordosis lumbar corregida. El examinador, de lado.",
          look: "Incorrecto si la zona lumbar se flexiona al extender la rodilla.",
        },
        supuestos: ["Extensión hasta 45° de flexión de rodilla; el rango de la fuente (30-50°) no dice cómo se mide."],
      },
    ],
    related: ["lum-luomajoki-bateria"],
  },
  {
    id: "lum-luomajoki-balanceo-atras",
    region: "lumbar",
    group: CONTROL,
    name: "Balanceo hacia atrás en cuadrupedia",
    aka: ["Rocking backwards", "Quadruped rocking backward"],
    kind: "test",
    purpose: "Valora el control de la flexión: si el paciente lleva la pelvis hacia atrás sin flexionar la zona lumbar.",
    position: "En cuadrupedia, con la zona lumbar en posición neutra. El examinador de lado.",
    steps: ["Pide que lleve la pelvis hacia atrás, hacia los talones.", "Observa si la flexión de cadera arrastra la zona lumbar a flexión."],
    positive: "La flexión de cadera arrastra la columna lumbar a flexión. Correcto: 120° de flexión de cadera sin flexión lumbar.",
    interpretation: CONTROL_INTERPRETATION,
    accuracy: [kappa2007("0,68 y 0,45 (media 0,57)", "0,73 y 0,70 (media 0,72)")],
    utility: "desconocida",
    cautions: CONTROL_RULE,
    figures: [
      {
        view: "side",
        posture: "quadruped",
        caption: "La pelvis va hacia atrás con la zona lumbar neutra",
        side: "both",
        script: {
          start: quad(90, 90, 90, 90),
          steps: [
            {
              to: quad(85, 115, 125, 105),
              by: "patient",
              dur: 2.2,
              hold: 1.2,
              text: "Pide que lleve la pelvis hacia atrás, hacia los talones, sin redondear la zona lumbar.",
            },
          ],
        },
        text: {
          setup: "Paciente en cuadrupedia, con la zona lumbar neutra. El examinador, de lado.",
          look: "Incorrecto si la zona lumbar se flexiona antes de llegar a unos 120° de flexión de cadera.",
        },
        supuestos: ["Cuadrupedia de partida con el tronco horizontal, caderas, hombros y rodillas a 90° y los brazos algo separados (5°).", "Balanceo hasta 115° de flexión de cadera; la figura no apoya rodillas y manos con precisión sobre el suelo."],
      },
    ],
    related: ["lum-luomajoki-bateria", "lum-luomajoki-balanceo-delante"],
  },
  {
    id: "lum-luomajoki-balanceo-delante",
    region: "lumbar",
    group: CONTROL,
    name: "Balanceo hacia delante en cuadrupedia",
    aka: ["Rocking forwards", "Quadruped rocking forward"],
    kind: "test",
    purpose: "Valora el control de la extensión: si el paciente lleva la pelvis hacia delante sin extender la zona lumbar.",
    position: "En cuadrupedia. El examinador de lado.",
    steps: ["Pide que lleve la pelvis hacia delante.", "Observa si el movimiento de cadera produce extensión lumbar."],
    positive: "El movimiento de cadera produce extensión lumbar.",
    interpretation: `${CONTROL_INTERPRETATION} Los autores piden interpretar este test con cautela por su baja fiabilidad en un observador.`,
    accuracy: [kappa2007("0,66 y 0,69 (media 0,68)", "0,22 y 0,8 (media 0,51)")],
    utility: "desconocida",
    cautions: CONTROL_RULE,
    figures: [
      {
        view: "side",
        posture: "quadruped",
        caption: "La pelvis va hacia delante sin extender la zona lumbar",
        side: "both",
        script: {
          start: quad(90, 90, 90, 90),
          steps: [
            {
              to: quad(90, 70, 70, 70),
              by: "patient",
              dur: 2.0,
              hold: 1.2,
              text: "Pide que lleve la pelvis hacia delante sin hundir la zona lumbar.",
            },
          ],
        },
        text: {
          setup: "Paciente en cuadrupedia. El examinador, de lado.",
          look: "Incorrecto si la zona lumbar se extiende al llevar la pelvis hacia delante.",
        },
        supuestos: ["Cuadrupedia de partida con el tronco horizontal, caderas, hombros y rodillas a 90° y los brazos algo separados (5°).", "Recorrido de unos 20° de cadera; la fuente no da grados."],
      },
    ],
    related: ["lum-luomajoki-bateria", "lum-luomajoki-balanceo-atras"],
  },
  {
    id: "lum-luomajoki-prono-rodilla",
    region: "lumbar",
    group: CONTROL,
    name: "Flexión activa de rodilla en prono (control lumbopélvico)",
    aka: ["Prone active knee flexion", "Prone knee bend"],
    kind: "test",
    purpose: "Valora el control de la extensión y de la rotación lumbopélvicas al flexionar la rodilla boca abajo.",
    position: "En prono. El examinador de lado.",
    steps: [
      "Pide: «doble la rodilla todo lo que pueda sin mover la espalda».",
      "Observa si la zona lumbar se va a extensión (primer ítem).",
      "Observa si la pelvis rota (segundo ítem).",
    ],
    positive: "La zona lumbar se va a extensión, o la pelvis rota, al flexionar la rodilla. Correcto: al menos 90° de flexión de rodilla sin movimiento lumbopélvico.",
    interpretation: `${CONTROL_INTERPRETATION} Se puntúa dos veces: extensión y rotación.`,
    accuracy: [
      { ...kappa2007("0,75 y 0,19 (media 0,47)", "0,59 y 0,8 (media 0,70)"), context: "Ítem de extensión; tabla 2 del artículo" },
      { ...kappa2007("0,62 y 0,54 (media 0,58)", "0,60 y 0,95 (media 0,78)"), context: "Ítem de rotación; tabla 2 del artículo" },
      { ...CARLSSON_2013, reliability: "moderada entre estudios", context: "Revisión sistemática de 8 estudios" },
    ],
    utility: "desconocida",
    cautions: CONTROL_RULE,
    figures: [
      {
        view: "side",
        posture: "prone",
        caption: "Flexión de rodilla con la pelvis quieta",
        side: "r",
        script: {
          steps: [{ to: { r_knee: { flex: 95 } }, by: "patient", dur: 1.8, hold: 1.2, text: "Pide que doble la rodilla todo lo que pueda sin mover la espalda." }],
        },
        text: {
          setup: "Paciente en prono. El examinador, de lado.",
          look: "Incorrecto si la zona lumbar se extiende o la pelvis rota antes de llegar a 90° de flexión de rodilla.",
        },
        supuestos: ["Se enseña el movimiento correcto, hasta 95° de flexión de rodilla."],
      },
    ],
    related: ["lum-luomajoki-bateria"],
  },
  {
    id: "lum-luomajoki-abduccion-supino",
    region: "lumbar",
    group: CONTROL,
    name: "Abducción de cadera en supino con rodillas flexionadas",
    aka: ["Crook lying hip abduction", "Bent knee fall out"],
    kind: "test",
    purpose: "Valora el control de la rotación: si la pelvis se queda quieta mientras la rodilla cae hacia fuera.",
    position: "En supino con las caderas y las rodillas flexionadas, los pies apoyados. El examinador a los pies.",
    steps: ["Pide que deje caer una rodilla hacia fuera de forma controlada.", "Observa si el ombligo se desplaza o la pelvis rota o bascula."],
    positive: "El ombligo se desplaza hacia un lado, o la pelvis rota o bascula.",
    interpretation: `${CONTROL_INTERPRETATION} Es el test menos fiable entre examinadores de la batería.`,
    accuracy: [kappa2007("0,44 y 0,32 (media 0,38)", "0,84 y 0,88 (media 0,86)")],
    utility: "desconocida",
    cautions: CONTROL_RULE,
    figures: [
      {
        view: "front",
        posture: "hooklying",
        caption: "La rodilla cae hacia fuera con la pelvis quieta",
        side: "r",
        script: {
          start: { r_hip: { flex: 45 }, l_hip: { flex: 45 }, r_knee: { flex: 90 }, l_knee: { flex: 90 } },
          steps: [{ to: { r_hip: { abd: 35, rot: -25 } }, by: "patient", dur: 2.0, hold: 1.2, text: "Pide que deje caer la rodilla derecha hacia fuera, sin que se mueva la pelvis." }],
        },
        text: {
          setup: "Paciente en supino con caderas y rodillas flexionadas y los pies apoyados. El examinador, a los pies.",
          look: "Incorrecto si el ombligo se desplaza o la pelvis rota o bascula.",
        },
        supuestos: ["Recorrido de 35° de abducción con rotación externa; la fuente no da grados."],
      },
    ],
    related: ["lum-luomajoki-bateria"],
  },

  // ───────────── Pruebas funcionales (con cifra) ─────────────
  {
    id: "lum-sorensen",
    region: "lumbar",
    group: FUNCION,
    name: "Resistencia de extensores lumbares (Biering-Sørensen)",
    aka: ["Biering-Sørensen test", "Sorensen test", "Extensor endurance test"],
    kind: "test",
    purpose: "Mide cuánto tiempo mantiene el paciente el tronco horizontal sin apoyo: resistencia de los extensores del tronco.",
    position: "En prono sobre la camilla, con la parte inferior del cuerpo fijada y la superior fuera de la camilla, sin apoyo. El examinador al lado con un cronómetro.",
    steps: ["Fija la pelvis y las piernas a la camilla.", "Pide que mantenga el tronco horizontal todo el tiempo que pueda.", "Para el cronómetro cuando ya no lo mantiene."],
    positive: "Segundos que mantiene el tronco horizontal.",
    interpretation:
      "Prueba que se mide en segundos, sin positivo ni negativo. En pacientes con dolor lumbar actual, el error de medida (SEM) fue de 11,6 s (Latimer et al., 1999). Sin verificar en las fuentes: el borde de la camilla (cresta ilíaca o EIAS), cómo se fija, la posición de los brazos y el tiempo máximo.",
    accuracy: [
      icc2018("0,93-0,97"),
      { ...DENTENEER_2018, reliability: "entre examinadores CCI 0,88-0,99 (la única prueba con buena fiabilidad entre examinadores en la revisión)", context: "Revisión sistemática" },
      {
        source: "Latimer et al., 1999",
        citation:
          "Latimer J, Maher CG, Refshauge K, Colaco I. The reliability and validity of the Biering-Sorensen test in asymptomatic subjects and subjects reporting current or previous nonspecific low back pain. Spine. 1999;24(20):2085-9. PMID 10543003.",
        doi: "10.1097/00007632-199910150-00004",
        reliability: "CCI 0,88 (IC 95 % 0,73-0,95); SEM 11,6 s",
        context: "Pacientes con dolor lumbar actual; test-retest a los 15 minutos",
      },
    ],
    utility: "desconocida",
    measure: { label: "Tiempo", unit: "s" },
    figures: [
      {
        view: "side",
        posture: "prone",
        caption: "Tronco horizontal sin apoyo: se cronometra",
        side: "both",
        script: {
          steps: [{ by: "patient", dur: 0.6, hold: 2.4, text: "Pide que mantenga el tronco horizontal todo el tiempo que pueda. Para el cronómetro cuando ya no lo mantenga." }],
        },
        text: {
          setup: "Paciente en prono con la parte inferior del cuerpo fijada a la camilla y la superior fuera, sin apoyo. El examinador, con un cronómetro.",
          look: "Se apuntan los segundos que mantiene el tronco horizontal.",
        },
        supuestos: ["La figura no dibuja el tronco fuera de la camilla ni las correas: solo la postura en prono.", "No se dibuja el cronómetro."],
      },
    ],
    related: ["lum-flexores-resistencia"],
  },
  {
    id: "lum-flexores-resistencia",
    region: "lumbar",
    group: FUNCION,
    name: "Resistencia de flexores del tronco",
    aka: ["Flexor endurance test", "Trunk flexor endurance test (McGill)"],
    kind: "test",
    purpose: "Mide cuánto tiempo mantiene el paciente una posición isométrica de flexión del tronco: resistencia de los flexores.",
    position: "Posición de flexión del tronco mantenida (ver supuestos). El examinador al lado con un cronómetro.",
    steps: ["Coloca al paciente en la posición de partida.", "Pide que la mantenga todo el tiempo que pueda.", "Para el cronómetro cuando ya no la mantiene."],
    positive: "Segundos que mantiene la posición.",
    interpretation:
      "Prueba que se mide en segundos, sin positivo ni negativo. Sin verificar en las fuentes consultadas: la posición exacta y cuándo se da por terminada. Antes de usarla, consulta el protocolo original (McGill et al., 1999).",
    accuracy: [
      icc2018("0,90-0,97"),
      {
        source: "McGill et al., 1999",
        citation:
          "McGill SM, Childs A, Liebenson C. Endurance times for low back stabilization exercises: clinical targets for testing and training from a normal database. Arch Phys Med Rehabil. 1999;80(8):941-4. PMID 10453772.",
        doi: "10.1016/s0003-9993(99)90087-4",
        reliability: "coeficiente > 0,97 (5 días seguidos y a las 8 semanas)",
        context: "Personas sanas",
      },
      {
        source: "Ozcan Kahraman et al., 2016",
        citation:
          "Ozcan Kahraman B, Salik Sengul Y, Kahraman T, Kalemci O. Developing a Reliable Core Stability Assessment Battery for Patients with Nonspecific Low Back Pain. Spine. 2016;41(14):E844-E850. PMID 26679886.",
        doi: "10.1097/BRS.0000000000001403",
        reliability: "CCI 0,97 del mismo examinador",
        context: "38 pacientes con dolor lumbar inespecífico",
      },
    ],
    utility: "desconocida",
    measure: { label: "Tiempo", unit: "s" },
    figures: [
      {
        view: "side",
        posture: "hooklying",
        caption: "Flexión del tronco mantenida: se cronometra",
        side: "both",
        script: {
          steps: [{ to: { trunk: { flex: 60 } }, by: "patient", dur: 1.6, hold: 2.4, text: "Pide que mantenga el tronco en flexión todo el tiempo que pueda. Para el cronómetro cuando ya no lo mantenga." }],
        },
        text: {
          setup: "Posición de partida del test de McGill (sin verificar en las fuentes consultadas). El examinador, con un cronómetro.",
          look: "Se apuntan los segundos que mantiene la posición.",
        },
        supuestos: [
          "Posición dibujada según la descripción habitual (tronco a 60°, rodillas flexionadas y pies apoyados): no está comprobada en los resúmenes consultados.",
          "No se dibujan el respaldo ni la sujeción de los pies.",
        ],
      },
    ],
    related: ["lum-sorensen"],
  },
  {
    id: "lum-marcha-5-minutos",
    region: "lumbar",
    group: FUNCION,
    name: "Marcha de 5 minutos",
    aka: ["5-minute walk test"],
    kind: "test",
    purpose: "Mide la distancia que camina el paciente en 5 minutos.",
    position: "De pie al inicio de un recorrido medido. El examinador con un cronómetro.",
    steps: ["Pide que camine durante 5 minutos.", "Mide la distancia recorrida."],
    positive: "Metros recorridos en 5 minutos.",
    interpretation:
      "Prueba que se mide (distancia), sin positivo ni negativo. Sin verificar en las fuentes: la consigna de velocidad (cómoda o máxima), el tipo y la longitud del recorrido y la unidad del estudio original.",
    accuracy: [
      icc2018("0,89-0,99"),
      { ...SIMMONDS_1998, reliability: "CCI entre examinadores > 0,95; de un día a otro 0,59-0,88 en el grupo con dolor lumbar (para el conjunto de pruebas)", context: "Batería de pruebas físicas" },
    ],
    utility: "desconocida",
    measure: { label: "Distancia", unit: "m" },
    figures: [
      {
        view: "side",
        posture: "standing",
        caption: "Marcha: se mide la distancia en 5 minutos",
        side: "both",
        script: {
          steps: [{ to: { r_hip: { flex: 25 }, l_hip: { flex: -10 }, r_knee: { flex: 10 } }, by: "patient", dur: 1.0, hold: 1.4, text: "Pide que camine durante 5 minutos; mide la distancia recorrida." }],
        },
        text: { setup: "Paciente de pie al inicio de un recorrido medido. El examinador, con un cronómetro.", look: "Se apuntan los metros recorridos en 5 minutos." },
        supuestos: ["La marcha no se anima: solo se dibuja un paso.", "No se dibujan el recorrido ni el cronómetro."],
      },
    ],
    related: ["lum-marcha-50-pies", "lum-shuttle-walk"],
  },
  {
    id: "lum-marcha-50-pies",
    region: "lumbar",
    group: FUNCION,
    name: "Marcha de 50 pies (15,24 m) a máxima velocidad",
    aka: ["50-foot walk test", "50-ft walk"],
    kind: "test",
    purpose: "Mide el tiempo que tarda el paciente en recorrer 50 pies (15,24 m) a la máxima velocidad.",
    position: "De pie al inicio de un recorrido de 15,24 m. El examinador con un cronómetro.",
    steps: ["Pide que recorra los 50 pies lo más rápido que pueda.", "Mide el tiempo."],
    positive: "Segundos que tarda en recorrer 50 pies (15,24 m).",
    interpretation:
      "Prueba que se mide, sin positivo ni negativo. Simmonds et al. (1998) la hicieron también a velocidad preferida, pero esa versión no diferenció entre grupos. La unidad (tiempo) está deducida de la medida de velocidad del estudio, sin verificar.",
    accuracy: [icc2018("0,76-0,96"), { ...SIMMONDS_1998, reliability: "CCI entre examinadores > 0,95 (para el conjunto de pruebas)", context: "Batería de pruebas físicas" }],
    utility: "desconocida",
    measure: { label: "Tiempo", unit: "s" },
    figures: [
      {
        view: "side",
        posture: "standing",
        caption: "Marcha rápida: se cronometra el recorrido",
        side: "both",
        script: {
          steps: [{ to: { r_hip: { flex: 30 }, l_hip: { flex: -12 }, r_knee: { flex: 15 } }, by: "patient", dur: 0.8, hold: 1.4, text: "Pide que recorra los 50 pies (15,24 m) lo más rápido que pueda; cronometra el recorrido." }],
        },
        text: { setup: "Paciente de pie al inicio de un recorrido de 15,24 m. El examinador, con un cronómetro.", look: "Se apuntan los segundos que tarda." },
        supuestos: ["La marcha no se anima: solo se dibuja un paso.", "No se dibujan el recorrido ni el cronómetro."],
      },
    ],
    related: ["lum-marcha-5-minutos", "lum-shuttle-walk"],
  },
  {
    id: "lum-shuttle-walk",
    region: "lumbar",
    group: FUNCION,
    name: "Prueba de marcha de lanzadera (shuttle walk)",
    aka: ["Shuttle walk test", "Shuttle walking test"],
    kind: "test",
    purpose: "Mide los metros que camina el paciente en una prueba de marcha con ritmo marcado desde fuera que aumenta por niveles, hasta el límite de sus síntomas.",
    position: "De pie al inicio del recorrido. El ritmo lo marcan señales sonoras.",
    steps: ["Pide que camine de un extremo a otro del recorrido al ritmo de las señales.", "El ritmo aumenta por niveles.", "Para cuando ya no puede seguir el ritmo o por sus síntomas; apunta los metros."],
    positive: "Metros caminados.",
    interpretation:
      "Prueba que se mide, sin positivo ni negativo. La versión original (Singh et al., 1992, en EPOC) es incremental, con 12 niveles; Taylor et al. (2001) la estudiaron en dolor lumbar crónico. Sin verificar: la longitud del recorrido, las señales sonoras y qué versión incluye la revisión de Denteneer.",
    accuracy: [
      icc2018("0,92-0,99"),
      {
        source: "Taylor et al., 2001",
        citation:
          "Taylor S, Frost H, Taylor A, Barker K. Reliability and responsiveness of the shuttle walking test in patients with chronic low back pain. Physiother Res Int. 2001;6(3):170-8. PMID 11725598.",
        doi: "10.1002/pri.225",
        reliability: "CCI 0,99; límites de acuerdo +52 m y −47 m (diferencia media 2,5 m)",
        context: "44 pacientes con dolor lumbar crónico",
      },
    ],
    utility: "desconocida",
    measure: { label: "Distancia", unit: "m" },
    figures: [
      {
        view: "side",
        posture: "standing",
        caption: "Marcha al ritmo de las señales: se apuntan los metros",
        side: "both",
        script: {
          steps: [{ to: { r_hip: { flex: 25 }, l_hip: { flex: -10 }, r_knee: { flex: 10 } }, by: "patient", dur: 1.0, hold: 1.4, text: "Pide que camine de un extremo a otro al ritmo de las señales, que se aceleran por niveles; apunta los metros al parar." }],
        },
        text: { setup: "Paciente de pie al inicio del recorrido. El ritmo lo marcan señales sonoras.", look: "Se apuntan los metros caminados." },
        supuestos: ["La marcha no se anima: solo se dibuja un paso.", "No se dibujan los conos ni el recorrido."],
      },
    ],
    related: ["lum-marcha-5-minutos", "lum-marcha-50-pies"],
  },
  {
    id: "lum-sentarse-levantarse",
    region: "lumbar",
    group: FUNCION,
    name: "Sentarse y levantarse (5 repeticiones)",
    aka: ["Sit-to-stand test", "5 repetition sit-to-stand"],
    kind: "test",
    purpose: "Mide el tiempo que tarda el paciente en levantarse de la silla y sentarse 5 veces.",
    position: "Sentado en una silla. El examinador con un cronómetro.",
    steps: ["Pide que se levante y se siente 5 veces seguidas.", "Mide el tiempo."],
    positive: "Segundos que tarda en hacer las 5 repeticiones.",
    interpretation:
      "Prueba que se mide, sin positivo ni negativo. Simmonds et al. (1998) indican que la fiabilidad de un día a otro mejoró a 0,76-0,91 al promediar dos intentos. Sin verificar: la altura de la silla, el uso de los brazos y la consigna de velocidad.",
    accuracy: [icc2018("0,91-0,99"), { ...SIMMONDS_1998, reliability: "de un día a otro 0,76-0,91 promediando 2 intentos", context: "Grupo con dolor lumbar" }],
    utility: "desconocida",
    measure: { label: "Tiempo", unit: "s" },
    figures: [
      {
        view: "side",
        posture: "sitting",
        caption: "Inicio del gesto de levantarse",
        side: "both",
        script: {
          steps: [{ to: { pelvis: { flex: 30 }, r_hip: { flex: 120 }, l_hip: { flex: 120 } }, by: "patient", dur: 1.2, hold: 1.0, text: "Pide que se levante y se siente 5 veces seguidas; cronometra el total." }],
        },
        text: { setup: "Paciente sentado en una silla. El examinador, con un cronómetro.", look: "Se apuntan los segundos que tarda en las 5 repeticiones." },
        supuestos: ["Solo se dibuja la inclinación hacia delante del inicio del gesto, no el paso a de pie."],
      },
    ],
  },
  {
    id: "lum-alcance-carga",
    region: "lumbar",
    group: FUNCION,
    name: "Alcance hacia delante con carga",
    aka: ["Loaded forward reach test", "Loaded reach"],
    kind: "test",
    purpose: "Mide cuánto se inclina hacia delante el paciente de pie sosteniendo un peso del 5 % de su peso corporal.",
    position: "De pie, sosteniendo un peso del 5 % de su peso corporal. El examinador al lado.",
    steps: ["Da al paciente un peso del 5 % de su peso corporal.", "Pide que se incline hacia delante todo lo que pueda sosteniéndolo.", "Mide la distancia de alcance."],
    positive: "Distancia de alcance.",
    interpretation:
      "Prueba que se mide, sin positivo ni negativo. El peso del 5 % del peso corporal está en Lee et al. (2001). Sin verificar: la posición de los brazos y cómo se mide el alcance (la unidad en cm es una deducción).",
    accuracy: [
      icc2018("0,74-0,98"),
      { ...SIMMONDS_1998, reliability: "CCI entre examinadores > 0,95 (para el conjunto de pruebas)", context: "Batería de pruebas físicas" },
      {
        source: "Lee et al., 2001",
        citation:
          "Lee CE, Simmonds MJ, Novy DM, Jones S. Self-reports and clinician-measured physical function among patients with low back pain: a comparison. Arch Phys Med Rehabil. 2001;82(2):227-31. PMID 11239315.",
        doi: "10.1053/apmr.2001.18214",
        context: "Descripción de la carga: 5 % del peso corporal",
      },
    ],
    utility: "desconocida",
    measure: { label: "Alcance", unit: "cm" },
    figures: [
      {
        view: "side",
        posture: "standing",
        caption: "Inclinación hacia delante con un peso en las manos",
        side: "both",
        script: {
          start: { r_shoulder: { flex: 90 }, l_shoulder: { flex: 90 } },
          steps: [
            {
              to: { pelvis: { flex: 25 }, r_hip: { flex: 25 }, l_hip: { flex: 25 }, trunk: { flex: 15 } },
              by: "patient",
              dur: 2.0,
              hold: 1.2,
              text: "Con el peso en las manos, pide que se incline hacia delante todo lo que pueda; mide el alcance.",
            },
          ],
        },
        text: { setup: "Paciente de pie, sosteniendo un peso del 5 % de su peso corporal. El examinador, al lado.", look: "Se apunta la distancia de alcance." },
        supuestos: ["Brazos a 90° de flexión (no está en la fuente).", "No se dibujan el peso ni la regla."],
      },
    ],
  },
];
