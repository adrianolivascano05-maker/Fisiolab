// Los cuestionarios que se rellenan enteros en la app, por id del catálogo (../questionnaires.ts): solo los de uso
// libre. Los de pago, o que piden permiso a su titular, no tienen aquí su texto: los de pago están fuera del servicio
// (catalog/retired.ts) y de los demás se anota la nota de la hoja oficial.
import { form as ases } from "./ases";
import { form as bctq } from "./bctq";
import { form as cait } from "./cait";
import { form as dass21 } from "./dass21";
import { form as faam } from "./faam";
import { form as faamDeporte } from "./faam_deporte";
import { form as frail } from "./frail";
import { form as gad7 } from "./gad7";
import { form as hipermovilidad5pq } from "./hipermovilidad_5pq";
import { form as ipaq } from "./ipaq";
import { form as iprrs } from "./iprrs";
import { form as jfls8 } from "./jfls8";
import { form as kujala } from "./kujala";
import { form as lysholm } from "./lysholm";
import { form as marx } from "./marx";
import { form as mmrc } from "./mmrc";
import { form as nijmegen } from "./nijmegen";
import { form as peg } from "./peg";
import { form as pfdi20 } from "./pfdi_20";
import { form as pfiq7 } from "./pfiq_7";
import { form as phq4 } from "./phq4";
import { form as phq9 } from "./phq9";
import { form as rand36 } from "./rand36";
import { form as sarcF } from "./sarc_f";
import { form as shortFesI } from "./short_fes_i";
import { form as sst } from "./sst";
import { form as tegner } from "./tegner";
import { form as tmdPainScreener } from "./tmd_pain_screener";
import type { QuestionForm } from "./types";

const FORMS: QuestionForm[] = [
  ases,
  bctq,
  cait,
  dass21,
  faam,
  faamDeporte,
  frail,
  gad7,
  hipermovilidad5pq,
  ipaq,
  iprrs,
  jfls8,
  kujala,
  lysholm,
  marx,
  mmrc,
  nijmegen,
  peg,
  pfdi20,
  pfiq7,
  phq4,
  phq9,
  rand36,
  sarcF,
  shortFesI,
  sst,
  tegner,
  tmdPainScreener,
];

export const formFor = (kind: string): QuestionForm | undefined => FORMS.find((f) => f.id === kind);
export { citeOf, WORKING_TRANSLATION } from "./types";
export type { Answers, FormScore, Item, QuestionForm } from "./types";
