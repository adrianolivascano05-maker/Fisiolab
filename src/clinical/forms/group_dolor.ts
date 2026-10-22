// Los cuestionarios de este grupo que se rellenan enteros en la app.
import { form as bipq } from "./bipq";
import { form as dass21 } from "./dass21";
import { form as dn4 } from "./dn4";
import { form as peg } from "./peg";
import { form as phq4 } from "./phq4";
import { form as pss10 } from "./pss10";
import { form as sLanss } from "./s_lanss";
import type { QuestionForm } from "./types";

export const FORMS: QuestionForm[] = [dn4, sLanss, peg, bipq, dass21, pss10, phq4];
