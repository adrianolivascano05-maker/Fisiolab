/**
 * VÍDEO 2 · «El test de Kemp no confirma ni descarta» (Custers 2024 · reel 5; valores de Stuber 2014).
 * Textos del guion (frase a frase), palabras resaltadas y datos verificados. Las escenas están en ./scenes.
 */
import type { SceneDef, VideoMeta } from "../../config";

export const META: VideoMeta = {
  id: "Kemp",
  titulo: "El test de Kemp no confirma ni descarta",
  pilar: "Mito vs. evidencia",
  fuente: "Fuente: Stuber et al., J Can Chiropr Assoc 2014 · Custers et al., Life 2024",
  portada: { linea1: "Kemp positivo", dato: "≠ facetario", sub: "NI CONFIRMA NI DESCARTA" },
  coldOpen: { big: "KEMP +", small: "ni confirma ni descarta el dolor facetario" },
};

export type SceneId = "gancho" | "prueba" | "datos" | "quiz" | "giro" | "matiz" | "quehacer" | "cta";

/** Guion. Debe coincidir con public/kemp/voz/guion.txt (lo genera tools/guion.mjs). */
export const SCENES: (SceneDef & { id: SceneId })[] = [
  {
    id: "gancho",
    sentences: [
      { text: "Kemp positivo.", keys: ["Kemp", "positivo"] },
      { text: "Y anotas: facetario.", keys: ["facetario"] },
      {
        text: "Pues ese test ni confirma ni descarta.",
        chunks: ["Pues ese test", "ni confirma ni descarta."],
        keys: ["ni", "confirma", "descarta"],
      },
    ],
  },
  {
    id: "prueba",
    sentences: [
      {
        text: "Lo dice una revisión de dos mil veinticuatro que reunió los datos de los estudios que lo midieron.",
        chunks: ["Lo dice una revisión de dos mil veinticuatro", "que reunió los datos", "de los estudios que lo midieron."],
        keys: ["revisión", "2024", "datos"],
        display: { "dos mil veinticuatro": "2024" },
      },
    ],
  },
  {
    id: "datos",
    sentences: [
      {
        text: "Sensibilidad: de cero coma veintitrés... a uno.",
        chunks: ["Sensibilidad:", "de cero coma veintitrés... a uno."],
        keys: ["Sensibilidad", "0,23", "1"],
        display: { "cero coma veintitrés": "0,23", uno: "1" },
      },
      {
        text: "Especificidad: de cero coma ciento dieciséis... a cero coma seiscientos setenta y tres.",
        chunks: ["Especificidad:", "de cero coma ciento dieciséis...", "a cero coma seiscientos setenta y tres."],
        keys: ["Especificidad", "0,116", "0,673"],
        display: { "cero coma ciento dieciséis": "0,116", "cero coma seiscientos setenta y tres": "0,673" },
      },
    ],
  },
  {
    id: "quiz",
    sentences: [
      {
        text: "Entonces, un Kemp positivo, ¿confirma o descarta?",
        chunks: ["Entonces, un Kemp positivo,", "¿confirma o descarta?"],
        keys: ["confirma", "descarta"],
      },
    ],
  },
  {
    id: "giro",
    sentences: [
      {
        text: "Con esa especificidad, sale positivo en mucha gente sin dolor facetario.",
        chunks: ["Con esa especificidad,", "sale positivo en mucha gente", "sin dolor facetario."],
        keys: ["especificidad", "positivo", "sin"],
      },
      {
        text: "Y con esa sensibilidad, un negativo tampoco te deja tranquilo.",
        chunks: ["Y con esa sensibilidad,", "un negativo tampoco", "te deja tranquilo."],
        keys: ["sensibilidad", "negativo", "tampoco"],
      },
    ],
  },
  {
    id: "matiz",
    sentences: [
      { text: "La revisión no dice que no sirva.", keys: ["no", "sirva"] },
      {
        text: "Dice que es una pieza: dolor que aumenta al extender, que no suele pasar de la rodilla, y exploración neurológica normal.",
        chunks: ["Dice que es una pieza:", "dolor que aumenta al extender,", "que no suele pasar de la rodilla,", "y exploración neurológica normal."],
        keys: ["pieza", "extender", "rodilla", "neurológica", "normal"],
      },
    ],
  },
  {
    id: "quehacer",
    sentences: [
      {
        text: 'Así que no escribas "facetario" solo por un Kemp.',
        chunks: ["Así que no escribas", '"facetario" solo por un Kemp.'],
        keys: ["no", "facetario", "Kemp"],
      },
      { text: "Anota las cuatro piezas.", keys: ["cuatro", "piezas"], display: { cuatro: "4" } },
    ],
  },
  {
    id: "cta",
    sentences: [
      { text: 'Comenta "Kemp" si lo usas a diario.', chunks: ['Comenta "Kemp"', "si lo usas a diario."], keys: ["Comenta", "Kemp"] },
    ],
  },
];

/** Datos verificados en Custers 2024 (apartado 3.2.5 «Kemp's test», tabla 5 y apartado 5.2), que cita a Stuber 2014. */
export const DATA = {
  sens: { min: 0.23, max: 1 },
  spec: { min: 0.116, max: 0.673 },
  piezas: ["Kemp positivo", "Dolor que aumenta al extender", "No suele pasar de la rodilla", "Exploración neurológica normal"],
  quiz: ["CONFIRMA", "DESCARTA", "NINGUNA"],
};

/** Escena en la que la música hace el hueco de silencio antes del dato fuerte. */
export const DATA_SCENE = "datos";
