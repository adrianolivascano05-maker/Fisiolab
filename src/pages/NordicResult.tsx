import { RotateCcw } from "lucide-react";
import { Link } from "react-router";
import { nordicTorque, plausibleNordic } from "../calc/nordic";
import { fmt, fmtDate, fmtDateTime } from "../app/format";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { nordicEntries, type Patient, type Test } from "../data/repo";
import { Alert } from "../ui/Alert";
import { MetricCard } from "../ui/Card";

const linkPrimary = "inline-flex h-14 items-center justify-center gap-2 rounded-md bg-accent px-6 text-lg text-on-accent hover:bg-accent-hover";
const linkSecondary = "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border-input px-4 font-semibold hover:bg-surface";

/** Resultado del nórdico (dentro de S08): ángulo de rotura, momento estimado y evolución. */
export function NordicResult({ test, patient }: { test: Test; patient: Patient }) {
  const history = useAsync(() => nordicEntries(getDb(), patient.id), [patient.id, test.id]);
  const angle = test.results.find((r) => r.metric === "angle_deg" && r.seriesIndex === 0)?.value;
  const viaVideo = test.details.method !== "manual";
  // El momento se calcula con los datos actuales del paciente (por si se añadieron después).
  const torque = angle !== undefined && patient.bodyMassKg && patient.heightCm ? nordicTorque(patient.bodyMassKg, patient.heightCm, angle) : null;
  const odd = angle !== undefined && (angle < plausibleNordic.angleDeg.min || angle > plausibleNordic.angleDeg.max);

  return (
    <>
      <p className="text-sm text-text-muted">
        {fmtDateTime(test.performedAt)} · {viaVideo ? `vídeo${test.video ? ` a ${fmt(test.video.captureFps, 0)} fps` : ""}` : "a mano"}
      </p>
      {angle === undefined ? (
        <Alert tone="info" title="Falta marcar la rotura">
          <Link className="underline" to={`/tests/${test.id}/marcar`}>
            Marcar ahora
          </Link>
        </Alert>
      ) : (
        <>
          <MetricCard
            size="lg"
            label="Ángulo de rotura"
            value={fmt(angle, 0)}
            unit="°"
            detail={`Respecto a la vertical (con el suelo: ${fmt(90 - angle, 0)}°). Más ángulo, más fuerza excéntrica.`}
            warning={odd ? "Ángulo poco habitual: revisa el fotograma y los puntos." : undefined}
          />
          {torque ? (
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Momento por pierna (estimado)" value={fmt(torque.perLegNm, 0)} unit="N·m" />
              <MetricCard label="Relativo al peso" value={fmt(torque.perLegNmKg, 2)} unit="N·m/kg" />
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              Para estimar el momento de los isquios, añade el peso y la estatura en la{" "}
              <Link className="text-accent underline" to={`/pacientes/${patient.id}/editar`}>
                ficha
              </Link>
              .
            </p>
          )}
          {torque && (
            <p className="text-xs text-text-muted">
              Estimación con proporciones corporales medias: masa por encima de las rodillas × gravedad × distancia de la rodilla a su
              centro de masas × seno del ángulo, repartida entre las dos piernas. Sirve para comparar al mismo paciente en el tiempo.
            </p>
          )}
        </>
      )}

      {history.data && history.data.length > 1 && (
        <section aria-labelledby="h-nordico" className="flex flex-col gap-2">
          <h2 id="h-nordico" className="text-lg">
            Evolución
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="nums w-full text-left text-sm">
              <caption className="sr-only">Nórdicos del paciente</caption>
              <thead className="bg-surface text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Fecha</th>
                  <th scope="col" className="px-3 py-2 text-right">Ángulo</th>
                  <th scope="col" className="px-3 py-2 text-right">N·m por pierna</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((e) => (
                  <tr key={e.testId} className={e.testId === test.id ? "border-t border-border bg-accent-soft font-semibold" : "border-t border-border"}>
                    <th scope="row" className="px-3 py-2 font-normal">
                      {e.testId === test.id ? fmtDate(e.performedAt) : (
                        <Link className="text-accent underline" to={`/tests/${e.testId}`}>
                          {fmtDate(e.performedAt)}
                        </Link>
                      )}
                      {e.testId === test.id && <span className="sr-only"> (este)</span>}
                    </th>
                    <td className="px-3 py-2 text-right">{fmt(e.angleDeg, 0)}°</td>
                    <td className="px-3 py-2 text-right">{e.torqueNm === null ? "—" : fmt(e.torqueNm, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2">
        <Link to={`/pacientes/${patient.id}/test/isquios`} className={linkPrimary}>
          <RotateCcw aria-hidden="true" className="size-5" /> Otro nórdico
        </Link>
        {viaVideo && (
          <Link to={`/tests/${test.id}/marcar`} className={linkSecondary}>
            Revisar la rotura y el ángulo
          </Link>
        )}
      </div>
    </>
  );
}
