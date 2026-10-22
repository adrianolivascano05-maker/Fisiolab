// Los cuestionarios de este grupo que se rellenan enteros en la app.
import { form as alrRsi } from "./alr_rsi";
import { form as cait } from "./cait";
import { form as faamDeporte } from "./faam_deporte";
import { form as faos } from "./faos";
import { form as ffi } from "./ffi";
import { form as iprrs } from "./iprrs";
import { form as ostrcH2 } from "./ostrc_h2";
import type { QuestionForm } from "./types";

export const FORMS: QuestionForm[] = [faos, cait, faamDeporte, ffi, alrRsi, iprrs, ostrcH2];
