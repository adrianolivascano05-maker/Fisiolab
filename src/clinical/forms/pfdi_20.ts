// PFDI-20 (Pelvic Floor Distress Inventory-20): 20 síntomas de suelo pélvico en los últimos 3 meses (No 0; Sí, de 1 a
// 4 según cuánto molesta) en tres subescalas de 0 a 100 (POPDI-6, CRADI-8, UDI-6); nota 0-300, menos es mejor.
import { answered, round1, type Answers, type Option, type QuestionForm, type Section } from "./types";

const OPTIONS: Option[] = [
  { value: 0, label: "No" },
  { value: 1, label: "Sí, y no me molesta nada" },
  { value: 2, label: "Sí, y me molesta un poco" },
  { value: 3, label: "Sí, y me molesta moderadamente" },
  { value: 4, label: "Sí, y me molesta bastante" },
];

/** Subescalas: nombre, título del apartado y preguntas (numeradas del 1 al 20, como en el original). */
const PARTS: { name: string; title: string; texts: string[] }[] = [
  {
    name: "POPDI-6",
    title: "POPDI-6 (prolapso)",
    texts: [
      "¿Siente normalmente presión en la parte baja del abdomen?",
      "¿Siente normalmente pesadez o tirantez en la zona de la pelvis?",
      "¿Tiene normalmente un bulto o algo que se sale y que puede ver o notar en la zona de la vagina?",
      "¿Tiene alguna vez que presionar la vagina o alrededor del ano para poder hacer de vientre o terminar de hacerlo?",
      "¿Tiene normalmente la sensación de no vaciar del todo la vejiga?",
      "¿Tiene alguna vez que empujar con los dedos un bulto en la zona de la vagina para empezar a orinar o terminar de hacerlo?",
    ],
  },
  {
    name: "CRADI-8",
    title: "CRADI-8 (colorrectoanal)",
    texts: [
      "¿Siente que tiene que hacer demasiada fuerza para hacer de vientre?",
      "¿Siente que no ha vaciado del todo el intestino al terminar de hacer de vientre?",
      "¿Se le escapan normalmente las heces sin poder controlarlo cuando son de consistencia normal?",
      "¿Se le escapan normalmente las heces sin poder controlarlo cuando son blandas o líquidas?",
      "¿Se le escapan normalmente los gases sin poder controlarlo?",
      "¿Tiene normalmente dolor al hacer de vientre?",
      "¿Siente unas ganas tan fuertes de hacer de vientre que tiene que correr al servicio?",
      "¿Se le sale alguna vez parte del intestino por el ano durante o después de hacer de vientre?",
    ],
  },
  {
    name: "UDI-6",
    title: "UDI-6 (urinario)",
    texts: [
      "¿Orina con frecuencia?",
      "¿Se le escapa normalmente la orina con una sensación de urgencia, es decir, con unas ganas muy fuertes de ir al servicio?",
      "¿Se le escapa normalmente la orina al toser, estornudar o reírse?",
      "¿Se le escapan normalmente pequeñas cantidades de orina (unas gotas)?",
      "¿Tiene normalmente dificultad para vaciar la vejiga?",
      "¿Tiene normalmente dolor o molestias en la parte baja del abdomen o en la zona genital?",
    ],
  },
];

const sections: Section[] = PARTS.map((p, k) => {
  const before = PARTS.slice(0, k).reduce((s, q) => s + q.texts.length, 0);
  return { title: p.title, items: p.texts.map((text, i) => ({ id: `i${before + i + 1}`, text, options: OPTIONS })) };
});

export const form: QuestionForm = {
  id: "pfdi_20",
  instructions:
    "Conteste a cada pregunta pensando en los síntomas que ha tenido en los últimos 3 meses. Si tiene el síntoma, marque \"Sí\" e indique cuánto le molesta. Si no lo tiene, marque \"No\".",
  sections,
  score(answers: Answers) {
    // Cada subescala: media de sus ítems contestados × 25 (los que quedan en blanco no cuentan).
    const parts = PARTS.map((p, i) => {
      const values = answered(answers, sections[i].items.map((it) => it.id));
      return { name: p.name, raw: values.length ? (values.reduce((s, v) => s + v, 0) / values.length) * 25 : null };
    });
    const empty = parts.filter((p) => p.raw === null).map((p) => p.name);
    if (empty.length) {
      throw new RangeError(`Faltan respuestas: el PFDI-20 necesita al menos una pregunta contestada de cada subescala (falta ${empty.join(", ")}).`);
    }
    const total = parts.reduce((s, p) => s + p.raw!, 0);
    return { score: round1(total), subscores: parts.map((p) => ({ name: p.name, score: round1(p.raw!), max: 100 })) };
  },
  source:
    "Barber et al., 2005 (original), DOI 10.1016/j.ajog.2004.12.025; Sánchez-Sánchez et al., 2013 (validación española), DOI 10.1016/j.ejogrb.2013.07.006. Texto de trabajo fiel al original: revisar con la versión española publicada antes de usarlo en consulta.",
};
