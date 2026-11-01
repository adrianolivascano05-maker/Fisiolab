/**
 * VÍDEO 1 · «Palpamos el nivel correcto la mitad de las veces» (Custers 2024 · reel 1; dato de Harlick 2007).
 * Textos del guion (frase a frase), palabras resaltadas y datos verificados. Las escenas están en ./scenes.
 */
import type { SceneDef, VideoMeta } from "../../config";

export const META: VideoMeta = {
  id: "PalpacionL4",
  titulo: "Palpamos el nivel correcto la mitad de las veces",
  pilar: "Mito vs. evidencia",
  fuente: "Fuente: Harlick et al., Man Ther 2007 · Custers et al., Life 2024",
  portada: { linea1: "¿Seguro que es L4?", dato: "47 %", sub: "ACIERTOS DE VÉRTEBRA EXACTA" },
};


/** Guion aprobado (+ pregunta de quiz antes del dato). Debe coincidir con public/voz/guion.txt */
export type SceneId = "gancho" | "prueba" | "estudio" | "quiz" | "hallazgo" | "giro" | "matiz" | "quehacer" | "cta";

export const SCENES: (SceneDef & { id: SceneId })[] = [
  {
    id: "gancho",
    sentences: [
      { text: "Fisios expertos.", keys: ["expertos"] },
      { text: "Palpando lumbares.", keys: ["lumbares"] },
      {
        text: "Y más de la mitad se equivocaron de vértebra.",
        chunks: ["Y más de la mitad", "se equivocaron de vértebra."],
        keys: ["mitad", "equivocaron"],
      },
    ],
  },
  {
    id: "prueba",
    sentences: [
      {
        text: "Y no es una opinión: lo comprobaron con radiografía.",
        chunks: ["Y no es una opinión:", "lo comprobaron con radiografía."],
        keys: ["opinión", "radiografía"],
      },
    ],
  },
  {
    id: "estudio",
    sentences: [
      {
        text: "Cinco fisios de terapia manual marcaron L1, L3 y L5 en setenta y cinco pacientes con lumbalgia.",
        chunks: ["Cinco fisios de terapia manual", "marcaron L1, L3 y L5", "en setenta y cinco pacientes con lumbalgia."],
        keys: ["Cinco", "L1", "L3", "L5", "75"],
        display: { "setenta y cinco": "75" },
      },
      {
        text: "Marcador en la piel... y radiografía.",
        chunks: ["Marcador en la piel...", "y radiografía."],
        keys: ["piel", "radiografía"],
      },
    ],
  },
  {
    id: "quiz",
    sentences: [{ text: "¿Cuántos crees que acertaron?", keys: ["Cuántos", "acertaron"] }],
  },
  {
    id: "hallazgo",
    sentences: [
      {
        text: "Vértebra exacta: el cuarenta y siete por ciento.",
        chunks: ["Vértebra exacta:", "el cuarenta y siete por ciento."],
        keys: ["47 %"],
        display: { "cuarenta y siete por ciento": "47 %" },
      },
    ],
  },
  {
    id: "giro",
    sentences: [
      {
        text: "Pero lo más incómodo es esto: lo que más cambiaba el resultado no era el paciente.",
        chunks: ["Pero lo más incómodo es esto:", "lo que más cambiaba el resultado", "no era el paciente."],
        keys: ["incómodo", "no", "paciente"],
      },
      { text: "Ni su peso, ni su edad.", keys: ["peso", "edad"] },
      { text: "Era quién palpaba.", keys: ["quién", "palpaba"] },
    ],
  },
  {
    id: "matiz",
    sentences: [
      {
        text: "La buena noticia: casi tres de cada cuatro acertaban o se quedaban a un nivel.",
        chunks: ["La buena noticia:", "casi tres de cada cuatro acertaban", "o se quedaban a un nivel."],
        keys: ["buena", "3", "4", "nivel"],
        display: { tres: "3", cuatro: "4" },
      },
      { text: "La palpación te lleva a la zona.", keys: ["zona"] },
      { text: "No a la vértebra.", keys: ["No", "vértebra"] },
    ],
  },
  {
    id: "quehacer",
    sentences: [
      {
        text: 'Así que deja de decir "tienes L4-L5 bloqueada".',
        chunks: ["Así que deja de decir", '"tienes L4-L5 bloqueada".'],
        keys: ["deja", "L4-L5", "bloqueada"],
      },
      {
        text: 'Di "zona lumbar baja", y busca el dolor que el paciente reconoce como suyo.',
        chunks: ['Di "zona lumbar baja",', "y busca el dolor", "que el paciente reconoce como suyo."],
        keys: ["zona", "lumbar", "baja", "reconoce"],
      },
    ],
  },
  {
    id: "cta",
    sentences: [
      {
        text: 'Comenta "L4" si alguna vez lo has dicho con total seguridad.',
        chunks: ['Comenta "L4"', "si alguna vez lo has dicho", "con total seguridad."],
        keys: ["Comenta", "L4", "seguridad"],
      },
      {
        text: "Y en la parte dos: el test que usamos a diario y que, según esta revisión, ni confirma ni descarta.",
        chunks: ["Y en la parte dos:", "el test que usamos a diario", "y que, según esta revisión,", "ni confirma ni descarta."],
        keys: ["parte", "2", "confirma", "descarta"],
        display: { dos: "2" },
      },
    ],
  },
];

/** Datos verificados (Harlick 2007, Man Ther 12:56-62; Custers 2024, Life 14:1090). */
export const DATA = {
  fisios: 5,
  pacientes: 75,
  niveles: ["L1", "L3", "L5"],
  exacta: 47,
  unNivel: 72,
  /** Opciones del quiz (la respuesta correcta no está entre ellas: 47 %). */
  quiz: ["90 %", "75 %", "60 %"],
};

