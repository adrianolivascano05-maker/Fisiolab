// Organizar el tratamiento de un motivo de consulta por ciclos (docs/ciclos.md): el macrociclo (el objetivo general, con
// su inicio y su duración), los mesociclos (las fases, cada una con sus semanas) y los microciclos (las semanas, con
// una o varias sesiones tipo A, B… y sus ejercicios). Es opcional: un motivo sin plan no cambia en nada.
//
// La app solo registra y hace las cuentas que el fisio elige: no propone ejercicios, cargas, fases ni duraciones, no
// cambia de fase sola y no colorea por rangos.
//
// Se guarda en la tabla settings, que ya se sincroniza fila a fila (sin migración: un dispositivo sin actualizar sigue
// sincronizando y ve el texto de Tratamiento de cada sesión como siempre):
//   ciclos:<paciente>:<motivo>               el macrociclo y la lista de fases
//   ciclos:<paciente>:<motivo>:<fase>        las sesiones tipo, sus ejercicios y las casillas de cada semana de esa fase
//   ciclos:<paciente>:<motivo>:envios        los enlaces de «Enviar la semana al paciente» (src/data/cyclesShare.ts)
//   ciclos_hecho:<paciente>:<sesión>         lo marcado como hecho en una sesión
//   ciclos_ej:<nombre del ejercicio>         los últimos parámetros con que se usó un ejercicio (de la clínica)
// Cada clave es una fila: si dos dispositivos cambian la misma a la vez, se queda la más reciente y la otra se guarda en
// «Cambios sustituidos» (src/data/conflicts.ts). Dos fases distintas no se pisan.
//
// La primera parte son funciones puras (las prueba cycles.test.ts); al final, las que leen y escriben en la base.
import { addDays, dayOf } from "../app/dates";
import { fold } from "../app/format";
import type { Db } from "./db";

// ---------- Tipos ----------

/** Cómo se anota el esfuerzo en todo el plan. */
export type Effort = "rpe" | "rir" | "none";
/** Los parámetros que puede llevar un ejercicio. */
export type ParamKey = "sets" | "reps" | "kg" | "pct" | "effort" | "time" | "distance" | "rest" | "tempo" | "side";
export type Side = "izq" | "der" | "ambos";
/** Lo que se hace de un ejercicio en una semana. Lo que no está, no se usa. */
export type Dose = { sets?: number; reps?: number; kg?: number; pct?: number; effort?: number; time?: number; distance?: number; rest?: number; tempo?: string; side?: Side };
/** Cómo cambia un ejercicio de una semana a la siguiente. */
export type Rule = "same" | "rep1" | "rep2" | "rep3" | "kg2.5" | "kg5" | "pct5" | "rpe1" | "rir1" | "manual";

export type PlanExercise = {
  id: string;
  name: string;
  /** Los parámetros que se le anotan, en este orden. */
  params: ParamKey[];
  rule: Rule;
  /** En qué va el tiempo. */
  timeUnit: "s" | "min";
  /** 1RM aproximado (kg) calculado con la calculadora, para pasar el % 1RM a kilos; null si no se ha calculado. */
  oneRm: number | null;
  /** «Cómo se hace», escrito por el fisio para el paciente (sale en el enlace de la semana). Opcional. */
  how?: string;
};
export type SessionTpl = { id: string; label: string; exercises: PlanExercise[] };
/** Las casillas de una semana: sesión tipo → ejercicio → lo que toca. */
export type WeekCells = Record<string, Record<string, Dose>>;

export type PhaseDoc = {
  v: 1;
  id: string;
  /** El objetivo de la fase, en una línea (opcional). */
  goal: string;
  sessions: SessionTpl[];
  /** Una por semana de la fase. */
  weeks: WeekCells[];
  /** Las casillas cambiadas a mano: «semana:sesión:ejercicio:parámetro». Rellenar no las pisa sin preguntar. */
  manual: string[];
  /** Cuánta carga se quita en la semana de descarga, en % (0 a 60). */
  deloadPct: number;
};

export type PhaseRef = { id: string; name: string; weeks: number };
export type PlanDoc = {
  v: 1;
  /** El objetivo general (el macrociclo). */
  goal: string;
  /** El primer día (AAAA-MM-DD). La semana 1 es la que lo contiene, de lunes a domingo. */
  start: string;
  phases: PhaseRef[];
  /** Sesiones por semana. */
  perWeek: number;
  /** La última semana de cada fase es de descarga. */
  deload: boolean;
  effort: Effort;
};

/** Lo hecho en una sesión. */
export type DoneItem = { exId: string; state: "done" | "changed"; real?: Dose };
export type DoneDoc = {
  v: 1;
  phaseId: string;
  week: number;
  sessionTplId: string;
  items: DoneItem[];
  /** Lo añadido ese día: un ejercicio más o un texto libre. */
  extra: { name: string; dose?: Dose }[];
  /** El último texto que la app escribió en Tratamiento: si el fisio lo cambia a mano, la app ya no lo toca. */
  auto: string;
};

// ---------- Límites y valores de partida ----------

export const LIMITS = { phases: 8, weeks: 12, maxWeeks: 26, perWeek: 5, sessions: 4, exercises: 15, deloadPct: 60, how: 400, sent: 8 } as const;
export const DEFAULT_PARAMS: ParamKey[] = ["sets", "reps", "kg", "effort"];
export const PARAM_LABELS: Record<ParamKey, string> = {
  sets: "Series",
  reps: "Reps",
  kg: "Kg",
  pct: "% 1RM",
  effort: "Esfuerzo",
  time: "Tiempo",
  distance: "Distancia",
  rest: "Descanso",
  tempo: "Tempo",
  side: "Lado",
};
export const ALL_PARAMS: ParamKey[] = ["sets", "reps", "kg", "pct", "effort", "time", "distance", "rest", "tempo", "side"];
export const SIDE_LABELS: Record<Side, string> = { izq: "Izquierdo", der: "Derecho", ambos: "Ambos" };
export const RULE_LABELS: Record<Rule, string> = {
  same: "Igual",
  rep1: "+1 rep",
  rep2: "+2 reps",
  rep3: "+3 reps",
  "kg2.5": "+2,5 kg",
  kg5: "+5 kg",
  pct5: "+5 %",
  rpe1: "+1 RPE",
  rir1: "−1 RIR",
  manual: "A mano",
};
/** Las reglas que se ofrecen con el esfuerzo de este plan (+1 RPE solo con RPE; −1 RIR solo con RIR). */
export const rulesFor = (effort: Effort): Rule[] =>
  (["same", "rep1", "rep2", "rep3", "kg2.5", "kg5", "pct5", "rpe1", "rir1", "manual"] as Rule[]).filter((r) => (r === "rpe1" ? effort === "rpe" : r === "rir1" ? effort === "rir" : true));

/** Plantillas de fases: solo nombres y semanas, sin contenido clínico. */
export const PHASE_TEMPLATES: { id: string; label: string; phases: { name: string; weeks: number }[] }[] = [
  {
    id: "cuatro",
    label: "4 fases",
    phases: [
      { name: "Adaptación", weeks: 4 },
      { name: "Desarrollo", weeks: 6 },
      { name: "Pico", weeks: 6 },
      { name: "Transición", weeks: 4 },
    ],
  },
  { id: "una", label: "Solo una fase", phases: [{ name: "Fase 1", weeks: 4 }] },
];

const newId = () => crypto.randomUUID();

// ---------- Fechas y semanas ----------

/** El lunes de la semana de `day` (AAAA-MM-DD). */
export const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

export const totalWeeks = (plan: Pick<PlanDoc, "phases">) => plan.phases.reduce((n, p) => n + p.weeks, 0);

/** El último día del plan: el domingo de su última semana. */
export const planEnd = (plan: Pick<PlanDoc, "start" | "phases">) => addDays(mondayOf(plan.start), totalWeeks(plan) * 7 - 1);

/** En qué semana del plan cae un día (0 la primera; negativa antes de empezar; ≥ el total, después). */
export const weekIndexOf = (plan: Pick<PlanDoc, "start">, day: string) => Math.floor(daysBetween(mondayOf(plan.start), mondayOf(day)) / 7);

/** El primer y el último día de una semana del plan (la primera empieza el día de inicio). */
export function weekDays(plan: Pick<PlanDoc, "start">, week: number): [string, string] {
  const monday = addDays(mondayOf(plan.start), week * 7);
  return [week === 0 ? plan.start : monday, addDays(monday, 6)];
}

/** La semana del plan en su fase: qué fase (posición), qué semana de la fase y si es la de descarga. null fuera del plan. */
export function phaseAt(plan: Pick<PlanDoc, "phases" | "deload">, week: number): { index: number; week: number; weeks: number; deload: boolean } | null {
  if (week < 0) return null;
  let from = 0;
  for (const [index, p] of plan.phases.entries()) {
    if (week < from + p.weeks) {
      const w = week - from;
      return { index, week: w, weeks: p.weeks, deload: plan.deload && p.weeks > 1 && w === p.weeks - 1 };
    }
    from += p.weeks;
  }
  return null;
}

/** La primera semana del plan de cada fase. */
export const phaseStart = (plan: Pick<PlanDoc, "phases">, index: number) => plan.phases.slice(0, index).reduce((n, p) => n + p.weeks, 0);

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** «14 sep». */
export const shortDay = (day: string) => `${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
/** «20 semanas · del 14 sep al 31 ene». */
export function planSpanText(plan: Pick<PlanDoc, "start" | "phases">): string {
  const n = totalWeeks(plan);
  const d = shortDay;
  return `${n === 1 ? "1 semana" : `${n} semanas`} · del ${d(plan.start)} al ${d(planEnd(plan))}`;
}

// ---------- Crear y cambiar el plan ----------

export function newPlan(input: { goal: string; start: string; phases: { name: string; weeks: number }[]; perWeek: number; deload: boolean; effort: Effort }): PlanDoc {
  return {
    v: 1,
    goal: input.goal.trim(),
    start: input.start,
    phases: input.phases.map((p) => ({ id: newId(), name: p.name.trim() || "Fase", weeks: clamp(p.weeks, 1, LIMITS.weeks) })),
    perWeek: clamp(input.perWeek, 1, LIMITS.perWeek),
    deload: input.deload,
    effort: input.effort,
  };
}

/** Lo que falta o sobra para guardar el plan (null si está bien). */
export function checkPlan(plan: PlanDoc): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.start)) return "Pon el día en que empieza.";
  if (!plan.phases.length) return "Pon al menos una fase.";
  if (plan.phases.length > LIMITS.phases) return `Como mucho ${LIMITS.phases} fases.`;
  if (plan.phases.some((p) => p.weeks < 1 || p.weeks > LIMITS.maxWeeks)) return `Cada fase, de 1 a ${LIMITS.weeks} semanas.`;
  return null;
}

export function emptyPhase(id: string, weeks: number): PhaseDoc {
  return { v: 1, id, goal: "", sessions: [], weeks: Array.from({ length: weeks }, () => ({})), manual: [], deloadPct: 40 };
}

export function newExercise(name: string, remembered?: Remembered | null): PlanExercise {
  return {
    id: newId(),
    name: name.trim(),
    params: remembered?.params?.length ? remembered.params : [...DEFAULT_PARAMS],
    rule: remembered?.rule ?? "same",
    timeUnit: remembered?.timeUnit ?? "s",
    oneRm: null,
    ...(remembered?.how?.trim() ? { how: remembered.how.trim() } : {}),
  };
}

/** «Alargar 1 semana» la fase de esa posición: si tiene descarga, la nueva va antes de ella (copia de la anterior). */
export function extendPhase(plan: PlanDoc, doc: PhaseDoc | null, index: number): { plan: PlanDoc; doc: PhaseDoc | null } {
  const phases = plan.phases.map((p, i) => (i === index ? { ...p, weeks: Math.min(LIMITS.maxWeeks, p.weeks + 1) } : p));
  if (!doc) return { plan: { ...plan, phases }, doc };
  const weeks = [...doc.weeks];
  while (weeks.length < plan.phases[index]!.weeks) weeks.push({});
  const at = plan.deload && weeks.length > 1 ? weeks.length - 1 : weeks.length;
  weeks.splice(at, 0, clone(weeks[at - 1] ?? {}));
  // Las marcas «a mano» de las semanas que se corren una posición, también.
  const manual = doc.manual.map((k) => {
    const [w, ...rest] = k.split(":");
    return Number(w) >= at ? [Number(w) + 1, ...rest].join(":") : k;
  });
  return { plan: { ...plan, phases }, doc: { ...doc, weeks, manual } };
}

/** «Pasar a la siguiente fase»: la fase de esa posición acaba con la semana `week` (de la fase, desde 0). */
export function finishPhase(plan: PlanDoc, doc: PhaseDoc | null, index: number, week: number): { plan: PlanDoc; doc: PhaseDoc | null } {
  const keep = clamp(week + 1, 1, plan.phases[index]!.weeks);
  const phases = plan.phases.map((p, i) => (i === index ? { ...p, weeks: keep } : p));
  if (!doc) return { plan: { ...plan, phases }, doc };
  return { plan: { ...plan, phases }, doc: { ...doc, weeks: doc.weeks.slice(0, keep), manual: doc.manual.filter((k) => Number(k.split(":")[0]) < keep) } };
}

/**
 * «Poner ejercicios» en una fase nueva: las mismas sesiones tipo y ejercicios que la anterior, empezando con su última
 * semana normal (la de antes de la descarga, si la había).
 */
export function phaseFromPrevious(prev: PhaseDoc, prevDeload: boolean, id: string, weeks: number): PhaseDoc {
  const last = prevDeload && prev.weeks.length > 1 ? prev.weeks.length - 2 : prev.weeks.length - 1;
  const doc = emptyPhase(id, weeks);
  doc.sessions = clone(prev.sessions);
  doc.weeks[0] = clone(prev.weeks[last] ?? {});
  doc.deloadPct = prev.deloadPct;
  return doc;
}

/** «Lo de la última sesión»: la sesión tipo de la semana anterior (o, en la primera semana de una fase, de la anterior). */
export function copyFromWeek(doc: PhaseDoc, from: WeekCells, week: number, sessionId: string, fromSessionId = sessionId): PhaseDoc {
  const weeks = doc.weeks.map((w, i) => (i === week ? { ...w, [sessionId]: clone(from[fromSessionId] ?? {}) } : w));
  return { ...doc, weeks };
}

// ---------- Cómo progresa ----------

const round05 = (n: number) => Math.round(n * 2) / 2;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

/** La semana siguiente con una regla. Solo cambia lo que la regla dice; lo demás, igual. */
export function progress(prev: Dose, rule: Rule): Dose | null {
  if (rule === "manual") return null;
  const d: Dose = { ...prev };
  const add = (k: "reps" | "kg", n: number) => {
    if (d[k] !== undefined) d[k] = k === "kg" ? round05(d[k]! + n) : d[k]! + n;
  };
  if (rule === "rep1") add("reps", 1);
  if (rule === "rep2") add("reps", 2);
  if (rule === "rep3") add("reps", 3);
  if (rule === "kg2.5") add("kg", 2.5);
  if (rule === "kg5") add("kg", 5);
  // +5 %: a los kilos; sin kilos, al % 1RM.
  if (rule === "pct5") {
    if (d.kg !== undefined && d.kg > 0) d.kg = round05(d.kg * 1.05);
    else if (d.pct !== undefined) d.pct = round05(d.pct * 1.05);
  }
  if (rule === "rpe1" && d.effort !== undefined) d.effort = Math.min(10, d.effort + 1);
  if (rule === "rir1" && d.effort !== undefined) d.effort = Math.max(0, d.effort - 1);
  return d;
}

/** La semana de descarga: una serie menos (mínimo 1) y `pct` % menos de carga. Repeticiones y esfuerzo, iguales. */
export function deload(prev: Dose, pct: number): Dose {
  const p = clamp(pct, 0, LIMITS.deloadPct) / 100;
  const d: Dose = { ...prev };
  if (d.sets !== undefined) d.sets = Math.max(1, d.sets - 1);
  if (d.kg !== undefined) d.kg = round05(d.kg * (1 - p));
  if (d.pct !== undefined) d.pct = round05(d.pct * (1 - p));
  return d;
}

const cellKey = (week: number, sessionId: string, exId: string, param: ParamKey) => `${week}:${sessionId}:${exId}:${param}`;

/**
 * Rellena las semanas 2 a N de la fase desde la primera, con la regla de cada ejercicio y la descarga en la última
 * (si el plan la lleva). Las casillas cambiadas a mano no se tocan, salvo con `overwrite`; `kept` dice cuántas se han
 * dejado como estaban (y valdría la pena preguntar antes de pisarlas).
 */
export function fillPhase(doc: PhaseDoc, opts: { weeks: number; deload: boolean; overwrite?: boolean }): { doc: PhaseDoc; kept: number } {
  const weeks: WeekCells[] = Array.from({ length: opts.weeks }, (_, i) => clone(doc.weeks[i] ?? {}));
  const manual = new Set(doc.manual);
  let kept = 0;
  for (let w = 1; w < opts.weeks; w++) {
    const isDeload = opts.deload && opts.weeks > 1 && w === opts.weeks - 1;
    for (const s of doc.sessions) {
      for (const e of s.exercises) {
        const prev = weeks[w - 1]![s.id]?.[e.id];
        if (!prev) continue;
        const next = isDeload ? deload(prev, doc.deloadPct) : progress(prev, e.rule);
        if (!next) continue;
        const cur: Dose = { ...weeks[w]![s.id]?.[e.id] };
        for (const p of e.params) {
          const k = cellKey(w, s.id, e.id, p);
          if (manual.has(k) && !opts.overwrite) {
            if (cur[p] !== next[p]) kept++;
            continue;
          }
          setParam(cur, p, next[p]);
        }
        weeks[w]![s.id] = { ...weeks[w]![s.id], [e.id]: cur };
      }
    }
  }
  const out = opts.overwrite ? doc.manual.filter((k) => Number(k.split(":")[0]) === 0) : doc.manual;
  return { doc: { ...doc, weeks, manual: out }, kept };
}

/** Cambia a mano una casilla (fuera de la primera semana, queda marcada para que rellenar no la pise). */
export function setCell(doc: PhaseDoc, week: number, sessionId: string, exId: string, dose: Dose): PhaseDoc {
  const weeks = [...doc.weeks];
  while (weeks.length <= week) weeks.push({});
  weeks[week] = { ...weeks[week], [sessionId]: { ...weeks[week]![sessionId], [exId]: dose } };
  const before = doc.weeks[week]?.[sessionId]?.[exId] ?? {};
  const changed = (Object.keys({ ...before, ...dose }) as ParamKey[]).filter((p) => before[p] !== dose[p]).map((p) => cellKey(week, sessionId, exId, p));
  const manual = week === 0 ? doc.manual : [...new Set([...doc.manual, ...changed])];
  return { ...doc, weeks, manual };
}

function setParam(d: Dose, p: ParamKey, v: Dose[ParamKey]) {
  if (v === undefined) delete d[p];
  else (d as Record<string, unknown>)[p] = v;
}

// ---------- 1RM aproximado ----------

/**
 * 1RM aproximado con la fórmula de Epley (kg × (1 + reps / 30)); con una sola repetición, los propios kilos. Solo con
 * 12 repeticiones o menos. Redondeado a 0,5 kg. Es una estimación: la app no dice si es buena o mala.
 */
export function oneRmEpley(kg: number, reps: number): number | null {
  if (!(kg > 0) || !Number.isInteger(reps) || reps < 1 || reps > 12) return null;
  return reps === 1 ? round05(kg) : round05(kg * (1 + reps / 30));
}

/** Los kilos de un % del 1RM, a 0,5 kg; null sin 1RM. */
export const kgOfPct = (oneRm: number | null, pct: number | undefined) => (oneRm && pct !== undefined ? round05((oneRm * pct) / 100) : null);

// ---------- Lo que toca en una sesión y el texto de Tratamiento ----------

/** La sesión tipo que toca: rotando A, B… según cuántas sesiones van ya esa semana. */
export function sessionFor(doc: PhaseDoc, nth: number): SessionTpl | null {
  const withExercises = doc.sessions.filter((s) => s.exercises.length);
  return withExercises.length ? withExercises[nth % withExercises.length]! : null;
}

const num = (n: number) => String(n).replace(".", ",");

/** «3 × 12 con 45 kg (RPE 6)»: lo que se hace de un ejercicio, en palabras, siempre igual. */
export function doseText(d: Dose, effort: Effort, timeUnit: "s" | "min" = "s"): string {
  const q = d.reps !== undefined ? num(d.reps) : d.time !== undefined ? `${num(d.time)} ${timeUnit}` : d.distance !== undefined ? `${num(d.distance)} m` : null;
  let t = d.sets !== undefined && q ? `${num(d.sets)} × ${q}` : q ? (d.reps !== undefined ? `${q} reps` : q) : d.sets !== undefined ? `${num(d.sets)} ${d.sets === 1 ? "serie" : "series"}` : "";
  if (d.kg !== undefined && d.kg > 0) t += ` con ${num(d.kg)} kg`;
  else if (d.pct !== undefined) t += ` al ${num(d.pct)} % del 1RM`;
  if (d.tempo) t += `, tempo ${d.tempo}`;
  if (d.side) t += d.side === "ambos" ? ", los dos lados" : `, lado ${d.side === "izq" ? "izquierdo" : "derecho"}`;
  if (d.rest !== undefined) t += `, descanso ${num(d.rest)} s`;
  if (effort !== "none" && d.effort !== undefined) t += ` (${effort === "rpe" ? "RPE" : "RIR"} ${num(d.effort)})`;
  return t.trim();
}

/** El texto de Tratamiento con lo hecho: «Sentadilla a cajón 3 × 12 (RPE 6). Prensa bilateral 3 × 10 con 45 kg (RPE 8).» */
export function treatmentText(tpl: SessionTpl, planned: Record<string, Dose>, done: Pick<DoneDoc, "items" | "extra">, effort: Effort): string {
  const parts: string[] = [];
  for (const e of tpl.exercises) {
    const item = done.items.find((i) => i.exId === e.id);
    if (!item) continue;
    const d = item.state === "changed" && item.real ? item.real : (planned[e.id] ?? {});
    const text = doseText(d, effort, e.timeUnit);
    parts.push(`${e.name}${text ? ` ${text}` : ""}.`);
  }
  for (const x of done.extra) {
    const text = x.dose ? doseText(x.dose, effort) : "";
    const name = x.name.trim().replace(/\.$/, "");
    if (name) parts.push(`${name}${text ? ` ${text}` : ""}.`);
  }
  return parts.join(" ");
}

/** Lo que pasa a escribirse en Tratamiento: el texto nuevo, salvo que el fisio haya cambiado el anterior a mano. */
export function nextTreatment(current: string, lastAuto: string, generated: string): string | null {
  return current.trim() === "" || current === lastAuto ? generated : null;
}

// ---------- Leer y comprobar lo guardado ----------

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export const planKey = (patientId: string, episodeId: string) => `ciclos:${patientId}:${episodeId}`;
export const phaseKey = (patientId: string, episodeId: string, phaseId: string) => `${planKey(patientId, episodeId)}:${phaseId}`;
/** Los enlaces de «Enviar la semana al paciente» de ese plan (para volver a copiarlos o anularlos). */
export const sentKey = (patientId: string, episodeId: string) => `${planKey(patientId, episodeId)}:envios`;
export const doneKey = (patientId: string, sessionId: string) => `ciclos_hecho:${patientId}:${sessionId}`;
export const memoryKey = (name: string) => `ciclos_ej:${fold(name.trim()).replace(/\s+/g, " ")}`;
/** Si una clave de settings es de un plan por ciclos (para «Cambios sustituidos»). */
export const isCycleKey = (key: string) => key.startsWith("ciclos:") || key.startsWith("ciclos_hecho:");

/** Un plan leído de la base; null si no es uno válido de esta versión. */
export function parsePlan(raw: unknown): PlanDoc | null {
  const p = raw as PlanDoc | null;
  if (!p || p.v !== 1 || typeof p.start !== "string" || !Array.isArray(p.phases)) return null;
  return p;
}
export function parsePhase(raw: unknown): PhaseDoc | null {
  const p = raw as PhaseDoc | null;
  if (!p || p.v !== 1 || !Array.isArray(p.sessions) || !Array.isArray(p.weeks)) return null;
  return { ...p, manual: Array.isArray(p.manual) ? p.manual : [], deloadPct: typeof p.deloadPct === "number" ? p.deloadPct : 40 };
}

// ---------- En la base ----------

export type LoadedPlan = { plan: PlanDoc; phases: Record<string, PhaseDoc> };

export async function loadPlan(db: Db, patientId: string, episodeId: string): Promise<LoadedPlan | null> {
  const key = planKey(patientId, episodeId);
  const rows = await db.query<{ key: string; value: string }>("select key, value from settings where key = ? or key like ? || ':%'", [key, key]);
  const own = rows.find((r) => r.key === key);
  const plan = own ? parsePlan(JSON.parse(own.value)) : null;
  if (!plan) return null;
  const phases: Record<string, PhaseDoc> = {};
  for (const r of rows) {
    if (r.key === key) continue;
    const doc = parsePhase(JSON.parse(r.value));
    if (doc && plan.phases.some((p) => p.id === doc.id)) phases[doc.id] = doc;
  }
  return { plan, phases };
}

const upsert = (key: string, value: unknown) => ({
  sql: "insert into settings (key, value) values (?, ?) on conflict (key) do update set value = excluded.value",
  bind: [key, JSON.stringify(value)],
});

export async function savePlan(db: Db, patientId: string, episodeId: string, plan: PlanDoc, phases: PhaseDoc[] = []): Promise<void> {
  const err = checkPlan(plan);
  if (err) throw new RangeError(err);
  // Las fases que ya no están en el plan, fuera (sus sesiones no se tocan).
  const keep = new Set([...plan.phases.map((p) => phaseKey(patientId, episodeId, p.id)), sentKey(patientId, episodeId)]);
  const existing = await db.query<{ key: string }>("select key from settings where key like ? || ':%'", [planKey(patientId, episodeId)]);
  await db.transaction([
    upsert(planKey(patientId, episodeId), plan),
    ...phases.map((d) => upsert(phaseKey(patientId, episodeId, d.id), d)),
    ...existing.filter((r) => !keep.has(r.key)).map((r) => ({ sql: "delete from settings where key = ?", bind: [r.key] })),
  ]);
}

export async function savePhase(db: Db, patientId: string, episodeId: string, doc: PhaseDoc): Promise<void> {
  await db.transaction([upsert(phaseKey(patientId, episodeId, doc.id), doc)]);
}

/** Los planes de un paciente, de todos sus motivos (para el calendario). */
export async function loadPatientPlans(db: Db, patientId: string): Promise<{ episode: string; plan: PlanDoc }[]> {
  const rows = await db.query<{ key: string; value: string }>("select key, value from settings where key like ? || '%'", [`ciclos:${patientId}:`]);
  return rows
    .filter((r) => r.key.split(":").length === 3)
    .map((r) => ({ episode: r.key.split(":")[2]!, plan: parsePlan(JSON.parse(r.value)) }))
    .filter((x): x is { episode: string; plan: PlanDoc } => !!x.plan);
}

/** En qué fase de alguno de sus planes cae un día (el primero que lo cubre); null si en ninguna. */
export function phaseOnDay(plans: { episode: string; plan: PlanDoc }[], day: string): { episode: string; index: number; name: string; week: number; weeks: number } | null {
  for (const { episode, plan } of plans) {
    if (day < plan.start) continue;
    const at = phaseAt(plan, weekIndexOf(plan, day));
    if (at) return { episode, index: at.index, name: plan.phases[at.index]!.name, week: at.week, weeks: at.weeks };
  }
  return null;
}

/** Quita el plan de un motivo (sus sesiones y lo apuntado en ellas no se tocan). */
export async function deletePlan(db: Db, patientId: string, episodeId: string): Promise<void> {
  await db.transaction(planDeleteSql(patientId, episodeId));
}

/** Para borrar a la vez que un motivo: su plan y sus fases. */
export const planDeleteSql = (patientId: string, episodeId: string) => [
  { sql: "delete from settings where key = ? or key like ? || ':%'", bind: [planKey(patientId, episodeId), planKey(patientId, episodeId)] },
];
/** Para borrar a la vez que un paciente: todos sus planes y lo hecho en sus sesiones. */
export const patientCyclesDeleteSql = (patientId: string) => [
  { sql: "delete from settings where key like ? || '%' or key like ? || '%'", bind: [`ciclos:${patientId}:`, `ciclos_hecho:${patientId}:`] },
];
/** Para borrar a la vez que una sesión: lo marcado como hecho en ella. */
export const sessionCyclesDeleteSql = (patientId: string, sessionId: string) => [{ sql: "delete from settings where key = ?", bind: [doneKey(patientId, sessionId)] }];

/**
 * Lo de los planes que se ha quedado sin dueño: el paciente, el motivo o la sesión se han borrado en otro dispositivo
 * (la tabla settings no se borra en cascada). Se llama tras juntar la copia de la nube.
 */
export async function cleanOrphanCycles(db: Db): Promise<number> {
  const rows = await db.query<{ key: string }>("select key from settings where key like 'ciclos:%' or key like 'ciclos_hecho:%'");
  if (!rows.length) return 0;
  const [patients, episodes, sessions] = await Promise.all([
    db.query<{ id: string }>("select id from patients"),
    db.query<{ id: string; patient_id: string }>("select id, patient_id from episodes"),
    db.query<{ id: string; patient_id: string }>("select id, patient_id from sessions"),
  ]);
  const p = new Set(patients.map((r) => r.id));
  const e = new Set(episodes.map((r) => `${r.patient_id}:${r.id}`));
  const x = new Set(sessions.map((r) => `${r.patient_id}:${r.id}`));
  const gone = rows
    .map((r) => r.key)
    .filter((k) => {
      const [kind, patient, second] = k.split(":");
      if (!patient || !p.has(patient)) return true;
      if (kind === "ciclos_hecho") return !x.has(`${patient}:${second}`);
      // El primer motivo tiene el id del paciente y no siempre tiene fila en episodes.
      return second !== patient && !e.has(`${patient}:${second}`);
    });
  if (gone.length) await db.transaction(gone.map((k) => ({ sql: "delete from settings where key = ?", bind: [k] })));
  return gone.length;
}

export async function loadDone(db: Db, patientId: string, sessionId: string): Promise<DoneDoc | null> {
  const [row] = await db.query<{ value: string }>("select value from settings where key = ?", [doneKey(patientId, sessionId)]);
  const d = row ? (JSON.parse(row.value) as DoneDoc) : null;
  return d && d.v === 1 && Array.isArray(d.items) ? { ...d, extra: Array.isArray(d.extra) ? d.extra : [] } : null;
}

/** Lo que se guarda con la sesión: lo hecho (o, sin nada marcado, se quita). */
export const doneSql = (patientId: string, sessionId: string, done: DoneDoc | null) =>
  done && (done.items.length || done.extra.length) ? [upsert(doneKey(patientId, sessionId), done)] : sessionCyclesDeleteSql(patientId, sessionId);

/** Los últimos parámetros con que se usó un ejercicio (de la clínica, sin datos del paciente). */
export type Remembered = { params?: ParamKey[]; rule?: Rule; timeUnit?: "s" | "min"; how?: string };
export async function rememberedExercise(db: Db, name: string): Promise<Remembered | null> {
  const [row] = await db.query<{ value: string }>("select value from settings where key = ?", [memoryKey(name)]);
  return row ? (JSON.parse(row.value) as Remembered) : null;
}
/** Lo que se recuerda de cada ejercicio (de la clínica, sin datos del paciente): sus parámetros, cómo progresa y «Cómo se hace». */
export const rememberSql = (exercises: PlanExercise[]) =>
  exercises
    .filter((e) => e.name.trim())
    .map((e) => upsert(memoryKey(e.name), { name: e.name.trim(), params: e.params, rule: e.rule, timeUnit: e.timeUnit, ...(e.how?.trim() ? { how: e.how.trim() } : {}) }));

/** Los nombres de ejercicio ya usados en la clínica, para sugerirlos al escribir. */
export async function knownExerciseNames(db: Db): Promise<string[]> {
  const rows = await db.query<{ value: string }>("select value from settings where key like 'ciclos_ej:%'");
  return rows.map((r) => (JSON.parse(r.value) as { name?: string }).name ?? "").filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
}

/** En qué motivo está una sesión guardada. */
export async function sessionEpisode(db: Db, sessionId: string): Promise<string | null> {
  const [row] = await db.query<{ e: string }>("select coalesce(episode_id, patient_id) as e from sessions where id = ?", [sessionId]);
  return row?.e ?? null;
}

/**
 * Cuántas sesiones de ese motivo hay ya esa semana antes de `performedAt` (sin contar `except`): para saber qué sesión
 * tipo toca (A, B…). La semana, de lunes a domingo en el día de Madrid.
 */
export async function sessionsBeforeInWeek(db: Db, patientId: string, episodeId: string, performedAt: string, except?: string): Promise<number> {
  const day = dayOf(performedAt);
  const from = mondayOf(day);
  const rows = await db.query<{ performed_at: string; id: string }>(
    "select performed_at, id from sessions where patient_id = ? and coalesce(episode_id, patient_id) = ? and performed_at < ? and performed_at >= ?",
    [patientId, episodeId, performedAt, `${addDays(from, -1)}T00:00:00Z`],
  );
  return rows.filter((r) => r.id !== except && dayOf(r.performed_at) >= from && dayOf(r.performed_at) <= addDays(from, 6)).length;
}
