// CSI (Central Sensitization Inventory), parte A: 25 síntomas relacionados con la sensibilización central, de 0 a 4;
// nota 0-100, menos es mejor. La parte B (diagnósticos previos) no puntúa y no se incluye.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Rara vez" },
  { value: 2, label: "A veces" },
  { value: 3, label: "A menudo" },
  { value: 4, label: "Siempre" },
];

const TEXTS = [
  "Me levanto cansado, con la sensación de no haber descansado.",
  "Noto los músculos rígidos y doloridos.",
  "Tengo ataques de ansiedad.",
  "Aprieto o rechino los dientes.",
  "Tengo problemas de diarrea o de estreñimiento.",
  "Necesito ayuda para hacer mis actividades del día a día.",
  "La luz intensa me molesta.",
  "Me canso enseguida cuando hago actividad física.",
  "Me duele todo el cuerpo.",
  "Tengo dolores de cabeza.",
  "Noto molestias en la vejiga o escozor al orinar.",
  "Duermo mal.",
  "Me cuesta concentrarme.",
  "Tengo problemas de piel, como sequedad, picor o erupciones.",
  "El estrés hace que empeoren mis síntomas físicos.",
  "Me siento triste o deprimido.",
  "Tengo poca energía.",
  "Tengo tensión en los músculos del cuello y de los hombros.",
  "Me duele la mandíbula.",
  "Algunos olores, como los perfumes, me producen mareo y náuseas.",
  "Tengo que orinar con frecuencia.",
  "Por la noche, cuando intento dormirme, noto las piernas incómodas e inquietas.",
  "Me cuesta acordarme de las cosas.",
  "De niño viví alguna experiencia traumática.",
  "Tengo dolor en la zona de la pelvis.",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

/** Nivel según la nota; desde 40 sugiere sensibilización central. */
const level = (total: number) =>
  total < 30 ? "subclínico" : total < 40 ? "leve" : total < 50 ? "moderado" : total < 60 ? "grave" : "extremo";

export const form: QuestionForm = {
  id: "csi",
  instructions:
    "Lea cada frase y marque la respuesta que mejor describa con qué frecuencia le pasa. Responda a todas.",
  sections: [
    {
      title: "Síntomas",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 25 respuestas: el CSI necesita todas para calcular la nota.`);
    }
    const total = round1(values.reduce((s, v) => s + v, 0));
    let text = `Nivel ${level(total)}`;
    if (total >= 40) text += " · Sugiere sensibilización central (40 o más)";
    return { score: total, text };
  },
  source:
    "Mayer et al., 2012 (CSI original); niveles de Neblett et al., 2017. Texto de trabajo: revisar con la versión española publicada.",
};
