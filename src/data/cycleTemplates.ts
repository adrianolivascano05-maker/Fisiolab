// Plantillas de plan por ciclos de la clínica (docs/ciclos.md, fase C): un plan guardado para volver a usarlo con otro
// paciente. Solo lleva lo que el fisio escribió como estructura: las fases y sus semanas, las sesiones por semana, la
// descarga, el esfuerzo y, de cada fase, sus sesiones tipo, ejercicios (con «Cómo se hace») y casillas. No lleva fechas,
// ni el objetivo general ni los de cada fase (pueden hablar del paciente), ni el 1RM calculado (es de esa persona).
//
// Se guardan en settings, una fila por plantilla («ciclos_plantilla:<id>»), y se sincronizan con la clínica.
import { LIMITS, newPlan, type Effort, type LoadedPlan, type PhaseDoc, type PlanDoc } from "./cycles";
import type { Db } from "./db";

/** Lo de una fase que va en la plantilla (sin id ni objetivo). */
export type TemplatePhase = Pick<PhaseDoc, "sessions" | "weeks" | "manual" | "deloadPct" | "assess">;
export type CycleTemplate = {
  v: 1;
  id: string;
  name: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  phases: { name: string; weeks: number }[];
  perWeek: number;
  deload: boolean;
  effort: Effort;
  /** Una por fase, en el mismo orden; null si esa fase no tenía ejercicios. */
  docs: (TemplatePhase | null)[];
};

export const TEMPLATE_PREFIX = "ciclos_plantilla:";
export const templateKey = (id: string) => `${TEMPLATE_PREFIX}${id}`;
export const NAME_MAX = 60;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** La plantilla de un plan: su estructura y sus ejercicios, sin nada de esa persona. */
export function templateFromPlan(loaded: LoadedPlan, name: string, now = new Date().toISOString(), id: string = crypto.randomUUID()): CycleTemplate {
  const { plan, phases } = loaded;
  return {
    v: 1,
    id,
    name: name.trim().slice(0, NAME_MAX),
    archived: false,
    createdAt: now,
    updatedAt: now,
    phases: plan.phases.map((p) => ({ name: p.name, weeks: p.weeks })),
    perWeek: plan.perWeek,
    deload: plan.deload,
    effort: plan.effort,
    docs: plan.phases.map((p) => {
      const d = phases[p.id];
      if (!d?.sessions.some((s) => s.exercises.length)) return null;
      return {
        sessions: clone(d.sessions).map((s) => ({ ...s, exercises: s.exercises.map((e) => ({ ...e, oneRm: null })) })),
        weeks: clone(d.weeks).slice(0, p.weeks),
        manual: [...d.manual],
        deloadPct: d.deloadPct,
        ...(d.assess?.length ? { assess: d.assess.filter((w) => w < p.weeks) } : {}),
      };
    }),
  };
}

/** Una fase de la plantilla para un plan nuevo: con su id, objetivo vacío y ejercicios con ids nuevos. */
export function phaseFromTemplate(t: TemplatePhase, id: string, weeks: number): PhaseDoc {
  const ids = new Map<string, string>();
  const sessIds = new Map<string, string>();
  const sessions = t.sessions.map((s) => {
    const sid = crypto.randomUUID();
    sessIds.set(s.id, sid);
    return {
      ...clone(s),
      id: sid,
      exercises: s.exercises.map((e) => {
        const nid = crypto.randomUUID();
        ids.set(e.id, nid);
        return { ...clone(e), id: nid, oneRm: null };
      }),
    };
  });
  const cells = Array.from({ length: weeks }, (_, w) => {
    const src = t.weeks[w] ?? {};
    return Object.fromEntries(
      Object.entries(src)
        .filter(([s]) => sessIds.has(s))
        .map(([s, byEx]) => [sessIds.get(s)!, Object.fromEntries(Object.entries(byEx).filter(([e]) => ids.has(e)).map(([e, d]) => [ids.get(e)!, clone(d)]))]),
    );
  });
  // Las marcas «a mano» («semana:sesión:ejercicio:parámetro») con los ids nuevos.
  const manual = t.manual
    .map((k) => {
      const [w, s, e, p] = k.split(":");
      return Number(w) < weeks && sessIds.has(s!) && ids.has(e!) ? `${w}:${sessIds.get(s!)}:${ids.get(e!)}:${p}` : null;
    })
    .filter((k): k is string => k !== null);
  const assess = t.assess?.filter((w) => w < weeks);
  return { v: 1, id, goal: "", sessions, weeks: cells, manual, deloadPct: t.deloadPct, ...(assess?.length ? { assess } : {}) };
}

/** El plan de una plantilla, con su objetivo e inicio: las fases con ids nuevos y sus ejercicios. */
export function planFromTemplate(t: CycleTemplate, input: { goal: string; start: string }): { plan: PlanDoc; docs: PhaseDoc[] } {
  const plan = newPlan({ goal: input.goal, start: input.start, phases: t.phases, perWeek: t.perWeek, deload: t.deload, effort: t.effort });
  const docs = plan.phases.flatMap((p, i) => (t.docs[i] ? [phaseFromTemplate(t.docs[i]!, p.id, p.weeks)] : []));
  return { plan, docs };
}

/** Una plantilla leída de la base; null si no es una válida. */
export function parseTemplate(raw: unknown): CycleTemplate | null {
  const t = raw as CycleTemplate | null;
  if (!t || t.v !== 1 || typeof t.id !== "string" || typeof t.name !== "string" || !Array.isArray(t.phases) || !t.phases.length) return null;
  if (t.phases.length > LIMITS.phases) return null;
  return { ...t, archived: !!t.archived, docs: Array.isArray(t.docs) ? t.docs : t.phases.map(() => null) };
}

/** «4 fases · 20 semanas · 2 por semana · 6 ejercicios» */
export function templateSummary(t: CycleTemplate): string {
  const weeks = t.phases.reduce((n, p) => n + p.weeks, 0);
  const exercises = t.docs.reduce((n, d) => n + (d?.sessions.reduce((m, s) => m + s.exercises.length, 0) ?? 0), 0);
  return [
    t.phases.length === 1 ? "1 fase" : `${t.phases.length} fases`,
    weeks === 1 ? "1 semana" : `${weeks} semanas`,
    `${t.perWeek} por semana`,
    exercises ? (exercises === 1 ? "1 ejercicio" : `${exercises} ejercicios`) : "sin ejercicios",
  ].join(" · ");
}

// ---------- En la base ----------

export async function listTemplates(db: Db): Promise<CycleTemplate[]> {
  const rows = await db.query<{ value: string }>("select value from settings where key like ? || '%'", [TEMPLATE_PREFIX]);
  return rows
    .map((r) => parseTemplate(JSON.parse(r.value)))
    .filter((t): t is CycleTemplate => !!t)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Guarda la plantilla; con `touch`, con la hora de ahora como la de su último cambio. */
export async function saveTemplate(db: Db, t: CycleTemplate, opts: { touch?: boolean } = {}): Promise<void> {
  if (!t.name.trim()) throw new RangeError("Ponle un nombre a la plantilla.");
  await db.transaction([
    {
      sql: "insert into settings (key, value) values (?, ?) on conflict (key) do update set value = excluded.value",
      bind: [templateKey(t.id), JSON.stringify({ ...t, name: t.name.trim().slice(0, NAME_MAX), ...(opts.touch ? { updatedAt: new Date().toISOString() } : {}) })],
    },
  ]);
}

/** Copia con otro nombre («… (copia)») y su propio id. */
export function duplicateTemplate(t: CycleTemplate, now = new Date().toISOString()): CycleTemplate {
  return { ...clone(t), id: crypto.randomUUID(), name: `${t.name} (copia)`.slice(0, NAME_MAX), archived: false, createdAt: now, updatedAt: now };
}
