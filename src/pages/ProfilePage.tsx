import { Gauge, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { fvProfile, type FvProfile } from "../calc/profile";
import { fmt, fmtDate, jumpLabels } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { deleteFvProfile, fvCandidates, getPatient, listFvProfiles, saveFvProfile, type FvCandidate } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button, IconButton } from "../ui/Button";
import { Card, MetricCard } from "../ui/Card";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/EmptyState";
import { useToast } from "../ui/Toast";

const orientationText = {
  force_deficit: "Pendiente más orientada a la velocidad que la óptima del modelo (Samozino).",
  velocity_deficit: "Pendiente más orientada a la fuerza que la óptima del modelo (Samozino).",
  balanced: "A menos del 10 % de la pendiente óptima del modelo.",
} as const;

/** S09 Perfil fuerza-velocidad */
export function ProfilePage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const [type, setType] = useState<"cmj" | "sj">("sj");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const data = useAsync(async () => {
    const db = getDb();
    return { patient: await getPatient(db, id), candidates: await fvCandidates(db, id), saved: await listFvProfiles(db, id) };
  }, [id]);

  const candidates = useMemo(() => data.data?.candidates.filter((c) => c.type === type) ?? [], [data.data, type]);
  const selected = candidates.filter((c) => chosen.has(c.testId));
  const pushOffM = data.data?.patient?.pushOffDistanceCm ? data.data.patient.pushOffDistanceCm / 100 : null;
  const loads = new Set(selected.map((c) => c.extraLoadKg));
  let profile: FvProfile | null = null;
  let profileError: string | null = null;
  if (selected.length >= 2) {
    if (loads.size < 2) profileError = "Elige saltos con al menos dos cargas distintas.";
    else {
      try {
        profile = fvProfile(selected.map((c) => ({ velocity: c.velocity, force: c.force })), pushOffM);
      } catch (e) {
        profileError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  const title = "Perfil fuerza-velocidad";
  const back = `/pacientes/${id}/mediciones`;
  if (data.error) return <Page title={title} backTo={back}><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title={title} backTo={back}><Loading /></Page>;
  const { patient, saved } = data.data;

  async function save() {
    setSaving(true);
    try {
      await saveFvProfile(getDb(), id, type, selected);
      toast("Perfil guardado", "success");
      setChosen(new Set());
      data.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title={title} backTo={back}>
      <p className="text-text-muted">{patient?.name}</p>
      {!patient?.bodyMassKg || !patient.pushOffDistanceCm ? (
        <Alert tone="info" title="Faltan datos del paciente">
          El perfil necesita el peso y la distancia de empuje.{" "}
          <Link className="underline" to={`/pacientes/${id}/editar`}>
            Añádelos
          </Link>{" "}
          y vuelve a calcular los saltos.
        </Alert>
      ) : null}

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-2 text-sm font-semibold">Saltos para el perfil</legend>
        {(["sj", "cmj"] as const).map((t) => (
          <label key={t} className="relative">
            <input
              type="radio"
              name="tipo"
              checked={type === t}
              onChange={() => {
                setType(t);
                setChosen(new Set());
              }}
              className="peer sr-only"
            />
            <span
              className={cx(
                "tap flex items-center justify-center rounded-md border font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                type === t ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg",
              )}
            >
              {jumpLabels[t].short}
            </span>
          </label>
        ))}
      </fieldset>

      {candidates.length === 0 ? (
        <EmptyState icon={Gauge} title={`Sin ${jumpLabels[type].short} con fuerza calculada`}>
          Mide {jumpLabels[type].short} con 2 o más cargas distintas (por ejemplo 0, 20 y 40 kg). Hacen falta el peso y la distancia de empuje del
          paciente.
        </EmptyState>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Elige los saltos (uno por carga, el mejor)</legend>
          {candidates.map((c) => (
            <CandidateRow
              key={c.testId}
              c={c}
              checked={chosen.has(c.testId)}
              onToggle={() =>
                setChosen((s) => {
                  const n = new Set(s);
                  if (n.has(c.testId)) n.delete(c.testId);
                  else n.add(c.testId);
                  return n;
                })
              }
            />
          ))}
        </fieldset>
      )}

      {profileError && <Alert tone="warning" title="No se puede calcular el perfil">{profileError}</Alert>}
      {profile && (
        <>
          <ProfileView profile={profile} points={selected} />
          <Button size="lg" block loading={saving} onClick={save}>
            Guardar perfil
          </Button>
        </>
      )}

      {saved.length > 0 && (
        <section aria-labelledby="h-guardados" className="flex flex-col gap-2">
          <h2 id="h-guardados" className="text-lg">Perfiles guardados</h2>
          <ul className="flex flex-col gap-2">
            {saved.map((p) => (
              <li key={p.id}>
                <Card className="flex items-center gap-3">
                  <div className="nums flex-1 text-sm">
                    <p className="font-semibold">
                      {jumpLabels[p.type].short} · {fmtDate(p.performedAt)}
                    </p>
                    <p className="text-text-muted">
                      F0 {fmt(p.f0, 1)} N/kg · V0 {fmt(p.v0, 2)} m/s · Pmáx {fmt(p.pmax, 1)} W/kg
                      {p.ratioPct !== null && ` · ${fmt(p.ratioPct, 0)} % del óptimo`}
                    </p>
                  </div>
                  <IconButton
                    label={`Borrar el perfil del ${fmtDate(p.performedAt)}`}
                    onClick={async () => {
                      await deleteFvProfile(getDb(), p.id);
                      toast("Perfil borrado", "success");
                      data.reload();
                    }}
                  >
                    <Trash aria-hidden="true" className="size-5 text-danger" />
                  </IconButton>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}

function CandidateRow({ c, checked, onToggle }: { c: FvCandidate; checked: boolean; onToggle: () => void }) {
  return (
    <label className={cx("flex min-h-14 items-center gap-3 rounded-lg border p-3", checked ? "border-accent bg-accent-soft" : "border-border bg-bg")}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="size-5 accent-[var(--color-accent)]" />
      <span className="nums flex-1 text-sm">
        <span className="font-semibold">{fmt(c.extraLoadKg, 0)} kg</span> · {fmtDate(c.performedAt)}
        <span className="block text-text-muted">
          {fmt(c.heightCm)} cm · {fmt(c.force, 1)} N/kg · {fmt(c.velocity, 2)} m/s
        </span>
      </span>
    </label>
  );
}

function ProfileView({ profile: p, points }: { profile: FvProfile; points: FvCandidate[] }) {
  const optF0 = p.optimalSlope ? Math.sqrt(-4 * p.optimalSlope * p.pmax) : null;
  const optV0 = optF0 && p.optimalSlope ? -optF0 / p.optimalSlope : null;
  const actual = [
    { v: 0, f: p.f0 },
    { v: p.v0, f: 0 },
  ];
  const optimal = optF0 && optV0 ? [{ v: 0, f: optF0 }, { v: optV0, f: 0 }] : [];
  const scatter = points.map((c) => ({ v: c.velocity, f: c.force, load: c.extraLoadKg }));
  const xMax = Math.ceil(Math.max(p.v0, optV0 ?? 0) * 2) / 2;
  const yMax = Math.ceil(Math.max(p.f0, optF0 ?? 0) / 5) * 5;
  const tick = { fill: "var(--color-text-muted)", fontSize: 12 };

  return (
    <section aria-label="Resultado del perfil" className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <MetricCard stacked label="F0" value={fmt(p.f0, 1)} unit="N/kg" />
        <MetricCard stacked label="V0" value={fmt(p.v0, 2)} unit="m/s" />
        <MetricCard stacked label="Pmáx" value={fmt(p.pmax, 1)} unit="W/kg" />
      </div>
      {p.ratioPct !== null && p.orientation && (
        <Card className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Perfil respecto al óptimo (pendiente real / óptima)</span>
          <span className="nums text-xl">{fmt(p.ratioPct, 0)} %</span>
          <span className="text-sm">{orientationText[p.orientation]}</span>
          <span className="text-xs text-text-muted">
            Pendiente {fmt(p.slope, 1)} · óptima {fmt(p.optimalSlope, 1)} N·s/m/kg · ajuste r² {fmt(p.r2, 3)}
          </span>
        </Card>
      )}
      <figure aria-label="Gráfica fuerza-velocidad: saltos, perfil real y perfil óptimo" className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 8, right: 12, bottom: 18, left: -4 }}>
            <CartesianGrid stroke="var(--color-border)" />
            <XAxis
              type="number"
              dataKey="v"
              domain={[0, xMax]}
              tick={tick}
              stroke="var(--color-border-input)"
              label={{ value: "Velocidad (m/s)", position: "insideBottom", offset: -10, fill: "var(--color-text-muted)", fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="f"
              domain={[0, yMax]}
              tick={tick}
              stroke="var(--color-border-input)"
              label={{ value: "Fuerza (N/kg)", angle: -90, position: "insideLeft", offset: 14, fill: "var(--color-text-muted)", fontSize: 12 }}
            />
            <Tooltip
              formatter={(value, name) => [fmt(Number(value), 2), name === "f" ? "Fuerza (N/kg)" : name === "v" ? "Velocidad (m/s)" : String(name)]}
              labelFormatter={() => ""}
            />
            <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12, color: "var(--color-text)" }} />
            {optimal.length > 0 && (
              <Line data={optimal} dataKey="f" name="Perfil óptimo" stroke="var(--color-text-muted)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
            )}
            <Line data={actual} dataKey="f" name="Perfil real" stroke="var(--color-chart-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Scatter data={scatter} dataKey="f" name="Saltos" fill="var(--color-chart-primary)" stroke="var(--color-bg)" strokeWidth={2} shape="circle" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </figure>
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer font-semibold">Ver los datos en tabla</summary>
        <table className="nums mt-2 w-full text-left text-sm">
          <thead className="text-text-muted">
            <tr>
              <th scope="col" className="py-1">Carga</th>
              <th scope="col" className="py-1 text-right">Fuerza (N/kg)</th>
              <th scope="col" className="py-1 text-right">Velocidad (m/s)</th>
            </tr>
          </thead>
          <tbody>
            {[...points].sort((a, b) => a.extraLoadKg - b.extraLoadKg).map((c) => (
              <tr key={c.testId} className="border-t border-border">
                <td className="py-2">{fmt(c.extraLoadKg, 0)} kg</td>
                <td className="py-2 text-right">{fmt(c.force, 1)}</td>
                <td className="py-2 text-right">{fmt(c.velocity, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="text-xs text-text-muted">
        Método de Samozino: fuerza y velocidad medias del empuje a partir de la altura, el peso y la distancia de empuje. El
        perfil óptimo se calcula con el mismo modelo, buscando la pendiente que con la misma potencia daría el salto más alto.
      </p>
    </section>
  );
}
