// Evolución de un ejercicio a lo largo del plan por ciclos (docs/ciclos.md, fase C): semana a semana, lo previsto en
// las casillas del plan y lo hecho en las sesiones (lo marcado «Hecho» cuenta como lo previsto de ese día; «Cambiado»,
// con lo real). Solo se ordenan los números que ya están: la app no dice si van bien o mal.
//
// El ejercicio se reconoce por su nombre (sin mayúsculas ni tildes) en todas las fases, porque cada fase tiene sus
// propias copias de los ejercicios.
import { dayOf } from "../app/dates";
import { fold } from "../app/format";
import { phaseAt, totalWeeks, weekIndexOf, type DoneDoc, type Dose, type Effort, type LoadedPlan, type PlanExercise } from "./cycles";
import type { Db } from "./db";

/** Qué número se sigue: los kilos si alguna semana los tiene; si no, las repeticiones, el tiempo o la distancia. */
export type Metric = "kg" | "reps" | "time" | "distance";
export const METRIC_LABEL: Record<Metric, string> = { kg: "Kilos", reps: "Repeticiones", time: "Tiempo", distance: "Distancia (m)" };

export type EvolutionWeek = {
  /** La semana del plan, desde 0. */
  week: number;
  /** En qué fase cae (posición). */
  phase: number;
  planned: number | null;
  done: number | null;
  plannedEffort: number | null;
  doneEffort: number | null;
  /** Cuántas sesiones de esa semana lo tienen marcado. */
  sessions: number;
};
export type Evolution = { name: string; metric: Metric; unit: string; effort: Effort; weeks: EvolutionWeek[] };

const key = (name: string) => fold(name.trim()).replace(/\s+/g, " ");

/** Los ejercicios del plan, una vez cada uno (por nombre), en el orden en que salen. */
export function planExerciseNames(loaded: LoadedPlan): string[] {
  const seen = new Map<string, string>();
  for (const ref of loaded.plan.phases)
    for (const s of loaded.phases[ref.id]?.sessions ?? []) for (const e of s.exercises) if (e.name.trim() && !seen.has(key(e.name))) seen.set(key(e.name), e.name.trim());
  return [...seen.values()];
}

/** El valor de una casilla para el número que se sigue (los kilos solo si son más de 0). */
export function valueOf(d: Dose | undefined, metric: Metric): number | null {
  if (!d) return null;
  const v = metric === "kg" ? (d.kg && d.kg > 0 ? d.kg : undefined) : d[metric];
  return typeof v === "number" ? v : null;
}

/** Lo hecho en una sesión, con su día. */
export type DoneOnDay = { day: string; doc: DoneDoc };

export function evolution(loaded: LoadedPlan, name: string, done: DoneOnDay[]): Evolution | null {
  const { plan, phases } = loaded;
  const k = key(name);
  /** Las casillas previstas de esa semana para el ejercicio (de la primera sesión tipo que lo tiene). */
  const cellAt = (week: number): { dose: Dose | undefined; ex: PlanExercise } | null => {
    const at = phaseAt(plan, week);
    if (!at) return null;
    const doc = phases[plan.phases[at.index]!.id];
    for (const s of doc?.sessions ?? []) {
      const ex = s.exercises.find((e) => key(e.name) === k);
      if (ex) return { dose: doc!.weeks[at.week]?.[s.id]?.[ex.id], ex };
    }
    return null;
  };
  const total = totalWeeks(plan);
  const cells = Array.from({ length: total }, (_, w) => cellAt(w));
  if (!cells.some(Boolean)) return null;

  // Lo hecho: de cada sesión, el valor real (o el previsto de esa casilla si se marcó «Hecho»).
  const doneByWeek = new Map<number, Dose[]>();
  const anyDose: Dose[] = cells.flatMap((c) => (c?.dose ? [c.dose] : []));
  for (const { day, doc } of done) {
    const w = weekIndexOf(plan, day);
    if (w < 0 || w >= total) continue;
    const phaseDoc = phases[doc.phaseId];
    const tpl = phaseDoc?.sessions.find((s) => s.id === doc.sessionTplId);
    const ex = tpl?.exercises.find((e) => key(e.name) === k);
    const item = ex ? doc.items.find((i) => i.exId === ex.id) : undefined;
    const extra = doc.extra.find((x) => key(x.name) === k);
    if (!item && !extra) continue;
    const dose: Dose = (item ? (item.state === "changed" && item.real ? item.real : phaseDoc!.weeks[doc.week]?.[tpl!.id]?.[ex!.id]) : extra?.dose) ?? {};
    anyDose.push(dose);
    doneByWeek.set(w, [...(doneByWeek.get(w) ?? []), dose]);
  }
  const metric: Metric = anyDose.some((d) => d.kg && d.kg > 0) ? "kg" : anyDose.some((d) => d.reps !== undefined) ? "reps" : anyDose.some((d) => d.time !== undefined) ? "time" : "distance";
  const timeUnit = cells.find(Boolean)?.ex.timeUnit ?? "s";
  const round = (n: number) => Math.round(n * 10) / 10;
  const weeks: EvolutionWeek[] = cells.map((c, w) => {
    const doses = doneByWeek.get(w) ?? [];
    const values = doses.map((d) => valueOf(d, metric)).filter((v): v is number => v !== null);
    const efforts = doses.map((d) => d.effort).filter((v): v is number => typeof v === "number");
    return {
      week: w,
      phase: phaseAt(plan, w)!.index,
      planned: valueOf(c?.dose, metric),
      // Con varias sesiones esa semana: el mayor de lo hecho (y el esfuerzo, la media).
      done: values.length ? Math.max(...values) : null,
      plannedEffort: plan.effort !== "none" && typeof c?.dose?.effort === "number" ? c.dose.effort : null,
      doneEffort: plan.effort !== "none" && efforts.length ? round(efforts.reduce((a, b) => a + b, 0) / efforts.length) : null,
      sessions: doses.length,
    };
  });
  const unit = metric === "kg" ? "kg" : metric === "reps" ? "reps" : metric === "time" ? timeUnit : "m";
  return { name: cells.find(Boolean)!.ex.name, metric, unit, effort: plan.effort, weeks };
}

/** Lo hecho en las sesiones de ese motivo, con el día de Madrid de cada una. */
export async function loadDoneOfEpisode(db: Db, patientId: string, episodeId: string): Promise<DoneOnDay[]> {
  const rows = await db.query<{ performed_at: string; value: string }>(
    `select s.performed_at, st.value from sessions s join settings st on st.key = 'ciclos_hecho:' || s.patient_id || ':' || s.id
     where s.patient_id = ? and coalesce(s.episode_id, s.patient_id) = ? order by s.performed_at`,
    [patientId, episodeId],
  );
  return rows.flatMap((r) => {
    const d = JSON.parse(r.value) as DoneDoc;
    return d && d.v === 1 && Array.isArray(d.items) ? [{ day: dayOf(r.performed_at), doc: { ...d, extra: Array.isArray(d.extra) ? d.extra : [] } }] : [];
  });
}
