// Banderas rojas de la anamnesis: los síntomas de alarma (los marca el fisioterapeuta, los marca el paciente en su
// formulario o se encuentran en lo escrito) y los cuadros que forman juntos, con su urgencia y qué preguntar para
// profundizar. Ayuda a no pasar nada por alto; no diagnostica: decidir si derivar es del profesional.
//
// Fuentes de los cuadros (PubMed):
// - Finucane LM et al. International Framework for Red Flags for Potential Serious Spinal Pathologies. JOSPT 2020.
//   https://doi.org/10.2519/jospt.2020.9971 (cauda equina, cáncer, fractura, infección).
// - Dionne N et al. Diagnostic accuracy of red flags related to cauda equina syndrome. Musculoskelet Sci Pract 2019.
//   https://doi.org/10.1016/j.msksp.2019.05.004
// - Rushton A et al. International IFOMPT Cervical Framework. JOSPT 2023. https://doi.org/10.2519/jospt.2022.11147
// - Cook C et al. Clinical special tests for myelopathy. JOSPT 2009. https://doi.org/10.2519/jospt.2009.2938
// - Wells PS et al. Pretest probability of deep-vein thrombosis. Lancet 1997. https://doi.org/10.1016/S0140-6736(97)08140-3
// Los cuadros cardíaco, visceral y neurológico progresivo son orientativos: sin una regla validada detrás.
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

export type Urgency = "urgente" | "preferente";
export type Pattern = {
  id: string;
  name: string;
  urgency: Urgency;
  /** Por qué preocupa, en una frase. */
  why: string;
  /** Qué preguntar o explorar para confirmarlo o descartarlo. */
  ask: string[];
  source?: { cite: string; doi: string };
};

const FINUCANE = { cite: "Finucane et al., JOSPT 2020", doi: "10.2519/jospt.2020.9971" };

export const PATTERNS: Pattern[] = [
  {
    id: "cauda_equina",
    name: "Posible síndrome de cola de caballo",
    urgency: "urgente",
    why: "Alteración de esfínteres o de la sensibilidad en silla de montar con dolor lumbar o en las piernas.",
    ask: [
      "¿Desde cuándo? ¿Le cuesta empezar a orinar, no nota cuándo tiene la vejiga llena o se le escapa?",
      "¿Nota dormida la zona del periné, los genitales o al limpiarse?",
      "¿El dolor o el hormigueo baja por las dos piernas? ¿Pierde fuerza?",
      "¿Cambios en la función sexual?",
    ],
    source: { cite: "Finucane et al., JOSPT 2020; Dionne et al., MSK Sci Pract 2019", doi: "10.1016/j.msksp.2019.05.004" },
  },
  {
    id: "vascular_cervical",
    name: "Posible origen vascular cervical (arterias del cuello)",
    urgency: "urgente",
    why: "Mareo, visión doble, dificultad para hablar o tragar, caídas o un dolor de cabeza distinto, con dolor de cuello o de cabeza.",
    ask: [
      "¿Empezó de golpe, tras un gesto brusco, un golpe o una manipulación?",
      "¿Dolor de cabeza o de cuello distinto a cualquiera anterior?",
      "Busca las 5 D y 3 N: mareo, caídas bruscas, visión doble, dificultad para hablar o tragar; náuseas, nistagmo, entumecimiento de la cara.",
      "No apliques técnicas en el cuello hasta aclararlo.",
    ],
    source: { cite: "Rushton et al., JOSPT 2023 (Cervical Framework IFOMPT)", doi: "10.2519/jospt.2022.11147" },
  },
  {
    id: "tvp",
    name: "Posible trombosis venosa profunda",
    urgency: "urgente",
    why: "Pantorrilla hinchada, caliente o dolorosa en una sola pierna.",
    ask: [
      "¿Cirugía, escayola, inmovilización o un viaje largo en las últimas semanas?",
      "¿Cáncer activo o anticonceptivos hormonales?",
      "Compara el perímetro de las dos pantorrillas y busca edema con fóvea.",
    ],
    source: { cite: "Wells et al., Lancet 1997", doi: "10.1016/S0140-6736(97)08140-3" },
  },
  {
    id: "cardiaco",
    name: "Posible origen cardíaco o respiratorio",
    urgency: "urgente",
    why: "Dolor en el pecho, falta de aire o palpitaciones. Orientativo: no hay una regla validada en la app.",
    ask: [
      "¿Aparece con el esfuerzo y se calma en reposo?",
      "¿Se va al brazo izquierdo, la mandíbula o la espalda? ¿Suda o se marea?",
      "¿Factores de riesgo: tensión alta, diabetes, tabaco, colesterol?",
    ],
  },
  {
    id: "cancer",
    name: "Posible cáncer o metástasis",
    urgency: "preferente",
    why: "Antecedente de cáncer con otros signos (pérdida de peso, dolor nocturno, más de 50 años), o pérdida de peso con dolor nocturno.",
    ask: [
      "¿Qué cáncer, cuándo y cómo está ahora? ¿Sigue revisiones?",
      "¿Cuánto peso ha perdido y en cuánto tiempo?",
      "¿El dolor es constante, no cambia con la postura y va a más?",
    ],
    source: FINUCANE,
  },
  {
    id: "fractura",
    name: "Posible fractura",
    urgency: "preferente",
    why: "Traumatismo importante, o corticoides u osteoporosis con más de 50 años.",
    ask: [
      "¿Cómo fue el golpe o la caída? ¿Desde qué altura?",
      "¿Dolor muy localizado al tocar o al cargar peso?",
      "¿Osteoporosis, corticoides o fracturas previas por golpes pequeños?",
    ],
    source: FINUCANE,
  },
  {
    id: "infeccion",
    name: "Posible infección",
    urgency: "preferente",
    why: "Fiebre o malestar general, sobre todo con defensas bajas o dolor que no cede.",
    ask: [
      "¿Fiebre medida? ¿Desde cuándo?",
      "¿Cirugía, infiltración o infección reciente (orina, piel, dientes)?",
      "¿Diabetes, corticoides, drogas por vía intravenosa?",
    ],
    source: FINUCANE,
  },
  {
    id: "mielopatia",
    name: "Posible mielopatía cervical",
    urgency: "preferente",
    why: "Torpeza en las manos o inestabilidad al caminar, con dolor de cuello o pérdida de fuerza.",
    ask: [
      "¿Le cuesta abotonarse, escribir o coger cosas pequeñas?",
      "¿Camina con las piernas abiertas o se tropieza?",
      "Explora reflejos: Babinski, Hoffmann, clonus.",
    ],
    source: { cite: "Cook et al., JOSPT 2009", doi: "10.2519/jospt.2009.2938" },
  },
  {
    id: "visceral",
    name: "Posible origen visceral o urinario",
    urgency: "preferente",
    why: "Sangre en la orina o en las heces, o náuseas y vómitos. Orientativo: no hay una regla validada en la app.",
    ask: [
      "¿El dolor cambia con el movimiento o la postura, o no se modifica?",
      "¿Tiene relación con las comidas, la orina o las deposiciones?",
      "¿Fiebre, escozor al orinar o dolor en la fosa renal?",
    ],
  },
  {
    id: "neuro",
    name: "Afectación neurológica que avanza",
    urgency: "preferente",
    why: "Pérdida de fuerza o sensibilidad que va a más. Orientativo: no hay una regla validada en la app.",
    ask: [
      "¿Qué músculos y desde cuándo? ¿Va a más de un día a otro?",
      "Explora fuerza, sensibilidad y reflejos por niveles y compáralos con la próxima sesión.",
    ],
  },
];

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
export type PatternHit = { pattern: Pattern; flags: FlagId[] };

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
        while (at !== -1 && negated(text, at)) at = text.indexOf(w, at + w.length);
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

/** Lo que pesa además de los síntomas: la zona, la edad y si hay osteoporosis escrita. */
export type Context = { regions: string[]; age: number | null; osteoporosis: boolean };

/** Los cuadros que forman las banderas rojas encontradas: primero los urgentes. */
export function findPatterns(hits: FlagHit[], ctx: Context): PatternHit[] {
  const has = new Set(hits.map((h) => h.flag.id));
  const neck = ctx.regions.some((r) => r === "cervical" || r === "atm");
  const back = ctx.regions.some((r) => r === "lumbar" || r === "sacroiliaca" || r === "dorsal");
  const over50 = ctx.age !== null && ctx.age > 50;
  const out: PatternHit[] = [];
  const add = (id: string, flags: FlagId[]) => out.push({ pattern: PATTERNS.find((p) => p.id === id)!, flags: flags.filter((f) => has.has(f)) });

  if (has.has("esfinteres")) add("cauda_equina", ["esfinteres", "neuro"]);
  if (has.has("mareo") || has.has("cefalea")) add("vascular_cervical", ["mareo", "cefalea"]);
  if (has.has("pantorrilla")) add("tvp", ["pantorrilla"]);
  if (has.has("pecho")) add("cardiaco", ["pecho"]);
  if ((has.has("cancer") && (has.has("peso") || has.has("nocturno") || over50)) || (has.has("peso") && has.has("nocturno"))) add("cancer", ["cancer", "peso", "nocturno"]);
  if (has.has("trauma") || ((has.has("corticoides") || ctx.osteoporosis) && over50 && back)) add("fractura", ["trauma", "corticoides"]);
  if (has.has("fiebre")) add("infeccion", ["fiebre", "corticoides", "nocturno"]);
  if (has.has("torpeza") && (neck || has.has("neuro"))) add("mielopatia", ["torpeza", "neuro"]);
  if (has.has("sangre") || has.has("vomitos")) add("visceral", ["sangre", "vomitos"]);
  if (has.has("neuro") && !has.has("esfinteres") && !(has.has("torpeza") && neck)) add("neuro", ["neuro"]);

  return out.sort((x, y) => (x.pattern.urgency === y.pattern.urgency ? 0 : x.pattern.urgency === "urgente" ? -1 : 1));
}

/** Años cumplidos a partir de la fecha de nacimiento (aaaa-mm-dd), o null. */
export function ageOn(birthDate: string | null | undefined, today = new Date()): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}/.test(birthDate)) return null;
  const [y, m, d] = birthDate.slice(0, 10).split("-").map(Number) as [number, number, number];
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

/** Todo junto, para la anamnesis de un paciente. */
export function redFlagReview(a: Answers, birthDate: string | null | undefined, labelOf?: (fieldId: string) => string) {
  const hits = findFlags(a, labelOf);
  const regions = Array.isArray(a.regiones) ? (a.regiones as string[]) : [];
  const osteoporosis = Object.values(a).some((v) => (typeof v === "string" || Array.isArray(v)) && fold(String(v)).includes("osteopor"));
  return { hits, patterns: findPatterns(hits, { regions, age: ageOn(birthDate), osteoporosis }) };
}
