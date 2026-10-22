// SST (Simple Shoulder Test): función del hombro en 12 preguntas de sí/no; la nota es el número de «sí», de 0 a 12,
// más es mejor (también se da en % de «sí»). Con alguna en blanco no hay nota de 0 a 12: solo el % sobre las respondidas.
import { answered, round1, type Answers, type QuestionForm } from "./types";

// «Sí» indica siempre mejor función: no hay ítems invertidos.
const OPTIONS = [
  { value: 1, label: "Sí" },
  { value: 0, label: "No" },
];

const TEXTS = [
  "¿Tiene el hombro cómodo cuando el brazo está en reposo junto al cuerpo?",
  "¿Su hombro le permite dormir cómodamente?",
  "¿Puede llegar con la mano a la parte baja de la espalda para meterse la camisa por dentro?",
  "¿Puede poner la mano detrás de la cabeza con el codo recto hacia el lado?",
  "¿Puede poner una moneda en un estante a la altura del hombro sin doblar el codo?",
  "¿Puede levantar medio kilo (por ejemplo, un envase lleno de medio litro) hasta la altura del hombro sin doblar el codo?",
  "¿Puede levantar unos 4 kg (por ejemplo, una garrafa llena de 4 litros) hasta la altura de la cabeza sin doblar el codo?",
  "¿Puede llevar unos 9 kg colgando del brazo afectado, junto al cuerpo?",
  "¿Cree que podría lanzar una pelota por debajo del hombro a unos 9 metros con el brazo afectado?",
  "¿Cree que podría lanzar una pelota por encima del hombro a unos 18 metros con el brazo afectado?",
  "¿Puede lavarse la parte de atrás del hombro contrario con el brazo afectado?",
  "¿Su hombro le permitiría trabajar a jornada completa en su trabajo habitual?",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

/** Porcentaje con coma decimal, para el texto. */
const pct = (yes: number, n: number) => String(round1((yes / n) * 100)).replace(".", ",");

export const form: QuestionForm = {
  id: "sst",
  instructions: "Responda sí o no a cada pregunta pensando en su hombro afectado.",
  sections: [{ title: "Su hombro", items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS })) }],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const yes = values.reduce((s, v) => s + v, 0);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      // La nota de 0 a 12 solo con las 12; con alguna en blanco, la ficha pide enseñar solo el % sobre las respondidas.
      const partial = values.length ? ` Sobre las ${values.length} respondidas, ${pct(yes, values.length)} % de «sí».` : "";
      throw new RangeError(`Faltan ${missing} de las 12 respuestas: el SST necesita todas para dar la nota de 0 a 12.${partial}`);
    }
    return {
      score: yes,
      // No está en el catálogo: sin máximo, se lee como porcentaje.
      subscores: [{ name: "Porcentaje de «sí»", score: round1((yes / IDS.length) * 100) }],
    };
  },
  source:
    "Lippitt et al., 1993 (original, capítulo de libro; referencia sin verificar, no está en PubMed); Membrilla-Mesa et al., 2015 (validación española), DOI 10.1007/s11136-014-0760-2. Texto de trabajo fiel al original: revisar con la versión española publicada (Membrilla-Mesa et al., 2015) antes de usarlo en consulta.",
};
