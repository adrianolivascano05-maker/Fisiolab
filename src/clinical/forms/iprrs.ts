// I-PRRS (Injury-Psychological Readiness to Return to Sport): confianza para volver al deporte en 6 ítems de 0 a 100
// (de 10 en 10); nota = suma / 10, de 0 a 60, más es mejor (más confianza).
import { answered, round1, type Answers, type Option, type QuestionForm } from "./types";

/** Los extremos y el centro, como en las instrucciones. */
const ANCHORS: Record<number, string> = { 0: "ninguna confianza", 50: "confianza moderada", 100: "confianza total" };
/** De 0 a 100 de 10 en 10; cada respuesta dice «de 100» para que no sea solo un número. */
const OPTIONS: Option[] = Array.from({ length: 11 }, (_, i) => {
  const value = i * 10;
  return { value, label: ANCHORS[value] ? `${value} de 100 (${ANCHORS[value]})` : `${value} de 100` };
});

const TEXTS = [
  "Mi confianza general para jugar/competir es…",
  "Mi confianza para jugar sin dolor es…",
  "Mi confianza para darlo todo (100 % de esfuerzo) es…",
  "Mi confianza para no estar pendiente de la lesión es…",
  "Mi confianza en que la parte lesionada aguante lo que exige el deporte es…",
  "Mi confianza en mi nivel técnico y mi capacidad es…",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "iprrs",
  instructions:
    "Puntúe su confianza de 0 a 100 en cada frase (en saltos de 10): 0 = ninguna confianza; 50 = confianza moderada; 100 = confianza total.",
  sections: [
    {
      title: "Confianza para volver al deporte",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    // Sin prorrateo.
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 6 respuestas: el I-PRRS necesita todas para calcular la nota.`);
    }
    return { score: round1(values.reduce((s, v) => s + v, 0) / 10) };
  },
  source:
    "Glazer, 2009 (original), DOI 10.4085/1062-6050-44.2.185; sin validación española en PubMed. Texto de trabajo fiel al original: revisar con la versión española publicada antes de usarlo en consulta; como no se ha encontrado ninguna validada, cotejarlo con el original.",
};
