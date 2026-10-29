// Cuestionarios completos que se rellenan en la app: los ítems, sus respuestas y cómo se calcula la nota.
// Cada cuestionario está en su archivo (koos.ts, lefs.ts…) y se juntan en index.ts.

/** Una respuesta posible: el valor con el que puntúa y el texto que se lee. */
export type Option = { value: number; label: string };

export type Item = {
  /** Único dentro del cuestionario: «p1», «s3», «8a»… */
  id: string;
  text: string;
  /** Respuestas en lista (lo habitual)… */
  options?: Option[];
  /** …o una escala numérica de botones (0-10, por ejemplo) con el texto de cada extremo… */
  scale?: { from: number; to: number; ends: [string, string] };
  /** …o un número que se escribe (minutos, días…), entre min y max. */
  input?: { min: number; max: number; unit: string };
  /** Se puede marcar «No aplica» (cuenta como sin responder al calcular). */
  na?: boolean;
};

export type Section = {
  title: string;
  intro?: string;
  items: Item[];
  /** La rellena el fisioterapeuta (exploración, como en el DN4): el cuestionario no se manda al móvil del paciente. */
  clinician?: boolean;
};

/** Respuestas por id de ítem. null: «No aplica». Sin la clave: sin responder. */
export type Answers = Record<string, number | null>;

export type FormScore = {
  /** La nota total; null en los que solo tienen subescalas (KOOS, HOOS). */
  score: number | null;
  /**
   * Subescalas con su nota; si el catálogo (../questionnaires.ts) las tiene, con los mismos nombres. `max`: sobre
   * cuánto es (sin él, un porcentaje), para las que no están en el catálogo.
   */
  subscores?: { name: string; score: number; max?: number }[];
  /** Cómo se lee la nota, si el cuestionario lo define (p. ej. «Discapacidad moderada»). */
  text?: string;
};

export type QuestionForm = {
  /** El mismo id que en QUESTIONNAIRES (../questionnaires.ts). */
  id: string;
  /** Lo que se le dice al paciente antes de empezar. */
  instructions: string;
  sections: Section[];
  /** La nota. Lanza RangeError con un texto claro si faltan respuestas para poder calcularla. */
  score(answers: Answers): FormScore;
  /** Autores y año del original y de la versión española en que se basa el texto. */
  source: string;
};

/** La cita de sus autores (lo que dice `source` sin la nota de que es un texto de trabajo). */
export const citeOf = (f: QuestionForm) => f.source.split(/\s*(?:Texto de trabajo|El grupo FES-I)/)[0]!.trim().replace(/[.;]$/, "");

/**
 * Lo que se dice de la traducción de todos los que se rellenan en la app: ninguno se ha cotejado con la versión
 * española validada, así que no se puede decir que lo sea.
 */
export const WORKING_TRANSLATION =
  "Traducción de trabajo: no se ha comprobado que sea el texto de la versión española validada. Cotéjalo con la publicada antes de usarlo en consulta.";

/** Las respuestas contestadas (sin «No aplica») de unos ítems. */
export function answered(a: Answers, ids: string[]): number[] {
  return ids.map((id) => a[id]).filter((v): v is number => typeof v === "number");
}

/** Redondeo a un decimal, el que se guarda y se enseña. */
export const round1 = (n: number) => Math.round(n * 10) / 10;
