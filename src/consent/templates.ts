// Plantillas de consentimiento informado (tipos en ./types.ts).
//
// AVISO: estos textos son un MODELO DE TRABAJO. No están validados clínica ni legalmente. Antes de usarlos con
// pacientes hay que revisarlos con el Colegio de Fisioterapeutas y con la asesoría jurídica del centro, y
// adaptarlos a las técnicas que de verdad se aplican. Al cambiar un texto, sube su `version`.
//
// Cada plantilla explica la técnica en lenguaje llano y de usted, sus beneficios, molestias esperables, riesgos
// frecuentes y raros, contraindicaciones y alternativas (Ley 41/2002, art. 10). `personal` añade los riesgos por
// las circunstancias del paciente a partir de lo MARCADO en la anamnesis (`ctx.precautions`, zonas, edad, sexo,
// banderas rojas). Lo que solo se ha detectado en el texto libre (`ctx.detected`) no genera texto para el
// paciente: la pantalla avisa de ello al fisioterapeuta, que decide si marcarlo.
import type { ConsentContext, ConsentTemplate, PersonalRisk } from "./types";

/** Sin tildes ni mayúsculas, para buscar palabras en el plan. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** ¿El plan o el diagnóstico mencionan alguno de estos patrones? (se buscan en el texto sin tildes). */
const mentions = (ctx: ConsentContext, ...patterns: RegExp[]) => {
  const text = fold(ctx.planText ?? "");
  return patterns.some((p) => p.test(text));
};

/** Precaución marcada en la anamnesis (lo detectado en el texto libre no cuenta). */
const marked = (ctx: ConsentContext) => (id: string) => ctx.precautions.includes(id);

/** ¿El motivo de consulta está en alguna de estas zonas? */
const inZone = (ctx: ConsentContext) => (...ids: string[]) => ids.some((id) => ctx.regions.includes(id));

/** Banderas rojas marcadas, para citarlas en el texto. */
const flagText = (ctx: ConsentContext) => ctx.redFlags.map((f) => f.toLowerCase()).join("; ");

/** Se queda con los textos cuya condición se cumple; el tercer valor marca la contraindicación absoluta. */
const pick = (items: [boolean, string, boolean?][]): PersonalRisk[] =>
  items.filter(([when]) => when).map(([, text, absolute]) => (absolute ? { text, absolute: true } : { text }));

const isMinor = (ctx: ConsentContext) => ctx.age !== null && ctx.age < 18;
const isOlder = (ctx: ConsentContext) => ctx.age !== null && ctx.age >= 65;

export const TEMPLATES: ConsentTemplate[] = [
  // 1. Consentimiento de base para cualquier paciente.
  {
    id: "general",
    version: "1",
    title: "Valoración y tratamiento de fisioterapia",
    summary: "Entrevista, exploración y tratamiento habitual: terapia manual, ejercicio, educación, vendajes y calor o frío.",
    written: "recommended",
    techniques: [
      { id: "valoracion", label: "Entrevista y exploración física" },
      { id: "terapia_manual", label: "Terapia manual y técnicas de tejidos blandos (masaje, movilizaciones, estiramientos)" },
      { id: "ejercicio", label: "Ejercicio terapéutico" },
      { id: "educacion", label: "Educación y consejos sobre su problema" },
      { id: "vendaje", label: "Vendaje funcional o neuromuscular" },
      { id: "termoterapia", label: "Calor o frío superficial" },
    ],
    suggest: () => "Antes de empezar el tratamiento",
    description: [
      "Primero le preguntaremos por su problema, su salud y su vida diaria. Después le exploraremos: veremos cómo se mueve, tocaremos (palparemos) la zona y haremos pruebas de movimiento, fuerza y sensibilidad. Para ello puede ser necesario que se descubra la zona; solo se descubrirá lo imprescindible y tendrá una toalla o bata para cubrirse.",
      "Puede pedir que esté presente una persona de su confianza o del centro durante la exploración y el tratamiento, y puede pedir que paremos en cualquier momento.",
      "Con lo que encontremos le explicaremos qué creemos que le ocurre y le propondremos un plan. Puede incluir técnicas con las manos sobre músculos, articulaciones y otros tejidos (masaje, movilizaciones suaves, estiramientos), ejercicios en la consulta y en casa, consejos para entender y manejar su problema, vendajes funcionales o neuromusculares y calor o frío sobre la piel.",
      "Antes de cada técnica le diremos qué vamos a hacer y por qué. Si más adelante le proponemos agujas, manipulaciones u otras técnicas con más riesgo, le daremos una hoja de información propia para cada una.",
    ],
    benefits: [
      "Entender qué le ocurre y qué puede hacer usted para mejorar.",
      "Reducir el dolor y mejorar el movimiento, la fuerza y la función.",
      "Volver a sus actividades diarias, laborales o deportivas con más seguridad.",
      "Reducir la posibilidad de que el problema vuelva.",
    ],
    expected: [
      "Cansancio o agujetas los días siguientes a los ejercicios.",
      "Un aumento leve del dolor uno o dos días después de la exploración o de las primeras sesiones, que luego se calma.",
      "Enrojecimiento de la piel tras el masaje, el calor o el frío, que se va en poco tiempo.",
      "La mejoría suele ser poco a poco y depende también de lo que usted haga en casa.",
    ],
    risks: {
      frequent: [
        "Aumento pasajero del dolor o de la rigidez tras la sesión.",
        "Pequeños moratones tras el masaje o las técnicas de presión, sobre todo si la piel es frágil.",
        "Picor o irritación de la piel por el adhesivo del vendaje.",
        "Mareo leve al cambiar de postura o al hacer ejercicio.",
      ],
      rare: [
        "Quemadura o lesión de la piel por el calor o el frío, sobre todo si la sensibilidad está alterada.",
        "Reacción alérgica al vendaje adhesivo o a las cremas.",
        "Lesión muscular o caída durante el ejercicio.",
      ],
    },
    contraindications: [
      "Síntomas que hagan pensar en un problema que no es de fisioterapia: en ese caso le pediremos que consulte antes con su médico.",
      "Calor o frío sobre heridas, infecciones, zonas con la sensibilidad alterada o con mala circulación.",
      "Vendaje adhesivo sobre heridas o piel irritada, o si tiene alergia al adhesivo.",
      "Masaje fuerte sobre una trombosis, una infección, un tumor o una fractura que no ha soldado.",
      "Cualquier técnica que usted no tolere: se adapta o se deja.",
    ],
    alternatives: [
      "Tratamiento solo con ejercicio y consejos, sin técnicas manuales.",
      "Otras técnicas de fisioterapia, que se le explicarán por separado.",
      "Tratamiento médico (medicación, infiltraciones, cirugía…), que debe valorar su médico.",
      "No hacer tratamiento por ahora y vigilar cómo evoluciona; le explicaremos qué puede pasar en ese caso.",
    ],
    personal(ctx) {
      const has = marked(ctx);
      return pick([
        [ctx.redFlags.length > 0, `Nos ha comentado algún signo de alarma (${flagText(ctx)}): puede ser necesario que le valore un médico antes de seguir; se lo explicaremos.`],
        [has("osteoporosis"), "Como tiene osteoporosis, las técnicas manuales serán suaves, sin presiones fuertes ni movimientos bruscos, y los ejercicios se adaptarán para no forzar el hueso."],
        [has("anticoagulantes"), "Como toma anticoagulantes o antiagregantes, le pueden salir moratones con más facilidad: el masaje y las técnicas de presión serán más suaves."],
        [has("coagulacion"), "Como tiene un trastorno de la coagulación, el masaje y las técnicas de presión serán suaves para evitar hematomas; avise si le sale alguno."],
        [has("embarazo"), "Como está o puede estar embarazada, se adaptarán las posturas y los ejercicios a su embarazo, y no se aplicará calor sobre el abdomen ni la zona lumbar."],
        [has("sensibilidad"), "Como tiene la sensibilidad alterada en la zona, puede no notar si el calor o el frío son excesivos: se aplicarán menos tiempo y se revisará la piel."],
        [has("diabetes"), "Como tiene diabetes, la piel puede notar peor el calor y el frío y curar más despacio: se vigilará la piel. Si hace ejercicio intenso, traiga algo de azúcar y avise si nota temblor, sudor frío o mareo."],
        [has("piel"), "Como tiene heridas, infección o problemas de piel en la zona, no se pondrán sobre ellos vendajes adhesivos, calor, frío ni cremas."],
        [has("alergia_metal"), "Como tiene alergia al látex o a metales, se usarán guantes y materiales sin látex; avise si nota picor o enrojecimiento con el vendaje."],
        [has("cardiaco"), "Como tiene una enfermedad del corazón o tensión alta, el ejercicio se aumentará poco a poco y se vigilará cómo lo tolera; avise si nota dolor en el pecho, falta de aire, palpitaciones o mareo."],
        [has("trombosis"), "Como tiene trombosis o varices importantes en la zona, no se hará masaje ni presión sobre ellas ni se aplicará calor en esa zona. Si nota la pierna o el brazo hinchado, caliente y doloroso, avise."],
        [has("cancer"), "Como tiene o ha tenido cáncer, no se aplicará masaje profundo ni calor sobre la zona afectada, y si hace falta se coordinará el tratamiento con su equipo médico."],
        [has("linfedema"), "Como tiene linfedema o le quitaron ganglios en ese brazo o pierna, se evitarán en él el calor, las presiones fuertes y los vendajes apretados."],
        [has("inmunosupresion"), "Como toma corticoides desde hace tiempo o tiene las defensas bajas, la piel y los huesos pueden ser más frágiles: las técnicas manuales serán más suaves."],
        [has("reuma"), "Como tiene una enfermedad reumática inflamatoria, en las fases de brote se usarán técnicas más suaves y no se forzarán las articulaciones inflamadas."],
      ]);
    },
  },

  // 2. Técnicas con aguja: por escrito obligado (procedimiento invasor, Ley 41/2002, art. 8.2).
  {
    id: "invasiva",
    version: "1",
    title: "Fisioterapia invasiva",
    summary: "Punción seca, electrólisis percutánea y neuromodulación percutánea.",
    written: "required",
    techniques: [
      { id: "puncion_seca", label: "Punción seca" },
      { id: "electrolisis", label: "Electrólisis percutánea (EPI/EPTE)" },
      { id: "neuromodulacion", label: "Neuromodulación percutánea" },
    ],
    suggest: (ctx) =>
      mentions(ctx, /\bpunci/, /\baguja/, /\belectrolisis/, /\bepi\b/, /\bepte\b/, /\bneuromodulacion/, /\bdry needling/)
        ? "El plan incluye punción u otra técnica con aguja"
        : null,
    description: [
      "Son técnicas en las que se introduce a través de la piel una aguja muy fina, sin ningún medicamento, parecida a las de acupuntura. En la punción seca la aguja se dirige a un punto del músculo tenso o doloroso. En la electrólisis percutánea, además, pasa por la aguja una corriente eléctrica muy pequeña para estimular la reparación de un tendón u otro tejido. En la neuromodulación percutánea la aguja se coloca cerca de un nervio y se aplica una corriente suave para cambiar el dolor o la función del músculo.",
      "Antes se limpia la piel, y se usan guantes y agujas estériles de un solo uso. A veces se usa un ecógrafo para ver por dónde va la aguja. Estará en la camilla, en una postura cómoda y segura, y la técnica suele durar pocos minutos.",
      "Es normal notar el pinchazo, un calambre o un pequeño salto del músculo. Puede pedir que paremos en cualquier momento.",
      "Como la aguja atraviesa la piel, la ley pide su consentimiento por escrito (Ley 41/2002, art. 8.2).",
    ],
    benefits: [
      "Disminuir el dolor y la tensión del músculo.",
      "Mejorar el movimiento y la función de la zona.",
      "Ayudar a la recuperación de tendones y otros tejidos con lesiones de larga evolución (electrólisis).",
      "Facilitar el ejercicio y el resto del tratamiento.",
    ],
    expected: [
      "Pinchazo y, a veces, un calambre o un pequeño salto del músculo durante la técnica.",
      "Zona dolorida o cargada, como con agujetas, durante uno a tres días; suele aliviar moverla con suavidad.",
      "Puede que ese día le pidamos evitar esfuerzos intensos con esa zona.",
    ],
    risks: {
      frequent: [
        "Dolor durante la punción y molestia en la zona (como agujetas) durante 24 a 72 horas.",
        "Pequeño hematoma (moratón) o una gota de sangre en el punto del pinchazo.",
        "Cansancio, sueño o un ligero mareo tras la sesión.",
      ],
      rare: [
        "Desmayo (síncope vasovagal) durante la técnica o justo después; por eso se hace en la camilla.",
        "Infección en el punto del pinchazo.",
        "Neumotórax: entrada de aire entre el pulmón y la pared del tórax al pinchar en el tórax, la espalda alta, el cuello o la zona del hombro y la escápula. Se nota como falta de aire o dolor en el pecho al respirar y necesita atención urgente.",
        "Lesión de un nervio o de un vaso sanguíneo, con hormigueo, dolor o un hematoma más grande, que normalmente se recupera.",
        "Pequeña quemadura de la piel por la corriente, en la electrólisis.",
        "Rotura de la aguja dentro del tejido, muy rara; podría ser necesario retirarla con una pequeña intervención.",
      ],
    },
    contraindications: [
      "Miedo intenso a las agujas, o que usted no quiera recibir la técnica.",
      "Infección, herida u otra lesión de la piel en la zona.",
      "Trastornos de la coagulación (hemofilia, plaquetas bajas…). Con anticoagulantes, solo con precauciones.",
      "Linfedema o ganglios extirpados en ese brazo o pierna.",
      "Embarazo: no se pincha la zona lumbar, el abdomen ni la pelvis.",
      "Epilepsia que no está controlada.",
      "Alergia a los metales (níquel).",
      "Marcapasos u otros implantes electrónicos, en las técnicas con corriente.",
    ],
    alternatives: [
      "Terapia manual, técnicas de tejidos blandos y ejercicio, sin aguja.",
      "Electroterapia con electrodos sobre la piel (TENS u otras).",
      "Ondas de choque, en algunos problemas de tendón.",
      "Tratamiento médico (medicación, infiltraciones), que debe valorar su médico.",
      "No aplicar esta técnica: el resto del tratamiento puede seguir igual.",
    ],
    personal(ctx) {
      const has = marked(ctx);
      const zone = inZone(ctx);
      return pick([
        [has("coagulacion"), "Como tiene un trastorno de la coagulación, el riesgo de sangrado y de hematoma con la aguja es alto: no se le debe aplicar esta técnica.", true],
        [has("anticoagulantes"), "Como toma anticoagulantes o antiagregantes, el riesgo de hematoma es mayor: se usarán menos punciones, se evitarán las zonas profundas y se presionará más tiempo después de cada una."],
        [has("linfedema"), "Como tiene linfedema o le quitaron ganglios en ese brazo o pierna, no se le debe pinchar en él, por el riesgo de infección y de que aumente la hinchazón.", true],
        [has("embarazo"), "Como está o puede estar embarazada, no se pincha la zona lumbar, el abdomen ni la pelvis, y en los tres primeros meses se evita esta técnica; en otras zonas, solo si su fisioterapeuta lo ve adecuado.", zone("lumbar", "sacroiliaca")],
        [zone("dorsal", "cervical", "hombro"), "Como la zona a tratar (cuello, espalda alta u hombro) está cerca del pulmón, hay un riesgo raro de neumotórax: se usarán zonas y direcciones de la aguja seguras y, si después nota falta de aire o dolor en el pecho al respirar, acuda a urgencias."],
        [has("agujas"), "Como le dan miedo las agujas o se ha mareado con ellas, es más fácil que se maree o se desmaye: se hará siempre en la camilla, en posición tumbada, con pocas punciones al principio, y puede pedir parar en cualquier momento."],
        [has("piel"), "Como tiene heridas, infección o problemas de piel en la zona, no se pinchará sobre ellos ni cerca."],
        [has("inmunosupresion"), "Como tiene las defensas bajas o toma corticoides desde hace tiempo, el riesgo de infección es mayor: se extremará la limpieza y se harán menos punciones. Avise si la zona se pone roja, caliente, hinchada o con pus."],
        [has("diabetes"), "Como tiene diabetes, la piel cura más despacio y se infecta con más facilidad: se extremará la limpieza. Venga habiendo comido, para evitar mareos."],
        [has("epilepsia"), "Como tiene epilepsia, avise si no está bien controlada: en ese caso no se aplicará esta técnica. Si está controlada, se hará en la camilla, en posición tumbada y vigilando en todo momento."],
        [has("alergia_metal"), "Como tiene alergia a metales o al látex, se usarán guantes sin látex y se valorará si las agujas son adecuadas para usted (el acero lleva algo de níquel); avise si nota picor, ronchas o hinchazón."],
        [has("marcapasos"), "Como lleva marcapasos u otro implante electrónico, no se aplicará corriente por la aguja (electrólisis ni neuromodulación); la punción seca sin corriente sí puede hacerse."],
        [has("metal"), "Como tiene una prótesis o material metálico en la zona, no se pinchará sobre él ni cerca, ni se aplicará corriente por la aguja en esa zona."],
        [has("cancer"), "Como tiene o ha tenido cáncer, no se pinchará en la zona del tumor ni en un brazo o pierna con riesgo de linfedema."],
        [has("sensibilidad"), "Como tiene la sensibilidad alterada en la zona, puede notar menos el pinchazo y la corriente: se usará menos intensidad en la electrólisis y la neuromodulación; avise de cualquier sensación rara."],
        [has("trombosis"), "Como tiene trombosis o varices importantes en la zona, no se pinchará sobre ellas."],
      ]);
    },
  },

  // 3. Manipulación con impulso: por escrito por sus riesgos graves, aunque sean raros.
  {
    id: "manipulacion",
    version: "1",
    title: "Manipulación articular",
    summary: "Manipulación de alta velocidad («thrust» o HVLA) de la columna y de otras articulaciones.",
    written: "required",
    techniques: [
      { id: "manip_cervical", label: "Manipulación cervical (cuello)" },
      { id: "manip_dorsal", label: "Manipulación dorsal y de costillas" },
      { id: "manip_lumbar", label: "Manipulación lumbar y sacroilíaca" },
      { id: "manip_periferica", label: "Manipulación de otras articulaciones (hombro, codo, muñeca, cadera, rodilla, tobillo o pie)" },
    ],
    suggest: (ctx) => (mentions(ctx, /\bmanipul/, /\bthrust/, /\bhvla\b/) ? "El plan incluye manipulación articular" : null),
    description: [
      "Es una técnica manual en la que el fisioterapeuta coloca la articulación en una postura concreta y hace un impulso muy rápido y corto. A menudo se oye un chasquido: es solo un cambio de presión dentro de la articulación y no quiere decir que algo «vuelva a su sitio».",
      "Antes de aplicarla le exploraremos y le haremos preguntas para descartar los casos en los que no se debe usar. Le explicaremos la postura y el movimiento, y puede pedir que paremos en cualquier momento, incluso con la técnica ya preparada.",
      "Se usa para aliviar el dolor y mejorar el movimiento, casi siempre junto con ejercicio y otras técnicas. Sus complicaciones graves son muy raras, pero por su importancia le pedimos su consentimiento por escrito.",
    ],
    benefits: [
      "Alivio del dolor a corto plazo.",
      "Más movilidad y menos rigidez en la zona.",
      "Facilitar el ejercicio y la vuelta a sus actividades.",
    ],
    expected: [
      "Un chasquido durante la técnica.",
      "Sensación de alivio o de soltura en la zona.",
      "Algo de molestia en la zona durante las horas siguientes.",
    ],
    risks: {
      frequent: [
        "Dolor o rigidez pasajeros en la zona, durante uno o dos días.",
        "Dolor de cabeza leve, sobre todo tras manipular el cuello.",
        "Cansancio o mareo leve tras la sesión.",
      ],
      rare: [
        "Lesión de una arteria del cuello (disección) que puede causar un ictus. Se ha relacionado con la manipulación del cuello y es muy rara.",
        "Fractura, sobre todo si el hueso está debilitado (osteoporosis, tumores, corticoides durante mucho tiempo).",
        "Empeoramiento de una hernia discal o compresión de la raíz de un nervio, con más dolor que baja por el brazo o la pierna, hormigueo o pérdida de fuerza.",
        "Si durante o después nota mareo intenso, visión doble, dificultad para hablar o tragar, debilidad, pérdida de sensibilidad o un dolor de cabeza o de cuello muy fuerte y distinto, pida ayuda urgente (112).",
      ],
    },
    contraindications: [
      "Signos de alarma (banderas rojas) que no se hayan descartado: fiebre, pérdida de peso sin explicación, dolor nocturno que no cede, traumatismo reciente, cambios en el control de la orina o las heces, pérdida de fuerza que avanza…",
      "Osteoporosis u otras causas de hueso frágil.",
      "Tumores o cáncer que puedan afectar al hueso.",
      "Infección del hueso o de la articulación.",
      "Inestabilidad de la columna cervical o artritis inflamatoria (artritis reumatoide, espondilitis) en el cuello.",
      "Tratamiento con anticoagulantes o trastornos de la coagulación.",
      "Problemas de las arterias del cuello, o mareo, vértigo u otros síntomas que hagan sospecharlos.",
      "Prótesis o fijaciones metálicas en esa articulación.",
      "Que usted no quiera recibirla.",
    ],
    alternatives: [
      "Movilizaciones articulares suaves y lentas, sin impulso.",
      "Técnicas de tejidos blandos y ejercicio terapéutico.",
      "Otras técnicas de fisioterapia de la hoja general.",
      "No aplicar manipulación: el resto del tratamiento puede seguir igual.",
    ],
    personal(ctx) {
      const has = marked(ctx);
      const zone = inZone(ctx);
      return pick([
        [ctx.redFlags.length > 0, `Nos ha comentado algún signo de alarma (${flagText(ctx)}): hasta que un médico lo descarte, no se le deben aplicar manipulaciones.`, true],
        [has("osteoporosis"), "Como tiene osteoporosis, el hueso es más frágil y una manipulación podría fracturarlo: no se le deben aplicar manipulaciones; se usarán técnicas suaves.", true],
        [has("cancer"), "Como tiene o ha tenido cáncer en los últimos años, el hueso podría estar afectado: no se le deben aplicar manipulaciones.", true],
        [has("cervical_vascular"), "Como ha tenido problemas en las arterias del cuello, o mareo o vértigo de origen cervical, no se le debe manipular el cuello.", zone("cervical")],
        [has("reuma"), "Como tiene artritis reumatoide u otra enfermedad reumática inflamatoria, los ligamentos del cuello pueden estar debilitados: no se le debe manipular el cuello, y en otras zonas solo se valorará si la enfermedad está tranquila.", zone("cervical")],
        [zone("cervical"), "Como la zona a tratar es el cuello, existe un riesgo muy raro pero grave de lesión de una arteria del cuello que puede causar un ictus: antes se le preguntará por síntomas de alarma y, si durante o después nota mareo intenso, visión doble, dificultad para hablar o tragar o un dolor de cabeza muy fuerte y distinto, se parará y debe pedir ayuda urgente (112)."],
        [isOlder(ctx), `Como tiene ${ctx.age} años, el hueso puede ser más frágil: se usarán técnicas más suaves y se valorará con más cuidado si conviene manipular.`],
        [has("anticoagulantes"), "Como toma anticoagulantes o antiagregantes, una pequeña lesión podría sangrar más: no se le manipulará el cuello y en otras zonas se preferirán técnicas suaves."],
        [has("coagulacion"), "Como tiene un trastorno de la coagulación, una manipulación podría provocar un sangrado dentro de la articulación: se preferirán técnicas suaves sin impulso."],
        [has("inmunosupresion"), "Como toma corticoides desde hace tiempo o tiene las defensas bajas, el hueso puede ser más frágil: se preferirán técnicas suaves sin impulso."],
        [has("embarazo"), "Como está o puede estar embarazada, sus articulaciones están más laxas: no se manipularán la zona lumbar ni la pelvis y se evitarán las posturas incómodas."],
        [has("metal"), "Como tiene una prótesis o material metálico en la zona, no se manipulará esa articulación ni ese tramo de la columna."],
      ]);
    },
  },

  // 4. Aparatos de electroterapia y otros agentes físicos.
  {
    id: "electroterapia",
    version: "1",
    title: "Electroterapia y agentes físicos",
    summary: "TENS y electroestimulación, ultrasonido, diatermia o radiofrecuencia (tecarterapia), láser y magnetoterapia.",
    written: "recommended",
    techniques: [
      { id: "tens", label: "TENS y electroestimulación" },
      { id: "ultrasonido", label: "Ultrasonido" },
      { id: "diatermia", label: "Diatermia y radiofrecuencia (tecarterapia)" },
      { id: "laser", label: "Láser" },
      { id: "magnetoterapia", label: "Magnetoterapia" },
    ],
    suggest: (ctx) =>
      mentions(ctx, /\btens\b/, /\belectro(?!lisis|puncion|miograf)/, /\bultrason/, /\bdiatermia/, /\btecar/, /\bradiofrecuencia/, /\blaser/, /\bmagneto/)
        ? "El plan incluye electroterapia u otros agentes físicos"
        : null,
    description: [
      "Son técnicas que usan aparatos para aplicar sobre la piel una corriente eléctrica suave (TENS, electroestimulación), vibraciones de sonido que no se oyen (ultrasonido), calor profundo (diatermia o radiofrecuencia, también llamada tecarterapia), luz (láser) o campos magnéticos (magnetoterapia).",
      "Se usan para aliviar el dolor, ayudar a contraer un músculo o acompañar la recuperación de los tejidos, casi siempre junto con ejercicio y otras técnicas. La intensidad se ajusta a lo que usted nota: debe resultarle cómoda.",
      "Avise enseguida si nota quemazón, calor excesivo, dolor o cualquier sensación rara: se parará o se bajará la intensidad. Con el láser se usan gafas de protección.",
    ],
    benefits: [
      "Alivio del dolor durante y después de la sesión.",
      "Ayuda para activar y fortalecer músculos débiles.",
      "Relajación muscular y alivio por el calor.",
      "Complemento del ejercicio y de la terapia manual.",
    ],
    expected: [
      "Hormigueo o pequeñas contracciones del músculo con la corriente.",
      "Sensación de calor suave con la diatermia o el ultrasonido.",
      "Enrojecimiento de la piel bajo los electrodos, que se va en poco tiempo.",
    ],
    risks: {
      frequent: [
        "Irritación o enrojecimiento de la piel por los electrodos o el gel.",
        "Molestia o cansancio muscular tras la electroestimulación.",
      ],
      rare: [
        "Quemadura de la piel, más probable si la sensibilidad está alterada o si hay metal en la zona (diatermia).",
        "Daño en los ojos si se mira el láser sin protección.",
        "Mareo o bajada de tensión.",
        "Interferencia con un marcapasos u otro implante electrónico.",
      ],
    },
    contraindications: [
      "Marcapasos, desfibrilador u otros implantes electrónicos.",
      "Embarazo: no se aplican sobre el abdomen, la pelvis ni la zona lumbar, y la diatermia en ningún sitio.",
      "Cáncer en la zona a tratar.",
      "Trombosis o flebitis en la zona.",
      "Material metálico en la zona, con la diatermia y la radiofrecuencia.",
      "Sensibilidad alterada en la zona, sobre todo con las técnicas de calor.",
      "Epilepsia, en la cabeza y el cuello.",
      "Heridas, infección o piel dañada en la zona.",
      "Láser sobre los ojos, y corrientes sobre la parte delantera del cuello o sobre el pecho.",
    ],
    alternatives: [
      "Terapia manual y ejercicio sin aparatos.",
      "Calor o frío superficial.",
      "Otra técnica de esta misma hoja, si alguna no está indicada en su caso.",
      "No aplicarlas: el resto del tratamiento puede seguir igual.",
    ],
    personal(ctx) {
      const has = marked(ctx);
      return pick([
        [has("marcapasos"), "Como lleva marcapasos, desfibrilador u otro implante electrónico, no se le deben aplicar corrientes, diatermia ni magnetoterapia, porque pueden alterar su funcionamiento; el láser y el ultrasonido, solo lejos del aparato.", true],
        [has("embarazo"), "Como está o puede estar embarazada, no se aplicará diatermia ni radiofrecuencia en ningún sitio, ni ninguna de estas técnicas sobre el abdomen, la pelvis o la zona lumbar."],
        [has("cancer"), "Como tiene o ha tenido cáncer, no se aplicarán estas técnicas sobre la zona del tumor ni cerca de ella."],
        [has("trombosis"), "Como tiene trombosis o varices importantes en la zona, no se aplicarán sobre ellas calor profundo, ultrasonido ni electroestimulación."],
        [has("metal"), "Como tiene una prótesis o material metálico en la zona, no se aplicará diatermia ni radiofrecuencia sobre ella, porque el metal se calienta y puede quemar por dentro."],
        [has("sensibilidad"), "Como tiene la sensibilidad alterada en la zona, puede no notar si la corriente o el calor son excesivos: se usará menos intensidad, se revisará la piel y no se aplicará calor profundo donde no note bien el calor."],
        [has("epilepsia"), "Como tiene epilepsia, no se aplicarán corrientes, láser ni magnetoterapia en la cabeza ni en el cuello."],
        [has("piel"), "Como tiene heridas o problemas de piel en la zona, no se pondrán electrodos ni se aplicará calor sobre ellos."],
        [has("diabetes"), "Como tiene diabetes, la piel puede notar peor el calor y curar más despacio: se usará menos intensidad y se revisará la piel durante y después."],
        [has("linfedema"), "Como tiene linfedema o le quitaron ganglios en ese brazo o pierna, no se aplicará calor profundo en él."],
        [has("cardiaco"), "Como tiene una enfermedad del corazón, no se pondrán electrodos sobre el pecho ni sobre la parte delantera del cuello."],
        [has("alergia_metal"), "Como tiene alergia a metales o al látex, avise si nota picor o ronchas bajo los electrodos; se usarán electrodos y materiales adecuados."],
        [isMinor(ctx), "Como es menor de edad y sus huesos aún crecen, no se aplicarán ultrasonido ni calor profundo sobre los cartílagos de crecimiento, que están cerca de las articulaciones."],
      ]);
    },
  },

  // 5. Ondas de choque.
  {
    id: "ondas_choque",
    version: "1",
    title: "Ondas de choque",
    summary: "Ondas de choque radiales o focales sobre tendones, músculos o fascia.",
    written: "recommended",
    techniques: [
      { id: "ondas_radiales", label: "Ondas de choque radiales" },
      { id: "ondas_focales", label: "Ondas de choque focales" },
    ],
    suggest: (ctx) => (mentions(ctx, /\bondas\b/) ? "El plan incluye ondas de choque" : null),
    description: [
      "Consiste en aplicar sobre la piel, con un aparato y un gel, impulsos de presión (ondas acústicas) que llegan a los tejidos de debajo. Las ondas radiales se reparten por una zona más amplia y superficial; las focales se concentran en un punto más profundo.",
      "Se usan sobre todo en problemas de tendón, de fascia (como la de la planta del pie) o en calcificaciones que llevan tiempo sin mejorar. Suelen hacerse varias sesiones separadas por días, junto con ejercicio.",
      "La intensidad se ajusta a lo que usted tolera. Es normal que moleste durante la aplicación; avise si el dolor es demasiado fuerte.",
    ],
    benefits: [
      "Disminuir el dolor en problemas de tendón y fascia de larga evolución.",
      "Ayudar a la recuperación de los tejidos.",
      "Mejorar la función y facilitar el ejercicio.",
    ],
    expected: [
      "Dolor o molestia durante la aplicación.",
      "Enrojecimiento de la piel durante unas horas.",
      "Más sensibilidad o molestia en la zona durante uno o dos días.",
    ],
    risks: {
      frequent: [
        "Dolor durante la aplicación.",
        "Enrojecimiento de la piel.",
        "Pequeño hematoma o puntitos rojos en la piel (petequias).",
        "Inflamación o molestia pasajera en la zona.",
      ],
      rare: [
        "Rotura de un tendón que ya estaba muy deteriorado.",
        "Hormigueo o adormecimiento pasajero si hay un nervio cerca.",
      ],
    },
    contraindications: [
      "Tratamiento con anticoagulantes o trastornos de la coagulación.",
      "Embarazo.",
      "Cáncer en la zona a tratar.",
      "Infección en la zona.",
      "Cartílagos de crecimiento en la zona (niños y adolescentes).",
      "Zonas con aire, como el pulmón: no se dirigen hacia el tórax.",
      "Infiltración de corticoides en la zona hace poco (en general, en las últimas 6 semanas).",
    ],
    alternatives: [
      "Ejercicio específico para el tendón, que es la base del tratamiento.",
      "Terapia manual, electroterapia o fisioterapia invasiva.",
      "Tratamiento médico (medicación, infiltraciones, cirugía), que debe valorar su médico.",
      "No aplicarlas: el resto del tratamiento puede seguir igual.",
    ],
    personal(ctx) {
      const has = marked(ctx);
      const zone = inZone(ctx);
      return pick([
        [has("embarazo"), "Como está o puede estar embarazada, no se le deben aplicar ondas de choque.", true],
        [has("coagulacion"), "Como tiene un trastorno de la coagulación, el riesgo de sangrado es alto: no se le deben aplicar ondas de choque.", true],
        [has("anticoagulantes"), "Como toma anticoagulantes o antiagregantes, es más fácil que salga un hematoma: se usará menos intensidad y, si toma anticoagulantes, solo se aplicarán si su médico lo ve adecuado."],
        [isMinor(ctx), "Como es menor de edad y sus huesos aún crecen, no se aplicarán sobre los cartílagos de crecimiento, que están cerca de las articulaciones."],
        [has("cancer"), "Como tiene o ha tenido cáncer, no se aplicarán sobre la zona del tumor ni cerca de ella."],
        [has("inmunosupresion"), "Como toma corticoides desde hace tiempo o tiene las defensas bajas, el tendón puede estar más débil: se usará menos intensidad. Si le han infiltrado corticoides en la zona hace poco, avísenos: conviene esperar."],
        [zone("dorsal"), "Como la zona a tratar es la espalda alta, las ondas no se dirigirán hacia el tórax, para no afectar al pulmón."],
        [has("piel"), "Como tiene heridas, infección o problemas de piel en la zona, no se aplicarán sobre ellos."],
        [has("trombosis"), "Como tiene trombosis o varices importantes en la zona, no se aplicarán sobre ellas."],
        [has("marcapasos"), "Como lleva marcapasos u otro implante electrónico, no se aplicarán cerca del aparato ni sobre el pecho."],
        [has("metal"), "Como tiene una prótesis o material metálico en la zona, no se aplicarán directamente sobre él."],
        [has("sensibilidad"), "Como tiene la sensibilidad alterada en la zona, notará menos la molestia que sirve de guía: se usará menos intensidad."],
      ]);
    },
  },

  // 6. Suelo pélvico con exploración por dentro: por escrito (intracavitario e íntimo).
  {
    id: "suelo_pelvico",
    version: "1",
    title: "Fisioterapia de suelo pélvico",
    summary: "Exploración y tratamiento del suelo pélvico, también por dentro (vía vaginal o anal).",
    written: "required",
    techniques: [
      { id: "externa", label: "Exploración y tratamiento por fuera" },
      { id: "vaginal", label: "Exploración y tratamiento por vía vaginal" },
      { id: "anal", label: "Exploración y tratamiento por vía anal" },
      { id: "biofeedback", label: "Biofeedback con sonda o sensores" },
      { id: "electroestimulacion", label: "Electroestimulación con sonda" },
    ],
    suggest: (ctx) =>
      mentions(ctx, /suelo pelvico/, /\bintracavit/, /\bperine/) ? "El plan incluye fisioterapia de suelo pélvico" : null,
    description: [
      "El suelo pélvico son los músculos y tejidos que cierran la pelvis por abajo. Ayudan a controlar la orina, los gases y las heces, intervienen en la función sexual y sostienen los órganos de la pelvis. Para valorarlo bien, además de mirar y explorar por fuera, muchas veces hay que explorarlo por dentro, con uno o dos dedos introducidos en la vagina o en el ano.",
      "Siempre se le explicará antes cada paso y se le pedirá permiso para seguir. Se usan guantes desechables y lubricante. Puede pedir que esté presente una persona de su confianza o del centro, y puede pedir que paremos en cualquier momento, sin tener que dar explicaciones.",
      "El tratamiento puede incluir ejercicios de estos músculos, técnicas manuales por fuera y por dentro, biofeedback (un sensor que le muestra en una pantalla cómo contrae los músculos) y electroestimulación con una sonda.",
      "Por ser una exploración íntima y por dentro del cuerpo le pedimos su consentimiento por escrito. Puede aceptar unas técnicas y no otras.",
    ],
    benefits: [
      "Saber cómo están los músculos de su suelo pélvico y qué tratamiento le conviene.",
      "Mejorar los escapes de orina, gases o heces, la sensación de peso o el dolor pélvico.",
      "Mejorar la función sexual y la calidad de vida.",
      "Aprender a contraer y relajar bien estos músculos por su cuenta.",
    ],
    expected: [
      "Sensación de presión o molestia durante la exploración por dentro.",
      "Ganas de orinar o de ir al baño durante la exploración o después.",
      "Ligera molestia en la zona durante unas horas.",
    ],
    risks: {
      frequent: [
        "Molestia o dolor leve durante la exploración o después.",
        "Pequeño sangrado, sobre todo si la mucosa está seca o frágil.",
      ],
      rare: [
        "Infección de orina.",
        "Reacción al lubricante, a los guantes o a la sonda.",
        "Malestar emocional, sobre todo si ha vivido situaciones difíciles relacionadas con esta zona; puede parar la exploración cuando quiera.",
      ],
    },
    contraindications: [
      "Infección de orina o vaginal en este momento.",
      "Sangrado vaginal o rectal sin diagnóstico.",
      "Menos de 6 semanas desde el parto sin la revisión de su médico o matrona.",
      "Embarazo, según lo que indique su médico o matrona.",
      "Que usted no dé su consentimiento o no pueda entender lo que se le explica.",
      "Electroestimulación con sonda: marcapasos u otros implantes electrónicos.",
    ],
    alternatives: [
      "Valoración y tratamiento solo por fuera (observación, palpación externa y ejercicios).",
      "Ecografía por fuera, si el centro dispone de ella.",
      "Ejercicios guiados y consejos sin exploración por dentro.",
      "Valoración por su médico, ginecólogo, urólogo o matrona.",
      "No hacer este tratamiento.",
    ],
    personal(ctx) {
      const has = marked(ctx);
      const sphincters = ctx.redFlags.some((f) => fold(f).includes("esfinter"));
      return pick([
        [sphincters, "Nos ha comentado cambios en el control de la orina o las heces, o falta de sensibilidad en la zona que toca un sillín: si es algo nuevo, debe verle un médico con urgencia antes de seguir."],
        [has("embarazo"), "Como está o puede estar embarazada, la exploración y el tratamiento por dentro solo se harán si su médico o su matrona lo ven adecuado, y siempre con suavidad."],
        [isMinor(ctx), "Como es menor de edad, la exploración por dentro solo se hará si es imprescindible, con su madre, padre o representante informado y, si lo desea, presente."],
        [ctx.sex === "male", "En su caso, la exploración y el tratamiento por dentro se harían por vía anal: es normal notar ganas de ir al baño durante la exploración."],
        [has("alergia_metal"), "Como tiene alergia al látex o a metales, se usarán guantes y materiales sin látex y se comprobará que la sonda no lleve metales a los que tenga alergia."],
        [has("anticoagulantes"), "Como toma anticoagulantes o antiagregantes, es más fácil un pequeño sangrado: la exploración será especialmente suave."],
        [has("coagulacion"), "Como tiene un trastorno de la coagulación, es más fácil un pequeño sangrado: la exploración será especialmente suave y se valorará con su médico si conviene hacerla."],
        [has("piel"), "Como tiene heridas, infección o problemas de piel en la zona, se esperará a que estén curados antes de la exploración por dentro."],
        [has("marcapasos"), "Como lleva marcapasos u otro implante electrónico, no se usará electroestimulación con sonda."],
        [has("cancer"), "Como tiene o ha tenido cáncer, si fue en la pelvis o recibió radioterapia en ella, los tejidos pueden ser más frágiles: la exploración será más suave y se coordinará con su equipo médico."],
        [has("inmunosupresion"), "Como tiene las defensas bajas, es más fácil una infección de orina: se extremará la higiene; avise si nota escozor al orinar o fiebre."],
        [has("sensibilidad"), "Como tiene la sensibilidad alterada en la zona, puede notar menos la presión: avise de cualquier sensación rara; la electroestimulación se hará con menos intensidad."],
      ]);
    },
  },

  // 7. Pruebas de rendimiento (saltos, fuerza, sprint…), con la cámara del móvil si hace falta.
  {
    id: "rendimiento",
    version: "1",
    title: "Pruebas de valoración física y de rendimiento",
    summary: "Saltos, fuerza máxima y velocidad de la barra, sprint, nórdico de isquiotibiales y carrera, a veces medidos con la cámara.",
    written: "recommended",
    techniques: [
      { id: "saltos", label: "Saltos" },
      { id: "fuerza", label: "Fuerza máxima y velocidad de la barra" },
      { id: "sprint", label: "Sprint" },
      { id: "nordico", label: "Nórdico de isquiotibiales" },
      { id: "carrera", label: "Análisis de la carrera" },
    ],
    suggest: (ctx) => {
      if (ctx.hasPerformanceTests) return "Tiene mediciones de rendimiento (saltos, fuerza, sprint…)";
      return mentions(ctx, /\bsalto/, /\bsaltar/, /\bfuerza/, /\bsprint/, /\breadaptacion/, /vuelta al deporte/)
        ? "El plan incluye fuerza, saltos, sprint o vuelta al deporte"
        : null;
    },
    description: [
      "Son pruebas para medir su estado físico: la altura de sus saltos, su fuerza, la velocidad con la que mueve una carga, su velocidad en una carrera corta (sprint), la fuerza de la parte de atrás del muslo (ejercicio nórdico) o su forma de correr.",
      "Sirven para comparar un lado con el otro, ver cómo progresa y decidir cuándo puede volver a su deporte o actividad con seguridad. Antes de cada prueba se hace un calentamiento, se le explica cómo hacerla y se respeta su ritmo.",
      "Para medir, la aplicación puede usar la cámara del móvil o de la tableta. El vídeo solo se usa para calcular la medida y no se guarda: se guardan los resultados (por ejemplo, la altura del salto).",
      "Algunas pruebas piden un esfuerzo máximo. Puede parar cuando quiera, y debe avisar si nota dolor, mareo o cualquier cosa rara.",
    ],
    benefits: [
      "Conocer su punto de partida y ver su progreso con datos.",
      "Detectar diferencias entre un lado y otro o puntos débiles.",
      "Ajustar mejor el ejercicio y las cargas.",
      "Decidir con más seguridad la vuelta al deporte.",
    ],
    expected: [
      "Cansancio durante las pruebas y después.",
      "Agujetas uno o dos días después, sobre todo tras el nórdico o las pruebas de fuerza.",
    ],
    risks: {
      frequent: ["Agujetas.", "Fatiga.", "Mareo tras un esfuerzo intenso."],
      rare: [
        "Lesión muscular o de tendón (por ejemplo, un tirón en la parte de atrás del muslo).",
        "Caída o golpe al saltar, correr o mover una carga.",
        "Muy rara vez, un problema del corazón durante un esfuerzo máximo.",
      ],
    },
    contraindications: [
      "Dolor agudo o una lesión sin el alta para hacer esfuerzos.",
      "Enfermedad del corazón o tensión alta sin controlar.",
      "Fiebre o malestar general.",
      "Dolor en el pecho, falta de aire o mareo con los esfuerzos.",
    ],
    alternatives: [
      "Pruebas más suaves, sin llegar a la carga máxima (se estima a partir de cargas menores).",
      "Valoración clínica sin pruebas de rendimiento.",
      "Medir sin cámara, con otros métodos.",
      "No hacer las pruebas.",
    ],
    personal(ctx) {
      const has = marked(ctx);
      return pick([
        [ctx.redFlags.length > 0, `Nos ha comentado algún signo de alarma (${flagText(ctx)}): no se harán pruebas de esfuerzo máximo hasta que lo valore un médico.`],
        [has("cardiaco"), "Como tiene una enfermedad del corazón o tensión alta, no se harán pruebas de esfuerzo máximo sin el visto bueno de su médico; se pararán si nota dolor en el pecho, falta de aire, palpitaciones o mareo."],
        [has("osteoporosis"), "Como tiene osteoporosis, no se harán pruebas de fuerza máxima ni saltos de mucho impacto; se usarán versiones adaptadas."],
        [has("embarazo"), "Como está o puede estar embarazada, no se harán pruebas de esfuerzo máximo, de impacto ni con riesgo de caída o de golpe en el abdomen."],
        [has("anticoagulantes") || has("coagulacion"), "Como toma anticoagulantes o tiene un trastorno de la coagulación, un golpe o una caída pueden causar un hematoma mayor: se evitarán las pruebas con riesgo de caída."],
        [has("diabetes"), "Como tiene diabetes, traiga algo de azúcar y avise si nota temblor, sudor frío o mareo: pueden ser una bajada de azúcar."],
        [has("epilepsia"), "Como tiene epilepsia, avise si ha tenido crisis hace poco; mientras no esté controlada se evitarán las pruebas con riesgo de caída."],
        [has("metal"), "Como tiene una prótesis o material metálico, se adaptarán las pruebas de impacto y de fuerza máxima que carguen esa zona."],
        [isOlder(ctx), `Como tiene ${ctx.age} años, las pruebas se adaptarán (sin fuerza máxima directa ni saltos de mucha altura) y se cuidará el equilibrio para evitar caídas.`],
        [isMinor(ctx), "Como es menor de edad, las pruebas de fuerza se harán con cargas adecuadas a su edad y con la técnica siempre supervisada."],
      ]);
    },
  },

  // 8. Fisioterapia a distancia.
  {
    id: "telefisio",
    version: "1",
    title: "Telefisioterapia",
    summary: "Valoración y seguimiento por videollamada, y ejercicios a distancia.",
    written: "recommended",
    techniques: [
      { id: "videollamada", label: "Valoración y seguimiento por videollamada" },
      { id: "ejercicios", label: "Programa de ejercicios a distancia" },
      { id: "seguimiento", label: "Seguimiento por teléfono o mensajes" },
    ],
    suggest: (ctx) =>
      mentions(ctx, /\btelefisio/, /\btelerehab/, /\bvideollamada/, /\bonline\b/, /\ba distancia\b/) ? "El plan incluye sesiones a distancia" : null,
    description: [
      "Es la fisioterapia a distancia: hablamos con usted y le vemos por videollamada para valorar cómo está, enseñarle ejercicios y hacer el seguimiento, y le enviamos un programa de ejercicios para hacer en casa.",
      "Tiene límites: no podemos explorarle con las manos ni aplicar técnicas manuales, y algunas pruebas no se pueden hacer. Si creemos que necesita una visita en persona, se lo diremos.",
      "Usamos una conexión segura. Busque un lugar tranquilo y privado, con espacio para moverse y buena luz. Nadie grabará la videollamada sin el permiso de los dos: ni nosotros ni usted.",
      "Si algo empeora entre sesiones, deje el ejercicio que le molesta y contacte con nosotros. Si tiene síntomas graves (dolor en el pecho, falta de aire, pérdida de fuerza o de sensibilidad que avanza, o una caída con un golpe fuerte), llame al 112 o acuda a urgencias.",
    ],
    benefits: [
      "No tener que desplazarse.",
      "Seguimiento más frecuente y cómodo.",
      "Aprender a manejar su problema en su propio entorno.",
    ],
    expected: [
      "Agujetas o cansancio tras los ejercicios.",
      "Algún corte o fallo de imagen o de sonido en la conexión.",
    ],
    risks: {
      frequent: [
        "Problemas de conexión que obliguen a cambiar la cita.",
        "Molestias o agujetas por hacer los ejercicios sin que le corrijamos en persona.",
      ],
      rare: [
        "Caída o lesión al hacer los ejercicios en casa.",
        "Que a distancia no se detecte un problema que se vería en una exploración en persona.",
        "Que otras personas accedan a la información, aunque usamos medios seguros.",
      ],
    },
    contraindications: [
      "Cuando hace falta explorarle con las manos o un tratamiento en persona.",
      "Síntomas nuevos, graves o que empeoran rápido, que necesitan una valoración en persona o médica.",
      "No tener un lugar seguro para hacer los ejercicios o la conexión necesaria.",
    ],
    alternatives: [
      "Sesiones presenciales en el centro.",
      "Programa de ejercicios por escrito, sin videollamada.",
      "Combinar sesiones presenciales y a distancia.",
      "No hacer el seguimiento a distancia.",
    ],
    personal(ctx) {
      const has = marked(ctx);
      return pick([
        [ctx.redFlags.length > 0, `Nos ha comentado algún signo de alarma (${flagText(ctx)}): necesita una valoración en persona o por un médico; la videollamada no la sustituye.`],
        [isMinor(ctx), "Como es menor de edad, durante las videollamadas debe estar en casa su madre, padre o representante."],
        [isOlder(ctx), `Como tiene ${ctx.age} años, haga los ejercicios con un apoyo estable cerca, en un espacio despejado y, si puede, con alguien en casa.`],
        [has("osteoporosis"), "Como tiene osteoporosis, una caída es más peligrosa: haga los ejercicios con un apoyo estable cerca y en un espacio despejado."],
        [has("cardiaco"), "Como tiene una enfermedad del corazón o tensión alta, tenga el teléfono a mano durante los ejercicios y pare si nota dolor en el pecho, falta de aire o mareo; si no se pasa, llame al 112."],
        [has("epilepsia"), "Como tiene epilepsia, conviene que haya alguien en casa mientras hace los ejercicios."],
        [has("diabetes"), "Como tiene diabetes, tenga algo de azúcar a mano durante los ejercicios."],
      ]);
    },
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

/** Derechos del paciente: van al final de todos los documentos. */
const RIGHTS = [
  "Puede preguntar todo lo que necesite antes de firmar, y también después, durante el tratamiento.",
  "Puede negarse a este tratamiento o retirar este consentimiento en cualquier momento, por escrito y sin dar explicaciones, sin que eso afecte a la atención que recibe (Ley 41/2002, art. 8.5).",
  "Recibirá una copia de este documento.",
  "Puede pedir que esté presente un acompañante de su confianza o del centro durante la exploración y el tratamiento.",
];

/** «Punción seca» → «punción seca», pero «TENS…» se queda igual. */
const lowerFirst = (s: string) => (/^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/**
 * Apartados del documento, en orden. `techniques` son los ids de las técnicas marcadas (un texto que no sea un id
 * se copia tal cual). El apartado de riesgos personales solo sale si hay alguno. Los arrays son copias: el
 * documento firmado no comparte nada con la plantilla.
 */
export function buildSections(t: ConsentTemplate, ctx: ConsentContext, techniques: string[]): { title: string; items: string[] }[] {
  const labels = [...new Set(techniques)].map((id) => t.techniques.find((x) => x.id === id)?.label ?? id).filter((l) => l.trim() !== "");
  const what = [...t.description];
  if (labels.length > 0) what.push(`Técnicas que se van a usar en su caso: ${labels.map(lowerFirst).join("; ")}.`);
  const sections = [
    { title: "Qué es y cómo se hace", items: what },
    { title: "Para qué sirve", items: t.benefits },
    { title: "Lo que es normal notar", items: t.expected },
    { title: "Riesgos frecuentes", items: t.risks.frequent },
    { title: "Riesgos poco frecuentes pero importantes", items: t.risks.rare },
    { title: "Riesgos por sus circunstancias", items: t.personal(ctx).map((r) => r.text) },
    { title: "Cuándo no se debe aplicar", items: t.contraindications },
    { title: "Alternativas", items: t.alternatives },
    { title: "Sus derechos", items: RIGHTS },
  ];
  return sections.filter((s) => s.items.length > 0).map((s) => ({ title: s.title, items: [...s.items] }));
}
