// Ajustes → La clínica en números (src/data/stats.ts): lo esencial de un periodo para ver cómo va la consulta. Sesiones,
// pacientes, ausencias (las que cuestan dinero) y altas; en un equipo, cada profesional. Y las sesiones de cada mes.
import { useMemo, useState } from "react";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { useCloud } from "../cloud/CloudGate";
import { getDb } from "../data/db";
import { clinicStats, type ClinicStats } from "../data/stats";
import { staffName, useStaff } from "../schedule/useStaff";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";

type PeriodId = "month" | "last" | "quarter" | "year";
const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "month", label: "Este mes" },
  { id: "last", label: "Mes pasado" },
  { id: "quarter", label: "Últimos 3 meses" },
  { id: "year", label: "Este año" },
];

function range(id: PeriodId, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const [from, to] =
    id === "month" ? [new Date(y, m, 1), new Date(y, m + 1, 1)] : id === "last" ? [new Date(y, m - 1, 1), new Date(y, m, 1)] : id === "quarter" ? [new Date(y, m - 2, 1), new Date(y, m + 1, 1)] : [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
  return { from: from.toISOString(), to: to.toISOString() };
}

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);
const monthShort = (ym: string) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("es-ES", { month: "short" }).replace(".", "");

export function StatsPage() {
  const cloud = useCloud();
  const staff = useStaff();
  const [period, setPeriod] = useState<PeriodId>("month");
  const r = useMemo(() => range(period), [period]);
  const data = useAsync(() => clinicStats(getDb(), r), [r.from, r.to]);
  const s = data.data;

  return (
    <Page title="La clínica en números" backTo="/ajustes">
      <div role="group" aria-label="Periodo" className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={period === p.id}
            className={cx("tap rounded-full border px-3 text-sm", period === p.id ? "border-accent bg-accent font-semibold text-on-accent" : "border-border bg-bg hover:bg-surface")}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {s && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Tile label="Sesiones" value={String(s.sessions)} />
            <Tile label="Pacientes atendidos" value={String(s.patientsSeen)} />
            <Tile label="Pacientes nuevos" value={String(s.newPatients)} />
            <Tile label="Ausencias" value={pct(s.noShowRate)} detail={`${s.appointments.noShow} de ${s.appointments.done + s.appointments.noShow} citas`} warn={(s.noShowRate ?? 0) >= 0.1} />
            <Tile label="Citas anuladas" value={String(s.appointments.cancelled)} />
            <Tile label="Altas" value={String(s.discharges)} detail="Motivos de consulta terminados" />
          </dl>
          {s.appointments.scheduled > 0 && (
            <p className="text-sm text-text-muted">
              Quedan {s.appointments.scheduled === 1 ? "1 cita pendiente" : `${s.appointments.scheduled} citas pendientes`} en este periodo.
            </p>
          )}

          <MonthlyChart monthly={s.monthly} />

          {cloud?.clinic && s.byPerson.length > 0 && (
            <section aria-labelledby="h-equipo" className="flex flex-col gap-2">
              <h2 id="h-equipo" className="text-lg">
                Por profesional
              </h2>
              <div role="region" aria-label="Citas por profesional" tabIndex={0} className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="bg-surface">
                    <tr>
                      <th className="p-2">Profesional</th>
                      <th className="p-2 text-right">Atendidas</th>
                      <th className="p-2 text-right">No vino</th>
                      <th className="p-2 text-right">Anuladas</th>
                      <th className="p-2 text-right">Ausencias</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {s.byPerson.map((p) => (
                      <tr key={p.email ?? "-"} className="border-t border-border">
                        <td className="p-2 font-semibold">{staffName(staff, p.email)}</td>
                        <td className="p-2 text-right">{p.done}</td>
                        <td className="p-2 text-right">{p.noShow}</td>
                        <td className="p-2 text-right">{p.cancelled}</td>
                        <td className="p-2 text-right">{pct(p.done + p.noShow ? p.noShow / (p.done + p.noShow) : null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <p className="text-sm text-text-muted">
            Las ausencias cuentan las citas marcadas «No vino» sobre las que ya tocaban. Para bajarlas, recuerda las citas el día antes (Agenda → Recordatorios).
          </p>
        </>
      )}
    </Page>
  );
}

function Tile({ label, value, detail, warn }: { label: string; value: string; detail?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-bg p-3">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className={cx("text-2xl font-semibold tabular-nums", warn && "text-warning")}>{value}</dd>
      {detail && <dd className="text-xs text-text-muted">{detail}</dd>}
    </div>
  );
}

/** Sesiones de cada mes, los últimos 12: barras finas, la del mes actual rotulada. */
function MonthlyChart({ monthly }: { monthly: ClinicStats["monthly"] }) {
  const max = Math.max(1, ...monthly.map((m) => m.sessions));
  const W = 600;
  const H = 180;
  const top = 24;
  const bottom = 26;
  const step = W / monthly.length;
  const bar = Math.min(28, step - 8);
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  const last = monthly.at(-1)!;
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="font-semibold">Sesiones por mes</h2>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Sesiones por mes en el último año; este mes, ${last.sessions}`} className="h-auto w-full">
        <line x1={0} x2={W} y1={H - bottom} y2={H - bottom} className="stroke-border" strokeWidth={1} />
        {monthly.map((m, i) => {
          const x = i * step + (step - bar) / 2;
          const h = H - bottom - y(m.sessions);
          return (
            <g key={m.month}>
              <title>{`${monthShort(m.month)}: ${m.sessions} sesiones`}</title>
              {m.sessions > 0 && <rect x={x} y={y(m.sessions)} width={bar} height={Math.max(2, h)} rx={4} className={i === monthly.length - 1 ? "fill-accent" : "fill-accent/40"} />}
              <text x={x + bar / 2} y={H - 8} textAnchor="middle" className="fill-text-muted text-[11px]">
                {monthShort(m.month)}
              </text>
              {i === monthly.length - 1 && (
                <text x={x + bar / 2} y={y(m.sessions) - 6} textAnchor="middle" className="fill-text text-[12px] font-semibold">
                  {m.sessions}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <details>
        <summary className="cursor-pointer text-sm text-text-muted">Ver como tabla</summary>
        <table className="mt-2 w-full text-sm tabular-nums">
          <tbody>
            {monthly.map((m) => (
              <tr key={m.month} className="border-t border-border">
                <td className="p-1">{m.month}</td>
                <td className="p-1 text-right">{m.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}
