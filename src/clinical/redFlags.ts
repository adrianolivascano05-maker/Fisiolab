// Banderas rojas de la anamnesis: síntomas y signos que puede referir el paciente (los marca el fisioterapeuta, los
// marca el paciente en su formulario o se encuentran en lo escrito). Es una lista para no pasar nada por alto: no los
// agrupa en enfermedades, no dice qué urgencia tienen ni qué hacer. Lo que se haga con ellos es del profesional.
//
// De dónde sale la lista (síntomas y signos que recogen estos documentos):
// - Finucane LM et al. International Framework for Red Flags for Potential Serious Spinal Pathologies. JOSPT 2020.
//   https://doi.org/10.2519/jospt.2020.9971
// - Rushton A et al. International IFOMPT Cervical Framework. JOSPT 2023. https://doi.org/10.2519/jospt.2022.11147
import type { Answers } from "../data/clinical";

export type FlagId =
  | "peso"
  | "fiebre"
  | "cancer"
  | "nocturno"
  | "trauma"
  | "esfinteres"
  | "neuro"
  | "corticoides"
  | "mareo"
  | "cefalea"
  | "torpeza"
  | "pecho"
  | "pantorrilla"
  | "vomitos"
  | "sangre";

export type RedFlag = {
  id: FlagId;
  /** Cómo sale en la lista del fisioterapeuta (las 8 primeras, con el mismo texto de siempre: lo guardado vale). */
  label: string;
  /** Cómo se le pregunta al paciente en su formulario. */
  patient: string;
  /** Palabras que, escritas en la anamnesis, hacen pensar en ella (sin tildes ni mayúsculas). */
  words: string[];
};

export const FLAGS: RedFlag[] = [
  { id: "peso", label: "Pérdida de peso sin explicación", patient: "He perdido peso sin hacer dieta", words: ["perdida de peso", "perdido peso", "pierdo peso", "adelgaz"] },
  { id: "fiebre", label: "Fiebre o malestar general", patient: "Tengo fiebre, escalofríos o me encuentro mal en general", words: ["fiebre", "escalofrio", "sudores nocturnos", "sudor nocturno", "malestar general"] },
  { id: "cancer", label: "Antecedente de cáncer", patient: "Tengo o he tenido cáncer", words: ["cancer", "tumor", "oncolog", "quimioterapia", "radioterapia", "metastasis", "neoplasia", "linfoma", "leucemia", "carcinoma"] },
  { id: "nocturno", label: "Dolor nocturno que no cede con el reposo", patient: "Me duele por la noche aunque esté quieto o quieta", words: ["dolor nocturno", "no me deja dormir", "no le deja dormir", "me despierta el dolor", "le despierta el dolor", "no cede con el reposo"] },
  { id: "trauma", label: "Traumatismo importante reciente", patient: "He tenido hace poco una caída o un golpe fuerte", words: ["accidente", "atropell", "caida", "golpe fuerte", "traumatismo"] },
  { id: "esfinteres", label: "Alteración de esfínteres o anestesia en silla de montar", patient: "Me cuesta orinar, se me escapa la orina o las heces sin querer, o noto dormida la zona entre las piernas", words: ["silla de montar", "anestesia perineal", "no puedo orinar", "retencion de orina", "incontinencia fecal", "escapes de heces", "perdida de control de esfinteres"] },
  { id: "neuro", label: "Pérdida de fuerza o sensibilidad que avanza", patient: "Pierdo fuerza o sensibilidad en brazos o piernas, y va a más", words: ["perdida de fuerza", "pierdo fuerza", "pierde fuerza", "perdida de sensibilidad", "debilidad progresiva", "pie caido"] },
  { id: "corticoides", label: "Corticoides durante mucho tiempo o inmunosupresión", patient: "Tomo o he tomado mucho tiempo corticoides o medicación que baja las defensas", words: ["corticoid", "prednison", "inmunosupres", "trasplant", "vih"] },
  { id: "mareo", label: "Mareo, visión doble, dificultad para hablar o tragar, caídas bruscas", patient: "Tengo mareos, veo doble, me cuesta hablar o tragar, o me caigo de golpe", words: ["mareo", "vertigo", "vision doble", "diplopia", "disartria", "disfagia", "cuesta tragar", "nistagmo", "desmayo", "sincope"] },
  { id: "cefalea", label: "Dolor de cabeza nuevo, muy fuerte o distinto al habitual", patient: "Tengo un dolor de cabeza nuevo, muy fuerte o distinto al de siempre", words: ["peor dolor de cabeza", "cefalea subita", "dolor de cabeza nuevo", "cefalea intensa", "cefalea nueva"] },
  { id: "torpeza", label: "Torpeza en las manos o inestabilidad al caminar", patient: "Noto torpeza en las manos (abotonar, escribir) o inestabilidad al caminar", words: ["torpeza", "se me caen las cosas", "se le caen las cosas", "inestabilidad al caminar", "inestabilidad en la marcha", "abotonar"] },
  { id: "pecho", label: "Dolor en el pecho, falta de aire o palpitaciones", patient: "Me duele el pecho, me falta el aire o noto palpitaciones", words: ["dolor en el pecho", "dolor toracico", "opresion en el pecho", "falta de aire", "disnea", "palpitaciones", "ahogo"] },
  { id: "pantorrilla", label: "Pantorrilla hinchada, caliente o dolorosa en una pierna", patient: "Tengo una pantorrilla hinchada, caliente o con dolor", words: ["pantorrilla hinchada", "gemelo hinchado", "pierna hinchada", "trombosis", "tvp"] },
  { id: "vomitos", label: "Náuseas o vómitos", patient: "Tengo náuseas o vómitos", words: ["vomit", "nausea"] },
  { id: "sangre", label: "Sangre en la orina o en las heces", patient: "He visto sangre en la orina o en las heces", words: ["sangre en la orina", "orina con sangre", "orino sangre", "hematuria", "sangre en las heces", "heces con sangre", "rectorragia", "melena"] },
];

/** La lista del fisioterapeuta (campo «Banderas rojas»). */
export const RED_FLAG_LABELS = FLAGS.map((f) => f.label);
/** La lista del paciente (campo «sintomas_paciente»). */
export const PATIENT_FLAG_LABELS = FLAGS.map((f) => f.patient);

/** Sin tildes ni mayúsculas, para buscar palabras. */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** ¿Está dicho en negativo? «no tiene fiebre», «sin vómitos», «niega mareos». */
function negated(text: string, at: number): boolean {
  const before = text.slice(Math.max(0, at - 25), at);
  return /(^|[\s,.;(])(no|sin|niega|ni|nunca|tampoco)(\s+\S+){0,2}\s*$/.test(before);
}

export type FlagHit = {
  flag: RedFlag;
  /** Marcada por el fisioterapeuta, por el paciente en su formulario, o encontrada en lo escrito. */
  from: "marcada" | "paciente" | "texto";
  /** En qué campo y con qué palabras (solo si se ha encontrado en el texto). */
  field?: string;
  quote?: string;
};

/** Un fragmento corto alrededor de lo encontrado. */
function snippet(text: string, at: number, len: number): string {
  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, at - 30)) + 1);
  const endAt = text.indexOf(" ", Math.min(text.length, at + len + 30));
  const end = endAt === -1 ? text.length : endAt;
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/**
 * Las banderas rojas de una anamnesis: las marcadas, las que marcó el paciente y las que salen en lo escrito (sin
 * contar lo dicho en negativo), una vez cada una y por ese orden de fiabilidad.
 */
export function findFlags(a: Answers, labelOf: (fieldId: string) => string = (id) => id): FlagHit[] {
  const hits = new Map<FlagId, FlagHit>();
  const list = (id: string) => (Array.isArray(a[id]) ? (a[id] as string[]) : []);
  for (const l of list("banderas_rojas")) {
    const f = FLAGS.find((x) => x.label === l);
    if (f) hits.set(f.id, { flag: f, from: "marcada" });
  }
  for (const l of list("sintomas_paciente")) {
    const f = FLAGS.find((x) => x.patient === l);
    if (f && !hits.has(f.id)) hits.set(f.id, { flag: f, from: "paciente" });
  }
  for (const [field, v] of Object.entries(a)) {
    if (typeof v !== "string" || !v.trim()) continue;
    const text = fold(v);
    for (const f of FLAGS) {
      if (hits.has(f.id)) continue;
      for (const w of f.words) {
        let at = text.indexOf(w);
        // Palabra entera por delante («vih», no «uvih…») y no dicha en negativo.
        while (at !== -1 && ((at > 0 && /[a-zñ]/.test(text[at - 1]!)) || negated(text, at))) at = text.indexOf(w, at + w.length);
        if (at !== -1) {
          hits.set(f.id, { flag: f, from: "texto", field: labelOf(field), quote: snippet(v, at, w.length) });
          break;
        }
      }
    }
  }
  const order = new Map(FLAGS.map((f, i) => [f.id, i]));
  return [...hits.values()].sort((x, y) => order.get(x.flag.id)! - order.get(y.flag.id)!);
}

/** Las banderas rojas de una anamnesis, para la ficha, la anamnesis y la carta de derivación. */
export function redFlagReview(a: Answers, labelOf?: (fieldId: string) => string) {
  return { hits: findFlags(a, labelOf) };
}
