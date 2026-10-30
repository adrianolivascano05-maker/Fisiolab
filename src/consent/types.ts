// Consentimientos informados (src/consent/README.md): documentos que el paciente firma antes de un tratamiento,
// hechos a partir de una plantilla revisable y de su anamnesis. La Ley 41/2002 (art. 8) pide el consentimiento
// por escrito en los procedimientos invasores o con riesgos notorios, y su art. 10 pide informar de las
// consecuencias, los riesgos frecuentes, los riesgos por las circunstancias personales y las contraindicaciones:
// esos últimos son los que salen de la anamnesis.
import type { Brand } from "../brand/brand";


/** Lo que dice la anamnesis (y la ficha) que importa para los consentimientos. */
export type ConsentContext = {
  /** Edad en años, si se sabe. */
  age: number | null;
  sex: "female" | "male" | "other" | null;
  /** Zonas del motivo de consulta (ids de BODY_REGIONS: "cervical", "lumbar"…). */
  regions: string[];
  /** Precauciones marcadas en la anamnesis (ids de PRECAUTIONS). */
  precautions: string[];
  /** Precauciones que parecen escritas en el texto libre (medicación, enfermedades…) sin marcar: para avisar. */
  detected: { precaution: string; word: string }[];
  /** Banderas rojas marcadas. */
  redFlags: string[];
  /** Texto del plan de intervención y del diagnóstico, en minúsculas, para sugerir técnicas. */
  planText: string;
};

/** Una técnica concreta dentro de un consentimiento (se marcan las que se van a usar). */
export type Technique = { id: string; label: string };

/**
 * Información de riesgos que sale de la anamnesis para esta plantilla: el riesgo y que el fisioterapeuta lo valora.
 * La app no da veredictos de contraindicación: la decisión es del profesional (revisión del 30-10-2026).
 */
export type PersonalRisk = {
  /** Lo que se le dice al paciente, en segunda persona («Como toma anticoagulantes, …»). */
  text: string;
};

export type ConsentTemplate = {
  id: string;
  /** Versión del texto: cambia al cambiar el texto (se guarda con cada firma). */
  version: string;
  title: string;
  /** Una línea para la lista («Punción seca, electrólisis…»). */
  summary: string;
  /** Por escrito obligado por la Ley 41/2002 (invasivo o con riesgos notorios) o recomendado. */
  written: "required" | "recommended";
  techniques: Technique[];
  /** Por qué se propone para este paciente; null si no hay motivo para proponerla (sigue disponible). */
  suggest(ctx: ConsentContext): string | null;
  /** Qué es, para qué sirve y cómo se hace, con ejemplos («como… etc.»): uno o dos párrafos cortos. */
  description: string[];
  /** Molestias y riesgos, de los frecuentes a los raros pero graves. */
  risks: string[];
  /** Cuándo no se aplica. */
  contraindications: string[];
  /** Alternativas, incluida la de no hacerlo. */
  alternatives: string[];
  /** Riesgos y contraindicaciones por las circunstancias del paciente (art. 10.1.b). */
  personal(ctx: ConsentContext): PersonalRisk[];
};

/** El documento tal como se firmó: todo el texto (si la plantilla cambia, lo firmado no). */
export type ConsentDocument = {
  templateId: string;
  version: string;
  title: string;
  clinic: { name: string; taxId: string; address: string };
  professional: { name: string; license: string };
  patient: { name: string; birthDate: string | null; idDoc: string };
  /** Firma un representante (menor de 16 años o persona con apoyo): nombre, DNI y relación. */
  representative: { name: string; idDoc: string; relation: string } | null;
  techniques: string[];
  sections: { title: string; items: string[] }[];
  /** Fecha del documento (AAAA-MM-DD) y lugar. */
  date: string;
  place: string;
  /** La marca de la clínica con la que se firmó (null: la de OmniClin); los firmados antes de haber marca no la llevan. */
  brand?: Brand | null;
};
