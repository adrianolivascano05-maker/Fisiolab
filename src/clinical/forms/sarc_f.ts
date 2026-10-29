// SARC-F: cribado de sarcopenia en 5 preguntas de 0 a 2 (fuerza, ayuda para caminar, levantarse de una silla, subir
// escaleras y caídas); nota 0-10, menos es mejor; 4 o más es cribado positivo.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const IDS = ["i1", "i2", "i3", "i4", "i5"];

export const form: QuestionForm = {
  id: "sarc_f",
  instructions: "Conteste a estas preguntas sobre sus actividades de cada día. Elija la respuesta que mejor describa su situación.",
  sections: [
    {
      title: "Sus actividades de cada día",
      items: [
        {
          id: "i1",
          text: "Fuerza: ¿Qué dificultad tiene para levantar y llevar 4,5 kg (por ejemplo, una bolsa de la compra pesada)?",
          options: [
            { value: 0, label: "Ninguna" },
            { value: 1, label: "Alguna" },
            { value: 2, label: "Mucha o no puedo" },
          ],
        },
        {
          id: "i2",
          text: "Ayuda para caminar: ¿Qué dificultad tiene para cruzar caminando una habitación?",
          options: [
            { value: 0, label: "Ninguna" },
            { value: 1, label: "Alguna" },
            { value: 2, label: "Mucha, necesito ayuda (bastón, andador) o no puedo" },
          ],
        },
        {
          id: "i3",
          text: "Levantarse de una silla: ¿Qué dificultad tiene para pasar de una silla o de la cama a estar de pie?",
          options: [
            { value: 0, label: "Ninguna" },
            { value: 1, label: "Alguna" },
            { value: 2, label: "Mucha o no puedo sin ayuda" },
          ],
        },
        {
          id: "i4",
          text: "Subir escaleras: ¿Qué dificultad tiene para subir un tramo de 10 escalones?",
          options: [
            { value: 0, label: "Ninguna" },
            { value: 1, label: "Alguna" },
            { value: 2, label: "Mucha o no puedo" },
          ],
        },
        {
          id: "i5",
          text: "Caídas: ¿Cuántas veces se ha caído en el último año?",
          options: [
            { value: 0, label: "Ninguna" },
            { value: 1, label: "De 1 a 3 caídas" },
            { value: 2, label: "4 caídas o más" },
          ],
        },
      ],
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 0) {
      throw new RangeError(`Faltan ${missing} de las 5 respuestas: el SARC-F necesita todas (sin ellas, el cribado queda incompleto).`);
    }
    const total = round1(values.reduce((s, v) => s + v, 0));
    return { score: total };
  },
  source:
    "Malmstrom y Morley, 2013 (original), DOI 10.1016/j.jamda.2013.05.018; Parra-Rodríguez et al., 2016 (validación al español, México), DOI 10.1016/j.jamda.2016.09.008; Malmstrom et al., 2016 (punto de corte), DOI 10.1002/jcsm.12048. Texto de trabajo fiel al original: revisar con la versión española publicada (la validación es mexicana) antes de usarlo en consulta.",
};
