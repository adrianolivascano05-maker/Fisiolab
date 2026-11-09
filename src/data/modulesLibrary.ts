// Módulos de especialidad de OmniClin (docs/anamnesis-adaptable.md, fase 2): bloques de preguntas que una plantilla de
// la clínica lleva encima del tronco. Van como datos, con ids estables (`m_<nombre>`, y sus preguntas
// `m_<nombre>_<pregunta>`) y versión: cuando una clínica añade uno, pasa a ser suyo con sus cambios encima (como el
// tronco), y las versiones nuevas le llegan salvo en lo que ella cambió.
//
// Versión 1: las mismas preguntas de los tres paquetes de ejemplo que había en el editor («Para empezar, por
// especialidad»), cada módulo en su apartado propio. No ocultan preguntas del tronco, no proponen cuestionarios ni
// mediciones y no traen respuestas destacadas: eso, y los otros seis módulos, llegará con el documento «Módulos de
// especialidad: contenido revisado v2» (versión 2). Dos ajustes respecto a los paquetes: «Tono y espasticidad» la
// contesta solo el fisio (es de la exploración) y «Dolor en las relaciones sexuales» es delicada (lleva «Prefiero no
// responder» y no puede ser obligatoria), en lugar de tener «Prefiere no responder» como opción.
import type { Proposals } from "./anamnesisTemplates";
import type { OwnField } from "./anamnesisFields";

/** Las preguntas de un módulo que van en su apartado propio (no en uno del tronco). */
export const MODULE_SELF = "self";

export type ModuleSpec = {
  /** `m_<nombre>` (OmniClin) o `md_<8 hex>` (de la clínica). */
  id: string;
  name: string;
  version: number;
  /** Título de su apartado propio (si no, el nombre). */
  title?: string;
  /** Sus preguntas: `section` es «self» (su apartado) o un apartado del tronco. */
  fields: OwnField[];
  /** Preguntas del tronco que se ocultan al añadirlo a una plantilla (la clínica las puede volver a encender). */
  hideTrunk?: string[];
  /** Cuestionarios y mediciones que propone al abrir un motivo con una plantilla que lo lleva. */
  propose?: Proposals;
  /** Lo contesta un familiar o tutor: el formulario pregunta al principio quién contesta. */
  guardian?: boolean;
};

const q = (mod: string, id: string, f: Omit<OwnField, "id" | "section"> & { section?: string }): OwnField => ({ section: MODULE_SELF, ...f, id: `${mod}_${id}` });

export const MODULES_LIBRARY: ModuleSpec[] = [
  {
    id: "m_deportiva",
    name: "Fisioterapia deportiva",
    version: 1,
    fields: [
      q("m_deportiva", "deporte", { type: "text", label: "Deporte principal y nivel", who: "both" }),
      q("m_deportiva", "horas", { type: "text", label: "Horas de entrenamiento a la semana", who: "both" }),
      q("m_deportiva", "competicion", { type: "text", label: "Próxima competición o evento", who: "both" }),
      q("m_deportiva", "objetivo", { type: "textarea", label: "Objetivo deportivo", who: "both" }),
    ],
  },
  {
    id: "m_suelo_pelvico",
    name: "Suelo pélvico",
    version: 1,
    fields: [
      q("m_suelo_pelvico", "partos", { type: "textarea", label: "Embarazos y partos", who: "both" }),
      q("m_suelo_pelvico", "escapes", { type: "choice", label: "Escapes de orina", options: ["No", "Al esfuerzo", "Con urgencia", "Mixtos"], who: "both" }),
      q("m_suelo_pelvico", "absorbentes", { type: "text", label: "Uso de absorbentes", who: "both" }),
      q("m_suelo_pelvico", "dispareunia", { type: "choice", label: "Dolor en las relaciones sexuales", options: ["No", "Sí"], who: "both", sensitive: true }),
      q("m_suelo_pelvico", "intestinal", { type: "text", label: "Hábito intestinal", who: "both" }),
    ],
  },
  {
    id: "m_neurologica",
    name: "Fisioterapia neurológica",
    version: 1,
    fields: [
      q("m_neurologica", "diagnostico", { type: "textarea", label: "Diagnóstico neurológico y fecha", who: "both" }),
      q("m_neurologica", "ayudas", { type: "multi", label: "Ayudas técnicas", options: ["Bastón", "Andador", "Silla de ruedas", "Ortesis", "Ninguna"], who: "both" }),
      q("m_neurologica", "independencia", {
        type: "choice",
        label: "Nivel de independencia en las actividades diarias",
        options: ["Independiente", "Necesita algo de ayuda", "Dependiente"],
        who: "both",
      }),
      q("m_neurologica", "tono", { type: "textarea", label: "Tono y espasticidad", who: "clinician" }),
    ],
  },
];

export const libraryModule = (id: string) => MODULES_LIBRARY.find((m) => m.id === id);
export const isLibraryModule = (id: string) => id.startsWith("m_");
