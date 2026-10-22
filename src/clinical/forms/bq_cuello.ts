// BQ-C (Bournemouth Questionnaire, versión cuello o NBQ): las mismas 7 escalas de 0 a 10 que la lumbar (bq_lumbar.ts),
// para el dolor de cuello; nota 0-70 (suma), menos es mejor. Solo cambian la zona y los ejemplos del ítem 2.
import { bournemouth } from "./bq_lumbar";
import type { QuestionForm } from "./types";

export const form: QuestionForm = bournemouth({
  id: "bq_cuello",
  name: "BQ-C",
  zone: "cuello",
  dailyActivities: "tareas de casa, lavarse, vestirse, levantar peso, leer, conducir",
  source:
    "Bolton y Humphreys, 2002 (original), DOI 10.1067/mmt.2002.123333; Pérez-García et al., 2023 (validación española, NBQ-Sp), DOI 10.3390/healthcare11131926. Texto de trabajo fiel al original: revisar con la versión española publicada (Pérez-García et al., 2023) antes de usarlo en consulta.",
});
