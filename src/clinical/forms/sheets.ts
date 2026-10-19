// Hojas de respuestas de los cuestionarios cuyo texto tiene derechos de autor (NDI, Oswestry, QuickDASH, SPADI y
// TSK-11): no se reproducen sus preguntas. Cada ítem lleva su número o su tema y los valores que puntúan; el paciente
// contesta en la hoja oficial y aquí se marca lo que eligió, para que la app calcule la nota.
import { answered, round1, type Answers, type Item, type Option, type QuestionForm } from "./types";

const values = (from: number, to: number): Option[] => Array.from({ length: to - from + 1 }, (_, i) => ({ value: from + i, label: String(from + i) }));
const items = (prefix: string, topics: string[], options: Option[]): Item[] => topics.map((text, i) => ({ id: `${prefix}${i + 1}`, text, options }));
const numbered = (n: number, word: string) => Array.from({ length: n }, (_, i) => `${word} ${i + 1}`);
const missing = (n: number) => (n === 1 ? "Falta 1 respuesta" : `Faltan ${n} respuestas`);

/** NDI y Oswestry: 10 apartados de 0 a 5; con alguno sin contestar, se prorratea sobre los contestados. */
function sections(a: Answers, ids: string[], min: number) {
  const v = answered(a, ids);
  if (v.length < min) throw new RangeError(`${missing(min - v.length)} como mínimo para calcular la nota (se necesitan ${min} de ${ids.length}).`);
  return v.reduce((s, x) => s + x, 0) / (5 * v.length);
}

const SECTION_OPTIONS: Option[] = values(0, 5).map((o) => ({ ...o, label: `${o.value} · frase ${o.value + 1} de la hoja` }));

const NDI_TOPICS = ["Intensidad del dolor de cuello", "Cuidados personales", "Levantar pesos", "Lectura", "Dolor de cabeza", "Concentración", "Trabajo", "Conducción de vehículos", "Sueño", "Actividades de ocio"];
const NDI = items("n", NDI_TOPICS, SECTION_OPTIONS);

export const ndi: QuestionForm = {
  id: "ndi",
  sheet: true,
  instructions:
    "El paciente contesta en la hoja oficial del NDI. En cada apartado marca la frase que eligió: la primera vale 0 y la última 5. Con un apartado sin contestar, la nota se prorratea.",
  sections: [{ title: "Apartados", items: NDI }],
  score(a) {
    const total = round1(sections(a, NDI.map((i) => i.id), 9) * 50);
    const text = total < 5 ? "Sin discapacidad" : total < 15 ? "Discapacidad leve" : total < 25 ? "Discapacidad moderada" : total < 35 ? "Discapacidad grave" : "Discapacidad completa";
    return { score: total, text };
  },
  source: "Vernon y Mior, 1991; versión española de Andrade Ortega et al., 2010. Puntos de corte de Vernon.",
};

const ODI_TOPICS = ["Intensidad del dolor", "Cuidados personales", "Levantar peso", "Andar", "Estar sentado", "Estar de pie", "Dormir", "Actividad sexual", "Vida social", "Viajar"];
const ODI = items("o", ODI_TOPICS, SECTION_OPTIONS);

export const odi: QuestionForm = {
  id: "odi",
  sheet: true,
  instructions:
    "El paciente contesta en la hoja oficial del Oswestry. En cada apartado marca la frase que eligió: la primera vale 0 y la última 5. Si deja alguno sin contestar (por ejemplo, la actividad sexual), la nota se calcula sobre los contestados.",
  sections: [{ title: "Apartados", items: ODI }],
  score(a) {
    const total = round1(sections(a, ODI.map((i) => i.id), 8) * 100);
    const text = total <= 20 ? "Limitación mínima" : total <= 40 ? "Limitación moderada" : total <= 60 ? "Limitación intensa" : total <= 80 ? "Discapacidad" : "Limitación máxima";
    return { score: total, text };
  },
  source: "Fairbank et al., 1980 (versión 2.1a); versión española de Flórez García et al., 1995.",
};

const QD = items("d", numbered(11, "Pregunta"), values(1, 5).map((o) => ({ ...o, label: `${o.value}${o.value === 1 ? " · ninguna dificultad / nada" : o.value === 5 ? " · incapaz / extremo" : ""}` })));

export const quickdash: QuestionForm = {
  id: "quickdash",
  sheet: true,
  instructions: "El paciente contesta las 11 preguntas en la hoja oficial del QuickDASH. Marca aquí el número (1 a 5) de cada respuesta. Hace falta contestar al menos 10.",
  sections: [{ title: "Preguntas", items: QD }],
  score(a) {
    const v = answered(a, QD.map((i) => i.id));
    if (v.length < 10) throw new RangeError(`${missing(10 - v.length)} como mínimo: el QuickDASH necesita 10 de las 11.`);
    return { score: round1((v.reduce((s, x) => s + x, 0) / v.length - 1) * 25) };
  },
  source: "Beaton et al., 2005 (Institute for Work & Health); versión española del IWH.",
};

const scale = (prefix: string, n: number, word: string, ends: [string, string], na = false): Item[] =>
  numbered(n, word).map((text, i) => ({ id: `${prefix}${i + 1}`, text, scale: { from: 0, to: 10, ends }, na }));
const SP_PAIN = scale("sd", 5, "Dolor", ["0 sin dolor", "10 el peor imaginable"]);
const SP_DIS = scale("sf", 8, "Discapacidad", ["0 sin dificultad", "10 tanta que necesita ayuda"], true);

export const spadi: QuestionForm = {
  id: "spadi",
  sheet: true,
  instructions:
    "El paciente contesta en la hoja oficial del SPADI: 5 preguntas de dolor y 8 de discapacidad, de 0 a 10. Marca aquí cada número. En discapacidad, «No aplica» si no hace esa actividad; con más de 2 sin contestar en un apartado no se calcula.",
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
  source: "Roach et al., 1991; versión española de Torres-Lacomba et al., 2015.",
};

const TSK = items("t", numbered(11, "Afirmación"), [
  { value: 1, label: "1 · totalmente en desacuerdo" },
  { value: 2, label: "2 · en desacuerdo" },
  { value: 3, label: "3 · de acuerdo" },
  { value: 4, label: "4 · totalmente de acuerdo" },
]);

export const tsk11: QuestionForm = {
  id: "tsk11",
  sheet: true,
  instructions: "El paciente contesta las 11 afirmaciones en la hoja oficial de la TSK-11. Marca aquí el número de cada respuesta (de 1 a 4).",
  sections: [{ title: "Afirmaciones", items: TSK }],
  score(a) {
    const v = answered(a, TSK.map((i) => i.id));
    if (v.length < TSK.length) throw new RangeError(`${missing(TSK.length - v.length)}: la TSK-11 necesita las 11.`);
    return { score: v.reduce((s, x) => s + x, 0) };
  },
  source: "Woby et al., 2005; versión española de Gómez-Pérez et al., 2011.",
};
