/**
 * VÍDEO · «Fibromialgia y túnel carpiano: ¿qué va primero?» (Fitzcharles 2026 · reel 13 · lectura crítica).
 * Hilo: caso (fibro + muñeca: «encaja con un túnel carpiano») → quién lo dice (revisión narrativa + casos y controles) →
 * las odds ratios → quiz «¿qué va primero?» → una odds ratio dice que van juntas, no el orden ni la causa →
 * más uso sanitario y más cirugías (dato del paper) + hipótesis nuestra marcada como tal → asociación ≠ causa →
 * qué hacer mañana → CTA.
 */
import type { SceneDef, VideoMeta } from "../../config";

export const META: VideoMeta = {
  id: "Carpiano",
  titulo: "Fibromialgia y túnel carpiano: ¿qué va primero?",
  pilar: "Lectura crítica",
  fuente: "Fuente: Fitzcharles et al., Nat Rev Rheumatol 2026 (Magen et al., J Hand Ther 2025)",
  portada: { linea1: "Fibro y túnel carpiano:", dato: "¿qué va primero?", sub: "LO QUE NO TE DICE UNA ODDS RATIO" },
  coldOpen: { big: "OR 2,98", small: "fibromialgia y túnel carpiano" },
};

export type SceneId = "gancho" | "prueba" | "datos" | "quiz" | "hallazgo" | "giro" | "matiz" | "quehacer" | "cta";

/** Guion. Debe coincidir con public/carpiano/voz/guion.txt (lo genera tools/guion.mjs). */
export const SCENES: (SceneDef & { id: SceneId })[] = [
  {
    id: "gancho",
    sentences: [
      { text: "Paciente con fibromialgia y dolor en la muñeca.", chunks: ["Paciente con fibromialgia", "y dolor en la muñeca."], keys: ["fibromialgia", "muñeca"] },
      { text: "Encaja con un túnel carpiano.", keys: ["túnel", "carpiano"] },
      { text: "¿Caso cerrado?", keys: ["cerrado"] },
    ],
  },
  {
    id: "prueba",
    sentences: [
      {
        text: "Lo cita una revisión narrativa de dos mil veintiséis, del grupo Nature.",
        chunks: ["Lo cita una revisión narrativa", "de dos mil veintiséis, del grupo Nature."],
        keys: ["narrativa", "2026", "Nature"],
        display: { "dos mil veintiséis": "2026" },
      },
      {
        text: "El estudio original es de casos y controles, con nueve mil doscientas treinta y dos personas con fibromialgia.",
        chunks: ["El estudio original es de casos y controles,", "con nueve mil doscientas treinta y dos", "personas con fibromialgia."],
        keys: ["casos", "9.232", "fibromialgia"],
        display: { "nueve mil doscientas treinta y dos": "9.232" },
      },
    ],
  },
  {
    id: "datos",
    sentences: [
      {
        text: "Túnel carpiano: odds ratio de dos coma noventa y ocho.",
        chunks: ["Túnel carpiano:", "odds ratio de dos coma noventa y ocho."],
        keys: ["carpiano", "2,98"],
        display: { "dos coma noventa y ocho": "2,98" },
      },
      { text: "Casi el triple.", keys: ["triple"] },
      {
        text: "Y también suben el dedo en resorte, el De Quervain, la tendinitis y la artrosis de mano.",
        chunks: ["Y también suben el dedo en resorte,", "el De Quervain, la tendinitis", "y la artrosis de mano."],
        keys: ["resorte", "Quervain", "tendinitis", "artrosis"],
      },
    ],
  },
  {
    id: "quiz",
    sentences: [{ text: "Entonces, ¿qué va primero?", keys: ["qué", "primero"] }],
  },
  {
    id: "hallazgo",
    sentences: [
      { text: "Una odds ratio solo dice que van juntas.", keys: ["solo", "juntas"] },
      { text: "No dice cuál llega antes, ni cuál causa a cuál.", chunks: ["No dice cuál llega antes,", "ni cuál causa a cuál."], keys: ["antes", "causa"] },
    ],
  },
  {
    id: "giro",
    sentences: [
      {
        text: "Y hay otro dato: estas personas usaban más el sistema sanitario, y se operaban más.",
        chunks: ["Y hay otro dato:", "estas personas usaban más el sistema sanitario,", "y se operaban más."],
        keys: ["dato", "sanitario", "operaban"],
      },
      {
        text: "Una explicación posible, que no da la revisión: a más consultas, más diagnósticos.",
        chunks: ["Una explicación posible,", "que no da la revisión:", "a más consultas, más diagnósticos."],
        keys: ["posible", "revisión", "consultas", "diagnósticos"],
      },
    ],
  },
  {
    id: "matiz",
    sentences: [{ text: "Ojo: es una asociación, no una causa.", chunks: ["Ojo: es una asociación,", "no una causa."], keys: ["asociación", "causa"] }],
  },
  {
    id: "quehacer",
    sentences: [
      {
        text: "Mañana en consulta: confirma el túnel carpiano con la exploración.",
        chunks: ["Mañana en consulta:", "confirma el túnel carpiano", "con la exploración."],
        keys: ["confirma", "exploración"],
      },
      { text: "Y mira si el dolor sigue el recorrido del nervio.", chunks: ["Y mira si el dolor", "sigue el recorrido del nervio."], keys: ["recorrido", "nervio"] },
    ],
  },
  {
    id: "cta",
    sentences: [
      {
        text: 'Comenta qué crees que va primero: "mano" o "fibro".',
        chunks: ["Comenta qué crees", "que va primero:", '"mano" o "fibro".'],
        keys: ["Comenta", "primero", "mano", "fibro"],
      },
    ],
  },
];

/** Datos verificados en Fitzcharles 2026 (Nat Rev Rheumatol, doi:10.1038/s41584-026-01443-w), apartado «Soft-tissue
 *  conditions» (ref. 113: Magen et al., J Hand Ther 2025, doi:10.1016/j.jht.2025.07.003): estudio de casos y controles con
 *  9.232 personas con fibromialgia; OR túnel carpiano 2,98 · dedo en resorte 1,77 · De Quervain 1,96 · tendinitis 2,16 ·
 *  artrosis de mano 2,99 (todas P < 0,001); «also had higher healthcare utilization and surgery rates». La revisión NO da IC,
 *  controles ni discute el sesgo de detección: esa explicación se presenta como hipótesis nuestra. */
export const DATA = {
  n: "9.232",
  ors: [
    { label: "Túnel carpiano", v: 2.98 },
    { label: "Artrosis de mano", v: 2.99 },
    { label: "Tendinitis", v: 2.16 },
    { label: "De Quervain", v: 1.96 },
    { label: "Dedo en resorte", v: 1.77 },
  ],
  quiz: ["LA FIBRO", "LA MANO", "NO SE SABE"],
};

/** Escena en la que la música hace el hueco de silencio antes del dato fuerte. */
export const DATA_SCENE = "hallazgo";
