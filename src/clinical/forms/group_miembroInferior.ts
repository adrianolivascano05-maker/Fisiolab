// Los cuestionarios de este grupo que se rellenan enteros en la app.
import { form as hoos12 } from "./hoos12";
import { form as ikdc } from "./ikdc";
import { form as koos12 } from "./koos12";
import { form as kujala } from "./kujala";
import { form as lysholm } from "./lysholm";
import { form as marx } from "./marx";
import { form as tegner } from "./tegner";
import type { QuestionForm } from "./types";

// En el orden del documento. iHOT-12, HAGOS, VISA-G, OKS, OHS y WOMAC son de solo nota (sin preguntas).
export const FORMS: QuestionForm[] = [kujala, lysholm, ikdc, tegner, marx, koos12, hoos12];
