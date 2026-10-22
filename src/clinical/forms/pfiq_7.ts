// PFIQ-7 (Pelvic Floor Impact Questionnaire-7): impacto de los síntomas en 7 preguntas, cada una contestada en 3
// columnas (vejiga, intestino, vagina o pelvis), de 0 a 3; tres subescalas de 0 a 100; nota 0-300, menos es mejor.
import { answered, round1, type Answers, type Option, type QuestionForm, type Section } from "./types";

const OPTIONS: Option[] = [
  { value: 0, label: "Nada" },
  { value: 1, label: "Un poco" },
  { value: 2, label: "Moderadamente" },
  { value: 3, label: "Bastante" },
];

const TEXTS = [
  "…capacidad para hacer las tareas de casa (cocinar, limpiar, lavar la ropa)?",
  "…capacidad para hacer actividades físicas como caminar, nadar u otro ejercicio?",
  "…ocio, como ir al cine o a un concierto?",
  "…capacidad para viajar en coche o autobús a más de 30 minutos de casa?",
  "…participación en actividades sociales fuera de casa?",
  "…salud emocional (nervios, depresión, etc.)?",
  "…sensación de frustración?",
];

/** Cada columna es una subescala: su nombre, el prefijo de sus ids y lo que se pregunta. */
const COLUMNS: { name: string; prefix: string; title: string; about: string }[] = [
  { name: "UIQ-7", prefix: "u", title: "Vejiga u orina", about: "la vejiga u orina" },
  { name: "CRAIQ-7", prefix: "c", title: "Intestino o recto", about: "el intestino o recto" },
  { name: "POPIQ-7", prefix: "p", title: "Vagina o pelvis", about: "la vagina o pelvis" },
];

const sections: Section[] = COLUMNS.map((c) => ({
  title: c.title,
  intro: `¿En qué medida los síntomas o problemas relacionados con ${c.about} afectan normalmente a su…?`,
  items: TEXTS.map((text, i) => ({ id: `${c.prefix}${i + 1}`, text, options: OPTIONS })),
}));

export const form: QuestionForm = {
  id: "pfiq_7",
  instructions:
    "Algunas mujeres notan que los síntomas de la vejiga, del intestino o de la vagina afectan a sus actividades, sus relaciones y sus sentimientos. Para cada pregunta, marque la respuesta que mejor describa cuánto le han afectado los síntomas de vejiga, de intestino o de vagina en los últimos 3 meses. Conteste en cada una de las 3 columnas.",
  sections,
  score(answers: Answers) {
    // Cada subescala: media de sus respuestas contestadas × 100/3 (las que quedan en blanco no cuentan).
    const parts = COLUMNS.map((c, i) => {
      const values = answered(answers, sections[i].items.map((it) => it.id));
      return { name: c.name, raw: values.length ? ((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 3 : null };
    });
    const empty = parts.filter((p) => p.raw === null).map((p) => p.name);
    if (empty.length) {
      throw new RangeError(`Faltan respuestas: el PFIQ-7 necesita al menos una respuesta de cada columna (falta ${empty.join(", ")}).`);
    }
    const total = parts.reduce((s, p) => s + p.raw!, 0);
    return { score: round1(total), subscores: parts.map((p) => ({ name: p.name, score: round1(p.raw!), max: 100 })) };
  },
  source:
    "Barber et al., 2005 (original), DOI 10.1016/j.ajog.2004.12.025; Sánchez-Sánchez et al., 2013 (validación española), DOI 10.1016/j.ejogrb.2013.07.006. Texto de trabajo fiel al original: revisar con la versión española publicada antes de usarlo en consulta.",
};
