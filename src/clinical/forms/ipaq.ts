// IPAQ corto (International Physical Activity Questionnaire, últimos 7 días): actividad intensa, moderada y caminar.
// Nota en MET-min/semana según su protocolo de puntuación; el tiempo sentado no puntúa.
import { round1, type Answers, type FormScore, type Item, type QuestionForm } from "./types";

const DAYS: Item["scale"] = { from: 0, to: 7, ends: ["Ningún día", "Los 7 días"] };
const MINUTES: Item["input"] = { min: 0, max: 960, unit: "min" };
const HOW_LONG = "Escríbalo en minutos (por ejemplo, hora y media = 90). Si ha contestado 0 días, déjela en blanco.";

/** Las tres actividades: sus ítems (días y minutos al día) y su gasto en MET. */
const ACTIVITIES = [
  { name: "intensa", days: "i1", minutes: "i2", met: 8 },
  { name: "moderada", days: "i3", minutes: "i4", met: 4 },
  { name: "caminar", days: "i5", minutes: "i6", met: 3.3 },
];

/** Tope de la escala en ../questionnaires.ts (con el truncado a 180 min, el máximo real es 19 278). */
const MAX = 20000;

type Clean = { days: number; minutes: number; met: number };

/** Días y minutos de una actividad, ya limpios: menos de 10 min al día no cuenta (ni sus días); más de 180, a 180. */
function clean(a: Answers, act: (typeof ACTIVITIES)[number]): Clean {
  const days = a[act.days];
  if (typeof days !== "number") {
    throw new RangeError("Faltan respuestas: conteste cuántos días hizo actividad intensa, moderada y caminó (0 si ninguno).");
  }
  if (days === 0) return { days: 0, minutes: 0, met: 0 };
  const raw = a[act.minutes];
  if (typeof raw !== "number") {
    throw new RangeError(
      act.name === "caminar"
        ? "Falta cuánto tiempo caminó al día los días que lo hizo."
        : `Falta cuánto tiempo dedicó al día a la actividad ${act.name} los días que la hizo.`,
    );
  }
  if (raw < 10) return { days: 0, minutes: 0, met: 0 };
  const minutes = Math.min(raw, 180);
  return { days, minutes, met: act.met * minutes * days };
}

function score(a: Answers): FormScore {
  const [vig, mod, walk] = ACTIVITIES.map((act) => clean(a, act));
  const total = vig.met + mod.met + walk.met;
  // Primero a un decimal: en coma flotante 3,3 × 29 × 5 da 478,4999… y redondearía hacia abajo.
  return { score: Math.min(Math.round(round1(total)), MAX) };
}

export const form: QuestionForm = {
  id: "ipaq",
  instructions:
    "Le preguntamos por la actividad física que ha hecho en los últimos 7 días: en el trabajo, en casa, para ir de un sitio a otro y en su tiempo libre. Cuente solo la que hizo durante al menos 10 minutos seguidos. Conteste aunque no se considere una persona activa.",
  sections: [
    {
      title: "Actividad intensa",
      intro: "Actividades intensas son las que exigen un gran esfuerzo físico y le hacen respirar mucho más fuerte de lo normal.",
      items: [
        {
          id: "i1",
          text: "En los últimos 7 días, ¿cuántos días hizo actividades físicas intensas, como levantar cosas pesadas, cavar, hacer aeróbic o ir en bicicleta deprisa?",
          scale: DAYS,
        },
        { id: "i2", text: `Esos días, ¿cuánto tiempo dedicó normalmente cada día a actividades intensas? ${HOW_LONG}`, input: MINUTES },
      ],
    },
    {
      title: "Actividad moderada",
      intro: "Actividades moderadas son las que exigen un esfuerzo físico moderado y le hacen respirar algo más fuerte de lo normal.",
      items: [
        {
          id: "i3",
          text: "En los últimos 7 días, ¿cuántos días hizo actividades físicas moderadas, como llevar cargas ligeras, ir en bicicleta a ritmo normal o jugar al tenis por parejas? No cuente el caminar.",
          scale: DAYS,
        },
        { id: "i4", text: `Esos días, ¿cuánto tiempo dedicó normalmente cada día a actividades moderadas? ${HOW_LONG}`, input: MINUTES },
      ],
    },
    {
      title: "Caminar",
      intro: "Cuente lo que camina en el trabajo y en casa, para ir de un sitio a otro y por ocio, deporte o ejercicio.",
      items: [
        { id: "i5", text: "En los últimos 7 días, ¿cuántos días caminó durante al menos 10 minutos seguidos?", scale: DAYS },
        { id: "i6", text: `Esos días, ¿cuánto tiempo caminó normalmente cada día? ${HOW_LONG}`, input: MINUTES },
      ],
    },
    {
      title: "Tiempo sentado",
      intro:
        "Cuente el tiempo que pasa sentado en el trabajo, en casa, estudiando y en su tiempo libre: en una mesa, de visita, leyendo, en el autobús o el coche, o sentado o tumbado viendo la televisión.",
      items: [
        {
          id: "i7",
          text: "En los últimos 7 días, ¿cuánto tiempo pasó sentado, por lo general, en un día entre semana? Escríbalo en minutos (por ejemplo, 6 horas = 360).",
          input: { min: 0, max: 1440, unit: "min" },
        },
      ],
    },
  ],
  score,
  source: "Craig et al., 2003 (IPAQ, versión corta de los últimos 7 días; protocolo de puntuación IPAQ, 2005). Texto de trabajo: revisar con la versión española publicada.",
};
