/**
 * VÍDEO 3 · «El 91,4 % del test del 4: leímos el original» (Custers 2024 · reel 6, corregido con Telli 2018).
 * Lectura crítica: la revisión fecha mal el estudio y presenta como «sensibilidad» lo que es
 * el porcentaje de positivos entre pacientes ya diagnosticados con esos mismos tests.
 */
import type { SceneDef, VideoMeta } from "../../config";

export const META: VideoMeta = {
  id: "Sacroiliaca",
  titulo: "El 91,4 % del test del 4: leímos el original",
  pilar: "Lectura crítica",
  fuente: "Fuente: Telli et al., Pain Physician 2018 · Custers et al., Life 2024",
  portada: { linea1: "El test del 4 detecta el", dato: "91,4 %", sub: "¿SEGURO? LEÍMOS EL ORIGINAL" },
  coldOpen: { big: "91,4 %", small: "¿de verdad lo detecta el test del 4?" },
};

export type SceneId = "gancho" | "prueba" | "estudio" | "quiz" | "hallazgo" | "giro" | "matiz" | "quehacer" | "cta";

/** Guion. Debe coincidir con public/sacroiliaca/voz/guion.txt (lo genera tools/guion.mjs). */
export const SCENES: (SceneDef & { id: SceneId })[] = [
  {
    id: "gancho",
    sentences: [
      {
        text: "Noventa y uno coma cuatro por ciento.",
        keys: ["91,4 %"],
        display: { "noventa y uno coma cuatro por ciento": "91,4 %" },
      },
      {
        text: "Según una revisión de dos mil veinticuatro, eso detecta el test del cuatro.",
        chunks: ["Según una revisión de dos mil veinticuatro,", "eso detecta el test del cuatro."],
        keys: ["revisión", "2024", "4"],
        display: { "dos mil veinticuatro": "2024", cuatro: "4" },
      },
      {
        text: "Fuimos al estudio original: no es lo que parece.",
        chunks: ["Fuimos al estudio original:", "no es lo que parece."],
        keys: ["original", "parece"],
      },
    ],
  },
  {
    id: "prueba",
    sentences: [
      {
        text: "Primer error: la revisión dice dos mil ocho, y es de dos mil dieciocho.",
        chunks: ["Primer error:", "la revisión dice dos mil ocho,", "y es de dos mil dieciocho."],
        keys: ["error", "2008", "2018"],
        display: { "dos mil ocho": "2008", "dos mil dieciocho": "2018" },
      },
    ],
  },
  {
    id: "estudio",
    sentences: [
      {
        text: "Ciento diecisiete pacientes, todos ya diagnosticados de disfunción sacroilíaca.",
        chunks: ["Ciento diecisiete pacientes,", "todos ya diagnosticados", "de disfunción sacroilíaca."],
        keys: ["117", "todos", "diagnosticados"],
        display: { "ciento diecisiete": "117" },
      },
      {
        text: "¿Cómo? Con tres de seis tests de provocación positivos.",
        chunks: ["¿Cómo? Con tres de seis", "tests de provocación positivos."],
        keys: ["3", "6", "positivos"],
        display: { tres: "3", seis: "6" },
      },
    ],
  },
  {
    id: "quiz",
    sentences: [
      {
        text: "Entonces, ¿qué mide ese noventa y uno?",
        keys: ["qué", "mide", "91"],
        display: { "noventa y uno": "91" },
      },
    ],
  },
  {
    id: "hallazgo",
    sentences: [
      {
        text: "En cuántos de esos pacientes salió positivo el test.",
        chunks: ["En cuántos de esos pacientes", "salió positivo el test."],
        keys: ["cuántos", "positivo"],
      },
      { text: "Pacientes diagnosticados con esos mismos tests.", keys: ["mismos", "tests"] },
    ],
  },
  {
    id: "giro",
    sentences: [
      {
        text: "No se comparó con la infiltración, ni con gente sin el diagnóstico.",
        chunks: ["No se comparó con la infiltración,", "ni con gente sin el diagnóstico."],
        keys: ["infiltración", "sin"],
      },
      { text: "No es una sensibilidad de verdad.", keys: ["No", "sensibilidad"] },
    ],
  },
  {
    id: "matiz",
    sentences: [
      {
        text: "Y según los autores, un test suelto vale poco; la batería, más.",
        chunks: ["Y según los autores,", "un test suelto vale poco;", "la batería, más."],
        keys: ["suelto", "poco", "batería", "más"],
      },
    ],
  },
  {
    id: "quehacer",
    sentences: [
      {
        text: "Mañana: no etiquetes sacroilíaca por un test del cuatro; haz la batería y cuenta positivos.",
        chunks: ["Mañana: no etiquetes", "sacroilíaca por un", "test del cuatro;", "haz la batería", "y cuenta positivos."],
        keys: ["no", "batería", "positivos"],
        display: { cuatro: "4" },
      },
    ],
  },
  {
    id: "cta",
    sentences: [
      { text: 'Comenta "original" si quieres más lecturas así.', chunks: ['Comenta "original"', "si quieres más lecturas así."], keys: ["Comenta", "original"] },
      {
        text: "Y en la parte cuatro: el Lasègue, que esta revisión interpreta al revés.",
        chunks: ["Y en la parte cuatro:", "el Lasègue,", "que esta revisión interpreta al revés."],
        keys: ["parte", "4", "Lasègue", "revés"],
        display: { cuatro: "4" },
      },
    ],
  },
];

/** Datos verificados: Telli H, Telli S, Topal M. Pain Physician 2018;21(4):E367-E376 (PMID 30045603); Custers 2024 apdo. 3.4.3. */
export const DATA = {
  pacientes: 117,
  criterio: { pos: 3, de: 6 },
  faber: 91.4,
  quiz: ["SENSIBILIDAD", "% DE POSITIVOS", "ESPECIFICIDAD"],
  /** Las seis pruebas (en la revisión, FABER + cinco de provocación) */
  tests: ["FABER", "Distracción", "Compresión", "Empuje del muslo", "Gaenslen", "Sacro"],
};

/** Escena en la que la música hace el hueco de silencio antes del dato fuerte. */
export const DATA_SCENE = "hallazgo";
