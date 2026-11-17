// «Evolución por ejercicio» (src/data/cycleEvolution.ts): semana a semana, lo previsto en el plan y lo hecho en las
// sesiones, con las fases como bandas de su color. Dos gráficas, cada una con su eje (el número del ejercicio y, si se
// anota, el esfuerzo), y la tabla con los mismos números. Sin colores por valores ni nada que diga si va bien o mal.
import { useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { decimalText } from "../../app/format";
import { LoadError, Loading, Page } from "../../app/Page";
import { useAsync } from "../../app/useAsync";
import { evolution, loadDoneOfEpisode, METRIC_LABEL, planExerciseNames, type Evolution } from "../../data/cycleEvolution";
import { getDb } from "../../data/db";
import { cx } from "../../ui/cx";
import { SelectField } from "../../ui/Field";
import { Guard } from "../pageKit";
import { effortLabel, usePlan, usePlanParams } from "./parts";
import { phaseChip, phaseFill } from "./phaseColors";

export function EvolutionPage() {
  const { id = "" } = useParams();
  const { motivo, volver } = usePlanParams(id);
  const data = usePlan(id, motivo);
  if (!data.data) return <Guard state={data} title="Evolución" back={volver} />;
  if (!data.data.loaded) return <Navigate replace to={`/pacientes/${id}/ciclos?motivo=${encodeURIComponent(data.data.episode)}&volver=${encodeURIComponent(volver)}`} />;
  return <EvolutionView patientId={id} data={data.data} volver={volver} />;
}

function EvolutionView({ patientId, data, volver }: { patientId: string; data: NonNullable<ReturnType<typeof usePlan>["data"]>; volver: string }) {
  const [params, setParams] = useSearchParams();
  const loaded = data.loaded!;
  const names = planExerciseNames(loaded);
  const [name, setName] = useState(() => names.find((n) => n === params.get("ej")) ?? names[0] ?? "");
  const done = useAsync(() => loadDoneOfEpisode(getDb(), patientId, data.episode), [patientId, data.episode], { tables: ["settings", "sessions"] });
  const q = `motivo=${encodeURIComponent(data.episode)}&volver=${encodeURIComponent(volver)}`;
  const back = `/pacientes/${patientId}/ciclos?${q}`;
  const title = "Evolución por ejercicio";
  if (done.error) return <Page title={title} backTo={back} backLabel="Plan" tabs={false}><LoadError error={done.error} /></Page>;
  if (!done.data) return <Page title={title} backTo={back} backLabel="Plan" tabs={false}><Loading /></Page>;
  const evo = name ? evolution(loaded, name, done.data) : null;
  const plan = loaded.plan;
  return (
    <Page title={title} backTo={back} backLabel="Plan" tabs={false}>
      <p className="-mt-2 text-sm text-text-muted">
        {data.patient?.name}
        {data.episodeName ? ` · ${data.episodeName}` : ""}
      </p>
      {!names.length ? (
        <p className="text-text-muted">El plan aún no tiene ejercicios.</p>
      ) : (
        <>
          <SelectField
            label="Ejercicio"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              const p = new URLSearchParams(params);
              p.set("ej", e.target.value);
              setParams(p, { replace: true });
            }}
          >
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </SelectField>
          {evo && (
            <>
              <div className="flex flex-wrap gap-1.5" aria-label="Fases" role="list">
                {plan.phases.map((p, i) => (
                  <span role="listitem" key={p.id} className={cx("rounded-pill px-2 py-0.5 text-xs font-semibold", phaseChip(i))}>
                    {i + 1} · {p.name}
                  </span>
                ))}
              </div>
              <Chart evo={evo} pick={(w) => [w.planned, w.done]} title={`${METRIC_LABEL[evo.metric]} (${evo.unit})`} />
              {evo.effort !== "none" && evo.weeks.some((w) => w.plannedEffort !== null || w.doneEffort !== null) && (
                <Chart evo={evo} pick={(w) => [w.plannedEffort, w.doneEffort]} title={`Esfuerzo (${effortLabel(evo.effort)})`} />
              )}
              <p className="text-sm text-text-muted">
                Hecho: lo marcado en las sesiones de esa semana (con varias, el mayor; el esfuerzo, la media). «Hecho» sin cambios cuenta como lo previsto.
              </p>
              <Table evo={evo} />
            </>
          )}
        </>
      )}
    </Page>
  );
}

const W = 340;
const H = 170;
const PAD = { l: 34, r: 8, t: 10, b: 22 };

/** Una gráfica: las semanas abajo, las fases como bandas, lo previsto (discontinuo) y lo hecho (continuo, con puntos). */
function Chart({ evo, pick, title }: { evo: Evolution; pick: (w: Evolution["weeks"][number]) => [number | null, number | null]; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = evo.weeks.length;
  const values = evo.weeks.flatMap((w) => pick(w)).filter((v): v is number => v !== null);
  if (!values.length) return null;
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  // Un eje con números redondos: 0, la mitad y el de arriba (de 1, 2, 2,5 o 5 por potencias de 10).
  const raw = (max - min || 1) / 2;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow;
  const top = min + step * Math.max(1, Math.ceil((max - min) / step));
  const x = (i: number) => PAD.l + ((W - PAD.l - PAD.r) * (i + 0.5)) / n;
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - (v - min) / (top - min));
  const col = (W - PAD.l - PAD.r) / n;
  const path = (k: 0 | 1) => {
    let d = "";
    let pen = false;
    evo.weeks.forEach((w, i) => {
      const v = pick(w)[k];
      if (v === null) return void (pen = k === 0 ? false : pen);
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const ticks = Array.from({ length: Math.round((top - min) / step) + 1 }, (_, i) => Math.round((min + i * step) * 100) / 100);
  // Las bandas: una por tramo seguido de la misma fase.
  const bands: { phase: number; from: number; to: number }[] = [];
  evo.weeks.forEach((w, i) => {
    const last = bands.at(-1);
    if (last && last.phase === w.phase) last.to = i;
    else bands.push({ phase: w.phase, from: i, to: i });
  });
  const hw = hover !== null ? evo.weeks[hover] : null;
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
        {title}
        <span className="flex items-center gap-3 text-xs font-normal text-text-muted">
          <span className="flex items-center gap-1">
            <svg aria-hidden="true" width="18" height="6">
              <line x1="0" y1="3" x2="18" y2="3" className="stroke-text-muted" strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            Previsto
          </span>
          <span className="flex items-center gap-1">
            <svg aria-hidden="true" width="18" height="8">
              <line x1="0" y1="4" x2="18" y2="4" className="stroke-accent" strokeWidth="2" />
              <circle cx="9" cy="4" r="3" className="fill-accent" />
            </svg>
            Hecho
          </span>
        </span>
      </figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}: gráfica semana a semana. Los números están en la tabla de abajo.`}>
          {bands.map((b, i) => (
            <rect key={i} x={PAD.l + b.from * col} y={PAD.t} width={(b.to - b.from + 1) * col} height={H - PAD.t - PAD.b} className={phaseFill(b.phase)} />
          ))}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="1" />
              <text x={PAD.l - 4} y={y(t) + 3} textAnchor="end" className="fill-text-muted text-[10px]">
                {decimalText(t)}
              </text>
            </g>
          ))}
          {evo.weeks.map((w, i) =>
            n <= 12 || i % 2 === 0 ? (
              <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-text-muted text-[10px]">
                {w.week + 1}
              </text>
            ) : null,
          )}
          <path d={path(0)} fill="none" className="stroke-text-muted" strokeWidth="2" strokeDasharray="4 3" />
          <path d={path(1)} fill="none" className="stroke-accent" strokeWidth="2" strokeLinejoin="round" />
          {evo.weeks.map((w, i) => {
            const v = pick(w)[1];
            return v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r="4" className="fill-accent stroke-bg" strokeWidth="2" />;
          })}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="stroke-text" strokeWidth="1" />}
          {/* Zonas para pasar el dedo o el ratón: una por semana, más anchas que los puntos. */}
          {evo.weeks.map((_, i) => (
            <rect key={i} x={PAD.l + i * col} y={0} width={col} height={H} fill="transparent" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} onPointerLeave={() => setHover(null)} />
          ))}
        </svg>
        {hw && (
          <p aria-hidden="true" className="pointer-events-none absolute top-0 right-0 rounded-md border border-border bg-bg px-2 py-1 text-xs shadow">
            Semana {hw.week + 1}: previsto {fmt(pick(hw)[0])} · hecho {fmt(pick(hw)[1])}
          </p>
        )}
      </div>
      <p className="text-xs text-text-muted">Semanas del plan</p>
    </figure>
  );
}

const fmt = (v: number | null) => (v === null ? "—" : decimalText(v));

function Table({ evo }: { evo: Evolution }) {
  const effort = evo.effort !== "none";
  // Solo las semanas con algo previsto o hecho.
  const rows = evo.weeks.filter((w) => w.planned !== null || w.done !== null || w.plannedEffort !== null || w.doneEffort !== null);
  return (
    <div className="overflow-x-auto">
      {rows.length < evo.weeks.length && <p className="pb-1 text-xs text-text-muted">Las semanas sin nada previsto ni hecho no salen en la tabla.</p>}
      <table className="w-full text-sm">
        <caption className="sr-only">{`${evo.name}, semana a semana`}</caption>
        <thead>
          <tr className="text-left text-xs text-text-muted">
            <th scope="col" className="py-1 pr-2">Semana</th>
            <th scope="col" className="py-1 pr-2">Previsto ({evo.unit})</th>
            <th scope="col" className="py-1 pr-2">Hecho ({evo.unit})</th>
            {effort && <th scope="col" className="py-1 pr-2">{effortLabel(evo.effort)} previsto</th>}
            {effort && <th scope="col" className="py-1">{effortLabel(evo.effort)} hecho</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.week} className="border-t border-border">
              <th scope="row" className="py-1 pr-2 text-left font-normal">
                <span className={cx("rounded-pill px-1.5 text-xs font-semibold", phaseChip(w.phase))}>{w.phase + 1}</span> {w.week + 1}
              </th>
              <td className="nums py-1 pr-2">{fmt(w.planned)}</td>
              <td className="nums py-1 pr-2">
                {fmt(w.done)}
                {w.sessions > 1 ? <span className="text-xs text-text-muted"> ({w.sessions} ses.)</span> : null}
              </td>
              {effort && <td className="nums py-1 pr-2">{fmt(w.plannedEffort)}</td>}
              {effort && <td className="nums py-1">{fmt(w.doneEffort)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
