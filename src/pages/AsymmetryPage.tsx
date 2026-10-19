import { Scale } from "lucide-react";
import { Link, useParams } from "react-router";
import { asymmetry } from "../calc/asymmetry";
import { fmt, fmtDate, sideLabels } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { getPatient, singleLegJumps, type SideJump } from "../data/repo";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";

type Session = { day: string; left: SideJump | null; right: SideJump | null };

/** Agrupa por día y se queda con el mejor salto de cada pierna. */
function sessions(jumps: SideJump[]): Session[] {
  const byDay = new Map<string, Session>();
  for (const j of jumps) {
    const day = new Date(j.performedAt).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    const s = byDay.get(day) ?? { day, left: null, right: null };
    const current = s[j.side];
    if (!current || j.heightCm > current.heightCm) s[j.side] = j;
    byDay.set(day, s);
  }
  return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day));
}

/** S10 Asimetría entre piernas */
export function AsymmetryPage() {
  const { id = "" } = useParams();
  const data = useAsync(async () => ({ patient: await getPatient(getDb(), id), jumps: await singleLegJumps(getDb(), id) }), [id]);
  const title = "Asimetría";
  const back = `/pacientes/${id}/mediciones`;
  if (data.error) return <Page title={title} backTo={back}><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title={title} backTo={back}><Loading /></Page>;
  const all = sessions(data.data.jumps);
  const complete = all.filter((s) => s.left && s.right);
  const latest = complete[0];

  return (
    <Page title={title} backTo={back}>
      <p className="text-text-muted">{data.data.patient?.name}</p>
      {!latest ? (
        <EmptyState icon={Scale} title="Falta medir las dos piernas el mismo día">
          Mide un CMJ a una pierna con la izquierda y otro con la derecha.{" "}
          <Link className="text-accent underline" to={`/pacientes/${id}/test/saltos`}>
            Medir ahora
          </Link>
        </EmptyState>
      ) : (
        <>
          <LatestSession s={latest} />
          {complete.length > 1 && <History sessions={complete} />}
        </>
      )}
      {all.some((s) => !s.left || !s.right) && (
        <p className="text-sm text-text-muted">Los días con una sola pierna medida no se cuentan.</p>
      )}
    </Page>
  );
}

function LatestSession({ s }: { s: Session }) {
  const left = s.left!.heightCm;
  const right = s.right!.heightCm;
  const a = asymmetry(left, right);
  const max = Math.max(left, right);
  const bars = [
    { side: "left" as const, value: left, color: "bg-chart-left", letter: "I" },
    { side: "right" as const, value: right, color: "bg-chart-right", letter: "D" },
  ];
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-text-muted">Asimetría · {fmtDate(s.day)}</p>
        <p className="nums text-display">{fmt(a.pct, 1)} %</p>
        <p className="text-sm">
          {a.weaker === "equal" ? "Las dos piernas saltan igual." : `Rinde menos la pierna ${sideLabels[a.weaker]}.`}
        </p>
      </div>
      <ul aria-label="Altura de cada pierna" className="flex flex-col gap-3">
        {bars.map((b) => (
          <li key={b.side} className="flex flex-col gap-1">
            <span className="flex justify-between text-sm">
              <span className="font-semibold">Pierna {sideLabels[b.side]}</span>
              <span className="nums">{fmt(b.value)} cm</span>
            </span>
            <span aria-hidden="true" className="h-3 w-full rounded-pill bg-surface">
              <span className={`block h-3 rounded-pill ${b.color}`} style={{ width: `${(b.value / max) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted">(mejor − peor) / mejor × 100, con el mejor salto de cada pierna del día.</p>
    </Card>
  );
}

function History({ sessions: list }: { sessions: Session[] }) {
  return (
    <section aria-labelledby="h-historial" className="flex flex-col gap-2">
      <h2 id="h-historial" className="text-lg">Historial</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="nums w-full text-left text-sm">
          <thead className="bg-surface text-text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Fecha</th>
              <th scope="col" className="px-3 py-2 text-right">Izq. (cm)</th>
              <th scope="col" className="px-3 py-2 text-right">Dcha. (cm)</th>
              <th scope="col" className="px-3 py-2 text-right">Asimetría</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const a = asymmetry(s.left!.heightCm, s.right!.heightCm);
              return (
                <tr key={s.day} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 font-normal">{fmtDate(s.day)}</th>
                  <td className="px-3 py-2 text-right">{fmt(s.left!.heightCm)}</td>
                  <td className="px-3 py-2 text-right">{fmt(s.right!.heightCm)}</td>
                  <td className="px-3 py-2 text-right">
                    {fmt(a.pct, 1)} %{a.weaker !== "equal" && ` (${a.weaker === "left" ? "izq." : "dcha."})`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
