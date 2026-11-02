/**
 * VÍDEO · PARTE 3 · «Lasègue: ¿confirma o descarta? La revisión lo dice al revés» (Custers 2024 · reel 2).
 * Hilo: caso clínico → lo que responde la revisión → lo que dicen sus propios números → la regla →
 * el cruzado → la inversión → qué hacer mañana → CTA (teaser: el único ejercicio que no funcionó).
 */
import type { SceneDef, VideoMeta } from "../../config";

export const META: VideoMeta = {
  id: "Lasegue",
  titulo: "Lasègue: ¿confirma o descarta? La revisión lo dice al revés",
  pilar: "Lectura crítica",
  fuente: "Fuente: Custers et al., Life 2024 (revisión narrativa)",
  portada: { linea1: "Lasègue positivo:", dato: "¿confirma?", sub: "LA REVISIÓN LO DICE AL REVÉS" },
  coldOpen: { big: "AL REVÉS", small: "el Lasègue, ¿confirma o descarta?" },
};

export type SceneId = "gancho" | "prueba" | "datos" | "quiz" | "hallazgo" | "giro" | "matiz" | "quehacer" | "cta";

/** Guion. Debe coincidir con public/lasegue/voz/guion.txt (lo genera tools/guion.mjs). */
export const SCENES: (SceneDef & { id: SceneId })[] = [
  {
    id: "gancho",
    sentences: [
      { text: "Dolor que baja por la pierna.", keys: ["pierna"] },
      { text: "Haces el Lasègue, y sale positivo.", keys: ["Lasègue", "positivo"] },
      { text: "¿Confirma o descarta?", keys: ["Confirma", "descarta"] },
    ],
  },
  {
    id: "prueba",
    sentences: [
      {
        text: "Una revisión de dos mil veinticuatro responde: confirma.",
        chunks: ["Una revisión de dos mil veinticuatro", "responde: confirma."],
        keys: ["revisión", "2024", "confirma"],
        display: { "dos mil veinticuatro": "2024" },
      },
      { text: "Pero sus propios números dicen lo contrario.", keys: ["propios", "números", "contrario"] },
    ],
  },
  {
    id: "datos",
    sentences: [
      {
        text: "Lasègue: sensibilidad de hasta cero coma noventa y ocho.",
        chunks: ["Lasègue: sensibilidad", "de hasta cero coma noventa y ocho."],
        keys: ["sensibilidad", "0,98"],
        display: { "cero coma noventa y ocho": "0,98" },
      },
      {
        text: "Es decir, casi todos los que tienen el problema dan positivo.",
        chunks: ["Es decir, casi todos", "los que tienen el problema", "dan positivo."],
        keys: ["todos", "positivo"],
      },
      {
        text: "Su especificidad, en cambio, baja hasta cero coma diez.",
        chunks: ["Su especificidad, en cambio,", "baja hasta cero coma diez."],
        keys: ["especificidad", "0,10"],
        display: { "cero coma diez": "0,10" },
      },
      {
        text: "También da positivo en mucha gente sin el problema.",
        chunks: ["También da positivo", "en mucha gente sin el problema."],
        keys: ["mucha", "sin"],
      },
    ],
  },
  {
    id: "quiz",
    sentences: [{ text: "Entonces, un Lasègue negativo, ¿qué te dice?", chunks: ["Entonces, un Lasègue negativo,", "¿qué te dice?"], keys: ["negativo", "qué"] }],
  },
  {
    id: "hallazgo",
    sentences: [
      { text: "Que la tensión de la raíz se vuelve poco probable.", chunks: ["Que la tensión de la raíz", "se vuelve poco probable."], keys: ["raíz", "poco", "probable"] },
      { text: "Muy sensible y negativo: descarta.", keys: ["sensible", "negativo", "descarta"] },
    ],
  },
  {
    id: "giro",
    sentences: [
      {
        text: "Con el cruzado pasa al revés: levantas la pierna sana y duele la otra.",
        chunks: ["Con el cruzado pasa al revés:", "levantas la pierna sana", "y duele la otra."],
        keys: ["cruzado", "revés", "sana", "otra"],
      },
      {
        text: "Especificidad de hasta cero coma noventa y ocho.",
        chunks: ["Especificidad de hasta", "cero coma noventa y ocho."],
        keys: ["Especificidad", "0,98"],
        display: { "cero coma noventa y ocho": "0,98" },
      },
      { text: "Muy específico y positivo: confirma.", keys: ["específico", "positivo", "confirma"] },
    ],
  },
  {
    id: "matiz",
    sentences: [
      { text: "La revisión lo escribe justo al revés.", keys: ["revisión", "revés"] },
      { text: "Por eso, lee los números, no solo la conclusión.", chunks: ["Por eso, lee los números,", "no solo la conclusión."], keys: ["números", "conclusión"] },
    ],
  },
  {
    id: "quehacer",
    sentences: [
      { text: "Mañana: si el Lasègue sale negativo, la raíz baja en tu lista.", chunks: ["Mañana: si el Lasègue", "sale negativo,", "la raíz baja en tu lista."], keys: ["negativo", "baja"] },
      { text: "Si sale positivo, no pares: añade el cruzado.", chunks: ["Si sale positivo,", "no pares: añade el cruzado."], keys: ["positivo", "cruzado"] },
    ],
  },
  {
    id: "cta",
    sentences: [
      { text: 'Comenta "cruzado" si lo haces siempre.', chunks: ['Comenta "cruzado"', "si lo haces siempre."], keys: ["Comenta", "cruzado"] },
      {
        text: "Y en la parte cuatro: el único ejercicio que no funcionó para el dolor lumbar.",
        chunks: ["Y en la parte cuatro:", "el único ejercicio", "que no funcionó para el dolor lumbar."],
        keys: ["parte", "4", "único", "no"],
        display: { cuatro: "4" },
      },
    ],
  },
];

/** Datos verificados en Custers 2024, apartado 3.2.5 («Straight Leg Raising», «Crossed Straight Leg Raise»)
 *  y «Summary of Specificity and Sensitivity»; teaser en 4.1.8 (metaanálisis de Fernández et al.). */
export const DATA = {
  slr: { sens: { min: 0.73, max: 0.98 }, spec: { min: 0.1, max: 1 } },
  cruzado: { sens: { min: 0.23, max: 0.43 }, spec: { min: 0.88, max: 0.98 } },
  quiz: ["CONFIRMA", "DESCARTA", "NADA"],
};

/** Escena en la que la música hace el hueco de silencio antes del dato fuerte. */
export const DATA_SCENE = "hallazgo";
