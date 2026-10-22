// CAIT (Cumberland Ankle Instability Tool): inestabilidad crónica de tobillo en 9 ítems que se contestan para cada
// tobillo por separado; nota 0-30 por tobillo (cada una se guarda aparte), más es mejor (más estable).
import { answered, type Answers, type Item, type Option, type QuestionForm } from "./types";

/**
 * «Nunca me he torcido el tobillo» (ítems 8 y 9) puntúa 3, lo mismo que la primera respuesta. Se guarda con este otro
 * valor para que la app distinga cuál de las dos se marcó (con el mismo valor se marcarían las dos a la vez).
 */
export const NEVER_SPRAINED = -1;
const NEVER_SPRAINED_POINTS = 3;

const options = (rows: [number, string][]): Option[] => rows.map(([value, label]) => ({ value, label }));
const NEVER: [number, string] = [NEVER_SPRAINED, "Nunca me he torcido el tobillo"];

/** Los 9 ítems: texto y respuestas con sus puntos. */
const ROWS: [string, Option[]][] = [
  [
    "Tengo dolor en el tobillo",
    options([
      [5, "Nunca"],
      [4, "Al hacer deporte"],
      [3, "Al correr por terreno irregular"],
      [2, "Al correr por terreno llano"],
      [1, "Al caminar por terreno irregular"],
      [0, "Al caminar por terreno llano"],
    ]),
  ],
  [
    "Noto el tobillo INESTABLE",
    options([
      [4, "Nunca"],
      [3, "A veces al hacer deporte (no siempre)"],
      [2, "Con frecuencia al hacer deporte (siempre)"],
      [1, "A veces en las actividades diarias"],
      [0, "Con frecuencia en las actividades diarias"],
    ]),
  ],
  [
    "Cuando hago giros BRUSCOS, noto el tobillo INESTABLE",
    options([
      [3, "Nunca"],
      [2, "A veces, al correr"],
      [1, "A menudo, al correr"],
      [0, "Al caminar"],
    ]),
  ],
  [
    "Al bajar escaleras, noto el tobillo INESTABLE",
    options([
      [3, "Nunca"],
      [2, "Si bajo deprisa"],
      [1, "De vez en cuando"],
      [0, "Siempre"],
    ]),
  ],
  [
    "Noto el tobillo INESTABLE al estar de pie sobre UNA pierna",
    options([
      [2, "Nunca"],
      [1, "De puntillas"],
      [0, "Con el pie plano"],
    ]),
  ],
  [
    "Noto el tobillo INESTABLE cuando…",
    options([
      [3, "Nunca"],
      [2, "Salto de un lado a otro"],
      [1, "Salto en el sitio"],
      [0, "Salto"],
    ]),
  ],
  [
    "Noto el tobillo INESTABLE cuando…",
    options([
      [4, "Nunca"],
      [3, "Corro por terreno irregular"],
      [2, "Troto por terreno irregular"],
      [1, "Camino por terreno irregular"],
      [0, "Camino por terreno llano"],
    ]),
  ],
  [
    "NORMALMENTE, cuando empiezo a torcerme el tobillo, puedo pararlo",
    options([
      [3, "De inmediato"],
      [2, "A menudo"],
      [1, "A veces"],
      [0, "Nunca"],
      NEVER,
    ]),
  ],
  [
    "Después de una torcedura TÍPICA, mi tobillo vuelve a la «normalidad»",
    options([
      [3, "Casi de inmediato"],
      [2, "En menos de un día"],
      [1, "En 1–2 días"],
      [0, "En más de 2 días"],
      NEVER,
    ]),
  ],
];

/** Cada tobillo: prefijo de sus ítems y nombre de su nota (el de la subescala en el catálogo). */
const SIDES: [string, string][] = [
  ["i", "Tobillo izquierdo"],
  ["d", "Tobillo derecho"],
];
const idsOf = (prefix: string) => ROWS.map((_, i) => `${prefix}${i + 1}`);
const items = (prefix: string): Item[] => ROWS.map(([text, opts], i) => ({ id: `${prefix}${i + 1}`, text, options: opts }));

/** Puntos de corte: 25 o menos, el recalibrado y recomendado (Wright et al. 2014); 27 o menos, el original (Hiller et al. 2006). */
const RECOMMENDED_CUTOFF = 25;
const ORIGINAL_CUTOFF = 27;
const reading = (n: number) =>
  n <= RECOMMENDED_CUTOFF
    ? "indica inestabilidad crónica de tobillo (25 o menos, punto de corte recomendado)"
    : n <= ORIGINAL_CUTOFF
      ? "por encima del punto de corte recomendado (25 o menos), pero indica inestabilidad con el original (27 o menos)"
      : "por encima de los dos puntos de corte de inestabilidad (25 o menos, el recomendado; 27 o menos, el original)";

export const form: QuestionForm = {
  id: "cait",
  instructions: "Marque la frase que MEJOR describa su tobillo en cada pregunta. Responda por separado para el tobillo izquierdo y el derecho.",
  sections: SIDES.map(([prefix, title]) => ({ title, items: items(prefix) })),
  score(answers: Answers) {
    const subscores: { name: string; score: number }[] = [];
    const notes: string[] = [];
    const missing: { name: string; n: number }[] = [];
    for (const [prefix, name] of SIDES) {
      const values = answered(answers, idsOf(prefix));
      const n = ROWS.length - values.length;
      // Sin prorrateo: con un ítem sin contestar, ese tobillo no tiene nota.
      if (n > 0) {
        missing.push({ name, n });
        if (values.length > 0) notes.push(`${name}: faltan ${n} de las 9 respuestas, sin nota`);
        continue;
      }
      const score = values.reduce((s, v) => s + (v === NEVER_SPRAINED ? NEVER_SPRAINED_POINTS : v), 0);
      subscores.push({ name, score });
      notes.push(`${name} (${score}): ${reading(score)}`);
    }
    if (!subscores.length) {
      const fewest = missing.reduce((a, b) => (b.n < a.n ? b : a));
      throw new RangeError(
        fewest.n === ROWS.length
          ? "Faltan las 9 respuestas de cada tobillo: el CAIT necesita las 9 de al menos un tobillo para calcular su nota (no se prorratea)."
          : `Faltan ${fewest.n} de las 9 respuestas del ${fewest.name.toLowerCase()}: el CAIT necesita las 9 de un tobillo para calcular su nota (no se prorratea).`,
      );
    }
    return { score: null, subscores, text: notes.join(" · ") };
  },
  source:
    "Hiller et al., 2006 (original), DOI 10.1016/j.apmr.2006.05.022; Cruz-Díaz et al., 2013 (validación española), DOI 10.1007/s10067-012-2095-0; Rodríguez-Fernández et al., 2015 (validación española), DOI 10.3109/09638288.2014.984879; Wright et al., 2014 (punto de corte), DOI 10.1016/j.apmr.2014.04.017. Texto de trabajo fiel al original: revisar con la versión española publicada (Cruz-Díaz et al., 2013) antes de usarlo en consulta.",
};
