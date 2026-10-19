import { ChartLine, RotateCcw, Scale } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { plausible } from "../calc/jump";
import { needsVideo } from "../calc/results";
import { fmt, fmtDateTime, isJumpType, jumpLabels, metricLabels, sideLabels, testTitle } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { deleteTest, getPatient, getTest, type Result, type Test } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { MetricCard } from "../ui/Card";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { RomResult } from "./RomResult";
import { VbtResult } from "./VbtResult";
import { NordicResult } from "./NordicResult";
import { CodResult, RunningResult, SprintResult } from "./SpeedResults";
import { isCodType } from "../calc/cod";
import { ValidateLinks } from "./ValidateLinks";

const linkPrimary = "inline-flex h-14 items-center justify-center gap-2 rounded-md bg-accent px-6 text-lg text-on-accent hover:bg-accent-hover";
const linkSecondary = "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border-input px-4 font-semibold hover:bg-surface";
const linkGhost = "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold text-accent hover:bg-accent-soft";

/** S08 Resultado del salto */
export function ResultPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const data = useAsync(async () => {
    const t = await getTest(getDb(), id);
    return { test: t, patient: t ? await getPatient(getDb(), t.patientId) : null };
  }, [id]);

  if (data.error) return <Page title="Resultado" backTo="/"><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Resultado" backTo="/"><Loading /></Page>;
  const { test, patient } = data.data;
  if (!test || !patient) return <Page title="Resultado" backTo="/"><LoadError error={new Error("Esta medición no existe.")} /></Page>;

  const back = `/pacientes/${patient.id}/mediciones`;
  const deleteUi = (
    <>
      <Button variant="ghost" className="text-danger" onClick={() => setConfirm(true)}>
        Borrar esta medición
      </Button>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Borrar esta medición?">
        <p>Se borrarán sus marcas y resultados. No se puede deshacer.</p>
        <Button variant="danger" block onClick={remove}>
          Borrar
        </Button>
        <Button variant="secondary" block onClick={() => setConfirm(false)}>
          Cancelar
        </Button>
      </Sheet>
    </>
  );

  async function remove() {
    await deleteTest(getDb(), id);
    toast("Medición borrada", "success");
    navigate(back, { replace: true });
  }

  if (test.type === "sprint_linear" || test.type === "running" || isCodType(test.type)) {
    const Result = test.type === "sprint_linear" ? SprintResult : test.type === "running" ? RunningResult : CodResult;
    return (
      <Page title={`${testTitle(test)} · ${patient.name}`} backTo={back}>
        <Result test={test} patient={patient} />
        <ValidateLinks test={test} />
        {deleteUi}
      </Page>
    );
  }
  if (test.type === "nordic") {
    return (
      <Page title={`Nórdico · ${patient.name}`} backTo={back}>
        <NordicResult test={test} patient={patient} />
        <ValidateLinks test={test} />
        {deleteUi}
      </Page>
    );
  }
  if (test.type === "vbt") {
    return (
      <Page title={`${testTitle({ ...test, exercise: String(test.details.exercise ?? "") })} · ${patient.name}`} backTo={back}>
        <VbtResult test={test} patient={patient} />
        <ValidateLinks test={test} />
        {deleteUi}
      </Page>
    );
  }
  if (!isJumpType(test.type)) {
    return (
      <Page title={`${testTitle({ ...test, movement: String(test.details.movement ?? "") })} · ${patient.name}`} backTo={back}>
        <RomResult test={test} patient={patient} />
        <ValidateLinks test={test} />
        {deleteUi}
      </Page>
    );
  }
  const type = test.type;
  const summary = test.results.filter((r) => r.seriesIndex === 0);
  const get = (m: string) => summary.find((r) => r.metric === m);
  const again = new URLSearchParams({ tipo: type, carga: String(test.extraLoadKg) });
  if (test.dropHeightCm) again.set("caida", String(test.dropHeightCm));
  if (test.side) again.set("lado", test.side === "left" ? "right" : "left"); // la otra pierna
  const title = `${jumpLabels[type].short}${test.side ? ` ${sideLabels[test.side]}` : ""} · ${patient.name}`;
  const marked = summary.length > 0;

  return (
    <Page title={title} backTo={back}>
      <p className="text-sm text-text-muted">
        {fmtDateTime(test.performedAt)}
        {test.extraLoadKg > 0 && ` · carga ${fmt(test.extraLoadKg)} kg`}
        {test.dropHeightCm && ` · cajón ${fmt(test.dropHeightCm, 0)} cm`}
        {test.video && ` · ${fmt(test.video.captureFps, 0)} fps`}
      </p>

      {!marked ? (
        <Alert tone="info" title="Este salto no está marcado">
          <Link className="underline" to={`/tests/${id}/marcar`}>
            Marcar ahora
          </Link>
        </Alert>
      ) : test.type === "horizontal" ? (
        <MetricCard size="lg" label="Distancia" value={fmt(get("jump_distance_cm")?.value, 0)} unit="cm" />
      ) : test.type === "rj_10_5" ? (
        <RepeatedResult test={test} get={get} />
      ) : (
        <SingleResult test={test} get={get} hasPowerData={!!patient.bodyMassKg && !!patient.pushOffDistanceCm} patientId={patient.id} />
      )}

      <div className="flex flex-col gap-2">
        {needsVideo(type) ? (
          <Link to={`/pacientes/${patient.id}/test/saltos/video?${again}`} className={linkPrimary}>
            <RotateCcw aria-hidden="true" className="size-5" />
            {test.side ? `Ahora la pierna ${sideLabels[test.side === "left" ? "right" : "left"]}` : `Otro ${jumpLabels[type].short}`}
          </Link>
        ) : (
          <Link to={`/pacientes/${patient.id}/test/saltos`} className={linkPrimary}>
            <RotateCcw aria-hidden="true" className="size-5" /> Otro salto
          </Link>
        )}
        {needsVideo(type) && (
          <Link to={`/tests/${id}/marcar`} className={linkSecondary}>
            {marked ? "Revisar marcas y recalcular" : "Marcar"}
          </Link>
        )}
        {test.side && (
          <Link to={`/pacientes/${patient.id}/asimetria`} className={linkGhost}>
            <Scale aria-hidden="true" className="size-5" /> Ver asimetría
          </Link>
        )}
        <Link to={`/pacientes/${patient.id}/evolucion/${type}`} className={linkGhost}>
          <ChartLine aria-hidden="true" className="size-5" /> Ver evolución
        </Link>
        <ValidateLinks test={test} />
        {deleteUi}
      </div>
    </Page>
  );
}

type Getter = (metric: string) => Result | undefined;

function SingleResult({ test, get, hasPowerData, patientId }: { test: Test; get: Getter; hasPowerData: boolean; patientId: string }) {
  const height = get("jump_height_cm")!;
  const contact = get("contact_time_ms");
  const warnHeight = height.value < plausible.heightCm.min || height.value > plausible.heightCm.max;
  const warnContact = contact && (contact.value < plausible.contactTimeMs.min || contact.value > plausible.contactTimeMs.max);
  const secondary = ["rsi", "contact_time_ms", "dri", "stiffness_kn_m", "rsi_mod", "time_to_takeoff_ms", "power_w", "relative_power_w_kg", "force_n", "velocity_m_s"]
    .map(get)
    .filter((r) => r !== undefined);
  return (
    <>
      <MetricCard
        size="lg"
        label="Altura del salto"
        value={fmt(height.value)}
        unit="cm"
        detail={`Tiempo de vuelo ${fmt(get("flight_time_ms")?.value, 0)} ms`}
        warning={warnHeight ? "Valor poco habitual: revisa las marcas y los fps de grabación." : undefined}
      />
      {secondary.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {secondary.map((r) => (
            <MetricCard
              key={r.metric}
              label={metricLabels[r.metric]?.label ?? r.metric}
              value={fmt(r.value, metricLabels[r.metric]?.digits ?? 1)}
              unit={r.unit || undefined}
              warning={r.metric === "contact_time_ms" && warnContact ? "Revisa la marca de contacto." : undefined}
            />
          ))}
        </div>
      )}
      <HowCalculated test={test} heightCm={height.value} />
      {(test.type === "cmj" || test.type === "sj") && !get("power_w") && !hasPowerData && (
        <p className="text-sm text-text-muted">
          Para fuerza y potencia, añade la masa y la distancia de empuje en la{" "}
          <Link className="text-accent underline" to={`/pacientes/${patientId}/editar`}>
            ficha
          </Link>{" "}
          y vuelve a calcular.
        </p>
      )}
      {test.type === "dj" && !get("stiffness_kn_m") && <p className="text-sm text-text-muted">Para la rigidez vertical, añade la masa del paciente y vuelve a calcular.</p>}
      {(test.type === "cmj_arms" || test.type === "single_leg") && (
        <p className="text-sm text-text-muted">
          Fuerza y potencia no se calculan en este salto: el método de Samozino supone dos piernas y sin impulso de brazos.
        </p>
      )}
    </>
  );
}

/** Cálculo a la vista: fotogramas marcados, fps y fórmula. Los mismos fotogramas dan siempre el mismo resultado. */
function HowCalculated({ test, heightCm }: { test: Test; heightCm: number }) {
  const at = (e: string) => test.marks.find((m) => m.event === e && m.seriesIndex === 0)?.frameIndex;
  const takeoff = at("takeoff");
  const landing = at("landing");
  const contact = at("contact");
  const fps = test.video?.captureFps;
  if (takeoff === undefined || landing === undefined || !fps) return null;
  const frames = landing - takeoff;
  const flightS = frames / fps;
  return (
    <details className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold">Cómo se ha calculado</summary>
      <dl className="nums mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {contact !== undefined && (
          <>
            <dt className="text-text-muted">Contacto</dt>
            <dd>fotograma {contact + 1}</dd>
          </>
        )}
        <dt className="text-text-muted">Despegue</dt>
        <dd>fotograma {takeoff + 1}</dd>
        <dt className="text-text-muted">Aterrizaje</dt>
        <dd>fotograma {landing + 1}</dd>
        <dt className="text-text-muted">Vuelo</dt>
        <dd>
          {frames} fotogramas ÷ {fmt(fps, 0)} fps = {fmt(flightS * 1000, 0)} ms
        </dd>
        <dt className="text-text-muted">Altura</dt>
        <dd>
          9,81 × {fmt(flightS, 3)}² ÷ 8 = {fmt(heightCm)} cm
        </dd>
      </dl>
      <p className="mt-2 text-text-muted">
        Todo en el sistema métrico. Con los mismos fotogramas y los mismos fps sale siempre el mismo resultado; un fotograma más o menos
        cambia el vuelo en {fmt(1000 / fps, 1)} ms.
      </p>
    </details>
  );
}

function RepeatedResult({ test, get }: { test: Test; get: Getter }) {
  const rsi = get("rsi");
  const perJump = new Map<number, Record<string, number>>();
  for (const r of test.results.filter((r) => r.seriesIndex > 0)) {
    perJump.set(r.seriesIndex, { ...perJump.get(r.seriesIndex), [r.metric]: r.value });
  }
  const jumps = [...perJump.entries()].sort((a, b) => a[0] - b[0]);
  const best = new Set(
    jumps
      .filter(([, m]) => m.rsi !== undefined)
      .sort((a, b) => b[1].rsi! - a[1].rsi!)
      .slice(0, 5)
      .map(([i]) => i),
  );
  return (
    <>
      {rsi ? (
        <>
          <MetricCard size="lg" label="RSI (media de los 5 mejores)" value={fmt(rsi.value, 2)} detail={`${jumps.length} saltos marcados`} />
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Altura media (5 mejores)" value={fmt(get("jump_height_cm")?.value)} unit="cm" />
            <MetricCard label="Contacto medio (5 mejores)" value={fmt(get("contact_time_ms")?.value, 0)} unit="ms" />
          </div>
        </>
      ) : (
        <Alert tone="warning" title="Faltan saltos">
          Hacen falta al menos 6 saltos marcados para calcular el RSI de los 5 mejores rebotes.
        </Alert>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="nums w-full text-left text-sm">
          <caption className="sr-only">Resultados de cada salto de la serie</caption>
          <thead className="bg-surface text-text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Salto</th>
              <th scope="col" className="px-3 py-2 text-right">Altura (cm)</th>
              <th scope="col" className="px-3 py-2 text-right">Contacto (ms)</th>
              <th scope="col" className="px-3 py-2 text-right">RSI</th>
            </tr>
          </thead>
          <tbody>
            {jumps.map(([i, m]) => (
              <tr key={i} className={best.has(i) ? "border-t border-border bg-accent-soft font-semibold" : "border-t border-border"}>
                <th scope="row" className="px-3 py-2 font-normal">
                  {i}
                  {best.has(i) && <span className="sr-only"> (entre los 5 mejores)</span>}
                </th>
                <td className="px-3 py-2 text-right">{fmt(m.jump_height_cm)}</td>
                <td className="px-3 py-2 text-right">{m.contact_time_ms === undefined ? "—" : fmt(m.contact_time_ms, 0)}</td>
                <td className="px-3 py-2 text-right">{m.rsi === undefined ? "—" : fmt(m.rsi, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted">Resaltados, los 5 rebotes de mayor RSI. El primer salto sale de parado y no tiene contacto previo.</p>
    </>
  );
}
