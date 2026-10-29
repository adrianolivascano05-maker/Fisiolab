// Cuestionarios de este grupo (docs/cuestionarios.md): su ficha en el catálogo.
import type { QuestionnaireKind } from "../questionnaires";

export const KINDS: QuestionnaireKind[] = [
  {
    id: "dash",
    name: "DASH (miembro superior, versión completa)",
    min: 0,
    max: 100,
    better: "lower",
    // El cuerpo principal y cada módulo opcional se puntúan aparte y no se suman.
    subscales: ["Cuerpo principal", "Módulo de trabajo", "Módulo de deporte/artes escénicas"],
    regions: ["hombro", "codo", "muneca_mano"],
    hint: "Discapacidad y síntomas del miembro superior en cualquier trastorno musculoesquelético de hombro, codo, muñeca o mano; se elige en lugar del QuickDASH cuando hace falta más precisión o los módulos de trabajo y de deporte/música.",
    scoreOnly: true,
    link: {
      url: "https://dash.iwh.on.ca",
      label: "Institute for Work & Health (dash.iwh.on.ca)",
    },
    reading:
      "Cambio mínimo importante del cuerpo principal: 10,83 puntos como límite inferior y 15 como límite superior; cambio mínimo detectable al 90 %: 10,81 puntos (Franchignoni 2014).",
    refs: "Hudak et al., 1996 (original), DOI 10.1002/(SICI)1097-0274(199606)29:6<602::AID-AJIM4>3.0.CO;2-L; Hervás et al., 2006 (validación española), DOI 10.1157/13093053; Franchignoni et al., 2014 (MCID), DOI 10.2519/jospt.2014.4893",
  },
  {
    id: "prwe",
    name: "PRWE (muñeca)",
    min: 0,
    max: 100,
    better: "lower",
    regions: ["muneca_mano"],
    hint: "Dolor y discapacidad de la muñeca: es la referencia en la fractura de radio distal y se usa también en otras lesiones de muñeca (esguinces, TFCC, rizartrosis con afectación de la muñeca).",
    reading:
      "En la versión española (fractura de radio distal), el cambio mínimo detectable (MDC90) fue de 12,1–13,7 puntos (Rosales 2017); no hay MCID verificado.",
    refs: "MacDermid et al., 1998 (original), DOI 10.1097/00005131-199811000-00009; Rosales et al., 2017 (validación española), DOI 10.1186/s12955-017-0745-2; Simental-Mendía et al., 2026 (versión mexicana), DOI 10.1080/09638288.2025.2574534",
    scoreOnly: true,
    link: {
      url: "https://doi.org/10.1186/s12955-017-0745-2",
      label: "Artículo de la validación, en abierto, con el cuestionario",
    },
  },
  {
    id: "bctq",
    name: "BCTQ (túnel carpiano, Boston)",
    min: 1,
    max: 5,
    better: "lower",
    // Las dos escalas se dan por separado y no se combinan: cada una es un registro.
    subscales: ["Gravedad de síntomas (SSS)", "Estado funcional (FSS)"],
    regions: ["muneca_mano"],
    hint: "Gravedad de los síntomas y estado funcional en el síndrome del túnel carpiano, para seguir el tratamiento conservador (férulas, neurodinamia, terapia manual) y el postoperatorio.",
    refs: "Levine et al., 1993 (original), DOI 10.2106/00004623-199311000-00002; Oteo-Álvaro et al., 2016 (validación española), DOI 10.1016/j.medcli.2015.10.013",
  },
  {
    id: "ases",
    name: "ASES (hombro)",
    min: 0,
    max: 100,
    better: "higher",
    regions: ["hombro"],
    hint: "Dolor y función del hombro en las actividades de la vida diaria; se usa mucho en patología del manguito, en artroplastia y en ensayos de fisioterapia de hombro.",
    reading: "Cambio mínimo importante: 6,4 puntos; cambio mínimo detectable al 90 %: 9,7 puntos (Michener 2002, pacientes de fisioterapia).",
    refs: "Richards et al., 1994 (original), DOI 10.1016/S1058-2746(09)80019-0; Vrotsou et al., 2016 (validación española), DOI 10.1186/s12955-016-0552-1; Michener et al., 2002 (MCID), DOI 10.1067/mse.2002.127096; Policastro et al., 2019 (versión argentina), DOI 10.1016/j.msksp.2019.05.010",
  },
  {
    id: "sst",
    name: "SST (test simple del hombro)",
    min: 0,
    max: 12,
    better: "higher",
    regions: ["hombro"],
    hint: "Función del hombro con 12 preguntas de sí/no sobre tareas concretas: es muy rápido y sirve para seguir la evolución en cualquier patología del hombro.",
    refs: "Lippitt et al., 1993 (original, capítulo de libro; referencia sin verificar, no está en PubMed); Membrilla-Mesa et al., 2015 (validación española), DOI 10.1007/s11136-014-0760-2",
  },
];
