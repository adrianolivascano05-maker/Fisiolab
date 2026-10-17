import { ArrowDownUp, ChartColumn } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { fmt, fmtDate } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { compareMetrics, ranking, type CompareMode } from "../data/compare";
import { getDb } from "../data/db";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/EmptyState";
import { SelectField } from "../ui/Field";

const groups = [...new Set(compareMetrics.map((m) => m.group))];

/** S23 Comparar pacientes: ranking por una medida. */
export function ComparePage() {
  const [params, setParams] = useSearchParams();
  const metric = compareMetrics.find((m) => m.id === params.get("medida")) ?? compareMetrics[0]!;
  const mode: CompareMode = params.get("modo") === "ultima" ? "latest" : "best";
  const [reversed, setReversed] = useState(false);
  const data = useAsync(() => ranking(getDb(), metric.id, mode), [metric.id, mode]);
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next, { replace: true });
    setReversed(false);
  };
  const rows = data.data ? (reversed ? [...data.data].reverse() : data.data) : [];
  const unit = metric.unit ? ` (${metric.unit})` : "";

  return (
    <Page title="Comparar" tabs>
      <SelectField label="Medida" value={metric.id} onChange={(e) => set("medida", e.target.value)}>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {compareMetrics
              .filter((m) => m.group === g)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
          </optgroup>
        ))}
      </SelectField>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-2 text-sm font-semibold">De cada paciente</legend>
        {(
          [
            ["best", "Su mejor marca"],
            ["latest", "Su última medición"],
          ] as const
        ).map(([v, label]) => (
          <label key={v} className="relative">
            <input type="radio" name="modo" checked={mode === v} onChange={() => set("modo", v === "latest" ? "ultima" : "mejor")} className="peer sr-only" />
            <span
              className={cx(
                "tap flex items-center justify-center rounded-md border px-2 text-center text-sm font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                mode === v ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg",
              )}
            >
              {label}
            </span>
          </label>
        ))}
      </fieldset>

      {data.error ? (
        <LoadError error={data.error} />
      ) : !data.data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon={ChartColumn} title="Nadie tiene todavía esta medida">
          Elige otra medida o mide a tus pacientes.
        </EmptyState>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-text-muted">
              {rows.length} {rows.length === 1 ? "paciente" : "pacientes"} · {metric.better === "high" ? "más es mejor" : "menos es mejor"}
            </p>
            <Button size="sm" variant="secondary" icon={<ArrowDownUp aria-hidden="true" className="size-4" />} onClick={() => setReversed((r) => !r)} aria-pressed={reversed}>
              {reversed ? "Peor primero" : "Mejor primero"}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="nums w-full text-left text-sm">
              <caption className="sr-only">
                Ranking de {metric.label}
                {unit}, {mode === "best" ? "mejor marca" : "última medición"} de cada paciente
              </caption>
              <thead className="bg-surface text-text-muted">
                <tr>
                  <th scope="col" className="px-2 py-2 text-right">#</th>
                  <th scope="col" className="px-2 py-2">Paciente</th>
                  <th scope="col" className="px-2 py-2 text-right">{metric.unit || "Valor"}</th>
                  <th scope="col" className="px-2 py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.patientId} className="border-t border-border">
                    <td className="px-2 py-2 text-right text-text-muted">{r.rank}</td>
                    <th scope="row" className="px-2 py-2 font-normal">
                      <Link className="text-accent underline" to={r.testId ? `/tests/${r.testId}` : `/pacientes/${r.patientId}`}>
                        {r.name}
                      </Link>
                      {r.count > 1 && <span className="block text-xs text-text-muted">{r.count} mediciones</span>}
                    </th>
                    <td className="px-2 py-2 text-right text-base font-semibold">{fmt(r.value, metric.digits)}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-text-muted">{fmtDate(r.performedAt)}</td>
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
