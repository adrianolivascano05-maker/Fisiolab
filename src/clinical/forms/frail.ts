// Escala FRAIL: cribado de fragilidad en 5 componentes que valen 0 o 1 (fatiga, resistencia, deambulación,
// enfermedades y pérdida de peso); nota 0-5, menos es mejor. Si falta un componente, no se calcula.
import { answered, type Answers, type Item, type Option, type QuestionForm } from "./types";

const YES_NO: Option[] = [
  { value: 1, label: "Sí" },
  { value: 0, label: "No" },
];

/**
 * Fatiga: puntúa 1 con «Siempre» o «Casi siempre». Cada respuesta lleva un valor distinto (1 a 5, en el orden en que
 * se leen) para que la lista distinga lo que se marcó; la regla de la ficha se aplica al puntuar.
 */
const FATIGUE: Option[] = [
  { value: 1, label: "Siempre" },
  { value: 2, label: "Casi siempre" },
  { value: 3, label: "Algunas veces" },
  { value: 4, label: "Pocas veces" },
  { value: 5, label: "Nunca" },
];

const DISEASES = [
  "Hipertensión",
  "Diabetes",
  "Cáncer (salvo un cáncer de piel leve)",
  "Enfermedad pulmonar crónica",
  "Infarto de miocardio",
  "Insuficiencia cardiaca congestiva",
  "Angina de pecho",
  "Asma",
  "Artritis",
  "Ictus",
  "Enfermedad renal",
];
const DISEASE_IDS = DISEASES.map((_, i) => `e${i + 1}`);

const WEIGHT: Item["input"] = { min: 20, max: 300, unit: "kg" };

/** Pérdida de más del 5 % del peso de hace un año. En gramos, para comparar sin errores de coma flotante. */
function lostOver5(now: number, yearAgo: number): boolean {
  const g = (kg: number) => Math.round(kg * 1000);
  return (g(yearAgo) - g(now)) * 20 > g(yearAgo);
}

export const form: QuestionForm = {
  id: "frail",
  instructions: "Conteste a estas preguntas sobre su salud y sus actividades.",
  sections: [
    {
      title: "Fatiga, resistencia y deambulación",
      items: [
        { id: "f1", text: "Fatiga: En las últimas 4 semanas, ¿cuánto tiempo se ha sentido cansado/a?", options: FATIGUE },
        { id: "f2", text: "Resistencia: Solo/a y sin ayudas, ¿le cuesta subir 10 escalones sin descansar?", options: YES_NO },
        { id: "f3", text: "Deambulación: Solo/a y sin ayudas, ¿le cuesta caminar unos 300 metros?", options: YES_NO },
      ],
    },
    {
      title: "Enfermedades",
      intro:
        "¿Le ha dicho alguna vez un médico que tiene alguna de estas enfermedades? Marque todas las que tenga: «Sí» en las que tenga y «No» en las demás.",
      items: DISEASES.map((text, i) => ({ id: DISEASE_IDS[i], text, options: YES_NO })),
    },
    {
      title: "Pérdida de peso",
      items: [
        { id: "w1", text: "¿Cuánto pesa ahora, vestido/a y sin zapatos?", input: WEIGHT },
        { id: "w2", text: "¿Cuánto pesaba hace un año?", input: WEIGHT },
      ],
    },
  ],
  score(answers: Answers) {
    const value = (id: string) => (typeof answers[id] === "number" ? (answers[id] as number) : null);
    const fatigue = value("f1");
    const resistance = value("f2");
    const ambulation = value("f3");
    const diseases = answered(answers, DISEASE_IDS);
    const now = value("w1");
    const yearAgo = value("w2");
    const missing = [
      fatigue === null && "fatiga",
      resistance === null && "resistencia",
      ambulation === null && "deambulación",
      diseases.length < DISEASE_IDS.length && "enfermedades",
      (now === null || yearAgo === null) && "pérdida de peso",
    ].filter((m): m is string => !!m);
    if (missing.length) {
      throw new RangeError(
        `Faltan respuestas en ${missing.length} de los 5 componentes (${missing.join(", ")}): la escala FRAIL necesita los 5 para calcular la nota.`,
      );
    }
    const components = [
      fatigue! <= 2 ? 1 : 0,
      resistance!,
      ambulation!,
      diseases.filter((v) => v === 1).length >= 5 ? 1 : 0,
      lostOver5(now!, yearAgo!) ? 1 : 0,
    ];
    return { score: components.reduce((s, v) => s + v, 0) };
  },
  source:
    "Morley et al., 2012 (original), DOI 10.1007/s12603-012-0084-2; Rosas-Carrasco et al., 2016 (validación al español, México), DOI 10.1016/j.jamda.2016.07.008. Texto de trabajo fiel al original: revisar con la versión española publicada (la validación es mexicana) antes de usarlo en consulta.",
};
