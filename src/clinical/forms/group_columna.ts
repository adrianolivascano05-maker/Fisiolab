// Los cuestionarios de este grupo que se rellenan enteros en la app.
import { form as bqCuello } from "./bq_cuello";
import { form as bqLumbar } from "./bq_lumbar";
import { form as jfls8 } from "./jfls8";
import { form as midas } from "./midas";
import { form as rmdq } from "./rmdq";
import { form as sbst } from "./sbst";
import { form as tmdPainScreener } from "./tmd_pain_screener";
import type { QuestionForm } from "./types";

export const FORMS: QuestionForm[] = [rmdq, sbst, bqLumbar, bqCuello, jfls8, tmdPainScreener, midas];
