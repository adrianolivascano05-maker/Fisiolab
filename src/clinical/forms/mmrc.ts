// mMRC (escala de disnea modificada del Medical Research Council): un solo ítem con 5 grados de falta de aire en la
// vida diaria; nota 0-4 (el número del grado), menos es mejor. Grado mMRC = grado MRC original (1-5) − 1.
import type { Answers, QuestionForm } from "./types";

export const form: QuestionForm = {
  id: "mmrc",
  instructions: "Marque la frase que mejor describa su falta de aire.",
  sections: [
    {
      title: "Falta de aire",
      items: [
        {
          id: "g",
          text: "Marque la frase que mejor describa su falta de aire.",
          options: [
            { value: 0, label: "Solo me falta el aire al hacer un ejercicio intenso." },
            { value: 1, label: "Me falta el aire al andar deprisa en llano o al subir una cuesta poco pronunciada." },
            {
              value: 2,
              label:
                "Por la falta de aire, ando en llano más despacio que otras personas de mi edad, o tengo que pararme a respirar cuando ando a mi paso en llano.",
            },
            { value: 3, label: "Tengo que pararme a respirar después de andar unos 100 metros o tras unos pocos minutos en llano." },
            { value: 4, label: "Me falta tanto el aire que no puedo salir de casa, o me falta el aire al vestirme o desvestirme." },
          ],
        },
      ],
    },
  ],
  score(answers: Answers) {
    const grade = answers.g;
    if (typeof grade !== "number") throw new RangeError("Falta la respuesta: la mMRC necesita que marque una frase.");
    return { score: grade };
  },
  source:
    "Fletcher et al., 1959 (original), DOI 10.1136/bmj.2.5147.257; Bestall et al., 1999 (validación clínica), DOI 10.1136/thx.54.7.581; sin validación española en PubMed. Texto de trabajo fiel al original: no hay versión española validada, así que hay que revisarlo antes de usarlo en consulta.",
};
