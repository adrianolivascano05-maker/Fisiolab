// Catálogo de cuestionarios. La PSFS, el cambio global percibido y el mapa del dolor se contestan en la app con su
// propia pantalla. Los de uso libre se rellenan enteros en la app (src/clinical/forms, con la nota calculada). De los
// que piden permiso a su titular o se consiguen en su web (`scoreOnly`) la app no tiene el texto: se pasan en la hoja
// oficial, que se consigue en su enlace, y se anota la nota. Los de pago están fuera del servicio (`retired`,
// catalog/retired.ts): solo se ven los que se guardaron antes. Los de cada grupo están en src/clinical/catalog.
import { regionsOf, type Mark } from "./bodyMap";
import { KINDS as COLUMNA } from "./catalog/columna";
import { KINDS as DOLOR } from "./catalog/dolor";
import { KINDS as GENERAL } from "./catalog/general";
import { KINDS as MIEMBRO_INFERIOR } from "./catalog/miembroInferior";
import { KINDS as MIEMBRO_SUPERIOR } from "./catalog/miembroSuperior";
import { KINDS as PIE_DEPORTE } from "./catalog/pieDeporte";
import { KINDS as RETIRED } from "./catalog/retired";

export type Better = "higher" | "lower";
export type QuestionnaireKind = {
  id: string;
  name: string;
  /** Rango de la puntuación y qué es mejor. */
  min: number;
  max: number;
  better: Better;
  unit?: string;
  /** Se contesta en la app. */
  inApp?: "psfs" | "groc" | "bodymap";
  /** Subescalas (KOOS, HOOS): se registra una cada vez. */
  subscales?: string[];
  hint?: string;
  /** Zonas del cuerpo (ids de BODY_REGIONS) para las que se suele usar: se proponen primero. */
  regions?: string[];
  /** Los generales (no de una zona): de qué tratan, para agruparlos al elegir. */
  topic?: string;
  /** Subescalas con su propio rango (FABQ): por nombre. */
  subscaleRange?: Record<string, { min: number; max: number }>;
  /**
   * Sin preguntas en la app: se pasa en la hoja oficial (de su web o con el permiso de su titular) y se anota la nota.
   */
  scoreOnly?: boolean;
  /** De solo nota: dónde se consigue la hoja oficial o se pide el permiso (sin `url`, a quién pedirlo). */
  link?: { url?: string; label: string };
  /** Fuera del servicio (de pago): no se pasa, ni se manda ni se anota; lo guardado antes se ve como registro antiguo. */
  retired?: boolean;
  /** Cómo se lee la nota anotada: tramos de menor a mayor, cada uno hasta `upTo` incluido. Solo los verificados. */
  bands?: { upTo: number; text: string }[];
  /** Cambio mínimo importante o cómo interpretar la evolución, si está verificado. */
  reading?: string;
  /** Referencias: original y validación española (autores, año, DOI). */
  refs?: string;
};

export const QUESTIONNAIRES: QuestionnaireKind[] = [
  {
    id: "psfs",
    name: "PSFS · escala funcional específica del paciente",
    min: 0,
    max: 10,
    better: "higher",
    inApp: "psfs",
    hint: "El paciente elige hasta cinco actividades que le cuesta hacer y puntúa cada una de 0 (no puede) a 10 (como antes).",
  },
  {
    id: "groc",
    name: "Cambio global percibido",
    min: -7,
    max: 7,
    better: "higher",
    inApp: "groc",
    hint: "Cómo está ahora respecto al inicio del tratamiento, de −7 (muchísimo peor) a +7 (muchísimo mejor).",
  },
  {
    id: "mapa_dolor",
    name: "Mapa del dolor",
    min: 0,
    max: 10,
    better: "lower",
    inApp: "bodymap",
    hint: "Dónde le duele, le hormiguea o lo nota rígido, con su intensidad de 0 a 10. La nota es la intensidad más alta.",
  },
  {
    id: "faam",
    name: "FAAM AVD (tobillo y pie)",
    min: 0,
    max: 100,
    better: "higher",
    unit: "%",
    regions: ["tobillo_pie"],
  },
  {
    id: "acl_rsi",
    name: "ACL-RSI (preparación psicológica)",
    min: 0,
    max: 100,
    better: "higher",
    regions: ["rodilla"],
    scoreOnly: true,
    link: {
      url: "https://doi.org/10.1002/jeo2.70046",
      label: "Artículo de la validación, en abierto, con el cuestionario",
    },
    refs: "Webster, Feller y Lambros, 2008 (original); Donat-Roca et al., 2024 (validación española), J Exp Orthop 11:e70046, DOI 10.1002/jeo2.70046",
  },
  {
    id: "ndi",
    name: "NDI (cuello)",
    min: 0,
    max: 50,
    better: "lower",
    regions: ["cervical"],
    scoreOnly: true,
    link: {
      url: "https://eprovide.mapi-trust.org/instruments/neck-disability-index",
      label: "ePROVIDE · Mapi Research Trust",
    },
    refs: "Vernon y Mior, 1991; versión española de Andrade Ortega et al., 2010",
  },
  {
    id: "odi",
    name: "Oswestry (lumbar)",
    min: 0,
    max: 100,
    better: "lower",
    unit: "%",
    regions: ["lumbar", "sacroiliaca"],
    scoreOnly: true,
    link: {
      url: "https://eprovide.mapi-trust.org/odi-oswestry-disability-index/",
      label: "ePROVIDE · Mapi Research Trust",
    },
    refs: "Fairbank et al., 1980 (versión 2.1a); versión española de Flórez García et al., 1995",
  },
  {
    id: "quickdash",
    name: "QuickDASH (miembro superior)",
    min: 0,
    max: 100,
    better: "lower",
    regions: ["hombro", "codo", "muneca_mano"],
    scoreOnly: true,
    link: {
      url: "https://dash.iwh.on.ca",
      label: "Institute for Work & Health (dash.iwh.on.ca)",
    },
    refs: "Beaton et al., 2005 (QuickDASH, Institute for Work & Health); versión española del IWH",
  },
  {
    id: "spadi",
    name: "SPADI (hombro)",
    min: 0,
    max: 100,
    better: "lower",
    regions: ["hombro"],
    scoreOnly: true,
    link: {
      url: "https://doi.org/10.1186/s12955-015-0397-z",
      label: "Artículo de la validación, en abierto, con el cuestionario",
    },
    refs: "Roach et al., 1991 (original); Membrilla-Mesa et al., 2015 (validación española), Health Qual Life Outcomes 13:200, DOI 10.1186/s12955-015-0397-z",
  },
  // Generales: no son de una zona del cuerpo.
  {
    id: "rand36",
    name: "RAND-36 (calidad de vida relacionada con la salud)",
    min: 0,
    max: 100,
    better: "higher",
    subscales: ["Función física", "Rol físico", "Dolor corporal", "Salud general", "Vitalidad", "Función social", "Rol emocional", "Salud mental"],
    topic: "Calidad de vida",
  },
  {
    id: "phq9",
    name: "PHQ-9 (síntomas depresivos)",
    min: 0,
    max: 27,
    better: "lower",
    topic: "Estado de ánimo",
  },
  {
    id: "gad7",
    name: "GAD-7 (ansiedad)",
    min: 0,
    max: 21,
    better: "lower",
    topic: "Estado de ánimo",
  },
  {
    id: "pcs",
    name: "PCS (catastrofismo ante el dolor)",
    min: 0,
    max: 52,
    better: "lower",
    topic: "Dolor, miedo y creencias",
    scoreOnly: true,
    link: {
      url: "https://eprovide.mapi-trust.org",
      label: "Permiso: ePROVIDE · Mapi Research Trust",
    },
    refs: "Sullivan, Bishop y Pivik, 1995 (original)",
  },
  {
    id: "csi",
    name: "CSI (sensibilización central)",
    min: 0,
    max: 100,
    better: "lower",
    topic: "Dolor, miedo y creencias",
    scoreOnly: true,
    link: {
      url: "https://doi.org/10.1186/s40064-016-3515-4",
      label: "Artículo de la validación, en abierto, con el cuestionario",
    },
    refs: "Mayer et al., 2012 (original); Cuesta-Vargas et al., 2016 (validación española), SpringerPlus 5:1837, DOI 10.1186/s40064-016-3515-4",
  },
  {
    id: "ipaq",
    name: "IPAQ corto (actividad física)",
    min: 0,
    max: 20000,
    better: "higher",
    unit: "MET-min/sem",
    topic: "Actividad física",
  },
  ...COLUMNA,
  ...MIEMBRO_SUPERIOR,
  ...MIEMBRO_INFERIOR,
  ...PIE_DEPORTE,
  ...DOLOR,
  ...GENERAL,
  ...RETIRED,
];

/** Los que se pueden pasar, mandar o anotar hoy (sin los de pago, que están fuera del servicio). */
export const ACTIVE = QUESTIONNAIRES.filter((k) => !k.retired);

/** Cómo se lee una nota anotada, con los tramos del catálogo. */
export function bandText(k: QuestionnaireKind, score: number): string | null {
  return k.bands?.find((b) => score <= b.upTo)?.text ?? null;
}

/** Los temas de los generales, en el orden del catálogo. */
export const TOPICS = [...new Set(QUESTIONNAIRES.map((k) => k.topic).filter((t): t is string => !!t))];

export const OTHER = "otro";
export const getKind = (id: string) => QUESTIONNAIRES.find((q) => q.id === id);

/** El catálogo (sin los de fuera del servicio) con los de las zonas del paciente primero (el orden de cada grupo no cambia). */
export function byRegions(regions: string[]): { kind: QuestionnaireKind; forRegion: boolean }[] {
  const all = ACTIVE.map((kind) => ({
    kind,
    forRegion: !!kind.regions?.some((r) => regions.includes(r)),
  }));
  return [...all.filter((k) => k.forRegion), ...all.filter((k) => !k.forRegion)];
}

export type QDetails = {
  activities?: { name: string; score: number }[];
  /** Mapa del dolor: las zonas marcadas («zona:síntoma:intensidad», src/clinical/bodyMap.ts). */
  marks?: string[];
  subscale?: string;
  name?: string;
  min?: number;
  max?: number;
  better?: Better;
  /** Rellenado en la app: las respuestas por ítem (null, «No aplica»). */
  answers?: Record<string, number | null>;
  /** KOOS y HOOS rellenados en la app: las subescalas de una misma vez comparten este id. */
  group?: string;
  /** Subescalas (SPADI) y cómo se lee la nota, tal como salieron al guardarlo. */
  subscores?: { name: string; score: number }[];
  text?: string;
};

/** El tipo efectivo de un registro (con «otro», el nombre y el rango que se escribieron). */
export function kindOf(kind: string, d: QDetails): QuestionnaireKind {
  const k = getKind(kind);
  const range = d.subscale ? k?.subscaleRange?.[d.subscale] : undefined;
  if (k) return range ? { ...k, ...range } : k;
  return {
    id: OTHER,
    name: d.name || "Cuestionario",
    min: d.min ?? 0,
    max: d.max ?? 100,
    better: d.better ?? "higher",
  };
}

/** Nombre para mostrar: con la subescala si la hay, y los de fuera del servicio marcados como registro antiguo. */
export const displayName = (kind: string, d: QDetails) => {
  const k = kindOf(kind, d);
  return `${k.name}${d.subscale ? ` · ${d.subscale}` : ""}${k.retired ? " (registro antiguo)" : ""}`;
};

/** Mapa del dolor: la intensidad más alta de lo marcado. */
export function mapScore(marks: Mark[]): number {
  if (!marks.length) throw new RangeError("Marca al menos una zona en el dibujo.");
  const top = regionsOf(marks).maxIntensity;
  if (top === null) throw new RangeError("Pon la intensidad (0-10) de al menos una zona.");
  return top;
}

/** PSFS: media de las actividades puntuadas. */
export function psfsScore(activities: { name: string; score: number }[]): number {
  const valid = activities.filter((a) => a.name.trim() && Number.isFinite(a.score));
  if (!valid.length) throw new RangeError("Escribe al menos una actividad y puntúala.");
  return valid.reduce((s, a) => s + a.score, 0) / valid.length;
}

/** Texto de una puntuación: «62/100», «4,3/10», «+3». */
export function scoreText(k: QuestionnaireKind, score: number): string {
  const n = Number.isInteger(score) ? String(score) : score.toFixed(1).replace(".", ",");
  if (k.inApp === "groc") return score > 0 ? `+${n}` : n;
  if (k.unit === "%") return `${n} %`;
  return k.unit ? `${n} ${k.unit}` : `${n}/${k.max}`;
}
