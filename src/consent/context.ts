// Lo que importa de la ficha y la anamnesis (del motivo de consulta que se ve) para los consentimientos.
import type { Answers } from "../data/clinical";
import { ageOn } from "../data/privacy";
import type { Patient } from "../data/repo";
import { detectPrecautions, PRECAUTIONS } from "./precautions";
import type { ConsentContext } from "./types";

const list = (a: Answers, id: string) => (Array.isArray(a[id]) ? (a[id] as string[]) : []);
const str = (a: Answers, id: string) => (typeof a[id] === "string" ? (a[id] as string) : "");
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function consentContext(patient: Patient, answers: Answers): ConsentContext {
  const precautions = list(answers, "precauciones")
    .map((label) => PRECAUTIONS.find((p) => p.label === label)?.id)
    .filter((x): x is string => !!x);
  return {
    age: ageOn(patient.birthDate),
    sex: patient.sex,
    regions: list(answers, "regiones"),
    precautions,
    detected: detectPrecautions(answers, precautions),
    redFlags: list(answers, "banderas_rojas"),
    planText: fold([str(answers, "plan"), str(answers, "diagnostico_funcional"), str(answers, "objetivos_corto"), str(answers, "objetivos_largo")].join(" \n ")),
  };
}
