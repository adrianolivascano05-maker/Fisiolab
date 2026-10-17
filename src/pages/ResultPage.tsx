import { ChartLine, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { plausible } from "../calc/jump";
import { fmt, fmtDateTime, jumpLabels, metricLabels } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { deleteTest, getPatient, getTest } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { MetricCard } from "../ui/Card";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

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
  if (!test || !patient) return <Page title="Resultado" backTo="/"><LoadError error={new Error("Este test no existe.")} /></Page>;

  const back = `/pacientes/${patient.id}`;
  const get = (m: string) => test.results.find((r) => r.metric === m);
  const height = get("jump_height_cm");
  const contact = get("contact_time_ms");
  const secondary = ["rsi", "contact_time_ms", "power_w", "relative_power_w_kg", "force_n", "velocity_m_s"]
    .map(get)
    .filter((r) => r !== undefined);
  const again = new URLSearchParams({ tipo: test.type, carga: String(test.extraLoadKg) });
  if (test.dropHeightCm) again.set("caida", String(test.dropHeightCm));

  const warnHeight = height && (height.value < plausible.heightCm.min || height.value > plausible.heightCm.max);
  const warnContact = contact && (contact.value < plausible.contactTimeMs.min || contact.value > plausible.contactTimeMs.max);

  async function remove() {
    await deleteTest(getDb(), id);
    toast("Test borrado", "success");
    navigate(back, { replace: true });
  }

  return (
    <Page title={`${jumpLabels[test.type].short} · ${patient.name}`} backTo={back}>
      <p className="text-sm text-text-muted">
        {fmtDateTime(test.performedAt)}
        {test.extraLoadKg > 0 && ` · carga ${fmt(test.extraLoadKg)} kg`}
        {test.dropHeightCm && ` · cajón ${fmt(test.dropHeightCm, 0)} cm`}
        {test.video && ` · ${fmt(test.video.captureFps, 0)} fps`}
      </p>

      {!height ? (
        <Alert tone="info" title="Este salto no está marcado">
          <Link className="underline" to={`/tests/${id}/marcar`}>
            Marcar ahora
          </Link>
        </Alert>
      ) : (
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
          {test.type !== "dj" && !get("power_w") && (
            <p className="text-sm text-text-muted">
              Para fuerza y potencia, añade la masa y la distancia de empuje en la{" "}
              <Link className="text-accent underline" to={`/pacientes/${patient.id}/editar`}>
                ficha
              </Link>{" "}
              y vuelve a calcular.
            </p>
          )}
        </>
      )}

      <div className="flex flex-col gap-2">
        <Link
          to={`/pacientes/${patient.id}/test/saltos/video?${again}`}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-md bg-accent px-6 text-lg text-on-accent hover:bg-accent-hover"
        >
          <RotateCcw aria-hidden="true" className="size-5" /> Otro {jumpLabels[test.type].short}
        </Link>
        <Link
          to={`/tests/${id}/marcar`}
          className="inline-flex h-11 items-center justify-center rounded-md border border-border-input px-4 font-semibold hover:bg-surface"
        >
          {height ? "Revisar marcas y recalcular" : "Marcar"}
        </Link>
        <Link
          to={`/pacientes/${patient.id}/evolucion/${test.type}`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold text-accent hover:bg-accent-soft"
        >
          <ChartLine aria-hidden="true" className="size-5" /> Ver evolución
        </Link>
        <Button variant="ghost" className="text-danger" onClick={() => setConfirm(true)}>
          Borrar este test
        </Button>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Borrar este test?">
        <p>Se borrarán sus marcas y resultados. No se puede deshacer.</p>
        <Button variant="danger" block onClick={remove}>
          Borrar
        </Button>
        <Button variant="secondary" block onClick={() => setConfirm(false)}>
          Cancelar
        </Button>
      </Sheet>
    </Page>
  );
}
