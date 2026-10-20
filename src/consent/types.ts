// Consentimientos informados (src/consent/README.md): documentos que el paciente firma antes de un tratamiento,
// hechos a partir de una plantilla revisable y de su anamnesis. La Ley 41/2002 (art. 8) pide el consentimiento
// por escrito en los procedimientos invasores o con riesgos notorios, y su art. 10 pide informar de las
// consecuencias, los riesgos frecuentes, los riesgos por las circunstancias personales y las contraindicaciones:
// esos últimos son los que salen de la anamnesis.

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
  /** El paciente tiene mediciones de rendimiento (saltos, fuerza, sprint…). */
  hasPerformanceTests: boolean;
  /** Texto del plan de intervención y del diagnóstico, en minúsculas, para sugerir técnicas. */
  planText: string;
};

/** Una técnica concreta dentro de un consentimiento (se marcan las que se van a usar). */
export type Technique = { id: string; label: string };

/** Una contraindicación o precaución que sale de la anamnesis para esta plantilla. */
export type PersonalRisk = {
  /** Lo que se le dice al paciente, en segunda persona («Como toma anticoagulantes, …»). */
  text: string;
  /** Contraindicación absoluta: el aviso para el fisioterapeuta es rojo y no se debería aplicar. */
  absolute?: boolean;
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
  /** Qué es, cómo se hace y para qué (párrafos). */
  description: string[];
  /** Beneficios que se esperan. */
  benefits: string[];
  /** Consecuencias seguras o molestias habituales. */
  expected: string[];
  /** Riesgos frecuentes (leves) y poco frecuentes (graves). */
  risks: { frequent: string[]; rare: string[] };
  /** Contraindicaciones generales. */
  contraindications: string[];
  /** Alternativas razonables. */
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
};
