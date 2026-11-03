// Plantillas de consentimiento informado (tipos en ./types.ts).
//
// AVISO: estos textos son un MODELO DE TRABAJO. No están validados clínica ni legalmente. Versión «5» (03-11-2026): los
// riesgos, con las frecuencias y frases de una revisión de la literatura (PubMed, 45 fuentes; resumen en
// docs/ideas-pendientes.md): solo se dice «frecuente», «poco frecuente», «raro» o «muy raro» donde hay datos. Antes de usarlos con
// pacientes hay que revisarlos con el Colegio de Fisioterapeutas y con la asesoría jurídica del centro, y
// adaptarlos a las técnicas que de verdad se aplican. Al cambiar un texto, sube su `version`.
//
// Cinco documentos cortos, uno por familia de técnicas («Tratamientos invasivos, como la punción seca… etc.»). Cada
// uno dice qué es, sus riesgos, cuándo no se aplica y las alternativas (Ley 41/2002, art. 10). `personal` añade lo
// del paciente a partir de lo MARCADO en la anamnesis (`ctx.precautions`, zonas, sexo, banderas rojas): el riesgo y
// que su fisioterapeuta lo valora o lo adapta; la app no decide por el profesional ni da veredictos de
// contraindicación (revisión del 30-10-2026; la edad sola ya no añade frases). Lo que solo se ha detectado en el texto
// libre (`ctx.detected`) no genera texto para el paciente: la pantalla avisa de ello al fisioterapeuta, que decide si
// marcarlo.
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

/** Se queda con los textos cuya condición se cumple. */
const pick = (items: [boolean, string][]): PersonalRisk[] => items.filter(([when]) => when).map(([, text]) => ({ text }));

const isMinor = (ctx: ConsentContext) => ctx.age !== null && ctx.age < 18;

export const TEMPLATES: ConsentTemplate[] = [
  // 1. De base, para cualquier paciente.
  {
    id: "general",
    version: "5",
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
      "Es frecuente notar más dolor, rigidez, cansancio o agujetas durante uno o dos días. Suele pasar solo.",
      "Puede salir un pequeño moratón, enrojecimiento o picor en la piel por el masaje, el vendaje, el calor o el frío.",
      "Rara vez: un mareo, una caída o una pequeña lesión de un músculo durante el ejercicio o las pruebas.",
      "Rara vez: una quemadura por calor o por frío. Avise si nota que quema o que no siente la piel.",
      "Si nota dolor en el pecho, falta de aire, pérdida de fuerza o de sensibilidad que va a más, o pierde el control de la orina o de las heces, avise o llame al 112.",
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
        [ctx.redFlags.length > 0, `Nos ha comentado: ${flagText(ctx)}. Su fisioterapeuta valorará con usted si hace falta otra valoración antes de seguir.`],
        [has("osteoporosis"), "Como tiene osteoporosis, el hueso es más frágil: las presiones fuertes, los saltos de mucho impacto y la fuerza máxima tienen más riesgo, y su fisioterapeuta lo adaptará."],
        [has("anticoagulantes") || has("coagulacion"), "Como toma anticoagulantes o tiene un trastorno de la coagulación, le pueden salir moratones con más facilidad: su fisioterapeuta adaptará el masaje y la presión."],
        [has("embarazo"), "Como está o puede estar embarazada, algunas posturas y ejercicios, y el calor sobre el abdomen o la zona lumbar, tienen más riesgo: su fisioterapeuta lo adaptará."],
        [has("cardiaco"), "Como tiene una enfermedad del corazón o tensión alta, el esfuerzo intenso tiene más riesgo: su fisioterapeuta lo aumentará poco a poco y valorará con usted cualquier prueba de esfuerzo máximo."],
        [has("diabetes"), "Como tiene diabetes, la piel sufre más con el calor y el frío y el azúcar puede bajar con el ejercicio: su fisioterapeuta lo tendrá en cuenta; si va a hacer ejercicio, traiga algo de azúcar."],
        [has("sensibilidad"), "Como tiene la sensibilidad alterada, puede no notar si el calor o el frío son excesivos: su fisioterapeuta adaptará el tiempo y la intensidad."],
        [has("piel"), "Como tiene heridas o problemas de piel en la zona, los vendajes, el calor, el frío y las cremas sobre ellos tienen más riesgo: su fisioterapeuta lo adaptará."],
        [has("trombosis"), "Como tiene trombosis o varices importantes, el masaje y el calor sobre ellas tienen más riesgo: su fisioterapeuta lo adaptará."],
        [has("cancer"), "Como tiene o ha tenido cáncer, el masaje profundo y el calor sobre la zona afectada tienen más riesgo: su fisioterapeuta lo adaptará."],
        [has("linfedema"), "Como tiene linfedema o le quitaron ganglios en ese brazo o pierna, el calor, las presiones fuertes y los vendajes apretados en él tienen más riesgo: su fisioterapeuta lo adaptará."],
        [isMinor(ctx), "Como es menor de edad, su madre, padre o representante pueden estar presentes en las sesiones."],
      ]);
    },
  },

  // 2. Con aguja: por escrito obligado (procedimiento invasor, Ley 41/2002, art. 8.2).
  {
    id: "invasiva",
    version: "5",
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
      "Es frecuente que salga una gota de sangre o un pequeño moratón donde entra la aguja.",
      "Es frecuente notar dolor durante la técnica y la zona dolorida, como con agujetas, de uno a tres días.",
      "Poco frecuente: mareo, sueño, dolor de cabeza o ganas de vomitar, que pasan pronto. Si se marea, avise: se hará tumbado.",
      "Poco frecuente: que su molestia empeore unos días antes de mejorar.",
      "Rara vez: un moratón grande. Con corriente por la aguja (electrólisis o neuromodulación): una pequeña marca en la piel, o hormigueo o adormecimiento que puede durar unos días.",
      "Muy rara vez: infección, lesión de un nervio o un sangrado importante.",
      "Muy rara vez, si se pincha cerca del pulmón (cuello, espalda alta, hombro o pecho): neumotórax, es decir, entra aire alrededor del pulmón. Puede notarse horas o días después. Si nota falta de aire, dolor en el pecho al respirar o tos seca, vaya a urgencias o llame al 112.",
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
        [has("coagulacion"), "Como tiene un trastorno de la coagulación, el riesgo de sangrado con la aguja es mayor. Su fisioterapeuta valorará con usted si se aplica en su caso."],
        [has("linfedema"), "Como tiene linfedema o le quitaron ganglios en ese brazo o pierna, pinchar en él tiene más riesgo. Su fisioterapeuta valorará con usted si se aplica en esa zona."],
        [has("anticoagulantes"), "Como toma anticoagulantes o antiagregantes, es más fácil que salga un moratón: su fisioterapeuta adaptará el número y la profundidad de las punciones y presionará después."],
        [has("embarazo"), "Como está o puede estar embarazada, en general no se pincha la zona lumbar, el abdomen ni la pelvis, y en los tres primeros meses se suele evitar esta técnica. Su fisioterapeuta lo valorará con usted."],
        [zone("dorsal", "cervical", "hombro"), "Como la zona a tratar está cerca del pulmón, hay un riesgo raro de neumotórax: su fisioterapeuta pinchará solo en direcciones seguras."],
        [has("agujas"), "Como le dan miedo las agujas o se ha mareado con ellas, puede marearse: su fisioterapeuta lo adaptará, tumbado y con pocas punciones al principio."],
        [has("inmunosupresion") || has("diabetes"), "Como tiene diabetes o las defensas bajas, el riesgo de infección es mayor: su fisioterapeuta extremará la limpieza."],
        [has("epilepsia"), "Como tiene epilepsia, esta técnica tiene más riesgo si no está bien controlada: su fisioterapeuta lo valorará con usted."],
        [has("marcapasos") || has("metal"), "Como lleva un implante electrónico o metal en la zona, pasar corriente por la aguja tiene más riesgo: su fisioterapeuta lo valorará con usted."],
        [has("alergia_metal"), "Como tiene alergia a metales o al látex, los guantes con látex o algunas agujas pueden darle reacción: su fisioterapeuta usará material sin látex y valorará con usted qué agujas son adecuadas."],
        [has("cancer"), "Como tiene o ha tenido cáncer, pinchar en la zona afectada tiene más riesgo: su fisioterapeuta lo valorará con usted."],
      ]);
    },
  },

  // 3. Con impulso rápido: por escrito por sus riesgos graves, aunque sean muy raros.
  {
    id: "manipulacion",
    version: "5",
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
      "Más de la mitad de las personas nota después alguna molestia: dolor o rigidez en la zona, dolor de cabeza leve o cansancio. Suele empezar en las primeras horas y casi siempre pasa en un día.",
      "Poco frecuente: mareo o náuseas que pasan pronto.",
      "Muy rara vez: empeoramiento de una hernia discal, con dolor u hormigueo que baja por el brazo o la pierna, o una fractura, sobre todo si el hueso es frágil. En otras articulaciones, muy rara vez, una lesión de la articulación.",
      "En el cuello, muy raro: se han descrito casos de lesión de una arteria del cuello y de ictus después de una manipulación. No se sabe si los causa la manipulación o si la lesión ya estaba empezando; por eso antes le preguntaremos por sus síntomas. Si después nota mareo intenso, visión doble, dificultad para hablar o tragar, adormecimiento de la cara o un dolor de cabeza muy fuerte y distinto del habitual, llame al 112.",
      "En la espalda alta y las costillas, muy raro: fractura de una costilla, lesión de la médula de la espalda o neumotórax (entra aire alrededor del pulmón). Si nota falta de aire, dolor en el pecho o pérdida de fuerza o de sensibilidad en las piernas, llame al 112.",
      "En la zona lumbar, muy raro: afectación de los nervios de la parte baja de la espalda. Si pierde el control de la orina o de las heces, o nota adormecida la zona entre las piernas, llame al 112.",
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
        [ctx.redFlags.length > 0, `Nos ha comentado: ${flagText(ctx)}. Su fisioterapeuta valorará con usted si estas técnicas son adecuadas en su caso.`],
        [has("osteoporosis"), "Como tiene osteoporosis, el hueso es más frágil y las manipulaciones tienen más riesgo. Su fisioterapeuta valorará con usted si se aplican o se usan técnicas suaves."],
        [has("cancer"), "Como tiene o ha tenido cáncer, el hueso podría estar afectado y las manipulaciones tienen más riesgo. Su fisioterapeuta lo valorará con usted."],
        [has("cervical_vascular"), "Como ha tenido problemas en las arterias del cuello, o mareo o vértigo de origen cervical, manipular el cuello tiene más riesgo. Su fisioterapeuta lo valorará con usted."],
        [has("reuma"), "Como tiene una enfermedad reumática inflamatoria, manipular el cuello tiene más riesgo. Su fisioterapeuta lo valorará con usted."],
        [zone("cervical"), "Como la zona a tratar es el cuello, existe un riesgo muy raro de lesión de una arteria: su fisioterapeuta le preguntará antes por mareos, vértigo y otros síntomas."],
        [has("anticoagulantes") || has("coagulacion"), "Como toma anticoagulantes o tiene un trastorno de la coagulación, las manipulaciones, sobre todo del cuello, tienen más riesgo de sangrado: su fisioterapeuta valorará con usted si se aplican o se usan técnicas suaves."],
        [has("embarazo"), "Como está o puede estar embarazada, manipular la zona lumbar o la pelvis tiene más riesgo: su fisioterapeuta lo valorará con usted."],
        [has("metal"), "Como tiene una prótesis o material metálico en la zona, manipular esa articulación tiene más riesgo: su fisioterapeuta lo valorará con usted."],
      ]);
    },
  },

  // 4. Aparatos.
  {
    id: "electroterapia",
    version: "5",
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
      "Hormigueo, calor o enrojecimiento de la piel que pasan en poco tiempo.",
      "Con las ondas de choque es frecuente que duela durante la aplicación y que la piel quede roja. A veces salen pequeños moratones o puntitos rojos, o la zona se hincha o queda dolorida un día o dos.",
      "Rara vez: irritación de la piel bajo los electrodos, u hormigueo o adormecimiento pasajero en la zona.",
      "Rara vez: una quemadura, sobre todo con el calor profundo o si la piel siente poco. Avise si nota que quema.",
      "Muy rara vez: si tiene un marcapasos u otro aparato implantado, la corriente o los campos magnéticos pueden alterar su funcionamiento. Por eso le preguntamos antes y, si lo tiene, no se aplican.",
      "Con el láser: no mire el haz y use las gafas que le damos, porque la luz del láser puede dañar los ojos.",
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
        [has("marcapasos"), "Como lleva marcapasos u otro implante electrónico, las corrientes, la diatermia y la magnetoterapia pueden interferir con él. Su fisioterapeuta valorará con usted qué aparatos se pueden usar."],
        [has("embarazo"), "Como está o puede estar embarazada, la diatermia, las ondas de choque y cualquier aparato sobre el abdomen, la pelvis o la zona lumbar tienen más riesgo: su fisioterapeuta valorará con usted qué se puede usar."],
        [has("coagulacion"), "Como tiene un trastorno de la coagulación, las ondas de choque tienen más riesgo de sangrado: su fisioterapeuta lo valorará con usted."],
        [has("anticoagulantes"), "Como toma anticoagulantes o antiagregantes, las ondas de choque pueden producir más hematomas: su fisioterapeuta valorará con usted la intensidad o si se aplican."],
        [has("cancer"), "Como tiene o ha tenido cáncer, aplicar aparatos sobre la zona afectada tiene más riesgo: su fisioterapeuta lo valorará con usted."],
        [has("trombosis"), "Como tiene trombosis o varices importantes, aplicar aparatos sobre ellas tiene más riesgo: su fisioterapeuta lo adaptará."],
        [has("metal"), "Como tiene una prótesis o material metálico en la zona, la diatermia sobre ella puede calentarlo: su fisioterapeuta lo valorará con usted."],
        [has("sensibilidad"), "Como tiene la sensibilidad alterada en la zona, puede no notar una intensidad excesiva: su fisioterapeuta usará menos intensidad y revisará la piel."],
        [has("epilepsia"), "Como tiene epilepsia, aplicar corrientes en la cabeza o el cuello tiene más riesgo: su fisioterapeuta lo valorará con usted."],
        [isMinor(ctx), "Como es menor de edad, el ultrasonido, el calor profundo y las ondas de choque cerca de los cartílagos de crecimiento tienen más riesgo: su fisioterapeuta lo adaptará."],
      ]);
    },
  },

  // 5. Suelo pélvico, también por dentro: por escrito (intracavitario e íntimo).
  {
    id: "suelo_pelvico",
    version: "5",
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
      "Se le explicará cada paso antes. Una exploración íntima puede remover emociones o recuerdos desagradables: puede pedir que paremos en cualquier momento, sin explicaciones, o que esté presente un acompañante. Por ser una exploración íntima, se pide su consentimiento por escrito.",
    ],
    risks: [
      "Es frecuente notar molestia o presión durante la exploración y, a veces, unas horas después.",
      "Rara vez: un pequeño sangrado, sobre todo si la zona está seca.",
      "Rara vez: irritación o reacción al lubricante, al guante o a la sonda.",
      "Rara vez: escozor al orinar o una infección de orina o vaginal. Si lo nota, consulte a su médico.",
      "Con la sonda con corriente: molestia o calambre en la zona. Los efectos son raros.",
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
        [sphincters, "Nos ha comentado cambios en el control de la orina o las heces. Su fisioterapeuta lo valorará con usted antes de seguir."],
        [has("embarazo"), "Como está o puede estar embarazada, la exploración por dentro y la electroestimulación tienen más riesgo: su fisioterapeuta lo valorará con usted y, si hace falta, con su médico o matrona."],
        [isMinor(ctx), "Como es menor de edad, la exploración por dentro requiere especial cuidado: su fisioterapeuta la valorará con usted y con su madre, padre o representante."],
        [ctx.sex === "male", "En su caso, la exploración por dentro sería por vía anal."],
        [has("alergia_metal"), "Como tiene alergia al látex o a metales, los guantes o materiales con látex pueden darle reacción: su fisioterapeuta usará material sin látex."],
        [has("anticoagulantes") || has("coagulacion"), "Como toma anticoagulantes o tiene un trastorno de la coagulación, la exploración tiene más riesgo de pequeños sangrados: su fisioterapeuta la adaptará."],
        [has("marcapasos"), "Como lleva marcapasos u otro implante electrónico, la electroestimulación con sonda puede interferir con él: su fisioterapeuta valorará con usted qué se puede usar."],
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
