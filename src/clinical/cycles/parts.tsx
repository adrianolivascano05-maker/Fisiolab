// Piezas comunes de las pantallas del plan por ciclos (src/data/cycles.ts): cargar el plan de un motivo, la barra de
// fases, las casillas de los parámetros y la línea corta de cada casilla de la tabla.
import { internalPath } from "../../app/internalPath";
import { phaseSoft, phaseSolid } from "./phaseColors";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { todayDay } from "../../app/dates";
import { decimalText, parseDecimal } from "../../app/format";
import { useAsync } from "../../app/useAsync";
import { getAnamnesisOf } from "../../data/clinical";
import { loadPlan, phaseAt, weekIndexOf, PARAM_LABELS, SIDE_LABELS, totalWeeks, type Dose, type Effort, type ParamKey, type PlanDoc, type PlanExercise, type Side } from "../../data/cycles";
import { getDb } from "../../data/db";
import { currentEpisode, episodeLabel, listEpisodes } from "../../data/episodes";
import { getPatient } from "../../data/repo";
import { cx } from "../../ui/cx";

/** El motivo del que se habla (?motivo=…, o el que se está viendo) y adónde se vuelve (?volver=…). */
export function usePlanParams(patientId: string) {
  const [params] = useSearchParams();
  const motivo = params.get("motivo");
  const volver = params.get("volver");
  return { motivo, volver: internalPath(volver) ?? `/pacientes/${patientId}/sesiones` };
}

/** El paciente, el motivo (con su nombre y su anamnesis) y su plan, si lo tiene. */
export function usePlan(patientId: string, motivo: string | null) {
  return useAsync(
    async () => {
      const db = getDb();
      const episode = motivo ?? (await currentEpisode(db, patientId));
      const [patient, episodes, anamnesis, loaded] = await Promise.all([getPatient(db, patientId), listEpisodes(db, patientId), getAnamnesisOf(db, patientId, episode), loadPlan(db, patientId, episode)]);
      const ep = episodes.find((e) => e.id === episode);
      const goal = anamnesis?.answers.objetivos_largo;
      return { patient, episode, episodeName: ep ? episodeLabel(ep) : "", anamnesisGoal: typeof goal === "string" ? goal : "", loaded };
    },
    [patientId, motivo],
    { tables: ["settings", "patients", "sessions"] },
  );
}

/** Con qué palabra se anota el esfuerzo. */
export const effortLabel = (e: Effort) => (e === "rir" ? "RIR" : "RPE");
export const paramLabel = (p: ParamKey, effort: Effort, ex?: Pick<PlanExercise, "timeUnit">) =>
  p === "effort" ? effortLabel(effort) : p === "time" ? `Tiempo (${ex?.timeUnit ?? "s"})` : p === "distance" ? "Distancia (m)" : p === "rest" ? "Descanso (s)" : PARAM_LABELS[p];

/** «3×10» y «40 kg» (o el esfuerzo): lo que cabe en una casilla de la tabla. */
export function doseLines(d: Dose | undefined, effort: Effort): [string, string] {
  if (!d) return ["—", ""];
  const n = (x: number) => decimalText(x);
  const q = d.reps !== undefined ? n(d.reps) : d.time !== undefined ? `${n(d.time)}″` : d.distance !== undefined ? `${n(d.distance)} m` : "";
  const first = d.sets !== undefined && q ? `${n(d.sets)}×${q}` : q || (d.sets !== undefined ? `${n(d.sets)} series` : "—");
  const second = d.kg !== undefined && d.kg > 0 ? `${n(d.kg)} kg` : d.pct !== undefined ? `${n(d.pct)} %` : effort !== "none" && d.effort !== undefined ? `${effortLabel(effort)} ${n(d.effort)}` : "";
  return [first, second];
}

/** La barra de fases, cada una del largo de sus semanas y de su color (phaseColors.ts); lo ya pasado, relleno. */
export function PhaseBar({ plan, week, className }: { plan: PlanDoc; week: number; className?: string }) {
  const starts = plan.phases.map((_, i) => plan.phases.slice(0, i).reduce((n, x) => n + x.weeks, 0));
  return (
    <div aria-hidden="true" className={cx("flex gap-1", className)}>
      {plan.phases.map((p, i) => {
        const start = starts[i]!;
        const done = Math.max(0, Math.min(p.weeks, week + 1 - start));
        return (
          <span key={p.id} className={cx("h-2 overflow-hidden rounded-pill", phaseSoft(i))} style={{ flexGrow: p.weeks, flexBasis: 0 }}>
            <span className={cx("block h-full rounded-pill", phaseSolid(i))} style={{ width: `${(done / p.weeks) * 100}%` }} />
          </span>
        );
      })}
    </div>
  );
}

/** Dónde está hoy el plan: semana (desde 0), su fase y si ya ha acabado o aún no ha empezado. */
export function planToday(plan: PlanDoc, day = todayDay()) {
  const week = weekIndexOf(plan, day);
  return { week, at: phaseAt(plan, week), total: totalWeeks(plan) };
}

/** Una casilla numérica: deja escribir «2,5» sin saltar mientras se escribe; vacía = no se usa. */
export function NumCell({ label, value, onChange, className }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; className?: string }) {
  // Mientras se escribe, el texto tal cual; si no, el valor guardado.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = value === undefined ? "" : decimalText(value);
  const text = draft ?? shown;
  const setText = setDraft;
  const bad = text.trim() !== "" && Number.isNaN(parseDecimal(text) ?? 0);
  return (
    <label className={cx("flex min-w-0 flex-col items-center gap-0.5", className)}>
      <span className="text-xs text-text-muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        aria-invalid={bad || undefined}
        onFocus={() => setDraft(shown)}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseDecimal(e.target.value);
          if (v === null) onChange(undefined);
          else if (!Number.isNaN(v) && v >= 0) onChange(v);
        }}
        className={cx("nums h-12 w-full min-w-0 rounded-md border bg-bg px-1 text-center text-lg font-semibold", bad ? "border-danger" : "border-border-input")}
      />
    </label>
  );
}

/** Las casillas de los parámetros de un ejercicio, en fila. */
export function DoseInputs({ ex, dose, effort, onChange }: { ex: Pick<PlanExercise, "params" | "timeUnit" | "name">; dose: Dose; effort: Effort; onChange: (d: Dose) => void }) {
  const set = (p: ParamKey, v: Dose[ParamKey]) => {
    const d = { ...dose } as Record<string, unknown>;
    if (v === undefined || v === "") delete d[p];
    else d[p] = v;
    onChange(d as Dose);
  };
  return (
    <div className="grid grid-cols-4 gap-2">
      {ex.params
        .filter((p) => p !== "effort" || effort !== "none")
        .map((p) =>
          p === "tempo" ? (
            <label key={p} className="flex min-w-0 flex-col items-center gap-0.5">
              <span className="text-xs text-text-muted">Tempo</span>
              <input
                type="text"
                value={dose.tempo ?? ""}
                onChange={(e) => set("tempo", e.target.value.slice(0, 12))}
                className="h-12 w-full min-w-0 rounded-md border border-border-input bg-bg px-1 text-center text-base"
              />
            </label>
          ) : p === "side" ? (
            <label key={p} className="flex min-w-0 flex-col items-center gap-0.5">
              <span className="text-xs text-text-muted">Lado</span>
              <select value={dose.side ?? ""} onChange={(e) => set("side", (e.target.value || undefined) as Side | undefined)} className="h-12 w-full min-w-0 rounded-md border border-border-input bg-bg px-1 text-sm">
                <option value="">—</option>
                {(Object.keys(SIDE_LABELS) as Side[]).map((s) => (
                  <option key={s} value={s}>
                    {SIDE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <NumCell key={p} label={paramLabel(p, effort, ex)} value={dose[p] as number | undefined} onChange={(v) => set(p, v)} />
          ),
        )}
    </div>
  );
}

/** Un grupo de botones de los que se elige uno (las sesiones tipo, el esfuerzo, las sesiones por semana). */
export function Segmented<T extends string | number>({ label, options, value, onChange, render }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; render?: (v: T) => string }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-md bg-surface p-1">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={cx("min-h-11 flex-1 rounded-md px-2 text-sm font-semibold", o === value ? "bg-bg text-text shadow-card" : "text-text-muted hover:text-text")}
        >
          {render ? render(o) : String(o)}
        </button>
      ))}
    </div>
  );
}
