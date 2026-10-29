// Short FES-I (Falls Efficacy Scale-International, versión corta): preocupación por caerse en 7 actividades, de 1 a 4;
// nota 7-28, menos es mejor. Con 1 ítem sin contestar se prorratea; con 2 o más no se calcula.
import { answered, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 1, label: "Nada preocupado/a" },
  { value: 2, label: "Algo preocupado/a" },
  { value: 3, label: "Bastante preocupado/a" },
  { value: 4, label: "Muy preocupado/a" },
];

const TEXTS = [
  "Vestirse o desvestirse",
  "Bañarse o ducharse",
  "Sentarse o levantarse de una silla",
  "Subir o bajar escaleras",
  "Alcanzar algo por encima de la cabeza o del suelo",
  "Subir o bajar una cuesta",
  "Salir a un acto social (por ejemplo, un oficio religioso, una reunión familiar o una reunión de una asociación)",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);

export const form: QuestionForm = {
  id: "short_fes_i",
  instructions:
    "Nos gustaría hacerle algunas preguntas sobre su preocupación por la posibilidad de caerse. Para cada actividad, conteste pensando en cómo la hace normalmente. Si ahora no hace la actividad (por ejemplo, si otra persona le hace la compra), conteste según lo preocupado/a que cree que estaría por caerse SI la hiciera.",
  sections: [
    {
      title: "¿Le preocupa la posibilidad de caerse al…?",
      items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS })),
    },
  ],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > 1) {
      throw new RangeError(`Faltan ${missing} de las 7 respuestas: la Short FES-I necesita al menos 6 para calcular la nota.`);
    }
    const sum = values.reduce((s, v) => s + v, 0);
    // Regla del manual FES-I: con 1 ítem sin contestar, media de los contestados × 7, redondeada.
    const total = missing === 0 ? sum : Math.round((sum / values.length) * 7);
    return { score: total };
  },
  source:
    "Kempen et al., 2008 (original), DOI 10.1093/ageing/afm157; González Montaos et al., 2024 (validación española), DOI 10.1016/j.regg.2023.101436; Delbaere et al., 2010 (puntos de corte), DOI 10.1093/ageing/afp225. El grupo FES-I publica la traducción oficial española: conviene usar ese texto. Texto de trabajo fiel al original: revisar con la versión española publicada antes de usarlo en consulta.",
};
