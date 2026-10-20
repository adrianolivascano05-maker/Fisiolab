// Plantillas de consentimiento informado (tipos en ./types.ts).
//
// AVISO: estos textos son un MODELO DE TRABAJO. No están validados clínica ni legalmente. Antes de usarlos con
// pacientes hay que revisarlos con el Colegio de Fisioterapeutas y con la asesoría jurídica del centro, y
// adaptarlos a las técnicas que de verdad se aplican. Al cambiar un texto, sube su `version`.
//
// Cinco documentos cortos, uno por familia de técnicas («Tratamientos invasivos, como la punción seca… etc.»). Cada
// uno dice qué es, sus riesgos, cuándo no se aplica y las alternativas (Ley 41/2002, art. 10). `personal` añade lo
// del paciente a partir de lo MARCADO en la anamnesis (`ctx.precautions`, zonas, edad, sexo, banderas rojas). Lo
// que solo se ha detectado en el texto libre (`ctx.detected`) no genera texto para el paciente: la pantalla avisa
// de ello al fisioterapeuta, que decide si marcarlo.
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
  // 1. De base, para cualquier paciente.
  {
    id: "general",
    version: "3",
    title: "Valoración y tratamiento de fisioterapia",
    summary: "Exploración, pruebas físicas, terapia manual, ejercicio, vendajes, calor o frío, etc.",
    written: "recommended",
    techniques: [
      { id: "valoracion", label: "Exploración y pruebas físicas (movilidad, fuerza, saltos, carrera…)" },
      { id: "terapia_manual", label: "Terapia manual (masaje, movilizaciones, estiramientos…)" },
      { id: "ejercicio", label: "Ejercicio terapéutico" },
      { id: "vendaje", label: "Vendajes" },
      { id: "termoterapia", label: "Calor o frío" },
    ],
    suggest: () => "Antes de empezar el tratamiento",
    description: [
      "Le preguntaremos por su problema y le exploraremos: cómo se mueve, cómo está la zona al tocarla y pruebas físicas como de movilidad, fuerza, saltos o carrera, etc. Algunas pruebas se pueden medir con la cámara del móvil o de la tableta: el vídeo no se guarda, solo el resultado.",
      "Después le propondremos un tratamiento, que puede incluir terapia manual (masaje, movilizaciones, estiramientos…), ejercicio, consejos, vendajes, calor o frío, etc. Antes de cada técnica le diremos qué vamos a hacer.",
    ],
    risks: [
      "Aumento pasajero del dolor, rigidez o agujetas después de la sesión o de las pruebas.",
      "Pequeños moratones, enrojecimiento o picor de la piel por el masaje, el vendaje, el calor o el frío.",
      "Rara vez: mareo, una lesión muscular o una caída durante el ejercicio o las pruebas, o una quemadura por el calor o el frío.",
    ],
    contraindications: [
      "Síntomas que hagan pensar en un problema que no es de fisioterapia: le pediremos que antes le vea su médico.",
      "Calor, frío o vendajes sobre heridas, infecciones o piel que no siente bien.",
      "Pruebas de esfuerzo máximo con una enfermedad del corazón sin controlar o una lesión reciente.",
      "Cualquier técnica que usted no tolere: se adapta o se deja.",
    ],
    alternatives: ["Tratamiento solo con ejercicio y consejos, otras técnicas, tratamiento médico o no hacer tratamiento por ahora."],
    personal(ctx) {
      const has = marked(ctx);
      return pick([
        [ctx.redFlags.length > 0, `Nos ha comentado algún signo de alarma (${flagText(ctx)}): puede que deba verle un médico antes de seguir.`],
        [has("osteoporosis"), "Como tiene osteoporosis, las técnicas manuales y las pruebas serán suaves, sin presiones fuertes, saltos de mucho impacto ni fuerza máxima."],
        [has("anticoagulantes") || has("coagulacion"), "Como toma anticoagulantes o tiene un trastorno de la coagulación, le pueden salir moratones con más facilidad: el masaje y la presión serán suaves."],
        [has("embarazo"), "Como está o puede estar embarazada, se adaptarán las posturas y los ejercicios, y no se aplicará calor sobre el abdomen ni la zona lumbar."],
        [has("cardiaco"), "Como tiene una enfermedad del corazón o tensión alta, el esfuerzo se aumentará poco a poco y no se harán pruebas de esfuerzo máximo sin el visto bueno de su médico."],
        [has("diabetes"), "Como tiene diabetes, se vigilará la piel con el calor y el frío; si va a hacer ejercicio, traiga algo de azúcar."],
        [has("sensibilidad"), "Como tiene la sensibilidad alterada, puede no notar si el calor o el frío son excesivos: se aplicarán menos tiempo."],
        [has("piel"), "Como tiene heridas o problemas de piel en la zona, no se pondrán sobre ellos vendajes, calor, frío ni cremas."],
        [has("trombosis"), "Como tiene trombosis o varices importantes, no se hará masaje ni se aplicará calor sobre ellas."],
        [has("cancer"), "Como tiene o ha tenido cáncer, no se hará masaje profundo ni se aplicará calor sobre la zona afectada."],
        [has("linfedema"), "Como tiene linfedema o le quitaron ganglios en ese brazo o pierna, se evitarán en él el calor, las presiones fuertes y los vendajes apretados."],
        [isMinor(ctx), "Como es menor de edad, su madre, padre o representante pueden estar presentes en las sesiones."],
      ]);
    },
  },

  // 2. Con aguja: por escrito obligado (procedimiento invasor, Ley 41/2002, art. 8.2).
  {
    id: "invasiva",
    version: "3",
    title: "Tratamientos invasivos",
    summary: "Punción seca, electrólisis percutánea, neuromodulación percutánea, etc.",
    written: "required",
    techniques: [
      { id: "puncion_seca", label: "Punción seca" },
      { id: "electrolisis", label: "Electrólisis percutánea" },
      { id: "neuromodulacion", label: "Neuromodulación percutánea" },
    ],
    suggest: (ctx) =>
      mentions(ctx, /\bpunci/, /\baguja/, /\belectrolisis/, /\bepi\b/, /\bepte\b/, /\bneuromodulacion(?! (transcutanea|superficial|no invasiva))/, /\bdry needling/)
        ? "El plan incluye punción u otra técnica con aguja"
        : null,
    description: [
      "Son técnicas en las que se introduce una aguja muy fina a través de la piel, sin medicamento, como la punción seca, la electrólisis percutánea (con una corriente muy pequeña por la aguja) o la neuromodulación percutánea, etc. Se usan agujas estériles de un solo uso y se hacen con usted en la camilla.",
      "Es normal notar el pinchazo, un calambre o un pequeño salto del músculo. Como la aguja atraviesa la piel, la ley pide su consentimiento por escrito.",
    ],
    risks: [
      "Dolor durante la punción y la zona dolorida, como con agujetas, de uno a tres días.",
      "Un pequeño moratón o una gota de sangre en el pinchazo.",
      "Mareo y, rara vez, desmayo.",
      "Muy rara vez: infección, lesión de un nervio o de un vaso, o una pequeña quemadura por la corriente.",
      "Muy rara vez, al pinchar en el cuello, la espalda alta o el hombro: neumotórax (entra aire alrededor del pulmón). Si después nota falta de aire o dolor en el pecho al respirar, acuda a urgencias.",
    ],
    contraindications: [
      "Trastornos de la coagulación, o linfedema en ese brazo o pierna.",
      "Heridas o infección en la zona, o fiebre.",
      "Embarazo: no se pincha la zona lumbar, el abdomen ni la pelvis.",
      "Con corriente: marcapasos u otros implantes electrónicos, o metal en la zona.",
      "Miedo intenso a las agujas, o que usted no quiera.",
    ],
    alternatives: ["Terapia manual, ejercicio o electroterapia sin aguja, tratamiento médico o no aplicar esta técnica: el resto del tratamiento sigue igual."],
    personal(ctx) {
      const has = marked(ctx);
      const zone = inZone(ctx);
      return pick([
        [has("coagulacion"), "Como tiene un trastorno de la coagulación, no se le debe aplicar esta técnica por el riesgo de sangrado.", true],
        [has("linfedema"), "Como tiene linfedema o le quitaron ganglios en ese brazo o pierna, no se le debe pinchar en él.", true],
        [has("anticoagulantes"), "Como toma anticoagulantes o antiagregantes, es más fácil que salga un moratón: se harán menos punciones, no profundas, y se presionará después."],
        [has("embarazo"), "Como está o puede estar embarazada, no se pincha la zona lumbar, el abdomen ni la pelvis, y en los tres primeros meses se evita esta técnica.", zone("lumbar", "sacroiliaca")],
        [zone("dorsal", "cervical", "hombro"), "Como la zona a tratar está cerca del pulmón, hay un riesgo raro de neumotórax: se pinchará solo en direcciones seguras."],
        [has("agujas"), "Como le dan miedo las agujas o se ha mareado con ellas, se hará tumbado y con pocas punciones al principio."],
        [has("inmunosupresion") || has("diabetes"), "Como tiene diabetes o las defensas bajas, el riesgo de infección es mayor: se extremará la limpieza."],
        [has("epilepsia"), "Como tiene epilepsia, si no está bien controlada no se aplicará esta técnica."],
        [has("marcapasos") || has("metal"), "Como lleva un implante electrónico o metal en la zona, no se pasará corriente por la aguja."],
        [has("alergia_metal"), "Como tiene alergia a metales o al látex, se usarán guantes sin látex y se valorará si las agujas son adecuadas para usted."],
        [has("cancer"), "Como tiene o ha tenido cáncer, no se pinchará en la zona afectada."],
      ]);
    },
  },

  // 3. Con impulso rápido: por escrito por sus riesgos graves, aunque sean muy raros.
  {
    id: "manipulacion",
    version: "3",
    title: "Manipulaciones articulares",
    summary: "Manipulaciones con impulso rápido del cuello, la espalda u otras articulaciones, etc.",
    written: "required",
    techniques: [
      { id: "manip_cervical", label: "Manipulación cervical" },
      { id: "manip_dorsal", label: "Manipulación dorsal y de costillas" },
      { id: "manip_lumbar", label: "Manipulación lumbar y sacroilíaca" },
      { id: "manip_periferica", label: "Manipulación de otras articulaciones" },
    ],
    suggest: (ctx) => (mentions(ctx, /\bmanipul/, /\bthrust/, /\bhvla\b/) ? "El plan incluye manipulación articular" : null),
    description: [
      "Son técnicas manuales en las que se lleva la articulación a una postura y se hace un impulso rápido y corto, como las manipulaciones del cuello, la espalda o de otras articulaciones, etc. A menudo se oye un chasquido, que es normal.",
      "Antes le exploraremos para descartar los casos en los que no se deben usar. Puede pedir que paremos en cualquier momento, también con la técnica ya preparada.",
    ],
    risks: [
      "Dolor o rigidez pasajeros, dolor de cabeza leve o mareo, uno o dos días.",
      "Muy rara vez: empeoramiento de una hernia discal, con dolor u hormigueo que baja por el brazo o la pierna, o una fractura si el hueso es frágil.",
      "Muy rara vez, al manipular el cuello: lesión de una arteria que puede causar un ictus. Si nota mareo intenso, visión doble, dificultad para hablar o un dolor de cabeza muy fuerte y distinto, llame al 112.",
    ],
    contraindications: [
      "Signos de alarma sin descartar (fiebre, pérdida de peso sin explicación, dolor nocturno que no cede, un golpe reciente…).",
      "Hueso frágil (osteoporosis, cáncer) o infección del hueso.",
      "En el cuello: problemas de sus arterias, inestabilidad o artritis reumatoide.",
      "Que usted no quiera.",
    ],
    alternatives: ["Movilizaciones suaves sin impulso, ejercicio u otras técnicas, o no aplicar manipulaciones: el resto del tratamiento sigue igual."],
    personal(ctx) {
      const has = marked(ctx);
      const zone = inZone(ctx);
      return pick([
        [ctx.redFlags.length > 0, `Nos ha comentado algún signo de alarma (${flagText(ctx)}): no se le deben aplicar manipulaciones hasta que lo valore un médico.`, true],
        [has("osteoporosis"), "Como tiene osteoporosis, no se le deben aplicar manipulaciones: se usarán técnicas suaves.", true],
        [has("cancer"), "Como tiene o ha tenido cáncer, el hueso podría estar afectado: no se le deben aplicar manipulaciones.", true],
        [has("cervical_vascular"), "Como ha tenido problemas en las arterias del cuello, o mareo o vértigo de origen cervical, no se le debe manipular el cuello.", zone("cervical")],
        [has("reuma"), "Como tiene una enfermedad reumática inflamatoria, no se le debe manipular el cuello.", zone("cervical")],
        [zone("cervical"), "Como la zona a tratar es el cuello, antes se le preguntará por mareos, vértigo y otros síntomas para reducir el riesgo de lesión de una arteria."],
        [isOlder(ctx), `Como tiene ${ctx.age} años, el hueso puede ser más frágil: se preferirán técnicas suaves.`],
        [has("anticoagulantes") || has("coagulacion"), "Como toma anticoagulantes o tiene un trastorno de la coagulación, no se le manipulará el cuello y en otras zonas se preferirán técnicas suaves."],
        [has("embarazo"), "Como está o puede estar embarazada, no se manipularán la zona lumbar ni la pelvis."],
        [has("metal"), "Como tiene una prótesis o material metálico en la zona, no se manipulará esa articulación."],
      ]);
    },
  },

  // 4. Aparatos.
  {
    id: "electroterapia",
    version: "3",
    title: "Electroterapia y otros aparatos",
    summary: "TENS, ultrasonido, tecarterapia, láser, ondas de choque, magnetoterapia, etc.",
    written: "recommended",
    techniques: [
      { id: "tens", label: "TENS y electroestimulación" },
      { id: "ultrasonido", label: "Ultrasonido" },
      { id: "diatermia", label: "Diatermia o radiofrecuencia (tecarterapia)" },
      { id: "laser", label: "Láser" },
      { id: "ondas", label: "Ondas de choque" },
      { id: "magnetoterapia", label: "Magnetoterapia" },
    ],
    suggest: (ctx) =>
      mentions(ctx, /\btens\b/, /\belectro(?!lisis|puncion|miograf)/, /\bultrason/, /\bdiatermia/, /\btecar/, /\bradiofrecuencia/, /\blaser/, /\bondas\b/, /\bmagneto/)
        ? "El plan incluye electroterapia u otros aparatos"
        : null,
    description: [
      "Son técnicas con aparatos que aplican sobre la piel una corriente suave, ultrasonido, calor profundo, luz, ondas de choque o campos magnéticos, como el TENS, la tecarterapia, el láser o las ondas de choque, etc. Se usan para aliviar el dolor y ayudar a la recuperación, junto con el ejercicio.",
      "La intensidad se ajusta a lo que usted nota. Avise si nota quemazón, calor excesivo o dolor fuerte.",
    ],
    risks: [
      "Hormigueo, enrojecimiento o picor de la piel; con las ondas de choque, dolor durante la aplicación y algún moratón.",
      "Molestia o cansancio en la zona durante uno o dos días.",
      "Rara vez: una quemadura de la piel, mareo o, con las ondas de choque, que empeore un tendón muy dañado.",
    ],
    contraindications: [
      "Marcapasos, desfibrilador u otros implantes electrónicos.",
      "Embarazo: nada sobre el abdomen, la pelvis ni la zona lumbar, y ni diatermia ni ondas de choque en ningún sitio.",
      "Cáncer, trombosis, heridas o infección en la zona.",
      "Calor profundo sobre metal o sobre piel que no siente bien.",
    ],
    alternatives: ["Terapia manual, ejercicio, calor o frío superficial, o no aplicarlas: el resto del tratamiento sigue igual."],
    personal(ctx) {
      const has = marked(ctx);
      return pick([
        [has("marcapasos"), "Como lleva marcapasos u otro implante electrónico, no se le deben aplicar corrientes, diatermia ni magnetoterapia.", true],
        [has("embarazo"), "Como está o puede estar embarazada, no se aplicarán diatermia ni ondas de choque, ni nada sobre el abdomen, la pelvis o la zona lumbar."],
        [has("coagulacion"), "Como tiene un trastorno de la coagulación, no se aplicarán ondas de choque."],
        [has("anticoagulantes"), "Como toma anticoagulantes o antiagregantes, las ondas de choque se aplicarán con menos intensidad o no se aplicarán."],
        [has("cancer"), "Como tiene o ha tenido cáncer, no se aplicarán sobre la zona afectada."],
        [has("trombosis"), "Como tiene trombosis o varices importantes, no se aplicarán sobre ellas."],
        [has("metal"), "Como tiene una prótesis o material metálico en la zona, no se aplicará diatermia sobre ella."],
        [has("sensibilidad"), "Como tiene la sensibilidad alterada en la zona, se usará menos intensidad y se revisará la piel."],
        [has("epilepsia"), "Como tiene epilepsia, no se aplicarán en la cabeza ni en el cuello."],
        [isMinor(ctx), "Como es menor de edad, no se aplicarán ultrasonido, calor profundo ni ondas de choque cerca de los cartílagos de crecimiento."],
      ]);
    },
  },

  // 5. Suelo pélvico, también por dentro: por escrito (intracavitario e íntimo).
  {
    id: "suelo_pelvico",
    version: "3",
    title: "Suelo pélvico",
    summary: "Exploración y tratamiento del suelo pélvico, también por vía vaginal o anal, con sonda, etc.",
    written: "required",
    techniques: [
      { id: "externa", label: "Exploración y tratamiento por fuera" },
      { id: "vaginal", label: "Exploración y tratamiento por vía vaginal" },
      { id: "anal", label: "Exploración y tratamiento por vía anal" },
      { id: "sonda", label: "Biofeedback o electroestimulación con sonda" },
    ],
    suggest: (ctx) =>
      mentions(ctx, /suelo pelvico/, /\bintracavit/, /\bperine/) ? "El plan incluye fisioterapia de suelo pélvico" : null,
    description: [
      "Es la exploración y el tratamiento de los músculos que cierran la pelvis por abajo, para problemas como escapes de orina, sensación de peso o dolor pélvico, etc. Muchas veces hay que explorar por dentro, con uno o dos dedos con guante en la vagina o el ano, y se puede usar una sonda (biofeedback o electroestimulación).",
      "Se le explicará cada paso antes, y puede pedir que paremos en cualquier momento o que esté presente un acompañante. Por ser una exploración íntima, se pide su consentimiento por escrito.",
    ],
    risks: [
      "Molestia o presión durante la exploración y unas horas después.",
      "Un pequeño sangrado, sobre todo si la mucosa está seca.",
      "Rara vez: infección de orina, reacción al lubricante, a los guantes o a la sonda, o malestar emocional.",
    ],
    contraindications: [
      "Infección de orina o vaginal, o un sangrado sin diagnóstico.",
      "Menos de 6 semanas desde el parto o desde una cirugía de la zona, sin la revisión de su médico o matrona.",
      "Electroestimulación con sonda: marcapasos o embarazo.",
      "Que usted no quiera.",
    ],
    alternatives: ["Valoración y tratamiento solo por fuera, ejercicios guiados, valoración por su médico o matrona, o no hacerlo."],
    personal(ctx) {
      const has = marked(ctx);
      const sphincters = ctx.redFlags.some((f) => fold(f).includes("esfinter"));
      return pick([
        [sphincters, "Nos ha comentado cambios en el control de la orina o las heces: si es algo nuevo, debe verle un médico con urgencia antes de seguir."],
        [has("embarazo"), "Como está o puede estar embarazada, la exploración por dentro solo se hará si su médico o matrona lo ven adecuado, y sin electroestimulación."],
        [isMinor(ctx), "Como es menor de edad, la exploración por dentro solo se hará si es imprescindible y con su madre, padre o representante informado."],
        [ctx.sex === "male", "En su caso, la exploración por dentro sería por vía anal."],
        [has("alergia_metal"), "Como tiene alergia al látex o a metales, se usarán guantes y materiales sin látex."],
        [has("anticoagulantes") || has("coagulacion"), "Como toma anticoagulantes o tiene un trastorno de la coagulación, la exploración será especialmente suave."],
        [has("marcapasos"), "Como lleva marcapasos u otro implante electrónico, no se usará electroestimulación con sonda."],
      ]);
    },
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

/** «Punción seca» → «punción seca», pero «TENS…» se queda igual. */
const lowerFirst = (s: string) => (/^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/**
 * Apartados del documento, en orden. `techniques` son los ids de las técnicas marcadas (un texto que no sea un id
 * se copia tal cual). El apartado personal solo sale si hay algo. Los arrays son copias: el documento firmado no
 * comparte nada con la plantilla.
 */
export function buildSections(t: ConsentTemplate, ctx: ConsentContext, techniques: string[]): { title: string; items: string[] }[] {
  const labels = [...new Set(techniques)].map((id) => t.techniques.find((x) => x.id === id)?.label ?? id).filter((l) => l.trim() !== "");
  const what = [...t.description];
  if (labels.length > 0) what.push(`En su caso: ${labels.map(lowerFirst).join("; ")}.`);
  const sections = [
    { title: "Qué es", items: what },
    { title: "Riesgos", items: t.risks },
    { title: "En su caso, según su historia", items: t.personal(ctx).map((r) => r.text) },
    { title: "Cuándo no se aplica", items: t.contraindications },
    { title: "Alternativas", items: t.alternatives },
  ];
  return sections.filter((s) => s.items.length > 0).map((s) => ({ title: s.title, items: [...s.items] }));
}
