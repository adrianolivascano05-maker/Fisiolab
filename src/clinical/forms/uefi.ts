// UEFI-20 (Upper Extremity Functional Index): 20 actividades del miembro superior, de 0 a 4; nota 0-80, más es mejor.
// Con 1 o 2 en blanco se prorratea; con más no se calcula.
import { answered, round1, type Answers, type QuestionForm } from "./types";

const OPTIONS = [
  { value: 0, label: "Dificultad extrema o incapaz de hacerlo" },
  { value: 1, label: "Mucha dificultad" },
  { value: 2, label: "Dificultad moderada" },
  { value: 3, label: "Poca dificultad" },
  { value: 4, label: "Ninguna dificultad" },
];

const TEXTS = [
  "Cualquiera de sus tareas habituales del trabajo, de casa o de estudio",
  "Sus aficiones habituales, actividades de ocio o deportivas",
  "Levantar una bolsa de la compra hasta la cintura",
  "Levantar una bolsa de la compra por encima de la cabeza",
  "Peinarse o arreglarse el pelo",
  "Apoyarse en las manos para incorporarse (por ejemplo, para salir de la bañera o levantarse de una silla)",
  "Preparar comida (por ejemplo, pelar o cortar)",
  "Conducir",
  "Pasar la aspiradora, barrer o rastrillar",
  "Vestirse",
  "Abrocharse botones",
  "Usar herramientas o electrodomésticos",
  "Abrir puertas",
  "Limpiar",
  "Atarse los cordones de los zapatos",
  "Dormir",
  "Lavar la ropa (por ejemplo, lavar, planchar, doblar)",
  "Abrir un tarro",
  "Lanzar una pelota",
  "Llevar una maleta pequeña con el brazo afectado",
];

const IDS = TEXTS.map((_, i) => `i${i + 1}`);
/** Respuestas que pueden faltar como mucho (convención práctica de la ficha, no de los autores). */
const MAX_MISSING = 2;

export const form: QuestionForm = {
  id: "uefi",
  instructions:
    "Nos interesa saber si tiene alguna dificultad, por el problema de su brazo, para hacer las actividades que se enumeran a continuación. Responda a cada actividad pensando en cómo se encuentra hoy.",
  sections: [{ title: "Actividades", items: TEXTS.map((text, i) => ({ id: IDS[i], text, options: OPTIONS })) }],
  score(answers: Answers) {
    const values = answered(answers, IDS);
    const missing = IDS.length - values.length;
    if (missing > MAX_MISSING) {
      throw new RangeError(`Faltan ${missing} de las 20 respuestas: el UEFI necesita al menos 18 para calcular la nota.`);
    }
    // Suma × 20 / nº de respondidas: con las 20, la suma tal cual.
    const sum = values.reduce((s, v) => s + v, 0);
    return { score: round1((sum * IDS.length) / values.length) };
  },
  source:
    "Stratford et al., 2001 (original, Physiother Can; referencia sin verificar, no está en PubMed); Chesworth et al., 2014 (MCID), DOI 10.3138/ptc.2013-45; sin validación española en PubMed. Texto de trabajo fiel al original, sin versión española validada: revisarlo antes de usarlo en consulta.",
};
