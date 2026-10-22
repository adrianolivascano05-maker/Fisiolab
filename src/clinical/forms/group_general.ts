// Los cuestionarios de este grupo que se rellenan enteros en la app.
// CAT, MSWS-12 y EQ-5D-5L no están: son de solo nota (catalog/general.ts).
import { form as abc } from "./abc";
import { form as dhi } from "./dhi";
import { form as frail } from "./frail";
import { form as fss } from "./fss";
import { form as hipermovilidad5pq } from "./hipermovilidad_5pq";
import { form as iciqUiSf } from "./iciq_ui_sf";
import { form as mmrc } from "./mmrc";
import { form as nijmegen } from "./nijmegen";
import { form as pfdi20 } from "./pfdi_20";
import { form as pfiq7 } from "./pfiq_7";
import { form as promis10 } from "./promis_10";
import { form as sarcF } from "./sarc_f";
import { form as shortFesI } from "./short_fes_i";
import type { QuestionForm } from "./types";

export const FORMS: QuestionForm[] = [shortFesI, abc, dhi, sarcF, frail, iciqUiSf, pfdi20, pfiq7, nijmegen, mmrc, fss, hipermovilidad5pq, promis10];
