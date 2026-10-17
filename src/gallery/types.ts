// Galería de tests diferenciales (módulo independiente: ver src/gallery/README.md).
import type { FigureSpec } from "./figure";

export type RegionId =
  | "hombro"
  | "codo"
  | "muneca_mano"
  | "cervical"
  | "dorsal"
  | "lumbar"
  | "sacroiliaca"
  | "cadera"
  | "rodilla"
  | "tobillo_pie"
  | "atm";

/** Precisión diagnóstica publicada. Porcentajes de 0 a 100; razones de verosimilitud tal cual. */
export type Accuracy = {
  sens?: number;
  spec?: number;
  lrPos?: number;
  lrNeg?: number;
  /** Fiabilidad (p. ej. "kappa 0,62 entre examinadores"). */
  reliability?: string;
  /** Con qué se comparó o en qué población (p. ej. "frente a artroscopia", "metaanálisis, 8 estudios"). */
  context?: string;
  /** Cita corta para mostrar: "Benjaminse et al., 2006". */
  source: string;
  /** Cita completa: autores, título, revista, año. */
  citation: string;
  doi?: string;
};

export type SpecialTest = {
  /** Identificador en minúsculas con guiones, único en toda la galería. */
  id: string;
  region: RegionId;
  /** Patología o grupo dentro de la articulación (p. ej. "Ligamento cruzado anterior"). */
  group: string;
  name: string;
  /** Otros nombres, incluido el inglés. */
  aka?: string[];
  /** test suelto, agrupación de tests (cluster) o regla de decisión clínica. */
  kind: "test" | "cluster" | "rule";
  /** Qué valora, en una frase. */
  purpose: string;
  /** Posición del paciente y del examinador. */
  position: string;
  /** Pasos para hacerlo. */
  steps: string[];
  /** Qué se considera positivo. */
  positive: string;
  /** Cómo usarlo: si sirve más para confirmar o para descartar, y con qué otros tests combinarlo. */
  interpretation: string;
  /** Datos de precisión con su fuente. Vacío si no se han podido comprobar. */
  accuracy: Accuracy[];
  /** Utilidad clínica según esos datos. */
  utility: "alta" | "moderada" | "baja" | "desconocida";
  /** Precauciones o contraindicaciones. */
  cautions?: string;
  /** 1 o 2 ilustraciones (inicio y final, o dos variantes). */
  figures: FigureSpec[];
  /** Ids de tests relacionados (los de un cluster, alternativas). */
  related?: string[];
};

export type Region = { id: RegionId; label: string; groups: string[] };
