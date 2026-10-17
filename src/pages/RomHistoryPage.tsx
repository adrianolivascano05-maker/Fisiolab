import { ChartLine } from "lucide-react";
import { Link, useParams } from "react-router";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getMovement, movementLabel } from "../calc/rom";
import { fmt, fmtDate, fmtDateShort } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { getPatient, romEntries } from "../data/repo";
import { EmptyState } from "../ui/EmptyState";

const sideShort = { left: "Izq.", right: "Dcho." } as const;
const methodShort = { sensor: "Móvil", photo: "Foto", manual: "Goniómetro" } as const;

/** Evolución de un movimiento de movilidad, con una línea por lado. */
export function RomHistoryPage() {
  const { id = "", mov = "" } = useParams();
  const movement = getMovement(mov);
  const data = useAsync(async () => ({ patient: await getPatient(getDb(), id), entries: await romEntries(getDb(), id, mov) }), [id, mov]);
  const back = `/pacientes/${id}/movilidad`;
  const title = movement ? movementLabel(movement) : "Movilidad";
  if (!movement) return <Page title={title} backTo={back}><LoadError error={new Error("Movimiento desconocido.")} /></Page>;
  if (data.error) return <Page title={title} backTo={back}><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title={title} backTo={back}><Loading /></Page>;
  const { patient, entries } = data.data;
  const ordered = [...entries].reverse();
  const hasWall = entries.some((e) => e.wallDistanceCm !== null);

  // Una fila por día; si ese día hay varias tomas del mismo lado, la última.
  const byDay = new Map<string, { date: string; left?: number; right?: number; value?: number }>();
  for (const e of ordered) {
    const key = fmtDate(e.performedAt);
    const row = byDay.get(key) ?? { date: key };
    row[e.side ?? "value"] = Math.round(e.angleDeg);
    byDay.set(key, row);
  }
  const chart = [...byDay.values()];
  const series = movement.sided
    ? [
        { key: "left", name: "Izquierdo", color: "var(--color-chart-left)" },
        { key: "right", name: "Derecho", color: "var(--color-chart-right)" },
      ]
    : [{ key: "value", name: "Ángulo", color: "var(--color-chart-primary)" }];

  return (
    <Page title={title} backTo={back}>
      <p className="flex flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-text-muted">{patient?.name}</span>
      </p>
      {entries.length === 0 ? (
        <EmptyState icon={ChartLine} title="Sin mediciones de este movimiento">
          <Link className="text-accent underline" to={`/pacientes/${id}/test/movilidad?mov=${movement.id}`}>
            Medir ahora
          </Link>
        </EmptyState>
      ) : (
        <>
          {chart.length > 1 ? (
            <figure className="h-64 w-full" aria-label={`Gráfica de ${title.toLowerCase()} en el tiempo, en grados`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} stroke="var(--color-border)" />
                  <YAxis domain={["auto", "auto"]} unit="°" tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} stroke="var(--color-border)" />
                  {/* El texto va siempre en color de texto; el color del lado lo lleva la marca. */}
                  <Tooltip formatter={(v) => `${fmt(Number(v), 0)}°`} itemStyle={{ color: "var(--color-text)" }} itemSorter="dataKey" />
                  {series.length > 1 && <Legend wrapperStyle={{ fontSize: 14 }} itemSorter="dataKey" formatter={(v) => <span style={{ color: "var(--color-text)" }}>{v}</span>} />}
                  {series.map((s) => (
                    <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} connectNulls dot={{ r: 4, fill: s.color, stroke: "var(--color-bg)", strokeWidth: 2 }} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </figure>
          ) : (
            <p>Hay mediciones de un solo día: hace falta otro para ver la evolución.</p>
          )}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="nums w-full text-left text-sm">
              <caption className="sr-only">Todas las mediciones de {title.toLowerCase()}</caption>
              <thead className="bg-surface text-text-muted">
                <tr>
                  <th scope="col" className="px-2 py-2">Fecha</th>
                  {movement.sided && <th scope="col" className="px-2 py-2">Lado</th>}
                  <th scope="col" className="px-2 py-2 text-right">Ángulo</th>
                  {hasWall && <th scope="col" className="whitespace-nowrap px-2 py-2 text-right">Pared (cm)</th>}
                  <th scope="col" className="px-2 py-2">Método</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.testId} className="border-t border-border">
                    <th scope="row" className="px-2 py-2 font-normal">
                      <Link className="text-accent underline" to={`/tests/${e.testId}`}>
                        {fmtDateShort(e.performedAt)}
                      </Link>
                    </th>
                    {movement.sided && <td className="px-2 py-2">{e.side ? sideShort[e.side] : "—"}</td>}
                    <td className="px-2 py-2 text-right">{fmt(e.angleDeg, 0)}°</td>
                    {hasWall && <td className="px-2 py-2 text-right">{fmt(e.wallDistanceCm)}</td>}
                    <td className="px-2 py-2">{methodShort[e.method]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Page>
  );
}
