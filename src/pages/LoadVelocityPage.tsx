import { dayOf as day } from "../app/dates";
import { Dumbbell, Trash } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { exercises, getExercise, loadVelocityProfile, velocityAtLoad, type ExerciseId, type LoadVelocityProfile } from "../calc/strength";
import { decimalText, fmt, fmtDate, parseDecimal } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { deleteFvProfile, getMvt, getPatient, listLoadVelocityProfiles, saveLoadVelocityProfile, setMvt, vbtSets, type VbtSet } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button, IconButton } from "../ui/Button";
import { Card, MetricCard } from "../ui/Card";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/EmptyState";
import { NumberField, SelectField } from "../ui/Field";
import { useToast } from "../ui/Toast";


/** S14 Perfil carga-velocidad y 1RM estimado */
export function LoadVelocityPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const data = useAsync(async () => {
    const db = getDb();
    return { patient: await getPatient(db, id), sets: await vbtSets(db, id) };
  }, [id]);
  const measured = useMemo(() => exercises.filter((e) => data.data?.sets.some((s) => s.exercise === e.id)), [data.data]);
  const exercise: ExerciseId = getExercise(params.get("ejercicio") ?? "")?.id ?? measured[0]?.id ?? "squat";
  const saved = useAsync(() => listLoadVelocityProfiles(getDb(), id, exercise), [id, exercise]);
  const storedMvt = useAsync(() => getMvt(getDb(), exercise), [exercise]);

  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [mvtText, setMvtText] = useState("");
  const [saving, setSaving] = useState(false);
  const sets = useMemo(() => data.data?.sets.filter((s) => s.exercise === exercise) ?? [], [data.data, exercise]);

  // Al entrar o cambiar de ejercicio: se proponen las series del último día y el umbral guardado.
  useEffect(() => {
    if (!sets.length) return setChosen(new Set());
    const last = day(sets[0]!.performedAt);
    setChosen(new Set(sets.filter((s) => day(s.performedAt) === last).map((s) => s.testId)));
  }, [sets]);
  useEffect(() => {
    if (storedMvt.data !== undefined) setMvtText(decimalText(storedMvt.data));
  }, [storedMvt.data]);

  const title = "Perfil carga-velocidad";
  const back = `/pacientes/${id}/mediciones`;
  if (data.error) return <Page title={title} backTo={back}><LoadError error={data.error} /></Page>;
  if (!data.data || chosen === null) return <Page title={title} backTo={back}><Loading /></Page>;

  const ex = getExercise(exercise)!;
  const selected = sets.filter((s) => chosen.has(s.testId));
  const mvt = parseDecimal(mvtText);
  const mvtValid = mvt !== null && !Number.isNaN(mvt) && mvt >= 0.05 && mvt <= 1;
  let profile: LoadVelocityProfile | null = null;
  let profileError: string | null = null;
  if (selected.length >= 2 && mvtValid) {
    try {
      profile = loadVelocityProfile(selected.map((s) => ({ loadKg: s.loadKg, velocity: s.best })), mvt!);
    } catch (e) {
      profileError = e instanceof Error ? e.message : String(e);
    }
  } else if (selected.length === 1) {
    profileError = "Elige al menos dos series con cargas distintas.";
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      await saveLoadVelocityProfile(getDb(), id, exercise, selected, profile.mvt);
      toast("Perfil guardado", "success");
      saved.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title={title} backTo={back}>
      <p className="text-text-muted">{data.data.patient?.name}</p>
      {measured.length === 0 ? (
        <EmptyState icon={Dumbbell} title="Sin series de fuerza">
          Mide la velocidad de la barra con 3 o 4 cargas del mismo ejercicio.{" "}
          <Link className="text-accent underline" to={`/pacientes/${id}/test/fuerza`}>
            Medir ahora
          </Link>
        </EmptyState>
      ) : (
        <>
          {measured.length > 1 && (
            <SelectField label="Ejercicio" value={exercise} onChange={(e) => setParams({ ejercicio: e.target.value }, { replace: true })}>
              {measured.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </SelectField>
          )}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Series de {ex.label.toLowerCase()} (se usa la repetición más rápida)</legend>
            {sets.map((s) => (
              <SetRow
                key={s.testId}
                s={s}
                checked={chosen.has(s.testId)}
                onToggle={() =>
                  setChosen((c) => {
                    const n = new Set(c);
                    if (n.has(s.testId)) n.delete(s.testId);
                    else n.add(s.testId);
                    return n;
                  })
                }
              />
            ))}
          </fieldset>
          <NumberField
            label="Velocidad en el 1RM"
            unit="m/s"
            value={mvtText}
            onChange={(e) => setMvtText(e.target.value)}
            error={mvtText && !mvtValid ? "Entre 0,05 y 1 m/s." : undefined}
            hint={ex.mvtSource}
          />
          {mvtValid && storedMvt.data !== undefined && Math.abs(mvt! - storedMvt.data) > 1e-9 && (
            <Button
              variant="ghost"
              onClick={async () => {
                await setMvt(getDb(), exercise, mvt!);
                storedMvt.reload();
                toast(`Umbral de ${ex.label.toLowerCase()} guardado`, "success");
              }}
            >
              Usar siempre {fmt(mvt, 2)} m/s en {ex.label.toLowerCase()}
            </Button>
          )}

          {profileError && <Alert tone="warning" title="No se puede calcular el perfil">{profileError}</Alert>}
          {profile && (
            <>
              <ProfileView profile={profile} sets={selected} />
              <Button size="lg" block loading={saving} onClick={save}>
                Guardar perfil
              </Button>
            </>
          )}
        </>
      )}

      {saved.data && saved.data.length > 0 && (
        <section aria-labelledby="h-guardados" className="flex flex-col gap-2">
          <h2 id="h-guardados" className="text-lg">
            Perfiles guardados de {ex.label.toLowerCase()}
          </h2>
          <ul className="flex flex-col gap-2">
            {saved.data.map((p) => (
              <li key={p.id}>
                <Card className="flex items-center gap-3">
                  <div className="nums flex-1 text-sm">
                    <p className="font-semibold">
                      1RM {fmt(p.oneRmKg, 1)} kg · {fmtDate(p.performedAt)}
                    </p>
                    <p className="text-text-muted">
                      {p.testIds.length} series · umbral {fmt(p.mvt, 2)} m/s · r² {fmt(p.r2, 3)}
                    </p>
                  </div>
                  <IconButton
                    label={`Borrar el perfil del ${fmtDate(p.performedAt)}`}
                    onClick={async () => {
                      await deleteFvProfile(getDb(), p.id);
                      toast("Perfil borrado", "success");
                      saved.reload();
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

function SetRow({ s, checked, onToggle }: { s: VbtSet; checked: boolean; onToggle: () => void }) {
  return (
    <label className={cx("flex min-h-14 items-center gap-3 rounded-lg border p-3", checked ? "border-accent bg-accent-soft" : "border-border bg-bg")}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="size-5 accent-[var(--color-accent)]" />
      <span className="nums flex-1 text-sm">
        <span className="font-semibold">{fmt(s.loadKg, s.loadKg % 1 ? 1 : 0)} kg</span> · {fmtDate(s.performedAt)}
        <span className="block text-text-muted">{fmt(s.best, 2)} m/s</span>
      </span>
    </label>
  );
}

function ProfileView({ profile: p, sets }: { profile: LoadVelocityProfile; sets: VbtSet[] }) {
  const tick = { fill: "var(--color-text-muted)", fontSize: 12 };
  const xMax = Math.ceil((p.oneRmKg * 1.05) / 10) * 10;
  const line = [
    { load: 0, v: p.intercept },
    { load: p.oneRmKg, v: p.mvt },
  ];
  const points = sets.map((s) => ({ load: s.loadKg, v: s.best }));
  const perKg10 = -p.slope * 10;
  const pct = [40, 50, 60, 70, 80, 90, 100];
  return (
    <section aria-label="Resultado del perfil" className="flex flex-col gap-3">
      <MetricCard size="lg" label="1RM estimado" value={fmt(p.oneRmKg, 1)} unit="kg" detail={`Carga a la que la recta llega a ${fmt(p.mvt, 2)} m/s`} />
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Ajuste de la recta" value={fmt(p.r2, 3)} unit="r²" warning={p.r2 < 0.9 ? "Ajuste flojo: revisa alguna serie." : undefined} />
        <MetricCard label="Pierde por cada 10 kg" value={fmt(perKg10, 3)} unit="m/s" />
      </div>
      <figure aria-label="Gráfica carga-velocidad: series, recta y umbral del 1RM" className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 8, right: 12, bottom: 18, left: -4 }}>
            <CartesianGrid stroke="var(--color-border)" />
            <XAxis
              type="number"
              dataKey="load"
              domain={[0, xMax]}
              tick={tick}
              stroke="var(--color-border-input)"
              label={{ value: "Carga (kg)", position: "insideBottom", offset: -10, fill: "var(--color-text-muted)", fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="v"
              domain={[0, Math.ceil(p.intercept * 5) / 5]}
              tick={tick}
              stroke="var(--color-border-input)"
              label={{ value: "Velocidad (m/s)", angle: -90, position: "insideLeft", offset: 14, fill: "var(--color-text-muted)", fontSize: 12 }}
            />
            <Tooltip
              formatter={(value, name) => [fmt(Number(value), name === "load" ? 1 : 2), name === "load" ? "Carga (kg)" : "Velocidad (m/s)"]}
              labelFormatter={() => ""}
              itemStyle={{ color: "var(--color-text)" }}
            />
            <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: "var(--color-text)" }}>{v}</span>} />
            <ReferenceLine y={p.mvt} stroke="var(--color-text-muted)" strokeDasharray="6 4" />
            <Line data={line} dataKey="v" name="Recta carga-velocidad" stroke="var(--color-chart-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Scatter data={points} dataKey="v" name="Series" fill="var(--color-chart-primary)" stroke="var(--color-bg)" strokeWidth={2} shape="circle" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </figure>
      <p className="text-xs text-text-muted">La línea discontinua es la velocidad del 1RM ({fmt(p.mvt, 2)} m/s).</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="nums w-full text-left text-sm">
          <caption className="px-3 py-2 text-left font-semibold">Cargas por intensidad</caption>
          <thead className="bg-surface text-text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">% 1RM</th>
              <th scope="col" className="px-3 py-2 text-right">Carga (kg)</th>
              <th scope="col" className="px-3 py-2 text-right">Velocidad esperada (m/s)</th>
            </tr>
          </thead>
          <tbody>
            {pct.map((x) => {
              const load = (p.oneRmKg * x) / 100;
              return (
                <tr key={x} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 font-normal">{x} %</th>
                  <td className="px-3 py-2 text-right">{fmt(Math.round(load * 2) / 2, 1)}</td>
                  <td className="px-3 py-2 text-right">{fmt(velocityAtLoad(p, load), 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
