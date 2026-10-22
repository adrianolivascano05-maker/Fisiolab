// Los cuestionarios de este grupo que se rellenan enteros en la app.
import { form as ases } from "./ases";
import { form as bctq } from "./bctq";
import { form as prtee } from "./prtee";
import { form as prwe } from "./prwe";
import { form as sirsi } from "./sirsi";
import { form as sst } from "./sst";
import type { QuestionForm } from "./types";
import { form as uefi } from "./uefi";

// En el orden del documento. DASH, WOSI, WORC, OSS y OES son de solo nota (sin preguntas).
export const FORMS: QuestionForm[] = [prwe, prtee, bctq, ases, sst, sirsi, uefi];
