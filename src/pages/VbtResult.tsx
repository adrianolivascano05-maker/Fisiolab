import { Gauge, RotateCcw } from "lucide-react";
import { Link } from "react-router";
import { getExercise, plausibleVbt, summarizeSet } from "../calc/strength";
import { fmt, fmtDate, fmtDateTime } from "../app/format";
import { LoadError } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { listLoadVelocityProfiles, type Patient, type Test } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Card, MetricCard } from "../ui/Card";

const linkPrimary = "inline-flex h-14 items-center justify-center gap-2 rounded-md bg-accent px-6 text-lg text-on-accent hover:bg-accent-hover";
const linkSecondary = "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border-input px-4 font-semibold hover:bg-surface";
const linkGhost = "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold text-accent hover:bg-accent-soft";

/** Resultado de una serie con velocidad de barra (dentro de S08). */
export function VbtResult({ test, patient }: { test: Test; patient: Patient }) {
  const exercise = getExercise(String(test.details.exercise ?? ""));
  const profile = useAsync(
    async () => (exercise ? ((await listLoadVelocityProfiles(getDb(), patient.id, exercise.id))[0] ?? null) : null),
    [patient.id, exercise?.id],
  );
  if (!exercise) return <LoadError error={new Error("Ejercicio desconocido.")} />;

  const reps = test.results
    .filter((r) => r.metric === "bar_velocity_m_s" && r.seriesIndex > 0)
    .sort((a, b) => a.seriesIndex - b.seriesIndex)
    .map((r) => r.value);
  const romCm = typeof test.details.romCm === "number" ? test.details.romCm : null;
  const viaVideo = test.details.method !== "manual";
  const again = new URLSearchParams({ ejercicio: exercise.id, carga: String(test.extraLoadKg) });
  const lv = profile.data;

  return (
    <>
      <p className="text-sm text-text-muted">
        {fmtDateTime(test.performedAt)} · {fmt(test.extraLoadKg, test.extraLoadKg % 1 ? 1 : 0)} kg
        {viaVideo ? ` · vídeo${test.video ? ` a ${fmt(test.video.captureFps, 0)} fps` : ""}` : " · encoder"}
        {romCm !== null && ` · recorrido ${fmt(romCm, romCm % 1 ? 1 : 0)} cm`}
      </p>

      {reps.length === 0 ? (
        <Alert tone="info" title="Esta serie no está marcada">
          <Link className="underline" to={`/tests/${test.id}/marcar`}>
            Marcar ahora
          </Link>
        </Alert>
      ) : (
        <SetView reps={reps} loadKg={test.extraLoadKg} oneRmKg={lv?.oneRmKg ?? null} profileDate={lv?.performedAt ?? null} />
      )}

      <div className="flex flex-col gap-2">
        <Link to={`/pacientes/${patient.id}/test/fuerza?${again}`} className={linkPrimary}>
          <RotateCcw aria-hidden="true" className="size-5" /> Otra serie de {exercise.label.toLowerCase()}
        </Link>
        {viaVideo && (
          <Link to={`/tests/${test.id}/marcar`} className={linkSecondary}>
            {reps.length ? "Revisar marcas y recalcular" : "Marcar"}
          </Link>
        )}
        <Link to={`/pacientes/${patient.id}/perfil/carga-velocidad?ejercicio=${exercise.id}`} className={linkGhost}>
          <Gauge aria-hidden="true" className="size-5" /> Perfil carga-velocidad y 1RM
        </Link>
      </div>
    </>
  );
}

function SetView({ reps, loadKg, oneRmKg, profileDate }: { reps: number[]; loadKg: number; oneRmKg: number | null; profileDate: string | null }) {
  const s = summarizeSet(reps);
  const odd = reps.some((v) => v < plausibleVbt.velocityMS.min || v > plausibleVbt.velocityMS.max);
  const fastest = reps.indexOf(s.best);
  return (
    <>
      <MetricCard
        size="lg"
        label="Velocidad media (mejor repetición)"
        value={fmt(s.best, 2)}
        unit="m/s"
        detail={`${reps.length} ${reps.length === 1 ? "repetición" : "repeticiones"}`}
        warning={odd ? "Velocidad poco habitual: revisa el recorrido, las marcas y los fps." : undefined}
      />
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Media de la serie" value={fmt(s.mean, 2)} unit="m/s" />
        {s.velocityLossPct !== null ? (
          <MetricCard label="Pérdida de velocidad" value={fmt(s.velocityLossPct, 0)} unit="%" detail="De la más rápida a la última" />
        ) : (
          <MetricCard label="Pérdida de velocidad" value="—" detail="Hace falta más de una repetición" />
        )}
      </div>
      {oneRmKg !== null && oneRmKg > 0 && (
        <Card className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Intensidad respecto al 1RM estimado</span>
          <span className="nums text-xl">{fmt((loadKg / oneRmKg) * 100, 0)} % del 1RM</span>
          <span className="text-xs text-text-muted">
            1RM estimado {fmt(oneRmKg, 1)} kg, del perfil del {fmtDate(profileDate!)}.
          </span>
        </Card>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="nums w-full text-left text-sm">
          <caption className="sr-only">Velocidad de cada repetición</caption>
          <thead className="bg-surface text-text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Rep.</th>
              <th scope="col" className="px-3 py-2 text-right">m/s</th>
              <th scope="col" className="w-1/2 px-3 py-2">
                <span className="sr-only">Respecto a la más rápida</span>
              </th>
              <th scope="col" className="px-3 py-2 text-right">% mejor</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((v, i) => (
              <tr key={i} className={i === fastest ? "border-t border-border bg-accent-soft font-semibold" : "border-t border-border"}>
                <th scope="row" className="px-3 py-2 font-normal">
                  {i + 1}
                  {i === fastest && <span className="sr-only"> (la más rápida)</span>}
                </th>
                <td className="px-3 py-2 text-right">{fmt(v, 2)}</td>
                <td className="px-3 py-2" aria-hidden="true">
                  <span className="block h-2 w-full rounded-pill bg-surface">
                    <span className="block h-2 rounded-pill bg-chart-primary" style={{ width: `${(v / s.best) * 100}%` }} />
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{fmt((v / s.best) * 100, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
