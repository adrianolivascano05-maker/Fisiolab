/**
 * CONFIGURACIÓN ÚNICA DEL REEL.
 * Para producir otro vídeo con la misma plantilla, cambia solo este archivo
 * (textos, datos, palabras clave, efectos) y regenera la voz con tools/produce.sh.
 */

export const META = {
  id: "PalpacionL4",
  titulo: "Palpamos el nivel correcto la mitad de las veces",
  pilar: "Mito vs. evidencia",
  fuente: "Fuente: Harlick et al., Man Ther 2007 · Custers et al., Life 2024",
  portada: { linea1: "¿Seguro que es L4?", dato: "47 %" },
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const COLORS = {
  bgTop: "#050C1A",
  bgBottom: "#0B1B33",
  orange: "#FF8A3D",
  cyan: "#4FD1FF",
  red: "#FF4D5E",
  green: "#3DDC97",
  white: "#FFFFFF",
  muted: "rgba(255,255,255,0.7)",
  ink: "#061120",
};

/** Una frase = unidad de alineación con la voz (separada por pausas en el TTS). */
export type Sentence = {
  /** Texto tal y como se locuta. */
  text: string;
  /** Trozos para subtítulos (≤ 7 palabras); si falta, se usa `text` entero. */
  chunks?: string[];
  /** Palabras que se resaltan en naranja (sin signos). */
  keys?: string[];
};

export type SceneId =
  | "gancho"
  | "prueba"
  | "estudio"
  | "hallazgo"
  | "giro"
  | "matiz"
  | "quehacer"
  | "cta";

export type SceneDef = { id: SceneId; sentences: Sentence[] };

/** Guion aprobado. El orden y el número de frases deben coincidir con public/voz/guion.txt */
export const SCENES: SceneDef[] = [
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
        chunks: [
          "Cinco fisios de terapia manual",
          "marcaron L1, L3 y L5",
          "en 75 pacientes con lumbalgia.",
        ],
        keys: ["Cinco", "L1", "L3", "L5", "75"],
      },
      {
        text: "Marcador en la piel... y radiografía.",
        chunks: ["Marcador en la piel...", "y radiografía."],
        keys: ["piel", "radiografía"],
      },
    ],
  },
  {
    id: "hallazgo",
    sentences: [
      {
        text: "Vértebra exacta: el cuarenta y siete por ciento.",
        chunks: ["Vértebra exacta:", "el 47 %."],
        keys: ["47", "%"],
      },
    ],
  },
  {
    id: "giro",
    sentences: [
      {
        text: "Pero lo más incómodo es esto: lo que más cambiaba el resultado no era el paciente.",
        chunks: [
          "Pero lo más incómodo es esto:",
          "lo que más cambiaba el resultado",
          "no era el paciente.",
        ],
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
        chunks: [
          "La buena noticia:",
          "casi 3 de cada 4 acertaban",
          "o se quedaban a un nivel.",
        ],
        keys: ["buena", "3", "4", "nivel"],
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
        chunks: ["Así que deja de decir", "«tienes L4-L5 bloqueada»."],
        keys: ["deja", "L4-L5", "bloqueada"],
      },
      {
        text: 'Di "zona lumbar baja", y busca el dolor que el paciente reconoce como suyo.',
        chunks: [
          "Di «zona lumbar baja»",
          "y busca el dolor",
          "que el paciente reconoce como suyo.",
        ],
        keys: ["zona", "lumbar", "baja", "reconoce"],
      },
    ],
  },
  {
    id: "cta",
    sentences: [
      {
        text: 'Comenta "L4" si alguna vez lo has dicho con total seguridad.',
        chunks: ["Comenta «L4»", "si alguna vez lo has dicho", "con total seguridad."],
        keys: ["Comenta", "L4", "seguridad"],
      },
      {
        text: "Y en la parte dos: el test que usamos a diario y que, según esta revisión, ni confirma ni descarta.",
        chunks: [
          "Y en la parte 2:",
          "el test que usamos a diario",
          "y que, según esta revisión,",
          "ni confirma ni descarta.",
        ],
        keys: ["parte", "2", "confirma", "descarta"],
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
};

/** Tiempos de cada frase (segundos, en la línea de tiempo global). Lo rellena tools/align.py o tools/estimate.py */
export type SentenceTiming = { start: number; end: number };
export type Timings = {
  source: "estimado" | "voz";
  voiceDuration: number;
  sentences: SentenceTiming[]; // en el mismo orden que SCENES[].sentences aplanado
  tail: number; // segundos extra al final tras la última frase
};

export const flatSentences = (): { scene: SceneId; sentence: Sentence; sceneIndex: number }[] =>
  SCENES.flatMap((s, si) => s.sentences.map((sentence) => ({ scene: s.id, sentence, sceneIndex: si })));

/** Opciones habituales de interpolate(): no extrapolar por ningún lado. */
export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
