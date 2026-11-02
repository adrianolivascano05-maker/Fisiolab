/**
 * VÍDEO 3 · «Test del 4 positivo: ¿qué mide de verdad el 91,4 %?» (Custers 2024 · reel 6, corregido con Telli 2018).
 * Hilo: caso clínico → lo que dice la revisión → lo que hizo el estudio → la trampa (analogía del
 * detector de humo) → lo útil → qué hacer mañana → CTA.
 */
import type { SceneDef, VideoMeta } from "../../config";

export const META: VideoMeta = {
  id: "Sacroiliaca",
  titulo: "Test del 4 positivo: ¿qué mide de verdad el 91,4 %?",
  pilar: "Lectura crítica",
  fuente: "Fuente: Telli et al., Pain Physician 2018 · Custers et al., Life 2024",
  portada: { linea1: "Test del 4 positivo:", dato: "91,4 %", sub: "¿QUÉ MIDE DE VERDAD?" },
  coldOpen: { big: "91,4 %", small: "¿qué mide de verdad el test del 4?" },
};

export type SceneId = "gancho" | "prueba" | "estudio" | "quiz" | "hallazgo" | "giro" | "matiz" | "quehacer" | "cta";

/** Guion. Debe coincidir con public/sacroiliaca/voz/guion.txt (lo genera tools/guion.mjs). */
export const SCENES: (SceneDef & { id: SceneId })[] = [
  {
    id: "gancho",
    sentences: [
      { text: "Dolor en la nalga.", keys: ["nalga"] },
      { text: "Test del cuatro, positivo.", keys: ["4", "positivo"], display: { cuatro: "4" } },
      { text: "¿Ya es la sacroilíaca?", keys: ["sacroilíaca"] },
    ],
  },
  {
    id: "prueba",
    sentences: [
      {
        text: "Una revisión de dos mil veinticuatro dice que este test detecta el noventa y uno coma cuatro por ciento.",
        chunks: ["Una revisión de dos mil veinticuatro", "dice que este test detecta", "el noventa y uno coma cuatro por ciento."],
        keys: ["revisión", "2024", "91,4 %"],
        display: { "dos mil veinticuatro": "2024", "noventa y uno coma cuatro por ciento": "91,4 %" },
      },
      {
        text: "Fui al estudio original, de dos mil dieciocho.",
        chunks: ["Fui al estudio original,", "de dos mil dieciocho."],
        keys: ["original", "2018"],
        display: { "dos mil dieciocho": "2018" },
      },
      { text: "Y ese número cuenta otra historia.", keys: ["otra", "historia"] },
    ],
  },
  {
    id: "estudio",
    sentences: [
      {
        text: "Ciento diecisiete pacientes, todos ya diagnosticados.",
        chunks: ["Ciento diecisiete pacientes,", "todos ya diagnosticados."],
        keys: ["117", "todos", "diagnosticados"],
        display: { "ciento diecisiete": "117" },
      },
      {
        text: "¿Cómo? Con seis tests: tres positivos o más, y era sacroilíaca.",
        chunks: ["¿Cómo? Con seis tests:", "tres positivos o más,", "y era sacroilíaca."],
        keys: ["6", "3", "sacroilíaca"],
        display: { seis: "6", tres: "3" },
      },
      {
        text: "Y el test del cuatro estaba en esa misma batería.",
        chunks: ["Y el test del cuatro", "estaba en esa misma batería."],
        keys: ["4", "misma", "batería"],
        display: { cuatro: "4" },
      },
    ],
  },
  {
    id: "quiz",
    sentences: [{ text: "Entonces, ¿qué mide ese noventa y uno?", keys: ["qué", "mide", "91"], display: { "noventa y uno": "91" } }],
  },
  {
    id: "hallazgo",
    sentences: [
      {
        text: "Cuántos dieron positivo en un test que ya formaba parte de su diagnóstico.",
        chunks: ["Cuántos dieron positivo", "en un test que ya formaba parte", "de su diagnóstico."],
        keys: ["Cuántos", "positivo", "diagnóstico"],
      },
    ],
  },
  {
    id: "giro",
    sentences: [
      {
        text: "Es como probar un detector de humo usando, en parte, ese mismo detector para decidir si había fuego.",
        chunks: ["Es como probar un detector de humo", "usando, en parte, ese mismo detector", "para decidir si había fuego."],
        keys: ["detector", "mismo", "fuego"],
      },
      {
        text: "Sin compararlo con una infiltración, ni con pacientes sin el problema, no sabemos cuánto acierta.",
        chunks: ["Sin compararlo con una infiltración,", "ni con pacientes sin el problema,", "no sabemos cuánto acierta."],
        keys: ["infiltración", "sin", "acierta"],
      },
    ],
  },
  {
    id: "matiz",
    sentences: [
      {
        text: "Lo útil: según los autores, un test suelto vale poco; la batería, más.",
        chunks: ["Lo útil: según los autores,", "un test suelto vale poco;", "la batería, más."],
        keys: ["útil", "suelto", "poco", "batería", "más"],
      },
    ],
  },
  {
    id: "quehacer",
    sentences: [
      {
        text: "Mañana: no etiquetes sacroilíaca por un test del cuatro.",
        chunks: ["Mañana: no etiquetes", "sacroilíaca por un", "test del cuatro."],
        keys: ["no", "sacroilíaca", "4"],
        display: { cuatro: "4" },
      },
      { text: "Haz la batería y cuenta positivos.", keys: ["batería", "positivos"] },
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

/** Datos verificados: Telli H, Telli S, Topal M. Pain Physician 2018;21(4):E367-E376 (PMID 30045603, resumen);
 *  Custers 2024 apdo. 3.4.3 (cita el 91,4 % como «sensibilidad» y fecha el estudio en 2008). */
export const DATA = {
  pacientes: 117,
  criterio: { pos: 3, de: 6 },
  faber: 91.4,
  quiz: ["CUÁNTO ACIERTA", "% DE POSITIVOS", "OTRA COSA"],
  /** Las seis pruebas (en la revisión, FABER + cinco de provocación) */
  tests: ["FABER", "Distracción", "Compresión", "Empuje del muslo", "Gaenslen", "Sacro"],
};

/** Escena en la que la música hace el hueco de silencio antes del dato fuerte. */
export const DATA_SCENE = "hallazgo";
