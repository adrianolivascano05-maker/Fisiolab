// Los cuestionarios que se rellenan enteros en la app, por id del catálogo (../questionnaires.ts).
import { form as aclRsi } from "./acl_rsi";
import { form as csi } from "./csi";
import { form as fabq } from "./fabq";
import { form as faam } from "./faam";
import { form as gad7 } from "./gad7";
import { form as hoos } from "./hoos";
import { form as ipaq } from "./ipaq";
import { form as koos } from "./koos";
import { form as lefs } from "./lefs";
import { form as ompsq10 } from "./ompsq10";
import { form as pcs } from "./pcs";
import { form as phq9 } from "./phq9";
import { form as pseq } from "./pseq";
import { form as rand36 } from "./rand36";
import { ndi, odi, quickdash, spadi, tsk11 } from "./sheets";
import { getKind } from "../questionnaires";
import type { QuestionForm } from "./types";
import { FORMS as COLUMNA } from "./group_columna";
import { FORMS as DOLOR } from "./group_dolor";
import { FORMS as GENERAL } from "./group_general";
import { FORMS as MIEMBRO_INFERIOR } from "./group_miembroInferior";
import { FORMS as MIEMBRO_SUPERIOR } from "./group_miembroSuperior";
import { FORMS as PIE_DEPORTE } from "./group_pieDeporte";
import { form as visaA } from "./visa_a";
import { form as visaP } from "./visa_p";

const FORMS: QuestionForm[] = [
  koos, hoos, lefs, faam, visaA, visaP, aclRsi, ndi, odi, quickdash, spadi, tsk11,
  rand36, phq9, gad7, pcs, pseq, fabq, csi, ompsq10, ipaq,
  ...COLUMNA, ...MIEMBRO_SUPERIOR, ...MIEMBRO_INFERIOR, ...PIE_DEPORTE, ...DOLOR, ...GENERAL,
];

export const formFor = (kind: string): QuestionForm | undefined => FORMS.find((f) => f.id === kind);

/**
 * El formulario que se puede rellenar en la app: el de los pendientes del permiso de su titular, solo si la clínica
 * ha marcado que lo tiene (src/data/questionnairePermissions.ts); si no, se anota solo la nota.
 */
export function usableForm(kind: string, granted: readonly string[]): QuestionForm | undefined {
  if (getKind(kind)?.license === "comprobar" && !granted.includes(kind)) return undefined;
  return formFor(kind);
}
export type { Answers, FormScore, Item, QuestionForm } from "./types";
