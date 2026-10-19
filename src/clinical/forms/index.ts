// Los cuestionarios que se rellenan enteros en la app, por id del catálogo (../questionnaires.ts).
import { form as aclRsi } from "./acl_rsi";
import { form as faam } from "./faam";
import { form as hoos } from "./hoos";
import { form as koos } from "./koos";
import { form as lefs } from "./lefs";
import { ndi, odi, quickdash, spadi, tsk11 } from "./sheets";
import type { QuestionForm } from "./types";
import { form as visaA } from "./visa_a";
import { form as visaP } from "./visa_p";

const FORMS: QuestionForm[] = [koos, hoos, lefs, faam, visaA, visaP, aclRsi, ndi, odi, quickdash, spadi, tsk11];

export const formFor = (kind: string): QuestionForm | undefined => FORMS.find((f) => f.id === kind);
export type { Answers, FormScore, Item, QuestionForm } from "./types";
