import { dayOf as day } from "../app/dates";
import { RotateCcw } from "lucide-react";
import { Link } from "react-router";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { codDeficit, getCodTest, turnAsymmetry } from "../calc/cod";
import { modelDistance, segments, type Split } from "../calc/sprint";
import { fmt, fmtDate, fmtDateTime, sideLabels } from "../app/format";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { bestSprintSplit, timedEntries, type Patient, type Test } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Card, MetricCard } from "../ui/Card";

const linkPrimary = "inline-flex h-14 items-center justify-center gap-2 rounded-md bg-accent px-6 text-lg text-on-accent hover:bg-accent-hover";
const linkSecondary = "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border-input px-4 font-semibold hover:bg-surface";
const m = (d: number) => `${fmt(d, d % 1 ? 1 : 0)} m`;

function Meta({ test }: { test: Test }) {
  const viaVideo = test.details.method !== "manual";
  return (
    <p className="text-sm text-text-muted">
      {fmtDateTime(test.performedAt)} · {viaVideo ? `vídeo${test.video ? ` a ${fmt(test.video.captureFps, 0)} fps` : ""}` : "fotocélulas o cronómetro"}
    </p>
  );
}

function Unmarked({ test }: { test: Test }) {
  return (
    <Alert tone="info" title="Falta marcar el vídeo">
      <Link className="underline" to={`/tests/${test.id}/marcar`}>
        Marcar ahora
      </Link>
    </Alert>
  );
}

/** S15 Resultado del sprint: tiempos de paso, tramos y perfil fuerza-velocidad. */
export function SprintResult({ test, patient }: { test: Test; patient: Patient }) {
  const gates = (test.details.gates as number[]) ?? [];
  const r = (metric: string) => test.results.find((x) => x.metric === metric && x.seriesIndex === 0)?.value;
  const splits: Split[] = test.results
    .filter((x) => x.metric === "split_time_s" && x.seriesIndex > 0)
    .sort((a, b) => a.seriesIndex - b.seriesIndex)
    .map((x) => ({ distanceM: gates[x.seriesIndex - 1]!, timeS: x.value }));
  const history = useAsync(() => timedEntries(getDb(), patient.id, "sprint_linear"), [patient.id, test.id]);
  const again = new URLSearchParams({ tipo: "sprint_linear", pasos: gates.join("-") });
  const f0 = r("f0_n_kg");
  const v0 = r("v0_m_s");
  const pmax = r("pmax_w_kg");
  const tau = r("tau_s");

  return (
    <>
      <Meta test={test} />
      {splits.length === 0 ? (
        <Unmarked test={test} />
      ) : (
        <>
          <MetricCard size="lg" label={`Tiempo en ${m(splits.at(-1)!.distanceM)}`} value={fmt(splits.at(-1)!.timeS, 2)} unit="s" detail={`Velocidad máxima entre pasos: ${fmt(r("max_velocity_m_s"), 2)} m/s`} />
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="nums w-full text-left text-sm">
              <caption className="sr-only">Tiempos de paso y tramos</caption>
              <thead className="bg-surface text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Paso</th>
                  <th scope="col" className="px-3 py-2 text-right">Tiempo (s)</th>
                  <th scope="col" className="px-3 py-2 text-right">Tramo (s)</th>
                  <th scope="col" className="px-3 py-2 text-right">m/s</th>
                </tr>
              </thead>
              <tbody>
                {segments(splits).map((s) => (
                  <tr key={s.toM} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 font-normal">{m(s.toM)}</th>
                    <td className="px-3 py-2 text-right">{fmt(s.timeS + (splits.find((x) => x.distanceM === s.fromM)?.timeS ?? 0), 2)}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.timeS, 2)}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.velocity, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {f0 !== undefined && v0 !== undefined && pmax !== undefined && tau !== undefined ? (
            <section aria-labelledby="h-perfil" className="flex flex-col gap-3">
              <h2 id="h-perfil" className="text-lg">
                Perfil fuerza-velocidad del sprint
              </h2>
              <div className="grid grid-cols-3 gap-2">
                <MetricCard stacked label="F0" value={fmt(f0, 1)} unit="N/kg" />
                <MetricCard stacked label="V0" value={fmt(v0, 2)} unit="m/s" />
                <MetricCard stacked label="Pmáx" value={fmt(pmax, 1)} unit="W/kg" />
              </div>
              {patient.bodyMassKg && (
                <p className="text-sm">
                  Con {fmt(patient.bodyMassKg, 0)} kg: F0 {fmt(f0 * patient.bodyMassKg, 0)} N y Pmáx {fmt(pmax * patient.bodyMassKg, 0)} W.
                </p>
              )}
              <SprintChart splits={splits} vmax={v0} tau={tau} />
              <p className="text-xs text-text-muted">
                Modelo de velocidad v(t) = V0 · (1 − e^(−t/τ)) ajustado a los pasos, con τ = {fmt(tau, 2)} s; F0 = V0/τ y Pmáx = F0·V0/4. Sin la
                resistencia del aire, F0 y V0 salen algo por debajo del método completo: sirve para seguir al mismo paciente.
              </p>
            </section>
          ) : (
            splits.length < 3 && <p className="text-sm text-text-muted">Con 3 pasos o más se calcula el perfil fuerza-velocidad del sprint.</p>
          )}
        </>
      )}
      <History title="Sprints" entries={history.data ?? []} current={test.id} unit="s" />
      <div className="flex flex-col gap-2">
        <Link to={`/pacientes/${patient.id}/test/sprint?${again}`} className={linkPrimary}>
          <RotateCcw aria-hidden="true" className="size-5" /> Otro sprint
        </Link>
        {test.details.method !== "manual" && (
          <Link to={`/tests/${test.id}/marcar`} className={linkSecondary}>
            Revisar marcas
          </Link>
        )}
      </div>
    </>
  );
}

function SprintChart({ splits, vmax, tau }: { splits: Split[]; vmax: number; tau: number }) {
  const tEnd = splits.at(-1)!.timeS;
  const curve = Array.from({ length: 41 }, (_, i) => {
    const t = (tEnd * 1.05 * i) / 40;
    return { t: Number(t.toFixed(3)), d: Number(modelDistance(vmax, tau, t).toFixed(2)) };
  });
  const points = splits.map((s) => ({ t: s.timeS, d: s.distanceM }));
  const tick = { fill: "var(--color-text-muted)", fontSize: 12 };
  return (
    <figure aria-label="Distancia en el tiempo: pasos medidos y curva del modelo" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 8, right: 12, bottom: 18, left: -8 }}>
          <CartesianGrid stroke="var(--color-border)" />
          <XAxis type="number" dataKey="t" domain={[0, Math.ceil(tEnd * 1.05)]} allowDecimals={false} tickFormatter={(v) => fmt(Number(v), 0)} tick={tick} stroke="var(--color-border-input)" label={{ value: "Tiempo (s)", position: "insideBottom", offset: -10, fill: "var(--color-text-muted)", fontSize: 12 }} />
          <YAxis type="number" dataKey="d" tick={tick} stroke="var(--color-border-input)" label={{ value: "Distancia (m)", angle: -90, position: "insideLeft", offset: 18, fill: "var(--color-text-muted)", fontSize: 12 }} />
          <Tooltip formatter={(v, name) => [fmt(Number(v), 2), name === "t" ? "Tiempo (s)" : "Distancia (m)"]} labelFormatter={() => ""} itemStyle={{ color: "var(--color-text)" }} />
          <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: "var(--color-text)" }}>{v}</span>} />
          <Line data={curve} dataKey="d" name="Modelo" stroke="var(--color-chart-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Scatter data={points} dataKey="d" name="Pasos" fill="var(--color-chart-right)" stroke="var(--color-bg)" strokeWidth={2} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}

/** S16 Resultado de cambio de dirección: tiempo, déficit (5-0-5) y asimetría entre giros. */
export function CodResult({ test, patient }: { test: Test; patient: Patient }) {
  const cod = getCodTest(test.type)!;
  const time = test.results.find((x) => x.metric === "time_s" && x.seriesIndex === 0)?.value;
  const data = useAsync(
    async () => ({
      history: await timedEntries(getDb(), patient.id, test.type),
      sprint10: test.type === "cod_505" ? await bestSprintSplit(getDb(), patient.id, 10) : null,
    }),
    [patient.id, test.id],
  );
  const sameDay = data.data?.history.filter((e) => day(e.performedAt) === day(test.performedAt)) ?? [];
  const best = (s: "left" | "right") => Math.min(...sameDay.filter((e) => e.side === s).map((e) => e.timeS));
  const asym = cod.sided && sameDay.some((e) => e.side === "left") && sameDay.some((e) => e.side === "right") ? turnAsymmetry(best("left"), best("right")) : null;
  const odd = time !== undefined && (time < cod.range[0] || time > cod.range[1]);
  const again = new URLSearchParams({ tipo: test.type });
  if (test.side) again.set("lado", test.side === "left" ? "right" : "left");

  return (
    <>
      <Meta test={test} />
      {time === undefined ? (
        <Unmarked test={test} />
      ) : (
        <>
          <MetricCard
            size="lg"
            label={`Tiempo${test.side ? `, girando con la ${sideLabels[test.side]}` : ""}`}
            value={fmt(time, 2)}
            unit="s"
            warning={odd ? "Tiempo poco habitual para este test: revisa las marcas o el tiempo." : undefined}
          />
          {test.type === "cod_505" && data.data?.sprint10 && (
            <Card className="flex flex-col gap-1">
              <span className="text-sm text-text-muted">Déficit de cambio de dirección</span>
              <span className="nums text-xl">{fmt(codDeficit(time, data.data.sprint10.timeS), 2)} s</span>
              <span className="text-xs text-text-muted">
                5-0-5 menos su mejor paso a 10 m en sprint ({fmt(data.data.sprint10.timeS, 2)} s, {fmtDate(data.data.sprint10.performedAt)}). Cuanto
                menor, mejor gira para lo rápido que es.
              </span>
            </Card>
          )}
          {test.type === "cod_505" && data.data && !data.data.sprint10 && (
            <p className="text-sm text-text-muted">Con un sprint que tenga un paso a 10 m se calcula el déficit de cambio de dirección.</p>
          )}
          {asym && (
            <Card className="flex flex-col gap-1">
              <span className="text-sm text-text-muted">Asimetría entre giros (mejor de cada lado, hoy)</span>
              <span className="nums text-xl">{fmt(asym.pct, 1)} %</span>
              <span className="text-sm">{asym.slower === "equal" ? "Gira igual con las dos." : `Más lento girando con la ${sideLabels[asym.slower]}.`}</span>
            </Card>
          )}
        </>
      )}
      <History title={cod.label} entries={data.data?.history ?? []} current={test.id} unit="s" sided={cod.sided} />
      <div className="flex flex-col gap-2">
        <Link to={`/pacientes/${patient.id}/test/sprint?${again}`} className={linkPrimary}>
          <RotateCcw aria-hidden="true" className="size-5" />
          {test.side ? `Ahora con la ${sideLabels[test.side === "left" ? "right" : "left"]}` : `Otro ${cod.label}`}
        </Link>
        {test.details.method !== "manual" && (
          <Link to={`/tests/${test.id}/marcar`} className={linkSecondary}>
            Revisar marcas
          </Link>
        )}
      </div>
    </>
  );
}

function History({ title, entries, current, unit, sided }: { title: string; entries: { testId: string; performedAt: string; timeS: number; side: "left" | "right" | null }[]; current: string; unit: string; sided?: boolean }) {
  if (entries.length < 2) return null;
  return (
    <section aria-labelledby="h-historial" className="flex flex-col gap-2">
      <h2 id="h-historial" className="text-lg">
        Evolución
      </h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="nums w-full text-left text-sm">
          <caption className="sr-only">{title}: todas las mediciones</caption>
          <thead className="bg-surface text-text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Fecha</th>
              {sided && <th scope="col" className="px-3 py-2">Gira con</th>}
              <th scope="col" className="px-3 py-2 text-right">Tiempo ({unit})</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.testId} className={e.testId === current ? "border-t border-border bg-accent-soft font-semibold" : "border-t border-border"}>
                <th scope="row" className="px-3 py-2 font-normal">
                  {e.testId === current ? (
                    <>
                      {fmtDate(e.performedAt)}
                      <span className="sr-only"> (este)</span>
                    </>
                  ) : (
                    <Link className="text-accent underline" to={`/tests/${e.testId}`}>
                      {fmtDate(e.performedAt)}
                    </Link>
                  )}
                </th>
                {sided && <td className="px-3 py-2">{e.side ? (e.side === "left" ? "Izq." : "Dcha.") : "—"}</td>}
                <td className="px-3 py-2 text-right">{fmt(e.timeS, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** S18 Resultado de la carrera: contacto, vuelo, frecuencia, factor de apoyo y asimetría. */
export function RunningResult({ test, patient }: { test: Test; patient: Patient }) {
  const r = (metric: string) => test.results.find((x) => x.metric === metric && x.seriesIndex === 0)?.value;
  const per = (metric: string) =>
    test.results
      .filter((x) => x.metric === metric && x.seriesIndex > 0)
      .sort((a, b) => a.seriesIndex - b.seriesIndex);
  const contacts = per("contact_time_ms");
  const flights = new Map(per("flight_time_ms").map((x) => [x.seriesIndex, x.value]));
  const first = test.details.firstSide === "right" ? "right" : "left";
  const sideOf = (i: number) => ((i - 1) % 2 === 0 ? first : first === "left" ? "right" : "left");
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const left = contacts.filter((c) => sideOf(c.seriesIndex) === "left").map((c) => c.value);
  const right = contacts.filter((c) => sideOf(c.seriesIndex) === "right").map((c) => c.value);
  const asym = r("asymmetry_pct");
  const speed = typeof test.details.speedKmh === "number" ? test.details.speedKmh : null;

  return (
    <>
      <p className="text-sm text-text-muted">
        {fmtDateTime(test.performedAt)}
        {speed !== null && ` · cinta a ${fmt(speed, 1)} km/h`}
        {test.video && ` · ${fmt(test.video.captureFps, 0)} fps`}
      </p>
      {contacts.length === 0 ? (
        <Unmarked test={test} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Tiempo de contacto" value={fmt(r("contact_time_ms"), 0)} unit="ms" />
            <MetricCard label="Tiempo de vuelo" value={fmt(r("flight_time_ms"), 0)} unit="ms" />
            <MetricCard label="Frecuencia de paso" value={fmt(r("step_frequency_spm"), 0)} unit="pasos/min" />
            <MetricCard label="Factor de apoyo" value={fmt(r("duty_factor"), 2)} detail="Contacto / zancada" />
          </div>
          {r("step_length_m") !== undefined && <MetricCard label="Longitud del paso" value={fmt(r("step_length_m"), 2)} unit="m" />}
          {left.length > 0 && right.length > 0 && asym !== undefined && (
            <Card className="flex flex-col gap-1">
              <span className="text-sm text-text-muted">Contacto medio por pie</span>
              <span className="nums">
                Izquierdo {fmt(mean(left), 0)} ms · derecho {fmt(mean(right), 0)} ms
              </span>
              <span className="text-sm">
                Asimetría {fmt(asym, 1)} %{asym > 0 && ` (más largo el ${mean(left) > mean(right) ? "izquierdo" : "derecho"})`}
              </span>
            </Card>
          )}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="nums w-full text-left text-sm">
              <caption className="sr-only">Cada apoyo</caption>
              <thead className="bg-surface text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Apoyo</th>
                  <th scope="col" className="px-3 py-2">Pie</th>
                  <th scope="col" className="px-3 py-2 text-right">Contacto (ms)</th>
                  <th scope="col" className="px-3 py-2 text-right">Vuelo (ms)</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.seriesIndex} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 font-normal">{c.seriesIndex}</th>
                    <td className="px-3 py-2">{sideOf(c.seriesIndex) === "left" ? "Izq." : "Dcho."}</td>
                    <td className="px-3 py-2 text-right">{fmt(c.value, 0)}</td>
                    <td className="px-3 py-2 text-right">{flights.has(c.seriesIndex) ? fmt(flights.get(c.seriesIndex), 0) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="flex flex-col gap-2">
        <Link to={`/pacientes/${patient.id}/test/carrera`} className={linkPrimary}>
          <RotateCcw aria-hidden="true" className="size-5" /> Otra carrera
        </Link>
        <Link to={`/tests/${test.id}/marcar`} className={linkSecondary}>
          Revisar marcas
        </Link>
      </div>
    </>
  );
}
