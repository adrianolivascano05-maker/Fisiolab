import { ChartLine } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { JumpType } from "../calc/results";
import { fmt, fmtDate, jumpLabels, metricLabels } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { getPatient, history } from "../data/repo";
import { EmptyState } from "../ui/EmptyState";
import { SelectField } from "../ui/Field";

const metricsFor: Record<JumpType, string[]> = {
  cmj: ["jump_height_cm", "power_w", "relative_power_w_kg", "rsi_mod"],
  cmj_arms: ["jump_height_cm", "rsi_mod"],
  sj: ["jump_height_cm", "power_w", "relative_power_w_kg"],
  dj: ["rsi", "jump_height_cm", "contact_time_ms", "stiffness_kn_m", "dri"],
  single_leg: ["jump_height_cm"],
  rj_10_5: ["rsi", "jump_height_cm", "contact_time_ms"],
  horizontal: ["jump_distance_cm"],
};

/** S22 Evolución de un test */
export function EvolutionPage() {
  const { id = "", tipo = "cmj" } = useParams();
  const type = (tipo in jumpLabels ? tipo : "cmj") as JumpType;
  const [metric, setMetric] = useState(metricsFor[type][0]!);
  const data = useAsync(async () => {
    const db = getDb();
    return { patient: await getPatient(db, id), points: await history(db, id, type, metric) };
  }, [id, type, metric]);
  const title = `Evolución · ${jumpLabels[type].short}`;
  const back = `/pacientes/${id}`;

  if (data.error) return <Page title={title} backTo={back}><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title={title} backTo={back}><Loading /></Page>;
  const { patient, points } = data.data;
  const m = metricLabels[metric] ?? { label: metric, digits: 1 };
  const best = points.length ? points.reduce((a, b) => ((metric === "contact_time_ms" ? b.value < a.value : b.value > a.value) ? b : a)) : null;
  const chart = points.map((p) => ({ date: fmtDate(p.performedAt), value: Number(p.value.toFixed(m.digits)) }));

  return (
    <Page title={title} backTo={back}>
      <p className="text-text-muted">{patient?.name}</p>
      <SelectField label="Medida" value={metric} onChange={(e) => setMetric(e.target.value)}>
        {metricsFor[type].map((k) => (
          <option key={k} value={k}>
            {metricLabels[k]?.label ?? k}
          </option>
        ))}
      </SelectField>

      {points.length === 0 ? (
        <EmptyState icon={ChartLine} title="Sin datos de esta medida">
          {metric === "power_w" || metric === "relative_power_w_kg"
            ? "La potencia necesita la masa y la distancia de empuje del paciente."
            : "Mide un salto para empezar la gráfica."}
        </EmptyState>
      ) : (
        <>
          <p className="text-base">
            {points.length === 1
              ? "Hay una sola medición: hace falta otra para ver la evolución."
              : `Mejor: ${fmt(best!.value, m.digits)} el ${fmtDate(best!.performedAt)} · última: ${fmt(points.at(-1)!.value, m.digits)}`}
          </p>
          <figure className="h-64 w-full" aria-label={`Gráfica de ${m.label.toLowerCase()} en el tiempo`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} stroke="var(--color-border)" />
                <YAxis domain={["auto", "auto"]} tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} stroke="var(--color-border)" />
                <Tooltip formatter={(v) => fmt(Number(v), m.digits)} />
                <Line type="monotone" dataKey="value" name={m.label} stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </figure>
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer font-semibold">Ver los datos en tabla</summary>
            <table className="nums mt-2 w-full text-left">
              <thead>
                <tr className="text-sm text-text-muted">
                  <th scope="col" className="py-1">Fecha</th>
                  <th scope="col" className="py-1 text-right">{m.label}</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.testId} className="border-t border-border">
                    <td className="py-2">
                      <Link className="text-accent underline" to={`/tests/${p.testId}`}>
                        {fmtDate(p.performedAt)}
                      </Link>
                    </td>
                    <td className="py-2 text-right">{fmt(p.value, m.digits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </Page>
  );
}
