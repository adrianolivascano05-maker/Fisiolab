// NDI, Oswestry (ODI 2.1a), QuickDASH, SPADI y TSK-11 completos: cada ítem lleva su pregunta (o el tema del apartado)
// y cada respuesta su texto, para que el paciente los rellene en la app y esta calcule la nota.
// La redacción es una traducción de trabajo, fiel al sentido de cada ítem del original pero escrita aquí: hay que
// revisarla con la versión española publicada de cada cuestionario. Estos cuestionarios tienen titulares de derechos
// de autor; la clínica debe comprobar sus condiciones de uso antes de pasarlos.
import { answered, round1, type Answers, type Item, type Option, type QuestionForm } from "./types";

/** Las seis frases de un apartado de NDI u Oswestry, de menos (0) a más (5) discapacidad. */
type Six = [string, string, string, string, string, string];

/** Opciones con valores seguidos desde `from`, en el orden de los textos. */
const options = (from: number, labels: string[]): Option[] => labels.map((label, i) => ({ value: from + i, label }));
/** NDI y Oswestry: cada apartado es un tema con sus seis frases, de 0 a 5. */
const statements = (prefix: string, rows: [string, Six][]): Item[] =>
  rows.map(([text, labels], i) => ({ id: `${prefix}${i + 1}`, text, options: options(0, labels) }));
const missing = (n: number) => (n === 1 ? "Falta 1 respuesta" : `Faltan ${n} respuestas`);

/** NDI y Oswestry: 10 apartados de 0 a 5; con alguno sin contestar, se prorratea sobre los contestados. */
function sections(a: Answers, ids: string[], min: number) {
  const v = answered(a, ids);
  if (v.length < min) throw new RangeError(`${missing(min - v.length)} como mínimo para calcular la nota (se necesitan ${min} de ${ids.length}).`);
  return v.reduce((s, x) => s + x, 0) / (5 * v.length);
}

// Los tres primeros apartados dicen lo mismo en el NDI y en el Oswestry.
const PAIN_NOW: Six = [
  "Ahora mismo no tengo dolor.",
  "Ahora mismo el dolor es muy leve.",
  "Ahora mismo el dolor es moderado.",
  "Ahora mismo el dolor es bastante fuerte.",
  "Ahora mismo el dolor es muy fuerte.",
  "Ahora mismo el dolor es el peor que pueda imaginar.",
];
const SELF_CARE: Six = [
  "Me arreglo sin ayuda y con normalidad, sin que me aumente el dolor.",
  "Me arreglo sin ayuda y con normalidad, pero me aumenta el dolor.",
  "Arreglarme me duele, y lo hago despacio y con cuidado.",
  "Necesito algo de ayuda, pero la mayor parte de mi cuidado personal la hago yo.",
  "Necesito ayuda todos los días para la mayor parte de mi cuidado personal.",
  "No me visto, me lavo con dificultad y me quedo en la cama.",
];
const LIFTING: Six = [
  "Puedo levantar objetos pesados sin que me aumente el dolor.",
  "Puedo levantar objetos pesados, pero me aumenta el dolor.",
  "El dolor no me deja levantar objetos pesados del suelo, pero sí puedo si están en un sitio a mano (por ejemplo, encima de una mesa).",
  "El dolor no me deja levantar objetos pesados, pero sí ligeros o medianos si están en un sitio a mano.",
  "Solo puedo levantar objetos muy ligeros.",
  "No puedo levantar ni llevar nada.",
];

const NDI = statements("n", [
  ["Intensidad del dolor de cuello", PAIN_NOW],
  ["Cuidados personales (lavarse, vestirse…)", SELF_CARE],
  ["Levantar pesos", LIFTING],
  [
    "Lectura",
    [
      "Puedo leer todo lo que quiero sin dolor de cuello.",
      "Puedo leer todo lo que quiero con un dolor de cuello leve.",
      "Puedo leer todo lo que quiero con un dolor de cuello moderado.",
      "No puedo leer todo lo que quiero por un dolor de cuello moderado.",
      "Apenas puedo leer por un dolor de cuello fuerte.",
      "No puedo leer nada.",
    ],
  ],
  [
    "Dolor de cabeza",
    [
      "No tengo ningún dolor de cabeza.",
      "Tengo dolores de cabeza leves y poco frecuentes.",
      "Tengo dolores de cabeza moderados y poco frecuentes.",
      "Tengo dolores de cabeza moderados y frecuentes.",
      "Tengo dolores de cabeza fuertes y frecuentes.",
      "Tengo dolor de cabeza casi todo el tiempo.",
    ],
  ],
  [
    "Concentración",
    [
      "Me concentro del todo cuando quiero, sin ninguna dificultad.",
      "Me concentro del todo cuando quiero, con una dificultad leve.",
      "Me cuesta algo concentrarme cuando quiero.",
      "Me cuesta mucho concentrarme cuando quiero.",
      "Me cuesta muchísimo concentrarme cuando quiero.",
      "No puedo concentrarme en absoluto.",
    ],
  ],
  [
    "Trabajo",
    [
      "Puedo trabajar todo lo que quiero.",
      "Solo puedo hacer mi trabajo habitual, y nada más.",
      "Puedo hacer la mayor parte de mi trabajo habitual, y nada más.",
      "No puedo hacer mi trabajo habitual.",
      "Apenas puedo trabajar.",
      "No puedo trabajar nada.",
    ],
  ],
  [
    "Conducción de vehículos",
    [
      "Puedo conducir sin dolor de cuello.",
      "Puedo conducir todo el tiempo que quiero con un dolor de cuello leve.",
      "Puedo conducir todo el tiempo que quiero con un dolor de cuello moderado.",
      "No puedo conducir todo el tiempo que quiero por un dolor de cuello moderado.",
      "Apenas puedo conducir por un dolor de cuello fuerte.",
      "No puedo conducir nada.",
    ],
  ],
  [
    "Sueño",
    [
      "Duermo sin problemas.",
      "El sueño se me altera muy poco (menos de 1 hora en vela).",
      "El sueño se me altera un poco (de 1 a 2 horas en vela).",
      "El sueño se me altera bastante (de 2 a 3 horas en vela).",
      "El sueño se me altera mucho (de 3 a 5 horas en vela).",
      "El sueño se me altera por completo (de 5 a 7 horas en vela).",
    ],
  ],
  [
    "Actividades de ocio",
    [
      "Puedo hacer todas mis actividades de ocio sin ningún dolor de cuello.",
      "Puedo hacer todas mis actividades de ocio con algo de dolor de cuello.",
      "Por el dolor de cuello, puedo hacer la mayoría de mis actividades de ocio habituales, pero no todas.",
      "Por el dolor de cuello, solo puedo hacer unas pocas de mis actividades de ocio habituales.",
      "Por el dolor de cuello, apenas puedo hacer actividades de ocio.",
      "No puedo hacer ninguna actividad de ocio.",
    ],
  ],
]);

export const ndi: QuestionForm = {
  id: "ndi",
  instructions:
    "Estas preguntas sirven para saber cuánto le afecta el dolor de cuello en su vida diaria. En cada apartado, marque solo la frase que mejor describa su situación; si le parece que encajan varias, elija la que más se acerque. Si algún apartado no le corresponde (por ejemplo, si no conduce), déjelo sin contestar.",
  sections: [{ title: "Apartados", items: NDI }],
  score(a) {
    const total = round1(sections(a, NDI.map((i) => i.id), 9) * 50);
    const text = total < 5 ? "Sin discapacidad" : total < 15 ? "Discapacidad leve" : total < 25 ? "Discapacidad moderada" : total < 35 ? "Discapacidad grave" : "Discapacidad completa";
    return { score: total, text };
  },
  source:
    "Vernon y Mior, 1991; versión española de Andrade Ortega et al., 2010. Puntos de corte de Vernon. Texto de trabajo: revisar con la versión española publicada.",
};

const ODI = statements("o", [
  ["Intensidad del dolor", PAIN_NOW],
  ["Cuidados personales (lavarse, vestirse…)", SELF_CARE],
  ["Levantar peso", LIFTING],
  [
    "Andar",
    [
      "El dolor no me impide andar cualquier distancia.",
      "El dolor no me deja andar más de 1,5 km.",
      "El dolor no me deja andar más de 800 m.",
      "El dolor no me deja andar más de 100 m.",
      "Solo puedo andar con bastón o muletas.",
      "Estoy en la cama casi todo el tiempo.",
    ],
  ],
  [
    "Estar sentado",
    [
      "Puedo estar sentado en cualquier silla todo el tiempo que quiero.",
      "Puedo estar sentado todo el tiempo que quiero, pero solo en mi silla o sillón preferido.",
      "El dolor no me deja estar sentado más de 1 hora.",
      "El dolor no me deja estar sentado más de 30 minutos.",
      "El dolor no me deja estar sentado más de 10 minutos.",
      "El dolor no me deja estar sentado nada.",
    ],
  ],
  [
    "Estar de pie",
    [
      "Puedo estar de pie todo el tiempo que quiero sin que me aumente el dolor.",
      "Puedo estar de pie todo el tiempo que quiero, pero me aumenta el dolor.",
      "El dolor no me deja estar de pie más de 1 hora.",
      "El dolor no me deja estar de pie más de 30 minutos.",
      "El dolor no me deja estar de pie más de 10 minutos.",
      "El dolor no me deja estar de pie nada.",
    ],
  ],
  [
    "Dormir",
    [
      "El dolor no me altera nunca el sueño.",
      "El dolor me altera el sueño de vez en cuando.",
      "Por el dolor, duermo menos de 6 horas.",
      "Por el dolor, duermo menos de 4 horas.",
      "Por el dolor, duermo menos de 2 horas.",
      "El dolor no me deja dormir nada.",
    ],
  ],
  [
    "Actividad sexual (si procede)",
    [
      "Mi vida sexual es normal y no me aumenta el dolor.",
      "Mi vida sexual es normal, pero me aumenta algo el dolor.",
      "Mi vida sexual es casi normal, pero me duele mucho.",
      "El dolor limita mucho mi vida sexual.",
      "Por el dolor, casi no tengo vida sexual.",
      "El dolor me impide tener vida sexual.",
    ],
  ],
  [
    "Vida social",
    [
      "Mi vida social es normal y no me aumenta el dolor.",
      "Mi vida social es normal, pero me aumenta el dolor.",
      "El dolor no afecta mucho a mi vida social, salvo que me limita las actividades más enérgicas (por ejemplo, el deporte).",
      "El dolor ha limitado mi vida social y salgo menos que antes.",
      "Por el dolor, mi vida social se reduce a mi casa.",
      "Por el dolor, no tengo vida social.",
    ],
  ],
  [
    "Viajar",
    [
      "Puedo viajar a cualquier sitio sin dolor.",
      "Puedo viajar a cualquier sitio, pero me aumenta el dolor.",
      "El dolor es fuerte, pero aguanto viajes de más de 2 horas.",
      "Por el dolor, solo puedo hacer viajes de menos de 1 hora.",
      "Por el dolor, solo puedo hacer los viajes cortos imprescindibles, de menos de 30 minutos.",
      "El dolor no me deja viajar, salvo para ir a recibir tratamiento.",
    ],
  ],
]);

export const odi: QuestionForm = {
  id: "odi",
  instructions:
    "Estas preguntas sirven para saber cuánto le afecta el problema de espalda (o de pierna) en su vida diaria. En cada apartado, marque solo la frase que mejor describa su situación; si le parece que encajan varias, elija la que más se acerque. Si algún apartado no le corresponde (por ejemplo, la actividad sexual), puede dejarlo sin contestar.",
  sections: [{ title: "Apartados", items: ODI }],
  score(a) {
    const total = round1(sections(a, ODI.map((i) => i.id), 8) * 100);
    const text = total <= 20 ? "Limitación mínima" : total <= 40 ? "Limitación moderada" : total <= 60 ? "Limitación intensa" : total <= 80 ? "Discapacidad" : "Limitación máxima";
    return { score: total, text };
  },
  source:
    "Fairbank et al., 1980 (versión 2.1a); versión española de Flórez García et al., 1995. Texto de trabajo: revisar con la versión española publicada.",
};

const DIFFICULTY = options(1, ["Ninguna dificultad", "Dificultad leve", "Dificultad moderada", "Mucha dificultad", "Incapaz"]);
const SYMPTOM = options(1, ["Ninguno", "Leve", "Moderado", "Fuerte", "Extremo"]);

const QD_ROWS: [string, Option[]][] = [
  ["Abrir un bote nuevo o con la tapa muy apretada", DIFFICULTY],
  ["Hacer tareas pesadas de la casa (por ejemplo, fregar el suelo o limpiar paredes)", DIFFICULTY],
  ["Llevar una bolsa de la compra o un maletín", DIFFICULTY],
  ["Lavarse la espalda", DIFFICULTY],
  ["Cortar la comida con un cuchillo", DIFFICULTY],
  ["Actividades de ocio en las que el brazo, el hombro o la mano hacen fuerza o reciben golpes (por ejemplo, golf, clavar con martillo, tenis…)", DIFFICULTY],
  [
    "Durante la última semana, ¿hasta qué punto su problema de brazo, hombro o mano ha interferido en sus actividades sociales normales con la familia, los amigos, los vecinos u otros grupos?",
    options(1, ["Nada", "Un poco", "Moderadamente", "Bastante", "Extremadamente"]),
  ],
  [
    "Durante la última semana, ¿su problema de brazo, hombro o mano le ha limitado en su trabajo o en otras actividades diarias habituales?",
    options(1, ["Nada limitado", "Un poco limitado", "Moderadamente limitado", "Muy limitado", "Incapaz"]),
  ],
  ["Durante la última semana, ¿cuánto dolor ha tenido en el brazo, el hombro o la mano?", SYMPTOM],
  ["Durante la última semana, ¿cuánto hormigueo (sensación de pinchazos) ha tenido en el brazo, el hombro o la mano?", SYMPTOM],
  [
    "Durante la última semana, ¿cuánta dificultad ha tenido para dormir por el dolor en el brazo, el hombro o la mano?",
    options(1, ["Ninguna dificultad", "Dificultad leve", "Dificultad moderada", "Mucha dificultad", "Tanta dificultad que no puedo dormir"]),
  ],
];
const QD: Item[] = QD_ROWS.map(([text, opts], i) => ({ id: `d${i + 1}`, text, options: opts }));

export const quickdash: QuestionForm = {
  id: "quickdash",
  instructions:
    "Estas preguntas tratan de sus síntomas y de su capacidad para hacer algunas actividades. Conteste todas pensando en cómo ha estado durante la última semana. Si en la última semana no ha hecho alguna de las actividades, elija la respuesta que crea más acertada. Da igual con qué mano o brazo la haga: conteste según lo que es capaz de hacer, sea cual sea la forma en que lo haga.",
  sections: [{ title: "Preguntas", intro: "Preguntas 1 a 6: durante la última semana, ¿qué dificultad ha tenido para…", items: QD }],
  score(a) {
    const v = answered(a, QD.map((i) => i.id));
    if (v.length < 10) throw new RangeError(`${missing(10 - v.length)} como mínimo: el QuickDASH necesita 10 de las 11.`);
    return { score: round1((v.reduce((s, x) => s + x, 0) / v.length - 1) * 25) };
  },
  source: "Beaton et al., 2005 (Institute for Work & Health); versión española del IWH. Texto de trabajo: revisar con la versión española publicada.",
};

const scale = (prefix: string, texts: string[], ends: [string, string], na = false): Item[] =>
  texts.map((text, i) => ({ id: `${prefix}${i + 1}`, text, scale: { from: 0, to: 10, ends }, na }));
const SP_PAIN = scale(
  "sd",
  [
    "¿Cuánto le duele el hombro en el peor momento?",
    "¿Cuánto le duele al tumbarse sobre el lado del hombro afectado?",
    "¿Cuánto le duele al intentar alcanzar algo de una estantería alta?",
    "¿Cuánto le duele al tocarse la nuca?",
    "¿Cuánto le duele al empujar con el brazo afectado?",
  ],
  ["Sin dolor", "El peor dolor imaginable"],
);
const SP_DIS = scale(
  "sf",
  [
    "¿Qué dificultad tiene para lavarse el pelo?",
    "¿Qué dificultad tiene para lavarse la espalda?",
    "¿Qué dificultad tiene para ponerse una camiseta o un jersey por la cabeza?",
    "¿Qué dificultad tiene para ponerse una camisa que se abrocha por delante?",
    "¿Qué dificultad tiene para ponerse los pantalones?",
    "¿Qué dificultad tiene para colocar un objeto en una estantería alta?",
    "¿Qué dificultad tiene para llevar un objeto pesado, de unos 4,5 kg?",
    "¿Qué dificultad tiene para sacar algo del bolsillo de atrás del pantalón?",
  ],
  ["Ninguna dificultad", "Tanta dificultad que necesita ayuda"],
  true,
);

export const spadi: QuestionForm = {
  id: "spadi",
  instructions:
    "Piense en cómo ha estado durante la última semana por su problema de hombro. En cada pregunta, marque el número de 0 a 10 que mejor lo describa. En las de dificultad, si no hace esa actividad, marque «No aplica».",
  sections: [
    { title: "Dolor", items: SP_PAIN },
    { title: "Discapacidad", items: SP_DIS },
  ],
  score(a) {
    const part = (list: Item[], name: string) => {
      const v = answered(a, list.map((i) => i.id));
      if (list.length - v.length > 2) throw new RangeError(`${name}: ${missing(list.length - 2 - v.length)} como mínimo (pueden faltar 2 como mucho).`);
      return (v.reduce((s, x) => s + x, 0) / (10 * v.length)) * 100;
    };
    const pain = part(SP_PAIN, "Dolor");
    const dis = part(SP_DIS, "Discapacidad");
    return {
      score: round1((pain + dis) / 2),
      subscores: [
        { name: "Dolor", score: round1(pain) },
        { name: "Discapacidad", score: round1(dis) },
      ],
    };
  },
  source: "Roach et al., 1991; versión española de Torres-Lacomba et al., 2015. Texto de trabajo: revisar con la versión española publicada.",
};

const AGREEMENT = options(1, ["Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"]);
// Los 11 ítems de Woby (los 1, 2, 3, 5, 6, 7, 10, 11, 13, 15 y 17 de la TSK de 17), en ese orden.
const TSK: Item[] = [
  "Tengo miedo de lesionarme si hago ejercicio.",
  "Si intentara sobreponerme al dolor, me dolería más.",
  "Mi cuerpo me está avisando de que tengo algo peligrosamente mal.",
  "Los demás no se toman lo bastante en serio mi problema de salud.",
  "Mi accidente (o lesión) ha dejado mi cuerpo en riesgo para el resto de mi vida.",
  "El dolor siempre significa que me he hecho daño.",
  "Lo más seguro que puedo hacer para que el dolor no empeore es tener cuidado de no hacer movimientos innecesarios.",
  "No me dolería tanto si no estuviera pasando en mi cuerpo algo que puede ser peligroso.",
  "El dolor me avisa de cuándo dejar el ejercicio para no lesionarme.",
  "No puedo hacer todo lo que hacen los demás porque me lesiono con demasiada facilidad.",
  "Nadie debería tener que hacer ejercicio si le duele.",
].map((text, i) => ({ id: `t${i + 1}`, text, options: AGREEMENT }));

export const tsk11: QuestionForm = {
  id: "tsk11",
  instructions:
    "Lea cada afirmación y marque hasta qué punto está de acuerdo con ella. Conteste según lo que usted siente, no según lo que otros piensan que debería creer. Responda a las 11.",
  sections: [{ title: "Afirmaciones", items: TSK }],
  score(a) {
    const v = answered(a, TSK.map((i) => i.id));
    if (v.length < TSK.length) throw new RangeError(`${missing(TSK.length - v.length)}: la TSK-11 necesita las 11.`);
    return { score: v.reduce((s, x) => s + x, 0) };
  },
  source: "Woby et al., 2005; versión española de Gómez-Pérez et al., 2011. Texto de trabajo: revisar con la versión española publicada.",
};
