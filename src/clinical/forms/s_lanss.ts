// S-LANSS (escala autoadministrada de Leeds): dolor de origen predominantemente neuropático en 7 ítems de sí o no
// (5 de síntomas y 2 de autoexploración), cada «sí» con su peso; nota 0-24, menos es mejor. Desde 12, probable dolor
// neuropático. El dibujo de la zona y la escala 0-10 del original no suman y no se incluyen.
import { answered, round1, type Answers, type Item, type Option, type QuestionForm } from "./types";

/** «No» puntúa 0 y «Sí», el peso del ítem. */
const yesNo = (yes: number): Option[] => [
  { value: 0, label: "No" },
  { value: yes, label: "Sí" },
];
const SAME = "La zona dolorosa no se nota diferente de la zona sin dolor";

const items: Item[] = [
  {
    id: "i1",
    text: "En la zona donde tiene dolor, ¿nota también sensación de alfileres y agujas, hormigueo o pinchazos?",
    options: yesNo(5),
  },
  {
    id: "i2",
    text: "¿Cambia de color la zona dolorosa (por ejemplo, se ve más roja o con manchas) cuando el dolor es especialmente fuerte?",
    options: yesNo(5),
  },
  {
    id: "i3",
    text: "¿Hace el dolor que la piel de la zona afectada sea anormalmente sensible al tacto? Por ejemplo, notar sensaciones desagradables o dolor al rozar la piel suavemente.",
    options: yesNo(3),
  },
  {
    id: "i4",
    text: "¿Aparece el dolor de repente y en forma de ráfagas, sin motivo aparente, cuando está completamente quieto? Palabras como «descargas eléctricas», «saltos» o «estallidos» podrían describirlo.",
    options: yesNo(2),
  },
  {
    id: "i5",
    text: "En la zona donde tiene dolor, ¿nota la piel anormalmente caliente, como un dolor que quema?",
    options: yesNo(1),
  },
  {
    id: "i6",
    text: "Frote suavemente la zona dolorosa con el dedo índice y después frote una zona sin dolor (por ejemplo, una zona de piel más alejada o del lado contrario). ¿Cómo nota este roce en la zona dolorosa?",
    options: [
      { value: 0, label: SAME },
      { value: 5, label: "Noto molestias en la zona dolorosa, como alfileres y agujas, hormigueo o quemazón, distintas de la zona sin dolor" },
    ],
  },
  {
    id: "i7",
    text: "Presione suavemente la zona dolorosa con la yema del dedo y después presione de la misma manera una zona sin dolor (la misma que eligió en la pregunta anterior). ¿Cómo nota esto en la zona dolorosa?",
    options: [
      { value: 0, label: SAME },
      { value: 3, label: "Noto adormecimiento o sensibilidad dolorosa en la zona dolorosa, distinta de la zona sin dolor" },
    ],
  },
];

const IDS = items.map((i) => i.id);

/** Desde esta nota, probable dolor de origen neuropático (punto de corte óptimo de la validación española). */
const CUTOFF = 12;

export const form: QuestionForm = {
  id: "s_lanss",
  instructions:
    "Este cuestionario nos ayuda a saber qué tipo de dolor tiene. Piense en cómo ha sentido el dolor durante la última semana. Marque la respuesta que mejor describa su dolor. En las preguntas 6 y 7 se le pide que se toque suavemente la piel.",
  sections: [
    { title: "Síntomas", items: items.slice(0, 5) },
    { title: "Autoexploración", items: items.slice(5) },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 7 respuestas: la S-LANSS necesita todas para calcular la nota.`);
    }
    const total = round1(values.reduce((s, v) => s + v, 0));
    return {
      score: total,
      text:
        total >= CUTOFF
          ? `Probable dolor de origen neuropático (${CUTOFF} o más)`
          : `Por debajo del punto de corte de dolor neuropático (menos de ${CUTOFF})`,
    };
  },
  source:
    "Bennett et al., 2005 (S-LANSS original), DOI 10.1016/j.jpain.2004.11.007; López-de-Uralde-Villanueva et al., 2016 (validación española), DOI 10.1016/j.nrl.2016.10.009. Texto de trabajo fiel al original: revisar con la versión española publicada (López-de-Uralde-Villanueva et al., 2016) antes de usarlo en consulta.",
};
